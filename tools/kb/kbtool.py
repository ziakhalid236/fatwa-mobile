#!/usr/bin/env python3
"""Knowledge-library ingestion. Usage: kbtool.py <API_URL> <ADMIN_TOKEN_FILE> <job> [args]
Jobs: all [scholars.xlsx] | quran | hadith <book...> | openiti <AuthorDir/WorkDir>... | scholars <xlsx> | darulifta [jsonl]
Env: KB_CACHE (corpus dir), KB_STATE (resume file), RESEQ=1 (only set reading order).
Stops cleanly with exit 'DAILY_WRITE_LIMIT' when Cloudflare D1's free daily write limit is reached; re-run later and it resumes.
Batches are cached in /tmp/kb_cache so the same corpus can be replayed to another API (production)."""
import sys, json, re, os, time, hashlib, urllib.request, urllib.parse, concurrent.futures as cf

API, TOKEN_FILE, JOB, *ARGS = sys.argv[1:]
TOKEN = open(TOKEN_FILE).read().strip()
CACHE = os.environ.get('KB_CACHE', '/tmp/kb_cache'); os.makedirs(CACHE, exist_ok=True)
STATE_FILE = os.environ.get('KB_STATE', CACHE + '/state_' + re.sub(r'\W+', '_', API) + '.json')
STATE = set(json.load(open(STATE_FILE))) if os.path.exists(STATE_FILE) else set()
def save_state(): json.dump(sorted(STATE), open(STATE_FILE, 'w'))

def http(url, data=None, headers=None, timeout=90):
    h = {'User-Agent': 'Mozilla/5.0 fatwa-kb-ingest'}; h.update(headers or {})
    if 'api.github.com' in url and os.environ.get('GITHUB_TOKEN'): h['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
    req = urllib.request.Request(url, data=data, headers=h)
    return urllib.request.urlopen(req, timeout=timeout).read()

def get_json(url): return json.loads(http(url, timeout=120))

def post(path, body, retries=5):
    data = json.dumps(body, ensure_ascii=False).encode()
    for i in range(retries):
        try:
            return json.loads(http(API + path, data, {'Authorization': 'Bearer ' + TOKEN, 'content-type': 'application/json'}, timeout=120))
        except Exception as e:
            err = getattr(e, 'read', lambda: b'')()[:200]
            if i == retries - 1: raise RuntimeError(f'{e} {err}')
            time.sleep(2 * (i + 1))

BUDGET = [int(os.environ.get('KB_MAX_PASSAGES', '0')) or None]  # per-run cap; keeps free-tier daily D1 writes free for real users

def send_batches(source, work, passages, size=60):
    for i, p in enumerate(passages): p['seq'] = i
    if os.environ.get('RESEQ'):  # only set reading order on passages that are already stored
        chunks = [(i, passages[i:i + 500]) for i in range(0, len(passages), 500)]
        def one(c):
            start, ps = c
            return post('/api/admin/kb/reseq', {'source': source['name'], 'title': work['title'], 'start': start,
                'hashes': [hashlib.sha1(p['text'].strip().encode()).hexdigest() for p in ps]})
        with cf.ThreadPoolExecutor(4) as ex: list(ex.map(one, chunks))
        print(f'  reseq {work["title"][:40]}: {len(passages)}', flush=True); return
    batches = [(i, passages[i:i + size]) for i in range(0, len(passages), size)]
    todo = [(i, b) for i, b in batches if f"{work['title']}#{i}" not in STATE]
    capped = False
    if BUDGET[0] is not None:
        if BUDGET[0] <= 0: raise SystemExit('RUN_CAP')
        keep = max(1, BUDGET[0] // size)
        capped = len(todo) > keep; todo = todo[:keep]; BUDGET[0] -= len(todo) * size
    done = 0
    def one(item):
        i, b = item
        try: post('/api/admin/kb/ingest', {'source': source, 'work': work, 'passages': b}, retries=3)
        except RuntimeError as e:
            if 'exceeded' in str(e): raise SystemExit('DAILY_WRITE_LIMIT')
            raise
        return i
    with cf.ThreadPoolExecutor(3) as ex:
        futures = [ex.submit(one, t) for t in todo]
        try:
            for f in cf.as_completed(futures):
                STATE.add(f"{work['title']}#{f.result()}"); done += 1
                if done % 25 == 0: save_state(); print(f'  {work["title"][:40]}: {done}/{len(todo)} batches', flush=True)
        except BaseException:
            for f in futures: f.cancel()
            save_state(); raise
    save_state()
    print(f'  done {work["title"]}: {len(passages)} passages ({len(todo)} sent)', flush=True)
    if capped or (BUDGET[0] is not None and BUDGET[0] <= 0): raise SystemExit('RUN_CAP')

def cached(name, build):
    path = f'{CACHE}/{name}.json'
    if os.path.exists(path): return json.load(open(path))
    data = build(); json.dump(data, open(path, 'w'), ensure_ascii=False); return data

# ---------------- Quran ----------------
def quran():
    src = {'name': 'Quran (Tanzil via alquran.cloud)', 'url': 'https://alquran.cloud/', 'type': 'scripture', 'rights_status': 'open_attribution', 'license_note': 'Tanzil text is free to use unmodified with attribution (tanzil.net/docs/text_license). Translations by their translators.'}
    for edition, title, lang in [('quran-simple', 'القرآن الكريم', 'ar'), ('ur.jalandhry', 'قرآن مجید — اردو ترجمہ فتح محمد جالندھری', 'ur'), ('en.sahih', 'Quran — Sahih International translation', 'en')]:
        data = cached('quran_' + edition, lambda: get_json(f'https://api.alquran.cloud/v1/quran/{edition}')['data'])
        ps = []
        for s in data['surahs']:
            for a in s['ayahs']:
                text = a['text'].replace('\ufeff', '')
                ps.append({'ref': f"{s['englishName']} {s['number']}:{a['numberInSurah']}", 'text': f"{s['name']} {s['number']}:{a['numberInSurah']} — {text}", 'lang': lang})
        send_batches(src, {'title': title, 'author': 'Allah (Quran)', 'lang': lang, 'genre': 'quran', 'url': 'https://quran.com/'}, ps, 100)

# ---------------- Hadith ----------------
HADITH_BOOKS = {'bukhari': 'Sahih al-Bukhari', 'muslim': 'Sahih Muslim', 'abudawud': 'Sunan Abi Dawud', 'tirmidhi': 'Jami at-Tirmidhi', 'nasai': "Sunan an-Nasa'i", 'ibnmajah': 'Sunan Ibn Majah', 'malik': 'Muwatta Imam Malik', 'nawawi': 'Forty Hadith of Imam Nawawi'}
def hadith(books):
    src = {'name': 'Hadith API (fawazahmed0)', 'url': 'https://github.com/fawazahmed0/hadith-api', 'type': 'hadith', 'rights_status': 'arabic_public_domain_translations_unverified', 'license_note': 'Arabic texts are classical; Urdu/English translations belong to their translators - confirm before republishing in full. Used here for internal retrieval with citation.'}
    for b in books:
        for code, lang in [('ara', 'ar'), ('urd', 'ur'), ('eng', 'en')]:
            name = f'{code}-{b}'
            try: data = cached('hadith_' + name, lambda: get_json(f'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/{name}.json'))
            except Exception as e: print('skip', name, e); continue
            ps = []
            for h in data['hadiths']:
                t = (h.get('text') or '').strip()
                if len(t) < 15: continue
                grade = ''
                if h.get('grades'): grade = ' [' + '; '.join(f"{g.get('name','')}: {g.get('grade','')}" for g in h['grades'][:2]) + ']'
                ps.append({'ref': f"{HADITH_BOOKS[b]} #{h['hadithnumber']}", 'text': t + grade, 'lang': lang})
            send_batches(src, {'title': f"{HADITH_BOOKS[b]} ({ {'ar':'Arabic','ur':'Urdu','en':'English'}[lang] })", 'author': HADITH_BOOKS[b], 'lang': lang, 'genre': 'hadith', 'url': f'https://sunnah.com/{b}'}, ps, 80)

# ---------------- OpenITI ----------------
RAW = 'https://raw.githubusercontent.com/OpenITI/RELEASE/master/data/'
TITLES = {
 'HidayaFiSharhBidaya': ('الهداية شرح بداية المبتدي — Al-Hidaya', 'برهان الدين المرغيناني (ت 593هـ) — al-Marghinani'),
 'Mukhtasar:0428': ('مختصر القدوري — Mukhtasar al-Quduri', 'أبو الحسين القدوري (ت 428هـ) — al-Quduri'),
 'Mukhtasar:0321': ('مختصر الطحاوي — Mukhtasar al-Tahawi', 'أبو جعفر الطحاوي (ت 321هـ) — al-Tahawi'),
 'DurrMukhtar': ('الدر المختار — al-Durr al-Mukhtar', 'الحصكفي (ت 1088هـ) — al-Haskafi'),
 'RaddMukhtar': ('رد المحتار (حاشية ابن عابدين) — Radd al-Muhtar', 'ابن عابدين (ت 1252هـ) — Ibn Abidin'),
 'BadaicSanaic': ('بدائع الصنائع — Bada\'i al-Sana\'i', 'علاء الدين الكاساني (ت 587هـ) — al-Kasani'),
 'TabyinHaqaiq': ('تبيين الحقائق — Tabyin al-Haqa\'iq', 'الزيلعي (ت 743هـ) — al-Zayla\'i'),
 'BahrRaiq': ('البحر الرائق — al-Bahr al-Ra\'iq', 'ابن نجيم (ت 970هـ) — Ibn Nujaym'),
 'SharhFathQadir': ('شرح فتح القدير — Sharh Fath al-Qadir', 'ابن الهمام (ت 861هـ) — Ibn al-Humam'),
 'Mabsut': ('المبسوط — al-Mabsut', 'السرخسي (ت 483هـ) — al-Sarakhsi'),
}
def title_for(path):
    work = path.split('/')[1]; key = work.split('.')[-1]
    return TITLES.get(key + ':' + work[:4]) or TITLES.get(key) or (work, path.split('/')[0])
def openiti(paths):
    src = {'name': 'OpenITI Corpus', 'url': 'https://openiti.org/', 'type': 'classical_arabic_texts', 'rights_status': 'cc_by_nc_sa_4.0', 'license_note': 'OpenITI release texts: CC BY-NC-SA 4.0 (non-commercial, share-alike, attribution). Text quality varies (OCR/Shamela conversion).'}
    for path in paths:
        author, work = path.split('/')
        listing = get_json(f'https://api.github.com/repos/OpenITI/RELEASE/contents/data/{path}')
        files = [x for x in listing if re.search(r'-(ara|per)\d$', x['name'])]
        if not files: print('no text for', path); continue
        f = files[0]
        def build():
            raw = http(f['download_url'], timeout=300).decode('utf-8', 'ignore')
            return {'raw': raw}
        raw = cached('oiti_' + work, build)['raw']
        body = raw.split('#META#Header#End#')[-1]
        meta = {}
        for m in re.finditer(r'#META# (\d+\.\w+)\s*::\s*(.+)', raw[:20000]): meta[m.group(1)] = m.group(2).strip()
        title = meta.get('010.AUTH') and '' or ''
        yml = ''
        try: yml = http(RAW + path + '/' + work + '.yml').decode()
        except Exception: pass
        ar_title, ar_auth = title_for(path)
        page = 'p.?'; vol = ''; heading = ''; buf = []; size = 0; ps = []
        def flush():
            nonlocal buf, size
            if size >= 40:
                ps.append({'ref': (f'{ar_title} — {heading} — ' if heading else f'{ar_title} — ') + (f'ج{vol} ' if vol else '') + page, 'text': ' '.join(buf), 'lang': 'ar'})
            buf = []; size = 0
        for line in body.splitlines():
            if line.startswith('### |'):
                heading = line.replace('### |', '').strip()[:80]; continue
            for m in re.finditer(r'PageV(\d+)P(\d+)', line):
                vol = str(int(m.group(1))); page = 'ص' + str(int(m.group(2)))
            line = re.sub(r'PageV\d+P\d+', '', line)
            line = re.sub(r'^#+\s*|~~|\|\s*|\bms\d+\b|\$|@\w+@?\d*', ' ', line)
            line = re.sub(r'\s+', ' ', line).strip()
            if not line: continue
            buf.append(line); size += len(line)
            if size >= 900: flush()
        flush()
        print(path, f['name'], len(raw) // 1024, 'KB ->', len(ps), 'passages', flush=True)
        send_batches(src, {'title': ar_title, 'author': ar_auth, 'lang': 'ar', 'genre': 'fiqh_hanafi', 'url': 'https://github.com/OpenITI/RELEASE/tree/master/data/' + path, 'edition': meta.get('043.EdPUBLISHER', '')}, ps, 50)

# ---------------- Scholars (catalogue xlsx) ----------------
def scholars(xlsx):
    import openpyxl
    wb = openpyxl.load_workbook(xlsx); ws = wb.worksheets[0]
    rows = []
    for r in list(ws.iter_rows(values_only=True))[1:]:
        if not r[0]: continue
        rows.append({'seq': int(r[0]), 'name_ur': r[1], 'era': r[2], 'region': r[3], 'known_works': r[4], 'source_url': r[5], 'verification_status': 'unverified', 'ai_status': 'catalogue_only'})
    for i in range(0, len(rows), 100): post('/api/admin/kb/scholars', {'scholars': rows[i:i + 100]})
    print('scholars', len(rows))

def darulifta(path):
    src = {'name': 'Darul Ifta Deoband (fatwa archive)', 'url': 'https://darulifta-deoband.com/', 'type': 'fatwa', 'rights_status': 'link_only', 'license_note': 'Public fatwa archive of Darul Uloom Deoband. Used for retrieval with attribution and a link to the original page; confirm permission before republishing in full.'}
    cats = {}
    for line in open(path):
        r = json.loads(line); cats.setdefault(r['cat'], []).append(r)
    for cat, rows in cats.items():
        cat = next((r['category'] for r in rows if r['category']), cat)
        rows.sort(key=lambda r: int(re.sub(r'\D', '', str(r['fatwa'])) or 0))
        ps = [{'ref': f"Fatwa {r['fatwa']} · {r['date']}", 'text': r['text'], 'lang': 'ur', 'url': f"https://darulifta-deoband.com/home/ur/{r['cat']}/{r['id']}"} for r in rows]
        send_batches(src, {'title': f'دارالافتاء دیوبند — {cat}', 'author': 'Darul Ifta, Darul Uloom Deoband', 'lang': 'ur', 'genre': 'fiqh_hanafi', 'url': 'https://darulifta-deoband.com/', 'verification_status': 'institution_published'}, ps, 40)

def run_all():
    # Priority order: what users read and ask about most comes first, so a partial load is still useful.
    quran()
    hadith(['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'nawawi'])
    for x in ARGS[:1]: scholars(x)
    if os.path.exists(CACHE + '/darulifta.jsonl'): darulifta(CACHE + '/darulifta.jsonl')
    openiti(OITI_ALL)

OITI_ALL = ['0593BurhanDinFarghaniMarghinani/0593BurhanDinFarghaniMarghinani.HidayaFiSharhBidaya', '0428AbuHusaynQuduri/0428AbuHusaynQuduri.Mukhtasar', '0321AbuJacfarTahawi/0321AbuJacfarTahawi.Mukhtasar', '1088IbnCaliHaskafi/1088IbnCaliHaskafi.DurrMukhtar', '1252IbnCabidinDimashqi/1252IbnCabidinDimashqi.RaddMukhtar', '0587IbnMascudCalaDinKasani/0587IbnMascudCalaDinKasani.BadaicSanaic', '0743FakhrDinZaylaci/0743FakhrDinZaylaci.TabyinHaqaiq', '0970IbnIbrahimIbnNujaymMisri/0970IbnIbrahimIbnNujaymMisri.BahrRaiq', '0861IbnHumam/0861IbnHumam.SharhFathQadir', '0483IbnAhmadSarakhsi/0483IbnAhmadSarakhsi.Mabsut']

if JOB == 'all':
    try: run_all()
    except SystemExit as e:
        if str(e) == 'RUN_CAP': print('Reached this run\'s passage budget; the rest loads on the next run.'); sys.exit(0)
        if str(e) == 'DAILY_WRITE_LIMIT': print('Stopped: daily D1 write limit reached. Re-run after 00:00 UTC; progress is saved.'); sys.exit(0)
        raise
elif JOB == 'darulifta': darulifta(ARGS[0] if ARGS else CACHE + '/darulifta.jsonl')
elif JOB == 'quran': quran()
elif JOB == 'hadith': hadith(ARGS)
elif JOB == 'openiti': openiti(ARGS)
elif JOB == 'scholars': scholars(ARGS[0])

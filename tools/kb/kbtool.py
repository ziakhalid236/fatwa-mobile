#!/usr/bin/env python3
"""Knowledge-library ingestion. Usage: kbtool.py <API_URL> <ADMIN_TOKEN_FILE> <job> [args]
Jobs: quran | hadith <book...> | openiti <AuthorDir/WorkDir>... | scholars <xlsx>
Batches are cached in /tmp/kb_cache so the same corpus can be replayed to another API (production)."""
import sys, json, re, os, time, hashlib, urllib.request, urllib.parse, concurrent.futures as cf

API, TOKEN_FILE, JOB, *ARGS = sys.argv[1:]
TOKEN = open(TOKEN_FILE).read().strip()
CACHE = '/tmp/kb_cache'; os.makedirs(CACHE, exist_ok=True)

def http(url, data=None, headers=None, timeout=90):
    h = {'User-Agent': 'Mozilla/5.0 fatwa-kb-ingest'}; h.update(headers or {})
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
    batches = [passages[i:i + size] for i in range(0, len(passages), size)]
    done = 0
    def one(b):
        return post('/api/admin/kb/ingest', {'source': source, 'work': work, 'passages': b})
    with cf.ThreadPoolExecutor(3) as ex:
        for r in ex.map(one, batches):
            done += 1
            if done % 25 == 0: print(f'  {work["title"][:40]}: {done}/{len(batches)} batches', flush=True)
    print(f'  done {work["title"]}: {len(passages)} passages', flush=True)

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

if JOB == 'quran': quran()
elif JOB == 'hadith': hadith(ARGS)
elif JOB == 'openiti': openiti(ARGS)
elif JOB == 'scholars': scholars(ARGS[0])

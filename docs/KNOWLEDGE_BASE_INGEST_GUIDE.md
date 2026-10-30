# Knowledge base: how another AI agent adds data

The AI assistant and the Books tab read from one searchable library (Cloudflare D1 database bound as `KB`).
Anyone with the admin token can add texts. Nothing is "trained": passages are stored, indexed, and retrieved when a user asks a question, then quoted with their source.

## Structure

`source` (where it came from, with license) -> `work` (a book/edition/collection) -> `passages` (short text chunks, 300-1200 characters, in reading order).

## Endpoint

`POST {API}/api/admin/kb/ingest` with header `Authorization: Bearer <ADMIN_TOKEN>` and JSON:

```json
{
  "source": {
    "name": "Darul Ifta Deoband (fatwa archive)",
    "url": "https://darulifta-deoband.com/",
    "type": "fatwa",
    "rights_status": "link_only",
    "license_note": "What you may and may not do with this text"
  },
  "work": {
    "title": "Title shown to the user",
    "author": "Author / institution",
    "lang": "ur",
    "genre": "fiqh_hanafi",
    "url": "https://original-work-page",
    "edition": "optional",
    "verification_status": "unverified"
  },
  "passages": [
    { "ref": "Fatwa 123 · 2025-01-02", "text": "full passage text", "lang": "ur", "url": "https://original-passage-page", "seq": 0 }
  ]
}
```

Rules:
- Send 40-100 passages per request. Re-sending is safe: duplicates (same work + same text) are ignored.
- `seq` is the reading order inside the work (0,1,2,...). Always send it, otherwise the reader shows the passages in arrival order.
- `ref` is what the user sees as the citation (book + volume/page, hadith number, ayah, fatwa number). Keep it short and true to the original.
- `genre`: `quran`, `hadith`, `fiqh_hanafi`, `tafsir`, `aqeedah`, `fatwa`, `other`. Books marked `fiqh_hanafi` get reserved slots in AI answers.
- `rights_status`: `open_attribution`, `public_domain`, `cc_by_nc_sa_4.0`, `link_only`, `permission_granted`, `unknown`. Be honest: it is shown to users.
- `verification_status`: keep `unverified` until a named scholar has checked the text; then `verified`. Never mark Deobandi/Hanafi provenance you have not checked.
- Only add texts you are allowed to use. Do not scrape sites that forbid it.

Other admin routes: `POST /api/admin/kb/scholars` (catalogue rows), `POST /api/admin/kb/reseq` (set reading order of stored passages), `GET /api/admin/kb/stats`, `GET /api/admin/kb/search?q=...` (test retrieval).

## Bulk loader

`tools/kb/kbtool.py <API> <token-file> <job>` loads Quran, hadith, OpenITI books, scholars and Darul Ifta fatwas from a local cache and resumes after interruptions. It stops cleanly when Cloudflare's free daily D1 write limit is reached (`DAILY_WRITE_LIMIT`).

## Capacity

Cloudflare D1 free plan: 500 MB per database, 100,000 rows written per day. The full library (about 180,000 passages plus search index) needs the Workers Paid plan ($5/month): 10 GB per database and millions of writes.

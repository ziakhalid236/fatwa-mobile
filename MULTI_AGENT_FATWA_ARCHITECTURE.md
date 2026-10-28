# Multi-Agent Fatwa Content Pipeline

## موجودہ audit کا نتیجہ

Cloudflare account میں موجود `fatwa-api` Worker کے handlers اس وقت صرف `fetch` ہیں۔ اس کے ساتھ D1 database اور `fatwa-media` R2 bucket bound ہیں۔ Cloudflare AI Gateway میں اس account کے لیے اس وقت کوئی gateway configured نہیں ملا، اس لیے Grok/OpenRouter connection کو ابھی active نہیں سمجھا جا سکتا۔

ایک الگ Worker `blacksite-field-ops` پہلے سے موجود ہے۔ اس میں Workers AI binding، D1 database، KV configuration، secrets اور `*/1 * * * *` schedule موجود ہے۔ اسے Fatwa application کے ساتھ فوراً share نہیں کرنا چاہیے، کیونکہ اس کے bindings اور ذمہ داریاں Fatwa project سے مختلف ہیں۔ بہتر ہے کہ Fatwa کے لیے الگ orchestrator Worker بنایا جائے۔

## تجویز کردہ محفوظ flow

1. **Source Registry Agent** صرف منظور شدہ HTTPS domains سے URLs اور نئے pages دریافت کرے گا۔ ہر source کے لیے domain، institution، language، category map، crawl interval اور اجازت شدہ paths محفوظ ہوں گے۔
2. **Fetcher Agent** صرف registry کے allow-list URLs کھولے گا۔ SSRF سے بچنے کے لیے HTTPS، public DNS، redirect validation، size limit، timeout اور content-type checks لازمی ہوں گے۔ robots.txt، terms اور source کی اجازت کا احترام کیا جائے گا۔
3. **Extraction Agent** page سے اصل سوال، اصل جواب، scholar/institution، تاریخ، مکمل source URL اور page title الگ structured fields میں نکالے گا۔ AI کو source text کے باہر کوئی factual claim شامل کرنے کی اجازت نہیں ہوگی۔
4. **Verification Agent** extracted content کو اسی source page سے دوبارہ compare کرے گا۔ اگر answer، attribution، URL، language یا source identity میں ambiguity ہو تو item `needs_review` میں جائے گا، publish نہیں ہوگا۔
5. **Urdu Editor Agent** صرف verified source material کو صاف، readable اردو میں draft کرے گا۔ یہ فتویٰ create نہیں کرے گا، نیا حکم نہیں دے گا، اور source کے اختلاف یا scope کو ختم نہیں کرے گا۔
6. **Citation Agent** مکمل citation تیار کرے گا: ادارہ، مفتی/مصنف اگر page پر موجود ہو، اصل سوال، اصل جواب، page title، publication/update date اگر موجود ہو، اور canonical URL۔
7. **Policy/Quality Agent** duplicate، missing citation، unsupported claim، dangerous medical/legal/financial advice، sectarian misrepresentation اور low-confidence output کو روک دے گا۔
8. **Admin Review** ہر item کو پہلے `draft` یا `needs_review` بنائے گا۔ Admin panel میں source preview، extracted text، AI draft، confidence، validation errors اور full URL دکھے گا۔ صرف admin approval کے بعد `published` status ملے گا۔
9. **Publisher** approved record کو Fatwa API کے ذریعے publish کرے گا۔ Public app صرف `published` records پڑھے گی؛ draft یا rejected records نہیں۔

## ہر پانچ منٹ والا schedule

Cloudflare Cron Trigger `*/5 * * * *` استعمال کیا جا سکتا ہے۔ Cloudflare کے مطابق Cron UTC میں چلتا ہے اور Worker میں `scheduled()` handler ضروری ہے۔ Trigger propagation میں کئی منٹ لگ سکتے ہیں، اس لیے deployment کے فوراً بعد ایک manual test بھی ضروری ہے۔

ہر run میں زیادہ سے زیادہ محدود تعداد میں sources process ہوں گے، مثلاً 5 یا 10۔ ایک distributed lock یا D1 lease استعمال ہوگا تاکہ دو runs ایک ہی item کو دوبارہ process نہ کریں۔ `source_url + source_hash` پر unique deduplication ہوگی۔ Failure پر item دوبارہ کوشش کے لیے queue میں جائے گا، مگر مسلسل failure کو dead-letter/review queue میں منتقل کیا جائے گا۔

اہم: ہر پانچ منٹ میں نئے **draft candidates** بنانا مناسب ہے؛ ہر پانچ منٹ میں AI-generated فتویٰ کو خودکار طور پر public کرنا محفوظ نہیں ہے۔ دینی حکم کی final publication انسانی/معتبر scholar review کے بعد ہونی چاہیے۔

## Grok/OpenRouter connection

Cloudflare AI Gateway کے OpenRouter endpoint کا pattern یہ ہے:

```text
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openrouter/v1/chat/completions
```

اس کے لیے AI Gateway gateway، OpenRouter token، اور exact model ID درکار ہے۔ موجودہ audit میں gateway list خالی ہے، اس لیے user کے بتائے ہوئے “Grok Cloudflare پر connected” کو production-ready connection نہیں سمجھا جا سکتا۔ Gateway بننے کے بعد token کو Worker secret میں رکھا جائے گا، source code یا D1 میں نہیں۔

Agent prompts میں source text کو untrusted data سمجھا جائے گا۔ Web page کے اندر موجود instructions کو agent instructions نہیں مانا جائے گا۔ Model کو صرف structured JSON output دینے دیا جائے گا، مثلاً:

```json
{
  "status": "verified|needs_review|rejected",
  "category": "Namaz",
  "institution": "",
  "scholar": "",
  "question": "",
  "answer": "",
  "urduDraft": "",
  "sourceTitle": "",
  "sourceUrl": "",
  "confidence": 0,
  "reasons": []
}
```

## ابتدائی approved source registry

پہلے مرحلے میں صرف وہ sources شامل ہونے چاہییں جن کے official domains واضح ہیں:

- Darul Ifta, Darul Uloom Deoband: `https://darulifta-deoband.com/en`
- Jamia Darul Uloom Karachi official Dar-ul-Ifta page: `https://darululoomkarachi.edu.pk/?page_id=20`

Khairul Madaris کے لیے exact official domain پہلے confirm کرنا ضروری ہے۔ Search results میں مختلف unofficial pages ملتے ہیں، اس لیے اسے registry میں شامل نہیں کیا جائے گا جب تک آپ exact official URL یا ادارے کی اجازت نہ دیں۔

## Recommended data states

`discovered → fetched → extracted → verified → draft → needs_review → approved → published`

Alternative terminal states: `rejected`, `duplicate`, `source_error`, `policy_blocked`.

ہر record میں raw source URL، canonical URL، fetched timestamp، content hash، source title، institution، scholar، original language، original question/answer، Urdu draft، citation fields، model ID، prompt version، confidence، review user، review timestamp اور publication timestamp محفوظ ہوں گے۔

## Security controls

- Open internet کو unrestricted browsing کی صورت میں agent کو نہیں دیا جائے گا؛ صرف source gateway fetch کرے گا۔
- Domain and path allow-list، HTTPS-only، redirect re-validation، private-IP/localhost blocking، response size limits اور timeout لازمی ہوں گے۔
- OpenRouter/Grok key صرف Worker secret میں رہے گی۔
- Admin endpoints پر existing admin token کے ساتھ rate limiting اور audit log شامل ہونا چاہیے۔
- Source HTML کو prompt injection کے خلاف untrusted content treat کیا جائے گا۔
- Raw pages کو R2 میں محدود retention کے ساتھ رکھا جائے گا؛ public app کو صرف curated fields ملیں گے۔
- Automated content کو “AI fatwa” کے طور پر label نہیں کیا جائے گا؛ app میں واضح source attribution اور یہ disclaimer ہوگا کہ final ruling کے لیے qualified scholar سے رجوع کیا جائے۔

## Implementation phases

### Phase 1: dry-run

Approved sources registry، fetcher، extractor، deduplication، D1 schema اور admin preview بنائیں۔ ہر پانچ منٹ کا schedule صرف drafts بنائے، public publish نہ کرے۔ 20–50 real source pages پر quality pilot کریں۔

### Phase 2: review workflow

Admin panel میں source preview، original text، Urdu draft، citation، confidence اور approve/reject/edit actions شامل کریں۔ Approved item ہی Fatwa API میں publish ہو۔

### Phase 3: controlled production

Per-source limits، retries، dead-letter queue، monitoring، model fallback اور daily cost limit شامل کریں۔ کم risk والے existing published pages سے شروع کریں۔ نئے یا اختلافی مسائل ہمیشہ manual review میں جائیں۔

### Phase 4: optional automation

صرف تب limited auto-publish پر غور کریں جب source policy، scholar approval، citation completeness اور quality metrics ثابت ہوں۔ عمومی مفتیٰ یا نئے سوال کے لیے auto-publish فعال نہیں کیا جائے گا۔

## اس وقت درکار user decisions

1. کیا پہلے مرحلے میں ہر پانچ منٹ پر صرف **draft** بنانا منظور ہے، اور public publish صرف admin approval کے بعد ہوگا؟
2. Grok کے لیے exact OpenRouter model ID کیا ہے، مثلاً `x-ai/...`، اور کیا OpenRouter API token Cloudflare Worker secret کے طور پر add کیا جائے گا؟
3. Khairul Madaris کا exact official URL اور allowed sources کی مکمل فہرست فراہم کریں۔

## References

[1]: https://developers.cloudflare.com/workers/configuration/cron-triggers/ "Cloudflare Cron Triggers"
[2]: https://developers.cloudflare.com/ai-gateway/usage/providers/openrouter/ "Cloudflare AI Gateway OpenRouter provider"
[3]: https://darulifta-deoband.com/en "Darul Ifta Darul Uloom Deoband"
[4]: https://darululoomkarachi.edu.pk/?page_id=20 "Jamia Darul Uloom Karachi Dar-ul-Ifta"

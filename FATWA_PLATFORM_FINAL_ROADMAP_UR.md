# Fatwa Platform — Final Product Structure & Implementation Roadmap

**Document type:** Product structure, architecture plan, security checklist and release roadmap
**Status:** Roadmap + implementation status — small cleanup completed; production backend release still blocked
**Prepared:** 29 October 2026
**Reference:** User-provided Fatwa page design image `1000026269.png`

---

## 1. مقصد اور release decision

Fatwa platform کو mobile app، live backend اور Admin Panel کے ایک ہی قابلِ اعتماد نظام کے طور پر تیار کرنا ہے۔ App میں عام user fatwas پڑھ سکے، سوال بھیج سکے، notifications حاصل کرے، prayer/Qibla features استعمال کرے اور approved community posts دیکھ سکے۔ User post صرف مکمل profile/login کے بعد submit کرے گا اور ہر post moderation کے بعد ہی live ہو گی۔

**اہم release rule:** جب تک production D1 schema، R2 media binding، API routes، notifications، admin moderation اور security controls end-to-end verify نہ ہوں، APK/AAB کو production publish نہیں کیا جائے گا۔ موجودہ audit کے مطابق live system ابھی release-ready نہیں ہے۔

---

## 1A. Current implementation status — 29 October 2026

### Completed in GitHub main

Current `main` is at commit `ae50a50` (`Clean up profile and post submission flow`). The repository now contains the recent AI/admin workspace commits, the simplified text-or-image community post flow, category-filter cleanup, profile country support, profile-aware post submission, full-image rendering, and repository safety cleanup for environment and signing files. The duplicate name/country/city fields were removed from the post submission screen; users must complete the profile first, while the profile photo remains optional. The unused submission helper was removed and the completed work is documented in `SMALL_CLEANUP_REPORT_2026-10-29.md`.

### Validation completed

The full workspace typecheck passes for libraries, Admin Panel, API server, mobile app, mockup sandbox and scripts. The Admin Panel production build passes. The mobile static build has passed with iOS and Android bundles/manifests and 54 processed assets. Git diff hygiene passes, generated build output remains ignored, and the local branch is clean and synchronized with GitHub `main`.

A live smoke check confirms `/api/health` and `/api/fatwas` return 200. The following production endpoints are still failing and therefore block publication: `/api/posts` returns a missing `posts` table error; `/api/questions` and `/api/notifications` return missing `users` table errors. These are backend deployment/schema findings, not hidden by the small cleanup batch.

### Next work order

1. **P0 — Production backend foundation:** add the reviewed Worker source and migrations to the repository, point production to the correct D1 database, apply the schema, add the `MEDIA` R2 binding, and make all public routes return expected 2xx/4xx responses.
2. **P1 — User identity:** replace temporary device-profile behavior with the approved login/sign-up method, session expiry, profile ownership and Admin user records.
3. **P1 — Moderation and media:** verify text-only, image-only and text-plus-image submissions end to end, including R2 storage, approval/rejection, image retrieval and moderation audit history.
4. **P1 — Notifications:** persist answer, important-post and moderation notifications, enforce per-user authorization, and verify deep-links from notification taps.
5. **P1 — Security hardening:** rotate the exposed/plain-text admin binding into a Cloudflare Secret, restrict CORS, add rate limits, hide internal D1/R2 errors, validate upload signatures, and patch dependency findings.
6. **P2 — Fatwa/Admin design:** implement the supplied Fatwa card design in the mobile app and matching Admin editor/preview, with Urdu, English and Arabic content validation.
7. **P2 — Release QA:** run fresh-install permissions, prayer/location, offline, multi-user isolation, moderation, notification, signing, privacy-policy and rollback tests.

**Release decision:** the APK/AAB must not be published to production until the P0/P1 items pass their exit criteria. The roadmap is now a status document as well as an implementation plan; completed work is marked above and remaining work is intentionally explicit.

## 2. Verified user experience

### 2.1 پہلی بار app کھولنے کا flow

1. Splash screen پر Fatwa branding اور درست logo آئے گا۔
2. App پہلی launch پر permission explanation دکھائے گی، پھر:
   - Notifications permission مانگے گی۔
   - Foreground/live location permission مانگے گی۔
3. Location ملنے پر app area/city اور ملک identify کرے گی۔
4. Prayer calculation کے لیے detected area استعمال ہو گا۔
5. Fajr، Dhuhr، Asr، Maghrib اور Isha کے alarm times اسی area کی prayer timeline کے مطابق set ہوں گے۔
6. اگر user location deny کرے تو manual country/city selection کا واضح fallback ہو گا۔
7. Permissions نہ دینے کے باوجود user fatwas اور public content دیکھ سکے گا؛ صرف location-dependent features محدود ہوں گے۔
8. User onboarding مکمل ہونے کے بعد home/feed استعمال کر سکے گا؛ profile login صرف post submit کرنے کے وقت لازمی ہو گا۔

### 2.2 Profile/login/sign-up flow

Settings/Profile میں ایک سادہ profile section ہو گا:

- Name — لازمی
- Country — لازمی
- City — لازمی؛ location سے auto-fill ہو گا مگر user edit کر سکے گا
- Profile picture — optional
- Save profile

Login/sign-up کا مقصد user identity/profile کو backend میں محفوظ کرنا ہو گا۔ Implementation سے پہلے authentication method final کرنا ضروری ہے: email/OTP، phone/OTP یا verified device profile۔ صرف local device ID کو مکمل authentication نہیں سمجھا جائے گا۔

Profile save ہونے کے بعد:

- User کی profile Admin Panel کے Users/Profile section میں دکھائی دے گی۔
- Post submission page پر name، country اور city دوبارہ نہیں مانگے جائیں گے۔
- Post card پر author identity کے لیے saved profile data استعمال ہو گا۔
- User اپنا profile update کر سکے گا۔

### 2.3 Post submission flow

- User بغیر profile/login کے post submit نہیں کر سکے گا۔
- Submit button کے وقت app profile status check کرے گی اور ضرورت پر Settings/Profile پر بھیجے گی۔
- Submission میں title field نہیں ہو گی۔
- Post کی body/description ہی اس کا text content ہو گا۔
- Post تین صورتوں میں submit ہو سکے گی:
  1. صرف description/text
  2. صرف image
  3. description اور image دونوں
- User name، country یا city submission screen پر دوبارہ نہیں بھرے گا۔
- Post backend میں `pending` status کے ساتھ جائے گی۔
- Admin approve کرے گا تو post `published` ہو گی؛ reject کرے گا تو public feed میں نہیں آئے گی۔
- Approval/rejection کے بعد user کو app notification ملے گی۔
- Image upload کے لیے file type، size، malware/content validation، rate limit اور R2 storage لازمی ہوں گے۔

---

## 3. Fatwa page کا approved visual direction

User-provided design کے مطابق Fatwa page کا نیا structure:

- اوپر logo، Fatwa branding، Hijri date اور notification bell
- واضح search bar: “Search a question or topic”
- Category chips: All، Aqeedah، Namaz، Roza، Zakat وغیرہ
- بڑے readable fatwa cards
- card کے اندر الگ visual sections:
  - سوال — “سوال” badge اور question icon
  - جواب — “جواب” badge اور book icon
  - issuing institution / fatwa source
  - hawala / references section
- نیچے consistent bottom navigation:
  - Home
  - Fatwa
  - Ask
  - Alerts/Notifications
  - Profile
- Urdu، English اور Arabic content support برقرار رہے گا۔ App chrome کی language اور post/fatwa content language الگ controls ہوں گے۔

**Content rule:** صرف Admin Panel کا authorized admin fatwa create، edit، publish، unpublish یا delete کر سکے گا۔ Mobile app سے کوئی user fatwa create نہیں کر سکے گا۔ ہر fatwa میں source، scholar/institution، language، status اور audit timestamps محفوظ ہوں گے۔

---

## 4. Admin Panel کا target structure

### 4.1 Dashboard

- Published fatwas count
- Pending questions
- Pending community posts
- Published posts
- Notification delivery status
- Storage usage/failed uploads
- Last backend health check
- Recent moderation activity

### 4.2 Fatwa management

Admin-only CRUD:

- New Fatwa
- Question
- Answer
- Category
- Language: Urdu/English/Arabic
- Scholar/author
- Institution
- Source URL and reference
- Featured/pinned state
- Draft/published/archived status
- Preview matching the new mobile Fatwa design
- Edit history and published-by information

### 4.3 Question review

- User questions list
- Search/filter by status and date
- Answer editor
- Scholar/admin attribution
- Publish answer
- Automatically create a user notification
- Notification deep-link directly to the answered question

### 4.4 Community post moderation

- Pending text/image posts
- Full image preview without forced crop
- User profile details
- Approve/reject actions
- Rejection reason
- Publish/delete/pin controls
- Automatic approval/rejection notification
- Audit log with admin identity and timestamp

### 4.5 Users/profile section

- Name, country, city, optional avatar
- Auth/provider identifier — never display sensitive tokens
- Created/updated timestamps
- User’s questions and posts
- Account disable/delete request workflow
- No plain-text password or secret display

### 4.6 Notifications

- Create important post notification
- Answer notification
- Post approval/rejection notification
- Target user or broadcast audience
- Read/unread status
- Deep-link target: fatwa, question, post or notification detail
- Delivery/failure log

### 4.7 Settings and operational controls

- Prayer calculation defaults and supported methods
- Notification templates
- Upload limits
- Content language availability
- Maintenance/read-only mode
- Storage status
- API/D1/R2 health checks
- Admin audit log

---

## 5. Target architecture اور source of truth

### Mobile app

React Native/Expo app production API کے ساتھ connect ہو گی۔ Bundled fallback صرف offline read-only content کے لیے ہو گا؛ اسے live user data یا moderation state کا source نہیں بنایا جائے گا۔

### API/Worker

ایک dedicated Worker source repository میں ہونا چاہیے، مثلاً:

```text
workers/fatwa-api/
  src/index.ts
  migrations/
  wrangler.toml
  README.md
```

اسی Worker میں public routes، admin routes، notification creation، authorization، input validation، media URLs اور health checks ہوں گے۔

### D1

Production database میں reviewed migrations ہوں گی۔ کم از کم tables:

- users
- auth_identities یا sessions
- fatwas
- fatwa_revisions
- questions
- posts
- post_submissions
- notifications
- notification_deliveries
- admin_audit_logs
- settings

### R2

- `fatwa-media` production bucket
- واضح `MEDIA` binding
- private/origin-controlled upload flow
- public media retrieval صرف approved records کے لیے
- orphan upload cleanup

### Admin frontend

ایک canonical URL منتخب کیا جائے گا: `fatwa-admin.pages.dev` یا custom domain۔ پرانا/غلط `fatwa-web` endpoint یا تو بند ہو گا یا واضح redirect دے گا؛ دو مختلف Admin deployments نہیں رہیں گی۔

### GitHub

GitHub `main` source of truth ہو گا۔ Live Worker، Admin Panel اور Android build کا commit SHA release manifest میں محفوظ ہو گا۔ Manual untracked production code قبول نہیں ہو گا۔

---

## 6. Security requirements

Release سے پہلے درج ذیل لازمی ہیں:

1. Admin token rotate کیا جائے اور plain-text binding سے ہٹا کر Cloudflare Secret میں رکھا جائے۔
2. Authentication کو device ID سے الگ مضبوط کیا جائے۔
3. Admin routes پر least-privilege authorization اور session expiry لگائی جائے۔
4. CORS کو صرف approved app/admin origins تک محدود کیا جائے جہاں ممکن ہو۔
5. Public write endpoints پر per-device/IP rate limits اور abuse detection لگے۔
6. Text/image input size limits server side enforce ہوں۔
7. MIME type کے ساتھ اصل file signature بھی validate ہو۔
8. R2 object keys user-provided filenames سے نہیں بنیں گے۔
9. Error responses میں D1/R2/internal implementation details ظاہر نہیں ہوں گی۔
10. Admin actions audit log میں record ہوں گی۔
11. User data deletion/export request کا controlled workflow ہو گا۔
12. Notifications میں authorization check ہو گا تاکہ ایک user دوسرے user کی notifications نہ دیکھ سکے۔
13. Dependency vulnerabilities patch یا formally risk-accept ہوں گی؛ current audit میں 6 vulnerabilities موجود ہیں۔
14. Secrets، production backup، keystore اور passwords GitHub/Drive public share میں نہیں ہوں گے۔
15. Privacy policy میں location، device identifier، profile، image storage، notifications، retention اور deletion behavior actual implementation سے match کریں گے۔

---

## 7. Implementation roadmap

### Phase 0 — Baseline freeze and cleanup

- Current repository, live Worker، D1/R2، Admin URL اور APK artifacts کا inventory
- Uncommitted changes کا review
- One canonical branch and deployment target
- Existing data/backup preservation
- Old broken deployment URLs identify کرنا

**Exit criteria:** source-of-truth اور data ownership تحریری طور پر final۔

### Phase 1 — Backend foundation

- Dedicated Worker source/config add کرنا
- Correct production D1 database select کرنا
- Reviewed migrations apply کرنا
- Correct R2 `MEDIA` binding add کرنا
- Health/readiness endpoints
- Error handling and structured logs

**Exit criteria:** `/api/fatwas`، `/api/posts`، `/api/questions`، `/api/notifications` اور media route 2xx/expected 4xx دیں؛ کوئی schema/binding 500 نہ ہو۔

### Phase 2 — Identity and onboarding

- Notification permission flow
- Location permission flow
- Area/city detection
- Manual fallback
- Prayer calculation and alarm scheduling
- Profile login/sign-up
- Profile persistence and Admin users view

**Exit criteria:** fresh install سے permission denial/grant دونوں paths test ہوں؛ profile کے بغیر post blocked ہو۔

### Phase 3 — Fatwa/Admin redesign

- Mobile Fatwa page کو provided design کے مطابق rebuild
- Admin Fatwa editor/preview اسی visual/content model کے مطابق
- Admin-only fatwa publishing
- Urdu/English/Arabic content validation
- Sources and revisions

**Exit criteria:** Admin سے publish کی گئی fatwa mobile app میں صحیح card/detail layout کے ساتھ دکھے۔

### Phase 4 — Community moderation

- Text/image-only submission rules
- Profile-aware submission form
- R2 upload and retrieval
- Admin approval/rejection
- Full image preview
- Approval/rejection notifications

**Exit criteria:** ایک test user post submit کرے، Admin approve/reject کرے، public visibility اور notification دونوں درست ہوں۔

### Phase 5 — Notification/deep-link system

- Answer notifications
- Important post notifications
- Moderation notifications
- Read/unread sync
- Direct detail deep-links
- Retry/failure logs

**Exit criteria:** notification tap سے متعلقہ question/post/fatwa detail براہ راست کھلے۔

### Phase 6 — Security hardening

- Secret rotation
- Auth/session review
- CORS restriction
- Rate limits
- Input/media validation
- Dependency updates
- Security headers and generic errors
- Audit log verification

**Exit criteria:** security checklist pass اور no release-blocking vulnerability/open issue۔

### Phase 7 — QA and publication

- Fresh Android install test
- Permission grant/deny tests
- Offline/online recovery
- Multiple languages
- Multiple users/data isolation
- Admin role tests
- Post/image moderation test
- Notification/deep-link test
- APK/AAB signing verification
- Privacy policy and store metadata review
- Backup and rollback rehearsal

**Exit criteria:** signed release artifact، exact commit manifest، live smoke-test report اور rollback plan موجود ہوں۔

---

## 8. Mandatory acceptance tests

- Fresh user کو location اور notification permissions واضح انداز میں ملیں۔
- Location grant ہونے پر city/area اور prayer times درست set ہوں۔
- Location deny ہونے پر manual city flow کام کرے۔
- Profile کے بغیر post submit نہ ہو۔
- Profile save ہونے کے بعد submission page پر name/country/city دوبارہ نہ آئیں۔
- Text-only، image-only اور text+image posts الگ الگ submit ہوں۔
- 8 MB سے بڑی یا invalid image reject ہو۔
- Pending post public feed میں نہ آئے۔
- Admin approval کے بعد post public ہو اور user کو notification ملے۔
- Admin rejection کے بعد post public نہ ہو اور rejection notification ملے۔
- Fatwa صرف Admin Panel سے publish ہو۔
- Admin published fatwa mobile Fatwa page کے نئے design میں دکھے۔
- User صرف اپنی questions اور notifications دیکھ سکے۔
- Notification tap متعلقہ detail route کھولے۔
- API کے کوئی D1/R2 implementation errors client کو leak نہ ہوں۔
- Live D1/R2 bindings اور migrations release SHA سے reproducibly deploy ہوں۔

---

## 9. Drive cleanup policy

Old files کو فوراً permanently delete نہیں کیا جائے گا۔ پہلے:

- production backup محفوظ رہے گا؛
- APK/AAB release artifacts محفوظ رہیں گے؛
- current design screenshots کو reference folder میں رکھا جائے گا؛
- صرف duplicate/outdated planning reports کو trash کیا جائے گا؛
- trash سے permanent deletion نہیں ہو گی۔

Deletion candidates کی exact list user confirmation کے بعد الگ تیار کی جائے گی۔

---

## 10. Implementation سے پہلے final decisions

یہ points roadmap میں open decisions ہیں، code شروع کرنے سے پہلے final کرنے ہوں گے:

1. Login method: email OTP، phone OTP یا کوئی دوسرا provider؟
2. Prayer calculation method، madhab اور high-latitude rule؟
3. Notification provider اور Android notification channel behavior؟
4. Admin کے کتنے roles ہوں گے: owner، editor، moderator؟
5. Community post image کا maximum size اور allowed formats؟
6. Public custom domain کون سا canonical ہو گا؟
7. Existing production data preserve کرنا ہے یا approved clean reset؟

**یہ document implementation authorization نہیں ہے؛ یہ verified structure اور execution plan ہے۔**

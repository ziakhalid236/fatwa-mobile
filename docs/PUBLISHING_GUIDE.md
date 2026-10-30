# Publishing the Fatwa app

## Builds
GitHub Actions workflow `Android release builds` runs on every push to `main` (or manually: Actions -> Run workflow).
It produces, as downloadable artifacts of the run:
- `fatwa-mobile-apk-build-N` : installable APK (arm64) for testing on phones.
- `fatwa-mobile-play-store-aab-build-N` : Android App Bundle for stores.

Both are signed with the upload keystore stored in repository secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).
`versionCode` = 100 + run number, so every build is a valid update. Change `version` in `artifacts/fatwa-mobile/app.json` for the user-visible version name.

## Keystore (critical)
`fatwa-upload-key.p12`, alias `fatwa-upload`, valid until 2054. Passwords are in `fatwa-keystore-passwords.txt`.
Keep at least two private copies (password manager + private drive). Never commit or share. If lost, use Play Console's upload-key reset.

## Where to publish
| Store | Cost | Review time | Notes |
|---|---|---|---|
| Direct APK (GitHub Release / own page) | free | instant | users must allow installs from unknown sources |
| Amazon Appstore | free | a few days; goes live within hours of approval | needs Amazon developer account |
| Huawei AppGallery | free | 3-5 working days | identity verification; reaches Huawei phones |
| APKPure | free | about 3 business days | |
| Uptodown | free | not guaranteed (editorial) | |
| Aptoide | subscription needed for manual submission | 7-10 business days | |
| Samsung Galaxy Store | free, but needs commercial-seller approval (D-U-N-S, bank) | several days to weeks | |
| Google Play | one-time $25 | personal accounts created after Nov 2023 must run a closed test with 12 testers for 14 days first, then review | biggest audience |

No store approves in minutes. Fastest real path: publish the APK directly today, submit to Amazon + APKPure + Huawei in parallel, and start the Google Play closed test (the 14-day clock is the bottleneck).

## Play Console checklist
Privacy policy URL (`/privacy-policy`), Data safety form (location, profile, photos, device id, push token, user questions), content rating, target audience (13+), AI-content declaration, screenshots and feature graphic (`store-assets/`). Upload the AAB.

## Push notifications
Create a Firebase project, add Android app `com.fatwa.mobile`, download `google-services.json` into `artifacts/fatwa-mobile/` (commit it; it is not secret), and set the Worker secret `FCM_SERVICE_ACCOUNT` to the Firebase service-account JSON (`wrangler secret put FCM_SERVICE_ACCOUNT`). Until then in-app notifications work but phone push does not.

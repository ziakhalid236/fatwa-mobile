# Fatwa App — Google Play release checklist

## Release build

- Package: `com.fatwa.mobile`
- Version: `1.0.1`
- Version code: `2`
- The workflow now produces both an Android App Bundle (`.aab`) and an APK. The CI release artifact is for validation; configure a protected upload keystore and Play App Signing before uploading the AAB to production.
- Confirm the release is built with target API 36 or newer before upload.
- Configure Play App Signing and keep the upload key backed up securely.
- Do not commit a keystore or passwords. Store them as protected GitHub Actions secrets and add the Gradle release signing block only after the owner has created/selected the Play upload key.

## Store listing assets

- App icon: existing 512×512 Play-ready icon must be checked for safe margins and no misleading claims.
- Feature graphic: use `store-assets/feature-graphic.png`; Play Console may require an exact 1024×500 export, so crop/export the supplied wide source to that size if needed.
- Screenshots: upload at least four real in-app phone screenshots showing Home, Fatwa answers, Ask a Question, Prayer/Qibla, and Community posts. Do not use generated UI screenshots as evidence of functionality.
- Short description: `Prayer times, Qibla, trusted Islamic answers and a respectful community.`
- Full description: explain the app’s prayer-time calculation, Qibla, multilingual content, question workflow, notifications, and community moderation without claiming religious authority beyond the listed sources.

## App content and policy forms

- Add a publicly reachable privacy-policy URL. It must explain location, notification/device identifiers, user-submitted questions/posts, uploaded images, retention, deletion requests, and third-party services including Cloudflare/R2.
- Complete Data safety accurately: location is collected for prayer times/Qibla and may be stored only when the user enters a city/profile; photos are user-provided community content; device identifiers support notifications and sync; no advertising SDK is currently configured.
- Complete Content rating, Target audience, Ads declaration, App access, and News/Religious content questions in Play Console.
- Explain in the listing and policy that community posts and questions are moderated and that answers are informational, not a substitute for a qualified scholar’s advice.
- Test notification, exact alarm, photo upload, offline fallback, language selection, location denial, and Android back navigation on physical Android devices.

## Before production rollout

- Use internal testing first, then closed testing, then production.
- Verify the release artifact is signed and the version code is higher than every previous upload.
- Confirm account ownership, developer verification, organization/personal account requirements, and Play Console payment/profile details in the owner’s account.

# Fatwa App — Google Play Release and Update Guide

## Current release

- Repository: `ziakhalid236/fatwa-mobile`
- Release commit: `19260f5`
- Package: `com.fatwa.mobile`
- Version: `1.0.1`
- Version code: `2`
- Target SDK: 36
- Android release workflow: `Android release builds`
- GitHub run: https://github.com/ziakhalid236/fatwa-mobile/actions/runs/40603477509

The successful CI run produced both an APK for device validation and an Android App Bundle (AAB) for Google Play upload.

## Which file is needed for future updates?

The important long-term file is the **Google Play upload keystore**, normally named something like `fatwa-upload-key.jks`. It contains the private upload key used to sign future releases. Keep this file private and backed up in at least two secure locations. Also preserve its alias and passwords in a password manager. Never commit the keystore, `key.properties`, passwords, or private keys to GitHub or a public Drive folder.

Google Play App Signing normally holds the final app-signing key. The developer keeps the upload key. For every future update:

1. Increase `versionCode` and update the user-facing version if needed.
2. Build a new signed `.aab` with the same upload keystore.
3. Upload the new AAB in Play Console internal testing first.
4. Verify install, API connectivity, image upload, notifications, offline fallback and Android navigation.
5. Promote to closed testing and then production.

If the upload keystore is lost, do not create a random replacement. Use Play Console's upload-key reset process.

## Create the upload keystore once

Run this locally on a trusted machine. Do not paste passwords into GitHub or chat:

```bash
keytool -genkeypair -v \
  -keystore fatwa-upload-key.jks \
  -alias fatwa-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store the resulting `.jks` file and its passwords securely. The repository must contain only a template, never the real values. GitHub Actions should receive the keystore as an encrypted secret or base64 secret and the passwords as separate encrypted secrets.

## Required Play Console items

- Upload the AAB, not the APK, for production distribution.
- Configure Play App Signing and upload-key backup.
- Add a public privacy-policy URL.
- Complete Data Safety: location/prayer times/Qibla, device identifier for sync/notifications, user questions, community posts and uploaded images, Cloudflare/R2 processing, and no advertising SDK if that remains true.
- Complete content rating, target audience, ads declaration and religious-content questions.
- Add real device screenshots and the feature graphic.
- Explain that community posts and questions are moderated and answers are informational, not a substitute for a qualified scholar.

## Fatwa backend deployment safety

The live `fatwa-api` Worker is already deployed and its R2/D1 bindings are working. The old Cloudflare Workers Build trigger pointed at the repository root with `pnpm run build` and `npx wrangler deploy`, but this repository does not contain a deployable Worker source/configuration. Automatic builds were disabled to prevent an accidental broken deployment. The live Worker was not deleted or replaced.

If automatic Worker deployments are needed later, first add a dedicated Worker source directory with a reviewed `wrangler.toml`, explicit D1 database ID, explicit R2 bucket binding, and secret bindings. Test it against a preview Worker before enabling production auto-builds.

## Current local release files

- `release-artifacts/19260f5/fatwa-mobile-play-store-aab/app-release.aab`
- `release-artifacts/19260f5/fatwa-mobile-preview-apk/app-release.apk`
- `backups/fatwa-production-backup-2026-10-28.json`

The production backup contains user-submitted data and must remain private.

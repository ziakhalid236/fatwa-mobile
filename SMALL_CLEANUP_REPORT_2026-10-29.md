# Small Cleanup Report — 29 October 2026

## Scope

This batch intentionally stayed within low-risk repository and UI cleanup. Production D1/R2 schema, authentication architecture, notification backend, Cloudflare Worker deployment, and live data were not changed.

## Completed

- Aligned the profile screen with the agreed posting rule: name, country, and city are required before a post can be submitted; profile photo remains optional.
- Removed duplicate name/country/city inputs from the post submission screen. The screen now uses the saved profile and sends the profile fields with the moderation submission.
- Updated user-facing wording from temporary-login language to a clear profile requirement.
- Removed the unused `TextInputField` helper and its unused styles from the post submission screen.
- Added repository ignore rules for `.env` files, Java keystores, Android `key.properties`, and other signing secrets.
- Kept generated `static-build` output ignored and out of Git.
- Preserved existing user-requested post-card, image, profile-sync, and Admin Panel changes already present in the working tree.

## Validation

- `pnpm run typecheck` — passed for libraries, Admin Panel, API server, mobile app, mockup sandbox, and scripts.
- `pnpm --filter @workspace/admin-panel run build` — passed.
- Mobile static build — passed after starting the local Metro server; iOS and Android bundles/manifests were generated and 54 assets were processed.
- `git diff --check` — passed.
- Generated mobile `static-build` output remains ignored and is not included in the commit.
- No `.env`, keystore, `key.properties`, backup, release artifact, or generated build file is tracked by this cleanup.

## Intentionally not changed

The live backend still requires the separately planned production work: correct D1 schema/migrations, correct R2 binding, secure admin secret rotation, notification persistence, authentication, rate limiting, and deployment source-of-truth. These remain release blockers from the read-only audit and are not hidden by this small cleanup commit.

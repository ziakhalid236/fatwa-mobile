# AGENTS.md

Short repository notes for future sessions.

## Shape

pnpm monorepo (`pnpm@10`). The root `preinstall` rejects npm.

- `artifacts/fatwa-mobile`: Expo / React Native app
- `artifacts/admin-panel`: Vite + React admin UI (Cloudflare Pages `fatwa-admin`)
- `workers/fatwa-api`: Cloudflare Worker API (not in the pnpm workspace; install with `--ignore-workspace`)
- `data/kb`, `tools/kb`, `tools/legal`, `docs/`, `store-assets/`

## Production

- API: https://fatwa-api.ziakhalid236.workers.dev (staging: `fatwa-api-staging`)
- Databases: Turso (`docs/DATABASE_TURSO.md`); media in R2 `fatwa-media`; Workers AI binding `AI`
- Root `wrangler.toml` exists only so a Workers Build from the repo root finds the Worker. Keep it in sync with `workers/fatwa-api/wrangler.toml`.

## Rules learned the hard way

- The Android and web workflows do NOT typecheck. The `Check (typecheck)` workflow does; look at it after every push.
- Never use blind `sed` renames in `lib/store.tsx` (a doubled prefix crashed build 96 on launch).
- Adhan alarms must use one-shot `date` triggers (`lib/adhan.ts`). expo-notifications on Android does not implement `calendar` triggers, and its `daily` trigger follows the device clock, not the selected city's timezone. The app re-syncs a rolling 5-day horizon on launch and on foreground; alarms with `auto: true` follow the computed prayer time and stop doing so once the user nudges the time by hand.
- Android notification channels are created on launch (`initializeNotificationChannels`). `workers/fatwa-api/src/push.ts` sends remote pushes to the `broadcast` channel, so `lib/adhan.ts` must keep declaring that channel or Android drops the push. The app's `defaultChannel` is `fatwa-updates`, not the loud `adhan-alarms` channel, so routine pushes never blast the adhan sound.
- Legal pages are generated: edit `tools/legal/build.py`, not the outputs.
- Update this file when build commands, deploy paths or bindings change.

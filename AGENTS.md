# AGENTS.md

Repository knowledge for future sessions. Keep it short and factual.

## Project shape

pnpm monorepo. `packageManager: pnpm@10.34.9`. The root `preinstall` script
rejects npm, so always use pnpm.

- `artifacts/fatwa-mobile` — Expo / React Native app (Android APK + AAB)
- `artifacts/admin-panel` — Vite + React admin UI
- `artifacts/api-server` — Node/Express adapter used for local dev
- `workers/fatwa-api` — Cloudflare Worker, the production API
- `lib/api-zod`, `lib/*` — shared packages

## Production

- Worker `fatwa-api` → https://fatwa-api.ziakhalid236.workers.dev
- D1 `fatwa-web-content` (id `c07cb62b-83d3-48b3-a84f-f7959b134005`)
- R2 `fatwa-media`, Workers AI binding `AI`
- Admin panel is a Cloudflare Pages project (`fatwa-admin.pages.dev`)

## Commands

```bash
pnpm install              # always pnpm
pnpm run typecheck        # all packages
pnpm run build            # all packages; must exit 0 from the repo root
cd workers/fatwa-api && pnpm exec tsc --noEmit
cd workers/fatwa-api && pnpm exec wrangler deploy --dry-run
```

## Gotchas

- The root `wrangler.toml` exists so a Cloudflare Workers Build run from the
  repository root can find the Worker. Keep it in sync with
  `workers/fatwa-api/wrangler.toml` (bindings must match).
- `artifacts/fatwa-mobile/scripts/build.js` is a Replit-oriented static web
  export. It needs `REPLIT_INTERNAL_APP_DOMAIN`, `REPLIT_DEV_DOMAIN` or
  `EXPO_PUBLIC_DOMAIN`. Without one it logs a skip message and returns 0
  instead of failing, so the monorepo build works on Cloudflare. Do not turn
  that back into `process.exit(1)`.
- `artifacts/api-server` has a pre-existing `TS6305` on
  `lib/api-zod/dist/index.d.ts` until that lib is built; build before
  typechecking it.

## Deploying the Worker

Cloudflare Workers Builds owns the git integration, but it has been failing
and hanging on this monorepo (preview builds for PRs `76ee3e3`, `c30c65e`,
`bbea755`, `2eaad8d`, `4164dfc`, `dc07021` all failed). `.github/workflows/worker-deploy.yml`
is a working alternative: it applies D1 migrations, runs `wrangler deploy`,
and smoke-tests `/health`, `/fatwas`, `/posts` and `/chat`. It needs the
repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; without
them it skips with a warning.

## AGENTS.md maintenance

Update this file when build commands, deploy paths, or bindings change.

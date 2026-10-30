# Fatwa API Worker

The production API (Cloudflare Worker). Accounts and sessions, profiles (avatar, cover), posts and moderation, questions and fatwas, the knowledge library, AI chat, notifications and push, email, traffic stats and admin routes.

## Source

- `src/index.ts`: routing, schema creation (`createSchema`), auth, posts, profiles
- `src/extras.ts`: additional routes (reports, traffic, geo, profile pages) and column upgrades
- `src/library.ts`, `src/kb.ts`: library search and AI answers
- `src/mail.ts` (email), `src/push.ts` (Firebase push), `src/turso.ts` (database client)

## Configuration

Databases are Turso (see `docs/DATABASE_TURSO.md`); R2 bucket `MEDIA`; Workers AI `AI`. Secrets are set by the deploy workflow from GitHub secrets: `TURSO_DB_URL/TOKEN`, `TURSO_KB_URL/TOKEN`, `ADMIN_TOKEN`, `SMTP_USER/PASS`, `GOOGLE_CLIENT_IDS`, `FCM_SERVICE_ACCOUNT`.

## Check and deploy

```bash
pnpm install --ignore-workspace --ignore-scripts
pnpm exec tsc --noEmit
```

Deploy from GitHub: Actions, "Deploy fatwa-api Worker", pick `staging` or `production`.

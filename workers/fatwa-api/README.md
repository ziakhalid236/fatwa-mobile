# Fatwa API Worker

This is the repository source of truth for the production Cloudflare Worker. It owns the public API, profile/session creation, D1 queries, R2 media access, moderation actions, notifications and admin audit records.

## Bindings

- `DB`: D1 database `fatwa-web-content`
- `MEDIA`: R2 bucket `fatwa-media`
- `ADMIN_TOKEN`: Cloudflare Secret, never committed
- `ALLOWED_ORIGINS`: comma-separated approved origins

## Local checks

```bash
pnpm install --ignore-workspace --ignore-scripts
pnpm run typecheck
pnpm exec wrangler deploy --dry-run
```

## Deployment

Run from this directory after authenticating Wrangler or through the authorized Cloudflare deployment workflow:

```bash
pnpm exec wrangler d1 migrations apply fatwa-web-content --remote
pnpm exec wrangler secret put ADMIN_TOKEN
pnpm exec wrangler deploy
```

The migration is additive and does not delete or reset existing production data. A preview Worker and smoke test should be completed before production deployment.

## API safety

Public endpoints return generic errors. Raw D1/R2 errors are logged server-side only. Write endpoints are rate-limited, image uploads are limited to 8 MB and allow-listed image MIME types, and R2 object keys are UUID-based.

# Database: Turso (libSQL)

The API Worker stores data in Turso, not Cloudflare D1 (D1's free daily write limit blocked the library load).

| Purpose | Production DB | Staging DB |
|---|---|---|
| App data (users, posts, notifications, fatwas) | `fatwa-app` | `fatwa-app-staging` |
| Knowledge library (Quran, hadith, books, scholars) | `fatwa-kb` | `fatwa-kb-staging` |

- Organisation `ziakhalid236`, region `aws-ap-south-1` (Mumbai), free plan, overages off.
- Code: `workers/fatwa-api/src/turso.ts` is a small D1-compatible client over Turso's HTTP API. `withTurso(env)` replaces `env.DB` / `env.KB` when the `TURSO_*` secrets exist; otherwise the old D1 bindings are used.
- Worker secrets (set by the deploy workflow from GitHub secrets): `TURSO_DB_URL`, `TURSO_DB_TOKEN`, `TURSO_KB_URL`, `TURSO_KB_TOKEN`, `ADMIN_TOKEN`.
- GitHub secrets: `TURSO_APP_URL/TOKEN`, `TURSO_KB_URL/TOKEN`, `TURSO_APP_STAGING_*`, `TURSO_KB_STAGING_*`, `PROD_ADMIN_TOKEN`, `STAGING_ADMIN_TOKEN`.
- The schema is created and upgraded by the Worker itself on first request (`createSchema` in `index.ts`).
- Deploy: GitHub Actions, "Deploy fatwa-api Worker", choose `staging` or `production`. It smoke-tests and rolls back on failure.
- Free-plan budget (per month): 10 million rows written, 500 million rows read. The full library load uses about 1 million writes (about 5.6 writes per passage).
- Backups: Turso keeps 1 day of point-in-time restore on the free plan. Keep your own SQL dump (`outputs/backups/`) before risky changes.
- Credentials: `outputs/keystore-PRIVATE/turso-credentials.txt` (private). Rotate by creating new tokens in the Turso dashboard and updating the GitHub secrets, then redeploy.
- Old D1 databases (`fatwa-web-content`, `fatwa-kb`, `fatwa-staging`, `fatwa-kb-staging`) are left untouched as a fallback; delete them once Turso has been stable for a while.

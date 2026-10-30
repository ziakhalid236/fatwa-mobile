# Fatwa

An Islamic guidance app for Android: prayer times and Qibla, a library of Quran, hadith and fiqh texts with an AI assistant, fatwas and answers to user questions, and a moderated community feed. Built with Expo / React Native, a Cloudflare Worker API, Turso (libSQL) databases and a web admin panel.

## What is in the app

- Home, prayer times with adhan alarms, Qibla compass
- Library: Quran (Arabic, Urdu, English), hadith, Hanafi books, search, sources and rights per text
- Fatwas (Darul Ifta Deoband, 1,904 entries) and "ask a question" with answer notifications
- Community posts (moderated, auto-removed after 30 days), user profiles with avatar and cover photo (2:1)
- Sign in with Google or email (optional, "Skip for now" is allowed); welcome email on first sign-in
- AI chat that answers from the library with references
- Legal pages (terms, privacy, disclaimer, guidelines, data deletion, sources), in app and hosted

## Repository map

| Path | What it is |
|---|---|
| `artifacts/fatwa-mobile` | The app (Expo Router). `app/` routes, `screens/`, `components/`, `lib/` (store, API, upload), `data/` |
| `artifacts/admin-panel` | Admin web UI (Vite + React): posts, questions, fatwas, users, reports, traffic dashboard. Hosted on Cloudflare Pages |
| `workers/fatwa-api` | The API (Cloudflare Worker, TypeScript). `index.ts` routes, `extras.ts` extra routes, `library.ts`/`kb.ts` library and AI, `mail.ts`, `push.ts`, `turso.ts` |
| `data/kb` | Library source data loaded into the database |
| `tools/kb` | Library loader (`kbtool.py`). `tools/legal`: generates the legal pages (`build.py`) |
| `docs/` | Status, publishing guide, database guide, library ingest guide |
| `store-assets/` | Play Store feature graphic |
| `.github/workflows` | CI (see below). `.github/scripts` signing helper |

## Automation (GitHub Actions)

| Workflow | Purpose |
|---|---|
| Check (typecheck) | Runs on every push: type-checks the app, admin panel and Worker |
| Android release builds | Every push to `main`: signed APK and AAB artifacts (`versionCode` = 100 + run number) |
| Deploy fatwa-api Worker | Manual: choose `staging` or `production`; smoke-tests and rolls back on failure |
| Deploy admin panel and web preview | Manual: choose `staging` or `production` |
| Load knowledge library | Manual: loads `data/kb` into the database |

## Local development

```bash
pnpm install
pnpm run typecheck                                  # app + admin panel
pnpm --filter @workspace/fatwa-mobile run start     # Expo dev server
cd workers/fatwa-api && pnpm install --ignore-workspace --ignore-scripts && pnpm exec tsc --noEmit
```

The app talks to `EXPO_PUBLIC_API_URL` (default: the production Worker). Secrets (keystore, database tokens, SMTP, Firebase) live only in GitHub Actions secrets, never in the repo.

More: `docs/STATUS.md` (current state, Urdu), `docs/PUBLISHING_GUIDE.md`, `docs/DATABASE_TURSO.md`, `docs/KNOWLEDGE_BASE_INGEST_GUIDE.md`.

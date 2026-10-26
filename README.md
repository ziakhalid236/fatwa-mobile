# Fatwa Mobile

A local-first Expo/React Native frontend for a Fatwa guidance app. The backend is intentionally not connected yet; all preview interactions are stored locally on the device so the UI and user flows can be tested end to end.

## Frontend capabilities

- Home dashboard with topic discovery and ask-a-question CTA
- Browse answers with search and topic filters
- Topic detail screens and answer detail screens
- Save/unsave answers and mark answers helpful
- Native answer sharing
- Multi-step private question submission flow with review and confirmation
- Local submission history with question IDs and status timeline
- Profile screen with editable name and location
- Notification preference persistence
- Clear local data control
- Responsive Expo web export and Android configuration

The mobile app reads published records from `EXPO_PUBLIC_API_URL` when configured and falls back to bundled records when the API is offline. Every seeded record is a short, source-linked paraphrase attributed to Darul Ifta, Darul Uloom Deoband, India; the app keeps the original source URL visible rather than presenting an unattributed ruling.

## Backend and admin panel

- `artifacts/api-server` exposes public fatwa/question endpoints and protected admin endpoints.
- `artifacts/admin-panel` provides fatwa CRUD, source attribution fields, dashboard counts, question review, and answer publishing.
- Set `ADMIN_TOKEN` on the API server. The admin panel uses `VITE_ADMIN_TOKEN` for local development or asks for the token at login.
- The current development store is file-backed and can be pointed at a persistent location with `CONTENT_STORE_FILE`. A Postgres/Drizzle adapter can be added without changing the API contract.

Example local run:

```bash
ADMIN_TOKEN=change-me PORT=5000 pnpm --filter @workspace/api-server run dev
VITE_API_URL=http://localhost:5000 VITE_ADMIN_TOKEN=change-me pnpm --filter @workspace/admin-panel run dev
```

Questions submitted from the mobile app are stored as `submitted`, appear in the admin inbox, and become `answered` after an admin publishes a response. The mobile question timeline remains locally available if the API is temporarily offline.

## Development

```bash
pnpm install
pnpm --filter @workspace/fatwa-mobile run typecheck
pnpm run typecheck
pnpm --filter @workspace/fatwa-mobile run dev
```

The mobile app lives in `artifacts/fatwa-mobile`. Shared API/server packages are kept in the workspace for the later backend phase.

## Android APK

The Expo app is configured with package ID `com.fatwa.mobile` and an EAS preview profile that produces an installable APK:

```bash
cd artifacts/fatwa-mobile
npx eas build --platform android --profile preview
```

The repository also contains `.github/workflows/android-apk.yml`. A push to `main` or a manual workflow dispatch generates a native release APK on GitHub-hosted Android tooling and uploads it as the `fatwa-mobile-preview-apk` artifact. For local native builds, generate the Android project and run Gradle from `artifacts/fatwa-mobile/android`.

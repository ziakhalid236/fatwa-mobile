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

All answer text currently shown in the app is explicitly sample preview content and is not a religious ruling. A qualified scholar service and backend will be connected in a later phase.

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

For local native builds, generate the Android project and run Gradle from `artifacts/fatwa-mobile/android`.

# DailyForge — Flutter app

Workout + Yoga + Breathwork tracker. Android primary, iOS configured but not actively built. See `docs/ARCHITECTURE.md` §5 for the app architecture overview.

## Build commands

```
flutter pub get
flutter analyze
flutter build apk --debug                       # localhost API, Sentry off
flutter run --dart-define=API_BASE_URL=http://<laptop-ip>:3001/api
```

`API_BASE_URL` must always end in `/api` — endpoint constants in `lib/config/api_config.dart` don't re-prefix it. Default when no flag is passed: `http://localhost:3001/api`.

## Sentry configuration

Crash reporting is disabled by default. When `SENTRY_DSN` is empty (dev builds), `SentryFlutter.init` is never called — no init overhead, no network calls. To enable for QA or production builds:

```
flutter build apk \
  --dart-define=API_BASE_URL=https://api.dailyforge.app/api \
  --dart-define=SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project> \
  --dart-define=APP_ENV=production \
  --dart-define=SENTRY_RELEASE=dailyforge-flutter@1.0.0+1
```

**PII policy.** `options.sendDefaultPii = false` is set in `lib/main.dart`. User context is `id` only — no email, no username, no IP address, no request headers. The id-only scope is applied by `AuthProvider` on login / register / app-restart-with-stored-token, and cleared on logout / 401-handled.

Performance traces sample at 20% (`tracesSampleRate = 0.2`). Adjust in `lib/main.dart` if event volume becomes a concern.

Source-map and debug-symbol upload is manual via `app/scripts/upload-sentry-symbols.sh`. Requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` env vars. CI integration is planned for S15-T5.

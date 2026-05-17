![CI](https://github.com/p-spec1024/DailyForge/actions/workflows/checks.yml/badge.svg)

# DailyForge

A workout, yoga, and breathwork tracker.

- **Server** — Node/Express API in `server/`. PostgreSQL on Neon.
- **App** — Flutter app in `app/` (screens in `app/lib/pages/<feature>/`).

## Quick start

Install dependencies:

```
npm install
```

Run the server (dev mode with watch + Sentry instrumentation):

```
npm run dev:server
```

Analyze and test the Flutter app:

```
npm run check
```

Run the Flutter app:

```
npm run app:run
```

## CI

GitHub Actions workflow at `.github/workflows/checks.yml`. Runs on every pull request and on pushes to `main`:

- **flutter** job: `pub get` → `analyze` → `test` (Flutter 3.41.6 stable)
- **node** job: `npm install` → `node --check server/src/index.js` (Node 24)

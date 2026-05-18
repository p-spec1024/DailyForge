# Server tests

## Run

    npm test -w server

The script loads `server/.env` if present (`--env-file-if-exists=.env`). Tests
that need `JWT_SECRET` / `DATABASE_URL` (anything importing
`src/config/env.js`) will read them from `.env` locally or from the CI step's
injected env vars on GitHub Actions.

## Add a test

1. Create `server/test/<name>.test.js`.
2. Import from `node:test` and `node:assert/strict`.
3. Use helpers from `server/test/helpers/` to spawn the app and mint test JWTs.

## Conventions

- Test files end in `.test.js`. Anything in `test/helpers/` is not run as a test.
- Test names describe behavior, not implementation. Good: `"GET /api/users/profile without JWT returns 401"`. Bad: `"authenticate middleware works"`.
- Tests don't depend on each other. Each test calls `buildTestApp()` (or `createApp()`) afresh.

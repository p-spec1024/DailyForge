# S15-T6 — Server test infrastructure (node:test + supertest)

**Sprint:** 15 (Foundation / Stabilization Part 1)
**Branch:** sprint-chained off `s15-t5` (head: `8ac9f4a`) — fresh branch `s15-t6`
**Touches:** `server/`, root `package.json`, `.github/workflows/checks.yml`
**Estimated:** 2-3 days
**`.5`-suffix risk:** Low. Greenfield infrastructure with no existing patterns to disrupt. Main risk is over-scoping; ship the minimal viable infra and let later tickets extend it.

---

## 1. Source

Surfaced during S15-T7 (auth integer-id) pre-flight, May 17, 2026. The spec assumed `npm test -w server` would run a real test runner; pre-flight discovered there is no test runner, no `server/test/` directory, and no `test` script in `server/package.json`. The S15-T5 CI workflow only runs `node --check server/src/index.js` for the server (syntax check, not a real test).

**Promoted from "embedded in T7" to "T6 standalone"** because:
- The work is non-trivial and benefits from its own spec (PI #11 — spec-first for non-trivial tickets).
- Every subsequent sprint will need this infrastructure. Building it cleanly once beats wedging it into a security ticket.
- ChatGPT's May 15 review listed "no automated tests on the server" as a beta blocker. Closing that gap deserves explicit attention.

**Related FUTURE_SCOPE:** FS #217 (smoke harness deterministic counts) and FS #218 (smoke harness fixture-leak on mid-block exception) are out of scope here. T6 is about unit-level tests, not smoke-harness changes.

---

## 2. Problem

The server has no automated test infrastructure:

- No test runner installed (no Vitest, Jest, Mocha, or `node:test` dev-dep).
- No `server/test/` directory.
- `server/package.json` has no `test` script — `npm test -w server` is a no-op.
- The S15-T5 CI workflow (`.github/workflows/checks.yml`) runs `node --check server/src/index.js` — syntax check only.
- The only automated coverage that exists is the rolling smoke harness (`scripts/test-suggestion-engine-t2.js`), which is an integration script invoked manually, not in CI.

Downstream effect:
- S15-T7 (auth integer-id) spec calls for 7 unit tests of `authenticate` middleware. Cannot be written without infra.
- S16-T3 (engine high-value tests) calls for ~9 tests. Same blocker.
- Any future refactor risks silent regression because nothing fails loud.

This ticket installs the minimum viable test infrastructure. Later tickets fill it with tests.

---

## 3. Acceptance criteria

### 3.1. Test runner: `node:test` + `supertest`

Use Node's built-in `node:test` module (Node 20+):
- No new dev-dep on the runner itself. Runtime already has it.
- Same familiar surface (`describe` / `test` / assertions).
- Matches the project's pattern of native Node CLIs (`node --import`, `node --env-file`).
- Avoids the Jest/Vitest ESM-vs-CJS interop trap. Project is ESM end-to-end.

`supertest` as `devDependency` for HTTP roundtrips against the in-process app via `createApp()`. `docs/ARCHITECTURE.md` §4.7 already names supertest as the intended pattern but it was never installed.

### 3.2. Directory + files

```
server/
├── package.json                  # adds "test" script + supertest devDep
├── test/                         # NEW
│   ├── README.md                 # quick-start
│   ├── helpers/
│   │   ├── app-factory.js        # spawns createApp() instance
│   │   ├── jwt-mint.js           # signs test JWTs
│   │   └── db-sentinel.js        # re-exports smoke-fixtures helper
│   └── smoke.test.js             # 3 trivial tests (see §3.4)
```

**Convention:** tests at `test/*.test.js` flat for now; nest only when count > ~15. Helpers stay in `test/helpers/`.

### 3.3. `server/package.json` additions

```json
{
  "scripts": {
    "test": "node --test --env-file=.env test/**/*.test.js"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

`--env-file=.env` matches the smoke-harness pattern; tests can read `JWT_SECRET`, `DATABASE_URL`, etc. without ad-hoc loading.

Glob `test/**/*.test.js` is the only file convention: tests end in `.test.js`. Files under `test/helpers/` don't match and won't be invoked as tests.

### 3.4. Three trivial smoke tests (`test/smoke.test.js`)

The point isn't to test anything substantive yet — it's to prove the infra runs end-to-end. Three cases exercising three different middleware layers:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';

test('GET /api/health returns ok', async () => {
  const app = createApp();
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /api/users/profile without JWT returns 401', async () => {
  const app = createApp();
  const res = await request(app).get('/api/users/profile');
  assert.equal(res.status, 401);
});

test('POST /api/auth/login with empty body returns 400', async () => {
  const app = createApp();
  const res = await request(app).post('/api/auth/login').send({});
  assert.equal(res.status, 400);
});
```

If all three pass, infra is sound. **No DB writes in these three tests** — staging DB stays untouched.

### 3.5. JWT mint helper (`test/helpers/jwt-mint.js`)

S15-T7 will need to sign doctored JWTs in tests. Pre-build the helper now:

```js
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';

/**
 * Sign a JWT with arbitrary payload for testing.
 * Defaults to a sensible authenticated payload; override per test.
 */
export function mintTestJwt(payload = {}) {
  const finalPayload = { id: 1, email: 'test@dailyforge.local', ...payload };
  return jwt.sign(finalPayload, config.jwt.secret, { expiresIn: '1h' });
}

export function bearerHeader(payload = {}) {
  return `Bearer ${mintTestJwt(payload)}`;
}
```

Smoke tests in §3.4 don't use it yet, but T7 will.

### 3.6. App factory helper (`test/helpers/app-factory.js`)

Wraps `createApp()` with a teardown contract. Today it's barely more than a re-export; the structure is in place so T7+ can attach Sentry test toggles, DB connection draining, etc. without rewriting every test:

```js
import { createApp } from '../../src/index.js';

/**
 * Build an Express app instance for a single test.
 * Returns { app } today; later tickets may add lifecycle hooks.
 */
export function buildTestApp() {
  const app = createApp();
  return { app };
}
```

### 3.7. DB sentinel helper (`test/helpers/db-sentinel.js`)

Re-export from the existing smoke-fixtures helper. Tests that touch DB rows need the same sentinel pattern (PI #17):

```js
export {
  insertSentinelRow,
  deleteBySentinel,
  snapshotRows,
  restoreSnapshot,
  withFixtureLifecycle,
  sentinelFor,
} from '../../scripts/lib/smoke-fixtures.mjs';
```

If pre-flight finds the helper path differs (it's `.mjs`; ESM-to-ESM should interop fine), adjust the import.

### 3.8. CI integration

Current Node job in `.github/workflows/checks.yml`:

```yaml
node:
  steps:
    - checkout
    - setup-node 20
    - npm install
    - node --check server/src/index.js
```

Replace the final step with:

```yaml
    - run: npm test -w server
```

The syntax check is implicit — `node:test` fails to load on a syntax error, so the dedicated `node --check` step is redundant.

CI stays green across migration: T6 lands with 3 passing trivial tests, so the Node job goes from "passes syntax-only" to "passes 3 tests."

### 3.9. README (`server/test/README.md`)

```markdown
# Server tests

## Run

    npm test -w server

Requires `server/.env` loaded (the script does this via `--env-file=.env`).

## Add a test

1. Create `server/test/<name>.test.js`.
2. Import from `node:test` and `node:assert/strict`.
3. Use helpers from `server/test/helpers/` to spawn the app, mint test JWTs, manage fixtures.

## Conventions

- Test files end in `.test.js`. Anything in `test/helpers/` is not run as a test.
- Test names describe behavior, not implementation. Good: `"GET /api/users/profile without JWT returns 401"`. Bad: `"authenticate middleware works"`.
- Fixtures use sentinels (see PI #17). Never `DELETE WHERE user_id = ...`.
- Tests don't depend on each other. Each test calls `buildTestApp()` afresh.
```

### 3.10. Smoke harness untouched

`server/scripts/test-suggestion-engine-t2.js` is **not migrated** in this ticket. It stays as the rolling integration script. Future tickets may consolidate; T6 doesn't.

### 3.11. `/review` clean

Real infrastructure code with logic. `/review` applies (PI #12 only exempts data-population work).

---

## 4. Pre-flight

Halt-on-drift before code:

### (a) Confirm test-infra truly absent

- `cat server/package.json` — confirm no `test` script (or a stub that exits non-zero).
- `ls server/test/ 2>&1` — expect "No such file or directory".
- `grep -l "vitest\|jest\|mocha" server/package.json` — expect no matches.

If any of these contradict the assumption (someone partially started infra), **stop and report**.

### (b) Confirm `createApp()` is importable from tests

- Read `server/src/index.js`. Confirm `createApp` is a named export.
- Confirm the entry-point gate (`isEntryPoint`) doesn't fire when imported from a test file.
- Confirm no eager side-effects on import (lazy DB pool init is fine; eager connection isn't).

If `createApp()` has a hidden side-effect that breaks under test, flag it.

### (c) Confirm `supertest` is install-clean

- `npm view supertest version` — expect a version.
- Confirm no peer-dep conflict against existing `server/package.json` deps.

### (d) Confirm config / secrets path

- Read `server/src/config.js`. Confirm `config.jwt.secret` is the path tests will use.
- Confirm `.env` has `JWT_SECRET` set.
- Confirm `NODE_ENV` in the test invocation context is not `production`. Tests don't write to DB but defense-in-depth on the prod mutation guards is cheap.

### (e) Confirm `smoke-fixtures.mjs` exports

- Read `server/scripts/lib/smoke-fixtures.mjs`. Confirm the six named exports listed in §3.7 actually exist.
- ESM-to-ESM `.mjs` import from `.js` should work but verify.

### (f) Confirm workflow shape

- Read `.github/workflows/checks.yml`. Confirm the Node job shape matches §3.8 (or close — minor differences are fine; major differences need a spec amendment).

### Halt-on-drift

Stop and report if any of:
- Test infra already partially exists.
- `createApp()` has eager side-effects that prevent in-test instantiation.
- `smoke-fixtures.mjs` named exports don't match §3.7.
- Workflow file shape differs materially from §3.8.

---

## 5. Build steps

1. **Pre-flight.** Run §4 (a)-(f). Stop on drift; otherwise proceed.
2. **Install supertest.** `npm install --save-dev supertest@^7 -w server`. Confirm `package-lock.json` updates with expected packages only.
3. **Add test script to `server/package.json`.** Run `npm test -w server` — expect a clean "no test files" exit (or similar). Proves the wiring.
4. **Create `test/helpers/`** with the three helper files from §3.5-3.7.
5. **Create `test/smoke.test.js`** with the three cases from §3.4.
6. **Run `npm test -w server` locally.** All 3 tests pass.
7. **Create `test/README.md`** per §3.9.
8. **Update `.github/workflows/checks.yml`** per §3.8.
9. **Push branch + open PR** (or push to existing sprint-chain PR — see prompt for branching note).
10. **Verify first CI run.** All jobs green.
11. **`/review`.** Apply feedback if any.
12. **Stop. Report. Wait for greenlight.** Do NOT auto-commit (PI #6).

---

## 6. Test plan

- `npm test -w server` runs locally, exits 0, reports 3 passing tests.
- CI Node job switches from `node --check` to `npm test -w server` and stays green.
- **Deliberate-failure sanity check:** introduce a one-line failure (`assert.equal(res.status, 999)`). Confirm local exits non-zero AND CI catches it on push. Revert before commit.
- **JWT mint sanity check:**
  ```bash
  node --env-file=.env -e "import('./test/helpers/jwt-mint.js').then(m => console.log(m.mintTestJwt()))"
  ```
  Confirm it prints a JWT.

---

## 7. Out of scope

- **Migrating the smoke harness to `node:test`** — out of scope. Smoke is integration-level; T6 is request-level.
- **Writing tests for existing route handlers beyond the 3 smoke cases** — T7 adds 7 auth tests; S16-T3 adds ~9 engine tests; coverage accretion is per-sprint, not T6's.
- **Test coverage thresholds / reports** — S16-T3.
- **DB fixture lifecycle hooks (`beforeEach` / `afterEach`)** — premature. Defer until the first test actually needs DB writes.
- **Parallelism / test isolation strategies** — `node:test` is serial by default. Revisit when test count > ~30 or wall-clock > 30s.
- **Flutter test parity** — out of scope. Flutter tests already exist; CI already runs them.

---

## 8. Post-ship tracker updates

After greenlight + commit:

- **SPRINT_TRACKER.md:** Mark new S15-T6 (test infra) ✅ shipped with commit SHAs. **Renumber:** old T7 (ImageKit) → T8; insert new T7 row (auth integer-id) marked ⏳.
- **SPRINT_15_PLAN.md:** Renumber. New T6 = this spec. T7 = auth integer-id (previously T6). T8 = ImageKit (previously T7). Update the ticket-overview table at the top, and the rolling status footer.
- **FUTURE_SCOPE.md:** No closes from this ticket. Optionally annotate FS #217 / #218 noting their future home is the new `server/test/` directory.
- **CHATGPT_REVIEW_TRACEABILITY.md:** Add a row: "Test infrastructure absent → S15-T6 ✅ shipped (this ticket)" with the commit SHA. (ChatGPT review didn't itemize this as a finding — it surfaced via T7 pre-flight — so it's a new traceability row, not a status flip.)
- **docs/ARCHITECTURE.md:** Add §4.8 "Server tests" subsection covering the layout. Or extend §4.7 (smoke harness) distinguishing unit tests (`test/`) from integration smoke (`scripts/`).

Standard three-commit pattern: ticket + chore + optional amendment.

---

## 9. References

- `SPRINT_15_PLAN.md` (will be updated at ship time)
- `docs/ARCHITECTURE.md` §4.1 (`createApp()`), §4.7 (smoke harness)
- Project Instructions #6 (no auto-commit), #11 (spec-first), #12 (`/review` applies), #17 (sentinel cleanup), #20 (external review traceability)
- ChatGPT review §3.4 (CI), §7 (workflow), §8.4 (test gap)

---

*Authored May 17, 2026 in response to S15-T7 pre-flight surfacing the test-infra gap. Locked at greenlight.*

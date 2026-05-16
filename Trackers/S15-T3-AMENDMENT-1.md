# S15-T3 AMENDMENT-1 — Pre-flight drift resolutions

**Parent spec:** `Trackers/S15-T3-sentry-node-spec.md` (v1)
**Authored:** May 16, 2026
**Trigger:** Claude Code pre-flight surfaced 8 drift items between spec assumptions and live repo state.
**Pattern:** PI #16 — mid-build spec-vs-data drift gets an AMENDMENT doc, original spec stays clean.

This amendment is the **canonical contract** for all eight items below. Where it conflicts with the v1 spec, this amendment wins.

---

## A1 — Sentry version: v10, not v8

**Drift:** v1 spec D12 locked v8 API. Live npm registry latest is `@sentry/node@10.53.1`. Spec was written against a stale assumption.

**Resolution:** Install `@sentry/node@^10` (latest stable). The v8+v10 API path Claude Code verified is unchanged for our usage:
- `Sentry.expressIntegration()` — canonical in v10.
- `Sentry.setupExpressErrorHandler(app)` — canonical in v10.
- Deprecated v9 exports (`tracesSampleRate` gating in some shapes) were removed but did not affect our `setupExpressErrorHandler` path.

**Spec impact:** D12 amended from "v8" → "v10+". §3.1 amended from "v8+" → "v10+". Rest of D12's logic stands.

**Rationale:** Shipping on a 2-major-old SDK at the start of a stabilization sprint contradicts the sprint's purpose. Upgrade now while there's no Sentry usage to migrate.

---

## A2 — ESM, not CommonJS

**Drift:** v1 spec §5 used `require(...)` syntax. `server/package.json` has `"type": "module"`. Every `.js` under `server/src/` is ESM.

**Resolution:** All code in this ticket uses `import` / `export` syntax. Mechanical translation of every snippet in v1 spec §5 from CommonJS → ESM.

**Spec impact:** §5 snippets are illustrative — the ESM equivalent is the contract.

Example (resolved):
```js
// server/src/observability/sentry.js
import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: 'dailyforge-server@' + (process.env.npm_package_version ?? readPkgVersion()),
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    integrations: [Sentry.expressIntegration()],
  });
  // PII gate: sendDefaultPii: false is the SDK floor.
  // The real geographic-PII gate is the org-level "Prevent Storing of IP Addresses"
  // setting in Sentry web console — confirmed ON during S15-T2.
}

export function isSentryEnabled() {
  return Boolean(process.env.SENTRY_DSN);
}
```

---

## A3 — Init via `--import` flag, not "first line of index.js"

**Drift:** v1 spec §5 step 3 said "First two lines of `server/index.js`: `require('./src/observability/sentry').initSentry();`". Under ESM, `import` statements are hoisted — you cannot put `initSentry()` "as the first line" and expect it to run before subsequent imports. Sentry's auto-instrumentation needs to patch http/express modules at module-load time.

**Resolution:** Use **Option A** (Claude Code's recommendation): the official Sentry ESM pattern.

1. Create `server/src/observability/instrument.js`:
   ```js
   import { initSentry } from './sentry.js';
   initSentry();
   ```

2. Update `server/package.json` scripts:
   ```json
   {
     "scripts": {
       "dev": "node --import ./src/observability/instrument.js --watch src/index.js",
       "start": "node --import ./src/observability/instrument.js src/index.js"
     }
   }
   ```
   (Plus any other entry script — pre-flight 4.3 captured them.)

3. `server/src/index.js` itself is **not modified** for Sentry init. The `--import` flag guarantees instrument.js runs before any other module loads — including before Express is imported. This is exactly what Sentry's auto-instrumentation needs.

**Spec impact:** §5 step 3 replaced wholesale. §3.3 acceptance criterion replaced: "Init runs via `--import ./src/observability/instrument.js` flag in `dev` and `start` npm scripts."

**Rejected:** Option B (top-level `await import('./observability/sentry.js').then(...)` in `index.js`) — works but fragile to import-order regressions. Not worth the risk.

**Mid-build correction (A3.1):** the `--import` chain runs **before** `src/index.js`, which is where `import 'dotenv/config'` lives (via `config/env.js`). So at `initSentry()` time, `process.env.SENTRY_DSN` is still empty and `initSentry()` no-ops silently — the SDK gives no warning. Verified during deliberate-error test (event 8dc09fd9 only landed after fix). Fix: `instrument.js` must load dotenv itself:

```js
// server/src/observability/instrument.js (final form)
import 'dotenv/config';
import { initSentry } from './sentry.js';
initSentry();
```

Failure mode is *silent* — no error, no log line, just no Sentry events. Worth calling out for future ESM `--import` work (any SDK that reads env at init time has the same dependency).

---

## A4 — Entry point is `server/src/index.js`, not `server/index.js`

**Drift:** v1 spec referenced `server/index.js`. Actual entry point is `server/src/index.js`. Pre-flight 4.3 confirmed.

**Resolution:** Every `server/index.js` reference in v1 spec → `server/src/index.js`. Mechanical search-and-replace.

**Files affected (spec §5 file-touches list updated):**
```
server/package.json                             (deps + scripts)
package-lock.json                               (root — monorepo lockfile, see A5)
server/src/observability/sentry.js              (NEW)
server/src/observability/instrument.js          (NEW — A3)
server/src/middleware/sentryUser.js             (NEW)
server/src/index.js                             (setupExpressErrorHandler mount only — no init line)
server/src/middleware/errorHandler.js           (verify Sentry mount comes BEFORE — see A8)
server/src/routes/<19 router files>             (authChain swap — see A8)
server/.env.example                             (SENTRY_DSN documented)
docs/ARCHITECTURE.md                            (§8 rewritten — both halves)
```

---

## A5 — Lockfile at repo root, not `server/`

**Drift:** v1 spec §5 file-touches listed `server/package-lock.json`. Actual lockfile is at `D:/projects/dailyforge/package-lock.json` (root) via npm workspaces.

**Resolution:** Install command: `npm install @sentry/node -w server`. This updates root `package-lock.json` and writes deps into root `node_modules/`. No `server/package-lock.json` will be created — that would be wrong.

**Spec impact:** §5 file-touches list updated (see A4).

---

## A6 — README does not exist; use `docs/ARCHITECTURE.md` §8

**Drift:** v1 spec §5.8 + §3.10 referenced "Update `server/README.md`". Neither `server/README.md` nor root `README.md` exists.

**Resolution:** Sentry run docs go in `docs/ARCHITECTURE.md` §8 (which is already being rewritten by this ticket). No new README files in this sprint.

The §8 rewrite gains a new subsection §8.2.3 "Running with Sentry locally" covering:
- `SENTRY_DSN=https://... npm run dev` to opt in.
- DSN unset = no-op, fully silent.
- Org-level "Prevent Storing of IP Addresses" gate explanation.

**Spec impact:**
- §3.10 second bullet retired (`server/README.md` will not be created).
- §5 step 8 retired (folded into step 9 — the §8 rewrite).

**Rejected:** Creating a new `server/README.md` whose only content is two paragraphs about Sentry. Bloats the repo for no benefit; founder reads ARCHITECTURE.md anyway.

---

## A7 — No `npm run smoke`; use `t7-curl-roundtrip.mjs` as baseline

**Drift:** v1 spec §4.7 and §5.10 referenced `npm run smoke`. Script doesn't exist. Closest analogues:
- `scripts/t1-curl-roundtrip.mjs` — `/api/sessions/start-from-last`
- `scripts/t6-curl-roundtrip.mjs` — sprint-12 routes
- `scripts/t7-curl-roundtrip.mjs` — engine `/suggest`, `/last`, `/save-as-routine` (exercises all three D9 routes)

**Resolution:** Use `scripts/t7-curl-roundtrip.mjs` as the byte-identical baseline for §4.7 and §6 "smoke unchanged" verification. It exercises the three engine routes called out in D9, which is exactly what S15-T3 must not regress.

**Spec impact:**
- §4.7: "Run `t7-curl-roundtrip.mjs` against staging, capture output to `Trackers/S15-T3-baseline-smoke-output.txt`."
- §6 "Smoke unchanged" row: "Run `t7-curl-roundtrip.mjs` against staging. Output byte-identical to baseline."

**Rejected:** Running all three (`t1` + `t6` + `t7`) — overkill for a server-init ticket whose blast radius is bounded by middleware mount order. t7 covers the routes that matter.

---

## A8 — `sentryUser` middleware mount: Option B (combined authChain)

**Drift:** v1 spec §5.5 said "Mount it after `authenticate` on the auth-protected route groups." Implied 1-2 router files. Actual scope:
- 16 routers apply auth **per-route** (breathwork.js, focus-areas.js, yoga.js, ...). 19 file touches.
- 2 routers apply auth **at top** (auth.js, bodyMap, bodyMeasurements, dashboard, exercises, media, home, progress, progressPhotos, sessions, multi-phase-sessions, suggestions, settings, session, workout, users, routines) — straightforward `router.use(sentryUser)` after the top-level `authenticate`.
- `auth.js` (login/register) is intentionally unauthenticated — skip.

A global `app.use(sentryUser)` doesn't work because `authenticate` runs inside routers, not at app level.

**Resolution:** **Option B** — export a combined `authChain` from `server/src/middleware/auth.js`:

```js
// server/src/middleware/auth.js
import sentryUser from './sentryUser.js';

export function authenticate(req, res, next) { /* existing logic */ }
export const authChain = [authenticate, sentryUser];
```

Then in every router that currently uses `authenticate` per-route, swap to `authChain`:

```js
// before
router.post('/path', authenticate, handler);
// after
router.post('/path', authChain, handler);
```

For routers that mount `authenticate` at the top via `router.use(authenticate)`, swap to `router.use(authChain)`.

**Why B (not A or C):**
- **Option A** (`router.use(sentryUser)` added separately to each of 19 router files): noisy, 19 separate edits, easy to forget one. Spec D8 separation preserved but at the cost of grep-pollution.
- **Option C** (call `Sentry.setUser` directly inside `authenticate`): 1 file touch, smaller diff — but violates D8 ("separate middleware mounted after authenticate") and pollutes `auth.js` with Sentry imports. The whole point of D8's separation is that `auth.js` doesn't care that Sentry exists.
- **Option B**: 1 export added, mechanical replace across 19 router files (find: `, authenticate,` / `(authenticate,` / `(authenticate)` / `router.use(authenticate)` — replace with `authChain` equivalents). Preserves D8 separation (sentryUser is still its own middleware, just bundled with authenticate at the export boundary). One concept to grep for.

**Spec impact:** §5 step 5 replaced. New §5 step 5:
> Create `server/src/middleware/sentryUser.js` (as v1 spec). Add `authChain` export to `server/src/middleware/auth.js`. Update all 19 router files to import `authChain` instead of `authenticate` where the existing usage is `authenticate` standalone for auth-gating.

**Acceptance criterion added (§3):**
> 5b. Every previous `authenticate` usage that gated an auth-protected route now uses `authChain`. The login/register routes in `auth.js` continue to use bare middleware (no auth needed there). Grep verification: `grep -rn "authenticate" server/src/routes/` shows zero matches that aren't `authChain`-related imports.

---

## A9 — Post-build `/review` findings (ESM-Node-Sentry gotchas)

Captured here so the patterns survive into future ESM/Sentry work. Two related traps that both come from Sentry running in ESM under `--import`; both were caught during S15-T3 verification, not pre-flight.

### A9.1 — `dotenv/config` must load INSIDE `instrument.js` (not just `config/env.js`)

Failure mode: deliberate-error test silently no-op'd despite DSN being set in `.env`. Root cause: `--import` runs before `src/index.js`, and `src/index.js` is the only path that reaches `config/env.js` (where `import 'dotenv/config'` lives). So at `initSentry()` time, `process.env.SENTRY_DSN` is empty and Sentry init silently no-ops — no warning, no log line.

**Fix:** `instrument.js` loads dotenv itself, *before* importing `sentry.js`:

```js
// server/src/observability/instrument.js
import 'dotenv/config';
import { initSentry } from './sentry.js';
initSentry();
```

`config/env.js`'s dotenv import stays — seed scripts (`db:migrate`, `db:seed:*`) bypass `--import` and still need their own load. Dotenv is idempotent.

**Why this generalizes:** any SDK that reads env at init time and is wired via `node --import` has the same dependency. Init.js modules must own their env loading.

### A9.2 — `sentryUser` middleware pins to the isolation scope, not the current scope

`Sentry.setUser()` shorthand targets the current scope. Under `expressIntegration()`, each request runs in its own OTel-AsyncLocalStorage frame so the current scope IS per-request — works today. **But:** the per-request guarantee is implicit in the OTel context plumbing, not visible at the middleware's call site. If a future change removes `expressIntegration()`, runs the middleware off the request thread (worker, queue consumer), or nests `Sentry.withScope()` inside a handler, the shorthand could leak user attribution across concurrent requests. That's a real PII boundary.

**Fix:** pin to the isolation scope explicitly:

```js
// server/src/middleware/sentryUser.js
Sentry.getIsolationScope().setUser({ id: String(req.user.id) });
```

The isolation scope is the request-lifetime root in v8+; nested `withScope()` inherits from it. Per-request isolation becomes visible at the call site instead of an implicit OTel invariant.

**Spec impact:** §5 step 5 amended — code uses `Sentry.getIsolationScope().setUser(...)` instead of the bare `Sentry.setUser(...)` shown in v1 spec snippets.

---

## Summary of v1 spec sections affected

| v1 section | Status post-amendment |
|---|---|
| D12 | Amended (v8 → v10+) |
| §3.1 | Amended (v8+ → v10+) |
| §3.3 | Replaced (init via `--import` flag) |
| §3.5 | Acceptance text stands; implementation is via `authChain` (A8) |
| §3.10 second bullet | Retired (no `server/README.md`) |
| §4.7 | Amended (script name: `t7-curl-roundtrip.mjs`) |
| §5 file-touches list | Replaced (see A4 list) |
| §5 step 3 | Replaced (A3 — `--import` flag pattern) |
| §5 step 5 | Replaced (A8 — `authChain` bundling) |
| §5 step 8 | Retired (folded into §5 step 9) |
| §5 step 10 | Amended (script: `t7-curl-roundtrip.mjs`) |
| §6 "Smoke unchanged" row | Amended (script name) |

Everything else in v1 stands.

---

## Founder actions (manual, blocking)

1. `gh auth login` in the Claude Code terminal (already prompted).
2. Sentry web console — create project `dailyforge-node` under org `dailyforge-3i`. Platform `node-express`. US storage. Confirm org-level "Prevent Storing of IP Addresses" still ON. Copy DSN.
3. Pass DSN to Claude Code at the deliberate-error verification step (§6 in v1 spec).

---

## Greenlight

This amendment resolves all eight drift items from Claude Code's pre-flight. Claude Code may proceed to §5 build steps (as amended above) after founder confirms:

- [ ] `gh auth login` complete
- [ ] Sentry project created, DSN in hand
- [ ] This amendment file added to `Trackers/` and committed by Claude Code as part of the S15-T3 ticket commit (per PI #16 — amendment is its own artifact, ships with the ticket)

---

**End of AMENDMENT-1.**

# S15-T3 — Sentry: Node integration

**Sprint:** 15 (Stabilization Part 1 — Foundation)
**Owner:** Claude Code (implementation), Claude.ai (architect)
**Predecessor on sprint chain:** S15-T2 (shipped May 16, 2026; HEAD `038de65`)
**Branch:** continue `s15-t2` chain → create `s15-t3` off `038de65`
**Spec authored:** May 16, 2026
**Source:** `Trackers/SPRINT_15_PLAN.md` §S15-T3, `Trackers/CHATGPT_REVIEW_TRACEABILITY.md` finding #37, code review §6 P0 + §7

---

## 1. Purpose

Wire `@sentry/node` into the Express server so production backend errors stop disappearing into stdout. Pair with the Flutter integration shipped in S15-T2 to give DailyForge a full client+server observability stack ahead of broader invite beta.

This ticket is the **server half** of the same observability gap. S15-T2 set the pattern (DSN-gated init, PII off, scope set on user-state transitions, performance traces sampled at 20%); S15-T3 mirrors that pattern server-side and adds request/error middleware in the Express-correct order.

---

## 2. Decisions locked (do NOT re-litigate)

These are settled. Pre-flight is not allowed to overturn them.

| # | Decision | Why |
|---|---|---|
| D1 | Use `@sentry/node` (v8+). Not OpenTelemetry-first, not custom logger wrappers. | S15-T2 standardized on Sentry. One vendor across the stack. |
| D2 | Create a **separate Sentry project** named `dailyforge-node` under the same `dailyforge-3i` org. Do NOT reuse `dailyforge-flutter`. | One project per runtime — separate alert rules, separate quota visibility, separate release tracking. |
| D3 | DSN passed via `SENTRY_DSN` env var only. Empty in dev = no-op (no init, no network calls). | Mirrors S15-T2: dev runs without Sentry unless explicitly opted in. |
| D4 | `sendDefaultPii: false` at the SDK level. | S15-T2 lesson: this is the floor, not the ceiling. Belt-and-braces with D5. |
| D5 | Rely on the **org-level "Prevent Storing of IP Addresses"** setting (already turned on during S15-T2). Do NOT toggle it in code. | S15-T2 learning: Sentry derives geography server-side from IP even with `sendDefaultPii=false`. The org toggle is the real gate. Document this in `ARCHITECTURE.md` §8 so a future contributor doesn't think `sendDefaultPii=false` alone is enough. |
| D6 | `tracesSampleRate: 0.2` (20%), matching S15-T2. | Cheap calibration; revisit after first month of beta data. |
| D7 | Environment tag from `NODE_ENV` (`development` / `staging` / `production`). Release from `process.env.npm_package_version`. | Idiomatic; works with `npm start` and `node --watch`. |
| D8 | User context: `Sentry.setUser({ id: String(req.user.id) })` inside a tiny middleware mounted **after** `authenticate`. Only `id` is sent — no email, no username. | Mirrors S15-T2 AuthProvider scope pattern. PII minimization. |
| D9 | Performance traces enabled on the three engine routes: `POST /api/sessions/suggest`, `GET /api/sessions/last`, `POST /api/sessions/save-as-routine`. Default trace coverage on other routes via `tracesSampleRate: 0.2`. | The three engine routes are where latency matters most. Sentry's automatic Express instrumentation will cover all routes; no need to manually wrap each handler. |
| D10 | Init Sentry inside `createApp()` factory **before** any other middleware mounts. Request handler middleware mounts first, error handler last. | Express convention; required for Sentry to capture middleware errors. |
| D11 | Do NOT touch the existing `console.error` calls in route handlers. Sentry's `errorHandler` captures uncaught errors; explicit `console.error` stays as a local-dev debugging aid. | Out of scope — refactoring logging is FUTURE_SCOPE territory, not S15. |
| D12 | Sentry-Node v8 API only — `Sentry.expressIntegration()` / `Sentry.setupExpressErrorHandler(app)` rather than the deprecated `Sentry.Handlers.*` from v7. | The spec text in `SPRINT_15_PLAN.md` references `Sentry.Handlers.*` which is the v7 API. v8 (current) uses `setupExpressErrorHandler(app)` and integrations are declared in `init()`. Pre-flight must confirm the installed version and use the correct API. **This is a deliberate amendment to `SPRINT_15_PLAN.md` text — the intent (request/tracing/error middleware) is unchanged.** |

---

## 3. Acceptance criteria

Concrete, verifiable, no ambiguity. Pre-flight + smoke must confirm each.

1. **Package installed.** `@sentry/node` (v8+) added to `server/package.json` `dependencies`. Lockfile updated.
2. **Init gated on DSN.** `server/src/observability/sentry.js` (new file) exports `initSentry()` and `isSentryEnabled()`. `initSentry()` is a no-op when `process.env.SENTRY_DSN` is empty or unset.
3. **Init runs before app construction.** `server/index.js` calls `initSentry()` at module top, BEFORE `require('./src/app')` or whatever the entrypoint pattern surfaces during pre-flight.
4. **Express integration wired correctly (v8 API).**
   - `Sentry.expressIntegration()` declared in `init()` options.
   - `Sentry.setupExpressErrorHandler(app)` called as the very last middleware before any explicit error handler.
   - No use of `Sentry.Handlers.requestHandler()` / `Sentry.Handlers.tracingHandler()` / `Sentry.Handlers.errorHandler()` (those are v7 deprecated).
5. **User context middleware.** New middleware in `server/src/middleware/sentryUser.js`. Mounted globally AFTER `authenticate` on routes that use it. Sets `Sentry.setUser({ id: String(req.user.id) })` when `req.user?.id` is present. No-op otherwise.
6. **PII off at SDK level.** `init()` options include `sendDefaultPii: false`. Code comment references org-level "Prevent Storing of IP Addresses" as the real geographic-PII gate.
7. **Performance tracing.** `tracesSampleRate: 0.2`. Express integration provides automatic route-level traces. No manual per-route wrapping.
8. **Environment + release tags.** `environment: process.env.NODE_ENV ?? 'development'`. `release: 'dailyforge-server@' + process.env.npm_package_version` (or null-safe equivalent).
9. **Deliberate error test.** A temporary dev-only endpoint `GET /api/__sentry-test` (mounted only when `NODE_ENV !== 'production'`) throws `new Error('Sentry test from Node')`. Confirms end-to-end delivery. **Removed before the chore commit.** (Test endpoint is for greenlight only; do not ship it.)
10. **Documentation.**
    - `ARCHITECTURE.md` §8 rewritten to cover both client and server (per the S15-T2 stub's promise).
    - `server/.env.example` documents `SENTRY_DSN`.
    - `server/README.md` (or top-level if more appropriate per pre-flight) documents how to run with Sentry enabled locally.
11. **CHATGPT_REVIEW_TRACEABILITY.md updated.** Finding #37 row marked `Shipped [date, commit SHA]`.
12. **SPRINT_TRACKER.md updated.** S15-T3 row marked SHIPPED with commit SHAs.
13. **Smoke harness green.** `npm run smoke` (or whatever the live invocation is — pre-flight to confirm) passes against staging Neon. Zero behavior change on the three engine routes.
14. **`/review` clean.**

---

## 4. Pre-flight diagnostics (per PI #14)

**HALT-on-drift.** Run every check below before writing any code. Stop and report at the first disagreement with this spec. Do not auto-correct.

### 4.1. Sentry Node version

```bash
cd server
npm view @sentry/node version
```

- Confirm v8.x is current latest. If v9+ is out, check the v9 migration guide for any breaking API change vs the v8 patterns assumed in D12. If v8 → v9 changed `setupExpressErrorHandler`, halt and report.

### 4.2. Express version + middleware order

```bash
grep -n "^const express\|require('express')\|import express" server/index.js server/src/**/*.js
grep -rn "app.use\|router.use" server/index.js server/src/ | head -40
```

- Confirm Express 4.21 (per ARCHITECTURE.md §2).
- Document the current middleware order in `server/index.js` (or wherever app is constructed). Sentry's request handler must mount **before** any other middleware; error handler must mount **after** all routes and just before any custom error middleware.
- If `createApp()` factory pattern is in use (per ARCHITECTURE.md §4.1), confirm where init can fire without breaking `createApp().listen(0)` test pattern.

### 4.3. Entry point shape

```bash
cat server/index.js
ls server/src/
```

- Confirm `server/index.js` is the boot file and `server/src/app.js` (or similar) constructs the Express app. Document any divergence.
- If `createApp()` is exposed and unit tests spawn in-process apps (per ARCHITECTURE.md §4.1), `initSentry()` must be safe to call multiple times (idempotent) OR called only from `index.js` boot, not from `createApp()`. **Recommendation:** call `initSentry()` from `index.js` top-of-file only; do not call from `createApp()`. This keeps tests fast (no Sentry network calls during in-process app spawn).

### 4.4. Auth middleware shape

```bash
grep -n "req.user\|req.user.id" server/src/middleware/auth.js
cat server/src/middleware/auth.js
```

- Confirm `authenticate` sets `req.user = { id, ... }`.
- Confirm no existing Sentry hook is in place. If there is, halt and report.
- Note: S15-T6 will add integer-id validation to this middleware. Don't pre-empt that work; just use `req.user?.id` defensively.

### 4.5. Engine route paths

```bash
grep -rn "router.post.*suggest\|router.get.*last\|router.post.*save-as-routine\|/api/sessions" server/src/routes/
```

- Confirm the three engine routes exist at the paths in D9. If a path moved between sprints, update D9 in the spec by amendment, don't silently patch.

### 4.6. Existing error handlers

```bash
grep -rn "err, req, res, next\|app.use((err" server/
```

- Document every existing error handler. Sentry's `setupExpressErrorHandler` must come **before** any custom error handler that calls `res.send` (otherwise the error never reaches Sentry).

### 4.7. Smoke harness baseline

```bash
cd server
npm run smoke  # or actual invocation; confirm in package.json
```

- Capture the full output to `Trackers/S15-T3-baseline-smoke-output.txt` (gitignored, local-only). This is the byte-identical baseline. Smoke must produce equivalent output after the integration ships.

### 4.8. `npm_package_version` availability

```bash
cd server
node -e "console.log(process.env.npm_package_version, require('./package.json').version)"
```

- Confirm both work. If `npm_package_version` is empty when run outside `npm start`, fall back to reading `./package.json`'s `version` field directly. The release tag must be set; an empty release tag breaks Sentry release tracking silently.

### 4.9. Sentry project creation

Manual step (Sentry web console):
- Org: `dailyforge-3i` (already created during S15-T2).
- Create new project: name `dailyforge-node`, platform `node-express`.
- Confirm the org-level **"Prevent Storing of IP Addresses"** toggle is ON (set during S15-T2; should still be on).
- Confirm US data storage region (matches S15-T2 — free tier 5K/mo shared across projects in the org).
- Copy DSN for use during the deliberate-error test.

---

## 5. Build steps (after pre-flight greenlight)

Strictly sequential. Stop after each step; verify before proceeding.

1. **Install package.**
   ```bash
   cd server
   npm install @sentry/node
   ```
   Verify v8+ installed.

2. **Create `server/src/observability/sentry.js`.**
   - Exports `initSentry()` (no-op if DSN absent) and `isSentryEnabled()`.
   - `initSentry()` calls `Sentry.init({ dsn, environment, release, sendDefaultPii: false, tracesSampleRate: 0.2, integrations: [Sentry.expressIntegration()] })`.
   - Inline comment: "PII gate: `sendDefaultPii: false` is the SDK floor. The real geographic-PII gate is the org-level 'Prevent Storing of IP Addresses' setting in Sentry web console — confirmed ON during S15-T2."

3. **Wire init in `server/index.js`.**
   - First two lines: `require('./src/observability/sentry').initSentry();` then the rest.
   - **IMPORTANT:** init must run BEFORE any `require` that pulls in `express` modules that should be auto-instrumented. Sentry's docs require this; missing it means missing traces.

4. **Wire Express integration in `createApp()` or app construction.**
   - Sentry v8: integrations declared in `init()` (step 2). The Express integration auto-instruments.
   - At the end of `createApp()` (or wherever the app is finalized — confirm via pre-flight 4.3), after all routes/middleware are mounted, call `Sentry.setupExpressErrorHandler(app)`.
   - If there is a custom error handler (`app.use((err, req, res, next) => ...)`), `setupExpressErrorHandler(app)` must come **before** it.

5. **Create user-context middleware** at `server/src/middleware/sentryUser.js`.
   ```js
   const Sentry = require('@sentry/node');
   module.exports = function sentryUser(req, res, next) {
     if (req.user?.id != null) {
       Sentry.setUser({ id: String(req.user.id) });
     }
     next();
   };
   ```
   Mount it **after** `authenticate` on the auth-protected route groups. (Pre-flight will surface which router files need it; likely `server/src/routes/sessions.js`, plus any other auth-gated router.)

6. **Add deliberate-error endpoint** for greenlight verification.
   - In `server/index.js` or wherever routes attach, guarded by `if (process.env.NODE_ENV !== 'production')`:
     ```js
     app.get('/api/__sentry-test', (req, res) => {
       throw new Error('Sentry test from Node');
     });
     ```
   - Verify with `curl http://localhost:3001/api/__sentry-test` — confirm event lands in `dailyforge-node` Sentry project dashboard within 60s.
   - **DELETE this endpoint** before the chore commit. Do not ship it.

7. **Update `server/.env.example`.**
   - Add `SENTRY_DSN=` (empty) with a comment explaining the gate behavior.

8. **Update `server/README.md`** (or `docs/` if pre-flight surfaces a more appropriate home).
   - Document how to run with Sentry locally: `SENTRY_DSN=https://... NODE_ENV=development npm run dev`.
   - Document the org-level IP setting and why it matters.

9. **Rewrite `ARCHITECTURE.md` §8** to cover both client and server.
   - Replace the S15-T2 stub language ("S15-T3 will expand this section").
   - Two subsections: §8.1 Client (Flutter) — preserve S15-T2 content. §8.2 Server (Node) — new content.
   - Explicit note in §8.2 about the SDK-level `sendDefaultPii=false` + org-level IP gate distinction (the S15-T2 lesson made canonical).

10. **Run smoke harness** against staging Neon. Diff against baseline captured in pre-flight 4.7. Behavior must be identical (Sentry init failure must not break boot; init success must not change any HTTP response).

11. **Run `/review`.** Address findings.

12. **HALT.** Report:
    - Files changed (with `server/` prefix per PI Cross-Folder Commit Rule — though this ticket is server-only, list the paths).
    - Smoke result.
    - Sentry dashboard screenshot or event ID confirming the deliberate-error landed.
    - `/review` summary.
    - **Confirm the `/api/__sentry-test` endpoint has been removed.**

13. Wait for greenlight. Then commit:
    - Ticket commit: `feat(server/observability): wire Sentry Node integration [S15-T3]`
    - Chore commit (separate): `chore: update trackers post S15-T3`

---

## 6. Test plan

| Test | How | Pass criteria |
|---|---|---|
| Init is DSN-gated | Run `npm run dev` with `SENTRY_DSN` unset | Zero Sentry network calls; zero log noise; app boots normally |
| Init succeeds with DSN | Run with `SENTRY_DSN=<test-dsn>` | One init log line; no errors |
| Deliberate error captured | `curl /api/__sentry-test` then check Sentry dashboard | Event appears in `dailyforge-node` project within 60s |
| User context attached | Log in via app, hit an auth-gated route that errors, check dashboard | Event has `user.id` (as string), no email, no IP-derived geo |
| PII off | Inspect the captured event JSON | No `request.headers.authorization`, no email, no IP-resolved location |
| Performance trace on `/api/sessions/suggest` | Hit the route 5x with DSN set | At least one trace appears in Performance tab (sample rate 20%) |
| Smoke unchanged | Run smoke harness against staging | Output byte-identical to pre-flight 4.7 baseline (except timestamps) |
| Tests pass | `npm test -w server` | All green |

---

## 7. Rollback plan

Low-risk integration. If something breaks:

1. **DSN unset rollback:** `unset SENTRY_DSN` (or remove from `.env`) — `initSentry()` becomes a no-op. Server runs without Sentry. Zero code revert needed.
2. **Code rollback:** Revert the ticket commit. Sprint chain retains the chore commit; clean rebase or another chore commit removes tracker entries.
3. **Sentry project removal:** Disable in Sentry web console (don't delete; mute project rules). Free quota is restored.

---

## 8. Out of scope (explicitly NOT in this ticket)

- **Refactoring `console.error` calls** — FUTURE_SCOPE candidate. The spec keeps them as local-dev aids.
- **Logger replacement** (winston / pino) — not in S15. Possibly S17 or post-stabilization.
- **Custom Sentry transactions** for breathwork timers, share-card render, etc. — S16+ if performance signal warrants.
- **Alert rule configuration in Sentry dashboard** — manual founder action post-ship; not Claude Code's job.
- **Source-map equivalent for Node** — Node doesn't ship minified bundles, so no source maps needed. Stack traces are already readable.
- **Auto-derive release from `package_info_plus`** (FUTURE_SCOPE #251) — that's Flutter-side. Node version comes from `npm_package_version` / `package.json` directly.
- **Integer-id validation in `authenticate` middleware** — that's S15-T6. The `sentryUser` middleware uses `req.user?.id` defensively in the meantime.

---

## 9. FUTURE_SCOPE entries this may surface

If pre-flight or build surfaces any of these, add to `FUTURE_SCOPE.md` (don't fix in-ticket):

- **FS candidate:** Structured logger (winston/pino) replacement for `console.error` — Sentry captures errors but local-dev logs are still ad-hoc.
- **FS candidate:** Sentry sampling rate calibration after first month of beta data — 0.2 is a starting guess.
- **FS candidate:** Custom Sentry transactions for engine recipe selection (per-recipe trace) — needed only if engine routes show as the latency bottleneck post-launch.
- **FS candidate:** Sentry release tracking auto-upload via CI (S15-T5 CI pipeline integration point) — flagged for the CI ticket if not already covered.

---

## 10. Cross-references

- **Spec:** this file (`Trackers/S15-T3-sentry-node-spec.md`)
- **Sprint plan:** `Trackers/SPRINT_15_PLAN.md` §S15-T3
- **Predecessor:** S15-T2 spec (chat-session prompt, throwaway) — shipped `0102a8e` + `038de65`
- **Review traceability:** `Trackers/CHATGPT_REVIEW_TRACEABILITY.md` finding #37
- **Architecture doc:** `docs/ARCHITECTURE.md` §8 (will be rewritten by this ticket)
- **Founder learnings carried forward from S15-T2:**
  1. `runZonedGuarded` silently catches throws — Flutter-side gotcha; Node equivalent is `process.on('uncaughtException')` which Sentry handles. Document so a future debugger doesn't hunt the wrong direction.
  2. Build reports can describe planned-but-not-saved code as shipped. Mandatory: `grep` the actual file before greenlight.
  3. SDK-level `sendDefaultPii=false` is not enough — org-level IP gate is the real one.

---

**End of spec.**

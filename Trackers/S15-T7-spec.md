# S15-T7 — Auth middleware integer-id validation

**Sprint:** 15 (Foundation / Stabilization Part 1)
**Branch:** sprint-chained off `s15-t6` (test infra), fresh branch `s15-t7`
**Touches:** `server/` only
**Estimated:** 3-4 days
**`.5`-suffix risk:** Medium — removing defensive coercion across multiple route files may surface a route that *relied* on implicit coercion working.

> **Renumber note:** This spec was originally written as S15-T6 (May 17, 2026). Its pre-flight discovered the server had no test infrastructure, which made S15-T6 §3.5-§3.6 unrunnable. The decision was to insert a new T6 (server test infrastructure) and renumber this ticket to T7. ImageKit (originally T7) becomes T8. Wording flip in §3.4 applied at the same time.

---

## 1. Source

- `CHATGPT_REVIEW_TRACEABILITY.md` finding #33, #41
- Code review §5.4, §8.1
- `FUTURE_SCOPE.md` #215 (closed by this ticket)

---

## 2. Problem

`authenticate` in `server/src/middleware/auth.js` assigns the decoded JWT payload to `req.user` without validating that `id` is a positive integer. Multiple route handlers defensively coerce IDs (`parseInt(req.user.id, 10)` in `workout.js`, etc.) which papers over the gap inconsistently. A malformed JWT (string `id`, missing `id`, negative `id`) could trigger weird behavior downstream — at best a 500 from a SQL coercion failure, at worst a logic bug.

This ticket pushes the validation up to the middleware boundary so every route handler that reads `req.user.id` can trust it's a positive integer without defending again.

Pre-flight finding (from May 17 attempt as old T6): JWT issuance at `server/src/routes/auth.js:44` (register) and `:72` (login) signs `id` from `INSERT … RETURNING id` / `SELECT id FROM users` — `pg` returns SQL `integer/bigint` as JS `Number`. So in the current happy path, `req.user.id` is already a JS integer. This ticket is **paranoia / future-proofing**, not a bug fix. Still worth shipping; the validation guards against future drift in token issuance (e.g. third-party signup, social auth, recovery flows).

---

## 3. Acceptance criteria

### 3.1. Middleware change

`server/src/middleware/auth.js` validates `id` after `jwt.verify`:

```js
// after jwt.verify(token, config.jwt.secret)
const id = Number(decoded.id);
if (!Number.isInteger(id) || id <= 0) {
  return res.status(401).json({ error: 'invalid_token' });
}
req.user = { ...decoded, id };
```

`Number(undefined)` is `NaN`, which `Number.isInteger` rejects — so the missing-`id` case is covered without a separate guard.

### 3.2. Route-handler simplification

**Audit every route handler** that previously coerced `req.user.id`. Use these `grep` patterns from the repo root:

```
grep -rn "Number(req.user" server/src/routes/
grep -rn "parseInt(req.user" server/src/routes/
grep -rn "req.user.id ||" server/src/routes/
grep -rn "Number(req\.user" server/src/services/
grep -rn "parseInt(req\.user" server/src/services/
```

For each hit:
- If it's a coercion of `req.user.id` specifically → remove it. `req.user.id` is guaranteed positive int post-middleware.
- If it's coercion of a different field (e.g. `req.params.id`, `req.body.exercise_id`) → leave alone. T7 scope is `req.user.id` only. Note such hits in the build report under "Out of scope for T7".

### 3.3. `requireUserId` stays

`requireUserId` (defined inline in `server/src/routes/sessions.js:79-84`) remains as belt-and-braces defense-in-depth. After T7 it is technically redundant — `authenticate` now guarantees `req.user.id` is a positive integer — but the cost is one cheap if-check per engine request and the safety margin against future middleware regressions is worth keeping. **Do not delete or modify `requireUserId`.**

Note: `requireUserId` currently returns `{ error: 'unauthorized' }` per the pre-flight finding from May 17. That wording is also unchanged in this ticket.

### 3.4. 401 response shape — additive, not replacement

New validation returns `{ error: 'invalid_token' }`. **Do not change** the existing 401 shapes in `authenticate`:
- Missing/malformed `Authorization` header → keep current `{ error: 'Missing token' }` (verified live wording, May 17 pre-flight).
- `jwt.verify` throws → keep current `{ error: 'Invalid token' }` (verified live wording).

Three distinct 401 shapes is intentional. Clients (Flutter `ApiService` 401-logout handler) only care about the status code, not the error string. Future log filtering benefits from the codes being different.

### 3.5. Tests

Add `server/test/auth.test.js` (using the test infra shipped in S15-T6). Cases:

1. JWT with `id` as a string of digits (`'123'`) → 401 `{ error: 'invalid_token' }`.
2. JWT with `id` as a non-numeric string (`'abc'`) → 401 `{ error: 'invalid_token' }`.
3. JWT with `id` as `0` → 401 `{ error: 'invalid_token' }`.
4. JWT with `id` as a negative number (`-1`) → 401 `{ error: 'invalid_token' }`.
5. JWT with `id` as `1.5` → 401 `{ error: 'invalid_token' }`.
6. JWT missing `id` claim entirely → 401 `{ error: 'invalid_token' }`.
7. JWT with `id` as a valid positive integer → passes; route returns its normal response.
8. Missing `Authorization` header → 401 `{ error: 'Missing token' }` (regression-guard the existing wording).
9. Malformed JWT (`Authorization: Bearer garbage`) → 401 `{ error: 'Invalid token' }` (regression-guard the existing wording).

Use `mintTestJwt` from `test/helpers/jwt-mint.js`. Use `supertest` against a `buildTestApp()` instance per the S15-T6 helper pattern.

All existing tests (the 3 smoke tests from T6, plus any others added between) stay green.

### 3.6. Smoke + CI

- `npm test -w server` exits 0.
- `node --env-file=.env scripts/test-suggestion-engine-t2.js` exits 0 (no regression in engine roundtrip — engine routes all gated by `authenticate` + `requireUserId`).
- CI green on the PR.

### 3.7. `/review` clean

Real logic change in middleware + removed defensive code from multiple routes. `/review` applies.

---

## 4. Pre-flight

Halt-on-drift before code:

### (a) Re-confirm `authenticate` middleware shape

Read `server/src/middleware/auth.js` end-to-end. Confirm the May 17 findings still hold:
- It uses `jwt.verify`.
- Missing-header 401 wording is `'Missing token'`.
- `jwt.verify` failure 401 wording is `'Invalid token'`.

If anything drifted between T6 ship and T7 start, update §3.4 of this spec to match live wording before proceeding.

### (b) Re-run coercion-hit inventory

Run the five `grep`s in §3.2. Produce the table:

| File | Line | Pattern | `req.user.id`? (in scope) |
|------|------|---------|---------------------------|
| ... | ... | ... | ... |

If hits exist in `server/src/services/` or other directories outside `routes/`, include them. Principle (`req.user.id` is now trusted) applies everywhere.

### (c) JWT issuance — confirm `id` is numeric

Read `server/src/routes/auth.js` lines 38-44 (register) and the corresponding login section. Confirm:
- `jwt.sign(...)` payload sets `id` from a DB query result.
- `pg` returns SQL integer/bigint as JS `Number`.

This was confirmed May 17. Just re-verify nothing changed.

### (d) Test fixture review

Per S15-T6, tests live in `server/test/`. Confirm:
- No fixture mints a non-integer `id` (the May 17 finding was clean — 13 `jwt.sign` sites in `server/scripts/`, all numeric).
- The S15-T6 `mintTestJwt` helper has a sensible default that won't break under the new validation (default `id: 1` is fine).

### (e) `requireUserId` re-confirmation

Read `server/src/routes/sessions.js:79-84`. Confirm shape unchanged from May 17 (returns 401 `{ error: 'unauthorized' }` when `!req.user?.id` or not positive int).

### Halt-on-drift

Stop and report if any of:
- Live 401 wordings differ from §3.4.
- `grep` finds zero in-scope hits (very unexpected — workout.js per FS #215 should match at minimum).
- JWT issuance now signs `id` as a non-numeric value (elevates T7 from paranoia to real bug fix).
- A test fixture uses non-integer `id` (needs migration before T7 lands).

---

## 5. Build steps

1. **Pre-flight.** Run §4 (a)-(e). Stop on drift; otherwise proceed.
2. **Middleware change.** Apply §3.1 to `server/src/middleware/auth.js`. Diff is ~5 lines.
3. **New tests.** Add the 9 cases from §3.5 to `server/test/auth.test.js`. Run `npm test -w server` — confirm all pass before touching route handlers.
4. **Route audit, one file at a time.** Per the pre-flight table, simplify each route. After each file:
   - `npm test -w server` (all green).
   - `node --env-file=.env scripts/test-suggestion-engine-t2.js` (smoke green, no count regression).
5. **`/review`** once all route files done.
6. **Stop. Report. Wait for greenlight.** Do NOT auto-commit (PI #6).

---

## 6. Test plan

- 9 new auth tests green.
- Existing tests (3 from T6 minimum) stay green.
- Engine smoke green, no count regression vs `s15-t6` baseline.
- Manual: doctored-JWT verification using the snippet below.

### Manual doctored-JWT verification

For Prashob's local verification post-build:

```bash
# From server/ with .env loaded
node --env-file=.env -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;
console.log('string id:', jwt.sign({ id: 'abc', email: 'x@y.z' }, secret));
console.log('zero id:  ', jwt.sign({ id: 0,     email: 'x@y.z' }, secret));
console.log('neg id:   ', jwt.sign({ id: -1,    email: 'x@y.z' }, secret));
console.log('missing:  ', jwt.sign({ email: 'x@y.z' }, secret));
"

# Then hit any auth-gated endpoint with each:
curl -i -H "Authorization: Bearer <token>" http://localhost:3000/api/users/profile
```

All four should return `401 { "error": "invalid_token" }`.

---

## 7. Out of scope

- **Rate limiting on auth-gated routes** — Sprint 17.
- **CORS allowlist hardening** — Sprint 17.
- **General route validation helpers (`parsePositiveInt`, `requireEnum`, etc.)** — FUTURE_SCOPE #248.
- **Changing 401 wordings for missing/malformed token cases** — §3.4. Only `invalid_token` is added.
- **Deleting `requireUserId`** — §3.3. Stays as belt-and-braces.
- **Coercion of non-`req.user.id` fields** (e.g. `req.params.id`) — note in build report, leave alone.

---

## 8. Post-ship tracker updates

After greenlight + commit:

- **SPRINT_TRACKER.md:** Mark S15-T7 ✅ shipped with both SHAs.
- **FUTURE_SCOPE.md:** Close FS #215 with the ticket SHA. FS #248 (general validation helpers) stays open.
- **CHATGPT_REVIEW_TRACEABILITY.md:** Mark findings #33, #41 ✅ shipped via S15-T7.
- **docs/ARCHITECTURE.md §4.6:** Flip the wording from "does NOT coerce `id` to int" to "guarantees `req.user.id` is a positive integer; handlers can trust it without coercing."
- **docs/API.md "Conventions" section:** Same flip.

Standard three-commit pattern.

---

## 9. References

- `CHATGPT_REVIEW_TRACEABILITY.md` findings #33, #41
- `FUTURE_SCOPE.md` #215, #248
- `SPRINT_15_PLAN.md` (renumbered at T6 ship)
- `docs/ARCHITECTURE.md` §4.2 (middleware stack), §4.6 (JWT and req.user.id)
- `docs/API.md` "Conventions" §
- S15-T6 spec for the test-infra dependency

---

## 11. Drift log

Per PI #16 and the project's drift-log convention: spec-vs-code drifts that surface during build are captured in §11 of the spec itself, not in scratch docs. Each row links the spec section that drifted, what was found, and how it was resolved.

| # | Section | Spec said | Live / discovered reality | Resolution |
|---|---------|-----------|---------------------------|------------|
| 1 | §3.1 vs §3.5 (test #1) | Middleware code uses `const id = Number(decoded.id); if (!Number.isInteger(id) || id <= 0) ...`. The inline justification ("`Number(undefined)` is NaN") only covers the missing-id case. | `Number('123')` returns the integer `123`, so the spec's middleware as written would silently accept string-digit ids and let them through validation — directly contradicting §3.5 test #1, which expects `{ id: '123' }` to return 401 `invalid_token`. The intent in §2 ("a malformed JWT — string `id`, missing `id`, negative `id`") matches §3.5; only §3.1's implementation was wrong. | **Inline fix (chosen over AMENDMENT-1, per Prashob).** Dropped the `Number()` coercion in `server/src/middleware/auth.js`; the check is now bare `Number.isInteger(decoded.id) || decoded.id <= 0`. `Number.isInteger` is strict — rejects strings, decimals, undefined, null, BigInt — so no coercion needed. `req.user = decoded` (no spread + override) since happy-path `id` is already a JS Number from `pg`. Surfaced mid-build before tests were written; no green commits relied on the broken middleware. |
| 2 | §3.5 test count | Spec §3.5 says "9 cases"; §6 reads "9 new auth tests"; prompt's stop checklist reads "12 tests" (3 T6 + 9 T7). | T6 actually shipped **4** smoke tests (the original 3 from spec §3.4 plus a 4th — `POST /api/users/pillar-levels with valid JWT + empty body returns 400` — exercising the JWT helper end-to-end). Total at T7 close is **13**, not 12. | Documentary only. Adjusted `docs/ARCHITECTURE.md` §4.8 wording at chore commit to read "13 — 4 smoke tests from T6 plus 9 middleware tests from T7." No spec or test code change. |
| 3 | §3.2 audit expectation | "Audit every route handler that previously coerced `req.user.id`" — wording implies multiple files. Build steps §5.4 reads "Route audit, one file at a time." | Inventory found **one** in-scope coercion site (`server/src/routes/workout.js:226`). All other `req.user.id` reads (47 sites across 17 route files) were already trust-raw, no coercion to remove. | Documentary only. Built workout.js as a single WIP commit. Build report under "Out of scope, untouched" captures the 47 raw-read sites that needed no change. |

### 11.1. Pre-build adjustments

Adjustments applied between spec lock and build start (after pre-flight, before the first WIP commit). None for this ticket — all five pre-flight items (§4 a-e) returned clean, no halt-on-drift triggers, and no spec amendments were needed before code. Mid-build drift (drift #1 above) was caught after the middleware commit but before any tests were authored.

---

## 12. Post-ship deviations from §8

| # | §8 said | Actually shipped | Why |
|---|---------|------------------|-----|
| 1 | "S15-T7 adds 7 middleware tests" (ARCHITECTURE.md §4.8 update implied by `S15-T6-spec.md` cross-reference) | 9 tests, matching §3.5 exactly. | The 7-vs-9 mismatch was an authoring inconsistency between T6 spec and T7 spec at renumber time. T7 spec §3.5 was the source of truth. |
| 2 | "Flip ARCHITECTURE.md §4.6 + API.md Conventions wording" | Also dropped the FS #215 reference from ARCHITECTURE.md §10.2 "Medium priority" bullet list (FS #215 is now closed) and replaced it with FS #258 (new — whitelist `req.user` fields). Also removed the `400 invalid_user_id` line from API.md's `PUT /api/workout/slot/:exerciseId/choose` Errors list (per prompt's special-case instruction). Also updated ARCHITECTURE.md §4.8 test-count wording from "S15-T7 adds 7 middleware tests" to "13 — 4 smoke tests from T6 plus 9 middleware tests from T7" reflecting the actual shipped count. | §8 was non-exhaustive; the closing-of-FS-#215, new FS #258, and §4.8 test-count correction are necessary corollaries. |

---

*Originally authored as S15-T6, May 17, 2026. Renumbered to T7 + wording flip applied same day after test-infra pre-flight finding. §11–§12 added at S15-T7 chore commit (May 18, 2026) to capture mid-build drift + post-ship deviations.*

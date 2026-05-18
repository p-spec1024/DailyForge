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

*Originally authored as S15-T6, May 17, 2026. Renumbered to T7 + wording flip applied same day after test-infra pre-flight finding.*

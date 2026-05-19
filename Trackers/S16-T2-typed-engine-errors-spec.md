# S16-T2 — Typed Engine Errors (Full-Stack, Additive Contract)

**Sprint:** 16 (Engine & API Hardening — Stabilization Part 2)
**Ticket type:** Cross-stack contract refactor (server + Flutter). Additive on the wire. Behavior-preserving for old clients.
**Priority:** #2 in S16. Blocks S16-T2b (endpoint-aware timeouts, which folds in the same `_sendRaw` updates) and S16-T3 (test coverage, which asserts the new code shape).
**Estimated time:** 2 days solo dev.
**Touches:**
- `server/src/services/suggestion-engine/errors.js` (real impl, not just shell)
- `server/src/services/suggestion-engine/recipes/*.js` (10 throw sites — pre-flight produces final list)
- `server/src/routes/sessions.js` (response shape: emit `{error, code}` instead of `{error}` only)
- `app/lib/services/api_exceptions.dart` or wherever `ApiException` lives (carry `code` field on the exception)
- `app/lib/services/api_service.dart` (`_buildApiException` reads `code` from response body)
- 1–3 Flutter consumer sites that map engine errors to user-facing copy (pre-flight identifies which)
- `docs/API.md` (document the new `code` enum)
- `Trackers/CHATGPT_REVIEW_TRACEABILITY.md` (FS #166 marked Shipped)

**`.5`-suffix risk:** Medium-high. Cross-stack, additive-contract pattern means the contract change must be exactly correct on both sides. Mitigated by row-by-row code mapping approval (this spec) + pre-flight (b)/(c)/(d) verification before code + full-stack smoke before commit.

---

## Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding FS #166. ChatGPT code review §5.1.
Quoted: *"The route handler does substring matching against `RangeError` messages from the engine. This is fragile — any wording tweak in the engine breaks the route's error classification."*

Compounding context:
- S15-T4 close note: `EngineContractError` class shell already exists at `server/src/services/suggestion-engine/errors.js`, but no throws migrated yet. The S15-T4 commit explicitly noted: "throw-message text is part of the public contract until S16-T2 — do not change throw wording."
- `routes/sessions.js:66-74` substring match is the production contract surface this ticket retires.

Out-of-scope items (deferred to T2b/T2c/T4):
- **Endpoint-aware timeouts** — S16-T2b (per-endpoint config map in `ApiService`).
- **Timeout copy fix** ("DailyForge took too long to respond") — folded into T2b since both touch `_sendRaw`.
- **Engine cleanups** (`fitMainCandidate`, `MOBILITY_MAIN_STYLES`, recency Sentry wiring) — deferred to T2c or folded into T4 (engine file splits). They were S15-T4 "while you're in there" optimizations, not on the hardening critical path.

---

## Why additive, not breaking

DailyForge ships to Play Store and (later) App Store. Once an APK is in the field, users on older app versions stay on older versions for weeks. App Store review cycles add 1–7 days of lag before a Flutter hotfix can reach users. Server-side cannot assume all clients are on `main`.

**Rule for every server response shape change going forward:** additive only. Add new fields alongside existing fields. Never rename, remove, or change the type of an existing field without a versioned endpoint.

This ticket emits the new `code` field **alongside** the existing `error` string field. Old app versions (which read `error` via substring match in the Flutter client today) continue to work, forever. New app versions read `code` first, fall back to `error` if `code` is absent (defensive against future server reverts).

This pattern becomes the standard for all future API contract changes in DailyForge.

---

## Problem

`server/src/routes/sessions.js` lines 66–74 (verify exact lines in pre-flight) translate engine throws to HTTP responses via substring matching:

```js
} catch (err) {
  if (err instanceof RangeError) {
    if (err.message.includes('time_budget')) return res.status(400).json({ error: 'invalid_time_budget' });
    if (err.message.includes('no_eligible')) return res.status(400).json({ error: 'no_eligible_exercises' });
    // ... etc
  }
  throw err;
}
```

(Exact shape per S15-T4 note; pre-flight (b) verifies.)

This is fragile in three ways:
1. **Engine throw wording is locked.** S15-T4 explicitly preserved the wording because changing it would change the substring match. The engine can't evolve its error messages without coordinating with the route handler.
2. **Route handler must know engine internals.** Adding a new error case requires touching both the engine throw and the route's substring ladder, in two unrelated files, without compile-time enforcement that they match.
3. **No structured contract for clients.** Flutter gets a string. To map that string to a user-facing message ("Your time budget is outside the engine's range"), Flutter also does substring matching. Three layers of substring fragility.

The fix: introduce `EngineContractError(code, message, details?)` as a typed class. Engine throws `new EngineContractError('INVALID_TIME_BUDGET', 'Time budget must be between 5 and 240 minutes', {min: 5, max: 240, given: 300})`. Route catches `instanceof EngineContractError` and emits `{ error: err.message, code: err.code, details: err.details }`. Flutter `ApiException` carries `code`. Consumers branch on `code` instead of substring-matching `error`.

---

## Pre-flight diagnostics (per PI #14)

Mandatory halt-on-drift before any code. Sub-steps (a) through (g):

### (a) Live `errors.js` shell shape

`view server/src/services/suggestion-engine/errors.js`. Report:
- Current `EngineContractError` class definition (constructor signature, fields, any methods).
- Is it exported? Is it imported anywhere yet (S15-T4 shipped the shell; some recipes may already import the class even if no throws use it)?
- Does it extend `Error`? Does it have a `name` property set for stack-trace clarity?

If the shell looks usable, confirm so in the build report. If it needs constructor adjustments (e.g. takes a single string, needs to take `{code, message, details}`), the adjustment is part of this ticket — implement it cleanly.

### (b) Throw-site inventory in the engine

`grep -rn "throw new RangeError\|throw new Error\|throw RangeError" server/src/services/suggestion-engine/` — enumerate every throw in the engine tree (excluding `errors.js` itself).

Build the canonical mapping table. **This table is the contract.** Every row must be approved by Prashob before code changes.

Required columns per row:

| # | File | Line | Current throw | Current message | Proposed `code` | `details` payload | User-facing copy |
|---|---|---|---|---|---|---|---|

Where:
- **Current throw**: the literal `throw new RangeError(...)` or `throw new Error(...)` statement.
- **Current message**: the exact string passed to the constructor.
- **Proposed `code`**: SCREAMING_SNAKE_CASE, max 4 words, enterprise-stable. Examples in §"Code naming rules" below.
- **`details` payload**: optional object with machine-readable context (`{min: 5, max: 240, given: 300}` for budget errors; `{focus: 'biceps', pillar: 'breathwork'}` for incompatibility errors). Used by Flutter for richer error UX in the future.
- **User-facing copy**: the actual sentence the user will see in the app. Prashob writes this; it's product copy, not engine copy.

Save the table to `Trackers/S16-T2-error-mapping.md`. Submit it for row-by-row approval before any throw is migrated. Approval gate is hard — no code until every row is signed off.

### (c) Route handler shape

`view server/src/routes/sessions.js`. Report:
- Exact line numbers of every `catch` block that handles engine throws (there should be one main one around line 66-74, but smoke harness routes and other handlers may have their own).
- For each catch, document the substring-match ladder: which strings map to which `error` values in the response.
- Compare against table (b). Every substring branch must map to exactly one row in (b). If there's a substring branch in (c) that doesn't appear in (b), the engine has a throw site (b) missed — investigate. If there's a row in (b) that doesn't appear in (c), the engine throw never reaches the route (dead code or different route) — investigate.

Halt if (b) and (c) don't reconcile cleanly. Auto-picking which one is canonical is the kind of drift PI #14 exists to prevent.

### (d) Flutter consumer inventory

`grep -rn "ApiException\|err.error\|error.contains\|error ==" app/lib/` — find every Flutter site that inspects an `ApiException`'s message field. List the file + line + the substring it currently matches. Build a small table:

| File | Line | Substring matched | User-facing copy today |
|---|---|---|---|

These are the call sites that need to migrate from `error` substring matching to `code` switch statements. If the count is small (≤5), inline migration in this ticket. If it's larger, surface in the build report — we may want to defer some consumers to a follow-up.

### (e) `ApiException` class shape

`view` wherever `ApiException` is defined (likely `app/lib/services/api_exceptions.dart` or inside `api_service.dart` itself per S16-T1's pre-flight (d)). Report:
- Current fields (`statusCode`, `message`, possibly `body`).
- Whether `code` can be added as a nullable field without breaking existing constructors.
- Whether any consumer constructs `ApiException` directly (most should not — it's thrown from `_buildApiException` only — but pre-flight confirms).

The change is additive: `code` is a new nullable `String?` field. Old consumers continue to work without touching `code`.

### (f) `_buildApiException` shape

From S16-T1, this helper extracts `body['error']` from the response and constructs `ApiException(statusCode, message)`. Verify the exact body parsing logic. Report its full body (it's ≤10 LOC).

The change: also read `body['code']` if present, pass to `ApiException` constructor as the new third arg. Old server responses (no `code` field) → `code: null` → existing behavior. New server responses → `code` populated → new consumers can branch on it.

### (g) `docs/API.md` engine-error section

`grep -n "invalid_time_budget\|no_eligible_exercises\|400" docs/API.md` — find where (if anywhere) the current engine error responses are documented. If absent, that's fine — we'll add a fresh section in this ticket. If present, plan to expand it with the new `code` enum.

---

### Pre-flight greenlight

After (a)–(g), write the standard one-paragraph summary:
- **Clean** → submit the mapping table from (b) for row-by-row approval, then proceed to Step 1.
- **Drift** → list every drift, propose resolution per item, wait for Prashob.

The mapping table approval is a separate gate from pre-flight greenlight. Do NOT proceed to Step 1 until both are passed.

---

## Code naming rules (for the mapping table)

Every `code` value becomes part of the **published API surface** the moment this ships to Play Store. Renaming a code later requires either (a) a deprecation cycle where the server emits both old and new codes for a release window, or (b) breaking older app versions. Both are expensive. Get the names right now.

Rules:
1. **SCREAMING_SNAKE_CASE.** Matches HTTP status code style and stays distinct from JSON keys.
2. **Maximum 4 words.** `INVALID_TIME_BUDGET` good. `ENGINE_VALIDATION_TIME_BUDGET_OUT_OF_RANGE` bad.
3. **Describe the condition, not the verb.** `INSUFFICIENT_EXERCISES` good. `FAILED_TO_FIND_EXERCISES` bad. The condition is what's stable; the action is implementation detail.
4. **No tense.** `INVALID_X`, `MISSING_X`, `INCOMPATIBLE_X` — not `WAS_INVALID`, `COULDNT_FIND`.
5. **Domain-prefixed when ambiguous.** If a code could mean two things in different contexts, prefix: `ENGINE_INVALID_FOCUS` vs `AUTH_INVALID_FOCUS` (hypothetical). Keep prefix consistent across the namespace.
6. **No abbreviations.** `INSUFFICIENT_EXERCISES` not `INSUF_EXERCISES`. The string is read by humans during debugging.

Reference enums Prashob can crib from when designing rows:
- Stripe: `card_declined`, `expired_card`, `incorrect_cvc` (snake_case in their style; we use SCREAMING for visual distinction from `error`).
- GitHub: `not_found`, `validation_failed`, `unprocessable_entity`.
- AWS: `InvalidParameterValue`, `ResourceNotFound`, `Throttling`.

---

## Acceptance criteria

1. **`EngineContractError` real impl.** Constructor `({code, message, details})`. Extends `Error`. `name` set to `'EngineContractError'`. `code` is required (string); `message` is required (string, human-readable for server logs); `details` is optional (object, machine-readable context). `errors.js` exports the class. No other engine module exports it (single source of truth).

2. **All 10 engine throw sites migrated.** Every throw cataloged in pre-flight (b) replaced with `throw new EngineContractError({code, message, details})`. The `code` field matches the approved mapping table exactly — no improvisation, no last-minute renames. If a throw site is found mid-build that wasn't in the table, halt and update the table before proceeding.

3. **Old `RangeError` throws fully retired.** `grep -rn "throw new RangeError" server/src/services/suggestion-engine/` returns zero matches. If the engine has any `RangeError` throws unrelated to validation (e.g. genuine numeric-range bugs), document each in the build report and leave alone — those are not contract throws.

4. **Route handler simplification.** `server/src/routes/sessions.js` engine-error catch block becomes:
   ```js
   } catch (err) {
     if (err instanceof EngineContractError) {
       return res.status(400).json({
         error: err.message,
         code: err.code,
         details: err.details ?? undefined,
       });
     }
     throw err;
   }
   ```
   The substring ladder (lines 66–74) is deleted. The handler no longer knows specific code values — it passes whatever the engine emits through to the client. This is the centralization win.

5. **Response is additive.** The `error` field is preserved with the human-readable message (now sourced from `err.message`, which the mapping table sets). Old app versions reading `error` continue to render *something* sensible (the new messages may differ from old strings — confirm that's acceptable per row in the mapping table, OR set `err.message` to the exact old string for full backward compat). The `code` and `details` fields are new.

6. **`ApiException` carries `code`.** Nullable `String? code` added. `_buildApiException` reads `body['code']` when present and passes through. When absent (old server, or non-engine errors), `code` is null and Flutter consumers fall back to existing string-matching behavior.

7. **Flutter consumers migrated.** The ≤5 consumers identified in pre-flight (d) updated to branch on `exception.code` when present, with fallback to the existing string match for old-server compatibility (the fallback is defensive — once T2 ships, no server emits without `code`, but the fallback protects against rollback scenarios).

8. **`docs/API.md` documents the new contract.** New section: "Engine validation errors." Documents the response shape (`{error, code, details}`), lists every `code` from the mapping table with: code name, HTTP status (always 400 for these), human-readable description, example `details` shape, and a "Client guidance" line explaining what the Flutter app does on each.

9. **Smoke verification.** Extend `server/scripts/test-apiservice-smoke-s16-t1.js` (or new `test-engine-errors-s16-t2.js`) to:
   - Trigger each of the 10 engine error conditions with a deliberately bad payload.
   - Assert the response shape: `{error: string, code: string, details: object|undefined}`.
   - Assert `code` matches the mapping table exactly for each trigger.
   - Assert HTTP status is 400 for every engine validation error.
   Run against staging.

10. **Device verification on Android.** Per PI #6, Claude Code does NOT auto-commit. Build → stop → Prashob device-tests:
    - Trigger one engine error (easiest: open Home, pick a body focus, enter a time budget below 5 min if the UI allows — or any other trigger from the mapping table that has a UI path).
    - Verify the user-facing copy matches the mapping table's "User-facing copy" column.
    - Verify the error doesn't crash the app or get swallowed silently.
    - Verify Sentry captures the exception with `code` as a tag (so production engine errors are filterable by code in the Sentry dashboard).
    Greenlight → commit.

11. **Sentry tagging.** When `_buildApiException` creates an `ApiException` with a non-null `code`, the Flutter Sentry SDK captures it with `code` as a tag. This is a 2-line addition to `_buildApiException` or to wherever uncaught `ApiException` is reported to Sentry. Worth doing in this ticket because the value of typed errors is observability — without Sentry tagging, the typed error class is just internal cleanliness with no operational payoff.

12. **No old-substring-match dead code remains.** The substring matcher in `routes/sessions.js` is deleted (not commented out). The Flutter substring-match consumer code is replaced by `code` branching with string-match fallback. `grep` for the old substring keywords returns no live matches (only mapping table file + tracker references).

---

## Build steps (after pre-flight + mapping table greenlight)

1. **Update `EngineContractError` shell** in `errors.js` to match the acceptance constructor. Export. Confirm `name` set.

2. **Migrate throw site 1** (lowest-risk site from the mapping table — likely the time-budget validator, which is the most-trafficked and best-understood). Run the existing test-suggestion-engine smoke. Confirm the engine still works end-to-end and the new throw class fires under the same condition.

3. **STOP and report.** Show the migrated throw site + the route handler's reception of it (manually trigger the smoke and paste the JSON response). Wait for Prashob to confirm the shape matches the mapping table.

4. **Migrate remaining 9 throw sites** in one atomic pass. Each migration is a 2-3 line change; total touch is ~30 lines.

5. **Simplify route handler.** Delete the substring ladder. Replace with the simple `instanceof EngineContractError` branch from acceptance #4.

6. **Run engine smoke harness.** Every endpoint that previously emitted an engine error still emits one — but now with the new shape. Confirm zero regressions.

7. **Update Flutter `ApiException`.** Add nullable `String? code`. Update constructor. Verify `flutter analyze` clean.

8. **Update `_buildApiException`.** Read `body['code']`. Pass through.

9. **Migrate Flutter consumers** (≤5 sites). Switch on `exception.code` with defensive fallback to existing substring match.

10. **Add Sentry tagging** in `_buildApiException` or the uncaught-exception path.

11. **Update `docs/API.md`** with the new engine-errors section.

12. **Run smoke harness** (extended for engine error coverage).

13. **STOP. Report. Wait for device verification.**

14. **Commit.** Three commits per PI's ship pattern:
    - **feat**: server + Flutter changes
    - **chore**: trackers + mapping table + docs/API.md
    - Optional **amendment**: any text-hygiene fixes

---

## Rollback plan

This is a cross-stack change. Rollback strategy:

- **Server rollback safe.** If T2 ships and the route handler is broken, `git revert <feat-sha>` on the server brings back the old substring ladder. Old Flutter clients (reading `error` only) continue working immediately. New Flutter clients (which prefer `code` but fall back to `error`) continue working because of the defensive fallback.
- **Flutter rollback safe.** If the Flutter migration causes a UI bug, revert the Flutter portion alone (the changes are on a separate set of files from the server). The server continues emitting `{error, code}`; old Flutter clients reading `error` only is the baseline.
- **No data migration.** No DB. No schema. No background jobs.

The additive-contract pattern means there is no flag day. Both sides can be reverted independently. This is the enterprise reason for choosing additive over breaking.

---

## Definition of done

- [ ] Pre-flight (a)–(g) complete and clean.
- [ ] `Trackers/S16-T2-error-mapping.md` row-by-row approved by Prashob.
- [ ] `EngineContractError` real impl shipped in `errors.js`.
- [ ] All 10 (or whatever pre-flight count is) engine throws migrated.
- [ ] Route handler simplified; substring ladder deleted.
- [ ] Server smoke passes (every engine error condition tested).
- [ ] Flutter `ApiException` carries nullable `code`.
- [ ] `_buildApiException` reads `code`.
- [ ] Flutter consumers migrated to switch on `code` with substring fallback.
- [ ] Sentry tags engine errors by `code`.
- [ ] `docs/API.md` documents new engine-errors contract.
- [ ] `flutter analyze` clean.
- [ ] Device verification complete.
- [ ] feat + chore commits on `s16-t1` chain branch (per PI #20 sprint-chained pattern).
- [ ] PR #4 (the Draft) CI green on the cumulative diff.

---

## File outputs

- **Spec (this file):** `Trackers/S16-T2-typed-engine-errors-spec.md` — committed.
- **Mapping table:** `Trackers/S16-T2-error-mapping.md` — committed (after row-by-row approval).
- **Claude Code prompt:** authored separately, throwaway. SPRINT_TRACKER row will reference: `Spec: Trackers/S16-T2-typed-engine-errors-spec.md`; `Mapping: Trackers/S16-T2-error-mapping.md`; `Prompt: chat-session prompt (throwaway)`.

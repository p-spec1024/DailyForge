# S16-T1 — ApiService Consolidation

**Sprint:** 16 (Engine & API Hardening — Stabilization Part 2)
**Ticket type:** Behavior-preserving refactor
**Priority:** #1 in S16. Gates S16-T2 (typed errors + endpoint-aware timeouts touch the same file).
**Estimated time:** 2–3 days solo dev
**Touches:** `app/lib/services/api_service.dart` (primary), every other file under `app/lib/services/` (incidental verification only)
**`.5`-suffix risk:** Medium. Eleven downstream services consume `ApiService`. Any unintentional semantic drift in exception ladder, header construction, or 401 handling breaks the app silently in the wild. Mitigated by mandatory pre-flight consumer enumeration + smoke verification on Android device before commit.

---

## Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding #30. ChatGPT code review §5.2.

Quoted: *"`ApiService.getList()` is a parallel code path with its own try/catch ladder. Two paths drift over time. `_send()` already exists; `getList` should share it."*

Related findings folded in:
- FS #107 (✅ shipped Apr 24, 2026) — `ClientException` is rewrapped in both `_send` and `getList` today. Consolidation makes the rewrap canonical, not duplicated.
- FS #196 (✅ resolved S15-T1) — `/api` convention is locked. No path-prefix work needed here.

Explicitly NOT in scope:
- FS #166 typed engine errors — that's S16-T2.
- FS #209 timeout bump + endpoint-aware timeouts — that's S16-T2.
- Timeout copy fix ("Check your connection" → "DailyForge took too long…") — that's S16-T2.

---

## Problem

`app/lib/services/api_service.dart` has two parallel HTTP execution paths:

1. **`_send(...)`** — used by `get()`, `post()`, `put()`, `delete()`. Wraps the HTTP call with: JWT header build → timeout → status check → exception translation (`UnauthorizedException` / `TimeoutApiException` / `NetworkException` / `ApiException`) → JSON parse → `Map<String, dynamic>` return.

2. **`getList(...)`** — used directly by services that need `List<dynamic>` responses. Has its own try/catch ladder, its own timeout call, its own 401 handling, its own `ClientException` rewrap.

Both paths do the same work. Both implement the same exception ladder. Both handle 401 the same way. The duplication means:

- **Drift risk.** A defensive fix landed in `_send` (e.g. the FS #107 `ClientException` catch) had to be manually mirrored in `getList`. The next defensive fix will too. Eventually one of them will be missed.
- **Test surface doubled.** Every behavioral assertion (401 → logout, timeout → typed exception, network failure → typed exception) has to be made twice — once per path — to be honest. Today neither path is tested.
- **Cognitive cost.** A new service author has to know which method to call to get which response shape, AND has to trust that both paths behave identically.

The fix is small: introduce a private `_sendRaw()` that returns the raw `http.Response` after exception translation; rebuild `get/getList/post/put/delete` as thin wrappers on top of it. Single ladder, single 401 path, single timeout, single rewrap.

---

## Acceptance criteria

1. **Single execution core.** `_sendRaw(method, path, {body, withAuth})` returns `http.Response` after applying: header build, timeout, 401 handling (deleteToken/deleteUser/onUnauthorized callback + `UnauthorizedException` throw), and infrastructure-error rewrap (`TimeoutException` → `TimeoutApiException`; `SocketException` / `HttpException` / `http.ClientException` → `NetworkException`). Non-2xx and non-401 responses continue to bubble as `http.Response` so wrappers can construct `ApiException` with the appropriate message. The 401 branch stays in `_sendRaw` because it has side effects (token/user delete + callback fire) that must run regardless of which wrapper called.

2. **Five thin wrappers.** `get(path)`, `post(path, body, {withAuth})`, `put(path, body)`, `delete(path)` each call `_sendRaw` and decode `json.decode(response.body)` as `Map<String, dynamic>`. `getList(path)` calls `_sendRaw` and decodes as `List<dynamic>`. Each wrapper's body is ≤10 LOC. Each wrapper handles its own non-2xx → `ApiException` mapping after the `_sendRaw` call returns (so the error-message extraction stays close to the JSON-shape decision).

3. **Public method signatures unchanged.** Every call site under `app/lib/services/` continues to compile without edit. Return types unchanged. Exception types thrown unchanged. The point of this refactor is internal — call sites must not feel it.

4. **`_kRequestTimeout` unchanged at 15s.** Timeout work is S16-T2. T1 preserves the current 15-second flat timeout exactly as it stands at line 9 today. Changing it here would entangle two reviews.

5. **Method body LOC budget.** `_sendRaw` ≤60 LOC. The total file LOC after consolidation should drop relative to the pre-refactor version (current file ≈220 LOC; target ≤200 LOC). LOC reduction is an output, not a goal — don't compress for the metric.

6. **No new dependencies.** `package:http`, `dart:convert`, `dart:io`, `dart:async` — same imports as today. No fold-in of `dio`, `retrofit`, or other HTTP libraries. That's a different conversation.

7. **Smoke verification.** A focused smoke run touches at least one endpoint per wrapper:
   - `get` → `GET /api/users/me/pillar-levels` (HomeService path or similar)
   - `getList` → `GET /api/breathwork-techniques` or any List-returning endpoint
   - `post` → `POST /api/auth/login` (no auth) and `POST /api/sessions/suggest` (with auth)
   - `put` → any settings endpoint with PUT
   - `delete` → any soft-delete endpoint
   The smoke script lives in `server/scripts/` as a node script that hits the staging API and asserts response shape (since this is a client refactor, the server smoke is a sanity check that the same endpoints still respond correctly). It does NOT exercise the Flutter client directly — that's covered by device verification.

8. **Device verification on Android.** Per PI #6, Claude Code must NOT auto-commit on `flutter analyze` clean. Build → stop → Prashob device-tests the app cold-start → log in → load home → open Strength tab → open Yoga tab → open Breathwork tab → trigger a `/suggest` call → verify no regression in error handling (force airplane mode mid-session; confirm "Check your connection" copy still fires as before, since timeout copy fix is S16-T2). Greenlight → commit.

9. **Documentation refresh.** `docs/ARCHITECTURE.md` §5.3 (the `ApiService` section, lines 387–401) updated to reflect the new `_sendRaw` + 5-wrapper structure. The line `15-second timeout via _kRequestTimeout` retains its FS #209 footnote — S16-T2 will retire that note. The line "`getList(path)` (list response — a separate code path for list endpoints)" gets rewritten: `getList(path)` (list response — thin wrapper over `_sendRaw` with `List<dynamic>` decode).

---

## Pre-flight diagnostics (per PI #14)

Before writing any code, halt-on-drift verification:

**(a) Live `ApiService` file shape.** `view app/lib/services/api_service.dart` end-to-end. Report:
- Exact line numbers of `_send` start, `getList` start, `get` / `post` / `put` / `delete` definitions.
- The exception-translation ladder in `_send` (verify `TimeoutException` → `TimeoutApiException`, `SocketException` / `HttpException` / `ClientException` → `NetworkException`, 401 → `UnauthorizedException` + side effects).
- Whether `getList`'s ladder is identical, or has drifted. If drifted, document the divergence row-by-row in the build report — every divergence is a decision (is the drift a bug fix in one path that should propagate, or a bug in one path that should retire?).
- Whether any other private method (`_getHeaders`, `_handle401`, etc.) currently exists. If so, the new structure preserves them or absorbs them — document the call.

**(b) Consumer call-site inventory.** `grep -rn "_apiService\.\(get\|getList\|post\|put\|delete\)" app/lib/` to enumerate every call site. Build a table:

| Service file | Method called | Path | Notes |
|---|---|---|---|

Save to `Trackers/S16-T1-consumers.md` (committed as part of the chore commit, not the feat commit — it's a reference document, not production code).

**(c) `getList` consumer count.** From (b), count the services that use `getList` specifically. The open question from `SPRINT_16_OUTLINE.md` ("Should `ApiService.getList()` actually remain or fold entirely into `get()` with type signatures?") is **answered now**: `getList` stays as a thin wrapper. Pre-flight (b) data justifies this: folding into `get()` with `<T>` generics would require touching every call site to add type parameters, exploding the blast radius from "1 file" to "11 services." Keep call-site signatures stable. Document this decision in the build report as a resolved open question.

**(d) Exception type imports.** Confirm where `UnauthorizedException`, `TimeoutApiException`, `NetworkException`, `ApiException` are defined. If they're in `api_service.dart` itself, fine. If they're exported separately, the wrappers must re-export them so consumer imports don't break.

**(e) `onUnauthorized` callback wiring.** Confirm `AuthProvider` sets `_apiService.onUnauthorized = ...` somewhere at init. The callback fires from inside `_sendRaw`'s 401 branch — verify no consumer is also catching `UnauthorizedException` and calling logout manually (that would double-fire).

If any pre-flight check surfaces drift from what this spec assumes, **halt and report**. Do not proceed to coding. Likely drift points:
- `getList`'s exception ladder may have one catch that `_send` doesn't (or vice versa) — surface every such divergence as an explicit decision item.
- `_send` may currently take a `withAuth` flag that `getList` doesn't, or vice versa — confirm parity or surface the gap.
- The file may already have helper privates (`_buildHeaders`, `_translateError`) that should be preserved or absorbed.

---

## Build steps (after pre-flight greenlight)

1. **Write `_sendRaw`.** Single method, ≤60 LOC, handles: `_getHeaders` → `http.Client.send` (or per-method calls if the current code uses `http.get`/`http.post` directly) with `_kRequestTimeout.timeout()` → 401 side-effects + throw → infrastructure-error rewrap. Returns `http.Response`.

2. **Rebuild `get`.** Calls `_sendRaw('GET', path, withAuth: true)`. On 2xx, `json.decode(response.body) as Map<String, dynamic>`. On non-2xx, build and throw `ApiException(statusCode, message)` where `message` is the JSON `error` field if present.

3. **Rebuild `getList`.** Same as `get`, but decodes as `List<dynamic>`. Identical error path.

4. **Rebuild `post`.** Calls `_sendRaw('POST', path, body: jsonEncode(body), withAuth: withAuth)`. Same decode + error pattern as `get`.

5. **Rebuild `put`.** Calls `_sendRaw('PUT', path, body: jsonEncode(body), withAuth: true)`. Same pattern.

6. **Rebuild `delete`.** Calls `_sendRaw('DELETE', path, withAuth: true)`. Some delete endpoints return 204 No Content; the wrapper handles `response.body.isEmpty` by returning `<String, dynamic>{}` instead of attempting JSON decode.

7. **Delete the old `_send` method** (or rename `_send` → `_sendRaw` and absorb its body if cleaner) once all 5 wrappers route through `_sendRaw`.

8. **Run `flutter analyze`.** Must come back clean. If any consumer file has a compile error, the public signature drifted — back out the wrapper change for that method and reconcile.

9. **Run smoke script** against staging (per acceptance criterion #7).

10. **Update `docs/ARCHITECTURE.md` §5.3.**

11. **Stop. Report. Wait for Prashob's device-test greenlight before commit.**

---

## Test plan

Manual device verification on Android (wireless ADB):

1. **Cold start + login** — exercises `post('/auth/login', ...)` without auth header. Verify success path.
2. **Home load** — exercises `get('/users/me/pillar-levels')`, `get('/home/...')`, `getList('/focus-areas')` (or similar). Verify all data populates.
3. **Strength tab fetch** — exercises `post('/sessions/suggest', ...)`. Verify suggestion card renders.
4. **Force 401** — manually corrupt the JWT in storage (or wait for natural expiry). Verify next request → logout fires → redirected to login. Confirm `onUnauthorized` callback fires exactly once.
5. **Force timeout** — point staging server at a deliberately slow endpoint OR throttle network to "Slow 3G" via Android dev options. Verify `TimeoutApiException` → "Check your connection" copy (unchanged from today; S16-T2 will fix the copy).
6. **Force network failure** — toggle airplane mode mid-request. Verify `NetworkException` → "Check your connection" copy.
7. **Smoke harness** — `node --env-file=.env scripts/test-apiservice-smoke-s16-t1.js` runs the server-side endpoint sanity check.

Behavioral assertion: every test case above produces the same observable behavior as it did against the `main` branch before the refactor. This is a behavior-preserving change. Any behavior delta is a regression.

S16-T3 (test coverage expansion) will add actual unit tests for:
- `ApiService` 401 clears token + calls unauthorized callback (test #2 from §5.6).
- `ApiConfig` URL joining cannot double `/api` (test #1).

T1 ships without those tests because S16-T3 owns adding them. Don't pre-emptively add them here.

---

## Rollback plan

If consumer breakage is discovered post-merge:

- **Cheap revert.** The refactor is one file (`api_service.dart`) + one doc edit. `git revert <feat-sha>` reverts cleanly. Trackers chore commit is independent and can stay.
- **No data migration.** This is a client-side refactor. No DB, no API contract, no schema. Reverting has zero data implications.
- **Branch chain impact.** S16-T2 sprint-chains off S16-T1 per PI's chained-branch pattern. If T1 reverts, T2 branches off `main` instead and the EngineContractError wiring still works (it's pure server-side). The "endpoint-aware timeouts" sub-piece of T2 needs the `_sendRaw` core to land cleanly; if T1 reverts, T2 absorbs the consolidation step.

---

## Open questions resolved at spec time

1. **Q (from outline): Should `ApiService.getList()` actually remain or fold entirely into `get()` with type signatures?**
   **A: Remain as a thin wrapper.** Folding into `get<T>()` requires touching every call site to specify the type parameter — blast radius explodes from 1 file to 11 services for no behavioral gain. Keep call-site signatures stable; consolidate the core only.

2. **Q: Should `_sendRaw` return `http.Response` or a decoded `dynamic`?**
   **A: `http.Response`.** Returning `dynamic` would force `_sendRaw` to know whether to decode as Map or List, which puts the wrapper-specific decision back into the core. Returning `Response` keeps decode at the wrapper, where it belongs.

3. **Q: Should the 401 branch live in `_sendRaw` or in each wrapper?**
   **A: In `_sendRaw`.** The 401 branch has side effects (token delete, user delete, callback fire). Duplicating those side effects across 5 wrappers reintroduces the exact drift this ticket eliminates.

4. **Q: Does the `withAuth: false` path (only used by `post('/auth/login')` and `post('/auth/register')`) need any special handling in `_sendRaw`?**
   **A: Pass `withAuth` through to `_getHeaders`.** `_getHeaders` already knows to skip the Bearer token when `withAuth=false`. `_sendRaw` does not branch on auth state; it delegates to `_getHeaders`.

---

## Definition of done

- [ ] Pre-flight passed (or surfaced drift was reconciled before code).
- [ ] `_sendRaw` written, ≤60 LOC.
- [ ] `get`, `getList`, `post`, `put`, `delete` rebuilt as ≤10 LOC wrappers each.
- [ ] `flutter analyze` clean.
- [ ] Smoke script passes against staging.
- [ ] Manual device verification on Android complete (7 test cases above).
- [ ] `docs/ARCHITECTURE.md` §5.3 updated.
- [ ] `Trackers/S16-T1-consumers.md` reference document committed.
- [ ] `SPRINT_TRACKER.md` row updated to ✅ Shipped with feat + chore SHAs.
- [ ] `CHATGPT_REVIEW_TRACEABILITY.md` row for finding #30 marked `Shipped [<date>, <sha>]`.

---

## File outputs

- **Spec (this file):** `Trackers/S16-T1-apiservice-consolidation-spec.md` — committed.
- **Claude Code prompt:** Authored separately, delivered as throwaway markdown via the chat session. Not committed. Per PI §"Spec-First, Then Prompt", the prompt is mechanical execution referencing this spec for product judgment. SPRINT_TRACKER row will reference: `Spec: Trackers/S16-T1-apiservice-consolidation-spec.md`; `Prompt: chat-session prompt (throwaway)`.

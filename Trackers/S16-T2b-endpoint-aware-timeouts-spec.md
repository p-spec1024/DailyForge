# S16-T2b — Endpoint-Aware Timeouts + Timeout Copy Fix

**Sprint:** 16 (Engine & API Hardening — Stabilization Part 2)
**Ticket type:** Cross-stack policy update. Additive on the wire. Touches the same `_sendRaw` surface introduced in S16-T1.
**Priority:** Closes out the ApiService hardening work started in T1/T2. After T2b, the `ApiService` is "done" for Sprint 16 and the focus shifts to test coverage (T3) and large-file splits (T4-T6).
**Estimated time:** 1 day.
**Touches:**
- `app/lib/services/api_config.dart` (per-endpoint timeout map + default + lookup helper)
- `app/lib/services/api_service.dart` (`_sendRaw` reads timeout per request)
- `app/lib/services/suggest_service.dart` (consumer copy update — differentiates timeout vs network)
- Other consumer sites that render `TimeoutApiException` / `NetworkException` (pre-flight enumerates; expected ≤3)
- `docs/ARCHITECTURE.md` (§5.3 ApiService note: timeout is now endpoint-aware + retires the FS #209 footnote)
- `Trackers/CHATGPT_REVIEW_TRACEABILITY.md` (close any rows that map to FS #209 / timeout work)
- `Trackers/FUTURE_SCOPE.md` (close FS #209)

**`.5`-suffix risk:** Low. Behavior change is opt-in per endpoint (default still 20s, only `/sessions/suggest` and `/sessions/start-from-list` get the 35s override). Copy change is a string swap with no logic implication. The risk surface is small.

---

## Source

- **FS #209** (deferred from S15-T1 / S16-T1) — timeout bump from 15s → 20s default, with longer timeouts for engine-heavy endpoints. The `_kRequestTimeout = Duration(seconds: 15)` constant was noted in S16-T1 as "preserved exactly; timeout work is S16-T2."
- **S16 outline** — listed "endpoint-aware timeouts" alongside typed errors in T2. Split out to T2b during spec authoring to keep T2 scoped to typed errors only.
- **Timeout copy** — pointed out by ChatGPT review (S16 traceability matrix) as misleading user-facing copy. Conflates two distinct failure modes ("server slow" vs "no connection") into the same message.

Out-of-scope items (NOT in T2b):
- Retry policy on timeout (no auto-retry; user must hit Retry button) — separate FS if we decide to do it.
- Endpoint timing instrumentation (no per-endpoint latency tracking added) — Sentry transaction traces already provide this.
- Adaptive timeouts (no "if user's last few requests took 8s, bump default to 30s") — over-engineered for current scale.

---

## Problem

`app/lib/services/api_service.dart` currently uses a **single** 15-second timeout for every API call:

```dart
static const Duration _kRequestTimeout = Duration(seconds: 15);
```

`_sendRaw` wraps every `http.get/post/put/delete` with `.timeout(_kRequestTimeout)`. Per S16-T1 pre-flight, this constant is used uniformly across all 5 HTTP wrappers.

Two problems:

**1. 15s is wrong for engine-heavy endpoints.** `POST /api/sessions/suggest` runs the engine recipe (per-pillar exercise selection, recency overlap checks, multi-phase orchestration). For a beginner user with no history this is fast (~2s); for a power user with 200+ sessions of history and complex focus combinations, it can legitimately take 20+ seconds. The 15s ceiling means these requests time out and the user sees an error even though the server eventually would have responded successfully.

`POST /api/sessions/start-from-list` is similar — the engine resolves the focus, validates the user's saved routine list, and assembles the response.

**2. The timeout error message is misleading.** Today, both `TimeoutApiException` (request exceeded the timeout) and `NetworkException` (couldn't reach the server at all — `SocketException` / `HttpException` / `ClientException`) surface to the user via the same "Check your connection and try again." copy.

These are two distinct failure modes with different user actions:
- **Timeout**: server is reachable but slow → user should wait and retry.
- **Network failure**: server is unreachable → user should check WiFi / data / airplane mode.

Showing the same message for both is misleading. A user on perfectly fine WiFi sees "Check your connection" and confusingly looks at their router.

---

## Solution

**Part A: Per-endpoint timeout policy.**

Add a `Map<String, Duration>` to `ApiConfig` that maps path strings to timeout overrides. Add a `defaultTimeout` constant. Add a `timeoutFor(path)` helper that returns the override if present, else the default.

```dart
class ApiConfig {
  static const String baseUrl = ...;

  static const Duration defaultTimeout = Duration(seconds: 20);

  static const Map<String, Duration> _endpointTimeouts = {
    '/sessions/suggest': Duration(seconds: 35),
    '/sessions/start-from-list': Duration(seconds: 35),
  };

  static Duration timeoutFor(String path) =>
      _endpointTimeouts[path] ?? defaultTimeout;
}
```

`_sendRaw` reads the timeout per request:

```dart
Future<http.Response> _sendRaw(String method, String path, {Object? body, bool withAuth = true}) async {
  final timeout = ApiConfig.timeoutFor(path);
  // ... rest unchanged, swap _kRequestTimeout → timeout ...
}
```

Old `_kRequestTimeout` constant is deleted.

**Design notes:**
- **Exact match.** The map keys are full paths exactly as they appear in `ApiConfig` constants. No prefix matching, no regex. Adding a new slow endpoint requires deliberately adding it to the map. Slowness is opt-in.
- **Default is 20s, not 15s.** S16-T1 preserved 15s for behavior-invariance. T2b bumps the default to 20s because 15s was always tight for the entire app. The bump is small enough that no endpoint that worked at 15s will be broken at 20s.
- **Engine endpoints get 35s.** Generous. Sentry transaction data is too sparse (5 users, ~weeks of data) to calibrate empirically. 35s covers the legitimately-slow tail without inviting users to wait indefinitely on a truly broken request.

**Part B: Timeout copy differentiation.**

The Flutter consumer code paths that currently show "Check your connection and try again." need to branch on exception type:

```dart
if (exception is TimeoutApiException) {
  showError('DailyForge took too long to respond. Please try again.');
} else if (exception is NetworkException) {
  showError('Check your connection and try again.');
}
```

The specific consumer sites are identified in pre-flight (b). Expected count: 1 main site (`suggest_service._mapApiException`) + possibly 1-2 provider-level catches that render `e.message` directly.

For provider-level catches that just render `e.message`, we can either (i) update them to branch on type, or (ii) update the `TimeoutApiException` constructor's default message string so the existing `e.message`-render path naturally shows the new copy. Option (ii) is cleaner — fewer touchpoints, the type already carries the right semantics. Pre-flight (c) determines which.

---

## Pre-flight diagnostics (per PI #14)

### (a) Live `_kRequestTimeout` usage in `api_service.dart`

`view app/lib/services/api_service.dart`. Report:
- Exact line number of `_kRequestTimeout` definition (S16-T1 pre-flight said line 9).
- Every reference to `_kRequestTimeout` in the file (likely just one — inside `_sendRaw`).
- Whether `_sendRaw` accepts a `timeout` parameter today or hardcodes the constant.

Plan: delete the constant, swap its single reference to `ApiConfig.timeoutFor(path)`.

### (b) Consumer sites that render timeout/network errors

`grep -rn "TimeoutApiException\|NetworkException\|Check your connection" app/lib/`

Report every match with file + line + surrounding context (3-5 lines).

For each match, classify:
- **Type A:** branches on exception type already (`if (e is TimeoutApiException)`) — update copy in place.
- **Type B:** renders `e.message` directly without branching — update the exception's default message OR add type branching here, whichever is cleaner per site.
- **Type C:** test files or fixture files referencing these — likely no change needed; mention in build report.

### (c) `TimeoutApiException` / `NetworkException` class definitions

`view` wherever these are defined (per S16-T1: inside `api_service.dart` lines 11-33).

Report:
- Current constructor signatures.
- Whether they carry a default message string or require the caller to pass one.
- Where `_sendRaw` constructs them (the throw sites in the catch ladder).

For the throw sites: today they pass strings like `'Request timed out after ${timeout.inSeconds} seconds'`. Plan: keep the throw-site message technical (for logs / Sentry), but update the *user-facing* copy at the consumer layer.

This separation matters: Sentry events tagged with `TimeoutApiException` should carry technical detail (timeout value, endpoint path), while users see friendly copy. Don't conflate the two.

### (d) `ApiConfig` current shape

`view app/lib/services/api_config.dart`. Report:
- Current fields and methods.
- Whether it's a class with static members or a singleton.
- The `baseUrl` mechanism (env-var, dart-define, etc).

Plan: add `defaultTimeout`, `_endpointTimeouts` (private const map), and `timeoutFor(path)` method. Match existing style.

### (e) Path constants used by the slow endpoints

`grep -n "/sessions/suggest\|/sessions/start-from-list" app/lib/services/api_config.dart`

Confirm the path constants exist and match exactly what will be the map keys. If `ApiConfig.sessionsSuggest = '/sessions/suggest'`, the map key must be `'/sessions/suggest'` (NOT `'sessions/suggest'` or `'/api/sessions/suggest'` — per S16-T1, `/api` lives in `baseUrl` and is not part of endpoint paths).

If the constants don't match, halt and reconcile.

### (f) Sentry tagging for timeout events

`grep -n "TimeoutApiException\|engine_code\|http_status\|setTag" app/lib/services/api_service.dart`

S16-T2 added Sentry tagging for `engine_code` and `http_status`. For T2b, when a `TimeoutApiException` is captured by Sentry (uncaught path), it would be useful to tag the event with `timeout_seconds` and `endpoint_path`. Confirm whether the existing `beforeSend` hook can be extended additively without breaking the engine_code tag.

Plan: add 2 more tags inside the existing `beforeSend` hook. Net +4 LOC.

### Pre-flight greenlight

Standard one-paragraph summary:
- **Clean** → proceed.
- **Drift** → list, halt.

---

## Acceptance criteria

1. **`ApiConfig` carries the timeout policy.** `defaultTimeout` const, `_endpointTimeouts` const map (private), `timeoutFor(path)` public static method. No other class knows the timeout values.

2. **`_sendRaw` is endpoint-aware.** Reads `ApiConfig.timeoutFor(path)` per request. Old `_kRequestTimeout` constant deleted.

3. **Engine endpoints get 35s.** `/sessions/suggest` and `/sessions/start-from-list` are in the map with `Duration(seconds: 35)`. All other endpoints use the default 20s.

4. **Default bumped 15s → 20s.** Justification documented inline. Smoke harness verifies the 20s timeout fires on a deliberately-slow request (e.g. by hitting a staging endpoint that sleeps via a test header, if available; otherwise verify via code inspection only).

5. **Timeout copy differentiated.** User-facing copy in consumer sites:
   - `TimeoutApiException` → "DailyForge took too long to respond. Please try again."
   - `NetworkException` → "Check your connection and try again." (unchanged)
   
   The change lands at whichever layer makes the copy land in front of users — could be the exception's default message string, could be the consumer's branching code. Pre-flight (b) and (c) determine the cleanest place.

6. **Sentry tags for timeout events.** When a `TimeoutApiException` reaches Sentry (uncaught path), the event has tags:
   - `timeout_seconds`: integer (the timeout value that was exceeded, e.g. 35)
   - `endpoint_path`: string (the path that timed out, e.g. `/sessions/suggest`)
   
   Plus the existing `http_status` tag (which for timeouts will be a synthetic `0` or omitted — exception fires before status is known; pick a convention and stick with it).

7. **Smoke harness passes.** Either extend `test-engine-errors-s16-t2.js` or write a small `test-timeouts-s16-t2b.js` that:
   - Hits `/sessions/suggest` with a valid payload — succeeds within 35s.
   - (Optionally) Triggers a deliberately-slow response (if staging exposes a test header or `?delay=ms` param) — verifies the new timeout fires.
   - Hits `/auth/login` — succeeds within 20s.
   
   If no slow-request mechanism is exposed, skip the timeout-fire test and rely on `flutter analyze` + manual review of the `_sendRaw` change. Document the gap.

8. **`flutter analyze` clean.**

9. **`docs/ARCHITECTURE.md` §5.3 updated.**
   - The line "15-second timeout via _kRequestTimeout (FS #209: bump to 20s + endpoint-aware in S16-T2)" is updated to "20s default + 35s for engine endpoints, configured via `ApiConfig.timeoutFor(path)` (closes FS #209)."
   - FS #209 footnote is retired.

10. **FS #209 closed.** Marked `✅ CLOSED — shipped as S16-T2b, <date>, <feat-sha>` in `FUTURE_SCOPE.md`.

11. **Device verification on Android.**
    - Trigger an engine request (open Home → pick a focus → suggestion loads). Should complete in well under 35s for the test user.
    - Toggle airplane mode mid-request. Should see "Check your connection and try again." copy. (Tests the `NetworkException` path; copy unchanged.)
    - If staging exposes a slow-response mechanism, trigger a 30s-response. Should see "DailyForge took too long to respond. Please try again." copy. (Tests the `TimeoutApiException` path with new copy.)
    - If no slow-response mechanism, skip the timeout-copy test on-device and rely on code review of the change.

---

## Build steps

1. **Pre-flight (a)–(f).** Standard halt-on-drift.

2. **Update `ApiConfig`.** Add `defaultTimeout`, `_endpointTimeouts`, `timeoutFor(path)`. No other changes.

3. **Update `_sendRaw`.** Swap `_kRequestTimeout` reference for `ApiConfig.timeoutFor(path)`. Delete the old constant. Verify `flutter analyze` clean.

4. **Update Sentry tagging in `beforeSend`.** Add `timeout_seconds` + `endpoint_path` tags when the exception is `TimeoutApiException`. Existing tags (`engine_code`, `http_status`) stay.

5. **STOP and report.** Show the new `ApiConfig` shape + the `_sendRaw` diff + the `beforeSend` diff. Wait for greenlight before consumer updates.

6. **Update consumer copy.** Per pre-flight (b) findings — either update exception default messages OR update consumer branching, whichever is cleaner per site. Most likely: 1 update in `suggest_service.dart` + 1 update in `TimeoutApiException` default message string.

7. **Smoke harness (extension or new).** Run against staging.

8. **`docs/ARCHITECTURE.md` §5.3 + tracker updates.**

9. **STOP and report.** Final diff + smoke output. Wait for device verification.

10. **Commit + push.**

---

## Commit messages

**Feat commit:**

```
feat(api): endpoint-aware timeouts + differentiated timeout/network copy

ApiConfig now carries the timeout policy. timeoutFor(path) returns
a per-endpoint override (35s for /sessions/suggest and
/sessions/start-from-list) or the default (20s, bumped from 15s).

_sendRaw reads ApiConfig.timeoutFor(path) per request instead of
the single _kRequestTimeout constant. Engine-heavy requests no
longer hit a misleading 15s ceiling.

User-facing copy now differentiates:
- TimeoutApiException → "DailyForge took too long to respond. Please try again."
- NetworkException → "Check your connection and try again." (unchanged)

Sentry tags timeout events with timeout_seconds and endpoint_path
for filterable observability.

Closes FS #209.

Files changed:
- app/lib/services/api_config.dart (+timeout policy)
- app/lib/services/api_service.dart (_sendRaw reads policy + Sentry tags)
- app/lib/services/suggest_service.dart (copy branching)
- (other consumer sites per pre-flight)
- docs/ARCHITECTURE.md (§5.3)
- server/scripts/test-timeouts-s16-t2b.js (new, if applicable)

Smoke: engine endpoint completes within 35s, default endpoint within 20s.
Device: airplane-mode test confirms NetworkException copy. Timeout copy
verified via code review (no on-device slow-response mechanism available).
flutter analyze: clean.
```

**Chore commit:**

```
chore: update trackers post S16-T2b

- SPRINT_TRACKER.md: S16-T2b row added, ✅ Shipped
- SPRINT_16_OUTLINE.md: T2b status updated
- FUTURE_SCOPE.md: FS #209 → CLOSED
- CHATGPT_REVIEW_TRACEABILITY.md: timeout-related rows → Shipped
```

---

## Rollback plan

- Server: no changes. No revert needed.
- Flutter: `git revert <feat-sha>` reverts `ApiConfig` + `_sendRaw` + consumer sites cleanly. Behavior returns to 15s flat + "Check your connection" copy.
- No data migration, no schema change.

---

## Definition of done

- [ ] Pre-flight (a)–(f) clean.
- [ ] `ApiConfig.timeoutFor(path)` shipped.
- [ ] `_sendRaw` uses `timeoutFor(path)`; old constant deleted.
- [ ] Two engine endpoints have 35s override.
- [ ] Default bumped to 20s.
- [ ] Consumer copy differentiated (timeout vs network).
- [ ] Sentry tags include `timeout_seconds` + `endpoint_path` on timeout events.
- [ ] Smoke passes.
- [ ] `flutter analyze` clean.
- [ ] `docs/ARCHITECTURE.md` §5.3 updated; FS #209 footnote retired.
- [ ] FS #209 closed in `FUTURE_SCOPE.md`.
- [ ] Device verification on Android complete.
- [ ] feat + chore commits on `s16-t1`.
- [ ] PR #4 CI green on cumulative diff.

---

## File outputs

- **Spec (this file):** `Trackers/S16-T2b-endpoint-aware-timeouts-spec.md` — committed.
- **Claude Code prompt:** throwaway, delivered as markdown in chat. Not committed.

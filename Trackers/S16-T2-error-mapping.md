# S16-T2 Engine Error Mapping — DRAFT for review

**Status:** Awaiting row-by-row approval from Prashob.
**Source:** Pre-flight (b) of S16-T2 prompt, run on 2026-05-19.
**Approval gate:** No engine throws may be migrated until every row below is approved.

---

## Scope reconciliation

- **Throws in scope (contract throws caught by `routes/sessions.js` `instanceof RangeError`):** 10. All migrated to `EngineContractError` in this ticket.
- **Throws NOT in scope (internal invariants, fall through to 500):**
  - `throw new TypeError(...)` × 3 (`index.js:72, 75, 78, 122` — identity validation on `user_id` / `focus_slug` / `entry_point` / `time_budget_min`). The route already validates these upstream; the engine throws are defense-in-depth for non-route callers.
  - `throw new Error(...)` × 17 (`helpers.js:37,116`, `index.js:144`, `pickers.js:138`, `cross-pillar.js:64,116,238,278,317,374,405,442`, `state-focus.js:100,117,142`, `strength-only.js:48,59,96`, `yoga-only.js:58,101,189,273`). Internal data integrity failures (e.g. "Unknown level", "No muscle keywords", "Unhandled entry_point"). Not user-recoverable; correctly surface as 500.
- **Route-handler reconciliation:** all 5 substring branches in `mapRangeErrorToCode` map 1-to-many onto the 10 throws. No dead branches; no unreached throws.

---

## Mapping table

| # | File | Line | Current throw statement | Current message string | Proposed `code` | Proposed `details` | Notes / context |
|---|---|---|---|---|---|---|---|
| 1 | `services/suggestion-engine/index.js` | 83 | `throw new RangeError(\`invalid bracket value: ${bracket}\`)` | `invalid bracket value: <bracket>` | `INVALID_BRACKET` | `{ given: bracket, valid: ['0-10','10-20','21-30','30-45','endless'] }` | Fires when state-focus request carries a `bracket` outside the enum. Reachable from `home` and `breathwork_tab` flows. Route already enum-validates `bracket` upstream, so engine throw is defense-in-depth — but reachable if a future surface bypasses the route validator. |
| 2 | `services/suggestion-engine/index.js` | 91-93 | `throw new RangeError('mobility is not available from strength_tab — use yoga_tab or home')` | `mobility is not available from strength_tab — use yoga_tab or home` | `INVALID_FOCUS_ENTRY_COMBO` | `{ focus_slug: 'mobility', entry_point: 'strength_tab', reason: 'mobility_not_in_strength_tab' }` | Dispatch-level guard. Flutter strength-tab picker hides mobility; engine asserts as 2nd line of defense. |
| 3 | `services/suggestion-engine/index.js` | 100-103 | `throw new RangeError(\`state focus '${focus.slug}' is not valid from '${entry_point}'; state focuses are surfaced from 'home' and 'breathwork_tab' only\`)` | `state focus '<slug>' is not valid from '<entry_point>'; state focuses are surfaced from 'home' and 'breathwork_tab' only` | `INVALID_FOCUS_ENTRY_COMBO` | `{ focus_slug, focus_type: 'state', entry_point, reason: 'state_focus_not_in_body_only_tab' }` | State focus called from `strength_tab` or `yoga_tab` (the BODY_ONLY_ENTRY_POINTS set). Pickers hide; engine defends. |
| 4 | `services/suggestion-engine/index.js` | 106 | `throw new RangeError('state focus requires bracket parameter')` | `state focus requires bracket parameter` | `STATE_FOCUS_REQUIRES_BRACKET` | `{ focus_slug }` | State focus called with `bracket == null`. Route also validates this upstream (`body_focus_requires_time_budget` mirror), so reachable only if route validator drifts. |
| 5 | `services/suggestion-engine/index.js` | 115-118 | `throw new RangeError(\`body focus '${focus.slug}' is not valid from 'breathwork_tab'; breathwork_tab supports state focuses only\`)` | `body focus '<slug>' is not valid from 'breathwork_tab'; breathwork_tab supports state focuses only` | `INVALID_FOCUS_ENTRY_COMBO` | `{ focus_slug, focus_type: 'body', entry_point: 'breathwork_tab', reason: 'body_focus_in_breathwork_tab' }` | Body focus called from `breathwork_tab`. Pickers hide; engine defends. |
| 6 | `services/suggestion-engine/index.js` | 127-130 | `throw new RangeError(\`time_budget_min ${time_budget_min} not valid for entry_point '${entry_point}'; valid: ${...}\`)` | `time_budget_min <N> not valid for entry_point '<entry_point>'; valid: <list>` | `INVALID_TIME_BUDGET` | `{ given: time_budget_min, entry_point, valid: VALID_BUDGETS_BY_ENTRY[entry_point] }` | Top-level per-entry budget enum check. **Primary budget throw** — reachable through route on all body-focus paths when budget doesn't match the entry-specific allowed set. |
| 7 | `services/suggestion-engine/recipes/cross-pillar.js` | 44 | `throw new RangeError(\`time_budget_min must be 30 or 60 for home entry; got ${timeBudget}\`)` | `time_budget_min must be 30 or 60 for home entry; got <N>` | `INVALID_TIME_BUDGET` | `{ given: timeBudget, entry_point: 'home', valid: [30, 60] }` | Recipe-level defense. Unreachable through `/api/sessions/suggest` because throw #6 fires first. Exists for direct-engine callers (smoke harness, future surfaces). |
| 8 | `services/suggestion-engine/recipes/strength-only.js` | 23 | `throw new RangeError(\`time_budget_min must be 30 or 60 for strength_tab entry; got ${timeBudget}\`)` | `time_budget_min must be 30 or 60 for strength_tab entry; got <N>` | `INVALID_TIME_BUDGET` | `{ given: timeBudget, entry_point: 'strength_tab', valid: [30, 60] }` | Recipe-level defense; unreachable through route. |
| 9 | `services/suggestion-engine/recipes/strength-only.js` | 30-32 | `throw new RangeError('mobility is not available from strength_tab — use yoga_tab or home')` | `mobility is not available from strength_tab — use yoga_tab or home` | `INVALID_FOCUS_ENTRY_COMBO` | `{ focus_slug: 'mobility', entry_point: 'strength_tab', reason: 'mobility_not_in_strength_tab' }` | Recipe-level defense. Throw #2 fires first through dispatch. Mirror exists per the inline comment so a future dispatch reorder doesn't silently fall through to "No muscle keywords" path. |
| 10 | `services/suggestion-engine/recipes/yoga-only.js` | 39 | `throw new RangeError(\`time_budget_min must be 15/30/45/60 for yoga_tab entry; got ${timeBudget}\`)` | `time_budget_min must be 15/30/45/60 for yoga_tab entry; got <N>` | `INVALID_TIME_BUDGET` | `{ given: timeBudget, entry_point: 'yoga_tab', valid: [15, 30, 45, 60] }` | Recipe-level defense; unreachable through route. |

**Total: 10 throws → 3 distinct codes + 1 standalone code = 4 codes shipped on the wire:**
- `INVALID_BRACKET` (1 throw)
- `INVALID_FOCUS_ENTRY_COMBO` (4 throws — #2, #3, #5, #9)
- `INVALID_TIME_BUDGET` (4 throws — #6, #7, #8, #10)
- `STATE_FOCUS_REQUIRES_BRACKET` (1 throw)

This matches the existing 4 Flutter exception classes in `suggest_service.dart` (`InvalidBracketException`, `InvalidFocusEntryComboException`, `InvalidTimeBudgetException`, `StateFocusRequiresBracketException`) 1-to-1 — so Flutter consumer churn is minimal. The `details` field carries the disambiguation for any future caller that needs finer behavior.

---

## Backward-compatibility decision (per spec acceptance #5)

**Proposed:** `err.message` set to the **exact legacy lowercase code string** (e.g. `'invalid_bracket'`, `'state_focus_requires_bracket'`, `'invalid_focus_entry_combo'`, `'invalid_time_budget'`). Route emits `{ error: err.message, code: err.code, details: err.details }`. Old APKs continue to see `{error: 'invalid_bracket'}` byte-identical to today, and their existing equality matcher in `suggest_service.dart:64-83` keeps working. New APKs read `code` (SCREAMING form) and ignore `error`.

**Trade-off:** server logs / Sentry will see `err.message = 'invalid_bracket'` (lowercase code, not a human sentence). That's slightly ugly for log readability. Mitigation: the Sentry `engine_code` tag carries the SCREAMING form, and the `details` field carries rich context. Devs reading logs lose the "human sentence" affordance but gain perfect Flutter backward-compat.

**Alternative not taken:** set `err.message` to a human sentence (e.g. `'Bracket "99" is not allowed. Use one of: 0-10, 10-20, ...'`). This breaks old-Flutter equality match. Old APKs would render `EngineError` generic copy ("Couldn't generate a session right now") instead of the case-specific copy. Acceptable per spec, but unnecessary loss of UX on old APKs when the safer alternative is one line.

**Prashob decision needed:** approve this trade-off, or override on specific rows where human-sentence is preferred.

---

## User-facing copy (Prashob to fill in)

The Flutter consumer copy currently lives in `suggest_service.dart` `userFacingMessage` getters on each exception class. After T2, the consumer switches on `exception.code` and shows these strings. The legacy exception classes already carry copy — listed here for confirmation, not invention.

| # | code | Current Flutter copy (from `SuggestServiceException` subclasses) | Approve? |
|---|---|---|---|
| 1 | `INVALID_BRACKET` | _none defined — falls to `SuggestServiceException.userFacingMessage` = "Something went wrong. Please report."_ | _Prashob: keep, or write new copy?_ |
| 2 | `INVALID_FOCUS_ENTRY_COMBO` | _none defined — falls to `SuggestServiceException` default_ | _Prashob: keep, or write new copy?_ |
| 3 | `INVALID_TIME_BUDGET` | _none defined — falls to default_ | _Prashob: keep, or write new copy?_ |
| 4 | `STATE_FOCUS_REQUIRES_BRACKET` | _none defined — falls to default_ | _Prashob: keep, or write new copy?_ |

Observation: the current Flutter exception classes are typed-but-copy-less — they all use the generic default "Something went wrong. Please report." This is a UX hygiene opportunity worth taking in T2 (free since we're already touching the consumer). Recommend: write 1-line user copy per code now.

---

## Code naming rules

SCREAMING_SNAKE_CASE, ≤4 words, describe condition not verb, no tense, no abbreviations.

All 4 proposed codes satisfy these rules:
- `INVALID_BRACKET` (2 words, condition, no tense)
- `INVALID_FOCUS_ENTRY_COMBO` (4 words, condition, no tense)
- `INVALID_TIME_BUDGET` (3 words, condition, no tense)
- `STATE_FOCUS_REQUIRES_BRACKET` (4 words, condition — "requires" is the constraint relationship, not a verb tense)

See spec §"Code naming rules" for full rules + reference enums.

---

## Out-of-scope clarification

Not in this ticket (deferred to S16-T2b / T2c / T4):
- Endpoint-aware timeouts on `ApiService`.
- Timeout copy fix.
- Engine cleanups (`fitMainCandidate`, `MOBILITY_MAIN_STYLES`, recency Sentry wiring).
- API versioning.
- Engine file splits.

Not touched in this ticket (different error surface):
- `routes/sessions.js` `/start-from-list` endpoint route-level validation codes (`unsupported_session_type`, `invalid_exercises`, etc.). These are not engine RangeError throws; the `_friendlyError` helper in `session_launcher.dart:407` handles them and stays as-is.
- `routes/sessions.js` `/suggest` upstream validators (`invalid_focus_slug`, `invalid_entry_point`, `unknown_focus_slug`, `body_focus_requires_time_budget`). These return their own `{error: '...'}` directly without going through the engine catch block.

# S12-T5 — Recency Warning Logic Spec

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 29, 2026
**Version:** v1
**Status:** DRAFT pending Prashob review of Decisions 1, 2, 3, 5. Locks on greenlight.
**Depends on:** S12-T1 (`focus_overlaps` table seeded, `sessions.focus_slug` column added), S12-T2 (body-focus recipes), S12-T3.5 (state-focus recipe), S12-T4 (mobility/full_body branches) — all shipped.
**Branch:** `s12-t5` off `s12-t4`
**Blocks:** S12-T7 (HTTP surface — `POST /api/sessions/suggest` returns `warnings` populated)

---

## Why this ticket exists

The engine's response shape has carried a `warnings: []` array since T2, and every body-focus recipe has `RECENCY OVERLAP CHECK` as Step 1 — but it's a no-op stub. T5 makes it real:

1. **Detection** — query the user's last calendar day of completed sessions, intersect against the current focus's overlap-set (`focus_overlaps`), emit `recency_overlap` warning when matched.
2. **Persistence** — wire `focus_slug` writes into the session-creation paths so today's session is tomorrow's recency input. Without this, the detection query reads NULL forever.

The detection logic is mechanical SQL (single `EXISTS` with two clauses) lifted directly from the spec. The interesting work in T5 is the **persistence wiring**: deciding what counts as a "session" for recency purposes, and ensuring all three pillar-finish paths plus the future cross-pillar finish path persist `focus_slug` consistently.

---

## What's in scope

| Surface | T5 work |
|---------|---------|
| `checkRecencyOverlap(userId, focusSlug)` engine helper | New, exported. Returns warning object or `null`. |
| `generateCrossPillar*` (body focus from `home`) | Step 1 wired — adds warning to response if helper returns non-null. |
| `generateStrengthOnly*` (body focus from `strength_tab`) | Step 1 wired. |
| `generateYogaOnly*` (body focus from `yoga_tab`) | Step 1 wired. |
| `generateStateFocus` (state focus from anywhere) | **Not wired** — spec line 443: "RECENCY OVERLAP CHECK — DOES NOT APPLY to state focuses." Helper not called on this path. |
| Session-creation/finish handlers | `focus_slug` written. See §Persistence Wiring for which surfaces. |
| `focus_overlaps` seed verification | Pre-flight diagnostic confirms the 12 hand-asserted pairs match live data. |
| Smoke harness (`scripts/test-suggestion-engine-t2.js`) | Extended with recency block — fixture insert / engine call / warning assertion / cleanup. |

## What's out of scope

| Item | Why out, where it goes |
|------|------------------------|
| State-focus recency | Spec rule. Locked — state focuses are explicitly excluded from this check. |
| Anti-recency exercise filtering ("don't suggest barbell squat 3 days running") | Already in FUTURE_SCOPE post-Sprint-12 followup #3. |
| Periodization / fatigue modeling | FUTURE_SCOPE post-Sprint-12 followups #4 and #5. |
| UI rendering of the warning | Sprint 13 home-page work. T5 emits the warning; Flutter consumes it later. |
| Backfilling historical `sessions` rows with `focus_slug` | Spec line 578: "existing rows stay NULL." Locked. |
| `breathwork_sessions.focus_slug` column add | State focuses don't fire recency, so the column isn't needed for this rule. If a future ticket wants breathwork-only recency analytics, that's a separate add. |

---

## Decisions to lock (Apr 29 review)

| # | Decision | Recommendation | Rationale |
|---|----------|----------------|-----------|
| 1 | **Recency window source — which session tables count?** | **UNION of `sessions`, `yoga_sessions`, `breathwork_sessions`** (each contributing `(focus_slug, date)` rows where `focus_slug IS NOT NULL` and `completed = true` and `date` is in the window). | If a user did a yoga-tab biceps session yesterday, that row lands in `yoga_sessions` (per Sprint 9 architecture), not `sessions`. A user who plans `biceps` two days running deserves the warning regardless of which entry point each session came from. UNION is one extra query block, no schema work, surgical. **Alternative considered & rejected:** require `focus_slug` to be a `sessions`-only column and route all entry points to write a parent `sessions` row — that's a Sprint 13+ refactor we don't need today. |
| 2 | **Persistence wiring — at session start or finish?** | **At session start** (when the row is first inserted with `started_at`). The focus_slug is fixed once at planning time and doesn't change mid-session. | The spec phrases it as "wires `sessions.focus_slug` write on session start." Sprint 8 / 9 paths already INSERT a row at start (with `completed=false`) and UPDATE on finish. Adding `focus_slug` to the start-insert is one column in one INSERT statement per pillar. Writing at finish would require carrying focus_slug through the entire in-session state — meaningful surface area for no benefit. |
| 3 | **What about Custom Workouts (`EmptyWorkout`)?** | **Leave `focus_slug = NULL`** — spec line 576 already locks this. EmptyWorkout has no declared focus. NULL rows are filtered out of the recency query. | Already in spec; restating for clarity. |
| 4 | **Cross-pillar finish handler — what does it write?** | **Whatever the engine returned.** The session-suggest payload (T7) returns the `focus_slug` it dispatched on; the cross-pillar finish endpoint persists exactly that string. T5's wiring sketches the contract; T7 ships the HTTP surface that delivers it. | The cross-pillar persistence path doesn't exist as a separate handler today — Sprint 8/9 only have per-pillar finish endpoints. T5 prepares the surface; T7 + Sprint 13 finish-flow rewiring close the loop. See §Persistence Wiring §C. |
| 5 | **Window inclusivity — does "1 calendar day" mean `[yesterday, today]` or `[yesterday]` only?** | **`[yesterday, today]` inclusive (`date >= CURRENT_DATE - INTERVAL '1 day' AND date <= CURRENT_DATE`).** Today's earlier sessions count too. | Matches the spec's literal SQL on line 534. A user who did chest at 7am and is opening the app at 8am to plan triceps deserves the warning *more*, not less, than someone who did chest yesterday. The "1 calendar day" framing is about avoiding 48-hour clock-arithmetic, not about excluding today. **Alternative considered:** strict `[yesterday only]` — explicitly rejected because the same-day case is the higher-value catch. |
| 6 | **Helper return shape on no overlap** | **Return `null`.** Caller does `if (warning) warnings.push(warning)`. | Cheaper than returning `{matched: false}` and unwrapping. JS-idiomatic. |
| 7 | **Warning payload — include `alternative_focus_slug`?** | **Yes, hardcoded to `'recover'` for v1.** | Spec line 560 specifies `alternative_focus_slug`. Personalized alternatives (e.g. "you did chest yesterday → try `mobility` today") need a recommendation model we don't have. `recover` is always-safe. Sprint 13+ can personalize via the same FUTURE_SCOPE personalization-algorithm planning that gates the ranker. |
| 8 | **Multiple yesterday focuses — which one is `yesterday_focus` in the warning payload?** | **The most recent one by `started_at` desc.** If a user did chest in the morning and shoulders in the evening, both would match (both overlap triceps), but the warning names shoulders (the more recent training). | Without a tiebreaker, the warning text would be unstable across runs. "Most recent" is explainable and makes the warning's narrative match what the user remembers most clearly. |

---

## The recency rule — exact restatement

A user is shown a `recency_overlap` warning if **either** of the following is true at the moment they request a session for `currentFocusSlug`:

1. **Same-focus repeat:** there exists a completed session with `focus_slug = currentFocusSlug` whose `date` is in `[CURRENT_DATE - 1, CURRENT_DATE]`.
2. **Adjacent-focus overlap:** there exists a completed session with `focus_slug = X` whose `date` is in the same window, AND `(currentFocusSlug, X)` is in `focus_overlaps`.

The warning fires the first time either clause matches. The session is **still generated** — the warning is informational.

---

## Implementation contract

### File layout

```
server/src/services/suggestionEngine.js            ← exists; add helper + 3 wire points
server/scripts/preflight-s12-t5-overlaps.mjs       ← new; verifies focus_overlaps seed = 12 hand-asserted pairs
server/scripts/test-suggestion-engine-t2.js        ← exists; extend with §Smoke block
server/src/routes/strength.js  (or equivalent)     ← exists; one-line change: include focus_slug in INSERT
server/src/routes/yoga.js      (or equivalent)     ← exists; one-line change
server/src/routes/breathwork.js (or equivalent)    ← exists; one-line change
```

> Claude Code: confirm exact route filenames during the build. The pillar-route layout is from Sprint 8/9 and may have shifted. Names above are illustrative.

### `checkRecencyOverlap` — exported engine helper

```js
/**
 * Returns a recency_overlap warning if the user's last calendar day
 * of completed sessions intersects (same or adjacent) with the
 * focus they're requesting now. Returns null on no overlap.
 *
 * Body focuses only — caller must not invoke this on state focuses.
 *
 * @param {number} userId
 * @param {string} currentFocusSlug   // body focus only
 * @returns {Promise<{type, yesterday_focus, current_focus, message, alternative_focus_slug} | null>}
 */
async function checkRecencyOverlap(userId, currentFocusSlug) { ... }
```

### Detection query (single round-trip)

```sql
WITH window_focuses AS (
  -- Cross-pillar / strength sessions
  SELECT s.focus_slug, s.started_at AS at
  FROM sessions s
  WHERE s.user_id = $1
    AND s.completed = true
    AND s.focus_slug IS NOT NULL
    AND s.date BETWEEN (CURRENT_DATE - INTERVAL '1 day') AND CURRENT_DATE

  UNION ALL

  -- Yoga-tab sessions
  SELECT ys.focus_slug, ys.started_at AS at
  FROM yoga_sessions ys
  WHERE ys.user_id = $1
    AND ys.completed = true
    AND ys.focus_slug IS NOT NULL
    AND ys.date BETWEEN (CURRENT_DATE - INTERVAL '1 day') AND CURRENT_DATE

  UNION ALL

  -- Breathwork-tab sessions (these only carry body-focus slugs in v1 if a body
  -- focus session was somehow logged via the breathwork surface — defensive UNION;
  -- state-focus rows are filtered out by the focus_overlaps join below since
  -- state focuses have no overlap edges)
  SELECT bs.focus_slug, bs.started_at AS at
  FROM breathwork_sessions bs
  WHERE bs.user_id = $1
    AND bs.completed = true
    AND bs.focus_slug IS NOT NULL
    AND bs.date BETWEEN (CURRENT_DATE - INTERVAL '1 day') AND CURRENT_DATE
)
SELECT wf.focus_slug AS yesterday_focus
FROM window_focuses wf
WHERE wf.focus_slug = $2                            -- same-focus repeat
   OR EXISTS (
     SELECT 1
     FROM focus_areas fa1
     JOIN focus_overlaps fo ON fo.focus_id = fa1.id
     JOIN focus_areas fa2  ON fa2.id = fo.overlaps_with_id
     WHERE fa1.slug = $2                            -- current focus
       AND fa2.slug = wf.focus_slug                 -- adjacent focus
   )
ORDER BY wf.at DESC
LIMIT 1;
```

`$1 = userId`, `$2 = currentFocusSlug`. Returns either zero rows (→ helper returns `null`) or one row (→ helper builds the warning).

> **Note on the breathwork_sessions UNION clause:** in v1 nothing actually writes a body-focus slug to `breathwork_sessions` (state focuses go there; body focuses' breathwork bookends live inside parent `sessions` rows). The clause is defensive — included so if a future surface does start writing body focuses to `breathwork_sessions`, the rule keeps working. If `breathwork_sessions` doesn't have a `date` or `started_at` column today, omit this UNION arm and add a TODO comment in the helper pointing at this spec section.

### Warning message construction

```
yesterday_focus = "chest"   (from the query)
current_focus   = "triceps" (the input)

message = `You trained ${pretty(yesterday_focus)} ${dayPhrase} — your ${pretty(current_focus)} were worked too. Consider a recovery focus today.`

dayPhrase = "today"     if yesterday_focus's session date == CURRENT_DATE
          | "yesterday" if date == CURRENT_DATE - 1
```

`pretty(slug)` lowercases human label. Slugs are already human-friendly (`chest`, `triceps`); pass-through is fine in v1. No need for a slug→display map.

For same-focus repeat (yesterday_focus == current_focus), the message simplifies:

```
message = `You trained ${pretty(currentFocus)} ${dayPhrase}. Consider a recovery focus today.`
```

### Wire points in body-focus recipes

In each of `generateCrossPillar*`, `generateStrengthOnly*`, `generateYogaOnly*` (the parent recipe and any sub-recipes from T4) — replace the existing `// TODO recency stub` comment / no-op block with:

```js
const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
if (recencyWarning) warnings.push(recencyWarning);
```

The `warnings` array is already initialized as `[]` at the top of every recipe (T2 contract). No other shape change.

**Mobility / full_body sub-recipes (T4):** these are body focuses; recency applies. The helper is called the same way. Note that `mobility` and `full_body` slugs have **no overlap edges** in `focus_overlaps` per the seed (line 732 of the spec) — the same-focus clause still fires (back-to-back mobility days), but the adjacent clause never matches for them. Correct by design; no special-case code.

### Persistence wiring

Three pillar surfaces today; one cross-pillar surface coming.

#### A. Strength session start (Sprint 8 endpoint)

The handler that creates a new session row (`completed=false`, `started_at=NOW()`) accepts a `focus_slug` field on the request body. If present, INSERT it. If absent (existing in-app paths that haven't been updated yet, e.g. EmptyWorkout, Routine-start), pass NULL.

**One-column addition to the INSERT statement.** No new endpoint, no migration (T1 already added the column).

#### B. Yoga session start (Sprint 9 endpoint)

Yoga's session table is `yoga_sessions` (Sprint 9). T5 adds `focus_slug VARCHAR(40)` to `yoga_sessions` via the same migration block as T1's pattern (idempotent `ADD COLUMN IF NOT EXISTS`), plus the matching index. Update the start-handler INSERT to write it from the request body.

```sql
ALTER TABLE yoga_sessions ADD COLUMN IF NOT EXISTS focus_slug VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_yoga_sessions_user_focus_date
  ON yoga_sessions(user_id, focus_slug, date)
  WHERE completed = true;
```

#### C. Breathwork session start (Sprint 9 endpoint)

Symmetric to yoga:

```sql
ALTER TABLE breathwork_sessions ADD COLUMN IF NOT EXISTS focus_slug VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_breathwork_sessions_user_focus_date
  ON breathwork_sessions(user_id, focus_slug, date)
  WHERE completed = true;
```

**Note:** state-focus sessions running through `breathwork_sessions` will write their state-focus slug here (`calm`, `energize`, etc.). The recency query's `focus_overlaps` join only matches body focuses, so state-focus slugs in `breathwork_sessions` rows are silently filtered out of the warning logic. Persisting them costs nothing and is useful for future analytics.

#### D. Cross-pillar session finish (T7 / Sprint 13 path)

Doesn't exist as its own surface today. The T7 ticket is going to add `POST /api/sessions/suggest`; the matching `POST /api/sessions` finish handler is Sprint 13's session player work. T5 does NOT need to add this surface. Document it as an explicit T5-out-of-scope item in the FUTURE_SCOPE comment block on the engine helper, so reviewers can see the loop's planned closure.

### Pre-flight diagnostic

Following the T3.5 / T4 pattern. Single-script run before smoke. Asserts the spec's 12 hand-listed `focus_overlaps` pairs match live data. Stop the build on disagreement.

```js
// server/scripts/preflight-s12-t5-overlaps.mjs

const SPEC_PAIRS = [
  ['chest', 'triceps'], ['triceps', 'chest'],
  ['chest', 'shoulders'], ['shoulders', 'chest'],
  ['back', 'biceps'], ['biceps', 'back'],
  ['shoulders', 'triceps'], ['triceps', 'shoulders'],
  ['quads', 'glutes'], ['glutes', 'quads'],
  ['glutes', 'hamstrings'], ['hamstrings', 'glutes'],
];
// 12 pairs total. Symmetric except quads<->glutes<->hamstrings (chain, not all symmetric).
// Spec lines 722-732 are authoritative — re-derive this list from the spec at build time.

// Query live data: SELECT fa1.slug, fa2.slug FROM focus_overlaps fo JOIN focus_areas fa1 ... JOIN focus_areas fa2 ...
// Compare set equality. Report missing-from-DB and extra-in-DB separately.
// Throw on any mismatch. Print the reconciliation table either way.
```

The pre-flight is the gate. If it fails, the smoke aborts. T5 does NOT modify the seed — that's S11-T1's territory; T5 only verifies what T1 produced.

---

## Acceptance criteria

T5 ships when:

1. **Pre-flight passes** — `focus_overlaps` live data exactly matches the 12 spec-asserted pairs.
2. **Helper returns null on empty history.** New user, no sessions in window → `checkRecencyOverlap(userId, anyFocus) === null`.
3. **Same-focus repeat fires.** Insert a `sessions` row with `focus_slug='chest', date=CURRENT_DATE-1, completed=true`. Call `checkRecencyOverlap(userId, 'chest')` → returns warning with `yesterday_focus='chest'`, `current_focus='chest'`, `dayPhrase='yesterday'`.
4. **Adjacent-focus fires.** Insert a `sessions` row with `focus_slug='chest', date=CURRENT_DATE, completed=true`. Call `checkRecencyOverlap(userId, 'triceps')` → returns warning with `yesterday_focus='chest'`, `current_focus='triceps'`, `dayPhrase='today'`.
5. **Reverse adjacent-focus fires.** Symmetric: yesterday's `triceps` → today's `chest` → warning fires (because `(triceps, chest)` is in the seed too).
6. **Non-adjacent does not fire.** Insert `focus_slug='chest', date=CURRENT_DATE-1`. Call `checkRecencyOverlap(userId, 'core')` → returns `null` (no overlap edge between chest and core).
7. **`mobility` and `full_body` only fire on same-focus repeat.** Insert `focus_slug='mobility'` yesterday → today's `mobility` request fires; today's `chest` does not.
8. **State focuses are not invoked.** `generateStateFocus` does not call `checkRecencyOverlap`. Smoke asserts the response from a state-focus call has `warnings: []`.
9. **Out-of-window does not fire.** Insert `focus_slug='chest', date=CURRENT_DATE-2, completed=true` → today's `triceps` request returns `warnings: []`.
10. **NULL focus_slug rows are ignored.** Insert `focus_slug=NULL, date=CURRENT_DATE-1` (custom workout pattern) → today's `chest` request returns `warnings: []` (assuming no other session matches).
11. **Incomplete sessions are ignored.** Insert `focus_slug='chest', date=CURRENT_DATE-1, completed=false` → today's `triceps` returns `warnings: []`.
12. **UNION across tables works.** Insert `focus_slug='chest'` into `yoga_sessions` (not `sessions`) for yesterday → today's `triceps` from `home` entry → warning fires.
13. **Most-recent tiebreaker works.** Insert two yesterday sessions, `focus_slug='chest'` at 9am and `focus_slug='shoulders'` at 6pm; both overlap `triceps`. Today's `triceps` request → warning's `yesterday_focus='shoulders'`.
14. **Persistence: strength start endpoint accepts `focus_slug`.** POST a session-start request with body `{focus_slug: 'biceps'}` → row inserted with `focus_slug='biceps'`.
15. **Persistence: yoga and breathwork symmetrically.** Same as #14 for `yoga_sessions` and `breathwork_sessions` after their column adds.
16. **Engine response shape unchanged when no warning.** All existing T2/T3.5/T4 smoke cases continue to pass (no new fields appearing where they weren't before; `warnings: []` is the no-warning state).
17. **`/review` grade ≥ A-.** Per the standard process for logic tickets.

---

## Smoke harness extension

`scripts/test-suggestion-engine-t2.js` (the rolling Sprint 12 harness) gets a new section. Pattern matches T3.5 / T4: try/finally restores DB state, SIGINT/SIGTERM handlers re-restore on abort.

```
T5 RECENCY BLOCK
================
Setup: pick test user, snapshot existing sessions/yoga_sessions/breathwork_sessions counts.
       Wrap entire block in try / finally / signal handlers.

Sub-block 1: empty history baseline       (criterion #2)
Sub-block 2: same-focus repeat            (criterion #3)
Sub-block 3: adjacent forward             (criterion #4)
Sub-block 4: adjacent reverse             (criterion #5)
Sub-block 5: non-adjacent no-fire         (criterion #6)
Sub-block 6: mobility same-focus          (criterion #7a)
Sub-block 7: mobility no-adjacent         (criterion #7b)
Sub-block 8: full_body same-focus         (criterion #7c)
Sub-block 9: state focus skipped          (criterion #8)
Sub-block 10: out-of-window               (criterion #9)
Sub-block 11: NULL focus_slug ignored     (criterion #10)
Sub-block 12: incomplete ignored          (criterion #11)
Sub-block 13: yoga_sessions UNION         (criterion #12)
Sub-block 14: breathwork_sessions UNION   (criterion #12 — symmetric)
Sub-block 15: most-recent tiebreaker      (criterion #13)
Sub-block 16: full engine call from home  — confirm warning lands in `response.warnings`
Sub-block 17: full engine call from strength_tab — same
Sub-block 18: full engine call from yoga_tab    — same
Sub-block 19: full engine call to a state focus — confirm `warnings: []`

Cleanup: DELETE the seeded test rows. Verify counts back to snapshot. Throw on mismatch.
```

Each sub-block contributes 1–4 assertions. Estimated additions: ~80 assertions. Smoke total will become `3097 + ~80 ≈ 3177`. Persistence-wiring tests (criteria 14–15) live as 3 small HTTP/SQL test blocks in the same file — call the route with a body, assert the row.

---

## Tech-debt budget

3/10. Same neighborhood as T3.5 and T4. The helper is a single SQL query plus a thin formatter. The wiring is one column added to two existing tables (yoga_sessions, breathwork_sessions) and one column written from existing INSERTs (sessions, yoga_sessions, breathwork_sessions). The smoke block is the largest delta. No architecture pivots, no new abstractions.

The one thing that pushes this above 2/10: the UNION across three session tables is a temporary shape. FUTURE_SCOPE #114 (`pillar` column on `workouts`) and the eventual unified-session model would let this become a single-table query. We're not doing that work today; the UNION ships and survives until that refactor lands.

---

## Followups for FUTURE_SCOPE (post-Sprint-12, if surfaced during build)

1. **Personalized `alternative_focus_slug`.** Hardcoded to `recover` in v1. Could read user history and pick the user's least-recently-trained focus that is opposite-bias from yesterday. Sprint 14+ once personalization-algorithm planning lands.
2. **Configurable recency window.** "1 calendar day" is hardcoded. Some users might want 2. Settings surface, low priority.
3. **Suppression after explicit dismiss.** If user sees the warning and proceeds anyway, don't warn again on the next page load for the same focus. Requires a per-session `dismissed_warnings` cookie/state.
4. **Recency UNION cleanup once unified-session model lands.** When FUTURE_SCOPE #114 / the unified-session refactor ships, replace the UNION query with a single-table read. Trigger: that ticket lands.
5. **Same-day count threshold.** "User did chest once today" might warrant a softer warning than "twice today." V1 fires once and doesn't differentiate. UX call.

---

## Open questions for Prashob

1. **Decision 1 (UNION across 3 tables) — confirm.** This is the biggest call. Lower-effort alternative: scope T5 to `sessions` only and treat the yoga-only-tab gap as "fine, will fix when home-page UI ships." I prefer the UNION because it's small and gets the rule right; flagging because it's a bit more surface area than the spec literally asks for.
2. **Decision 2 (write at start, not finish) — confirm.** Once locked, the persistence wiring is one-column-per-INSERT, easy to review.
3. **Decision 3 (EmptyWorkout NULL-slug) — confirm.** Already in spec; just confirming the engine handles it correctly.
4. **Decision 5 (`[yesterday, today]` inclusive window) — confirm.** I'm reading the spec's literal SQL; want eyes on whether the intent is "1 calendar day" = "yesterday only" instead.
5. **Routes filename layout.** Are strength sessions in `server/src/routes/sessions.js`? `workouts.js`? Yoga in `yoga.js` or folded into `sessions.js`? I don't have direct repo access — the prompt should ask Claude Code to confirm the exact filenames during the build and adapt.

---

## Appendix A — `focus_overlaps` reference table (from S11-T1 seed)

The 12 spec-asserted pairs (line 722-732 of `S12-suggestion-engine-spec.md`). Pre-flight verifies live data matches this exactly.

| focus_id (slug) | overlaps_with_id (slug) | Symmetric? |
|---|---|---|
| chest | triceps | ✓ |
| triceps | chest | ✓ |
| chest | shoulders | ✓ |
| shoulders | chest | ✓ |
| back | biceps | ✓ |
| biceps | back | ✓ |
| shoulders | triceps | ✓ |
| triceps | shoulders | ✓ |
| quads | glutes | ✓ |
| glutes | quads | ✓ |
| glutes | hamstrings | ✓ |
| hamstrings | glutes | ✓ |

**No edges:** `core`, `calves`, `mobility`, `full_body`, and all 5 state focuses.

---

## Appendix B — Sample warning payloads

### Same-focus repeat

```json
{
  "type": "recency_overlap",
  "yesterday_focus": "chest",
  "current_focus": "chest",
  "message": "You trained chest yesterday. Consider a recovery focus today.",
  "alternative_focus_slug": "recover"
}
```

### Adjacent-focus overlap (yesterday)

```json
{
  "type": "recency_overlap",
  "yesterday_focus": "chest",
  "current_focus": "triceps",
  "message": "You trained chest yesterday — your triceps were worked too. Consider a recovery focus today.",
  "alternative_focus_slug": "recover"
}
```

### Adjacent-focus overlap (same day)

```json
{
  "type": "recency_overlap",
  "yesterday_focus": "chest",
  "current_focus": "triceps",
  "message": "You trained chest today — your triceps were worked too. Consider a recovery focus today.",
  "alternative_focus_slug": "recover"
}
```

---

**End of spec. Awaiting greenlight on Decisions 1, 2, 3, 5, and routes-filename note before the Claude Code prompt is written.**

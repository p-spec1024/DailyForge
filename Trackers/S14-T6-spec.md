# S14-T6 — Polish + Edge Cases + Substitution Ladder

**Status:** v1 LOCKED — May 12, 2026
**Sprint:** 14 — Session Start Handoff
**Branch:** `s14-t6` (chained off `s14-t5` HEAD, commit `0b6e2dc`)
**Size:** M-L (grew from M after locking FS #198 engine-side + rich summary + native share)
**Depends on:** T1, T2, T3, T4, T5 (all shipped)
**Blocks:** Sprint 14 close merge

---

## 1. Purpose

Sprint 14 built the machinery to get users into and through every session type. T6 is the finishing pass: every session ends with a polished summary, every start surfaces engine warnings, the breathwork player respects the engine's duration budget, the yoga swap honors the engine's actual style, and the swap endpoint stops picking random alternatives.

The ticket bundles six T6 scope items from the sprint plan plus three FUTURE_SCOPE items locked in during Q&A (#198, #203, #204).

---

## 2. In Scope

### From SPRINT_14_PLAN.md T6 scope

1. **Rich multi-phase completion summary** — post-session screen for cross-pillar and state-focus sessions.
2. **Skip/shorten polish** — confirm dialog wording, undo grace period, post-session note when phases were skipped.
3. **Mid-session phase preview polish** — T2's preview modal gets icons, progress bar, time remaining.
4. **Recency-warning surfacing** — inline banner above Start consuming `session.warnings[]`.
5. **Breathwork duration cap (Anomaly #11)** — `BreathworkTimerProvider` max-duration mode.
6. **Yoga swap-from-engine fix** — read `metadata.source` for style, fall back to `vinyasa`.

### Bundled FUTURE_SCOPE items (locked in Q&A)

7. **FS #198 — Substitution ladder (engine-side)** — `suggestionEngine.js` returns ranked alternatives on swap.
8. **FS #203 — Yoga adapter polish bundle** — W1/W2/W3 + A1/A2/A3 from S14-T3 `/review` (one commit).
9. **FS #204 — Yoga adapter unit tests** — `app/test/launchers/yoga_session_adapter_test.dart` (one commit, paired with #203's relocation).

---

## 3. Out of Scope

- Onboarding full flow (separate planning session)
- Session composer UI (FUTURE_SCOPE)
- FS #205 (breathwork audio)
- FS #206 (recover/focus 0–10 bracket data gap)
- FS #207 (Profile screen with pillar levels)
- FS #141 (`exercises.is_active`)
- FS #196 (`ApiConfig.baseUrl` `/api` prefix)
- Substitution-ladder picker UX (engine returns list; UI still uses single best alternative in T6 — picker is a separate ticket)
- 5-phase as flagship repositioning
- Sex-specific strength thresholds (FS #136)
- Nightly cron for level recompute (FS #137)

---

## 4. Decisions Locked

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Completion summary detail | **Rich** — phases done, time per phase, total time, focus, level impact, **3-stack streak metrics**, share button | Strava/Apple Fitness/Whoop precedent: each metric answers a distinct psychological question |
| 2 | Streak metrics on summary | **All three stacked** — daily streak (consecutive days w/ any session) + focus streak (e.g. "3rd biceps session this week") + weekly count ("Sessions this week: 4") | Enterprise-grade summary surface; pre-launch we lock the design we want to scale into |
| 3 | Share button | **Native share sheet with text + generated image card** | Engagement multiplier; image card carries the brand into screenshots |
| 4 | Recency warning UI | **Inline banner above Start (non-blocking)** | Doesn't break the one-tap-Start flow; user sees it, decides |
| 5 | FS #198 inclusion | **Include in T6** | High-priority flag, swap surface already exists from S12-T6 — upgrade what it returns, not new surface |
| 6 | FS #198 approach | **Engine-side ranked alternatives** | Level/history/recency brain already lives in engine; splitting it across UI codebase would fragment logic |
| 7 | FS #198 UI consumption in T6 | **Use top-1 of ranked list only** — picker UX deferred to separate ticket | T6 already M-L sized; picker requires its own design + device testing pass |
| 8 | FS #203 + #204 bundling | **Bundle into T6 as one commit each** | Pairs naturally with T6 polish posture; relocation + tests land together |
| 9 | Breathwork cap behavior | **Cap at engine's `duration_minutes`** — when reached, complete the current breath cycle then stop (no abrupt mid-inhale cut) | UX: respecting cycle integrity feels right; engine budget is the contract |
| 10 | Yoga swap style fallback chain | **`metadata.source` → session's stored `yoga_style` → `'vinyasa'`** | Three-tier fallback; literal `'vinyasa'` is final guard so swap never crashes on missing data |
| 11 | Substitution ladder size | **Top 5 ranked alternatives** returned by engine | 5 is enough for the deferred picker UX; T6 uses index 0 |

---

## 5. Pre-flight Diagnostic (REQUIRED)

Pre-flight is **moderate** (per sprint plan). Halt-on-drift before code.

### PF1 — Recency warning shape verification

**Why:** T6 surfaces `session.warnings[]` in UI. Spec asserts the shape; pre-flight verifies what the live engine actually returns.

**Steps:**
1. Run smoke harness in a mode that forces a recency overlap (insert a fixture session for user yesterday with the same focus).
2. Capture the live response body for one cross-pillar + one pillar-pure-strength suggest call.
3. Diff against this spec's §6.4 expected shape.

**Halt conditions:**
- `warnings[].type` is not `'recency_overlap'`.
- `warnings[].yesterday_focus`, `current_focus`, `message`, `alternative_focus_slug` keys missing or named differently.
- State-focus path emits warnings (spec asserts always empty `warnings: []`).

**Resolution if halted:** amendment doc. Do not patch the engine to fit the spec; correct the spec.

### PF2 — Breathwork player cap-injection point

**Why:** `BreathworkTimerProvider`'s protocol-cycle loop needs a clean place to inject a "stop at next cycle boundary if elapsed >= cap" check. If the loop is rebuilt every cycle via stack-based timer chains rather than a clean cycle counter, the injection is structural surgery, not a one-line cap.

**Steps:**
1. `view app/lib/providers/breathwork_timer_provider.dart` end-to-end.
2. Identify the cycle-boundary location (the `else` branch after `phase == 'pause'` or the `_advancePhase` tail).
3. Verify a `Duration _maxDuration` field can be added without breaking the existing endless mode (T5 amendment shipped endless mode — must not regress).

**Halt conditions:**
- No clean cycle-boundary hook exists; cap requires refactoring the timer state machine.
- Endless mode and cap mode share state in a way that creates an implicit mode bit (e.g. `maxDuration == null` could mean either "endless" or "uninitialized").

**Resolution if halted:** introduce an explicit `BreathworkMode` enum (`endless` / `capped` / `protocolCycles`) before wiring the cap.

### PF3 — Yoga swap metadata.source verification

**Why:** T6 fix reads `metadata.source` for the yoga style. Pre-flight verifies the engine actually emits this for pillar-pure yoga and that the value is a recognized style string.

**Steps:**
1. Run engine smoke for `yoga_tab` cold-start + warm-state cases.
2. Grep emitted `metadata` for `source` key.
3. If absent, grep `suggestionEngine.js` for where it should be set.

**Halt conditions:**
- `metadata.source` is absent for pillar_pure yoga sessions.
- Value is a non-style string (e.g. an entry-point identifier like `'yoga_tab'` rather than `'vinyasa'`).

**Resolution if halted:** if absent, this becomes an engine-side amendment (emit `metadata.source = <style>` for pillar-pure yoga). If wrong-shape, rename or extract correct field.

### PF4 — Substitution ladder data dependencies

**Why:** FS #198 engine-side rank requires inputs: user's exclusion list, swap history, recency overlap with alternatives. Pre-flight verifies all three are queryable.

**Steps:**
1. Confirm `user_excluded_exercises` table has indexed `(user_id, content_type, content_id)`.
2. Confirm `exercise_swap_counts` table is readable per-user for last-N exercise swap history.
3. Confirm `sessions.focus_slug` recency join still works for alternative-candidate filtering.

**Halt conditions:**
- Any of the three reads is missing or unindexed (would make swap endpoint too slow on production).

**Resolution if halted:** add indexes via migration before engine work proceeds.

### PF5 — Mid-session preview modal current shape (T2 carryover)

**Why:** T6 polishes the modal — adds icons, progress bar, time remaining. Verify the current modal is in `MultiPhaseSessionPage` and surfaces enough state (phase index, phase list, elapsed) to render the polished version.

**Steps:**
1. `view app/lib/pages/multi_phase_session_page.dart`.
2. Locate preview modal trigger (likely an info button or long-press).
3. Verify `MultiPhaseSessionProvider` exposes: `phases`, `currentPhaseIndex`, `elapsedSeconds` (or equivalent), `estimatedTotalMinutes`.

**Halt conditions:**
- Provider doesn't expose elapsed time → need to add it.
- Modal is implemented per-page (cross-pillar vs state-focus duplicated) → extract before polishing.

---

## 6. Detailed Spec

### 6.1 Multi-phase completion summary

**Route:** `/session/summary` — new page `app/lib/pages/session_summary_page.dart`.

**Entry:** `MultiPhaseSessionPage` and `FivePhaseSessionPage` push-replace to `/session/summary` on `onAllPhasesComplete`. Pillar-pure strength and pillar-pure yoga sessions get the same summary (single-phase sessions show "1 phase" — no special-casing).

**Data passed via constructor:**
```dart
SessionSummaryPage({
  required this.sessionShape,            // 'cross_pillar' | 'pillar_pure' | 'state_focus'
  required this.focusSlug,
  required this.focusDisplayName,
  required this.phases,                   // List<CompletedPhaseSnapshot>
  required this.skippedPhaseLabels,       // List<String> — display labels of any phases the user skipped
  required this.totalSeconds,
  required this.userLevelsBefore,        // {strength: 'beginner', yoga: 'beginner', breathwork: 'beginner'}
  required this.userLevelsAfter,         // same shape after the session — read from refreshed pillar-levels endpoint
  required this.sessionId,                // for share card linkback (deeplink, future)
});
```

**`CompletedPhaseSnapshot`** (new model `app/lib/models/completed_phase_snapshot.dart`):
```dart
class CompletedPhaseSnapshot {
  final String phaseLabel;       // 'Bookend (Open)', 'Warmup', 'Practice', etc — from phase_label.dart
  final String phaseSlug;        // raw engine slug ('bookend_open', 'warmup', etc)
  final int durationSeconds;     // actual elapsed (not engine estimate)
  final bool wasSkipped;
  final String? primaryContentName;  // e.g. "Box Breathing", "Bicep Curls"
}
```

**Layout (vertical scroll, single column):**

1. **Hero block (top, 25% of viewport)**
   - Large completion icon (Lucide `Trophy`, `Check`, or `Flame` — pick `Trophy` for v1)
   - "Session complete" headline
   - Focus display name as subtitle (e.g. "Biceps", "Calm")
   - Total time as large display (e.g. "32 min 14 sec")

2. **Streak stack (3 stacked rows, tight vertical rhythm)**
   - Row 1: **Daily streak** — "🔥 12-day streak" (Lucide `Flame` icon, count from `user_streaks` table — see §6.1.1)
   - Row 2: **Focus streak** — "💪 3rd Biceps session this week" (icon Lucide `Target`, count from sessions filtered by focus_slug + week)
   - Row 3: **Weekly count** — "📅 4 sessions this week" (icon Lucide `Calendar`, all sessions in current ISO week)
   - If any metric is zero or first-time, show empty state copy: "Start your daily streak", "Your first biceps session this week", "Your first session this week"

3. **Phase breakdown (horizontal rows, one per phase)**
   - Each row: phase icon + phase label + content name + duration
   - Skipped phases rendered in muted gray with strikethrough on duration + "skipped" badge
   - Example row: `🧘 Warmup — Cat-Cow → 4 min 12 sec`
   - Skipped example: `🧘 Cooldown — ~~3 min~~ ⚠️ skipped`

4. **Level progress (optional, only render if `userLevelsAfter` differs from `userLevelsBefore`)**
   - "🎉 Strength level up — Beginner → Intermediate" with a celebratory accent color
   - Only show pillars where level changed

5. **Action buttons (sticky bottom or normal flow if short)**
   - **Primary: "Done"** — pops to home
   - **Secondary: "Share"** — opens native share sheet (see §6.1.2)
   - **Tertiary (link button): "Save as routine"** — calls `POST /api/sessions/save-as-routine` (existing endpoint from S12-T7)

#### 6.1.1 Streak metric computation

Three streaks computed on the server in a new endpoint `GET /api/users/me/streaks` to avoid client-side date math fragility (timezone drift bit S12-T5).

**Endpoint response:**
```jsonc
{
  "daily_streak_days": 12,
  "focus_streak": {
    "focus_slug": "biceps",
    "count_this_week": 3,
    "is_first": false
  },
  "weekly_count": 4
}
```

**SQL sketch (engine-side, single round trip):**
```sql
WITH user_sessions AS (
  SELECT date, focus_slug
  FROM sessions
  WHERE user_id = $1 AND completed = true
),
daily AS (
  -- Count consecutive days back from today/yesterday until first gap
  SELECT COUNT(*) AS days FROM (
    SELECT DISTINCT date FROM user_sessions
    WHERE date >= CURRENT_DATE - INTERVAL '60 days'
    ORDER BY date DESC
  ) d
  -- (full CTE for streak-with-gap detection — implementation detail)
),
focus_week AS (
  SELECT COUNT(*) AS count_this_week
  FROM user_sessions
  WHERE focus_slug = $2
    AND date >= date_trunc('week', CURRENT_DATE)
),
week AS (
  SELECT COUNT(*) AS weekly_count
  FROM user_sessions
  WHERE date >= date_trunc('week', CURRENT_DATE)
)
SELECT daily.days, focus_week.count_this_week, week.weekly_count
FROM daily, focus_week, week;
```

**Edge cases:**
- User has 0 sessions ever → all three metrics return 0 + `is_first: true` semantics. UI renders empty-state copy.
- Today's session not yet committed when summary loads (race condition: summary opens before session row is INSERTED) → call the streak endpoint **after** the session-finish endpoint resolves on the previous page. T4 already writes the session row at completion time; T6 just sequences the streak fetch downstream.

**Caching:** none in v1 — 3-user app, query is cheap.

#### 6.1.2 Share card

**Native share sheet behavior:**
1. User taps "Share" on summary page.
2. Page renders a hidden offscreen `RepaintBoundary` containing a styled share card widget at 1080×1080 (Instagram square).
3. Capture the boundary as PNG via `boundary.toImage(pixelRatio: 3.0)`.
4. Save PNG to temp directory with a session-unique filename.
5. Call `Share.shareXFiles([XFile(pngPath)], text: <share text>)` via the `share_plus` package.

**Share text template:**
```
Just completed a {focus_display_name} session on DailyForge 💪
{total_time_human} • {phases.length} phases
{daily_streak ? '🔥 Day {daily_streak_days} of my streak' : ''}
```

**Share card widget layout (1080×1080 PNG):**
- Dark gradient background (matches app theme)
- DailyForge logo top-left
- Focus name as large hero text center
- Total time below focus name
- Stat strip across the bottom: streak / phase count / level (if leveled up)
- Bottom-right: small attribution "via DailyForge"

**No identifying user data in the image** — no name, email, avatar.

**Package addition:** `share_plus: ^10.1.0` (latest stable) added to `app/pubspec.yaml`. Confirm at pre-flight that no version conflict with existing packages.

**Permissions:** Android needs `android.permission.READ_EXTERNAL_STORAGE` for share intent on older API levels. share_plus handles this; verify the manifest at pre-flight.

**iOS:** out of scope (Sprint 14 is Android-first), but the implementation should not Android-hardcode anything — share_plus is cross-platform.

### 6.2 Skip / shorten polish

**Skip phase confirm dialog (cross-pillar, state-focus, pillar-pure yoga):**

Current behavior (T4): tapping skip immediately advances. Polished behavior:

1. Tap skip → show modal:
   - Title: "Skip {phaseLabel}?"
   - Body: "You can resume the phase later or finish the session without it."
   - Buttons: **Cancel** (default) / **Skip phase**
2. On "Skip phase" tap → 3-second undo banner appears at top with a countdown ring + "Undo" button.
3. If user taps Undo within 3 seconds → restore phase, resume from where they were.
4. Otherwise → phase marked as skipped, advance to next.

**State storage:** `MultiPhaseSessionProvider.skippedPhaseSlugs: Set<String>`. Cleared on session start, persisted via `StorageService` during the session (for background-foreground recovery).

**Summary impact:** §6.1's `skippedPhaseLabels` is derived from this set + `phaseDisplayLabel`.

**Shorten phase polish (yoga, breathwork only — strength has no "shorten" affordance):**

Current behavior: shorten button cuts remaining time in half. Polished behavior:

1. Confirm dialog: "Shorten {phaseLabel} to {newDuration}?"
2. Single button "Shorten" (no countdown).
3. New duration written to provider, timer adjusts.
4. **No "skipped" marker** — shortened phases still count as completed.

### 6.3 Mid-session phase preview modal polish

Current modal (T2): plain text list of upcoming phases.

Polished modal:

**Layout:**
- Title: "Session overview"
- Vertical progress bar on left (filled segments = completed phases, current phase pulses, upcoming phases empty)
- Right column: phase rows with icon + label + estimated duration
- Current phase row shows "**Now** • {time remaining}" instead of estimated duration
- Skipped phases shown in gray with skipped badge

**Phase icons** (Lucide):
- `bookend_open`, `bookend_close` → `Wind`
- `warmup` → `Sunrise`
- `main` → `Dumbbell` (strength) / `Move` (yoga)
- `cooldown` → `Sunset`
- `centering` → `Circle`
- `practice` → `Activity`
- `reflection` → `Moon`

**Time remaining for current phase:** `MultiPhaseSessionProvider.currentPhaseElapsedSeconds` (add if not present — PF5 verifies).

### 6.4 Recency warning surfacing

**Engine response shape (verified PF1):**
```jsonc
{
  "session_shape": "cross_pillar",
  "phases": [...],
  "warnings": [
    {
      "type": "recency_overlap",
      "yesterday_focus": "chest",
      "current_focus": "triceps",
      "message": "You trained chest yesterday — your triceps were worked too. Consider a recovery focus today.",
      "alternative_focus_slug": "recover"
    }
  ],
  "metadata": {...}
}
```

**UI surfacing point:** `_TodaysSessionCard` (home page focus card) — appears between the focus header and the Start button.

**Banner widget** (new: `app/lib/widgets/home/recency_warning_banner.dart`):

```
┌──────────────────────────────────────────┐
│ ⚠️  You trained chest yesterday          │
│     Your triceps were worked too.        │
│                                          │
│  [Switch to Recover]   [Proceed anyway] │
└──────────────────────────────────────────┘
```

**Behavior:**
- Non-blocking — Start button below remains enabled.
- "Switch to Recover" → calls `SuggestProvider.refreshForEntryPoint(entryPoint: 'home', focusSlug: warning.alternativeFocusSlug)`.
- "Proceed anyway" → dismisses banner for current session (in-memory only, no persistence).
- Banner re-appears on next focus change that triggers another warning.

**State-focus and pillar-pure yoga warnings:**
- State-focus: warnings array always empty per engine spec — banner never shows.
- Pillar-pure yoga: warnings array can populate (recovery check still runs). Render the same banner above the Yoga tab's `_TodaysYogaCard`.
- Pillar-pure strength: same, above `_TodaysStrengthCard`.

**Refactor note:** to avoid triplicating the banner widget, lift the banner above the three tab cards into a shared `EntryPointWarningSlot` widget that takes a `SuggestProvider` and renders the banner if `currentSession?.warnings?.isNotEmpty == true`. The three tab pages each include `EntryPointWarningSlot` once.

### 6.5 Breathwork duration cap (Anomaly #11)

**Problem:** `BreathworkTimerProvider` runs full protocol cycles, ignoring the engine's `duration_minutes`. A bookend phase intended for 3 min can run 6+ min if the protocol cycles don't align.

**Solution:** add a **capped mode** to `BreathworkTimerProvider`.

**API addition:**

```dart
enum BreathworkMode {
  protocolCycles,   // existing: run N full cycles
  endless,          // T5 amendment: stopwatch + I'm done
  capped,           // NEW: run until elapsed >= maxDuration, then complete current cycle and stop
}

class BreathworkTimerProvider {
  BreathworkMode _mode = BreathworkMode.protocolCycles;
  Duration? _maxDuration;

  void startCapped({
    required BreathworkTechnique technique,
    required Duration maxDuration,
  }) {
    _mode = BreathworkMode.capped;
    _maxDuration = maxDuration;
    // ... existing start logic
  }
}
```

**Capping logic:** at every cycle boundary (the point where the loop decides whether to run another cycle), check:
- If `_mode == capped && elapsed >= _maxDuration` → finish current cycle, then call `onComplete` instead of starting next cycle.

**Embedded player wiring:** `BreathworkPlayer` (T4) reads phase `duration_minutes` from `MultiPhaseSessionProvider.currentPhase`. When non-null and the player is in cross-pillar embedded mode, call `startCapped(maxDuration: Duration(minutes: durationMinutes))` instead of the protocol-cycles entry point.

**State-focus practice leg** is unchanged — it continues to use `endless` mode (T5 amendment locked this).

**Edge cases:**
- `maxDuration` smaller than one full cycle → run exactly one cycle then stop (cycles are the atomic unit; sub-cycle cuts are jarring).
- `maxDuration == 0` → not possible from engine (engine clamps via `*_duration_min`), but defensively: throw `ArgumentError` from `startCapped`.

**Unit tests** (`app/test/providers/breathwork_timer_provider_test.dart` — add if not present, extend if it is):
- `startCapped` with 30s cap on a 10s-per-cycle technique → runs 3 cycles, stops at ~30s.
- `startCapped` with 5s cap on a 10s-per-cycle technique → runs 1 cycle, stops at ~10s (cycle integrity wins).
- `startCapped` with 0s cap → throws `ArgumentError`.
- Endless mode still works (regression guard).
- Protocol-cycles mode still works (regression guard).

### 6.6 Yoga swap-from-engine fix

**Current bug (T3 carryover):** `yoga.js` swap endpoint hardcodes `'vinyasa'` when querying alternative poses, regardless of the session's actual style.

**Fix in `server/src/routes/yoga.js`** (locate the swap handler):

```js
// Three-tier fallback for yoga style
const sessionStyle =
  session?.metadata?.source         // engine-emitted (if PF3 passes)
  ?? session?.yoga_style            // stored on session row
  ?? 'vinyasa';                     // hard fallback

// Use sessionStyle in the alternative-pose query
```

**Engine-side amendment (only if PF3 surfaces metadata.source missing):**
Update `suggestionEngine.js` pillar-pure yoga path to emit:
```jsonc
"metadata": {
  "estimated_total_min": INT,
  "user_levels": {...},
  "source": "vinyasa"  // or whichever style the session is built around
}
```

**Smoke addition:** `test-suggestion-engine-t2.js` new sub-block:
- Generate pillar-pure yoga session
- Assert `metadata.source` is one of `['vinyasa', 'hatha', 'yin', 'restorative', 'power']` (the seeded styles)
- Trigger a swap on a yoga pose
- Assert returned alternative is in the same style

### 6.7 FS #198 — Substitution ladder (engine-side)

**Scope:** when the swap endpoint is called for a strength exercise, return a **ranked list of 5 alternatives** instead of one random pick. UI in T6 uses index 0 (top-1); the ranked list is exposed for a future picker UX ticket.

**Ranking inputs (engine-side):**

For each candidate alternative (already filtered by focus + level + exclusion):

1. **Recency penalty:** -10 points if candidate was in user's last 3 sessions, -5 if in last 7 days, 0 otherwise.
2. **Swap-count penalty:** -2 points per prior swap from this candidate (cap at -10 — i.e. 5+ swaps).
3. **Difficulty fit bonus:** +5 if `difficulty == user_level`, +2 if `difficulty < user_level`, 0 if `difficulty > user_level`.
4. **Muscle-overlap bonus:** +3 if candidate's `target_muscles` is a strict superset of the original exercise's `target_muscles` (covers everything the original did).
5. **Random tiebreaker:** uniform `random() * 0.5` added to break ties without making the ranking purely deterministic across calls.

**Output shape (`POST /api/workout/slot/:exerciseId/choose` extended):**

```jsonc
{
  "saved": true,
  "should_prompt": false,
  "swap_count": 1,
  "prompt_state": null,
  "alternatives": [
    {
      "exercise_id": 412,
      "name": "Hammer Curl",
      "target_muscles": ["biceps", "forearms"],
      "difficulty": "beginner",
      "rank_score": 8.3
    },
    // ... up to 4 more
  ]
}
```

**Spec deviation note (in engine header):** if `user_excluded_exercises` filters the candidate pool below 5, return fewer than 5. UI handles short lists gracefully (T6 uses index 0; if list is empty, the swap was the only option — return existing single-best behavior).

**SQL/service layer:** new service `server/src/services/substitutionLadder.js` exporting `rankAlternatives(userId, focusSlug, originalExerciseId, pillarLevel)` → returns `Array<{exercise_id, name, target_muscles, difficulty, rank_score}>` ordered descending by `rank_score`, capped at 5.

**Performance:** single query for candidates (existing pattern from S12-T6), client-side ranking in JS (Node), no per-candidate round trips. Pool size typically ≤30, ranking is O(n log n) on n ≤ 30 — trivial.

**Smoke sub-block:** new T6 BLOCK in `test-suggestion-engine-t2.js`:
- Fixture: insert 10 biceps exercises across 3 difficulty levels for a test user
- Insert 1 exclusion (user_excluded_exercises) for one of them
- Insert 5 swap-count rows for another
- Call `rankAlternatives` directly
- Assert excluded exercise is not in result
- Assert swap-penalized exercise ranks lower than its difficulty-tied peer
- Assert recency-penalized exercise ranks lower than its peer with no recency hit
- Assert list size ≤ 5
- Assert ordering is descending by rank_score

**Engine extraction:** `substitutionLadder.js` is a sibling to `suggestionEngine.js` — does not extend it. Sprint 15+ can fold it in if the architecture-extraction refactor (FS #160) lands.

### 6.8 FS #203 — Yoga adapter polish bundle

One commit, all six fixes from S14-T3 `/review`:

**W1 — Timer leak on aborted navigation:** in `yoga_session_launcher.dart`, post-await `!mounted` branches now call `provider.reset()` before early-return. Verify all `mounted` checks after `await provider.loadFromEngineSession(...)`.

**W2 — Fragile substring matching in `_friendlyYogaError`:** introduce typed exceptions:
```dart
// app/lib/launchers/yoga_session_errors.dart
sealed class YogaSessionException implements Exception {
  String get userMessage;
}
class YogaHydrationException extends YogaSessionException { ... }
class YogaContractException extends YogaSessionException { ... }
```
Replace `StateError(msg)` throws in `yoga_session_adapter.dart` with typed exceptions. `_friendlyYogaError` becomes a `switch` on type.

**W3 — Card empty after state→body→yoga roundtrip:** in `yoga_page.dart` `didChangeDependencies`, change re-fetch condition from:
```dart
if (_lastFetchedFocusSlug != currentFocus)
```
to:
```dart
if (_lastFetchedFocusSlug != currentFocus
    || suggest.currentSession?.sessionShape != 'pillar_pure')
```
Apply same fix in `strength_page.dart:51`.

**A1 — `_capitalizeFocus` triplicated:** extract to `app/lib/utils/focus_display.dart` as `String capitalizeFocus(String slug)`. Update 3 call sites.

**A2 — Yoga adapter file relocation:** move `app/lib/launchers/yoga_session_adapter.dart` → `app/lib/adapters/yoga_session_adapter.dart`. Move `YogaPoseDetails` → `app/lib/models/yoga_pose_details.dart`. Update imports across the app.

**A3 — Dependency arrow:** confirm after relocation: `provider → adapter`, `launcher → provider`. No reverse imports.

### 6.9 FS #204 — Yoga adapter unit tests

One commit, after FS #203's relocation. New file: `app/test/adapters/yoga_session_adapter_test.dart`.

**12 test cases:**

1. **Phase remap** — `'main'` → `'peak'` in returned `YogaPose.phase`.
2. **Throws on `session_shape != 'pillar_pure'`** — assert `YogaContractException`.
3. **Throws on missing `metadata.focus_slug`** — assert `YogaContractException`.
4. **Throws on unknown yoga phase token** — feed phase `'nonsense'`, assert `YogaContractException`.
5. **Throws on `content_id == null`** — assert `YogaHydrationException` (null means a reflection phase leaked through, which is a contract violation for yoga adapter).
6. **Throws on `duration_minutes <= 0`** — assert `YogaContractException`.
7. **Throws on missing hydration entry** — engine emits pose ID not in `yoga_poses_lookup`, assert `YogaHydrationException`.
8. **`holdSeconds == duration_minutes × 60`** — assert math.
9. **Level fallback to `'beginner'`** — when `metadata.userLevels.yoga` is absent, returned `YogaSession.level == 'beginner'`.
10. **`YogaSession.type` hard-defaults to `'vinyasa'`** — when neither `metadata.source` nor session row provides a style.
11. **Empty phases skipped silently** — engine emits a phase with `items: []`, adapter doesn't crash, returns a session without that phase represented.
12. **Multi-phase phase-then-item order** — adapter emits poses in `[warmup_items..., main_items..., cooldown_items...]` order, not interleaved.

**Test setup:** pure function tests, no `BuildContext`, no IO. Standard `test` package.

**Smoke link:** if the existing yoga smoke harness already covers some of these (e.g. test #8 holdSeconds), still include the unit test — unit tests are the regression contract, smoke is end-to-end verification.

---

## 7. File Touch List

### app/ (Flutter)

**New:**
- `app/lib/pages/session_summary_page.dart` (§6.1)
- `app/lib/models/completed_phase_snapshot.dart` (§6.1)
- `app/lib/widgets/home/recency_warning_banner.dart` (§6.4)
- `app/lib/widgets/home/entry_point_warning_slot.dart` (§6.4)
- `app/lib/widgets/session/share_card.dart` (§6.1.2)
- `app/lib/services/streaks_service.dart` (§6.1.1)
- `app/lib/utils/focus_display.dart` (§6.8 A1)
- `app/lib/launchers/yoga_session_errors.dart` (§6.8 W2)
- `app/lib/adapters/yoga_session_adapter.dart` (relocated from launchers/, §6.8 A2)
- `app/lib/models/yoga_pose_details.dart` (relocated, §6.8 A2)
- `app/test/adapters/yoga_session_adapter_test.dart` (§6.9)
- `app/test/providers/breathwork_timer_provider_test.dart` (extend if exists, §6.5)

**Modified:**
- `app/lib/pages/multi_phase_session_page.dart` — push-replace to summary on complete, polished preview modal
- `app/lib/pages/five_phase_session_page.dart` — same
- `app/lib/providers/multi_phase_session_provider.dart` — `skippedPhaseSlugs`, `currentPhaseElapsedSeconds`
- `app/lib/providers/breathwork_timer_provider.dart` — `BreathworkMode` enum, `startCapped` method
- `app/lib/players/breathwork_player.dart` — call `startCapped` in cross-pillar embedded mode
- `app/lib/pages/home_page.dart` — wire `EntryPointWarningSlot` above focus card
- `app/lib/pages/yoga/yoga_page.dart` — banner slot, W3 re-fetch fix
- `app/lib/pages/strength/strength_page.dart` — banner slot, W3 re-fetch fix, A1 import
- `app/lib/launchers/yoga_session_launcher.dart` — W1 reset on aborted nav
- `app/lib/routing/router.dart` (or wherever `go_router` config lives) — register `/session/summary`
- `app/pubspec.yaml` — add `share_plus: ^10.1.0`

### server/ (Node)

**New:**
- `server/src/services/substitutionLadder.js` (§6.7)
- `server/scripts/preflight-s14-t6-warnings-shape.mjs` (PF1)
- `server/scripts/preflight-s14-t6-substitution.mjs` (PF4)

**Modified:**
- `server/src/routes/workout.js` — extend `PUT /slot/:exerciseId/choose` response with `alternatives[]`
- `server/src/routes/users.js` — new `GET /api/users/me/streaks` endpoint
- `server/src/routes/yoga.js` — three-tier style fallback in swap handler (§6.6)
- `server/src/services/suggestionEngine.js` — (only if PF3 surfaces) emit `metadata.source` for pillar-pure yoga
- `server/scripts/test-suggestion-engine-t2.js` — new T6 smoke sub-blocks (substitution ladder + recency-shape + streak-endpoint + yoga-style swap)

---

## 8. Smoke + Test Expectations

**Smoke target:** ~3520 pass / 9 fail (T5 baseline 3499 + ~20 new assertions). 9 pre-existing fails unchanged.

**Unit tests target:** +12 yoga adapter tests, +5 breathwork timer tests. All passing.

**`flutter analyze`:** clean (T5 baseline). New files must not introduce hints.

**Device-test checklist** (Prashob, on Android):

1. Run a cross-pillar biceps session end-to-end → summary appears with all 3 streak metrics + share button works.
2. Run a state-focus calm session end-to-end → summary appears (no streak metric should crash even if first session).
3. Skip a phase → undo banner appears with countdown → tap Undo → phase resumes correctly.
4. Force a recency overlap (train chest, then immediately request triceps) → inline banner appears on home → "Switch to Recover" works → "Proceed anyway" dismisses.
5. Cross-pillar session with breathwork bookends → bookend phases stop at engine's duration (no overrun).
6. Yoga session mid-session swap → alternative pose is in the same style as the session.
7. Share button → native share sheet opens → image card looks correct in WhatsApp/X preview.
8. State-focus session: no recency banner ever appears (verify warnings array is empty for state focuses).

---

## 9. Definition of Done

- [ ] Pre-flight diagnostics PF1–PF5 all pass or surface halt conditions handled via amendment doc.
- [ ] All 6 sprint plan T6 scope items shipped (summary, skip polish, preview polish, recency banner, breathwork cap, yoga swap fix).
- [ ] FS #198 engine-side substitution ladder shipped; UI consumes top-1 only.
- [ ] FS #203 yoga adapter polish bundle shipped as one commit.
- [ ] FS #204 yoga adapter unit tests shipped as one commit, paired with #203's file relocation.
- [ ] `flutter analyze` clean.
- [ ] Smoke green (~3520 pass, 9 pre-existing fail).
- [ ] All 12 yoga adapter unit tests pass; all 5 breathwork timer tests pass.
- [ ] Device-test checklist (§8) all pass on Android phone.
- [ ] Three commits: (a) feature commit covering T6 scope + FS #198, (b) FS #203 polish commit, (c) FS #204 tests commit. Plus chore commit updating trackers.
- [ ] SPRINT_TRACKER.md updated with T6 status, branch, smoke totals, commit SHAs.
- [ ] FUTURE_SCOPE.md: #198 marked shipped, #203 marked shipped, #204 marked shipped. Add any new items surfaced during T6 build.

---

## 10. Sprint Close (after T6 merges to s14-t6 HEAD)

After T6 ships:

1. Verify `s14-t6` HEAD smoke green.
2. Checkout `main`, run `git merge --no-ff s14-t6 -m "Merge sprint-14 (S14-T1 through S14-T6)"`.
3. Tag: `git tag -a sprint-14-close -m "Sprint 14 close: session start handoff complete"`.
4. Push: `git push origin main --tags`.
5. Refresh App Stats snapshot in Project Instructions (Sprint 12-close was last refresh).
6. Sprint 14 retro: lock learnings into memory + add to SPRINT_14_LESSONS.md.

---

## 11. Amendment Trail

| # | Date | Change | Doc |
|---|---|---|---|
| — | — | — | (none yet) |

Amendments land here if mid-build drift surfaces (per Principle #16).

---

## 12. Risks + Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `metadata.source` is not emitted by engine — yoga swap fix needs engine work too | Medium | PF3 catches this; resolution path is amendment doc + small engine emit |
| `BreathworkTimerProvider` cycle-boundary hook doesn't exist cleanly | Low-medium | PF2 verifies; resolution is `BreathworkMode` enum refactor (already specced as the right answer) |
| Streak endpoint adds 1+ second to summary screen load | Low | 3-user app, query is cheap; if slow, cache per-session |
| Share card PNG generation slow on lower-end Android | Low | `pixelRatio: 3.0` on 1080×1080 is ~3MB; if slow, lower to 2.0 |
| Substitution ladder ranking edge-case where all candidates score equal | Low | Random tiebreaker (§6.7 input 5) prevents deterministic ordering ties |
| T6 grows beyond M sizing | Medium-high | Already L by virtue of bundling — accept and ship; FS #198 picker UX explicitly deferred to keep this finite |

---

## End of spec

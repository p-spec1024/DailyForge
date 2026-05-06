# S14-T1 — Session Launcher + Strength Pillar-Pure End-to-End

**Sprint:** 14
**Ticket:** T1
**Size:** M (upper)
**Status:** Spec locked May 6, 2026
**Branch:** `s14-t1` (off `main`, post `sprint-13-close` tag)
**Depends on:** Sprint 13 closed (T6 rescoped here as Sprint 14).
**Unblocks:** S14-T2 (yoga adapter), S14-T3 (5-phase orchestrator), S14-T5 (state-focus 3-leg chain).

---

## 1. Goal

Wire the home page's Start button to actually launch a workout. Ship the `SessionLauncher` abstraction that all subsequent S14 tickets extend, and make pillar-pure strength sessions work end-to-end: tap Start → server seeds session + exercises atomically → strength player opens with the engine's exercises pre-loaded → user logs sets normally → finish flow works.

T1 is **strength-only**. The launcher's `cross_pillar` and `state_focus` branches throw `UnimplementedError` with explicit sprint hand-off messages (T3, T5).

---

## 2. Scope

### 2.1 In scope (9 deliverables)

**Server (3):**
1. New endpoint `POST /api/sessions/start-from-list` — transactional insert of one `sessions` row + N `session_exercises` rows.
2. Server JOINs `exercises.target_muscles` into the start-from-list response so the player can render muscle chips.
3. Engine adds `metadata.focus_slug` to its response in `server/src/services/suggestionEngine.js`.

**Flutter (6):**
4. New `app/lib/launchers/session_launcher.dart` with `SessionLauncher.launch(BuildContext, SuggestedSession)`. Switch on `sessionShape`. Only `pillar_pure` + `content_type == 'strength'` branch is implemented. Other branches throw `UnimplementedError(<sprint hand-off message>)`.
5. New `WorkoutSessionProvider.startFromList(...)` method that posts to the new endpoint and hydrates provider state.
6. `home_page._onStart()` rewired to call `SessionLauncher.launch(context, suggest.currentSession!)`. Placeholder snackbar deleted.
7. `SessionMetadata` model gains a `focusSlug` field (nullable, defensive — engine always emits it post-deliverable #3 but model tolerance protects against staged deploys).
8. `SessionItem` already has `reps` (int?). No model change needed; `default_reps` plumbing on the session response (server side) carries the value to the player.
9. `ExerciseSessionCard` renders "target: N" hint next to each set row when `targetReps` is non-null and the session was engine-seeded.

### 2.2 Out of scope (other S14 tickets)

- Yoga session launching (S14-T2)
- Cross-pillar 5-phase sessions (S14-T3 + S14-T4)
- State-focus 3-leg chain (S14-T5)
- Multi-phase summary, skip/shorten phase UX, recency warning surfacing (S14-T6)
- Pre-existing `print()` cleanup in `WorkoutSessionProvider` (Anomaly A7 — separate hygiene pass)
- `app/lib/pages/workout/` vs `app/lib/pages/workout_page.dart` directory inconsistency (Anomaly A9)

---

## 3. Architectural shape

```
                  ┌─────────────────────┐
   Home tap Start │   _onStart()        │
                  │                     │
                  │  reads from         │
                  │  suggest.current    │
                  │  Session            │
                  └──────────┬──────────┘
                             │ pass session
                             ▼
                  ┌─────────────────────┐
                  │  SessionLauncher    │
                  │  .launch(ctx, sess) │
                  │                     │
                  │  switch (sessionShape)
                  │    pillar_pure  → strength path
                  │    cross_pillar → throw (T3)
                  │    state_focus  → throw (T5)
                  └──────────┬──────────┘
                             │ pillar_pure + strength
                             ▼
                  ┌─────────────────────┐
                  │  WorkoutSession     │
                  │  Provider           │
                  │  .startFromList(    │
                  │     exercises,      │
                  │     focusSlug,      │
                  │  )                  │
                  └──────────┬──────────┘
                             │ POST /api/sessions/start-from-list
                             ▼
                  ┌─────────────────────┐
                  │  Server (txn)       │
                  │  INSERT sessions    │
                  │  INSERT session_    │
                  │     exercises × N   │
                  │  JOIN target_muscles│
                  │  return session +   │
                  │     hydrated exes   │
                  └──────────┬──────────┘
                             │ provider sets _isActive = true
                             ▼
                  ┌─────────────────────┐
                  │  Launcher then      │
                  │  context.go         │
                  │  ('/workout')       │
                  │                     │
                  │  WorkoutPage        │
                  │  ._initSession sees │
                  │  isActive == true,  │
                  │  no-op early return │
                  │                     │
                  │  Renders the active │
                  │  session.           │
                  └─────────────────────┘
```

**Key seams:**
- Pre-seed pattern (decided May 6 — see drift log §10). Provider hydrates *before* navigation. Page mounts, sees `isActive == true`, falls through `_initSession()` line 55 guard, renders.
- `WorkoutPage` and `_initSession()` are NOT modified by T1. Zero risk of breaking the existing `/workout`, `/workout/empty?routineId`, `/workout/resume` paths.
- The launcher is the only new piece of UI orchestration. Convention scan confirmed `app/lib/services/` is strictly transport+storage; `app/lib/launchers/` is a new directory.

---

## 4. Server changes

### 4.1 New endpoint: `POST /api/sessions/start-from-list`

**File:** `server/src/routes/sessions.js` (extend existing route file).
**Auth:** JWT required (`authenticate` middleware, same as `/start`, `/suggest`, `/last`).

**Request body:**
```json
{
  "type": "strength",
  "focus_slug": "biceps",
  "exercises": [
    { "exercise_id": 180, "sort_order": 0, "default_sets": 3, "default_reps": 10 },
    { "exercise_id": 949, "sort_order": 1, "default_sets": 3, "default_reps": 10 },
    { "exercise_id": 296, "sort_order": 2, "default_sets": 3, "default_reps": 10 }
  ]
}
```

**Validation (return 400 with stable error code on each failure):**

| condition | error code | http |
|---|---|---|
| `type` missing or not in `['strength', 'yoga', 'breathwork']` | `invalid_session_type` | 400 |
| `type !== 'strength'` (T1 only ships strength) | `unsupported_session_type` | 400 |
| `focus_slug` missing or not a non-empty string ≤40 chars | `invalid_focus_slug` | 400 |
| `exercises` missing, not an array, or length 0 | `invalid_exercises` | 400 |
| `exercises` length > 20 | `too_many_exercises` | 400 |
| Any item missing `exercise_id` (positive int) | `invalid_exercise_item` | 400 |
| Any item with non-int `sort_order` / `default_sets` / `default_reps` | `invalid_exercise_item` | 400 |
| Any `exercise_id` doesn't exist in `exercises` table OR `is_active = false` | `unknown_exercise_id` | 400 |
| Any `exercise_id` has `type != 'strength'` | `wrong_pillar_exercise` | 400 |

**Validation note:** the focus_slug is recorded for telemetry only in T1. The server does NOT verify that the supplied exercises match the focus's muscle keywords — the engine already did that work; second-guessing it here would just create a drift bug between engine and endpoint.

**Transaction shape:**

```js
const tx = await pool.connect();
try {
  await tx.query('BEGIN');

  // 1. Insert session row.
  const sessionResult = await tx.query(`
    INSERT INTO sessions (user_id, workout_id, type, focus_slug, started_at, completed)
    VALUES ($1, NULL, 'strength', $2, NOW(), false)
    RETURNING id, user_id, workout_id, type, focus_slug, started_at, completed_at, completed
  `, [userId, focusSlug]);
  const session = sessionResult.rows[0];

  // 2. Bulk insert session_exercises. One row per exercise (set_number = NULL).
  //    Player creates per-set rows during logging — matches existing routine path.
  await tx.query(`
    INSERT INTO session_exercises (session_id, exercise_id, sort_order)
    SELECT $1, x.exercise_id, x.sort_order
    FROM jsonb_to_recordset($2::jsonb) AS x(exercise_id int, sort_order int)
  `, [session.id, JSON.stringify(exercises.map(e => ({
    exercise_id: e.exercise_id,
    sort_order: e.sort_order,
  })))]);

  // 3. JOIN exercise display data for the response.
  const exerciseRows = await tx.query(`
    SELECT e.id, e.name, e.target_muscles, e.equipment, e.difficulty,
           se.sort_order, se.id AS session_exercise_id
    FROM session_exercises se
    JOIN exercises e ON e.id = se.exercise_id
    WHERE se.session_id = $1
    ORDER BY se.sort_order
  `, [session.id]);

  await tx.query('COMMIT');

  // 4. Re-attach the engine's default_sets / default_reps to each row.
  //    These are NOT persisted (Pattern A) — they're returned to the client
  //    purely as the player's display hints.
  const defaultsByExerciseId = new Map(exercises.map(e =>
    [e.exercise_id, { default_sets: e.default_sets, default_reps: e.default_reps }]
  ));

  const hydratedExercises = exerciseRows.rows.map(r => ({
    id: r.id,
    name: r.name,
    target_muscles: r.target_muscles ?? '',
    equipment: r.equipment ?? '',
    difficulty: r.difficulty ?? null,
    sort_order: r.sort_order,
    session_exercise_id: r.session_exercise_id,
    default_sets: defaultsByExerciseId.get(r.id)?.default_sets ?? 3,
    default_reps: defaultsByExerciseId.get(r.id)?.default_reps ?? null,
  }));

  return res.json({
    session,
    exercises: hydratedExercises,
  });
} catch (err) {
  if (tx) await tx.query('ROLLBACK').catch(() => {});
  console.error('[start-from-list] error:', err);
  return res.status(500).json({ error: 'internal_error' });
} finally {
  if (tx) tx.release();
}
```

**Why per-row inserts via `jsonb_to_recordset`:** preserves transactional atomicity in a single statement, no per-row round trip. Same pattern used in S12-T7's `/save-as-routine` endpoint.

**Response shape (200):**
```json
{
  "session": {
    "id": 1234,
    "user_id": 1,
    "workout_id": null,
    "type": "strength",
    "focus_slug": "biceps",
    "started_at": "2026-05-06T10:30:00Z",
    "completed_at": null,
    "completed": false
  },
  "exercises": [
    {
      "id": 180,
      "name": "Lat Pulldown",
      "target_muscles": "back, biceps",
      "equipment": "cable",
      "difficulty": "beginner",
      "sort_order": 0,
      "session_exercise_id": 5678,
      "default_sets": 3,
      "default_reps": 10
    }
  ]
}
```

### 4.2 Engine adds `metadata.focus_slug`

**File:** `server/src/services/suggestionEngine.js`.

The mjs report Check C confirmed the existing metadata shape is:

```js
metadata: {
  estimated_total_min: ...,
  requested_budget_min: ...,
  user_levels: { strength, yoga, breathwork },
}
```

Find every place where the engine builds the `metadata` object on a returned session. Per the engine architecture (S12-T2/T3.5/T4), every recipe constructs metadata at its return statement. Recipes:

- `generateCrossPillar`
- `generateCrossPillarMobility`
- `generateCrossPillarFullBody`
- `generateStrengthOnly`
- `generateStrengthOnlyFullBody`
- `generateYogaOnly`
- `generateYogaOnlyMobility`
- `generateYogaOnlyFullBody`
- `generateStateFocus`

Each metadata block becomes:

```js
metadata: {
  estimated_total_min: ...,
  requested_budget_min: ...,
  user_levels: { strength, yoga, breathwork },
  focus_slug: focus.slug,  // NEW — same as input focus_slug
  // is_endless / bracket as before for state_focus
}
```

**Pre-flight check before edits:** Claude Code greps `metadata: {` in `suggestionEngine.js` at build start to enumerate every construction site. Adds `focus_slug` to each. The smoke harness assertions need a single line addition (`focus_slug: 'biceps'` or matching slug) per relevant test block.

### 4.3 Smoke harness updates

**File:** `server/scripts/test-suggestion-engine-t2.js`.

Add a new T1-prefixed sub-block: `T1 START-FROM-LIST BLOCK`. Use the `smoke-fixtures.mjs` helper from S13-T7. Sentinel: `notes='s14-t1-smoke-fixture'` for any test sessions inserted.

**Required sub-tests (≥18 assertions):**

1. (×3) Validation: missing `type`, missing `focus_slug`, missing `exercises` → 400 with correct error codes.
2. (×2) Validation: `exercises` empty array, `exercises` length > 20 → 400.
3. (×3) Validation: invalid item (no `exercise_id`, non-int `sort_order`, non-int `default_sets`) → 400.
4. (×2) Validation: `exercise_id` doesn't exist; `exercise_id` is yoga not strength → `unknown_exercise_id` / `wrong_pillar_exercise`.
5. (×2) Validation: `type='yoga'` rejected with `unsupported_session_type`. (T2 will widen.)
6. (×4) Happy path: 3-exercise strength session, response has `session.id`, `session.workout_id == null`, `session.focus_slug` matches, `exercises[].target_muscles` populated.
7. (×1) DB invariant: `SELECT * FROM session_exercises WHERE session_id = $sessionId` returns 3 rows ordered by `sort_order`.
8. (×1) `metadata.focus_slug` round-trip: call `/suggest` with focus=biceps, assert response `metadata.focus_slug === 'biceps'`.

After the block, cleanup deletes everything where `notes = 's14-t1-smoke-fixture'`.

**Smoke target:** ≥3265 pass total (3247 existing + 18 new). Zero new fails.

---

## 5. Flutter changes

### 5.1 `app/lib/launchers/session_launcher.dart` (new file, new directory)

Convention scan locked this path. Single class, public static `launch` method.

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../models/suggested_session.dart';
import '../providers/workout_session_provider.dart';
import '../services/api_service.dart';

/// Dispatches a [SuggestedSession] to the correct pillar player.
///
/// T1 supports `pillar_pure` strength only. Other shapes throw
/// [UnimplementedError] with an explicit sprint hand-off message.
///
/// Convention: pre-seed pattern. The launcher hydrates the relevant provider
/// before calling [GoRouter.go], relying on the player page's `provider.isActive`
/// re-entry guard to render without re-firing init logic.
class SessionLauncher {
  SessionLauncher._();

  static Future<void> launch(
    BuildContext context,
    SuggestedSession session,
  ) async {
    switch (session.sessionShape) {
      case 'pillar_pure':
        return _launchPillarPure(context, session);
      case 'cross_pillar':
        throw UnimplementedError(
          'cross_pillar shape lands in S14-T3 (5-phase orchestrator).',
        );
      case 'state_focus':
        throw UnimplementedError(
          'state_focus shape lands in S14-T5 (3-leg chain).',
        );
      default:
        throw UnimplementedError(
          'unknown session_shape: ${session.sessionShape}',
        );
    }
  }

  static Future<void> _launchPillarPure(
    BuildContext context,
    SuggestedSession session,
  ) async {
    if (session.phases.length != 1) {
      throw StateError(
        'pillar_pure expected 1 phase, got ${session.phases.length}',
      );
    }
    final phase = session.phases.first;
    final allStrength = phase.items.every((i) => i.contentType == 'strength');
    if (!allStrength) {
      throw UnimplementedError(
        'pillar_pure non-strength (yoga/breathwork) lands in S14-T2.',
      );
    }

    final focusSlug = session.metadata.focusSlug;
    if (focusSlug == null || focusSlug.isEmpty) {
      throw StateError(
        'session metadata.focus_slug is required for start-from-list',
      );
    }

    // Map engine items → start-from-list payload shape.
    final payloadExercises = phase.items.asMap().entries.map((entry) {
      final i = entry.key;
      final item = entry.value;
      return {
        'exercise_id': item.contentId,
        'sort_order': i,
        'default_sets': item.sets ?? 3,
        'default_reps': item.reps,  // may be null; engine emits int for strength
      };
    }).toList();

    final provider = context.read<WorkoutSessionProvider>();

    try {
      await provider.startFromList(
        exercises: payloadExercises,
        focusSlug: focusSlug,
      );
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyError(e))),
      );
      return;
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start session.')),
      );
      return;
    }

    if (!context.mounted) return;
    context.go('/workout');
  }

  /// Maps server error codes (carried in [ApiException.message]) to
  /// human-friendly messages per spec §7.
  static String _friendlyError(ApiException e) {
    switch (e.message) {
      case 'unsupported_session_type':
        return "This session type isn't supported yet.";
      case 'invalid_focus_slug':
        return 'Could not start session — try picking a focus again.';
      case 'invalid_exercises':
        return 'Engine returned no exercises. Try a different focus.';
      case 'too_many_exercises':
        return 'Session too long — try a shorter duration.';
      case 'unknown_exercise_id':
        return 'Some exercises in this session are unavailable.';
      case 'wrong_pillar_exercise':
        return 'Engine returned mismatched data — please report this.';
      default:
        return 'Could not start session.';
    }
  }
}
```

**Notes:**
- Static-only. No state. Easier to unit-test if we ever add tests.
- `context.mounted` guards both the snackbar paths and the navigation per Flutter framework discipline.
- T2 will refactor `_launchPillarPure` into pillar-specific sub-methods. T1 ships strength only.

### 5.2 `WorkoutSessionProvider.startFromList(...)` (new method)

**File:** `app/lib/providers/workout_session_provider.dart`. Add alongside existing `startSession`, `startEmptySession`, `resumeActiveSession`.

```dart
/// Starts a session from an engine-supplied exercise list (no workout_id).
///
/// Calls `POST /api/sessions/start-from-list`. The server returns the session
/// row and a hydrated exercises array with `target_muscles`, `default_sets`,
/// and `default_reps` already attached. Provider state mirrors what
/// [startSession] does for routine-backed sessions.
Future<void> startFromList({
  required List<Map<String, dynamic>> exercises,
  required String focusSlug,
}) async {
  final response = await _api.post(
    ApiConfig.sessionsStartFromList,
    {
      'type': 'strength',
      'focus_slug': focusSlug,
      'exercises': exercises,
    },
  );

  final session = response['session'] as Map<String, dynamic>;
  final hydratedExercises =
      (response['exercises'] as List).cast<Map<String, dynamic>>();

  _sessionId = (session['id'] as num).toInt();
  _workoutId = null;  // ad-hoc engine-seeded session
  _focusSlug = focusSlug;
  _startedAt = DateTime.parse(session['started_at'] as String);
  _exercises = List.of(hydratedExercises);
  _exerciseSets = {};

  // Initialize default-sets per exercise from the engine values.
  for (final ex in hydratedExercises) {
    final id = (ex['id'] as num).toInt();
    final defaultSets = (ex['default_sets'] as num?)?.toInt() ?? 3;
    _exerciseSets[id] = List.generate(
      defaultSets,
      (i) => SetEntry(setNumber: i + 1, reps: null, weight: null, completed: false),
    );
  }

  _isActive = true;
  _startTimer();

  // Fetch previous performance for each exercise, same as startSession does.
  unawaited(_fetchPreviousPerformanceFor(hydratedExercises));

  notifyListeners();
}
```

**Provider state additions:** add a `String? _focusSlug;` field with `String? get focusSlug => _focusSlug;` getter. Reset to `null` in `endSession()` / `clearActive()` / wherever the existing methods clear state. Used by the strength player to know "this session was engine-seeded" (for the `target: N` hint behavior in §5.5).

### 5.3 `home_page._onStart()` rewire

**File:** `app/lib/pages/home/home_page.dart`.

Replace the placeholder body (currently the snackbar at lines 130–141):

```dart
void _onStart() async {
  final suggest = context.read<SuggestProvider>();
  final session = suggest.currentSession;
  if (session == null) return;
  await SessionLauncher.launch(context, session);
}
```

**Race-condition fix (Anomaly #10):** the launcher reads `focus_slug` from `session.metadata.focusSlug` (engine-supplied), NOT from `suggest.currentFocusSlug`. The race condition is bypassed entirely — session is self-describing.

### 5.4 `SessionMetadata` model gains `focusSlug`

**File:** `app/lib/models/suggested_session.dart`.

Current `SessionMetadata` (per code report Check 1.5):
```dart
final int estimatedTotalMin;
final Map<String, String> userLevels;
final String source;
final bool? isEndless;
final String? bracket;
```

Add:
```dart
final String? focusSlug;
```

Parser tolerance: nullable to protect against staged-deploy windows where the client is updated before the server. Once both sides ship, the field will always be non-null in practice. Strict-mode philosophy preserved by still validating the type when present.

In the parser:
```dart
final rawFocusSlug = json['focus_slug'];
if (rawFocusSlug != null && rawFocusSlug is! String) {
  throw FormatException('focus_slug must be String or null');
}
final focusSlug = rawFocusSlug as String?;
```

### 5.5 `ExerciseSessionCard` — "target: N" hint

**File:** `app/lib/widgets/exercise_session_card.dart`.

Each set row currently renders an empty input box for reps. Add a small hint label *next to* the input box (NOT pre-filled inside it) when:
- The session was engine-seeded (`provider.focusSlug != null`)
- The exercise has a non-null `default_reps` value

UI shape:

```
Set 1: [50] kg × [____] reps   target: 10
Set 2: [50] kg × [____] reps   target: 10
Set 3: [50] kg × [____] reps   target: 10
```

The hint is muted/grey, ~11pt, positioned to the right of the reps input. Tap behavior: tapping the hint *does not* fill the input. The user types their actual number; the hint just informs.

**Reading default_reps:** the value is on the `Map<String, dynamic>` exercise record at `exercise['default_reps']`. Pass it to `ExerciseSessionCard` as a new optional `int? targetReps` constructor param. The card renders the hint only when `targetReps != null`.

### 5.6 `ApiConfig` constant

**File:** `app/lib/config/api_config.dart`.

Add one line:
```dart
static const String sessionsStartFromList = '/api/sessions/start-from-list';
```

Place alongside the existing `sessionsSuggest`, `sessionsLast`, etc. constants (S13-T3 added the first of these).

### 5.7 No router changes

`/workout` route already exists and accepts `extra: null`. The launcher pre-seeds the provider before calling `context.go('/workout')`. `WorkoutPage._initSession()` sees `provider.isActive == true` at line 55 and returns early. **Zero changes to `app/lib/config/routes.dart` or `app/lib/pages/workout_page.dart`.**

---

## 6. Verification plan

### 6.1 Pre-build pre-flight check

Before Claude Code starts coding, verify:
- (a) The two pre-flight reports (`Trackers/_scratch/S14-T1-PREFLIGHT-db-report.md` + `S14-T1-PREFLIGHT-code-report.md`) are still present and reflect current state. If either has been deleted or `main` has moved since their generation, regenerate.
- (b) Branch `s14-t1` is created off `main` at the `sprint-13-close` tag (commit `e696924`).
- (c) `npm run dev` starts cleanly (server boots, no migrations pending).

### 6.2 Smoke (server)

`scripts/test-suggestion-engine-t2.js` extended with the new T1 sub-block (≥18 assertions, sentinel-based cleanup).

**Acceptance:** ≥3265 pass / 0 fail. Existing 3247 baseline preserved.

### 6.3 Server-side curl roundtrip

Add a small one-shot script `server/scripts/s14-t1-curl-roundtrip.mjs` that:
1. Registers a fresh test user → JWT.
2. Calls `/suggest` with focus=biceps, asserts `metadata.focus_slug === 'biceps'`.
3. Calls `/start-from-list` with the engine's exercises → 200, returns hydrated exercises with `target_muscles` populated.
4. Verifies `SELECT * FROM session_exercises WHERE session_id = ...` returns N rows in `sort_order`.
5. Tries the same call with `type='yoga'` → 400 `unsupported_session_type`.
6. Tries with empty exercises → 400 `invalid_exercises`.
7. Cleans up: deletes session + session_exercises + test user.

This script is **NOT** committed (throwaway), but it lives at the path during build for human-verification.

### 6.4 Device verification (Android wireless ADB)

Acceptance flow on phone:
1. Open app, sign in.
2. On home, pick body focus (biceps), pick 30-min duration, see today's session card with 5 strength exercises.
3. Tap **Start**. Spinner ~200ms. Lands on workout page with the same 5 exercises pre-loaded.
4. Each exercise card shows muscle chips (e.g. "back, biceps") below the name.
5. Each set row shows `[__] kg × [__] reps   target: 10` next to the input.
6. Log set 1 with weight=50, reps=8. Tap ✓. Set saves.
7. Repeat for sets 2 and 3.
8. Move to next exercise via "Next exercise" affordance. Same shape.
9. Finish workout. Summary shows total sets, volume, duration.
10. Re-open app cold. Home page renders. No stale session card.
11. Tap a different body focus. Verify focus chip updates the card without race-condition issues (Anomaly #10 fix verification).
12. Tap Start again — second session starts cleanly.

### 6.5 `flutter analyze` baseline

Pre-build: 12 info hints (locked in pre-flight Check 6.3, all pre-existing in `pages/progress/*` and `widgets/yoga/*`).

**Acceptance:** ≤12 info hints after T1. Any new hint introduced by T1 must be cleaned before commit.

### 6.6 `/review` grade

Run `/review` after build. Target Grade A- minimum. Per Project Instructions principle #12, `/review` IS run for T1 (it's a logic ticket, not data-population).

---

## 7. Error contract for the new endpoint

Server-emitted error codes that the Flutter client must handle (the launcher's catch block + Snackbar):

| code | http | meaning | client UX |
|---|---|---|---|
| `invalid_session_type` | 400 | `type` missing or unknown | Snackbar: generic "Could not start session." |
| `unsupported_session_type` | 400 | `type` not strength (T1 only) | Snackbar: "This session type isn't supported yet." |
| `invalid_focus_slug` | 400 | focus_slug missing/empty/too long | Snackbar: "Could not start session — try picking a focus again." |
| `invalid_exercises` | 400 | exercises empty or wrong shape | Snackbar: "Engine returned no exercises. Try a different focus." |
| `too_many_exercises` | 400 | > 20 items | Snackbar: "Session too long — try a shorter duration." |
| `invalid_exercise_item` | 400 | item shape wrong | Snackbar: generic |
| `unknown_exercise_id` | 400 | exercise_id not in DB or inactive | Snackbar: "Some exercises in this session are unavailable." |
| `wrong_pillar_exercise` | 400 | exercise_id is yoga/breathwork | Snackbar: "Engine returned mismatched data — please report this." |
| `internal_error` | 500 | DB fault | Snackbar: generic |

The launcher's `_friendlyError()` helper does the code → message routing.

---

## 8. Open-question resolutions (architect calls captured)

These were resolved during spec authoring on May 6, 2026:

| call | resolution | rationale |
|---|---|---|
| Pattern A vs B for target reps | **A** — store actuals only in DB | Engine is generic; suggestions aren't tuned enough to be worth saving. Hevy convention. |
| Model strictness for unknown shapes | **Strict (existing)** — model already strict, T1 just adds `'pillar_pure'` strength branch | Auto-resolved by Check 1.4 finding |
| Pre-seed vs post-seed handoff | **Pre-seed** — launcher hydrates provider before navigation, page mounts with `isActive=true` | Zero changes to `WorkoutPage._initSession()`, lower blast radius |
| New endpoint vs extend existing | **New sibling** — `POST /api/sessions/start-from-list` | Existing `/start` doesn't carry an `exercises[]` shape; sniff-mode would muddy a working endpoint. Matches S12-T7 family pattern |
| Launcher placement | **`app/lib/launchers/session_launcher.dart`** (new directory) | `services/` is strictly transport+storage per convention scan; orchestration belongs elsewhere |
| Muscle chips for engine-seeded | **Server JOIN** — endpoint returns `target_muscles` in response | Cheapest fix, identical UX to routine sessions |
| Engine reps in player UI | **A+** — empty input boxes WITH "target: N" hint label next to each set | Matches Pattern A philosophy; gives beginner guidance without nudging users to overshoot fatigue |
| focus_slug source for start payload | **Engine adds `metadata.focus_slug`**; launcher reads from session, not provider | Fixes Anomaly #10 at the root; session becomes self-describing |
| T1 size: one ticket vs split | **One ticket** | The 9 deliverables aren't independent; splitting creates an artificial in-between state |

---

## 9. Anomalies surfaced by pre-flight (recap, with T1 dispositions)

| anomaly | source | T1 disposition |
|---|---|---|
| A1 — `_initSession` requires both `workoutId` AND `initialExercises` non-null for the seeded branch | Code report Check 2.2 | Avoided via pre-seed pattern (resolution in §8). T1 does NOT touch `_initSession` |
| A2 — Engine doesn't emit `target_muscles`; player wants chips | Code report Check 3 | Resolved (server JOINs in new endpoint) |
| A3 — `SessionMetadata` carries no `focus_slug` | Code report Check 4.2 | Resolved (engine adds, model parses) |
| A4 — Engine `reps` field; player has no per-exercise reps slot | Code report A4 | Resolved (Pattern A + target hint UI) |
| A5 — `WorkoutPage.build` shows error scaffold on session.error | Code report A5 | Acceptable — but T1's launcher Snackbar catches the error before navigation, so users won't normally hit this path. Safety net only. |
| A6 — Existing `startSession` doesn't send exercises | Code report A6 | Confirmed; T1's `startFromList` is a NEW method, doesn't touch existing |
| A7 — Three `print(...)` calls in provider | Code report A7 | Out of scope; flagged for future hygiene pass |
| A8 — fresh-user redirect to `/onboarding/level-capture/strength` only | Code report A8 | Out of scope; T1 doesn't change onboarding redirects |
| A9 — `pages/workout/` vs `pages/workout_page.dart` directory inconsistency | Code report A9 | Out of scope; pre-existing |
| Race condition (S13-T6 #10) — `previewFocus` mutates `currentFocusSlug` | Code report Check 4.3 | Resolved (launcher reads from session.metadata, not provider) |

---

## 10. Drift log

Per Project Instructions principle #11 (spec-first ticketing), this section preserves architect-side reasoning that surfaced during spec authoring.

| date | source | drift / decision | resolution |
|---|---|---|---|
| 2026-05-06 | mjs report Check A | `sessions.workout_id` nullable — engine-seed unblocked | No schema migration needed; insert with NULL workout_id |
| 2026-05-06 | mjs report Check A | `session_exercises` has no `reps` column; only `reps_completed` | Pattern A: don't persist target reps; engine value travels in API response only |
| 2026-05-06 | mjs report Check C | Engine sample emits `tier_badge: null` for strength items at all tested levels | T1 ignores `tier_badge` (Anomaly drop). T2/T3+ may surface it |
| 2026-05-06 | mjs report Check B | Windows `cmd.exe` couldn't run `grep -rn` from the script (silent miss) | Code report Check 4.1 fills the gap; non-blocking |
| 2026-05-06 | code report Check 4.3 | `SuggestProvider._currentFocusSlug` mutates during `previewFocus` | Server-side fix: engine adds `metadata.focus_slug`. Self-describing session |
| 2026-05-06 | code report Check 5 | No existing Launcher/Dispatcher/Coordinator class precedent in repo | New top-level dir `app/lib/launchers/` justified |
| 2026-05-06 | code report Check 2.2 | `_initSession` falls through to `startEmptySession` if `workoutId` null | Pre-seed pattern: launcher hydrates BEFORE navigation; `isActive=true` guard returns early |
| 2026-05-06 | architect call | Q: pre-fill reps inputs vs empty? | A+: empty inputs + "target: 10" sidecar hint label. Best of both |
| 2026-05-06 | architect call | Q: extend `/start` or new endpoint? | New sibling `/start-from-list`; isolation, telemetry clarity |
| 2026-05-06 | architect call | Q: T1 size — one ticket or split? | One ticket; the 9 deliverables form a single user-visible feature |

---

## 11. Sprint tracker row template

When this ticket ships, add the following to `Trackers/SPRINT_TRACKER.md` Sprint 14 section:

```
| 1 | SessionLauncher + strength pillar_pure end-to-end | ✅ Shipped <date> | Flutter + server. Branch `s14-t1`, commits <feature SHA> + <chore SHA>. Server: new `POST /api/sessions/start-from-list` endpoint (transactional, JOINs target_muscles), engine `metadata.focus_slug` added to all 9 recipe metadata blocks, smoke +18 assertions sentinel-cleaned. Flutter: new `app/lib/launchers/session_launcher.dart` (pre-seed pattern, strength branch only — yoga/cross_pillar/state_focus throw with sprint hand-off), `WorkoutSessionProvider.startFromList()` method, `SessionMetadata.focusSlug` model field, `ExerciseSessionCard` "target: N" sidecar hint when session is engine-seeded, `_onStart` rewired (reads from `session.metadata.focusSlug` not race-prone `suggest.currentFocusSlug`). 9 deliverables. Smoke <total>/0. `flutter analyze` baseline 12 info preserved. `/review` Grade <A/A->. Device-verified (12-step acceptance flow). Spec: `Trackers/S14-T1-spec.md`. |
```

---

## 12. Files changed (predicted)

For sprint-close commit-message accuracy:

**Server:**
- `server/src/routes/sessions.js` — new endpoint
- `server/src/services/suggestionEngine.js` — `metadata.focus_slug` added to ~9 recipe sites
- `server/scripts/test-suggestion-engine-t2.js` — T1 START-FROM-LIST sub-block

**Flutter:**
- `app/lib/launchers/session_launcher.dart` (NEW)
- `app/lib/providers/workout_session_provider.dart` — `startFromList` method, `_focusSlug` field
- `app/lib/pages/home/home_page.dart` — `_onStart` body
- `app/lib/models/suggested_session.dart` — `SessionMetadata.focusSlug` field + parse
- `app/lib/widgets/exercise_session_card.dart` — `targetReps` param + hint render
- `app/lib/config/api_config.dart` — `sessionsStartFromList` constant

**Trackers:**
- `Trackers/SPRINT_TRACKER.md` — chore commit at end with row update
- `Trackers/_scratch/` — both pre-flight reports DELETED before T1 commit (per S13-T6 hygiene pattern)

---

*Spec authored May 6, 2026 by architect (Claude.ai PM) with two pre-flight reports.*
*Source-of-truth for the Claude Code execution prompt (separate, throwaway).*
*This file commits to `Trackers/` per Project Instructions §"Spec-First, Then Prompt".*

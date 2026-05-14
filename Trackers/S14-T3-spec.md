# S14-T3 — Yoga adapter + Yoga tab Start

**Sprint:** 14
**Ticket:** T3
**Size:** M
**Status:** **v3 LOCKED May 10, 2026** — pre-flight surfaced engine drift on `hips` (not a seeded body focus); cold-start default flipped to `hamstrings`. Other v2 locks unchanged.
**Branch:** `s14-t3` (sprint-chained off `s14-t2` HEAD; merge happens at sprint-14 close)
**Depends on:** S14-T1 shipped (launcher abstraction, `metadata.focus_slug`, `SuggestProvider.refreshForEntryPoint`, `ExerciseSessionCard` pattern). S14-T2 shipped (cross_pillar branch live, home Start working).
**Unblocks:** S14-T4 (player embedding refactor — embedded yoga inside cross_pillar warmup/cooldown phases will reuse this adapter's phase remap + field conversions).

---

## v3 lock summary (May 10, 2026)

Pre-flight PF1 surfaced engine drift: `hips` is **not** a seeded body focus slug — engine throws `Unknown or inactive focus_slug: hips` for all 4 `hips` tuples. The 12 body focuses seeded in S11-T3 are `biceps, triceps, chest, shoulders, back, core, glutes, quads, hamstrings, calves, mobility, full_body`. `hips` exists as a muscle-keyword/overlap concept but is not selectable as a focus.

Cold-start default flipped from `hips` → **`hamstrings`** (highest single-muscle yoga coverage at 34 beginner poses; matches "I want to open up" yoga-tab mental model). All other v2 locks unchanged. PF1 confirmed PASS for `hamstrings/back/mobility/full_body/biceps` — engine emits correct `pillar_pure` shape with all-yoga items and phase tokens in `{warmup, main, cooldown}`.

| Decision | v3 lock |
|---|---|
| Yoga tab cold-start focus default | **`'hamstrings'`** — yoga-natural; highest beginner pose count (34 per FS #142) |
| Q1 — Yoga tab card behavior when home focus is a state focus | **A — hide the card.** Avoids showing two different focuses across tabs. |
| Q2 — Auto-refresh card on home focus change | **B — refresh on tab re-entry only.** Matches T1's pattern. |
| Q3 — Pose detail hydration failure | **B — block navigation, card stays in error with Retry.** Yoga without pose names is useless. |
| `YogaSession.type` defaulting | **`'vinyasa'` hard default** for T3. Engine fix queued as FUTURE_SCOPE — engine should emit `metadata.yoga_style`. |
| Strict-mode parsing | **Locked.** Adapter throws on contract violations; launcher's friendly-snackbar wrapper translates to user-facing copy. Big testing pass after a few more sprints surfaces flips. |
| Savasana | **Engine fix path locked.** Engine should emit savasana phase. T3 ships without; FUTURE_SCOPE queued. |

**FUTURE_SCOPE entries queued for sprint close** (added to `Trackers/FUTURE_SCOPE.md` at T3 chore commit):

1. **Engine emits savasana phase for yoga sessions.** Sprint 14+ engine work.
2. **Engine emits `metadata.yoga_style` for yoga sessions.** Removes `'vinyasa'` hard default; fixes swap-pose alternatives showing wrong style. Companion to entry #1.
3. **Audit yoga library for body-focus orphans.** Yoga poses with no body-focus visibility. Hand-audit + re-tag. Companion to FS #142.

---

## 1. Goal

Wire the **Yoga tab** to launch a real engine-driven yoga session. T3 ships:

1. The `_launchPillarPureYoga` branch on `SessionLauncher` (currently throws `UnimplementedError`).
2. The engine→yoga adapter — a pure function that converts `SuggestedSession` (where every `phase.items[].content_type == 'yoga'`) into the existing `YogaSession` model the player already understands.
3. A "TODAY'S YOGA" card on `YogaPage`, mirroring T1's "TODAY'S STRENGTH" card on `StrengthPage`. Tap Start → adapter runs → existing `YogaSessionPage` opens with engine-supplied poses.

After T3: pillar-pure yoga end-to-end works from the Yoga tab. Cross-pillar 5-phase (T2) and state-focus (T5) remain on their own launcher branches. Home Start continues to launch cross_pillar via T2's orchestrator (T3 changes nothing about home).

---

## 2. Scope

### 2.1 In scope

**Flutter (8 deliverables):**

1. `app/lib/launchers/session_launcher.dart` — replace the existing pillar-pure yoga throw with a real `_launchPillarPureYoga(context, session)` branch. Strength branch unchanged. Cross_pillar (T2) unchanged. State_focus throw unchanged.
2. New `app/lib/launchers/yoga_session_adapter.dart` — pure function `SuggestedSession → YogaSession`. Phase remap, field conversions, defaulting rules (§4). No I/O, no `BuildContext`. Unit-testable.
3. `app/lib/services/yoga_service.dart` — adds `fetchPosesByIds(List<int> ids)` method **if pre-flight PF2 confirms one doesn't exist**. Routes through `ApiService` per repo convention.
4. `app/lib/providers/yoga_provider.dart` — new method `loadFromEngineSession(SuggestedSession session)` that runs the adapter, hydrates pose details via `fetchPosesByIds`, sets `_generatedSession`, and notifies. Mirrors `WorkoutSessionProvider.startFromList` from T1 in shape.
5. `app/lib/models/suggested_session.dart` — strict-mode parsing already throws on unknown `content_type` (T1 lock). T3 confirms this still works for `'yoga'`; no model changes.
6. `app/lib/pages/yoga/yoga_page.dart` — new "TODAY'S YOGA" card at the top of the page body. States: loading / ready / error / refreshing / hidden. Mirrors T1 §5.4 of the Strength tab card pattern.
7. `app/lib/pages/yoga/yoga_session_page.dart` — entry path that accepts a pre-loaded `YogaSession` from the provider (most likely already supported — pre-flight PF3 confirms). No structural change to the player UI.
8. `app/lib/launchers/launcher_errors.dart` (or wherever T1 puts the friendly-snackbar wrapper) — confirm yoga branch surfaces friendly errors (e.g. "Couldn't load today's yoga — tap to retry") not raw exceptions.

**Server (1 conditional deliverable):**

9. `server/src/routes/yoga.js` — `POST /api/yoga/poses-by-ids` endpoint **if pre-flight PF2 confirms no equivalent exists**. Body `{ ids: int[] }`. Response: array of `YogaPose` rows with all fields the player needs (id, name, sanskrit_name, description, category, target_muscles, difficulty). Auth required (`authenticate` middleware). Validates ids are integers + array length ≤ 50.

**Smoke (1 deliverable):**

10. `server/scripts/test-suggestion-engine-t2.js` — new YOGA-ADAPTER block. Asserts: (a) engine produces `pillar_pure` yoga for `(entry_point='yoga_tab', focus='hamstrings', time_budget=30)`; (b) all `phase.items[].content_type == 'yoga'`; (c) `metadata.focus_slug` is non-null; (d) phase tokens are subset of `{warmup, main, cooldown}` (no savasana, no bookend_*); (e) if PF2 added the new endpoint, an HTTP block hitting `/api/yoga/poses-by-ids` with sentinel ids returns expected rows. Uses `scripts/lib/smoke-fixtures.mjs` helper per S13-T7.

### 2.2 Out of scope

- **Cross-pillar embedded yoga.** Phase 2 (warmup) and phase 4 (cooldown) of T2's orchestrator currently render stub views. T4 swaps them for embedded `YogaSessionPage` instances. T3's adapter is reused there; T3 itself ships only the standalone Yoga-tab path.
- **Swap-from-engine alternatives.** When the user taps "swap pose" inside the player, the alternatives query uses `YogaSession.type` as a filter. Since T3 defaults `type` to `'vinyasa'`, swap returns vinyasa alternatives even when the engine selected (say) a hatha-leaning pose. **Documented limitation; engine fix queued as FUTURE_SCOPE (`metadata.yoga_style` emission).** T6 polish or later sprint addresses.
- **Savasana phase.** Engine never emits `savasana`. T3 does not synthesize one. **Engine fix queued as FUTURE_SCOPE.** Session ends after cooldown until engine ships savasana emission.
- **Yoga-tab manual builder.** The existing yoga session builder (S4-T2) keeps working as-is. T3 adds the auto-suggested card alongside it; doesn't remove or modify the manual flow.
- **Yoga-tab focus picker.** Yoga tab inherits home's `currentFocusSlug` (or `'hamstrings'` cold-start fallback). No separate focus chips on Yoga tab in T3. (Same pattern as T1's Strength tab.)
- **Recency warnings on yoga session start.** Engine returns `session.warnings[]` for yoga overlap — T3 ignores. T6 surfaces them.
- **Auto-refresh on home focus change.** Card refreshes only on Yoga tab re-entry. Matches T1.
- **Hydration partial-success handling.** If `fetchPosesByIds` returns 404 / network error / partial result, T3 blocks navigation — never opens the player with placeholder names. Card shows error + Retry button. (Q3 lock.)

---

## 3. Pre-flight diagnostic (mandatory)

Per Project Instructions principle #14 + S14 Lessons #1, this ticket consumes engine output. Pre-flight runs a script that loads the engine, calls it with realistic tuples, and reports actual shape — not source-grep. **Stop on disagreement; amend, don't patch.**

### PF1 — Engine shape verification (Lesson #1)

✅ **PF1 already run May 10, 2026** — all `hamstrings/back/mobility/full_body/biceps` tuples PASSED. `hips` tuples threw `Unknown or inactive focus_slug` — drift documented in v3 lock summary above. Cold-start default flipped to `hamstrings`. PF1 re-runs only if engine code changes between now and build; no re-run needed for spec lock.

Reference: tuples actually verified.

| entry_point | focus | time_budget_min | observed session_shape | observed phase tokens |
|---|---|---|---|---|
| `yoga_tab` | `hamstrings` | 30 | `pillar_pure` | subset of {warmup, main, cooldown} ✅ |
| `yoga_tab` | `back` | 30 | `pillar_pure` | same ✅ |
| `yoga_tab` | `mobility` | 30 | `pillar_pure` | same ✅ |
| `yoga_tab` | `full_body` | 30 | `pillar_pure` | same ✅ |
| `yoga_tab` | `biceps` | 30 | `pillar_pure` (degraded) | same ✅ |

(For build verification, run a single tuple `yoga_tab/hamstrings/15min` — covers cold-start default at smallest time budget; rest of spec relies on these emission shapes already verified.)

### PF2 — Yoga service inventory

Inspect `server/src/routes/yoga.js` and `app/lib/services/yoga_service.dart`. Report:
- Does a fetch-by-IDs path exist today (any name — `getPosesByIds`, `posesByIds`, `/yoga/poses?ids=...`)? If yes: spec deliverable #9 deletes; provider uses existing service method.
- If no: spec deliverable #9 ships as written. Endpoint name locked to `POST /api/yoga/poses-by-ids`.
- Either way, confirm `/yoga/generate` still works untouched — T3 must not break the existing manual builder.

### PF3 — YogaSession entry-path inventory

Inspect `app/lib/pages/yoga/yoga_session_page.dart` and `YogaProvider`. Report:
- How does the existing manual flow get a `YogaSession` into the player? (Likely: `YogaProvider._generatedSession` is set by `generateSession(YogaConfig config)`; player reads it via `Consumer<YogaProvider>`.)
- Can a pre-loaded `YogaSession` (built from the engine adapter, not from `/yoga/generate`) drop into the same seam without changes? If yes: deliverable #7 is a no-op confirmation. If no: spec needs an amendment with the actual seam.

### PF4 — YogaPose / YogaSession field shape

Inspect `app/lib/models/yoga_models.dart`. Report the exact field names + types for `YogaPose` and `YogaSession`. Compare to the adapter output described in §4.2 / §4.3. Stop on field-shape drift; amend the adapter's output to match.

### PF5 — Engine throw inventory (yoga side)

Per Project Instructions principle #14, source-grep `suggestionEngine.js` for any throw/RangeError messages tied to yoga emission. Confirm whether the existing `engine_error → user-friendly message` mapper in `server/src/routes/sessions.js` covers them. Report drift.

### PF6 — Yoga tab structure inventory + SuggestProvider focus-type capability

Open `app/lib/pages/yoga/yoga_page.dart`. Report:
- Is it `StatelessWidget` or `StatefulWidget` today?
- What's at the top of the page body currently (above the manual builder)?
- Does it consume any provider already?

**Extension (Q1 lock):** Inspect `SuggestProvider`. Report whether it exposes a way to know the current focus *type* (body vs state):
- Path A: `currentFocusType` getter returning `'body' | 'state' | null`.
- Path B: only `currentFocusSlug` exposed — must derive type from the slug.
- Path C: `currentSession.metadata.focusType` shipped by T2.

If Path B, T3 ships a small helper `isStateFocus(String slug)` that hardcodes the 5 state focuses (`energize`, `calm`, `focus`, `sleep`, `recover`) as a Set. Lives in the launcher utility module. Cheap and safe; the 5 are enumerated in `focus_areas` and won't change without a migration.

---

## 4. Adapter contract

The adapter is a pure Dart function:

```dart
YogaSession yogaSessionFromEngine(SuggestedSession session) {
  if (session.sessionShape != 'pillar_pure') {
    throw StateError(
      'yoga adapter requires pillar_pure shape, got ${session.sessionShape}',
    );
  }
  // ... (impl per §4.1–4.5 below)
}
```

### 4.1 Phase remap

Engine emits one of: `warmup`, `main`, `cooldown` (T1/T2 verified). Each becomes the `category` field on every `YogaPose` derived from that phase's `items[]`:

| Engine phase token | YogaPose.category |
|---|---|
| `warmup` | `'warmup'` |
| `main` | `'peak'` |
| `cooldown` | `'cooldown'` |
| any other | **throw** `StateError('unknown yoga phase token: $token')` |

Engine never emits `savasana`. Adapter does not synthesize one. **Engine fix queued as FUTURE_SCOPE.** If pre-flight surfaces a phase token outside this set, **stop and amend** — don't add a default.

### 4.2 Item-level field conversions

For each `engine_item` in `phase.items[]`:

| Engine field | YogaPose field | Conversion |
|---|---|---|
| `content_id` (int, required) | `id` | direct |
| (none — must hydrate) | `name` | from `fetchPosesByIds`. **If hydration fails, navigation is blocked (Q3 lock); placeholder names never reach the player.** |
| (none — must hydrate) | `sanskritName` | from hydrate, nullable |
| (none — must hydrate) | `description` | from hydrate, nullable |
| (phase token) | `category` | per §4.1 |
| (none — must hydrate) | `targetMuscles` | from hydrate, nullable |
| `duration_minutes` (int, required) | `holdSeconds` | × 60 |
| (none — must hydrate) | `difficulty` | from hydrate; default `'beginner'` if absent |

**`content_id == null` is invalid for yoga.** Adapter throws.

### 4.3 Session-level fields

| YogaSession field | Source |
|---|---|
| `type` | hard default `'vinyasa'` (locked; engine fix queued as FUTURE_SCOPE) |
| `level` | `session.metadata.userLevels.yoga` if present + non-null; else `'beginner'` |
| `duration` | `session.phases.fold(0, (sum, p) => sum + p.items.fold(0, (s, i) => s + i.durationMinutes))` |
| `focus` | `[session.metadata.focusSlug]` (single-element list) |
| `poses` | flat-mapped list across all phases, in phase order then item order |
| `totalMinutes` | same as `duration` |
| `poseCount` | `poses.length` |

### 4.4 Hydration policy (Q3 strict-mode)

**Path A (preferred): `fetchPosesByIds` is added (deliverable #9).**

`YogaProvider.loadFromEngineSession`:
1. Run adapter to produce a "skeleton" `YogaSession` (poses with id + category + holdSeconds set; name/description/etc. as nulls).
2. Collect all unique pose ids.
3. Call `yogaService.fetchPosesByIds(ids)`.
4. Merge fetched details into the skeleton.
5. **If hydration fails** (404, network error, partial result with any pose missing details): throw `StateError('failed to hydrate poses: $error')`. The launcher's friendly-snackbar wrapper translates this; the card stays in error state with a Retry button. **Navigation is blocked. Player never opens.** (Q3 lock.)
6. On success: set `_generatedSession` + notify.

**Path B: existing path exists.** Use whatever the existing service method is. Same hydration-failure rule applies — block navigation on any failure.

### 4.5 Edge cases

| Case | Adapter behavior |
|---|---|
| `session.phases.isEmpty` | Throw `StateError('yoga session has no phases')` |
| One phase has zero items | Skip that phase silently (engine bug to surface, but don't crash player) |
| All phases have zero items | Throw `StateError('yoga session has no poses')` |
| `metadata.focusSlug == null` | Throw `StateError('yoga session metadata.focus_slug is required')` (T1 lock) |
| `metadata.userLevels == null` | OK — defaults to `'beginner'` |
| `engine_item.contentId == null` | Throw `StateError('yoga item missing content_id')` |
| `engine_item.durationMinutes <= 0` | Throw `StateError('yoga item has non-positive duration')` |
| Hydration returns fewer poses than requested | Throw `StateError('hydration incomplete')` (Q3) |
| Hydration network error | Throw `StateError('hydration network error')` (Q3) |

Strict-mode philosophy locked: **throw on contract violation; the launcher's friendly-snackbar wrapper translates to user-facing copy.** Better to surface a bug at QA than to silently render a broken session. Big testing pass after a few more sprints surfaces what flips to lenient.

---

## 5. Launcher branch

**File:** `app/lib/launchers/session_launcher.dart`

Replace the existing pillar-pure non-strength throw. Branch:

```dart
case 'pillar_pure':
  final mainItems = session.phases
      .firstWhere((p) => p.phase == 'main', orElse: () => session.phases.first)
      .items;
  if (mainItems.isEmpty) {
    throw StateError('pillar_pure session has empty main phase');
  }
  final pillar = mainItems.first.contentType;
  switch (pillar) {
    case 'strength':
      return _launchPillarPureStrength(context, session);  // T1
    case 'yoga':
      return _launchPillarPureYoga(context, session);      // T3 (this ticket)
    case 'breathwork':
      throw UnimplementedError(
        'pillar_pure breathwork shape — unexpected from engine; report.',
      );
    default:
      throw StateError('unknown content_type in pillar_pure session: $pillar');
  }
```

`_launchPillarPureYoga` body:

```dart
static Future<void> _launchPillarPureYoga(
  BuildContext context,
  SuggestedSession session,
) async {
  final yogaProvider = context.read<YogaProvider>();
  try {
    await yogaProvider.loadFromEngineSession(session);
  } on StateError catch (e) {
    _showLauncherError(context, e.toString());  // friendly snackbar; Q3
    return;
  }
  if (!context.mounted) return;
  context.go('/yoga/session');  // route name per pre-flight
}
```

---

## 6. "TODAY'S YOGA" card on YogaPage

Mirrors T1's Strength tab card pattern. Card sits at the **top** of `YogaPage` body, above existing content (manual builder, recents, whatever).

### 6.1 States

| State | Render |
|---|---|
| Loading (initial fetch) | Card skeleton with subtle spinner |
| Ready | Header "TODAY'S YOGA", focus name (e.g. "Hips"), duration (e.g. "30 min"), pose count, **Start** button |
| Error | Card with error message + Retry button |
| Refreshing | Same as Ready, with non-blocking indicator |
| **Hidden** | `SizedBox.shrink()` — when home focus is a state focus (Q1 lock) |

### 6.2 Fetch logic

Convert `YogaPage` to `StatefulWidget` if not already (per pre-flight PF6). In `initState`:

```dart
@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    _fetchTodaysYoga();
  });
}

Future<void> _fetchTodaysYoga() async {
  if (!mounted) return;
  final suggest = context.read<SuggestProvider>();

  // Q1 lock: hide card when home focus is a state focus.
  // Detection: per pre-flight PF6 — either `suggest.currentFocusType`,
  // or fallback to `isStateFocus(slug)` helper hardcoding the 5 state slugs.
  if (_isCurrentFocusState(suggest)) {
    return;  // no fetch; consumer renders SizedBox.shrink()
  }

  final focusSlug = suggest.currentFocusSlug.isNotEmpty
      ? suggest.currentFocusSlug
      : 'hamstrings';  // cold-start default for yoga tab (locked v3)

  await suggest.refreshForEntryPoint(
    entryPoint: 'yoga_tab',
    focusSlug: focusSlug,
  );
}
```

Refresh policy (Q2 lock): **only on tab re-entry.** No listener on `currentFocusSlug` changes. Card may show stale focus until user navigates away from Yoga tab and back.

### 6.3 Reactive consumer

```dart
Consumer<SuggestProvider>(
  builder: (context, suggest, _) {
    // Q1 lock: hide card when home focus is a state focus.
    if (_isCurrentFocusState(suggest)) {
      return const SizedBox.shrink();
    }
    if (suggest.isLoading && suggest.currentSession == null) {
      return _buildLoadingCard();
    }
    if (suggest.lastError != null && suggest.currentSession == null) {
      return _buildErrorCard(onRetry: _fetchTodaysYoga);
    }
    final session = suggest.currentSession;
    if (session == null) return const SizedBox.shrink();
    if (session.sessionShape != 'pillar_pure') {
      return const SizedBox.shrink();
    }
    final firstItem = session.phases
        .firstWhere((p) => p.phase == 'main', orElse: () => session.phases.first)
        .items
        .firstOrNull;
    if (firstItem?.contentType != 'yoga') {
      return const SizedBox.shrink();
    }
    return _buildReadyCard(session);
  },
)
```

### 6.4 Tap Start

```dart
onPressed: () => SessionLauncher.launch(context, suggest.currentSession!),
```

### 6.5 Visual treatment

Per Lesson #2, **don't over-spec UI**. Match T1 "TODAY'S STRENGTH" card visual — same card height, same chip style, same Start-button treatment. Yoga theme color (likely teal per S4-T2 history) replaces strength's accent. Iterate via amendment after device test.

---

## 7. Server endpoint (conditional)

**Triggered by: PF2 reports no fetch-by-IDs path exists.**

`POST /api/yoga/poses-by-ids`

Request:
```json
{ "ids": [123, 456, 789] }
```

Validation:
- `ids` is required, must be array, length 1–50.
- Each `id` must be a positive integer.

Response (200):
```json
{
  "poses": [
    {
      "id": 123,
      "name": "Downward-Facing Dog",
      "sanskrit_name": "Adho Mukha Svanasana",
      "description": "...",
      "category": "warmup",
      "target_muscles": ["hamstrings", "calves", "shoulders"],
      "difficulty": "beginner"
    }
  ]
}
```

Errors:
- 400: bad ids (string, non-positive, array too long)
- 401: missing/invalid auth (via `authenticate` middleware)
- 404: any requested id doesn't exist (Q3 strict-mode — partial success not allowed)

If returned row count < requested id count → 404 with `{"error": "some_poses_missing", "missing_ids": [...]}`. (Q3 strict-mode.)

`category` here means the DB's stored category — the adapter's `category` derivation from phase tokens (§4.1) **overrides** the DB value. The DB value is informational; the engine's phase placement is authoritative.

SQL shape:
```sql
SELECT
  id, name, sanskrit_name, description, category,
  target_muscles, difficulty
FROM exercises
WHERE type = 'yoga' AND id = ANY($1::int[]);
```

---

## 8. Smoke harness additions

`server/scripts/test-suggestion-engine-t2.js` — append a `YOGA-ADAPTER` block. Uses `scripts/lib/smoke-fixtures.mjs` per S13-T7.

Assertions:
1. **Engine emits pillar_pure for yoga_tab tuples.** For each tuple in PF1's table.
2. **All items are yoga.** Every `phase.items[].content_type === 'yoga'`.
3. **Phase tokens are subset.** Every `phase.phase ∈ {'warmup', 'main', 'cooldown'}`.
4. **focus_slug present.** `session.metadata.focus_slug` non-null and non-empty.
5. **(Conditional) `/api/yoga/poses-by-ids` round-trip.** Insert sentinel yoga pose, hit endpoint, assert round-trip.
6. **(Conditional) Validation errors.** Empty ids → 400; 51 ids → 400; non-int ids → 400; no auth → 401.
7. **(Conditional) Partial-success rejection.** `[<sentinel>, 999999999]` → 404 (Q3 strict-mode).

Smoke baseline impact: ~7–10 assertions on top of S14-T2's baseline. Update `SPRINT_TRACKER.md` row at chore-commit time.

---

## 9. Definition of done

- [ ] PF1–PF6 complete, no blocking drift (or amendment doc written if drift surfaced).
- [ ] `flutter analyze` baseline preserved (≤12 info hints, T1-locked).
- [ ] Smoke harness passes with new YOGA-ADAPTER block; total smoke count incremented in tracker.
- [ ] From the Yoga tab "TODAY'S YOGA" card: tap Start → yoga player opens with engine-supplied poses (real names, not placeholders) → user advances through poses → completes session → returns home.
- [ ] When home focus is a state focus (e.g. "calm"), Yoga tab "TODAY'S YOGA" card is hidden. Manual yoga builder still works. (Q1 lock verified.)
- [ ] When user changes home focus mid-session-on-Yoga-tab and re-enters Yoga tab, card refreshes with new focus. (Q2 lock verified.)
- [ ] When pose hydration is forced to fail (e.g. simulated 404), card shows error + Retry; player never opens with placeholder names. (Q3 lock verified.)
- [ ] Phase remap correct on inspection (engine `main` poses appear under `category=peak` in player).
- [ ] Hold seconds match engine's `duration_minutes × 60` per pose.
- [ ] Cross-pillar / state-focus / pillar-pure-strength still work (no regression).
- [ ] Home Start still launches cross_pillar correctly (T2 untouched).
- [ ] Existing manual yoga builder (S4-T2) still works untouched.

---

## 10. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Engine emits non-yoga `content_type` items in a `yoga_tab` session | Low | PF1 catches; spec stops + amends |
| `YogaSession`/`YogaPose` field shape doesn't match adapter output | Medium | PF4 catches; adapter output adjusted |
| Existing yoga player has hidden coupling to `/yoga/generate` | Medium | PF3 inspects; amendment if surfaced |
| Cold-start default `'hamstrings'` produces a session with too few poses | Low | PF1 verified PASS; engine handles degradation. If thinness surfaces in QA, swap default to `core` or `full_body` (both proven). |
| Card visual call reverses on device test (Lesson #2 expected ~30–50%) | High | Expected. Fix-up amendment per T1 pattern; no rebuild. |
| Q1 hidden state confuses users (they tap Yoga tab from a state focus and see no card) | Medium | Manual builder still visible; iterate via fix-up if device test shows confusion |
| Hydration failure user impact (Q3 blocks navigation) | Medium | Retry button on card; users not stranded but blocked from session until network/server recovers |
| `SuggestProvider.currentFocusType` doesn't exist | Medium | PF6 extension catches; `isStateFocus(slug)` helper added with 5 hardcoded state slugs |
| Yoga-tab focus diverges from home focus | Low — design call | Locked: yoga_tab follows home focus. UX consistency. |

---

## 11. Locked decisions (frozen for prompt dispatch)

All §11 items from v1 + §12 questions are now locked. No open questions remaining.

1. **Yoga tab cold-start focus default = `'hamstrings'`.** (v3 — flipped from `hips` after PF1 confirmed `hips` is not a seeded focus slug.) Highest single-muscle yoga coverage; matches "open up tight legs" intent.
2. **`YogaSession.type` = `'vinyasa'` hard default.** Engine fix queued as FUTURE_SCOPE.
3. **Strict-mode adapter behavior.** Adapter throws on every contract violation listed in §4.5. No silent degradation. Big testing pass after a few sprints surfaces what flips.
4. **Server endpoint name (if added) = `POST /api/yoga/poses-by-ids`.** Body `{ ids: int[] }`. Auth required. Strict partial-success rejection (404 if any id missing).
5. **Smoke block name = `YOGA-ADAPTER`.**
6. **Card title = "TODAY'S YOGA"**. Visual color = yoga-tab accent (existing).
7. **Branch name = `s14-t3`.** Sprint-chained off `s14-t2` HEAD.
8. **Q1 — Yoga tab + home state focus = hide card.** `SizedBox.shrink()` in the consumer. Manual builder unaffected.
9. **Q2 — Refresh policy = tab re-entry only.** No listener on `currentFocusSlug` changes.
10. **Q3 — Hydration failure = block navigation.** Card shows error + Retry. Player never opens with placeholder names.
11. **Out-of-scope items in §2.2 stay deferred.**

---

## 12. FUTURE_SCOPE entries to add at sprint close

Three new entries land in `Trackers/FUTURE_SCOPE.md` as part of T3's chore commit:

> **FS #X1 — Engine emits savasana phase for yoga sessions.** Engine currently emits `warmup → main → cooldown` only. Traditional yoga ends with savasana. Fix at engine level (recipe addition), not in the T3 adapter. Companion to FS #X2. Sprint 14+ engine work.

> **FS #X2 — Engine emits `metadata.yoga_style` for yoga sessions.** T3 adapter currently hard-defaults `YogaSession.type` to `'vinyasa'`. Engine knows enough (level + duration + pose mix) to pick a real style label. When this lands, adapter reads `metadata.yoga_style`; swap-pose alternatives match the actual session style. Companion to FS #X1.

> **FS #X3 — Audit yoga library for body-focus orphans.** Yoga poses with no body-focus visibility (no live keyword in `target_muscles`, no vinyasa `practice_types`, < 3 muscles for full_body fallback) are invisible to the engine's yoga_tab queries. Hand-audit + re-tag. Companion to FS #142. Sprint 13+ content sprint.

---

## 13. Sprint workflow

1. ✅ Spec v3 locked (this doc).
2. ✅ Pre-flight PF1 run May 10, 2026 — drift surfaced (`hips` not seeded), v3 lock resolves.
3. PF2–PF6 inspection commands — run grep findings, paste back to chat.
4. If PF2–PF6 surface drift: amendment doc, NOT spec patch (PI principle #16).
5. Build prompt authored as **throwaway markdown file in chat session** (PI principle #11; not committed). Drift log at top per S13-T3 lock.
6. Architect-side review of prompt against this spec before dispatch (PI principle #18).
7. Claude Code builds → reports → does NOT commit.
8. `flutter analyze` clean + smoke green → Prashob device-tests on Android.
9. Greenlight → ticket commit (`feat(s14-t3): yoga adapter + Yoga tab Start`).
10. Chore commit (`chore: update trackers post S14-T3`) — adds FS #X1, #X2, #X3.
11. Optional amendment commit if device test surfaces small fix (~30–50% expected per Lesson #2).
12. Report: "Ticket shipped." S14 sprint-close merge + tag handles main integration after T6.

---

*End of S14-T3 spec v3. Cold-start default flipped to `hamstrings` after PF1 surfaced engine drift on `hips`. Ready for PF2–PF6 grep results, then prompt authoring.*

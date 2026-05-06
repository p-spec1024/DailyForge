# Sprint 14 — Session Start Handoff (Plan)

**Status:** Planning. Specs to be authored per ticket before dispatch.
**Sprint goal:** Tap Start on the home page and have a world-class session experience for every focus type the engine produces — body focus pillar-pure, body focus cross-pillar (5-phase), and state focus.
**Estimated calendar:** ~3 weeks single-developer.
**Branch strategy:** Sprint-chained off `main` post `sprint-13-close`. Single `--no-ff` + annotated `sprint-14-close` tag at sprint end.

---

## Why this sprint exists

Sprint 13's T6 pre-flight diagnostic revealed three independent sprint-sized builds hiding inside one ticket:

1. **Five-phase orchestrator does not exist in the Flutter app today.** Sprint 10's `TodaysPracticeSection` was three independent route jumps (`/strength`, `/yoga`, `/breathwork`), not orchestration. The engine emits cross-pillar 5-phase sessions; nothing in the app can play them.
2. **State-focus is multi-technique, breathwork player is single-technique.** Engine returns 3 techniques (centering / practice / reflection); breathwork timer plays one. Reflection has `content_id: null` and would crash `int.parse(null)` at the route.
3. **Strength player has no ad-hoc entry path.** All three entry points (`/workout`, `/workout/empty?routineId`, `/workout/resume`) require a non-null `workout_id` or `routineId`. Engine produces exercises but no routine row.

Plus 7+ smaller adapter gaps: yoga phase remap (`main`→`peak`), `holdSeconds` conversion, model strictness, swap-from-engine fallback, `_onStart` race condition, etc.

Cramming all of this into one S13 ticket would have produced a 3-week PR with multiple amendments that's untestable as a unit. Sprint 14 splits it into 6 spec'd sub-tickets.

---

## Architectural shape

A single `SessionLauncher` abstraction sits between home Start and the players. Pseudocode:

```dart
class SessionLauncher {
  static Future<void> launch(BuildContext context, SuggestedSession session) {
    switch (session.sessionShape) {
      case 'pillar_pure':
        return _launchPillarPure(context, session);
      case 'cross_pillar':
        return _launchCrossPillar(context, session);  // → FivePhaseSessionPage
      case 'state_focus':
        return _launchStateFocus(context, session);   // → 3-leg chain
      default:
        throw EngineContractError('unknown session_shape: ${session.sessionShape}');
    }
  }
}
```

Home `_onStart` → `SessionLauncher.launch(context, currentSession)`. No per-shape conditionals at the call site. All adapter logic lives in the launcher and its sub-modules.

This abstraction lands in T1 and grows organically across the sprint. T1 ships pillar-pure strength_only; T2 adds yoga_only; T3+T4 add cross-pillar; T5 adds state-focus.

---

## Ticket plan

### S14-T1 — Launcher + strength `startFromList` + pillar-pure strength

**Scope:**
- Create `SessionLauncher` (new file: `app/lib/services/session_launcher.dart` or similar; locate per repo convention).
- Wire home `_onStart` to call the launcher. Remove the placeholder snackbar.
- Server-side: extend `POST /api/sessions/start` to accept `workout_id: null` + `exercises[]` payload and seed exercises atomically into the new session.
- Client-side: add `WorkoutSessionProvider.startFromList(List<Exercise> exercises)` that posts to the extended endpoint and navigates to `/workout` with the returned session.
- Map engine `phase.items[]` (where `content_type == 'strength'`) → `Exercise` records with the field renames (`content_id` → `id`, `sets` → `default_sets`, `reps` ignored on player but preserved on send).
- Pillar-pure strength_only end-to-end working: home Start → strength player loaded with engine exercises.
- Fix `_onStart` race condition (Anomaly #10): read `currentSession.metadata.bracket` not `suggest.currentFocusSlug`.
- SuggestedSession model strictness (Anomaly #2): enum-validate `session_shape` against `{pillar_pure, cross_pillar, state_focus}` and throw on unknowns. Same for `content_type`.

**Out of scope:** yoga, cross-pillar, state-focus — all stubbed in launcher with `throw UnimplementedError('lands in S14-T2/T3/T5')`.

**Spec required:** yes, before prompt dispatch.

**Pre-flight diagnostic required:** yes — verify `ApiConfig.sessionStart` route shape on the server, verify `WorkoutPage` constructor still matches what the launcher will pass, verify session-start response shape matches what `startFromList` will read.

**Size:** M.

**Definition of done:**
- Pick a body focus that produces strength-only (e.g. biceps + 30 min) → tap Start → strength player opens with engine exercises pre-loaded → complete workout → returns home → session logged.
- Pillar-pure yoga / cross-pillar / state-focus all show "coming in S14-T2/T3/T5" snackbar (no crash).
- `_onStart` reads from `currentSession.metadata.bracket` (race-condition fix verified).
- Model throws on unknown `session_shape` or `content_type`.

---

### S14-T2 — Yoga adapter + pillar-pure yoga

**Scope:**
- Engine→yoga adapter module inside the launcher: takes engine `phase.items[]` (where `content_type == 'yoga'`) and produces `YogaSession` for the existing yoga player.
- Phase remap: engine `warmup` → player `warmup`, engine `main` → player `peak`, engine `cooldown` → player `cooldown`. Engine never emits `savasana` — leave that gap documented but don't synthesize it in v1.
- Field conversions: `content_id` → `YogaPose.id`, `duration_minutes` → `YogaPose.holdSeconds` (×60).
- Defaults for fields the engine doesn't emit: `YogaPose.difficulty` defaults to `'beginner'`, `YogaSession.type` defaults to `'vinyasa'`, `YogaSession.level` defaults from `metadata.userLevels.yoga`.
- Hydrate optional fields from `/yoga/generate` if needed (open question for spec — does the existing yoga service `getPosesByIds` exist? If not, add it).
- Pillar-pure yoga_only end-to-end: pick a yoga focus (e.g. hips + 25 min) → tap Start → yoga player runs with engine poses.

**Out of scope:** swap-from-engine — `YogaSession.type` defaults to `'vinyasa'` in v1, swap will use that filter. Document as known limitation.

**Spec required:** yes.

**Pre-flight diagnostic required:** yes — verify `YogaPose` model fields match what adapter will produce, verify yoga service has a "fetch poses by IDs" path or confirm one needs to be added, verify `YogaSession.type` filtering doesn't crash on `'vinyasa'` default.

**Size:** M.

**Definition of done:**
- Yoga focus end-to-end works.
- Phase remap correct (engine `main` shows as `peak` in player).
- Hold seconds match the engine's per-pose budget.
- Swap-from-engine works with vinyasa-default style.

---

### S14-T3 — Five-phase orchestrator skeleton

**Scope:**
- New page `FivePhaseSessionPage` (locate per repo convention, e.g. `app/lib/pages/session/five_phase_session_page.dart`).
- Phase state machine: tracks `currentPhaseIndex`, `phasesCompleted`, `phaseStartTime`, `totalElapsedSeconds`. Persists to `StorageService` so app-background-then-resume restores correct state.
- Phase indicator UI: header showing "Phase 2 of 5: Yoga warmup", time elapsed in current phase, total session time elapsed, time remaining (estimated).
- Phase transition UX: smooth animation between phases. Brief "Up next: strength main" preview screen when one phase completes (2-second auto-advance with skip).
- Pause / resume: works mid-phase. Resumes from same point in same phase.
- Skip phase: power-user gesture (e.g. long-press the phase header) → confirms → advances to next phase.
- Mid-session phase preview: tap header → modal showing all 5 phases with time estimates, current position, can't change order.
- Embedded players: stubbed in this ticket. Each phase shows `Center(child: Text('Phase N: <name> (player embeds in T4)'))` with a "Phase complete" button to advance.
- Launcher branch: `_launchCrossPillar` opens `FivePhaseSessionPage` with the engine's `phases[]` passed in.

**Out of scope:** real embedded players (T4), state-focus (T5), polish (T6).

**Spec required:** yes — this is the largest ticket of the sprint and needs the most design attention. Consider a separate planning chat session before spec authoring (use the "personalization algorithm planning"-style mode for this).

**Pre-flight diagnostic required:** yes — verify the engine's `phase.items[]` structure within `cross_pillar` shape across all three recipes (in-scope, mobility, full-body), verify `metadata.estimatedTotalMin` is reliable for the time budget UI.

**Size:** L.

**Definition of done:**
- Cross-pillar focus (e.g. full-body + 45 min) → tap Start → orchestrator opens with 5 stubbed phases → can advance through all phases → completes session.
- Pause-during-phase + resume works.
- Background app + foreground works (state restored).
- Skip phase works.
- Phase preview modal shows correct phase list.

---

### S14-T4 — Player embedding refactor

**Scope:**
- Refactor `WorkoutPage`, `YogaSessionPage`, `BreathworkTimerPage` to support an "embedded mode" — runs inside a parent host (the orchestrator) instead of owning the screen.
- Embedded mode: no AppBar of its own, no back button (host owns navigation), exposes a `onPhaseComplete` callback that the host listens to, exposes a "current progress" stream the host can read.
- Strength embedded: same logging UX, but completion goes to host, not back to home.
- Yoga embedded: same flow widget, completion goes to host.
- Breathwork embedded: same timer UI, completion goes to host.
- Wire each embedded player into the orchestrator's correct phase based on engine `content_type` per phase.
- Cross-pillar end-to-end: pick full-body + 45 min → tap Start → orchestrator runs phase 1 (breath bookend_open) → phase 2 (yoga warmup) → phase 3 (strength main) → phase 4 (yoga cooldown) → phase 5 (breath bookend_close) → completion.

**Out of scope:** state-focus (T5), polish (T6).

**Spec required:** yes — refactor across three pages is non-trivial and deserves a careful design doc. Consider whether to introduce a shared `EmbeddablePlayer` interface or each player handles embedded mode independently.

**Pre-flight diagnostic required:** yes — verify each player's current navigation contract (what happens on completion today), verify their providers can run without owning the screen state, verify no implicit `Scaffold`/`AppBar` dependencies block embedding.

**Size:** L.

**Definition of done:**
- Cross-pillar full end-to-end with real players in all 5 phases.
- Each player can run standalone (existing routes still work) AND embedded (new mode).
- Completion of one phase auto-advances orchestrator to next.

---

### S14-T5 — State-focus 3-leg chain

**Scope:**
- Leg manager service: tracks current leg (centering / practice / reflection), what's next, what's behind. Persists state for app-background recovery (similar pattern to T3 phase state machine).
- Breathwork player extended with optional `onLegComplete` callback. When a leg finishes, calls the manager instead of returning home.
- New `ReflectionTimerPage` for the reflection leg (where `content_id == null`): countdown timer with "Breathe naturally" prompt, soft chime at end. No protocol cycles, no inhale/hold/exhale display — just a quiet, gentle screen.
- Skip leg: power-user gesture → confirms → advances to next leg.
- Back leg: optional, can defer to T6 polish.
- Launcher branch: `_launchStateFocus` opens leg manager → first leg (centering) → on complete → second leg (practice) → on complete → third leg (reflection) → on complete → home with session summary.
- State-focus end-to-end: pick a state focus (e.g. calm + 12 min) → tap Start → centering plays → practice plays → reflection plays → returns home.

**Out of scope:** polish, per-leg analytics, mid-leg pause-resume polish (T6).

**Spec required:** yes.

**Pre-flight diagnostic required:** yes — verify `BreathworkTimerProvider` can be reset between legs without leaking state, verify the breathwork player can run for the engine's `duration_minutes` cap (Anomaly #11) or whether that's a separate fix in T6.

**Size:** M.

**Definition of done:**
- State focus end-to-end works for all 5 state focuses (energize, calm, focus, sleep, recover).
- Reflection leg shows silent timer, doesn't crash on null `content_id`.
- Skip leg works.
- Background-then-foreground restores correct leg position.

---

### S14-T6 — Polish + edge cases

**Scope:**
- Multi-phase completion summary: post-session screen showing all phases completed, time per phase, total time, focus area, level impact (uses `metadata.userLevels` from engine response).
- Skip-phase / shorten-phase UX polish: confirm dialog wording, undo grace period, post-session note when phases were skipped.
- Mid-session phase preview polish: T3's modal gets visual treatment (icons per phase, progress bar, estimated time remaining).
- Recency-warning surfacing: T5/S12 wired warnings into the engine response (`session.warnings[]`). Surface them at session start ("You did legs yesterday — proceed?") with options to proceed, swap exercises, or pick a different focus.
- Honor engine `duration_minutes` for breathwork bookends (Anomaly #11): cap the breathwork player at the engine's budget instead of running full protocol cycles. Introduces a "max duration" mode in `BreathworkTimerProvider`.
- Yoga swap-from-engine fix: when swapping a pose mid-session, scope the alternatives query to the engine's actual style if present in `metadata.source` or fall back to `vinyasa`.
- Mid-leg / mid-phase pause-resume polish.

**Out of scope:** anything not listed.

**Spec required:** yes — polish tickets benefit from a tight spec to prevent scope creep.

**Pre-flight diagnostic required:** moderate — verify `session.warnings[]` shape, verify breathwork player's protocol-cycle loop has a clean cap-injection point.

**Size:** M.

**Definition of done:**
- All session types finish with a summary screen.
- Recency warnings surface at start.
- Breathwork honors `duration_minutes`.
- Swap-from-engine works correctly.
- Skip/pause/resume feels polished on device.

---

## Sprint-wide principles (locked from S13 learnings)

1. **Pre-flight diagnostic per ticket.** Every ticket above lists a pre-flight requirement. Don't skip — S13-T6's pre-flight is exactly why this sprint exists in this shape.
2. **Spec-first per ticket.** Each ticket gets its own `S14-T[N]-spec.md` in `Trackers/`. Spec is committed; prompt is throwaway.
3. **Architect-side review before dispatch.** Every prompt re-read against spec before sending to Claude Code.
4. **Sprint-chained branch.** All tickets land on a single branch, single `--no-ff` merge at sprint close.
5. **Device test per ticket.** Claude Code stops after `flutter analyze` clean — Prashob device-tests, then greenlights commit.
6. **Match repo convention.** `ApiService` for HTTP, `StorageService` for persistence, `ChangeNotifier` for providers. Flag deviations at pre-flight.
7. **Amendment docs for mid-build drift** — if a ticket surfaces spec-vs-data drift mid-execution, write an amendment doc, not a spec patch.

---

## Dependencies + critical path

```
T1 (launcher + strength) ─────┬──→ T3 (orchestrator skeleton) ──→ T4 (embed players) ──→ T6 (polish)
                              │                                                          ↑
                              ├──→ T2 (yoga adapter) ──────────────────────────────────┤
                              │                                                          │
                              └──→ T5 (state-focus chain) ──────────────────────────────┘
```

T1 unblocks everything. T2 and T5 are independent of T3/T4 and can run in parallel if architect time permits (single developer = sequential).

T6 depends on T1–T5 all landing.

---

## Out of scope for Sprint 14

- Onboarding full flow (separate planning session, queued)
- Session composer UI (FUTURE_SCOPE)
- Personalization algorithm overhaul (separate planning session)
- 5-phase as flagship repositioning (FUTURE_SCOPE)
- Sex-specific strength thresholds (FUTURE_SCOPE #136)
- Nightly cron for level recompute (FUTURE_SCOPE #137)

---

## Sprint 14 close criteria

- All 6 tickets shipped.
- Tap Start on home page works for every focus the engine produces (24 body focus combinations + 5 state focuses).
- All 4 session types (pillar-pure strength, pillar-pure yoga, cross-pillar 5-phase, state-focus chain) complete end-to-end with summary screens.
- Pause-resume + background-foreground state restoration works for all session types.
- Recency warnings surface at session start.
- `sprint-14-close` annotated tag on `main`.
- App stats snapshot in Project Instructions refreshed.

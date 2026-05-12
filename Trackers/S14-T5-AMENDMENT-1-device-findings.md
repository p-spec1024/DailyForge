# S14-T5 — AMENDMENT 1 — Device-test findings

**Date:** May 12, 2026
**Source:** Prashob device test (20-step spec §13 flow)
**Trigger:** Device test surfaced 5 fixable issues + 2 FS deferrals + 1 false alarm. Fixing all 5 before T5 commits.

This amendment captures device-driven findings during T5 acceptance. Auto-resume initially appeared broken but was a `flutter run` artifact — confirmed working when retested via app-icon launch.

---

## Findings — final triage

| # | Issue | Severity | Cause | Disposition |
|---|---|---|---|---|
| 1 | Breathwork loop boundary bug: off-by-one round count + auto-completion fires "Stopped early" intent + intermittent hang at last round | 🔴 Critical | Pre-existing Sprint 9 bug, surfaced more visibly via T5 embedded use | **Fix in T5** |
| 2 | Practice stage technique name not displayed when embedded | 🟡 Polish | T5 extraction lost label rendering when `isEmbedded == true` | **Fix in T5** |
| 3 | No stage-name label visible — AppBar shows only "Calm" (focus), no "Centering / Practice / Reflection" indication | 🟡 Polish | Spec gap — AppBar shows focus name; stage name needs new surface | **Fix in T5** |
| 4 | Auto-resume — NOT BROKEN | ✅ Working | Initial test used `flutter run`; real path (app icon) auto-resumes correctly | No action |
| 5 | Recover/focus missing 0-10 bracket | 🟢 Data gap | Engine emits `empty` for some focus/level combos; underlying breathwork tags need backfill | **FUTURE_SCOPE** |
| 6 | User level not visible anywhere | 🟢 UX gap | Profile screen doesn't exist yet | **FUTURE_SCOPE** |
| 7 | Server crash + silent yoga-session data loss on cross-pillar phase 3 advance | 🔴 Critical | Pre-existing S14-T3 yoga.js bug: double `client.release()` + over-restrictive `duration < 5` floor rejecting valid engine-emitted embedded calls | **Fix in T5** |
| 8 | Android screen blacks out 15-30s into any session | 🟡 UX gap | Pre-existing Sprint 9 gap — Flutter app never requested an Android wakelock; state-focus's long single-screen UX exposed it sharply | **Fix in T5** |

---

## Finding 1 — Breathwork loop boundary bug

### 1.1 — Observed symptoms

**Standalone breathwork (Breathwork tab → Box Breathing → run to end without skipping):**
- Session auto-ends at last round
- Summary screen reads "Session Ended / **Stopped early**" — despite no user action
- Round count reads "**5 / 6**" — but user completed all 6 rounds
- Reproducible on every run-to-completion

**Embedded breathwork (state-focus centering, calm session):**
- Intermittent hang at last round, last phase (e.g. "Round 8 of 8, HOLD 1")
- Completion never fires → orchestrator never advances to next stage
- User must tap "Skip stage" to recover
- Not reproducible every time; estimated ~30% of attempts

### 1.2 — Root cause hypothesis

The breathwork tick loop has a boundary race at "all rounds complete." Three competing operations near round end:

1. The per-second timer ticks down the current phase (inhale/hold/exhale).
2. When a phase timer reaches 0, the loop advances to the next phase. If the current phase was the LAST in the cycle, increment round count.
3. After incrementing, check `if (roundCount >= totalRounds) → fire completion`.

The bug: **completion check uses pre-increment round count in some paths.** Standalone: completion fires at round 5 (visible as "5/6") with a stale state flag that marks it `wasInterrupted: true` → summary screen shows "Stopped early."

Embedded: same race, but `onPhaseComplete` callback is what would advance the orchestrator. The race sometimes loses the completion event entirely (e.g. fires after state has changed such that the callback no longer satisfies its preconditions), leaving the loop spinning on round=6, no further state advances.

### 1.3 — Fix strategy

**Pre-flight verification** required before writing the fix:

Read `app/lib/providers/breathwork_timer_provider.dart` (or whichever provider drives the loop). Map:
- Where does `_currentRound` increment?
- Where does the completion check fire?
- Is the check before or after the increment?
- Where does `wasInterrupted` / equivalent flag get set?
- Is there a path where natural completion sets `wasInterrupted` rather than a clean completion flag?

**Most likely fix shape:**

```dart
// Wrong (current — hypothesis):
void _onPhaseEnd() {
  if (_currentPhaseIndex < _phases.length - 1) {
    _currentPhaseIndex++;
  } else {
    _currentPhaseIndex = 0;
    _currentRound++;
    if (_currentRound >= _totalRounds) {
      _endSession(interrupted: false);  // OR maybe interrupted: true incorrectly
    }
  }
}

// Right:
void _onPhaseEnd() {
  if (_currentPhaseIndex < _phases.length - 1) {
    _currentPhaseIndex++;
    return;
  }
  // Last phase in cycle — increment round
  final newRound = _currentRound + 1;
  if (newRound >= _totalRounds) {
    // All rounds done — clean completion
    _currentRound = _totalRounds;  // for display
    _endSession(naturallyCompleted: true);
    return;
  }
  _currentRound = newRound;
  _currentPhaseIndex = 0;
}
```

Key principles:
- Determine "session done" BEFORE the count assignment so display shows correct round number
- Differentiate cleanly between "user tapped stop" (interrupted) vs "loop reached end of all rounds" (naturally completed)
- Pass a clear `naturallyCompleted` boolean (or use enum `EndReason {natural, userStop, error}`) down to summary screen

### 1.4 — Test plan for the fix

Pre-flight surfaces the actual file structure. Then:

**Unit test (NEW — first unit test we'll add to T5):**

```dart
// test/providers/breathwork_timer_provider_test.dart
testWidgets('completes naturally at last round with clean state', (tester) async {
  final provider = BreathworkTimerProvider();
  await provider.start(technique: boxBreathing, rounds: 3, isEmbedded: false);
  
  // Simulate ticking through all phases of all rounds
  for (int r = 0; r < 3; r++) {
    for (int p = 0; p < boxBreathing.phases.length; p++) {
      for (int s = 0; s < boxBreathing.phases[p].duration; s++) {
        provider.tick();
      }
    }
  }
  
  expect(provider.currentRound, 3);  // Not 2 (off-by-one)
  expect(provider.isCompleted, true);
  expect(provider.endReason, EndReason.natural);  // Not 'interrupted'
});
```

**Device retest:**
1. Standalone: Breathwork tab → Box Breathing → 5 rounds → run to natural completion → verify summary reads "Completed" with "5/5"
2. Embedded: state-focus calm session → centering with multi-round technique → run to natural completion → verify orchestrator advances to practice stage cleanly
3. Run state-focus calm 5x in a row → confirm no hangs across multiple runs

### 1.5 — Risk

This is the highest-risk fix in T5. The provider has T4 changes layered on top of Sprint 9 code. Touching the loop boundary could regress T4's working cross-pillar phase 1 (breath) which doesn't hang. Pre-flight must trace ALL paths into the completion logic, not just the natural-end path.

---

## Finding 2 — Practice stage missing technique name when embedded

### 2.1 — Symptom

In state-focus practice stage, the animated circle plays correctly but **no technique name label** is shown. In T4 standalone breathwork (Breathwork tab → pick technique → run), the technique name shows above the circle.

### 2.2 — Root cause

T4's `BreathworkPlayer` extraction lost the technique name rendering when `isEmbedded == true`. Likely the title `Widget` was inside an outer Scaffold/AppBar slot in the original `BreathworkTimerPage` and didn't survive the move to a Scaffold-less embedded player.

### 2.3 — Fix

Add technique name as a `Text` above the animated circle inside `BreathworkPlayer`'s body. Always rendered regardless of `isEmbedded` (in standalone, parent page's AppBar shows app context; in embedded, this text gives the user the technique name).

Trivial fix — 1 widget + 1 import. ~10 lines.

---

## Finding 3 — Stage name not visible

### 3.1 — Symptom

During state-focus session, the AppBar reads "Calm" (focus name). The phase indicator strip shows 3 segments with the current stage highlighted, but **no text label tells the user "Centering" / "Practice" / "Reflection"**.

Same issue exists for cross-pillar — AppBar reads "Full Body," no text for "Opening / Warm-up / Strength / Cool-down / Closing" — but it's less critical there because the player body itself communicates pillar (strength has exercise names, yoga has pose names, breath has technique name).

In state-focus, all 3 stages are breathwork — the only differentiator is the stage NAME. Without it, user can't tell which stage they're in.

### 3.2 — Fix

Add a stage-name subtitle row under the AppBar. Format:

```
┌────────────────────────────────────────┐
│  ✕    Calm                           ☰ │   ← AppBar (unchanged)
│       Centering                        │   ← NEW: stage name subtitle
├────────────────────────────────────────┤
│  ──── ──── ────                        │   ← phase indicator strip
│  ...                                    │
```

Use the existing `phaseDisplayLabel()` helper (from T4 fix amendment) — it already maps `centering` → "Centering", `practice` → "Practice", `reflection` → "Reflection".

Apply to both cross-pillar AND state-focus (single change in `MultiPhaseSessionPage`). Subtle gain for cross-pillar (clearer phase context); essential gain for state-focus.

Subtitle styling: smaller font (titleMedium), slightly faded color, single line. Updates when phase changes.

### 3.3 — Effort

~15 lines in `MultiPhaseSessionPage`. AppBar `bottom` slot used to host the subtitle. ~10 min.

---

## Finding 5 — Recover/focus missing 0-10 bracket (FUTURE_SCOPE)

Engine emits `empty` state for the 0-10 bracket on recover and focus state focuses because the seeded breathwork tag taxonomy doesn't have enough beginner-level techniques tagged for `recover_eligible` and `focus_eligible`.

**FUTURE_SCOPE entry — append to FUTURE_SCOPE.md as next sequential #:**

> **#XXX — Recover & Focus breathwork bracket coverage** | Data / Engine | The 0-10 min bracket for `recover` and `focus` state focuses emits `state: 'empty'` in the picker because the breathwork tag taxonomy doesn't have enough beginner-eligible techniques. Audit existing 49 breathwork techniques against the eligibility tags. Either tag more techniques as `recover_eligible` / `focus_eligible` (preferred — likely 3-5 techniques per focus need re-tagging), or relax the engine's threshold for these focuses. Surfaced May 12, 2026 during S14-T5 device test. Affects ~5% of state-focus session attempts (beginner users on recover or focus).

Not a T5 fix.

---

## Finding 6 — User level not visible (FUTURE_SCOPE)

Pillar levels (beginner/intermediate/advanced) are calculated server-side from session counts. No UI surfaces them. User has no way to see "I'm at intermediate strength, beginner yoga, beginner breathwork."

**FUTURE_SCOPE entry — append to FUTURE_SCOPE.md as next sequential #:**

> **#XXX — Profile screen with pillar levels + level progress** | UI / Profile | No profile screen exists. Users can't see their pillar levels (beginner/intermediate/advanced), session counts, level-up progress, or any personal stats. Pillar levels drive engine bracket eligibility but are invisible to the user. Build a Profile tab showing: pillar levels (3 cards), level-up progress bars (sessions to next level), recent session history, lifetime stats. Surfaced May 12, 2026 during S14-T5 device test. Recommended sprint: 15 or 16. Likely a full M ticket on its own.

Not a T5 fix.

---

## Finding 7 — yoga.js double-release + over-restrictive duration floor

### 7.1 — Symptom

During T5 cross-pillar device retest (post Fix 1+2+3 application), full-body session ran phase 1 (Opening breath) and phase 2 (Warm-up yoga) cleanly to UI completion, then crashed when advancing to phase 3 (Strength). The strength player showed "No active session" and the server logged:

```
Error: Release called on client which has already been released to the pool.
  at file:///D:/projects/dailyforge/server/src/routes/yoga.js:534:12
```

### 7.2 — Root cause (two coupled bugs)

**Bug A — double `client.release()`** in `POST /api/yoga/session` (yoga.js, last touched s14-t3, commit f5b3d8f). The handler acquires a pool client at line 474, validates the request body at line 478, and on validation failure releases the client at line 479 then `return`s. The `finally` block at line 533 fires `client.release()` again on the same client — second release crashes.

```javascript
473: router.post('/session', authenticate, async (req, res, next) => {
474:   const client = await pool.connect();
475:   try {
476:     ...
478:     if (isNaN(dur) || dur < 5 || dur > 120) {
479:       client.release();                              // ← RELEASE #1
480:       return res.status(400).json({ error: 'Duration must be between 5 and 120 minutes' });
481:     }
       ...
533:   } finally {
534:     client.release();                                // ← RELEASE #2 (always fires)
535:   }
```

**Bug B — `dur < 5` floor silently rejects embedded cross-pillar sub-phases.** The engine emits `warmup_total` / `cooldown_total` durations as low as 3 minutes for cross-pillar yoga sub-phases. The embedded yoga player sums these per-pose `durationMinutes` into `body.duration` (yoga_session_player.dart:189). For typical 30-min full-body cross-pillar sessions, `warmup` yoga totals 3-4 min — silently rejected by the server's `dur < 5` validation. Yoga session rows never written for these phases. Combined with Bug A, the validation rejection ALSO crashes the pool.

### 7.3 — Why T5 surfaced both

T4 introduced embedded cross-pillar yoga via `YogaSessionPlayer.isEmbedded`. The bugs existed in s14-t3 already but were not exercised by standalone Yoga tab (its duration_selector UI floors at 5 min, so `dur < 5` couldn't fire). T4 device tests likely landed on session lengths where warmup/cooldown yoga totals summed to ≥5 min and the bug stayed silent. T5 device-retesting full-body on a 30-min session hit `totalMin = 3` for warmup — triggered both bugs in a single request.

### 7.4 — Fix

Two-change edit in `server/src/routes/yoga.js`:

1. Remove line 479 `client.release()` — the `finally` block at line 533 is the single release site.
2. Change line 478 floor from `dur < 5` to `dur < 1` (and update the 400 error message). Floor of 1 catches the actual invalid cases (NaN, 0, negative) without rejecting legitimate engine emissions.

```diff
-    if (isNaN(dur) || dur < 5 || dur > 120) {
-      client.release();
-      return res.status(400).json({ error: 'Duration must be between 5 and 120 minutes' });
+    if (isNaN(dur) || dur < 1 || dur > 120) {
+      return res.status(400).json({ error: 'Duration must be between 1 and 120 minutes' });
     }
```

**Pre-flight scan:** grep across all `server/src/routes/*.js` for the `release-then-return-inside-try-with-finally-release` anti-pattern returned **zero other occurrences**. Other handlers either keep `client.release()` only in `finally`, or do early-return validation BEFORE `pool.connect()`. yoga.js was the lone offender.

**Flutter side: no changes.** The error-swallowing at `yoga_session_provider.dart:215` stays — defensive coding for transport failures, not a bug.

### 7.5 — Verification

Device retest cross-pillar full-body 30 min, then query:

```sql
SELECT id, type, duration, focus_slug, multi_phase_session_id, created_at
FROM sessions WHERE type='yoga' ORDER BY id DESC LIMIT 5;
```

Expect: 2 new yoga session rows (warmup + cooldown) with `multi_phase_session_id` FK set.

### 7.6 — Out of scope

- The Flutter-side `catch (e) { return null; }` at yoga_session_provider.dart:215 stays. It's defensive coding for transport failures, not the source of the data-loss (root cause is server rejection, not Flutter silently dropping the response).
- The `dur > 120` upper bound stays — legitimate ceiling, no need to change.

---

## Finding 8 — Screen blacks out mid-session (no wakelock)

### 8.1 — Symptom

Android device screen blacks out after the system display timeout (typically 15-30 seconds) during any active session — breathwork, yoga, strength, cross-pillar, or state-focus. User has to tap the screen periodically to keep it lit, which defeats the purpose of guided sessions.

### 8.2 — Root cause

Pre-existing Sprint 9 gap. The Flutter app never requested an Android wakelock during sessions. Standalone breathwork already had this issue; T5 exposed it more sharply because state-focus sessions are longer single-screen experiences (3 stages × multi-minute legs, intentionally no user touches).

### 8.3 — Fix

Added `wakelock_plus: ^1.2.8` (resolved to 1.5.2) + thin `WakelockService` static wrapper at `app/lib/services/wakelock_service.dart`. Acquired in `initState` and released in `dispose` of:

- `MultiPhaseSessionPage` (state-focus + cross-pillar — added initState + dispose)
- `WorkoutPage` (strength standalone — added wakelock call to existing initState + new dispose)
- `BreathworkTimerPage` (breathwork standalone — converted StatelessWidget → StatefulWidget)
- `YogaSessionPage` (yoga standalone — converted StatelessWidget → StatefulWidget)

`WakelockService.enable()` / `disable()` are idempotent (safe to double-call) and swallow exceptions (wakelock failures are non-fatal — better a darkening screen than a crashed session).

Static-method shape deviates from the instance-with-constructor-DI pattern of [ApiService] / [StorageService] — justified because `WakelockPlus` itself is static and there's no state or dependency to inject. Avoids ceremonial Provider registration for a stateless concern.

### 8.4 — Manifest

No AndroidManifest.xml changes required. `wakelock_plus` 1.5.2 uses `FLAG_KEEP_SCREEN_ON` via the activity (a window flag, not a system permission).

### 8.5 — Edge cases (no special handling needed)

- **App backgrounded mid-session:** Android revokes the wakelock automatically. `initState` re-fires on foreground return if the user re-enters the session page → wakelock re-acquired.
- **User quits via close button:** `dispose` fires on page pop → wakelock released.
- **App killed by OS:** wakelock released by OS.
- **Session completes naturally → navigates home:** `dispose` fires → wakelock released.

### 8.6 — Effort

~30 LOC + 1 package. No tests (UI/platform concern — would require integration test on a real device).

---

## Fix prompt artifact

A separate file `S14-T5-fix-prompt.md` (throwaway) carries the build instructions for fixes 1-3. Finding 7 added later via inline authorization during the device retest. Sequencing: Finding 1 first (highest risk), then 2 + 3 together (both UI-only, low risk), then 7 (server-side; uncovered only after fixes 1-3 enabled the cross-pillar retest to reach phase 3).

---

## Drift log delta

Append to T5 drift log table:

| # | Date | Source | Drift | Resolution |
|---|---|---|---|---|
| D5 | May 12, 2026 | Device test | Breathwork loop boundary bug — off-by-one rounds + auto-completion sets `wasInterrupted: true` instead of clean completion + intermittent hang at last round in embedded mode | Pre-flight + fix-forward in `BreathworkTimerProvider`. NEW unit test added covering natural-completion path. Documented in AMENDMENT-1 §1. |
| D6 | May 12, 2026 | Device test | Practice stage technique name not shown when `isEmbedded == true` | Fix-forward in `BreathworkPlayer` — render technique name above animated circle regardless of embedded state. Documented in AMENDMENT-1 §2. |
| D7 | May 12, 2026 | Device test | Stage name (Centering / Practice / Reflection) not visible during state-focus session — only AppBar focus name shown | Fix-forward in `MultiPhaseSessionPage` — add stage-name subtitle using `phaseDisplayLabel()` helper. Applies to both state-focus and cross-pillar. Documented in AMENDMENT-1 §3. |
| D8 | May 12, 2026 | Device test (false alarm) | Auto-resume not firing | Test methodology issue — `flutter run` mode wipes state. Real app-icon launch auto-resumes correctly. No action. |
| D9 | May 12, 2026 | Device test | Recover/focus 0-10 bracket emits `empty` | Engine/data gap, not T5. Filed as FUTURE_SCOPE. |
| D10 | May 12, 2026 | Device test | User can't see pillar level | UX gap, not T5. Filed as FUTURE_SCOPE. |
| D11 | May 12, 2026 | Device retest (post fixes 1-3) | yoga.js `POST /session`: double `client.release()` on validation failure crashes pool + over-restrictive `dur < 5` floor rejects embedded cross-pillar warmup/cooldown yoga calls (typically 3-4 min) → silent data loss for embedded yoga session rows + server crash on phase 3 advance | 2-line fix in `server/src/routes/yoga.js`: remove the inside-try release at L479; lower floor from `dur < 5` to `dur < 1`. Pre-existing s14-t3 bug; T4 embedded path exercised it; T5 device retest of full-body 30-min surfaced it. Pre-flight grep across all route files confirmed yoga.js was the only offender. Documented in AMENDMENT-1 §7. |
| D12 | May 12, 2026 | Device test | Android screen blacks out mid-session (pre-existing Sprint 9 gap) | Added `wakelock_plus: ^1.2.8` (resolved 1.5.2) + `WakelockService` static wrapper. Acquire on session-page `initState`, release on `dispose`. Covers `MultiPhaseSessionPage` + `WorkoutPage` + `BreathworkTimerPage` (converted to StatefulWidget) + `YogaSessionPage` (converted to StatefulWidget). No manifest changes. Documented in AMENDMENT-1 §8. |

---

## Commit plan delta

T5 ships with:

**Commit 1 — feature commit (T5 base + AMENDMENT-1 fixes)**

```
feat(s14-t5): state-focus 3-leg chain + MultiPhaseSessionProvider base

(original spec body)

AMENDMENT-1 fixes (from device-test findings):
- BreathworkTimerProvider loop boundary bug: off-by-one round count
  + auto-completion sets correct end-reason. Affects both standalone
  breathwork and embedded breathwork (state-focus centering/practice,
  cross-pillar bookend phases). Pre-existing Sprint 9 bug surfaced more
  visibly under T5 multi-stage flow.
- BreathworkPlayer: technique name now renders above animated circle
  in both standalone and embedded modes (T4 extraction had lost the
  label when embedded).
- MultiPhaseSessionPage: stage-name subtitle ("Centering" / "Practice"
  / "Reflection" / "Opening" / etc.) now rendered under AppBar focus
  name in both state-focus and cross-pillar sessions, using existing
  phaseDisplayLabel() helper from S14-T4 amendment.
- yoga.js POST /session: removed double `client.release()` on
  validation-fail path (was crashing the pool on early-return) and
  lowered duration floor from 5 → 1 minute to admit engine-emitted
  embedded cross-pillar warmup/cooldown sub-phases (typically 3-4 min,
  previously silently rejected as 400 → no session row written).
  Pre-existing s14-t3 bug; surfaced during T5 device retest of
  cross-pillar full-body. Pre-flight scan confirmed yoga.js was the
  lone offender (no anti-pattern instances elsewhere).
- wakelock_plus integration: screen stays on during active sessions
  across all 4 player surfaces (MultiPhaseSessionPage + WorkoutPage +
  BreathworkTimerPage + YogaSessionPage). New WakelockService static
  wrapper; idempotent + non-fatal. Pre-existing Sprint 9 gap; T5
  exposed it sharply via state-focus's long single-screen UX.
  Manifest unchanged.

NEW UNIT TEST: breathwork_timer_provider_test.dart covers natural-
completion path at last round.
```

(One commit instead of T5's-base + amendment-fix split, since the fixes land before T5 ever shipped.)

**Commit 2 — tracker chore** (same as original plan)

**Commit 3 — none** (no pre-flight artifacts beyond throwaway)

---

*Authored May 12, 2026 during device-test acceptance. Fix prompt is separate throwaway markdown.*

# S14-T2 — Pre-flight code report

**Date:** 2026-05-08
**Per build prompt §0.2.** Verified by reading files; nothing executed.

---

## Check 1 — `StorageService` API surface (`app/lib/services/storage_service.dart`)

Methods exist but with **wider signatures than spec §5.10 / §5.2 assumed**:

| spec §5.10 / §5.2 assumes | actual signature in repo |
|---|---|
| `Future<String?> getPreference(String key)` | `Future<dynamic> getPreference(String key)` |
| `Future<void> setPreference(String key, String value)` | `Future<void> setPreference(String key, dynamic value)` (already accepts String, int, double, bool) |
| `Future<void> removePreference(String key)` | `Future<void> removePreference(String key)` ✓ exact match |

**Halt? No.** Both `setPreference(String, String)` and `getPreference(String)` work for the spec's usage. The provider's reads will need a cast: `(await storage.getPreference(key)) as String?`. Capture this small adaptation in the build report.

The class also exposes a `_secure` `FlutterSecureStorage` for tokens/users — irrelevant to T2 cross-pillar persistence (T2 uses the `SharedPreferences` non-secure side, same as T1).

---

## Check 2 — `SuggestedSession` JSON round-trip (`app/lib/models/suggested_session.dart`)

**Class names diverge from spec §5.2 assumptions** — capture and adapt:

| spec assumes | actual class name in repo |
|---|---|
| `SuggestedPhase` | `SessionPhase` |
| `SuggestedItem` | `SessionItem` |
| `SuggestedSession` | `SuggestedSession` ✓ |
| `SessionMetadata` | `SessionMetadata` ✓ |

**Field names match spec:**

- `SessionPhase`: `phase` (String), `items` (List<SessionItem>) ✓
- `SessionItem`: `contentType` (String), `name` (String), `durationMinutes` (int?), `sets` (int?), `reps` (int?), `contentId` (int?), `tierBadge` (String?) ✓ (spec didn't list `tierBadge`; harmless extra)
- `SessionMetadata`: `estimatedTotalMin` (int), `userLevels` (Map<String,String>), `source` (String), `isEndless` (bool?), `bracket` (String?), `focusSlug` (String?) ✓

**`toJson` does NOT exist.** Only `fromJson` factories. The build will need to **add `toJson()` to all four classes** (SuggestedSession, SessionPhase, SessionItem, SessionMetadata) to support the persisted snapshot's round-trip in `CrossPillarSessionProvider._persist` / `_PersistedSnapshot.fromJson`.

**Path forward:** in Phase 1.2, add `toJson()` mirroring each `fromJson` exactly. Field names emit in the same snake_case the engine sends (`session_shape`, `content_type`, `duration_minutes`, etc.) so a round-trip through storage stays byte-identical to a freshly-arrived engine response. Tier_badge emitted only when non-null to keep the blob compact. Round-trip sanity check inline: `SuggestedSession.fromJson(suggested.toJson())` should not throw.

---

## Check 3 — `go_router` routes file (`app/lib/config/routes.dart`)

- File location: `app/lib/config/routes.dart` ✓ (matches spec §5.8 prediction)
- Route registration pattern: `GoRoute(path: '/foo', builder: (context, state) => Page())` — note `(context, state)` not `(_, __)`; build will mirror that.
- `/session/cross-pillar` does NOT collide with any existing route (existing: /login, /register, /workout, /workout/empty, /workout/resume, /breathwork/:id, /yoga/session, /yoga/complete, /exercise-history, /body-measurements, /body-measurements/month, /spike/body-map, /onboarding/level-capture/{strength,yoga,breathwork}, /body, /exercise-progress/:id, plus shell-route children /home, /strength, /yoga, /breathwork, /profile).
- `/session/cross-pillar` will be a top-level route (NOT inside the `ShellRoute`) — same pattern as `/workout` so the cross-pillar player takes the full screen with no bottom nav, matching the existing strength player UX.

---

## Check 4 — `main.dart` provider tree

- `MultiProvider` is the registration mechanism ✓
- Existing pattern: `late final` field instantiated in `initState`, disposed in `dispose`, registered as `ChangeNotifierProvider<X>.value(value: _xProvider)`.
- `WorkoutSessionProvider` and `SuggestProvider` both registered (T1 left these intact).
- `CrossPillarSessionProvider` follows same pattern: instantiated as `late final _crossPillarSessionProvider = CrossPillarSessionProvider()` in `initState` (no constructor args needed — provider is storage-agnostic; storage is passed per call), disposed in `dispose`, registered via `.value`.

---

## Check 5 — `SessionLauncher` current state (`app/lib/launchers/session_launcher.dart`)

- Cross_pillar throw — exact text:

  ```dart
  case 'cross_pillar':
    throw UnimplementedError(
      'cross_pillar shape lands in S14-T2 (5-phase orchestrator).',
    );
  ```

- State_focus throw — exact text:

  ```dart
  case 'state_focus':
    throw UnimplementedError(
      'state_focus shape lands in S14-T5 (3-leg chain).',
    );
  ```

- Pillar_pure non-strength throw (preserved by T1 — rolls to T3):

  ```dart
  if (!allStrength) {
    throw UnimplementedError(
      'pillar_pure non-strength (yoga/breathwork) lands in S14-T3.',
    );
  }
  ```

- `_friendlyError(ApiException)` helper exists; maps server error codes to copy. Wraps the strength branch's `provider.startFromList` call. Outer try/catch is **per-branch**, not around the whole switch — this means `_launchCrossPillar` will need its own try/catch (or the cross_pillar branch needs a dispatch-level wrapper). Build will use the per-branch pattern: any throw inside `_launchCrossPillar` is caught and surfaced via a generic snackbar (no API call to map error codes against, so the existing `_friendlyError` map doesn't directly apply — `_launchCrossPillar` only deals with client-side `StateError` and the resume-dialog flow).

  **Revision to spec §5.1 implementation note:** the spec's implementation snippet says "the existing T1 try/catch around the switch should already catch any throws from `_launchCrossPillar`. Confirm and don't duplicate the wrapper." — that is **wrong**. The T1 try/catch is around `provider.startFromList`, not around the dispatch switch. The build will add a try/catch *inside* `_launchCrossPillar` to gracefully snackbar on `StateError`, mirroring the strength branch's approach (catch → snackbar → return). Capture in the build report.

---

## Check 6 — `home_page._onStart` current placeholder (`app/lib/pages/home/home_page.dart`)

Current text (lines 130–145):

```dart
void _onStart() {
  // S14-T1 reroute (Amendment 1): home Start does not launch yet — home
  // produces `cross_pillar` sessions, which T1's launcher does not handle.
  // S14-T2 promotes cross_pillar and wires home Start to the launcher.
  // Until then, point users at the Strength tab where T1's strength_only
  // path is wired.
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text(
        "Strength workouts available now from the Strength tab. "
        "Full home flow lands in S14-T2.",
      ),
      duration: Duration(seconds: 3),
    ),
  );
}
```

- `SessionLauncher` is **not** imported (the T1-reroute amendment 1 commit removed the import). T2 will re-add: `import '../../launchers/session_launcher.dart';`.
- Function will become `Future<void> _onStart() async`. The current `_onStart` callback is passed to `_SessionSlot.onStart` as a `VoidCallback` (sync). Flutter's button `onPressed` is `VoidCallback?`, which cleanly accepts async void via `() => _onStart()` or directly when fire-and-forget — but the existing `onStart: _onStart` reference passes the function itself. To keep the call sites unchanged, `_onStart` can be declared `void _onStart() async { ... }` (returns `void`, runs async work fire-and-forget). Capture this small note.

---

## Check 7 — App lifecycle observer

`grep -r "WidgetsBindingObserver|didChangeAppLifecycleState"` over `app/lib`: **no matches**. The repo currently does NOT observe app lifecycle anywhere.

**T2 implication (per build prompt §0.2 Check 7):** T2 does NOT add a lifecycle observer. Background/foreground in T2 just works because Flutter does not tear down the page; in-memory provider state is preserved. Cold-start resume is handled by the orchestrator's StorageService persistence. Phone-test step 8 (background, foreground without force-stop) and step 9 (force-stop, cold-launch resume) both pass via existing mechanisms.

---

## Check 8 — `BuildContext` discipline

Existing T1 example in `_launchPillarPure`:

```dart
} on ApiException catch (e) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(...);
  return;
}
...
if (!context.mounted) return;
context.go('/workout');
```

Pattern: `if (!context.mounted) return;` after every `await`. Build will mirror exactly across `_launchCrossPillar`, `home_page._onStart`, and `FivePhaseSessionPage._confirmDiscard`.

---

## Repo-convention reminders absorbed

(per build prompt §"Repo convention reminders")

- `ApiConfig.baseUrl` already ends in `/api` — T2 has no HTTP work, n/a.
- HTTP via `ApiService` — n/a for T2.
- Persistence via `StorageService` — confirmed in spec §5.2 / §5.10. ✓
- Providers extend `ChangeNotifier` — confirmed in spec §5.2. ✓
- No `print(...)` — will not introduce. ✓
- Match existing `MultiProvider` pattern in `main.dart` — Check 4 confirms. ✓

---

## Summary of build-time spec adaptations

These are not architectural drift — they are mechanical adjustments where the spec's pseudocode names the wrong identifier or assumes an over-tight signature. None require an amendment doc; all are captured here.

1. **Class name:** `SuggestedPhase` / `SuggestedItem` → `SessionPhase` / `SessionItem` (matches `app/lib/models/suggested_session.dart`).
2. **`toJson` missing on all 4 model classes** — Phase 1.2 adds them mirroring `fromJson`.
3. **`StorageService.getPreference` returns `Future<dynamic>`, not `Future<String?>`** — provider casts at the boundary.
4. **Per-branch try/catch in launcher** (not switch-wrapping per spec §5.1's implementation note). Mirror T1's strength branch pattern.
5. **`_PersistedSnapshot` exposure for resume freshness check** — public class `CrossPillarSessionSnapshot` (preferred) so the launcher can read `snapshot.startedAt` after `peekFromStorage`. Cleaner than the alternative of exposing only the timestamp.
6. **`/session/cross-pillar` placed as top-level route** (sibling to `/workout`), NOT inside the `ShellRoute` — matches existing player UX (no bottom nav while a session runs).
7. **`_onStart`** declared as `void _onStart() async { ... }` so existing `onStart: _onStart` callbacks at the call site stay byte-identical.

---

## Halt-on-drift summary

**Engine-shape drift fired** — see `S14-T2-PREFLIGHT-engine-shapes.md` (biceps emits 4-phase). Code-report drift items above are mechanical adaptations only; none warrant their own amendment.

**Status: HALT pending architect direction on the biceps drift.**

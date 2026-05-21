# S16-T1 — ApiService consumer inventory

Captured during pre-flight (b) of S16-T1. Documents every call site of `ApiService.{get, getList, post, put, delete}` under `app/lib/`. This file's purpose is to establish blast radius for the consolidation refactor and to justify the resolved open question on whether `getList` should fold into a generic `get<T>()` (answer: no — see §3 below).

**Captured:** 2026-05-19, against branch `s16-t1` (off `main` SHA 6e97cb4).

---

## 1. Call sites by method

### `_api.get(...)` / `api.get(...)`

| File | Line | Path expression | withAuth |
|---|---|---|---|
| `app/lib/services/body_map_service.dart` | 29 | `/body-map/muscle-volumes?range=$range` | default (true) |
| `app/lib/services/body_map_service.dart` | 37 | `/body-map/flexibility?range=$range` | default (true) |
| `app/lib/services/onboarding_service.dart` | 35 | `ApiConfig.myPillarLevels` | default (true) |
| `app/lib/services/home_service.dart` | 17 | `ApiConfig.homeStats` | default (true) |
| `app/lib/services/home_service.dart` | 22 | `ApiConfig.homeWeeklyActivity` | default (true) |
| `app/lib/services/home_service.dart` | 32 | `ApiConfig.homeDailyLoad` | default (true) |
| `app/lib/services/home_service.dart` | 37 | `ApiConfig.homeDailyCounts` | default (true) |
| `app/lib/services/streaks_service.dart` | 22 | `/users/me/streaks$qp` | default (true) |
| `app/lib/services/focus_duration_service.dart` | 23 | `ApiConfig.focusAreaAvailableDurations(slug)` | default (true) |
| `app/lib/services/focus_duration_service.dart` | 43 | `ApiConfig.focusAreaSuggestedDefault(slug)` | default (true) |
| `app/lib/services/yoga_service.dart` | 42 | `/yoga/generate?$qs` | default (true) |
| `app/lib/services/yoga_service.dart` | 49 | `/yoga/recent` | default (true) |
| `app/lib/services/focus_areas_service.dart` | 15 | `ApiConfig.focusAreas` | default (true) |
| `app/lib/services/breathwork_service.dart` | 22 | `${ApiConfig.breathworkTechniques}/$id` | default (true) |
| `app/lib/providers/calendar_provider.dart` | 44 | `/session/calendar?month=$monthStr` | default (true) |
| `app/lib/providers/body_measurements_provider.dart` | 208 | `ApiConfig.bodyMeasurementsStats` | default (true) |
| `app/lib/providers/dashboard_provider.dart` | 58 | `ApiConfig.dashboard` | default (true) |
| `app/lib/providers/dashboard_provider.dart` | 62 | `ApiConfig.workoutToday` | default (true) |
| `app/lib/providers/profile_provider.dart` | 36 | `/users/profile` | default (true) |
| `app/lib/providers/progress_provider.dart` | 35 | `/progress/exercises` | default (true) |
| `app/lib/providers/strength_provider.dart` | 63 | `path` (dynamic) | default (true) |
| `app/lib/providers/strength_provider.dart` | 88 | `ApiConfig.exerciseMuscleGroups` | default (true) |
| `app/lib/providers/strength_provider.dart` | 101 | `ApiConfig.routines` | default (true) |
| `app/lib/providers/settings_provider.dart` | 49 | `ApiConfig.settings` | default (true) |
| `app/lib/providers/workout_session_provider.dart` | 423 | `ApiConfig.sessionActive` | default (true) |
| `app/lib/providers/workout_session_provider.dart` | 466 | `ApiConfig.exercise(id)` | default (true) |
| `app/lib/providers/workout_session_provider.dart` | 745 | `${ApiConfig.sessionPreviousPerformance}?exerciseIds=$ids` | default (true) |
| `app/lib/providers/yoga_session_provider.dart` | 164 | `/yoga/alternatives?$qs` | default (true) |
| `app/lib/widgets/workout/add_exercise_sheet.dart` | 109 | `ApiConfig.exerciseMuscleGroups` | default (true) |
| `app/lib/widgets/workout/add_exercise_sheet.dart` | 143 | `path` (dynamic) | default (true) |
| `app/lib/pages/workout_page.dart` | 84 | `ApiConfig.routine(routineId)` | default (true) |

**Total `get` call sites: 31.**

### `_api.getList(...)`

| File | Line | Path expression | withAuth |
|---|---|---|---|
| `app/lib/services/body_map_service.dart` | 45 | `/body-map/recent-wins?limit=$limit` | default (true) |
| `app/lib/services/breathwork_service.dart` | 14 | `${ApiConfig.breathworkTechniques}$qs` | default (true) |
| `app/lib/providers/body_measurements_provider.dart` | 198 | `${ApiConfig.bodyMeasurements}?limit=500` | default (true) |

**Total `getList` call sites: 3.**

### `_api.post(...)` / `api.post(...)`

| File | Line | Path expression | withAuth |
|---|---|---|---|
| `app/lib/services/auth_service.dart` | 15 | (login path) | **explicit `withAuth: false`** (see §4) |
| `app/lib/services/auth_service.dart` | 38 | (register path) | **explicit `withAuth: false`** (see §4) |
| `app/lib/services/onboarding_service.dart` | 21 | `ApiConfig.pillarLevels` | default (true) |
| `app/lib/services/yoga_service.dart` | 16 | `/yoga/poses-by-ids` | default (true) |
| `app/lib/services/suggest_service.dart` | 47 | `ApiConfig.sessionsSuggest` | default (true) |
| `app/lib/services/breathwork_service.dart` | 45 | `ApiConfig.breathworkSessions` | default (true) |
| `app/lib/providers/body_measurements_provider.dart` | 274 | `ApiConfig.bodyMeasurements` | default (true) |
| `app/lib/providers/multi_phase_session_provider.dart` | 320 | `/multi-phase-sessions` | default (true) |
| `app/lib/providers/workout_session_provider.dart` | 178 | `ApiConfig.sessionStart` | default (true) |
| `app/lib/providers/workout_session_provider.dart` | 223 | `ApiConfig.sessionStart` | default (true) |
| `app/lib/providers/workout_session_provider.dart` | 264 | `ApiConfig.sessionsStartFromList` | default (true) |
| `app/lib/providers/yoga_session_provider.dart` | 211 | `/yoga/session` | default (true) |
| `app/lib/widgets/workout/save_routine_sheet.dart` | 102 | `ApiConfig.routines` | default (true) |

**Total `post` call sites: 13.** (`withAuth: false`: 2 of 13 — both in `auth_service.dart`.)

### `_api.put(...)`

| File | Line | Path expression |
|---|---|---|
| `app/lib/providers/body_measurements_provider.dart` | 286 | `ApiConfig.bodyMeasurement(id)` |
| `app/lib/providers/workout_session_provider.dart` | 314 | `ApiConfig.sessionLogSet(_sessionId!)` |
| `app/lib/providers/workout_session_provider.dart` | 548 | `/workout/slot/$originalExerciseId/choose` |
| `app/lib/providers/workout_session_provider.dart` | 595 | `ApiConfig.sessionComplete(_sessionId!)` |
| `app/lib/providers/profile_provider.dart` | 49 | `/users/profile` |
| `app/lib/providers/profile_provider.dart` | 64 | `/users/profile` |
| `app/lib/providers/settings_provider.dart` | 70 | `ApiConfig.settings` |

**Total `put` call sites: 7.** All authed (PUT does not expose `withAuth` today; `_send`'s default is `true`).

### `_api.delete(...)`

| File | Line | Path expression |
|---|---|---|
| `app/lib/providers/body_measurements_provider.dart` | 298 | `ApiConfig.bodyMeasurement(id)` |
| `app/lib/providers/workout_session_provider.dart` | 507 | `ApiConfig.sessionDelete(sessionId)` |
| `app/lib/providers/workout_session_provider.dart` | 618 | `ApiConfig.sessionDelete(_sessionId!)` |
| `app/lib/providers/strength_provider.dart` | 115 | `${ApiConfig.routines}/$id` |

**Total `delete` call sites: 4.** All authed.

---

## 2. Aggregate

| Method | Call sites |
|---|---|
| `get` | 31 |
| `getList` | 3 |
| `post` | 13 (2 unauth) |
| `put` | 7 |
| `delete` | 4 |
| **Total** | **58** |

Service layer files (under `app/lib/services/`) that wrap `ApiService`: 11 (`AuthService`, `BodyMapService`, `BreathworkService`, `FocusAreasService`, `FocusDurationService`, `HomeService`, `OnboardingService`, `StreaksService`, `SuggestService`, `WakelockService` (no API calls), `YogaService`). The 11 mentioned in the spec is the layer count, not the call-site count — the call-site count is **58**.

---

## 3. Resolved open question: keep `getList` as a wrapper

The Sprint 16 outline asked whether `getList` should fold into a generic `get<T>()`. Resolved at spec time, confirmed by this inventory:

- Only **3 call sites** use `getList`. Folding into `get<List<dynamic>>()` would require touching those 3 sites to add a type parameter.
- Folding into `get<T>()` would require touching all **31** `get` call sites too — adding `<Map<String, dynamic>>` everywhere is noisy and adds no behavioral value.
- Net change: 34 call-site edits for zero behavioral gain. Drift surface (which is what S16-T1 exists to eliminate) is in the implementation, not the signature. Consolidating the core via `_sendRaw` removes 100% of the drift surface; renaming/genericizing the wrapper removes 0% of it.

`getList` stays as a thin wrapper.

---

## 4. Notes on call-site patterns

- **`_api` is the canonical identifier name.** Services and providers that hold an `ApiService` reference store it as `_api` (or `_apiService` only in `AuthProvider`). Pages and widgets use `api = context.read<ApiService>()`.
- **`withAuth: false` is used in exactly two places**, both in `AuthService` (`login`, `register`). Neither has `withAuth: true` as a sibling call. The flag's purpose is satisfied by these two and nothing else today.
- **No consumer catches `UnauthorizedException` and calls logout manually.** All `on UnauthorizedException` blocks under `app/lib/` are either bare-no-op (`focus_duration_provider.dart`, `suggest_provider.dart`) or `rethrow` (`focus_duration_service.dart`, `suggest_service.dart`). The global logout flow runs exactly once via `AuthProvider._handleUnauthorized` (wired in `AuthProvider:22` via `_apiService.onUnauthorized = _handleUnauthorized`). No double-fire risk.

---

## 5. Why this file exists

Per S16-T1 spec §"Pre-flight diagnostics (b)", every call site is enumerated so a reviewer can verify the consolidation refactor preserves them without compile-time edits. After feat merge, this file becomes the canonical "what does `ApiService` do today, and where" reference until S16-T2 (typed engine errors + endpoint-aware timeouts) shifts the picture again.

Committed in the chore commit (not the feat commit) per PI three-commit pattern.

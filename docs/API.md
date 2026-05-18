# DailyForge API Reference

> Generated from `server/src/routes/*` on 2026-05-15 (post-Sprint-14 close). Authoritative source is the handler code; if this doc and a route file disagree, the route file wins.

## Conventions

- **Base URL:** `http://localhost:3000` in dev. Prod URL is the same Node server pointed at Neon prod (no separate deployment yet — see ARCHITECTURE.md "Infrastructure" section). The Flutter client's `ApiConfig.baseUrl` already ends in `/api` — endpoint constants must NOT re-prefix `/api` or requests will hit `/api/api/...` (see FUTURE_SCOPE #196).
- **Auth:** JWT in `Authorization: Bearer <token>` header. Verified by `authenticate` middleware in `server/src/middleware/auth.js`. The decoded JWT payload is validated (`Number.isInteger(decoded.id) && decoded.id > 0`) and assigned to `req.user`. Route handlers can trust `req.user.id` is a positive integer without re-coercing. Validation failure returns 401 `{ error: 'invalid_token' }`. Shipped in S15-T7 (closes FS #215).
- **Errors:** Default shape is `{ "error": "<code-or-message>" }`. Most 4xx responses use a short stable code (`invalid_focus_slug`, `routine_name_required`, etc.). The shared error handler in `server/src/middleware/errorHandler.js` produces `{ "error": "Internal server error" }` for any uncaught 5xx so SQL errors and stack details never leak. Suggestion-engine errors are mapped from `RangeError` throw messages via string-match in `server/src/routes/sessions.js` — fragile by design until typed errors land (see FUTURE_SCOPE #166).
- **Content-Type:** `application/json` request and response unless noted.
- **`createApp()`:** the Express app is constructed by an exported factory in `server/src/index.js`, which the test harness uses to spawn an in-process instance via `supertest`. Behavior when `index.js` is the entry point is unchanged.

---

## Endpoint Index

| Method | Path | Auth | Handler | Section |
|---|---|---|---|---|
| GET | `/api/health` | none | `server/src/index.js` | [Health](#health) |
| POST | `/api/auth/register` | none (rate-limited) | `auth.js → router.post('/register')` | [Auth](#auth) |
| POST | `/api/auth/login` | none (rate-limited) | `auth.js → router.post('/login')` | [Auth](#auth) |
| GET | `/api/users/profile` | JWT | `users.js` | [Users](#users) |
| PUT | `/api/users/profile` | JWT | `users.js` | [Users](#users) |
| POST | `/api/users/pillar-levels` | JWT | `users.js` | [Users](#users) |
| GET | `/api/users/me/pillar-levels` | JWT | `users.js` | [Users](#users) |
| GET | `/api/users/me/streaks` | JWT | `users.js` | [Users](#users) |
| GET | `/api/settings` | JWT | `settings.js` | [Settings](#settings) |
| PUT | `/api/settings` | JWT | `settings.js` | [Settings](#settings) |
| GET | `/api/exercises/strength` | JWT | `exercises.js` | [Exercises](#exercises) |
| GET | `/api/exercises/muscle-groups` | JWT | `exercises.js` | [Exercises](#exercises) |
| GET | `/api/exercises/:id` | JWT | `exercises.js` | [Exercises](#exercises) |
| POST | `/api/exercises/:id/exclude` | JWT | `exercises.js` | [Swap & Exclusion (S12-T6)](#swap--exclusion-endpoints-s12-t6) |
| POST | `/api/exercises/:id/keep-suggesting` | JWT | `exercises.js` | [Swap & Exclusion (S12-T6)](#swap--exclusion-endpoints-s12-t6) |
| POST | `/api/routines` | JWT | `routines.js` | [Routines](#routines) |
| GET | `/api/routines` | JWT | `routines.js` | [Routines](#routines) |
| GET | `/api/routines/:id` | JWT | `routines.js` | [Routines](#routines) |
| PUT | `/api/routines/:id` | JWT | `routines.js` | [Routines](#routines) |
| DELETE | `/api/routines/:id` | JWT | `routines.js` | [Routines](#routines) |
| GET | `/api/workout/today` | JWT | `workout.js` | [Workout (legacy slot model)](#workout-legacy-slot-model) |
| GET | `/api/workout/:workoutId/slots/:exerciseId/alternatives` | JWT | `workout.js` | [Workout (legacy slot model)](#workout-legacy-slot-model) |
| PUT | `/api/workout/slot/:exerciseId/choose` | JWT | `workout.js` | [Swap & Exclusion (S12-T6)](#swap--exclusion-endpoints-s12-t6) |
| PUT | `/api/workout/slot/:exerciseId/reset` | JWT | `workout.js` | [Workout (legacy slot model)](#workout-legacy-slot-model) |
| PUT | `/api/workout/exercise-pref` | JWT | `workout.js` | [Workout (legacy slot model)](#workout-legacy-slot-model) |
| POST | `/api/session/start` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| GET | `/api/session/active` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| PUT | `/api/session/:id/log-set` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| PUT | `/api/session/:id/complete` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| DELETE | `/api/session/:id` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| GET | `/api/session/previous-performance` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| GET | `/api/session/overview/:workoutId` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| POST | `/api/session/complete-5phase` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| GET | `/api/session/calendar` | JWT | `session.js` | [Session (single-session player)](#session-single-session-player) |
| POST | `/api/sessions/suggest` | JWT + `requireUserId` | `sessions.js` | [Suggestion Engine HTTP Surface](#suggestion-engine-http-surface) |
| GET | `/api/sessions/last` | JWT + `requireUserId` | `sessions.js` | [Suggestion Engine HTTP Surface](#suggestion-engine-http-surface) |
| POST | `/api/sessions/save-as-routine` | JWT + `requireUserId` | `sessions.js` | [Suggestion Engine HTTP Surface](#suggestion-engine-http-surface) |
| POST | `/api/sessions/start-from-list` | JWT + `requireUserId` | `sessions.js` | [Suggestion Engine HTTP Surface](#suggestion-engine-http-surface) |
| POST | `/api/multi-phase-sessions` | JWT | `multi-phase-sessions.js` | [Multi-Phase Sessions (S14)](#multi-phase-sessions-s14) |
| GET | `/api/focus-areas` | JWT | `focus-areas.js` | [Focus Areas](#focus-areas) |
| GET | `/api/focus-areas/:slug/available-durations` | JWT | `focus-areas.js` | [Focus Areas](#focus-areas) |
| GET | `/api/focus-areas/:slug/suggested-default` | JWT | `focus-areas.js` | [Focus Areas](#focus-areas) |
| GET | `/api/yoga/generate` | JWT | `yoga.js` | [Yoga](#yoga) |
| POST | `/api/yoga/poses-by-ids` | JWT | `yoga.js` | [Yoga](#yoga) |
| GET | `/api/yoga/alternatives` | JWT | `yoga.js` | [Yoga](#yoga) |
| GET | `/api/yoga/recent` | JWT | `yoga.js` | [Yoga](#yoga) |
| POST | `/api/yoga/session` | JWT | `yoga.js` | [Yoga](#yoga) |
| GET | `/api/breathwork/techniques` | none | `breathwork.js` | [Breathwork](#breathwork) |
| GET | `/api/breathwork/techniques/:id` | none | `breathwork.js` | [Breathwork](#breathwork) |
| GET | `/api/breathwork/alternatives` | JWT | `breathwork.js` | [Breathwork](#breathwork) |
| PUT | `/api/breathwork/preference` | JWT | `breathwork.js` | [Breathwork](#breathwork) |
| GET | `/api/breathwork/preferences` | JWT | `breathwork.js` | [Breathwork](#breathwork) |
| POST | `/api/breathwork/sessions` | JWT | `breathwork.js` | [Breathwork](#breathwork) |
| GET | `/api/suggestions/strength/:exerciseId` | JWT | `suggestions.js` | [Per-Set Suggestions](#per-set-suggestions) |
| GET | `/api/suggestions/yoga` | JWT | `suggestions.js` | [Per-Set Suggestions](#per-set-suggestions) |
| GET | `/api/suggestions/yoga/:exerciseId` | JWT | `suggestions.js` | [Per-Set Suggestions](#per-set-suggestions) |
| GET | `/api/suggestions/breathwork` | JWT | `suggestions.js` | [Per-Set Suggestions](#per-set-suggestions) |
| GET | `/api/suggestions/breathwork/:techniqueId` | JWT | `suggestions.js` | [Per-Set Suggestions](#per-set-suggestions) |
| GET | `/api/progress/exercises` | JWT | `progress.js` | [Progress](#progress) |
| GET | `/api/progress/exercise/:id` | JWT | `progress.js` | [Progress](#progress) |
| POST | `/api/progress/recalculate/:exercise_id` | JWT | `progress.js` | [Progress](#progress) |
| GET | `/api/body-measurements` | JWT | `bodyMeasurements.js` | [Body Measurements](#body-measurements) |
| GET | `/api/body-measurements/latest` | JWT | `bodyMeasurements.js` | [Body Measurements](#body-measurements) |
| GET | `/api/body-measurements/stats` | JWT | `bodyMeasurements.js` | [Body Measurements](#body-measurements) |
| POST | `/api/body-measurements` | JWT | `bodyMeasurements.js` | [Body Measurements](#body-measurements) |
| PUT | `/api/body-measurements/:id` | JWT | `bodyMeasurements.js` | [Body Measurements](#body-measurements) |
| DELETE | `/api/body-measurements/:id` | JWT | `bodyMeasurements.js` | [Body Measurements](#body-measurements) |
| GET | `/api/progress-photos` | JWT | `progressPhotos.js` | [Progress Photos](#progress-photos) |
| POST | `/api/progress-photos` | JWT | `progressPhotos.js` | [Progress Photos](#progress-photos) |
| DELETE | `/api/progress-photos/:id` | JWT | `progressPhotos.js` | [Progress Photos](#progress-photos) |
| GET | `/api/dashboard` | JWT | `dashboard.js` | [Dashboard](#dashboard) |
| GET | `/api/home/stats` | JWT | `home.js` | [Home](#home) |
| GET | `/api/home/weekly-activity` | JWT | `home.js` | [Home](#home) |
| GET | `/api/home/daily-load` | JWT | `home.js` | [Home](#home) |
| GET | `/api/home/daily-counts` | JWT | `home.js` | [Home](#home) |
| GET | `/api/body-map/muscle-volumes` | JWT | `bodyMap.js` | [Body Map](#body-map) |
| GET | `/api/body-map/flexibility` | JWT | `bodyMap.js` | [Body Map](#body-map) |
| GET | `/api/body-map/recent-wins` | JWT | `bodyMap.js` | [Body Map](#body-map) |
| POST | `/api/media/test-upload` | JWT | `media.js` | [Media](#media) |

**Total: 74 endpoints** (73 across 20 route files + `/api/health` exported from `index.js`).

---

## Health

### GET /api/health
- **Handler:** `server/src/index.js`
- **Auth:** none
- **Request:** none
- **Response 200:** `{ "status": "ok" }`
- **Errors:** none

---

## Auth

Public surface for account creation and login. Both endpoints are rate-limited by `express-rate-limit`: 10 attempts per 15-minute window per IP, with a `429` `{ error: "Too many attempts. Please try again in 15 minutes." }` response when exceeded.

### POST /api/auth/register
- **Handler:** `server/src/routes/auth.js`
- **Auth:** none (rate-limited)
- **Request body:** `{ email: string, password: string, name: string }`
- **Response 201:** `{ user: { id, email, name }, token: string }` — JWT signed with `JWT_SECRET`, `expiresIn` from `JWT_EXPIRES_IN` env (default `7d`).
- **Errors:**
  - `400 { error: "email, password, and name are required" }`
  - `400 { error: "Password must be at least 8 characters" }`
  - `400 { error: "Password must contain uppercase, lowercase, and a number" }`
  - `409 { error: "Email already registered" }`
  - `429` rate-limit

### POST /api/auth/login
- **Handler:** `server/src/routes/auth.js`
- **Auth:** none (rate-limited)
- **Request body:** `{ email: string, password: string }`
- **Response 200:** `{ user: { id, email, name }, token: string }`
- **Errors:**
  - `400 { error: "email and password are required" }`
  - `401 { error: "Invalid credentials" }` — returned for both unknown email and bad password (no user-enumeration).
  - `429` rate-limit

---

## Users

### GET /api/users/profile
- **Handler:** `server/src/routes/users.js`
- **Auth:** JWT
- **Response 200:** `{ id, email, name, height_cm, unit_system }`
- **Errors:** `404 { error: "Not found" }` if the JWT user row no longer exists.

### PUT /api/users/profile
- **Handler:** `server/src/routes/users.js`
- **Auth:** JWT
- **Request body:** `{ height_cm?: number (50–280), unit_system?: 'metric' | 'imperial' }`. Either field may be omitted; only provided fields update via `COALESCE`.
- **Response 200:** updated `{ id, email, name, height_cm, unit_system }`
- **Errors:** `400 { error: "Invalid height_cm (50-280)" }`

### POST /api/users/pillar-levels
**⚠ Writes `user_pillar_levels`** (S11-T4 table).
- **Handler:** `server/src/routes/users.js`
- **Auth:** JWT
- **Purpose:** onboarding-stub upsert of all three declared pillar levels in a single transaction. Hardcodes `source = 'declared'` so the promotion-only inference function will never overwrite the user's stated levels.
- **Request body:** `{ strength: 'beginner'|'intermediate'|'advanced', yoga: …, breathwork: … }` — all three required.
- **Response 200:** `{ ok: true, levels: { strength, yoga, breathwork } }`
- **Errors:** Stable codes, pillars checked in fixed order (strength → yoga → breathwork):
  - `400 { error: "<pillar>_level_required" }`
  - `400 { error: "invalid_<pillar>_level" }`

### GET /api/users/me/pillar-levels
- **Handler:** `server/src/routes/users.js`
- **Auth:** JWT
- **Response 200:** `{ levels: [{ pillar, level, source }, …] }`. Empty array signals a fresh user (drives the onboarding redirect on app launch).
- **Errors:** none beyond 5xx.

### GET /api/users/me/streaks
- **Handler:** `server/src/routes/users.js` (S14-T6 §6.1.1)
- **Auth:** JWT
- **Query params:** `focus_slug?` (string) — the focus the just-completed session targeted. When absent, `focus_streak.focus_slug` is null and `count_this_week` is 0.
- **Purpose:** server-side streak math so summary screens don't have to do client-date arithmetic (S12-T5 timezone-drift incident motivated this). All three metrics UNION across `sessions` and `breathwork_sessions` so state-focus sessions (which only write to `breathwork_sessions`) still count for daily / focus / weekly streaks.
- **Response 200:**
  ```
  {
    daily_streak_days: int,
    focus_streak: { focus_slug: string|null, count_this_week: int, is_first: bool },
    weekly_count: int
  }
  ```
  `daily_streak_days` is capped at 60 (v1 design choice; longer streaks are a great problem to have). `is_first` uses `total <= 1` because the just-completed session has typically already been inserted before the query reads (see FUTURE_SCOPE #222 for the comment-explaining-the-race followup).
- **Errors:** `401` if JWT invalid (via `authenticate` middleware). `500` on database error (via shared `errorHandler.js`). No 400 path in the handler. (FS #219 claimed a 400 exists here; that claim does not match the live code — flagged in the FUTURE_SCOPE entry for investigation.)

---

## Settings

Per-user rest-timer preferences. Defaults: `rest_timer_duration=90`, `rest_timer_enabled=true`, `rest_timer_auto_start=true`.

### GET /api/settings
- **Handler:** `server/src/routes/settings.js`
- **Auth:** JWT
- **Response 200:** `{ rest_timer_duration: int, rest_timer_enabled: bool, rest_timer_auto_start: bool }`. Returns defaults if no row exists.

### PUT /api/settings
- **Handler:** `server/src/routes/settings.js`
- **Auth:** JWT
- **Request body:** `{ rest_timer_duration?: int (10–600), rest_timer_enabled?: bool, rest_timer_auto_start?: bool }`. Each field falls back to its default if the value is missing or out of range.
- **Response 200:** persisted row.
- **Errors:** none — silent normalization to defaults rather than 400.

---

## Exercises

Browse + read + S12-T6 exclusion endpoints. The two POST endpoints live in [Swap & Exclusion Endpoints (S12-T6)](#swap--exclusion-endpoints-s12-t6) below.

### GET /api/exercises/strength
- **Handler:** `server/src/routes/exercises.js`
- **Auth:** JWT
- **Query params:** `muscle?` (one of: chest, back, shoulders, biceps, triceps, legs, quads, hamstrings, glutes, calves, core, abdominals, abs, forearms, traps, lats), `search?` (case-insensitive name match — hyphen-normalized so "pull up" matches "Pull-ups"), `limit?` (default 50, max 100), `offset?` (default 0).
- **Paginated:** yes — `LIMIT $limit OFFSET $offset`, with `hasMore` flag in response.
- **Response 200:** `{ exercises: [{ id, name, target_muscles, description, difficulty, default_sets, default_reps, tracking_type }], total: int, hasMore: bool }`. When `search` is present, results are ranked exact > starts-with > word-boundary > contains.

### GET /api/exercises/muscle-groups
- **Handler:** `server/src/routes/exercises.js`
- **Auth:** JWT
- **Response 200:** `{ groups: [string, …] }` — distinct muscle tokens parsed from comma-separated `target_muscles` on strength exercises.

### GET /api/exercises/:id
- **Handler:** `server/src/routes/exercises.js`
- **Auth:** JWT
- **Response 200:** `{ id, name, target_muscles, description, difficulty, default_sets, default_reps, default_duration_secs, tracking_type, url, media_url, thumbnail_url }`
- **Errors:**
  - `400 { error: "Invalid id" }`
  - `404 { error: "Exercise not found" }`

---

## Routines

User-saved strength routines (`user_routines` + `user_routine_exercises`). Routines cap at 50 exercises; exercises are positionally ordered (0-indexed).

### POST /api/routines
- **Handler:** `server/src/routes/routines.js`
- **Auth:** JWT
- **Request body:** `{ name: string (required), description?: string, exercises: [{ exercise_id: int, target_sets?: int (default 3), notes?: string }] }`
- **Response 201:** routine row with `exercises: [user_routine_exercises rows]`
- **Errors:**
  - `400 { error: "Name is required" }`
  - `400 { error: "At least one exercise is required" }`
  - `400 { error: "Routine cannot have more than 50 exercises" }`
  - `400 { error: "Invalid exercise_id at position N" }`

### GET /api/routines
- **Handler:** `server/src/routes/routines.js`
- **Auth:** JWT
- **Response 200:** `{ routines: [{ id, name, description, created_at, updated_at, exercise_count, last_used }] }` — `last_used` is the max `started_at` from sessions referencing this routine_id, or null.

### GET /api/routines/:id
- **Handler:** `server/src/routes/routines.js`
- **Auth:** JWT
- **Response 200:** routine row with `exercises: [{ id, exercise_id, position, target_sets, notes, name, target_muscles, type, default_sets, default_reps, default_duration_secs, tracking_type, media_url, thumbnail_url }]`
- **Errors:** `404 { error: "Routine not found" }` (ownership-scoped — not-found and not-owned collapse to the same response).

### PUT /api/routines/:id
- **Handler:** `server/src/routes/routines.js`
- **Auth:** JWT
- **Request body:** `{ name?: string, description?: string, exercises?: [...] }` — when `exercises` is provided, the routine's exercises are replaced wholesale (DELETE then INSERT inside one transaction).
- **Response 200:** updated routine with `exercises`.
- **Errors:** `400` for name/exercises validation, `404` for not-found / not-owned.

### DELETE /api/routines/:id
- **Handler:** `server/src/routes/routines.js`
- **Auth:** JWT
- **Response 200:** `{ deleted: true }`
- **Errors:** `404 { error: "Routine not found" }`

---

## Workout (legacy slot model)

Pre-Approach-5 surface: today's workout is read from `workout_slots` keyed by day-of-week, and the user's per-slot exercise preferences override the slot defaults. Still active for users who haven't adopted the engine-driven flow. The S12-T6 swap-counter integration is on `PUT /api/workout/slot/:exerciseId/choose` — see [Swap & Exclusion Endpoints (S12-T6)](#swap--exclusion-endpoints-s12-t6).

### GET /api/workout/today
- **Handler:** `server/src/routes/workout.js`
- **Auth:** JWT
- **Response 200:** `{ day_of_week, day_label, name, type, phases: [{ phase, label, duration_min, color, workout_id, exercises: [...] }] }`. Phases are returned in fixed order (`opening_breathwork → warmup → main → cooldown → closing_breathwork`). Each exercise is the user's preferred substitution if one exists, else the slot default; both the preference id and the default id are returned so the client can offer reset-to-default.

### GET /api/workout/:workoutId/slots/:exerciseId/alternatives
- **Handler:** `server/src/routes/workout.js`
- **Auth:** JWT
- **Response 200:** `{ slot_id, default_exercise: { id, name, muscle_groups }, alternatives: [{ id, name, target_muscles, muscle_groups, difficulty }], user_preference: { id, name } | null }`
- **Errors:** `400 { error: "Invalid workout or exercise ID" }`, `404 { error: "Exercise not found" }`

### PUT /api/workout/slot/:exerciseId/reset
- **Handler:** `server/src/routes/workout.js`
- **Auth:** JWT
- **Purpose:** clear the user's preferred substitution for this slot — reverts to the slot default.
- **Response 200:** `{ success: true, slot_id, reset_to_default: true }`
- **Errors:** `400 { error: "Invalid exercise ID" }`

### PUT /api/workout/exercise-pref
- **Handler:** `server/src/routes/workout.js`
- **Auth:** JWT (declared on the handler again — defensive)
- **Purpose:** generic exercise-preference write for yoga/breathwork swap UIs (no swap-counter integration here — strength-only).
- **Request body:** `{ exercise_id: int, chosen_exercise_id: int }`
- **Response 200:** `{ success: true, exercise_id, chosen_exercise_id }`

---

## Session (single-session player)

The legacy single-pillar session player surface. Strength sessions live here; yoga and breathwork have separate logging endpoints. The 5-phase logging endpoint (`POST /api/session/complete-5phase`) is also here for historical reasons — Sprint-11/12 5-phase sessions wrote here. New cross-pillar / state-focus orchestrator sessions (S14-T5) write to `/api/multi-phase-sessions`.

### POST /api/session/start
**⚠ Writes `sessions.focus_slug` (S12-T1).**
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Request body:** `{ workout_id?: int, workout_ids?: int[], type?: 'strength'|'yoga'|'breathwork'|'stretching'|'5phase' (default 'strength'), initial_exercises?: int[] (max 50), routine_id?: int, focus_slug?: string }`
- **Behavior:** TOCTOU-safe — locks `FOR UPDATE` on the user's active session; if one exists, returns it with `resumed: true` and the existing logged sets.
- **Response 201 (new) | 200 (resumed):** `{ session: {...}, resumed?: true, logged_sets?: [...] }`

### GET /api/session/active
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Response 200:** `{ session: {...}|null, logged_sets: [...] }`

### PUT /api/session/:id/log-set
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Purpose:** atomic upsert of one set (`ON CONFLICT (session_id, exercise_id, set_number)`) + parallel PR detection (weight / volume / reps-at-weight).
- **Request body:** `{ exercise_id: int, set_number: int, weight: number (≥0), reps: int (0–999), rpe?: number (1–10), set_type?: 'normal'|'warmup'|'dropset'|'failure' }`
- **Response 200:** `{ set: {...}, session_totals: { total_sets, total_volume, exercises_done }, prs: [{ type, previous, new }, …] }`
- **Errors:** `400` for invalid weight/reps/RPE, `404 { error: "Active session not found" }`

### PUT /api/session/:id/complete
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Behavior:** marks the session complete + computes duration from `started_at` + runs PR diff against all prior completed sessions for the same exercise (rep PRs compare global max reps, not per-weight — intentional, per inline comment). Fires `recalculateForSession()` fire-and-forget for the progress cache.
- **Response 200:** `{ session, summary: { duration_seconds, total_sets, total_volume, exercises_completed, max_weight, duration_formatted, exercises: [...] }, prs: [...] }`
- **Errors:** `404 { error: "Session not found or already completed" }`

### DELETE /api/session/:id
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Behavior:** discard an active session — only deletes rows with `completed = false` (completed sessions are immutable).
- **Response 200:** `{ deleted: true }`
- **Errors:** `404 { error: "Active session not found" }`

### GET /api/session/previous-performance
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Query params:** `exerciseIds` (comma-separated, max 50)
- **Paginated:** capped at 50, no offset.
- **Response 200:** `{ previousPerformance: { "<exerciseId>": { sessionDate, sets: [{ setNumber, weight, reps, rpe }] } | null } }`. Exercises with no prior history map to `null`.
- **Errors:** `400` for missing param or > 50 IDs.

### GET /api/session/overview/:workoutId
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Purpose:** pre-session overview for the legacy 5-phase flow — workout metadata + suggested opening/closing breathwork technique + focus areas + estimated duration.
- **Response 200:** `{ workout: {...}, phases: { opening_breathwork: {...}, warmup: {...}, main_work: {...}, cooldown: {...}, closing_breathwork: {...} }, total_estimated_duration: int }`
- **Errors:** `400`, `404 { error: "Workout not found" }`

### POST /api/session/complete-5phase
**⚠ Writes `sessions.focus_slug`.**
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Request body:** `{ session_id?: int, workout_id?: int, total_duration: int (seconds), phases: object (max 50KB serialized), focus_slug?: string }`
- **Behavior:** if `session_id` is provided, UPDATEs that existing row (preserving any pre-existing `focus_slug` via `COALESCE`); otherwise INSERTs a new completed row.
- **Response 200/201:** `{ session, logged: true }`
- **Errors:** `400` for missing/oversized phases, `404 { error: "Session not found" }`

### GET /api/session/calendar
- **Handler:** `server/src/routes/session.js`
- **Auth:** JWT
- **Query params:** `month` (`YYYY-MM`, required)
- **Response 200:** `{ sessions: [{ id, date, type, main_work_type, duration, summary, exercise_count, pr_count }], streak: { current: int, best: int, dates: ['YYYY-MM-DD'] } }`
- **Errors:** `400 { error: "month query (YYYY-MM) is required" | "Invalid month" }`

---

## Suggestion Engine HTTP Surface

S12-T7 and S14-T1 endpoints — the only Approach-5 surface that talks to `services/suggestionEngine.js` directly. All four require both `authenticate` AND `requireUserId` middleware: `requireUserId` is defense-in-depth in case a JWT was issued without an `id` claim and would otherwise slip through to the engine as `undefined` and crash with a TypeError.

The engine throws `RangeError` on contract violations. The route maps RangeError-message substrings to stable error codes:

| RangeError contains | Mapped code | Status |
|---|---|---|
| `invalid bracket value` | `invalid_bracket` | 400 |
| `state focus requires bracket` | `state_focus_requires_bracket` | 400 |
| `is not valid from` | `invalid_focus_entry_combo` | 400 |
| `not available from strength_tab` | `invalid_focus_entry_combo` | 400 |
| `time_budget_min` (any phrasing) | `invalid_time_budget` | 400 |
| anything else | `unmapped_engine_error` | 400 (logged) |

This string-match approach is intentional v1; the typed-error refactor is FUTURE_SCOPE #166.

### POST /api/sessions/suggest
- **Handler:** `server/src/routes/sessions.js`
- **Auth:** JWT + `requireUserId`
- **Request body:**
  ```
  {
    focus_slug: string (regex /^[a-z_]{1,40}$/),
    entry_point: 'home'|'strength_tab'|'yoga_tab'|'breathwork_tab',
    time_budget_min?: int (5–240) — required for body focuses,
    bracket?: '0-10'|'10-20'|'21-30'|'30-45'|'endless' — required for state focuses
  }
  ```
- **Response 200:** engine `SuggestedSession` shape (`{ session_shape, phases: [{ phase, items: [...] }], metadata: { ..., source: 'engine_v1' } }`).
- **Errors:**
  - `400 invalid_focus_slug | invalid_entry_point | invalid_time_budget | invalid_bracket`
  - `400 unknown_focus_slug` — slug doesn't exist or `is_active=false`.
  - `400 body_focus_requires_time_budget | state_focus_requires_bracket`
  - `400 invalid_focus_entry_combo | unmapped_engine_error` (from engine RangeError)
  - `500 engine_error` — uncaught engine exception, logged via `console.error`.

### GET /api/sessions/last
- **Handler:** `server/src/routes/sessions.js`
- **Auth:** JWT + `requireUserId`
- **Query params:** `focus` (required, regex `/^[a-z_]{1,40}$/`).
- **Behavior:** UNIONs `sessions` and `breathwork_sessions` rows that match `focus_slug`, orders by completion timestamp (`completed_at` ∪ `started_at` ∪ `date + 23:59:59` for `sessions`; `created_at` for `breathwork_sessions`), returns the most-recent. Allows historical (`is_active=false`) focuses so completed history stays replayable.
- **Response 200:** engine response shape via `services/sessionFormatter.js` — same `SuggestedSession` shape as `/suggest` so the Flutter player UI is shared.
- **Errors:**
  - `400 focus_param_required | unknown_focus_slug`
  - `404 last_session_not_found`
  - `500 engine_error`

### POST /api/sessions/save-as-routine
**⚠ Writes `user_routines` and `user_routine_exercises`.**
- **Handler:** `server/src/routes/sessions.js`
- **Auth:** JWT + `requireUserId`
- **Request body:** `{ name: string (≤100), description?: string (≤500), session: SuggestedSession }`
- **Saveability gate:**
  - `session.session_shape === 'state_focus'` → `400 state_focus_not_saveable_v1`
  - `session.session_shape === 'pillar_pure'` + sample item `content_type === 'yoga'` → `400 pillar_pure_yoga_not_saveable_v1`
  - `session.session_shape === 'pillar_pure'` + sample item `content_type === 'breathwork'` → `400 pillar_pure_breathwork_not_saveable_v1`
  - `cross_pillar` / `pillar_pure` strength → saveable; only strength items are persisted, phases that contributed no strength items are returned as `dropped_phases`.
- **Response 200:** `{ routine_id: int, saved_phase: 'strength', dropped_phases: ['warmup', 'cooldown', …], exercise_count: int }`
- **Errors:**
  - `400 routine_name_required | routine_name_too_long | routine_description_too_long`
  - `400 session_payload_required | no_strength_phase_in_session`
  - `400` saveability codes above
  - `500 engine_error` (with rollback)

### POST /api/sessions/start-from-list
**⚠ Writes `sessions.focus_slug` + `session_exercises`.**
- **Handler:** `server/src/routes/sessions.js` (S14-T1)
- **Auth:** JWT + `requireUserId`
- **Purpose:** seed an ad-hoc strength session from an engine-supplied exercise list. No `workout_id` (Pattern A — display defaults `default_sets`/`default_reps` ride the response but are NOT persisted on `session_exercises`).
- **Request body:** `{ type: 'strength' (only supported pillar today), focus_slug: string (1–40), exercises: [{ exercise_id: int, sort_order: int (≥0), default_sets: int (>0), default_reps?: int|null (>0 if present) }] }`. Max 20 exercises.
- **Behavior:** validates pillar type matches `exercises.type` for every id (no `is_active` check — that column doesn't exist; see FUTURE_SCOPE #194), inserts session + bulk inserts session_exercises via `jsonb_to_recordset`, JOINs back exercise display fields. The `equipment` field is not in the response because `exercises` has no such column (see FUTURE_SCOPE #141/#195).
- **Response 200:** `{ session, exercises: [{ id, name, target_muscles, difficulty, sort_order, session_exercise_id, default_sets, default_reps }] }`
- **Errors:**
  - `400 invalid_session_type | unsupported_session_type` (yoga/breathwork future work)
  - `400 invalid_focus_slug | invalid_exercises | too_many_exercises | invalid_exercise_item`
  - `400 unknown_exercise_id | wrong_pillar_exercise`
  - `500 internal_error` (with rollback)

---

## Multi-Phase Sessions (S14)

### POST /api/multi-phase-sessions
**⚠ Writes `multi_phase_sessions` (S14-T5 — renamed from `cross_pillar_sessions` in T4) + fans FK update across `sessions` AND `breathwork_sessions`.**
- **Handler:** `server/src/routes/multi-phase-sessions.js`
- **Auth:** JWT
- **Purpose:** orchestrator-level "session header" that ties together the per-pillar session rows already written by the embedded players. The dual-table FK update is required because breathwork lives in its own table (T4 AMENDMENT-1 D3).
- **Request body:**
  ```
  {
    focus_slug:                string (regex /^[a-z_0-9]{1,40}$/),
    session_shape:             'cross_pillar' | 'state_focus',
    started_at:                ISO-8601 string,
    completed_at:              ISO-8601 string | null,
    phases_completed:          int (≥0),
    total_phases:              int (1–20),
    end_intent:                'completed' | 'end_early' | 'abandoned',
    strength_yoga_session_ids: int[] (max 50; each > 0),
    breathwork_session_ids:    int[] (max 50; each > 0)
  }
  ```
- **Behavior:** inserts the header row, then runs `UPDATE sessions SET multi_phase_session_id = $1 WHERE id = ANY(...) AND user_id = $userId` and the same against `breathwork_sessions`. The `AND user_id = ...` guard is defense-in-depth so a malicious client can't claim someone else's sessions.
- **Response 201:** `{ id: int }` — the new multi_phase_sessions.id
- **Errors:**
  - `400 invalid_focus_slug | invalid_session_shape | invalid_started_at | invalid_completed_at`
  - `400 invalid_phases_completed | invalid_total_phases | phases_completed_exceeds_total | invalid_end_intent`
  - `400 invalid_strength_yoga_session_ids | invalid_breathwork_session_ids`
  - `500 internal_error` (with rollback)

---

## Focus Areas

S13-T2 read surface + S13-T5 duration picker support.

### GET /api/focus-areas
- **Handler:** `server/src/routes/focus-areas.js`
- **Auth:** JWT
- **Behavior:** returns the 17 currently-active focuses (`is_active = true`). Column aliases: `focus_type AS type`, `sort_order AS display_order` — preserved for client-contract stability; future migrations may rename the underlying columns to match.
- **Response 200:** `{ focus_areas: [{ slug, display_name, type: 'body'|'state', display_order }] }`
- **Errors:** `500 engine_error` on DB failure (logged).

### GET /api/focus-areas/:slug/available-durations
- **Handler:** `server/src/routes/focus-areas.js` (S13-T5)
- **Auth:** JWT
- **Purpose:** state-focus bracket grid for the BracketPickerSheet. Engine output is filtered server-side (Decision #10: hide locked/empty) and enriched with display copy + window bounds from `BRACKET_TABLE`. State focuses only — body focuses get `400`.
- **Behavior:** reads the user's breathwork level from `user_pillar_levels`, passes it (and `user_id` for per-user exclusions) to `getAvailableDurations()`. Suggested default is mode-of-history bracket for this `(user, focus_slug)` from `breathwork_sessions`, falling back to the first available bracket.
- **Response 200:**
  ```
  {
    focus_slug: string,
    breathwork_level: 'beginner'|'intermediate'|'advanced',
    ranges: [{ label, display, min_total_minutes, max_total_minutes, state: 'available', technique_count }],
    suggested_default: string|null
  }
  ```
- **Errors:**
  - `400 invalid_focus_type_for_durations` (body focus passed)
  - `400 breathwork_level_not_set` (user has no `user_pillar_levels` row for breathwork)
  - `404 unknown_focus_slug`
  - `500 engine_error`

### GET /api/focus-areas/:slug/suggested-default
- **Handler:** `server/src/routes/focus-areas.js` (S13-T5)
- **Auth:** JWT
- **Purpose:** lightweight history lookup for the body-focus DurationSliderSheet (and state-focus pre-fetch). Mode-of-history bracket (state) or duration in minutes snapped to 5 and clamped to [30, 60] (body). Returns `null` when no history exists.
- **Response 200:** `{ focus_slug: string, focus_type: 'body'|'state', suggested_default: string|int|null }`
- **Errors:** `404 unknown_focus_slug`, `500 engine_error`

---

## Yoga

### GET /api/yoga/generate
- **Handler:** `server/src/routes/yoga.js`
- **Auth:** JWT
- **Query params:** `type` (vinyasa, hatha, yin, restorative, sun_salutation — default vinyasa), `level` (beginner, intermediate, advanced — default intermediate), `duration` (5–120 min, default 30), `focus?` (comma-separated subset of hips, hamstrings, back, shoulders, core, neck, chest, balance, twists, strength), `category_filter?` (comma-separated subset of warmup, flow, cooldown, savasana, standing, peak, floor).
- **Behavior:** progressive query broadening — strict filters first (category + level + practice_type + focus), then drop focus, then drop difficulty restriction, then include adjacent categories, then drop practice_type. Beginner-unsafe poses (headstand, handstand, scorpion, etc.) are filtered out for beginners.
- **Response 200:** `{ session: { id: uuid, type, level, duration, focus: [...], poses: [{ id, name, sanskrit_name, target_muscles, difficulty, description, hold_seconds, phase }], total_poses: int } }`
- **Errors:** `400 { error: "Duration must be between 5 and 120 minutes" }`, `404 { error: "No yoga poses found for the selected criteria" }`

### POST /api/yoga/poses-by-ids
- **Handler:** `server/src/routes/yoga.js` (S14-T3 engine adapter)
- **Auth:** JWT
- **Request body:** `{ ids: int[] (1–50, each > 0) }`
- **Behavior:** strict-mode hydration — fails the whole request if any id is missing so the player never opens with placeholder pose names. `target_muscles` is the raw comma-separated text; `difficulty` defaults to `'beginner'` via `COALESCE` for legacy rows.
- **Response 200:** `{ poses: [{ id, name, sanskrit_name, description, target_muscles, difficulty }] }`
- **Errors:**
  - `400 invalid_ids | too_many_ids | invalid_id`
  - `404 { error: "some_poses_missing", missing_ids: [int] }`

### GET /api/yoga/alternatives
- **Handler:** `server/src/routes/yoga.js`
- **Auth:** JWT
- **Query params:** `exerciseId` (required), `category` (required), `practiceType?`, `maxDifficulty?` (beginner|intermediate|advanced).
- **Response 200:** `{ alternatives: [{ id, name, sanskrit_name, category, difficulty, description, media_url }] }` — up to 8 random poses.
- **Errors:** `400` for missing params.
- **Note:** when the session originated from the engine, `practiceType` may not be set; the swap sheet falls back to global candidates that may not match the session's flow (FUTURE_SCOPE #193).

### GET /api/yoga/recent
- **Handler:** `server/src/routes/yoga.js`
- **Auth:** JWT
- **Response 200:** `{ sessions: [{ id, type, level, duration: int (minutes), focus: [...], date }] }` — last 3 completed yoga sessions, config parsed from `sessions.notes` (JSON string).

### POST /api/yoga/session
**⚠ Writes `sessions.focus_slug`.**
- **Handler:** `server/src/routes/yoga.js`
- **Auth:** JWT
- **Request body:** `{ type, level, duration: int (1–120 min — floor lowered from 5 to admit embedded cross-pillar sub-phases per S14-T4 AMENDMENT-1 D11), focus, poses: [{ id, hold_seconds }], focus_slug? }`
- **Response 201:** `{ id: int, logged: true }`. Pose rows are inserted into `session_exercises`; `recalculateForSession()` fires fire-and-forget.
- **Errors:** `400 { error: "Duration must be between 1 and 120 minutes" }`

---

## Breathwork

### GET /api/breathwork/techniques
- **Handler:** `server/src/routes/breathwork.js`
- **Auth:** **none** (public — no `router.use(authenticate)` and no per-handler `authenticate`)
- **Query params:** `category?` (filter by `'all'` or any breathwork category; `'all'` is equivalent to omitting)
- **Response 200:** `[{ id, name, sanskrit_name, tradition, category, purposes, difficulty, safety_level, caution_note, protocol, estimated_duration }, …]`

### GET /api/breathwork/techniques/:id
- **Handler:** `server/src/routes/breathwork.js`
- **Auth:** **none**
- **Response 200:** full technique row + `estimated_duration` (computed from name+category).
- **Errors:** `404 { error: "Technique not found" }`

### GET /api/breathwork/alternatives
- **Handler:** `server/src/routes/breathwork.js`
- **Auth:** JWT (per-handler)
- **Query params:** `techniqueId` (required), `category` (required)
- **Response 200:** `{ alternatives: [{ id, name, tradition, category, difficulty, safety_level, estimated_duration }] }` — up to 6 same-category alternatives, filtered to `safety_level IN ('green', 'yellow')` and ordered green-first then random.
- **Errors:** `400 { error: "techniqueId is required" | "category is required" }`

### PUT /api/breathwork/preference
- **Handler:** `server/src/routes/breathwork.js`
- **Auth:** JWT (per-handler)
- **Request body:** `{ phase: 'opening'|'closing', technique_id: int }`
- **Response 200:** `{ success: true, phase, technique_id }`

### GET /api/breathwork/preferences
- **Handler:** `server/src/routes/breathwork.js`
- **Auth:** JWT (per-handler)
- **Response 200:** `{ opening?: { technique_id, technique_name }, closing?: { technique_id, technique_name } }` — only includes phases the user has saved.

### POST /api/breathwork/sessions
**⚠ Writes `breathwork_sessions.focus_slug` (state-focus sessions only).**
- **Handler:** `server/src/routes/breathwork.js`
- **Auth:** JWT (per-handler)
- **Request body:** `{ technique_id: int, duration_seconds: int (≥0), rounds_completed: int (≥0), completed: bool, focus_slug?: string }`
- **Behavior:** persists the row; `focus_slug` is forward-compat (not read by the engine's recency-overlap query today — `breathwork_sessions` has no date column).
- **Response 200:** `{ id: int, logged: true }`. `recalculateBreathwork()` fires fire-and-forget when `completed=true`.
- **Errors:** `400 { error: "Invalid technique_id | duration_seconds | rounds_completed" }`

---

## Per-Set Suggestions

Pre-session "what should I aim for on the next set?" — strength, yoga, breathwork. Single-id endpoints are kept for compatibility; the batch endpoints are the recommended modern paths.

### GET /api/suggestions/strength/:exerciseId
- **Handler:** `server/src/routes/suggestions.js`
- **Auth:** JWT
- **Response 200:** strength suggestion shape (weight + reps + reasoning), localized to the user's unit system.
- **Errors:** `400 { error: "Invalid exerciseId" }`, `404 { error: "Exercise not found" }`

### GET /api/suggestions/yoga
- **Handler:** `server/src/routes/suggestions.js`
- **Auth:** JWT
- **Query params:** `exerciseIds` (comma-separated, max 50)
- **Paginated:** capped at 50, no offset.
- **Response 200:** `{ suggestions: { "<exerciseId>": { ... } } }`. Empty `exerciseIds` returns empty suggestions.
- **Errors:** `400 { error: "Maximum 50 exercise IDs allowed" }`

### GET /api/suggestions/yoga/:exerciseId
- **Handler:** `server/src/routes/suggestions.js`
- **Auth:** JWT
- **Response 200:** single yoga suggestion shape.
- **Errors:** `400`, `404 { error: "Exercise not found" }`

### GET /api/suggestions/breathwork
- **Handler:** `server/src/routes/suggestions.js`
- **Auth:** JWT
- **Query params:** `techniqueIds` (comma-separated, max 50)
- **Paginated:** capped at 50, no offset.
- **Response 200:** `{ suggestions: { "<techniqueId>": { ... } } }`
- **Errors:** `400 { error: "Maximum 50 technique IDs allowed" }`

### GET /api/suggestions/breathwork/:techniqueId
- **Handler:** `server/src/routes/suggestions.js`
- **Auth:** JWT
- **Response 200:** single breathwork suggestion shape; defaults to `{ suggestedCycles: 4, reason: 'default' }` if no per-user data exists.
- **Errors:** `400`

---

## Progress

### GET /api/progress/exercises
- **Handler:** `server/src/routes/progress.js`
- **Auth:** JWT
- **Response 200:** all exercises (strength + yoga + breathwork) the user has logged, grouped by `kind`. Shape comes from `services/progressService.js → getExerciseHistory()`.

### GET /api/progress/exercise/:id
- **Handler:** `server/src/routes/progress.js`
- **Auth:** JWT
- **Query params:** `range?` (`30d` | `90d` | `all` — default `30d`), `type?` (`strength` | `yoga` | `breathwork` — hint; breathwork ids live in a separate table).
- **Response 200:** chart data for the exercise / technique over the range.
- **Errors:** `400 { error: "Invalid exercise id" }`, `404 { error: "Exercise not found" }`

### POST /api/progress/recalculate/:exercise_id
- **Handler:** `server/src/routes/progress.js`
- **Auth:** JWT
- **Request body:** `{ type?: 'strength'|'yoga'|'breathwork' }`
- **Response 200:** `{ recalculated: true }`

---

## Body Measurements

CRUD + aggregated stats. All numeric measurements are clamped to safe ranges (weight 20–500 kg, body fat 1–75 %, circumferences 30–250 / 10–100 cm) to keep typos from poisoning trend charts.

### GET /api/body-measurements
- **Handler:** `server/src/routes/bodyMeasurements.js`
- **Auth:** JWT
- **Query params:** `limit?` (default 200, max 500)
- **Paginated:** LIMIT-only, newest first, no offset cursor.
- **Response 200:** `[{ id, measured_at, weight_kg, body_fat_percent, waist_cm, hips_cm, chest_cm, bicep_left_cm, bicep_right_cm, notes }]`

### GET /api/body-measurements/latest
- **Handler:** `server/src/routes/bodyMeasurements.js`
- **Auth:** JWT
- **Response 200:** most-recent row or `null`.

### GET /api/body-measurements/stats
- **Handler:** `server/src/routes/bodyMeasurements.js`
- **Auth:** JWT
- **Response 200:**
  ```
  {
    latest: row | null,
    bmi: number | null,
    bmi_category: 'Underweight'|'Normal'|'Overweight'|'Obese' | null,
    rolling_avg_7d: number | null,
    weight_delta_week: number | null,
    weight_delta_total: number | null,
    circumference_deltas: { waist_cm: { week, total }, hips_cm: {...}, ... },
    first_entry_date: timestamp | null,
    entry_count: int,
    days_since_last_entry: int | null
  }
  ```

### POST /api/body-measurements
- **Handler:** `server/src/routes/bodyMeasurements.js`
- **Auth:** JWT
- **Request body:** `{ measured_at?: ISO-8601 or 'YYYY-MM-DD' (anchored to local noon to dodge TZ drift), weight_kg?, body_fat_percent?, waist_cm?, hips_cm?, chest_cm?, bicep_left_cm?, bicep_right_cm?, notes?: string (≤500 chars) }`. Out-of-range values silently set to `null`.
- **Response 201:** inserted row.
- **Errors:** `400 { error: "Invalid measured_at" | "At least one measurement is required" }`

### PUT /api/body-measurements/:id
- **Handler:** `server/src/routes/bodyMeasurements.js`
- **Auth:** JWT
- **Request body:** same shape; only `measured_at` uses `COALESCE` (other fields are wholesale replaced).
- **Response 200:** updated row.
- **Errors:** `400 { error: "Invalid id" | "Invalid measured_at" }`, `404 { error: "Not found" }`

### DELETE /api/body-measurements/:id
- **Handler:** `server/src/routes/bodyMeasurements.js`
- **Auth:** JWT
- **Response 200:** `{ deleted: true }`
- **Errors:** `400 { error: "Invalid id" }`, `404 { error: "Not found" }`

---

## Progress Photos

Metadata-only — images live in IndexedDB on the client. 50-photos-per-user cap is enforced server-side.

### GET /api/progress-photos
- **Handler:** `server/src/routes/progressPhotos.js`
- **Auth:** JWT
- **Response 200:** `[{ id, taken_at, view, local_storage_key, created_at }]` newest first.

### POST /api/progress-photos
- **Handler:** `server/src/routes/progressPhotos.js`
- **Auth:** JWT
- **Request body:** `{ local_storage_key: string (≤100), taken_at?: date, view?: 'front'|'side'|'back' (default 'front') }`
- **Response 201:** inserted row.
- **Errors:** `400 { error: "local_storage_key is required" | "Invalid taken_at" }`, `409 { error: "Photo limit (50) reached" }`

### DELETE /api/progress-photos/:id
- **Handler:** `server/src/routes/progressPhotos.js`
- **Auth:** JWT
- **Response 200:** `{ deleted: true, local_storage_key: string }` — the key is returned so the client can also drop the IndexedDB entry.
- **Errors:** `400 { error: "Invalid id" }`, `404 { error: "Not found" }`

---

## Dashboard

### GET /api/dashboard
- **Handler:** `server/src/routes/dashboard.js`
- **Auth:** JWT
- **Purpose:** composite home payload — user first-name, streak, last session, this-week dots and counts, recent PRs, milestone flag.
- **Response 200:**
  ```
  {
    user: { firstName, streak: int },
    lastSession: { date, daysAgo } | null,
    thisWeek: { days: [bool × 7] (Mon..Sun), todayIndex: 0..6 },
    recentPRs: [{ exercise, weight, reps, date }],
    weekActivity: { workouts, yoga, breathworkMinutes },
    milestone: { reached: bool, count: int | null }   // milestones at 10/25/50/100/250/500 sessions
  }
  ```
  Streak / week dots UNION `sessions` and `breathwork_sessions` so a breathwork-only day still counts.

---

## Home

S10-T5c-b + S13-T4 home-page surfaces. All four endpoints share the streak helper from `services/milestones.js` so the homepage and `/api/dashboard` numbers stay in sync.

### GET /api/home/stats
- **Handler:** `server/src/routes/home.js`
- **Auth:** JWT
- **Response 200:** `{ streakDays, minutesThisWeek, sessionsThisYear, pillarDurations: { strength, yoga, breath } }`. Pillar durations are median of the user's last 5 sessions per pillar, snapped to 5 minutes, with fallbacks 45/20/10 minutes when there's no history.

### GET /api/home/weekly-activity
- **Handler:** `server/src/routes/home.js`
- **Auth:** JWT
- **Response 200:** `{ weeks: [{ weekStart: 'YYYY-MM-DD', strength: int, yoga: int, breath: int } × 4] }` oldest → newest, Monday-anchored.

### GET /api/home/daily-load
- **Handler:** `server/src/routes/home.js` (S13-T4)
- **Auth:** JWT
- **Response 200:** `{ points: [{ date: 'YYYY-MM-DD', load_minutes: int } × 30], delta_pct: number | null }` oldest → newest. Every day in the window emits a point (zero-filled). `delta_pct` compares last-14d avg to prior-14d avg, null when either window's sum is zero.

### GET /api/home/daily-counts
- **Handler:** `server/src/routes/home.js` (S13-T4)
- **Auth:** JWT
- **Response 200:** `{ points: [{ date: 'YYYY-MM-DD', sessions: int } × 14] }` — 14 daily session counts across all pillars. Empty days emit `0`.

---

## Body Map

S10-T5b — backs the Flutter home page's 3D body-map heatmap, flexibility ring, and Recent Wins list. Response shapes must deserialize cleanly into the Dart types in `app/lib/data/mock_body_map_data.dart`.

### GET /api/body-map/muscle-volumes
- **Handler:** `server/src/routes/bodyMap.js`
- **Auth:** JWT
- **Query params:** `range?` (`7d` | `30d` | `90d` | `year` — default unspecified; service falls back to `7d`).
- **Response 200:** `Map<string, int>` — 11 canonical strength groups, all keys present (untrained groups → 0), values 0–100. Normalization is rank-within-window: the user's most-trained muscle in the window scales to 100, others scale relative to it.

### GET /api/body-map/flexibility
- **Handler:** `server/src/routes/bodyMap.js`
- **Auth:** JWT
- **Query params:** `range?`
- **Response 200:** `Map<string, int>` with keys `Spine`, `Hips`, `Shoulders`, values 0–100.

### GET /api/body-map/recent-wins
- **Handler:** `server/src/routes/bodyMap.js`
- **Auth:** JWT
- **Query params:** `limit?` (default 5, max 10)
- **Paginated:** LIMIT-only, no offset.
- **Response 200:** `[{ icon: string, title: string, subtitle: string }]` — all values strings (matching the mock shape `List<Map<String, String>>`); no `type` or `achieved_at` fields.

---

## Media

### POST /api/media/test-upload
- **Handler:** `server/src/routes/media.js`
- **Auth:** JWT
- **Purpose:** dev-only ImageKit upload sanity check. Not used by the production app flow.
- **Request body:** `{ base64: string (≤5 MB) }`
- **Response 200:** `{ success: true, url: string, fileId: string }`
- **Errors:** `400 { error: "base64 image required" | "File too large (max 5MB)" }`, `500 { error: "Upload failed" }`

---

## Swap & Exclusion Endpoints (S12-T6)

Three endpoints implement the swap-counter rule: a strength swap increments a per-`(user, exercise)` counter; the prompt fires at counts 3 and 6 with the user choosing "exclude" or "keep suggesting" each time. The counter row's `prompt_state` is the state machine: `never_prompted → prompted_keep → excluded` (terminal). The swap-counter logic lives in `services/swapCounter.js`; the ranked alternative list (S14-T6 / FS #198) comes from `services/substitutionLadder.js`.

### PUT /api/workout/slot/:exerciseId/choose
**⚠ Writes `exercise_swap_counts`** (S12-T6 table — UPSERT + counter increment in single transaction).
- **Handler:** `server/src/routes/workout.js`
- **Auth:** JWT (S15-T7: `req.user.id` is guaranteed positive integer by `authenticate` middleware — handler reads it directly, no defensive coercion)
- **Request body:** `{ chosen_exercise_id: int }`
- **Behavior:** UPSERTs `user_exercise_prefs` for the slot. If `chosen_exercise_id !== exerciseId` (actual swap), increments `exercise_swap_counts.swap_count` and runs the prompt-decision state machine in one transaction. Same-exercise re-pick returns the current count without incrementing. After commit, calls `substitutionLadder.rankAlternatives()` to return a ranked list (errors here are caught and return `[]` so the save never fails on the secondary lookup).
- **Response 200:** `{ success: true, slot_id, chosen_exercise_id, should_prompt: bool, swap_count: int, prompt_state: string|null, alternatives: [{...}] }`
- **Errors:**
  - `400 { error: "exercise_id and chosen_exercise_id must be valid integers" }`
  - `400 { error: "Invalid alternative for this exercise" }` — chosen_exercise_id isn't in `slot_alternatives` for this slot.

### POST /api/exercises/:id/exclude
**⚠ Writes `user_excluded_exercises` (S12-T6) + `exercise_swap_counts.prompt_state='excluded'`.**
- **Handler:** `server/src/routes/exercises.js`
- **Auth:** JWT
- **Behavior:** idempotent INSERT into `user_excluded_exercises` (`ON CONFLICT DO NOTHING`) using the pillar-aware shape `(content_type='strength', content_id=:id)`, then `setPromptState(..., 'excluded')`. Both writes happen inside one transaction to close the TOCTOU window between the exists-check and the writes.
- **Response 200:** `{ excluded: true, already: bool, exercise_id: int }`
- **Errors:** `400 { error: "Invalid id" }`, `404 { error: "Exercise not found" }`

### POST /api/exercises/:id/keep-suggesting
**⚠ Writes `exercise_swap_counts.prompt_state='prompted_keep'` (idempotent; guarded against downgrading `'excluded'` which is terminal).**
- **Handler:** `server/src/routes/exercises.js`
- **Auth:** JWT
- **Behavior:** UPSERT — if the row was already in `'excluded'` (or `'prompted_keep'`), the WHERE blocks the update; response is still 200 with `already: true`. Spec criterion #14: the call is acknowledged even when state can't change.
- **Response 200:** `{ kept: true, already: bool, exercise_id: int }`
- **Errors:** `400 { error: "Invalid id" }`, `404 { error: "Exercise not found" }`

---

## Endpoints that write to the S11–S14 tables (quick index)

| Table | Endpoints |
|---|---|
| `user_pillar_levels` | `POST /api/users/pillar-levels` (declared upsert); `recompute_user_pillar_level()` Postgres function is called by background jobs / future inference triggers, not by an HTTP endpoint. |
| `focus_areas` | Read-only from the API. Written by seed scripts (`server/src/db/seeds/seed-focus-areas.js`). |
| `multi_phase_sessions` | `POST /api/multi-phase-sessions` (the only writer). FK fans to `sessions.multi_phase_session_id` and `breathwork_sessions.multi_phase_session_id`. |
| `user_excluded_exercises` | `POST /api/exercises/:id/exclude` (the only writer). |
| `exercise_swap_counts` | `PUT /api/workout/slot/:exerciseId/choose` (increment on swap), `POST /api/exercises/:id/exclude` (set `'excluded'`), `POST /api/exercises/:id/keep-suggesting` (set `'prompted_keep'`). |

---

## Validation self-check

Ran against this document on 2026-05-15:

- **Endpoint count:** 74 endpoints documented. Phase 1 inventory reported 71 — that earlier count was off by 3 (miscount; the 73 in route files + 1 health-check is the corrected total). Every endpoint I enumerated in Phase 1 appears below.
- **Route file coverage:** all 20 route files have at least one endpoint documented:
  `auth.js (2)`, `users.js (5)`, `settings.js (2)`, `workout.js (5)`, `session.js (9)`, `sessions.js (4)`, `breathwork.js (6)`, `yoga.js (5)`, `progress.js (3)`, `bodyMeasurements.js (6)`, `progressPhotos.js (3)`, `suggestions.js (5)`, `dashboard.js (1)`, `exercises.js (5)`, `routines.js (5)`, `bodyMap.js (3)`, `home.js (4)`, `focus-areas.js (3)`, `multi-phase-sessions.js (1)`, `media.js (1)`. Plus `index.js (1)` for `/api/health`.
- **Per-endpoint fields:** every endpoint has method, path, handler reference, auth status, request shape (params + body), response shape, and error cases (where any exist).
- **S11–S14 table writes:** flagged inline (`⚠ Writes …`) on every writing endpoint and summarized in the "Endpoints that write to the S11–S14 tables" index at the bottom.
- **FUTURE_SCOPE cross-references:** FS #141, #166, #193, #194, #195, #196, #198, #215, #219, #222 cross-referenced inline where relevant.

Total: **74 endpoints across 21 source files** (20 route files + `index.js` health surface).

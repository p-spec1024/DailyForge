# DailyForge Codebase Audit

**Date:** 2026-04-06  
**Branch:** feature/rest-timer

---

## 1. Frontend Files

### Pages (`client/src/pages/`)

| File | Description | Lines |
|------|-------------|-------|
| `Login.jsx` | Auth login form | 37 |
| `Register.jsx` | Auth register form | 39 |
| `Workout.jsx` | Main workout page (oversized) | 1,288 |

### Components (`client/src/components/`)

| File | Description | Lines |
|------|-------------|-------|
| `ExerciseLibrary.jsx` | Browsable exercise list (yoga/dumbbell/breathwork/stretching) | 404 |
| `NavBar.jsx` | Bottom navigation bar | 111 |
| `RestTimer.jsx` | Rest timer display | 193 |
| `RestTimerSettings.jsx` | Rest timer config modal | 223 |

### Data Files (`client/src/data/`)

| File | Description | Lines |
|------|-------------|-------|
| `exercise-library.js` | Dumbbell (~40), breathwork (~13), stretching (~15) libraries | 265 |
| `yoga-library.js` | 150+ yoga poses | 474 |

### Hooks (`client/src/hooks/`)

| File | Description |
|------|-------------|
| `useAuth.js` | Authentication state management |
| `useWorkoutSession.js` | Workout session API calls and state |

### Contexts (`client/src/contexts/`)

| File | Description |
|------|-------------|
| `DataProvider.jsx` | Fetches today's workout data from API |

### Utilities (`client/src/`)

| File | Description |
|------|-------------|
| `api.js` | Axios instance with auth token interceptor |
| `App.jsx` | Root component with routing |

---

## 2. Server Routes (`server/src/routes/`)

| File | Endpoints | Auth Required |
|------|-----------|---------------|
| `auth.js` | `POST /api/auth/register`, `POST /api/auth/login` | No (rate-limited: 10/15min) |
| `session.js` | `POST /api/session/start`, `GET /api/session/active`, `PUT /api/session/:id/log-set`, `PUT /api/session/:id/complete`, `DELETE /api/session/:id` | Yes |
| `settings.js` | `GET /api/settings/rest-timer`, `PUT /api/settings/rest-timer` | Yes |
| `workout.js` | `GET /api/workout/today` | Yes |
| `index.js` | `GET /api/health` | No |

**11 endpoints total.** All actively used by the client except `/api/health`.

### Endpoint Details

| # | Method | Path | Client Usage |
|---|--------|------|-------------|
| 1 | GET | `/api/health` | Unused (utility) |
| 2 | POST | `/api/auth/register` | `useAuth.js` |
| 3 | POST | `/api/auth/login` | `useAuth.js` |
| 4 | POST | `/api/session/start` | `useWorkoutSession.js` |
| 5 | GET | `/api/session/active` | `useWorkoutSession.js` |
| 6 | PUT | `/api/session/:id/log-set` | `useWorkoutSession.js` |
| 7 | PUT | `/api/session/:id/complete` | `useWorkoutSession.js` |
| 8 | DELETE | `/api/session/:id` | `useWorkoutSession.js` |
| 9 | GET | `/api/settings/rest-timer` | `Workout.jsx` |
| 10 | PUT | `/api/settings/rest-timer` | `RestTimerSettings.jsx` |
| 11 | GET | `/api/workout/today` | `DataProvider.jsx` |

---

## 3. Unused Components

**None found.** Every component is imported and used.

---

## 4. API Spec Status

No formal API spec (OpenAPI/Swagger/Blueprint) exists in the repo. A `DailyForge_Project_Spec_v2.pdf` exists but there is no machine-readable API contract. All defined routes match client usage 1:1 — no orphaned or missing endpoints.

---

## 5. Navigation Structure

### Bottom NavBar (4 tabs)

| Tab | Route | Renders | Status |
|-----|-------|---------|--------|
| Workout | `/` | `Workout.jsx` with sub-tabs | Implemented |
| Yoga | `/yoga` | PlaceholderPage | **Not implemented** |
| Breathe | `/breathe` | PlaceholderPage | **Not implemented** |
| Profile | `/profile` | ProfilePage (logout only) | **Partially implemented** |

### Workout Sub-Tabs (inside Workout.jsx)

| Tab | Key | Content | Data Source |
|-----|-----|---------|-------------|
| Today | `today` | TodayView — active session, phases | Database (API) |
| Yoga | `yoga` | ExerciseLibrary | Hardcoded (`yoga-library.js`) |
| Dumbbell | `dumbbell` | ExerciseLibrary | Hardcoded (`exercise-library.js`) |
| Breathwork | `breathwork` | ExerciseLibrary | Hardcoded (`exercise-library.js`) |
| Stretching | `stretching` | ExerciseLibrary | Hardcoded (`exercise-library.js`) |

---

## 6. Hardcoded Data

| What | Where | Count | Issue |
|------|-------|-------|-------|
| Dumbbell exercises | `exercise-library.js` | ~40 | Hardcoded, not from DB |
| Breathwork exercises | `exercise-library.js` | ~13 | Hardcoded, not from DB |
| Stretching exercises | `exercise-library.js` | ~15 | Hardcoded, not from DB |
| Yoga poses | `yoga-library.js` | ~150 | Hardcoded, not from DB |
| All video URLs | both data files | all `null` | No videos populated |
| Color tokens | scattered inline | ~6 colors | Not centralized |
| Set types | `Workout.jsx` line 233 | 4 types | Hardcoded enum |
| Rest timer presets | `RestTimerSettings.jsx` line 14 | `[30, 60, 90, 120, 180, 300]` | Hardcoded array |
| Day names | `Workout.jsx` line 24 | 7 days | Hardcoded constant |
| Tab definitions | `Workout.jsx` line 1243 | 5 tabs with colors | Hardcoded constant |

The "Today" tab's workout phases are the **only DB-driven content** on the frontend. All exercise library sub-tabs are entirely frontend-driven.

---

## 7. TODO / FIXME / HACK Comments

**None found.** The codebase has no TODO, FIXME, HACK, XXX, or TEMP comments. No stale debug `console.log` statements (only proper error logging and one intentional debug log in `handleLogSet`).

---

## 8. Key Issues Summary

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | 2 placeholder routes (`/yoga`, `/breathe`) in nav | Medium | Render empty pages |
| 2 | `Workout.jsx` is 1,288 lines | Medium | Should be split into smaller components |
| 3 | Exercise libraries hardcoded in frontend | High | Should be API-driven for CRUD and personalization |
| 4 | No formal API spec | Low | PDF spec exists but no OpenAPI/Swagger |
| 5 | Profile page is a shell | Medium | Only has a logout button |
| 6 | All exercise video URLs are `null` | Medium | No video content available |
| 7 | Color tokens not centralized | Low | Repeated across multiple files |

---

## 9. Architecture Overview

```
Client (Vite + React)
├── App.jsx ─── Routes + NavBar
├── Pages
│   ├── Login / Register (auth)
│   └── Workout (main app, 5 sub-tabs)
├── Components
│   ├── ExerciseLibrary (reused x4)
│   ├── RestTimer + RestTimerSettings
│   └── NavBar
├── Hooks
│   ├── useAuth (login/register/logout)
│   └── useWorkoutSession (session CRUD)
├── Contexts
│   └── DataProvider (today's workout)
└── Data
    ├── exercise-library.js (hardcoded)
    └── yoga-library.js (hardcoded)

Server (Express + PostgreSQL)
├── Routes
│   ├── auth.js (register, login)
│   ├── session.js (start, active, log-set, complete, delete)
│   ├── settings.js (rest-timer get/put)
│   └── workout.js (today)
├── Middleware
│   ├── auth (JWT verification)
│   ├── errorHandler
│   └── rateLimiter
└── DB
    ├── pool.js (pg connection)
    ├── migrate.js (schema)
    └── seeds/ (data seeding)
```

---

## 10. Security

| Aspect | Status |
|--------|--------|
| Rate limiting | Auth endpoints: 10/15min |
| JWT auth | Bearer token on protected routes |
| Password hashing | bcrypt, 12 salt rounds |
| CORS | Configured to client URL from env |
| Session isolation | All queries filtered by `user_id` |
| Row-level locking | Session start uses `SELECT FOR UPDATE` |
| Input validation | Numeric ranges, enum whitelists, ID parsing |

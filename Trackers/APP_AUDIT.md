# DailyForge Complete App Audit

> Generated 2026-04-13 for Flutter rebuild planning.
> Covers every page, component, hook, API endpoint, database table, and design token.

---

## Table of Contents

1. [File Inventory](#file-inventory)
2. [Page Inventory](#page-inventory)
3. [Component Inventory](#component-inventory)
4. [API Endpoint Inventory](#api-endpoint-inventory)
5. [Database Schema](#database-schema)
6. [Hooks Inventory](#hooks-inventory)
7. [Context / Global State](#context--global-state)
8. [Utilities & Services](#utilities--services)
9. [Styles & Design Tokens](#styles--design-tokens)
10. [Seed Data](#seed-data)
11. [Summary Statistics](#summary-statistics)

---

# 1. File Inventory

## Client (`client/src/`)

### Pages (13 files)
```
pages/Breathwork.jsx
pages/BreathworkTimer.jsx
pages/EmptyWorkout.jsx
pages/ExerciseHistory.jsx
pages/ExerciseProgress.jsx
pages/Login.jsx
pages/Profile.jsx
pages/Register.jsx
pages/Session.jsx
pages/Strength.jsx
pages/TodayView.jsx
pages/Workout.jsx
pages/Yoga.jsx
```

### Components (53 files)
```
components/AlternativePicker.jsx
components/BottomSheet.jsx
components/ErrorBoundary.jsx
components/ExerciseCard.jsx
components/NavBar.jsx
components/PhaseCard.jsx
components/ProgressChart.jsx
components/RestTimer.jsx
components/SavePreferencePrompt.jsx
components/SaveRoutineModal.jsx
components/SessionHeader.jsx
components/SessionSummary.jsx
components/SettingsModal.jsx
components/Calendar/CalendarDay.jsx
components/Calendar/SessionBottomSheet.jsx
components/Calendar/StreakCounter.jsx
components/Calendar/WorkoutCalendar.jsx
components/Dashboard/QuickStartButtons.jsx
components/Dashboard/RecentWins.jsx
components/Dashboard/TodaySessionCard.jsx
components/Dashboard/WeekProgress.jsx
components/Dashboard/WorkoutDashboard.jsx
components/breathwork/BreathCircle.jsx
components/breathwork/SafetyWarningModal.jsx
components/breathwork/SessionSummary.jsx
components/breathwork/TechniqueCard.jsx
components/breathwork/TimerControls.jsx
components/profile/AddMeasurementModal.jsx
components/profile/BodyMeasurements.jsx
components/profile/CircumferencesCard.jsx
components/profile/HeightPromptModal.jsx
components/profile/MeasurementsChart.jsx
components/profile/MeasurementsSummary.jsx
components/profile/ProfileSettings.jsx
components/profile/ProgressPhotos.jsx
components/session/MidSessionPicker.jsx
components/session/PhaseTransition.jsx
components/session/PreSessionOverview.jsx
components/session/SessionBreathwork.jsx
components/session/SessionMainWork.jsx
components/session/SessionSummary5Phase.jsx
components/session/SessionYoga.jsx
components/strength/EmptyWorkoutCard.jsx
components/strength/ExerciseBrowseCard.jsx
components/strength/ExerciseBrowser.jsx
components/strength/ExerciseDetailModal.jsx
components/strength/MuscleFilterChips.jsx
components/workout/AddExerciseModal.jsx
components/workout/SuggestionHint.jsx
components/workout/tokens.jsx
components/yoga/DurationSelector.jsx
components/yoga/FocusChips.jsx
components/yoga/LevelSelector.jsx
components/yoga/PoseCard.jsx
components/yoga/PoseInfoPopup.jsx
components/yoga/PosePreviewModal.jsx
components/yoga/PracticeTypeSelector.jsx
components/yoga/RecentSessions.jsx
components/yoga/StartButton.jsx
components/yoga/YogaSessionPlayer.jsx
```

### Hooks (8 files)
```
hooks/useAuth.js
hooks/useBreathworkTimer.js
hooks/useExerciseProgress.js
hooks/usePausableTimer.js
hooks/useSaveRoutine.js
hooks/useSessionFlow.js
hooks/useWorkoutSession.js
hooks/useYogaSession.js
```

### Contexts, Utils, Services (4 files)
```
contexts/DataProvider.jsx
utils/api.js
utils/unitConversion.js
services/photoStorage.js
```

### Other
```
App.jsx
main.jsx
index.css
```

## Server (`server/src/`)

### Routes (15 files)
```
routes/auth.js
routes/bodyMeasurements.js
routes/breathwork.js
routes/dashboard.js
routes/exercises.js
routes/media.js
routes/progress.js
routes/progressPhotos.js
routes/routines.js
routes/session.js
routes/settings.js
routes/suggestions.js
routes/users.js
routes/workout.js
routes/yoga.js
```

### Middleware (2 files)
```
middleware/auth.js
middleware/errorHandler.js
```

### Config (2 files)
```
config/env.js
config/imagekit.js
```

### Services (3 files)
```
services/progressService.js
services/suggestions.js
services/users.js
```

### Utils (4 files)
```
utils/mediaGenerator.js
utils/uploadMedia.js
utils/vertexImageGen.js
utils/vertexVideoGen.js
```

### Database (8 files)
```
db/migrate.js
db/pool.js
db/seeds/index.js
db/seeds/seed-alternatives.js
db/seeds/seed-breathwork-techniques.js
db/seeds/seed-phases.js
db/seeds/seed-strength-exercises.js
db/seeds/seed-yoga-poses.js
```

---

# 2. Page Inventory

## TodayView -- `client/src/pages/TodayView.jsx`

### Purpose
Main daily workout page that shows today's scheduled workout, manages active workout sessions with set logging, rest timers, exercise swapping, and session summaries.

### UI Elements
- Header: Day name (uppercase, e.g. "MONDAY"), workout name, stats line ("X sets . Y kg . Z exercises")
- Navigation: None explicit; navigates programmatically to `/session?type=strength` and `/?mode=empty`
- Main content:
  - Loading skeleton (4 placeholder bars)
  - Rest day view with sunrise SVG icon and "No workout scheduled" message
  - View mode: ResumeBanner (if unfinished session), WorkoutDashboard
  - Active session mode: SessionHeader, phase checkboxes, exercise session cards, added exercises section, "Add Exercise" button, sticky "Finish Workout" button
- Buttons:
  - Resume (in ResumeBanner) -- resumes unfinished session
  - Discard (in ResumeBanner) -- discards unfinished session
  - Add Exercise -- opens AddExerciseModal
  - Finish Workout (sticky bottom, green) -- opens confirm finish dialog
  - Start Full Session (in WorkoutDashboard) -- navigates to `/session?type=strength`
  - Start Strength Only (in WorkoutDashboard) -- starts strength-only session inline
- Inputs: None directly; inputs are inside child ExerciseSessionCard components
- Modals:
  - ConfirmDialog ("Finish this workout?")
  - ConfirmDialog ("Discard this workout?")
  - SettingsModal (rest timer settings)
  - SessionSummary (post-workout summary overlay)
  - SaveRoutineModal (save completed workout as routine)
  - AlternativePicker (swap exercise for alternative)
  - SavePreferencePrompt (save swapped exercise as default)
  - AddExerciseModal (search and add exercises)
- Lists: Phase list with exercises rendered as ExerciseSessionCard; added exercises list
- Icons: Sunrise SVG (rest day, inline), Plus SVG (Add Exercise button), Checkmark SVG (Finish Workout button) -- all custom inline SVG
- Loading states: Skeleton placeholder with 4 card-shaped divs, shimmer bars for title/subtitle
- Error states: None explicit; API errors silently caught
- Toast/notifications: navigator.vibrate(100) on PR achievement

### State Variables (useState)
- completedPhases: object -- tracks checkbox state for non-strength phases
- confirmFinish: boolean -- controls finish confirmation dialog visibility
- confirmDiscard: boolean -- controls discard confirmation dialog visibility
- summaryData: object|null -- session summary data after completing workout
- startDisabled: boolean -- prevents double-tap on start buttons
- isRestTimerActive: boolean -- whether rest timer overlay is showing
- restTimerKey: number -- forces RestTimer remount on new timer start
- userSettings: object|null -- user preferences (rest timer duration, auto-start, etc.)
- showSettings: boolean -- controls SettingsModal visibility
- previousPerformance: object -- maps exercise ID to previous session data
- restTimerEndTime: number|null -- epoch ms when rest timer expires
- swapPickerExercise: object|null -- exercise currently being swapped (opens AlternativePicker)
- swappedExercises: object -- maps original exercise ID to swap data
- savePromptData: object|null -- data for SavePreferencePrompt modal
- promptedExercises: Set -- exercise IDs already prompted for save preference
- strengthOnly: boolean -- whether running strength-only mode
- showAddExercise: boolean -- controls AddExerciseModal visibility
- addedExercises: array -- exercises manually added during session

### API Calls
- GET `/settings` -- on mount -- fetches user rest timer settings
- GET `/session/previous-performance?exerciseIds=...` -- when session becomes active -- fetches previous set data
- PUT `/workout/slot/{originalExerciseId}/reset` -- on handleResetToDefault -- resets swapped exercise
- GET `/session/previous-performance?exerciseIds={id}` -- on handleAddExercise -- fetches previous data for newly added exercise
- Workout data fetched via useData() context (fetchWorkout)
- Session management via useWorkoutSession() hook

### Navigation
- Links to: `/session?type=strength` (full session), `/?mode=empty` (empty workout resume)
- Opened from: Workout.jsx (as default view when mode !== 'empty')

### Props Received
- onLogout: function -- callback to log the user out

### Child Components Used
- ResumeBanner (inline) -- shows banner for unfinished sessions
- SessionHeader -- elapsed time, volume, finish/discard/settings buttons
- PhaseCheckbox -- checkbox for non-strength phases
- ExerciseSessionCard -- individual exercise with set logging UI
- RestTimer -- countdown overlay between sets
- SettingsModal -- rest timer configuration
- ConfirmDialog -- confirmation dialogs for finish/discard
- SessionSummary -- post-workout summary card
- SaveRoutineModal -- save workout as reusable routine
- AlternativePicker -- exercise swap picker
- SavePreferencePrompt -- prompt to save swapped exercise preference
- AddExerciseModal -- search/add exercise modal
- WorkoutDashboard -- dashboard view when no active session

### Hooks Used
- useNavigate, useAuth, useData, useWorkoutSession, useSaveRoutine, useState, useEffect, useRef, useCallback

### Features/Functionality
- Full 5-phase workout with phase checkboxes for non-strength phases
- Strength-only mode filtering to only strength phases
- Exercise swapping mid-session with alternatives, optional preference save
- Rest timer with auto-start (configurable duration/auto-start), persists via sessionStorage
- PR detection with device vibration
- Session resume for unfinished sessions
- Add exercises during active session
- Session summary with option to save as routine
- Rest timer dismissal: Tapping input fields or explicit skip; debounced 500ms

### Hardcoded values
- DAY_NAMES array (English), Rest timer default 90s, Skeleton 4 cards, "kg" unit, fullSessionMin formula (5+5+main+5+5), avgSetsPerExercise=3, vibrate(100ms)

---

## Workout -- `client/src/pages/Workout.jsx`

### Purpose
Router/container page switching between TodayView (default) and EmptyWorkoutView based on URL query params.

### UI Elements
- Wrapper div with max-width 420px containing either TodayView or EmptyWorkoutView

### State Variables
- None

### API Calls
- None

### Navigation
- Opened from: App.jsx route "/"

### Props Received
- onLogout: function -- passed through to TodayView

### Child Components Used
- TodayView -- default workout view
- EmptyWorkoutView -- custom/empty workout view

### Hooks Used
- useSearchParams -- reads `mode`, `exerciseId`, `exerciseName`, `routineId` from URL query

### Features/Functionality
- Mode routing: `?mode=empty` renders EmptyWorkoutView, otherwise TodayView
- Passes initialExerciseId, initialExerciseName, routineId to EmptyWorkoutView

### Hardcoded values
- maxWidth: 420, padding: '20px 16px'

---

## Session -- `client/src/pages/Session.jsx`

### Purpose
Orchestrates a full 5-phase guided workout session (breathwork, warmup, main strength, cooldown, closing breathwork) with phase progression and final summary.

### UI Elements
- Phase progress dots (colored, animated width for current phase), elapsed session time
- Phase banner (animated fade-in/out on transition)
- Current phase content: PreSessionOverview, SessionBreathwork, SessionYoga, SessionMainWork, or SessionSummary5Phase
- Phase icons via emoji-based flow.PHASE_ICONS

### State Variables
- None (all state managed by useSessionFlow hook)

### API Calls
- fetchWorkout() via useData context -- on mount

### Navigation
- Links to: `/` (on handleDone after summary)
- Opened from: TodayView "Start Full Session" button via `/session?type=strength`

### Child Components Used
- PreSessionOverview, SessionBreathwork, SessionYoga, SessionMainWork, SessionSummary5Phase

### Hooks Used
- useNavigate, useSearchParams, useData, useSessionFlow

### Features/Functionality
- Phase progression: overview -> opening_breathwork -> warmup -> main_work -> cooldown -> closing_breathwork -> summary
- Phase progress dots with colors per phase type (purple=breathwork, green=yoga, orange=main work)
- Phase banner with 2.5s fade animation
- AudioContext unlock on "Begin" for iOS Safari

### Hardcoded values
- Phase colors: #a78bfa, #5DCAA5, #D85A30; dot dimensions 24px/8px; animation 2.5s; banner rgba(20,28,50,0.92); maxWidth 420

---

## Breathwork -- `client/src/pages/Breathwork.jsx`

### Purpose
Browse and filter breathwork techniques by category, with personalized suggestions, and navigate to timer.

### UI Elements
- Header: "Breathwork" (h1)
- Category filter chips (horizontal scroll): all, energizing, calming, focus, sleep, performance, recovery
- Technique card list (TechniqueCard components)
- Loading: "Loading..." text; Empty: "No techniques found" text

### State Variables
- techniques: array, activeFilter: string ('all'), loading: boolean, suggestions: object

### API Calls
- GET `/breathwork/techniques` or `/breathwork/techniques?category={filter}` -- on mount + filter change
- GET `/suggestions/breathwork?techniqueIds=...` -- when techniques change

### Navigation
- Links to: `/breathe/{techniqueId}` (technique card click)
- Opened from: App.jsx route `/breathe`, bottom NavBar

### Child Components Used
- TechniqueCard

### Hooks Used
- useNavigate, useState, useEffect

### Features/Functionality
- 7-category filtering, personalized suggestions, horizontal scroll filter chips

### Hardcoded values
- CATEGORIES array (7), filter chip colors rgba(167,139,250,...), maxWidth 420

---

## BreathworkTimer -- `client/src/pages/BreathworkTimer.jsx`

### Purpose
Guided breathwork session timer with animated breath circle, round tracking, pause/resume/stop controls, safety warnings, and session logging.

### UI Elements
- Header: Technique name + back arrow; elapsed time (monospace)
- Pre-start: technique description, instructions card, protocol info, "Begin Session" button
- Active: phase instruction text, BreathCircle animation, round counter, TimerControls
- Complete: SessionSummary (breathwork)
- SafetyWarningModal for yellow/red techniques
- Stop confirmation modal ("End session early?")

### State Variables
- technique: object|null, loading: boolean, safetyAccepted: boolean, showStopConfirm: boolean, sessionLogged: boolean, hasStarted: boolean

### API Calls
- GET `/breathwork/techniques/{techniqueId}` -- on mount
- POST `/breathwork/sessions` -- on complete or early stop

### Navigation
- Links to: `/breathe` (back button, safety warning "Go Back")
- Opened from: Breathwork.jsx technique card click

### Child Components Used
- BreathCircle, TimerControls, SessionSummary (breathwork), SafetyWarningModal

### Hooks Used
- useParams, useNavigate, useBreathworkTimer, useState, useEffect, useCallback, useRef

### Features/Functionality
- Safety warnings for non-green techniques
- Protocol display (phases, rounds, ratio)
- AudioContext init for phase-transition chime
- Auto-log on complete, early stop logging
- Pause/resume, round tracking

### Hardcoded values
- Protocol cycles fallback: 1; button colors purple/red; modal background rgba(20,28,50,0.98); maxWidth 420/300

---

## EmptyWorkout -- `client/src/pages/EmptyWorkout.jsx`

### Purpose
Custom/empty workout session where users manually add exercises, log sets, and finish, with support for pre-loading a single exercise or a full routine.

### UI Elements
- Header: "CUSTOM WORKOUT" label, "Empty Workout" title, stats line
- SessionHeader (timer, volume, finish/discard/settings)
- Exercise cards list or empty state with plus-circle SVG
- "+ Add Exercise" button, sticky "Finish Workout" button (green)
- Modals: ConfirmDialog x2, AddExerciseModal, SettingsModal, SaveRoutineModal, SessionSummary

### State Variables
- exercises: array, confirmFinish: boolean, confirmDiscard: boolean, summaryData: object|null, previousPerformance: object, isRestTimerActive: boolean, restTimerKey: number, restTimerEndTime: number|null, userSettings: object|null, showSettings: boolean, showAddExercise: boolean, toast: string|null

### API Calls
- GET `/settings` -- on mount
- GET `/routines/{routineId}` -- when routineId provided
- GET `/exercises/{exerciseId}` -- when initialExerciseId provided
- GET `/session/previous-performance?exerciseIds=...` -- when exercises change
- Session management via useWorkoutSession()

### Navigation
- Links to: `/` (discard/finish), `/strength` (routine load failure)
- Opened from: Workout.jsx `?mode=empty`; Strength.jsx

### Props Received
- initialExerciseId: number|null, initialExerciseName: string|null, routineId: number|null

### Child Components Used
- SessionHeader, ExerciseSessionCard, SessionSummary, SaveRoutineModal, RestTimer, SettingsModal, ConfirmDialog, AddExerciseModal

### Hooks Used
- useNavigate, useWorkoutSession, useSaveRoutine, useState, useEffect, useRef

### Features/Functionality
- Empty workout start (no workout_id), routine pre-loading, single exercise pre-loading
- Session resume from logged_sets metadata
- Deferred timer until first exercise added
- Rest timer, save as routine, PR vibration

### Hardcoded values
- "kg" in stats, default_sets=3, default_reps=10, "CUSTOM WORKOUT"/"Empty Workout", timeout 1500ms

---

## ExerciseHistory -- `client/src/pages/ExerciseHistory.jsx`

### Purpose
Categorized history of all exercises the user has performed, grouped by pillar (Strength, Yoga, Breathwork) in collapsible sections.

### UI Elements
- Header: Back arrow + "Exercise History" title
- Three collapsible PillarSection cards with exercise counts
- ExerciseRow items: name, best metric, PR badge, last session date, sessions count
- Icons: Emojis (dumbbell, lotus, wind, chart, sparkle), expand/collapse arrows
- Loading: "Loading..." text; Error: red error box

### State Variables
- data: object|null, loading: boolean, error: string|null, expanded: object

### API Calls
- GET `/progress/exercises` -- on mount

### Navigation
- Links to: `/profile` (back), `/progress/{exerciseId}?type={kind}` (exercise click)
- Opened from: Profile.jsx "Exercise History" card

### Features/Functionality
- Pillar grouping with color-coded sections, collapsible with URL state preservation
- Per-exercise: best weight/hold, PR indicator, last session, session count
- Empty states per-section and global

### Hardcoded values
- PILLARS array with emojis, "kg" suffix, date format en-US, maxWidth 480

---

## ExerciseProgress -- `client/src/pages/ExerciseProgress.jsx`

### Purpose
Detailed progress view for a single exercise with chart, summary stats, and recent sessions with time range filtering.

### UI Elements
- Header: Back arrow + exercise name (ellipsis overflow)
- Range toggle (30d, 90d, All)
- ProgressChart (SVG), gold dots legend
- Summary stats (type-specific: strength/yoga/breathwork)
- Recent sessions list (strength only, with set breakdowns)

### State Variables
- range: string ('30d' default)

### API Calls
- Via useExerciseProgress hook

### Navigation
- Links to: `/exercise-history?expand={kind}` (back, preserves expanded section)
- Opened from: ExerciseHistory.jsx exercise row click

### Child Components Used
- ProgressChart, StatCell (inline), SummaryStrength/SummaryYoga/SummaryBreathwork (inline)

### Features/Functionality
- Time range filter (30d/90d/all), type-specific views
- Chart with gold PR dots, recent sessions with set breakdowns
- Smart back navigation, estimated 1RM for strength

### Hardcoded values
- RANGES array, 'kg'/'s' units, date format en-US, maxWidth 480

---

## Login -- `client/src/pages/Login.jsx`

### Purpose
Authentication page for existing users.

### UI Elements
- Header: "DailyForge" h1, "Workout. Yoga. Breathwork." tagline
- Email input (type="email", required), Password input (type="password", required)
- "Log In" submit button
- Link to /register ("No account? Sign up")
- Error: "auth-error" paragraph

### State Variables
- email: string, password: string, error: string

### API Calls
- None directly; calls onLogin prop

### Navigation
- Links to: `/register`, `/` (on success)
- Opened from: App.jsx `/login`; redirect when unauthenticated

### Props Received
- onLogin: function(email, password)

### Features/Functionality
- HTML5 required validation, error display, auto-redirect on success

### Hardcoded values
- "DailyForge", "Workout. Yoga. Breathwork."

### Missing features
- No loading/disabled state on submit, no "forgot password" flow

---

## Register -- `client/src/pages/Register.jsx`

### Purpose
Registration page for new users.

### UI Elements
- Header: "DailyForge" h1, "Create your account" tagline
- Name input (text, required), Email input (email, required), Password input (password, required)
- "Sign Up" submit button
- Link to /login ("Have an account? Log in")
- Error: "auth-error" paragraph

### State Variables
- name: string, email: string, password: string, error: string

### API Calls
- None directly; calls onRegister prop

### Navigation
- Links to: `/login`, `/` (on success)
- Opened from: Login.jsx "Sign up" link

### Props Received
- onRegister: function(email, password, name)

### Missing features
- No loading/disabled state, no password strength indicator, no ToS acceptance

---

## Profile -- `client/src/pages/Profile.jsx`

### Purpose
User profile showing workout calendar, exercise history link, settings (unit system), body measurements, and logout.

### UI Elements
- Header: "Profile" h1
- WorkoutCalendar, "Exercise History" card (chart emoji + chevron)
- ProfileSettings (unit system), BodyMeasurements (when profile loaded)
- Logout button (when onLogout provided)
- Loading: "Loading profile..."; Error: red error box

### State Variables
- profile: object|null, profileError: string|null, profileLoading: boolean

### API Calls
- GET `/users/profile` -- on mount

### Navigation
- Links to: `/exercise-history`
- Opened from: App.jsx `/profile`, bottom NavBar

### Props Received
- onLogout: function

### Child Components Used
- WorkoutCalendar, BodyMeasurements, ProfileSettings

### Hardcoded values
- maxWidth 480, default unit_system 'metric'

### Missing features
- No edit profile (name/email)

---

## Strength -- `client/src/pages/Strength.jsx`

### Purpose
Strength training hub with empty workout start, saved routines carousel, and exercise browser.

### UI Elements
- Header: "Strength" (17px, bold)
- EmptyWorkoutCard, "My Routines" section with horizontal scroll carousel
- RoutineCard: play icon (start), trash icon (delete), time ago, exercise count
- ExerciseBrowser (searchable exercise list)
- ConfirmDialog for routine deletion
- Icons: Play triangle SVG, Trash SVG, Clipboard SVG (empty state)
- Loading: "Loading..." in routines section

### State Variables
- starting: boolean, routines: array, routinesLoading: boolean, deleteTarget: object|null

### API Calls
- GET `/routines` -- on mount
- DELETE `/routines/{id}` -- on confirmed delete

### Navigation
- Links to: `/?mode=empty`, `/?mode=empty&exerciseId={id}&exerciseName={name}`, `/?mode=empty&routineId={id}`
- Opened from: App.jsx `/strength`, bottom NavBar

### Child Components Used
- EmptyWorkoutCard, ExerciseBrowser, RoutineCard (inline), ConfirmDialog

### Features/Functionality
- Empty workout quick start, routine management (view/start/delete)
- Exercise quick-start from browser, routine carousel with timeAgo
- Delete confirmation

### Hardcoded values
- Background '#0a1628', RoutineCard width 240px, timeAgo thresholds, minHeight calc(100vh-80px), paddingBottom 90, maxWidth 420

### Missing features
- No routine editing (rename, reorder exercises), no routine sharing

---

## Yoga -- `client/src/pages/Yoga.jsx`

### Purpose
Yoga practice configuration: select practice type, level, duration, focus areas, then generate and play a session.

### UI Elements
- Header: "Yoga" (17px, bold)
- PracticeTypeSelector, LevelSelector, DurationSelector, FocusChips, RecentSessions, StartButton
- PosePreviewModal (generated session preview), YogaSessionPlayer (full-screen player)
- Error: red error banner

### State Variables
- playingSession: object|null

### API Calls
- Via useYogaSession hook

### Navigation
- Session plays in-page as overlay
- Opened from: App.jsx `/yoga`, bottom NavBar

### Child Components Used
- PracticeTypeSelector, LevelSelector, DurationSelector, FocusChips, RecentSessions, StartButton, PosePreviewModal, YogaSessionPlayer

### Features/Functionality
- Session configuration, AI-generated session, pose preview with regeneration
- Recent session reload, in-page player overlay

### Hardcoded values
- Background '#0a1628', error colors, minHeight calc(100vh-80px), paddingBottom 90, maxWidth 420

---

## App -- `client/src/App.jsx`

### Purpose
Root component handling auth routing, DataProvider wrapper, and NavBar.

### Routes (unauthenticated)
- `/login` -> Login
- `/register` -> Register
- `/*` -> redirect to /login

### Routes (authenticated)
- `/` -> Workout (with onLogout)
- `/strength` -> Strength
- `/session` -> Session
- `/yoga` -> Yoga
- `/breathe` -> Breathwork
- `/breathe/:techniqueId` -> BreathworkTimer
- `/profile` -> Profile (with onLogout)
- `/exercise-history` -> ExerciseHistory
- `/progress/:exerciseId` -> ExerciseProgress
- `/*` -> redirect to /

### Features/Functionality
- Auth gating, DataProvider context for authenticated routes
- paddingBottom: 80 for NavBar clearance
- Returns null during auth loading (no splash screen)

### Missing features
- No splash/loading screen, no route-level code splitting, no 404 page

---

## main.jsx -- `client/src/main.jsx`

### Purpose
Entry point: mounts React app with StrictMode, ErrorBoundary, and BrowserRouter.

---

# 3. Component Inventory

## AlternativePicker -- `client/src/components/AlternativePicker.jsx`

### Purpose
Bottom sheet for swapping a workout exercise with an alternative from a fetched list.

### Props
- exerciseId: number -- required -- exercise slot ID
- workoutId: number -- required -- workout ID for API
- onSelect: function -- required -- called with chosen alternative
- onClose: function -- required -- dismiss

### UI Elements
- BottomSheet with "Swap Exercise" title
- "CURRENT" label with exercise name + muscle tags
- "ALTERNATIVES" list with name, difficulty badge, muscle tags
- "Currently saved preference" indicator
- Loading/empty states

### State
- data: API response, loading: boolean

### Events/Callbacks
- onSelect(alt), onClose()

### Hardcoded values
- DIFFICULTY_COLORS: beginner=#1D9E75, intermediate=#D85A30, advanced=#E53E3E

### Used In
- SessionMainWork

---

## BottomSheet -- `client/src/components/BottomSheet.jsx`

### Purpose
Shared reusable bottom-sheet overlay with slide-up animation, portal-rendered to document.body.

### Props
- onClose: function -- required
- title: string|node -- required
- maxHeight: string -- optional (default '60vh')
- zIndex: number -- optional (default 200)
- children: JSX|function -- required

### UI Elements
- Full-screen backdrop with blur, rounded panel with sticky header (title + close X), scrollable content

### State
- visible: entrance/exit animation

### Hardcoded values
- Background rgba(20,28,50,0.98), animation 200ms/250ms, close button 28x28

### Used In
- AlternativePicker, MidSessionPicker, ExerciseDetailModal, PreSessionOverview

---

## ErrorBoundary -- `client/src/components/ErrorBoundary.jsx`

### Purpose
React class-based error boundary catching render errors, shows reload button.

### UI Elements
- Full-viewport error screen: "Something went wrong", "Reload App" button (amber #f59e0b)

### Used In
- App root wrapper (main.jsx)

---

## ExerciseCard -- `client/src/components/ExerciseCard.jsx`

### Purpose
Two-mode exercise component: ExerciseRow (view/preview) and ExerciseSessionCard (active session logging with sets, weights, reps, PRs, duration tracking).

### Props (ExerciseRow, default export)
- exercise: object -- required
- isExpanded: boolean -- required
- onToggle: function -- required
- onSwap: function -- optional
- onReset: function -- optional

### Props (ExerciseSessionCard, named export)
- exercise: object -- required
- sets: array -- required
- previousData: object -- optional
- prData: object -- optional
- onLogSet: function -- required
- onInputFocus: function -- optional
- onSwap: function -- optional
- onReset: function -- optional
- onSkip: function -- optional

### UI Elements
- ExerciseRow: name, type color dot, "SWAPPED" badge, expandable detail (muscles, description, YouTube thumbnail, difficulty/type/source badges, swap/reset buttons)
- ExerciseSessionCard: name header + muscle tags, swap/skip buttons, SET/PREVIOUS/KG/REPS columns, SetRow grid, DurationSetRow for timed exercises, SuggestionHint, "Add Set" button, PR badge with gold glow

### State
- ExerciseSessionCard: setCount, localSets, suggestion
- SetRow: weight, reps, showTypeMenu, glowing
- DurationSetRow: duration, holdTimer (usePausableTimer)

### Icons
- Inline SVGs: checkmark, swap arrows, play triangle, YouTube (YTIcon from tokens)

### Hardcoded values
- SET_TYPE_LABELS: normal='', warmup='W', dropset='D', failure='F'; default sets 3; GOLD for PR badges

### Used In
- SessionMainWork, PhaseCard

---

## NavBar -- `client/src/components/NavBar.jsx`

### Purpose
Fixed bottom tab navigation with five tabs: Home, Strength, Yoga, Breathe, Profile.

### UI Elements
- Fixed bottom bar (56px), five NavLink tabs with custom SVG icons and labels
- Active: white icon, orange (#D85A30) label; inactive: 30% white

### Icons
- Custom inline SVGs: HomeIcon, StrengthIcon (barbell), YogaIcon (figure), BreatheIcon (leaf), ProfileIcon (person)

### Hardcoded values
- INACTIVE: rgba(255,255,255,0.3), ACTIVE_LABEL: #D85A30
- Routes: /, /strength, /yoga, /breathe, /profile
- Height 56px, background #0a0f1c

### Used In
- App layout (persistent)

---

## PhaseCard -- `client/src/components/PhaseCard.jsx`

### Purpose
Phase-related components: PhaseCheckbox (toggle non-strength phases), PhaseSection (collapsible exercise list), PhaseBar (proportional color bar).

### Props (PhaseCheckbox)
- phase: object, checked: boolean, onToggle: function

### Props (PhaseSection)
- phase: object, expandedId: string|number, onToggleExpand: function, onSwap: function, onReset: function

### Props (PhaseBar)
- phases: array

### Icons
- Inline SVG: checkmark, chevron

### Used In
- SessionMainWork (PhaseCheckbox), Workout page (PhaseSection, PhaseBar)

---

## ProgressChart -- `client/src/components/ProgressChart.jsx`

### Purpose
Recharts line chart for exercise progression with PR dot markers.

### Props
- data: array (default []), dataKey: string (default 'weight'), color: string (default '#f59e0b'), prKey: string (default 'is_pr'), unit: string, height: number (default 220)

### UI Elements
- LineChart with CartesianGrid, XAxis (date), YAxis, Tooltip, Line with custom PR dot renderer
- Empty state: "No data yet"

### Hardcoded values
- GOLD for PR dots, tooltip bg #0c1222, date format en-US

### Used In
- ExerciseProgress page

---

## RestTimer -- `client/src/components/RestTimer.jsx`

### Purpose
Floating rest timer overlay with circular SVG progress ring, countdown, and skip button.

### Props
- duration: number (default 90), endTime: number -- required, isActive: boolean -- required, onSkip/onFinish/onDismiss: functions

### UI Elements
- Slide-up bar with blur, circular SVG ring (64px, color-coded green>yellow>red), countdown (mm:ss), "Skip Rest" button

### State
- remaining: seconds, visible: animation, finished: boolean

### Hardcoded values
- z-index 90, ring 64px, auto-dismiss 2000ms, color thresholds >50%/>20%, default 90s, bottom 70px+safe area

### Used In
- SessionMainWork, TodayView, EmptyWorkout

---

## SavePreferencePrompt -- `client/src/components/SavePreferencePrompt.jsx`

### Purpose
Modal prompting user to save a swapped exercise/technique as preferred.

### Props
- exerciseName: string, originalExerciseId: number, chosenExerciseId: number, onSave: function, onDismiss: function, saveAction: function (optional custom)

### UI Elements
- Overlay with modal card, "Save Preference?" heading, "Not now" and "Yes, save" buttons
- Auto-dismiss after 10s

### Used In
- SessionMainWork, SessionBreathwork, SessionYoga, YogaSessionPlayer

---

## SaveRoutineModal -- `client/src/components/SaveRoutineModal.jsx`

### Purpose
Modal for saving exercises as a named routine.

### Props
- isOpen: boolean, onClose: function, exercises: array, onSaved: function

### UI Elements
- Portal modal with clipboard icon, name input (max 100), description input (max 200), exercise preview list, error area, Cancel/Save buttons

### Used In
- Workout pages, SessionSummary

---

## SessionHeader -- `client/src/components/SessionHeader.jsx`

### Purpose
Sticky header during active sessions: elapsed time, volume, action buttons.

### Props
- elapsed: number, totalVolume: number, onFinish/onDiscard: functions, onPause/onSaveRoutine: functions (optional), formatTime: function, isFinishing: boolean

### UI Elements
- Sticky top bar with backdrop blur, timer (accent, mono), volume in kg
- Pause button (SVG), more menu (three-dot) with "Save as Routine" and "Discard workout", "Finish" button (green)

### Used In
- SessionMainWork, TodayView, EmptyWorkout

---

## SessionSummary + ConfirmDialog -- `client/src/components/SessionSummary.jsx`

### Purpose
Full-screen workout completion summary with stats, PRs, exercise list, save-as-routine. Also exports reusable ConfirmDialog.

### UI Elements (SessionSummary)
- "WORKOUT COMPLETE" header (party emoji), 2x2 stats grid (Duration/Volume/Sets/Exercises), PR section (trophy), exercise completion list, "Save as Routine" button, "Done" button

### UI Elements (ConfirmDialog)
- Centered modal with title, message, Cancel + Confirm buttons

### Icons
- Inline SVGs: checkmark, clipboard; Emojis: party popper, trophy, flexed bicep

---

## SettingsModal -- `client/src/components/SettingsModal.jsx`

### Purpose
Rest timer settings: duration, enabled toggle, auto-start toggle.

### UI Elements
- Modal with duration chips (30s/60s/90s/120s/3m/5m), toggle switches, Cancel/Save buttons

### Hardcoded values
- DURATION_OPTIONS: [30, 60, 90, 120, 180, 300], defaults: 90s/enabled/auto-start

---

## Calendar/CalendarDay -- `client/src/components/Calendar/CalendarDay.jsx`

### Purpose
Individual day cell showing session activity dots and streak highlight.

### Hardcoded values
- DOT_COLORS: strength=#f59e0b, yoga=#14b8a6, breathwork=#3b82f6; max 3 dots

---

## Calendar/SessionBottomSheet -- `client/src/components/Calendar/SessionBottomSheet.jsx`

### Purpose
Swipe-dismissable bottom sheet showing session details for a calendar day.

### Features
- Touch gesture dismiss (80px or 0.5 px/ms velocity threshold)
- Session cards with type badge, duration, PR count, exercise count

---

## Calendar/StreakCounter -- `client/src/components/Calendar/StreakCounter.jsx`

### Purpose
Current/best streak display with fire/sparkle emoji.

---

## Calendar/WorkoutCalendar -- `client/src/components/Calendar/WorkoutCalendar.jsx`

### Purpose
Full monthly calendar with session dots, streak, month nav, day detail sheet.

### API Calls
- GET `/session/calendar?month=YYYY-MM`

---

## Dashboard/QuickStartButtons -- `client/src/components/Dashboard/QuickStartButtons.jsx`

### Purpose
Three quick-start buttons: Strength, Yoga, Breathwork.

---

## Dashboard/RecentWins -- `client/src/components/Dashboard/RecentWins.jsx`

### Purpose
Dashboard card showing recent PRs, weekly activity, milestones.

---

## Dashboard/TodaySessionCard -- `client/src/components/Dashboard/TodaySessionCard.jsx`

### Purpose
Today's scheduled workout card with 5-phase dots and "Start Full Session" button.

### Hardcoded values
- PHASES: 5 entries with colors (#3b82f6, #14b8a6, GOLD, #14b8a6, #3b82f6) and labels (Br, Wm, St, Cl, En)

---

## Dashboard/WeekProgress -- `client/src/components/Dashboard/WeekProgress.jsx`

### Purpose
7-day dot grid (Mon-Sun) with filled/empty circles and today highlight.

---

## Dashboard/WorkoutDashboard -- `client/src/components/Dashboard/WorkoutDashboard.jsx`

### Purpose
Main dashboard orchestrating greeting, streak, today's session, quick start, week progress, recent wins.

### API Calls
- GET `/dashboard`

### Features
- Time-of-day greeting (morning 5-12, afternoon 12-17, evening otherwise)
- Skeleton loaders during fetch

---

## breathwork/BreathCircle -- `client/src/components/breathwork/BreathCircle.jsx`

### Purpose
Animated circular breathwork indicator scaling with inhale/exhale/hold phases.

### Hardcoded values
- PHASE_STYLES: inhale=#3B82F6(blue), exhale=#F59E0B(amber), hold=#10B981(green); circle min(65vw, 280px)

---

## breathwork/SafetyWarningModal -- `client/src/components/breathwork/SafetyWarningModal.jsx`

### Purpose
Warning dialog for advanced/cautioned breathwork techniques with contraindications.

---

## breathwork/SessionSummary -- `client/src/components/breathwork/SessionSummary.jsx`

### Purpose
Breathwork session completion screen with technique, duration, rounds, navigation.

---

## breathwork/TechniqueCard -- `client/src/components/breathwork/TechniqueCard.jsx`

### Purpose
Breathwork technique card with tradition, category, difficulty, safety level, duration.

### Hardcoded values
- SAFETY_DOTS: green/yellow/red unicode circles; DIFFICULTY_COLORS: beginner=#10B981, intermediate=#F59E0B, advanced=#EF4444

---

## breathwork/TimerControls -- `client/src/components/breathwork/TimerControls.jsx`

### Purpose
Play/pause and stop controls for breathwork timer.

---

## profile/AddMeasurementModal -- `client/src/components/profile/AddMeasurementModal.jsx`

### Purpose
Bottom-sheet modal for adding body measurement with weight, body fat, circumferences, notes.

### UI Elements
- Date input, weight input (kg/lb), body fat %, 5 circumference inputs (cm/in), notes textarea, Save button

---

## profile/BodyMeasurements -- `client/src/components/profile/BodyMeasurements.jsx`

### Purpose
Container for body measurements section: summary, chart, circumferences, photos.

### Child Components
- MeasurementsSummary, MeasurementsChart, CircumferencesCard, ProgressPhotos, HeightPromptModal, AddMeasurementModal

---

## profile/CircumferencesCard -- `client/src/components/profile/CircumferencesCard.jsx`

### Purpose
Latest circumference measurements with week/total deltas and directional arrows.

---

## profile/HeightPromptModal -- `client/src/components/profile/HeightPromptModal.jsx`

### Purpose
One-time height entry modal (for BMI), supports metric/imperial.

---

## profile/MeasurementsChart -- `client/src/components/profile/MeasurementsChart.jsx`

### Purpose
Interactive Recharts line chart with metric selector, time range filter, 7-day rolling average.

### UI Elements
- Metric selector chips (Weight, Body Fat, Waist, Hips, Chest, L Bicep, R Bicep)
- Range selector (1M, 3M, 6M, 1Y, All)
- LineChart with actual + rolling average lines

---

## profile/MeasurementsSummary -- `client/src/components/profile/MeasurementsSummary.jsx`

### Purpose
Summary card: weight, BMI with category, body fat %, 7-day average, week delta.

---

## profile/ProfileSettings -- `client/src/components/profile/ProfileSettings.jsx`

### Purpose
Metric/Imperial unit system toggle.

---

## profile/ProgressPhotos -- `client/src/components/profile/ProgressPhotos.jsx`

### Purpose
Progress photo gallery with camera capture, thumbnail grid, full-screen viewer, delete. Uses IndexedDB storage.

### Features
- Max 50 photos, 3-column grid with date overlays, full-screen viewer, confirm delete

---

## session/MidSessionPicker -- `client/src/components/session/MidSessionPicker.jsx`

### Purpose
Bottom sheet for swapping yoga poses or breathwork techniques during a session.

### Props
- type: 'yoga'|'breathwork', currentName: string, alternatives: array, loading: boolean, onSelect: function, onClose: function, accentColor: string

---

## session/PhaseTransition -- `client/src/components/session/PhaseTransition.jsx`

### Purpose
Full-screen interstitial between 5-phase session phases with 5-second auto-countdown and skip.

---

## session/PreSessionOverview -- `client/src/components/session/PreSessionOverview.jsx`

### Purpose
Pre-session configuration: 5 phase cards with skip toggle, duration (3/5/7 min), level, technique picker, total duration estimate, "BEGIN SESSION" button.

### API Calls
- GET `/session/overview/${workoutId}`
- GET `/breathwork/techniques?category=...`

---

## session/SessionBreathwork -- `client/src/components/session/SessionBreathwork.jsx`

### Purpose
Breathwork phase player within 5-phase sessions with swap, auto-start, silent sit (closing), session logging.

### Features
- Silent sit (60s) after closing breathwork
- Phase categories: opening=[energizing,focus,performance], closing=[calming,sleep,recovery]

---

## session/SessionMainWork -- `client/src/components/session/SessionMainWork.jsx`

### Purpose
Main strength phase: exercise cards, set logging, rest timer, swaps, pausing, session lifecycle.

### UI Elements
- SessionHeader, PauseOverlay, exercise cards, skipped placeholders, "+ Add Exercise", "Finish Workout"
- Overlays: RestTimer, AlternativePicker, SavePreferencePrompt, AddExerciseModal, ConfirmDialog

---

## session/SessionSummary5Phase -- `client/src/components/session/SessionSummary5Phase.jsx`

### Purpose
5-phase session summary: per-phase breakdowns (breathwork, yoga, strength) with auto-save.

### API Calls
- POST `/session/complete-5phase`

---

## session/SessionYoga -- `client/src/components/session/SessionYoga.jsx`

### Purpose
Yoga phase player within 5-phase sessions: pose timer, auto-advance, swapping, save preference.

### API Calls
- GET `/yoga/generate?...`
- GET `/yoga/alternatives?...`

---

## strength/EmptyWorkoutCard -- `client/src/components/strength/EmptyWorkoutCard.jsx`

### Purpose
CTA card to start empty workout with circle-plus icon.

---

## strength/ExerciseBrowseCard -- `client/src/components/strength/ExerciseBrowseCard.jsx`

### Purpose
Exercise list item: name, primary muscle, difficulty badge, chevron.

---

## strength/ExerciseBrowser -- `client/src/components/strength/ExerciseBrowser.jsx`

### Purpose
Paginated exercise browser with muscle filter chips, search, detail modal.

### Features
- Debounced search (300ms), pagination (PAGE_SIZE=30), ExerciseDetailModal

---

## strength/ExerciseDetailModal -- `client/src/components/strength/ExerciseDetailModal.jsx`

### Purpose
Bottom sheet with exercise details and "Do This Exercise" action.

---

## strength/MuscleFilterChips -- `client/src/components/strength/MuscleFilterChips.jsx`

### Purpose
Horizontal scrollable muscle group filter chips (12 groups).

### Hardcoded values
- PRESET_GROUPS: All, Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core, Forearms

---

## workout/AddExerciseModal -- `client/src/components/workout/AddExerciseModal.jsx`

### Purpose
Full-screen slide-up modal for adding exercises mid-workout with search, filters, duplicate detection.

### Features
- Duplicate toast ("Exercise already in workout"), auto-focus search, pagination

---

## workout/SuggestionHint -- `client/src/components/workout/SuggestionHint.jsx`

### Purpose
Tappable hint showing progressive overload suggestion that auto-fills set inputs.

---

## workout/tokens.jsx -- `client/src/components/workout/tokens.jsx`

### Purpose
Shared design tokens, color constants, and utility functions.

### Exports
- C: {bg: '#0c1222', card, border, text, textSec, textMuted, textHint, accent: '#D85A30', green: '#1D9E75'}
- MONO: 'SF Mono, Fira Code, monospace'
- GOLD: '#f59e0b'
- typeColor(type), formatExerciseDetail(ex), formatVolume(v), youtubeSearchUrl(name, type), extractVideoId(url), parseMuscles(targetMuscles), isStrengthPhase(phase), YTIcon

### Type Colors
- strength=#D85A30, yoga=#1D9E75, breathwork=#a78bfa, cardio=#F9CB40, stretch/mobility=#5DCAA5

---

## yoga/DurationSelector -- `client/src/components/yoga/DurationSelector.jsx`

### Purpose
5 preset duration buttons: 10, 20, 30, 45, 60 minutes.

---

## yoga/FocusChips -- `client/src/components/yoga/FocusChips.jsx`

### Purpose
Multi-select chips: Hips, Hamstrings, Back, Shoulders, Core, Neck, Chest, Balance, Twists, Strength.

---

## yoga/LevelSelector -- `client/src/components/yoga/LevelSelector.jsx`

### Purpose
3-segment pill: Beginner, Intermediate, Advanced.

---

## yoga/PoseCard -- `client/src/components/yoga/PoseCard.jsx`

### Purpose
Yoga pose card with phase emoji, name, muscles, hold time, info button, suggestion hint.

### Icons
- Emojis: sunrise (warmup), fire (peak), moon (cooldown), lotus (savasana)

---

## yoga/PoseInfoPopup -- `client/src/components/yoga/PoseInfoPopup.jsx`

### Purpose
Pose detail popup: description (truncated 200 chars + "Read more"), muscles, hold time, difficulty, flow transition.

---

## yoga/PosePreviewModal -- `client/src/components/yoga/PosePreviewModal.jsx`

### Purpose
Full-screen preview of generated yoga session: grouped poses by phase, stats (poses/minutes/kcal), regenerate/begin.

### Hardcoded values
- kcal estimate: duration * 3; TYPE_LABELS; PHASE_ORDER: warmup/peak/cooldown/savasana

---

## yoga/PracticeTypeSelector -- `client/src/components/yoga/PracticeTypeSelector.jsx`

### Purpose
Scrollable pill selector: Vinyasa (wave), Hatha (lotus), Yin (moon), Restore (cloud), Sun (sun).

---

## yoga/RecentSessions -- `client/src/components/yoga/RecentSessions.jsx`

### Purpose
Recent yoga session cards for quick re-loading of previous configurations.

---

## yoga/StartButton -- `client/src/components/yoga/StartButton.jsx`

### Purpose
Floating bottom "Start" button showing yoga config summary.

---

## yoga/YogaSessionPlayer -- `client/src/components/yoga/YogaSessionPlayer.jsx`

### Purpose
Full-screen standalone yoga session player: pose timer, auto-advance, swapping, completion, session saving.

### API Calls
- POST `/yoga/session`
- GET `/yoga/alternatives?...`
- PUT `/workout/exercise-pref`

---

# 4. API Endpoint Inventory

## Server Configuration

- **Base URL prefix:** `/api`
- **Middleware:** helmet (CSP disabled), cors (origin: config.clientUrl), express.json()
- **Auth:** JWT Bearer token via jsonwebtoken, decodes {id, email} to req.user
- **Error handler:** 4xx as-is; 5xx returns "Internal server error"
- **Required env:** JWT_SECRET, DATABASE_URL, PORT (3001), CLIENT_URL (http://localhost:5173), JWT_EXPIRES_IN (7d)
- **Optional env:** IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT, GCP_PROJECT_ID, GCP_LOCATION, RAPIDAPI_KEY

### Health Check

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/health` | No | - | `{status:'ok'}` | Health check |

### Auth -- `server/src/routes/auth.js`

Rate limited: 10 attempts / 15 min

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| POST | `/api/auth/register` | No | `{email, password, name}` | `{user, token}` (201) | Register |
| POST | `/api/auth/login` | No | `{email, password}` | `{user, token}` | Login |

Password: >=8 chars, uppercase+lowercase+number. bcrypt 12 rounds.

### Body Measurements -- `server/src/routes/bodyMeasurements.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/body-measurements` | Yes | Query: limit (max 500) | `[{id, measured_at, weight_kg, body_fat_percent, waist_cm, hips_cm, chest_cm, bicep_left_cm, bicep_right_cm, notes}]` | List measurements |
| GET | `/api/body-measurements/latest` | Yes | - | Single or null | Latest measurement |
| GET | `/api/body-measurements/stats` | Yes | - | `{latest, bmi, bmi_category, rolling_avg_7d, weight_delta_week, weight_delta_total, circumference_deltas}` | Aggregated stats |
| POST | `/api/body-measurements` | Yes | `{measured_at?, weight_kg?, body_fat_percent?, waist_cm?, hips_cm?, chest_cm?, bicep_left_cm?, bicep_right_cm?, notes?}` | Created (201) | Create |
| PUT | `/api/body-measurements/:id` | Yes | Same fields | Updated | Update |
| DELETE | `/api/body-measurements/:id` | Yes | - | `{deleted:true}` | Delete |

### Breathwork -- `server/src/routes/breathwork.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/breathwork/techniques` | No | Query: category? | `[{id, name, sanskrit_name, tradition, category, purposes, difficulty, safety_level, caution_note, protocol, estimated_duration}]` | List techniques |
| GET | `/api/breathwork/techniques/:id` | No | - | Full technique | Get technique |
| GET | `/api/breathwork/alternatives` | Yes | Query: techniqueId, category | `{alternatives}` | Alt techniques |
| PUT | `/api/breathwork/preference` | Yes | `{phase, technique_id}` | `{success, phase, technique_id}` | Save preference |
| GET | `/api/breathwork/preferences` | Yes | - | `{opening?, closing?}` | Get preferences |
| POST | `/api/breathwork/sessions` | Yes | `{technique_id, duration_seconds, rounds_completed, completed}` | `{id, logged:true}` | Log session |

### Dashboard -- `server/src/routes/dashboard.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/dashboard` | Yes | - | `{user, lastSession, thisWeek, recentPRs, weekActivity, milestone}` | Dashboard data |

7 parallel queries. Streak = consecutive days including breathwork-only. Milestones at 10/25/50/100/250/500.

### Exercises -- `server/src/routes/exercises.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/exercises/strength` | Yes | Query: muscle?, search?, limit?, offset? | `{exercises, total, hasMore}` | Browse exercises |
| GET | `/api/exercises/muscle-groups` | Yes | - | `{groups}` | Distinct muscles |
| GET | `/api/exercises/:id` | Yes | - | Single exercise | Exercise detail |

16 allowed muscle groups. Search ranking: exact > starts-with > word-boundary > contains.

### Media -- `server/src/routes/media.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| POST | `/api/media/test-upload` | Yes | `{base64}` (max 5MB) | `{success, url, fileId}` | Test ImageKit upload |

### Progress -- `server/src/routes/progress.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/progress/exercises` | Yes | - | `{strength, yoga, breathwork}` | All user exercises |
| GET | `/api/progress/exercise/:id` | Yes | Query: range, type? | `{exercise, summary, chart_data, recent_sessions}` | Exercise chart data |
| POST | `/api/progress/recalculate/:exercise_id` | Yes | `{type?}` | `{recalculated:true}` | Force cache recalc |

Service: Brzycki 1RM formula, working-set filtering, lazy cache backfill.

### Progress Photos -- `server/src/routes/progressPhotos.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/progress-photos` | Yes | - | `[{id, taken_at, view, local_storage_key, created_at}]` | List metadata |
| POST | `/api/progress-photos` | Yes | `{taken_at?, view?, local_storage_key}` | Created (201) | Save metadata |
| DELETE | `/api/progress-photos/:id` | Yes | - | `{deleted, local_storage_key}` | Delete metadata |

Max 50 photos/user. Views: front, side, back.

### Routines -- `server/src/routes/routines.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| POST | `/api/routines` | Yes | `{name, description?, exercises}` | Created (201) | Create routine |
| GET | `/api/routines` | Yes | - | `[{id, name, description, created_at, updated_at, exercise_count, last_used}]` | List routines |
| GET | `/api/routines/:id` | Yes | - | Routine + exercises | Routine detail |
| PUT | `/api/routines/:id` | Yes | `{name?, description?, exercises?}` | Updated | Update routine |
| DELETE | `/api/routines/:id` | Yes | - | `{deleted:true}` | Delete routine |

Max 50 exercises/routine. Uses DB transactions.

### Session -- `server/src/routes/session.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| POST | `/api/session/start` | Yes | `{workout_id?, workout_ids?, type?, initial_exercises?, routine_id?}` | `{session}` (201) or `{session, resumed, logged_sets}` (200) | Start/resume |
| GET | `/api/session/active` | Yes | - | `{session, logged_sets}` or `{session:null}` | Check active |
| PUT | `/api/session/:id/log-set` | Yes | `{exercise_id, set_number, weight, reps, rpe?, set_type?}` | `{set, session_totals, prs}` | Log set + PR detect |
| PUT | `/api/session/:id/complete` | Yes | - | `{session, summary, prs}` | Complete session |
| DELETE | `/api/session/:id` | Yes | - | `{deleted:true}` | Discard session |
| GET | `/api/session/previous-performance` | Yes | Query: exerciseIds | `{previousPerformance}` | Previous sets |
| GET | `/api/session/overview/:workoutId` | Yes | - | `{workout, phases, total_estimated_duration}` | Pre-session overview |
| POST | `/api/session/complete-5phase` | Yes | `{session_id?, workout_id?, total_duration, phases}` | `{session, logged:true}` | Log 5-phase session |
| GET | `/api/session/calendar` | Yes | Query: month=YYYY-MM | `{sessions, streak}` | Calendar view |

Key: `SELECT ... FOR UPDATE` for race prevention. Atomic upsert for sets. Detects weight/volume/reps PRs. Set types: normal, warmup, dropset, failure. Session types: strength, yoga, breathwork, stretching, 5phase.

### Settings -- `server/src/routes/settings.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/settings` | Yes | - | `{rest_timer_duration, rest_timer_enabled, rest_timer_auto_start}` | Get settings |
| PUT | `/api/settings` | Yes | `{rest_timer_duration?, rest_timer_enabled?, rest_timer_auto_start?}` | Updated | Upsert settings |

Defaults: 90s, enabled, auto-start. Duration clamped 10-600.

### Suggestions -- `server/src/routes/suggestions.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/suggestions/strength/:exerciseId` | Yes | - | `{suggestedWeight, suggestedReps, reason, unit}` | Strength suggestion |
| GET | `/api/suggestions/yoga` | Yes | Query: exerciseIds | `{suggestions}` | Batch yoga suggestions |
| GET | `/api/suggestions/yoga/:exerciseId` | Yes | - | `{suggestedHoldSeconds, reason}` | Single yoga suggestion |
| GET | `/api/suggestions/breathwork` | Yes | Query: techniqueIds | `{suggestions}` | Batch breathwork suggestions |
| GET | `/api/suggestions/breathwork/:techniqueId` | Yes | - | `{suggestedCycles, reason}` | Single breathwork suggestion |

Logic: Strength -- if last 2 sessions hit >=8 reps at same weight, suggest +2.5kg/+5lb (barbell) or +1kg/+2.5lb (dumbbell). Yoga -- if last 3 same hold, suggest +15s (max 120s). Breathwork -- 3+ sessions, suggest +2 cycles (max 12).

### Users -- `server/src/routes/users.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/users/profile` | Yes | - | `{id, email, name, height_cm, unit_system}` | Get profile |
| PUT | `/api/users/profile` | Yes | `{height_cm?, unit_system?}` | Updated | Update profile |

### Workout -- `server/src/routes/workout.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/workout/today` | Yes | - | `{day_of_week, day_label, name, type, phases}` | Today's workout |
| GET | `/api/workout/:workoutId/slots/:exerciseId/alternatives` | Yes | - | `{slot_id, default_exercise, alternatives, user_preference}` | Slot alternatives |
| PUT | `/api/workout/slot/:exerciseId/choose` | Yes | `{chosen_exercise_id}` | `{success}` | Save preference |
| PUT | `/api/workout/slot/:exerciseId/reset` | Yes | - | `{success, reset_to_default:true}` | Reset preference |
| PUT | `/api/workout/exercise-pref` | Yes | `{exercise_id, chosen_exercise_id}` | `{success}` | Generic exercise pref |

Phase order: opening_breathwork, warmup, main, cooldown, closing_breathwork.

### Yoga -- `server/src/routes/yoga.js`

| Method | Path | Auth | Request Body | Response | Purpose |
|--------|------|------|--------------|----------|---------|
| GET | `/api/yoga/generate` | Yes | Query: type?, level?, duration?, focus?, category_filter? | `{session}` | Generate session |
| GET | `/api/yoga/alternatives` | Yes | Query: exerciseId, category, practiceType?, maxDifficulty? | `{alternatives}` | Alt poses |
| GET | `/api/yoga/recent` | Yes | - | `{sessions}` | Last 3 sessions |
| POST | `/api/yoga/session` | Yes | `{type, level, duration, focus?, poses?}` | `{id, logged:true}` (201) | Log yoga session |

Types: vinyasa, hatha, yin, restorative, sun_salutation. Levels: beginner, intermediate, advanced. Duration: 5-120 min. Phase allocation: 15% warmup, 60% peak, 20% cooldown, 5% savasana.

---

# 5. Database Schema

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| height_cm | DECIMAL(5,1) | |
| unit_system | VARCHAR(10) | DEFAULT 'metric' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### workouts
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### workout_slots
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| day_of_week | INT | NOT NULL, CHECK 0-6 |
| label | VARCHAR(100) | |
| workout_id | INT | FK -> workouts(id) |
| phase | VARCHAR(30) | DEFAULT 'main', UNIQUE(day_of_week, phase) |

### exercises
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| workout_id | INT | FK -> workouts(id) |
| name | VARCHAR(255) | NOT NULL |
| sanskrit_name | VARCHAR(255) | |
| target_muscles | TEXT | |
| type | VARCHAR(50) | DEFAULT 'strength' |
| default_sets | INT | |
| default_reps | INT | |
| default_duration_secs | INT | |
| sort_order | INT | DEFAULT 0 |
| description | TEXT | |
| url | TEXT | |
| source | VARCHAR(100) | |
| difficulty | VARCHAR(50) | |
| media_url | TEXT | |
| thumbnail_url | TEXT | |
| review_status | VARCHAR(20) | DEFAULT 'pending' |
| review_notes | TEXT | |
| media_type | VARCHAR(10) | DEFAULT 'image' |
| category | VARCHAR(20) | |
| tracking_type | VARCHAR(20) | DEFAULT 'weight_reps' |
| practice_types | TEXT[] | |
| hold_times_json | JSONB | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

Unique index: (name, source) WHERE workout_id IS NULL

### sessions
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE |
| workout_id | INT | FK -> workouts(id) |
| routine_id | INT | FK -> user_routines(id) ON DELETE SET NULL |
| date | DATE | DEFAULT CURRENT_DATE |
| type | VARCHAR(20) | DEFAULT 'strength' |
| completed | BOOLEAN | DEFAULT false |
| duration | INTEGER | (seconds) |
| started_at | TIMESTAMPTZ | DEFAULT NOW() |
| completed_at | TIMESTAMPTZ | |
| notes | TEXT | |
| phases_json | JSONB | |

### session_exercises
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| session_id | INT | FK -> sessions(id) ON DELETE CASCADE |
| exercise_id | INT | FK -> exercises(id) |
| sets_completed | INT | |
| reps_completed | INT | |
| weight | NUMERIC | |
| duration_secs | INT | |
| sort_order | INT | DEFAULT 0 |
| set_number | INT | |
| rpe | DECIMAL(3,1) | |
| set_type | VARCHAR(20) | DEFAULT 'normal' |
| completed | BOOLEAN | DEFAULT false |
| notes | TEXT | |
| hold_duration_seconds | INT | |
| rounds_completed | INT | |
| technique_ratio | VARCHAR(20) | |

Unique: (session_id, exercise_id, set_number)

### user_slot_prefs
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE |
| slot_id | INT | FK -> workout_slots(id) |
| workout_id | INT | FK -> workouts(id) |

Unique: (user_id, slot_id)

### slot_alternatives
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| exercise_id | INT | FK -> exercises(id) ON DELETE CASCADE |
| alternative_exercise_id | INT | FK -> exercises(id) ON DELETE CASCADE |

Unique: (exercise_id, alternative_exercise_id)

### user_exercise_prefs
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE |
| exercise_id | INT | FK -> exercises(id) ON DELETE CASCADE |
| chosen_exercise_id | INT | FK -> exercises(id) ON DELETE CASCADE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

Unique: (user_id, exercise_id)

### breathwork_techniques
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| name | VARCHAR(100) | NOT NULL, UNIQUE |
| sanskrit_name | VARCHAR(100) | |
| tradition | VARCHAR(50) | NOT NULL |
| category | VARCHAR(50) | NOT NULL |
| purposes | TEXT[] | NOT NULL |
| difficulty | VARCHAR(20) | NOT NULL |
| safety_level | VARCHAR(10) | NOT NULL DEFAULT 'green' |
| protocol | JSONB | NOT NULL |
| description | TEXT | NOT NULL |
| instructions | TEXT | NOT NULL |
| benefits | TEXT[] | |
| contraindications | TEXT[] | |
| caution_note | TEXT | |
| source | VARCHAR(100) | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### breathwork_sessions
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE, NOT NULL |
| technique_id | INT | FK -> breathwork_techniques(id), NOT NULL |
| duration_seconds | INT | NOT NULL |
| rounds_completed | INT | NOT NULL |
| completed | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### breathwork_logs
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE, NOT NULL |
| session_id | INT | FK -> sessions(id) ON DELETE SET NULL |
| technique_id | INT | FK -> breathwork_techniques(id), NOT NULL |
| rounds_completed | INT | NOT NULL |
| avg_hold_seconds | INT | |
| max_hold_seconds | INT | |
| total_duration_seconds | INT | |
| ratio_used | VARCHAR(20) | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### user_breathwork_prefs
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE, NOT NULL |
| phase | VARCHAR(10) | NOT NULL, CHECK IN ('opening','closing') |
| technique_id | INT | FK -> breathwork_techniques(id), NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

Unique: (user_id, phase)

### user_settings
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id), UNIQUE |
| rest_timer_duration | INT | DEFAULT 90 |
| rest_timer_enabled | BOOLEAN | DEFAULT true |
| rest_timer_auto_start | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### exercise_progress_cache
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE, NOT NULL |
| exercise_id | INT | NOT NULL |
| kind | VARCHAR(20) | NOT NULL DEFAULT 'strength' |
| best_weight | DECIMAL(6,2) | |
| best_weight_date | DATE | |
| best_volume | INT | |
| best_volume_date | DATE | |
| estimated_1rm | DECIMAL(6,2) | |
| best_hold_seconds | INT | |
| best_hold_date | DATE | |
| best_breath_hold_seconds | INT | |
| best_breath_hold_date | DATE | |
| total_rounds | INT | |
| total_sessions | INT | DEFAULT 0 |
| first_session_date | DATE | |
| last_session_date | DATE | |
| improvement_percentage | DECIMAL(6,2) | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

Unique: (user_id, exercise_id, kind)

### body_measurements
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE, NOT NULL |
| measured_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| weight_kg | DECIMAL(5,2) | |
| body_fat_percent | DECIMAL(4,1) | |
| waist_cm | DECIMAL(5,1) | |
| hips_cm | DECIMAL(5,1) | |
| chest_cm | DECIMAL(5,1) | |
| bicep_left_cm | DECIMAL(5,1) | |
| bicep_right_cm | DECIMAL(5,1) | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### progress_photos
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE, NOT NULL |
| taken_at | DATE | NOT NULL |
| view | VARCHAR(10) | DEFAULT 'front' |
| local_storage_key | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### user_routines
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE, NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| description | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### user_routine_exercises
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| routine_id | INT | FK -> user_routines(id) ON DELETE CASCADE, NOT NULL |
| exercise_id | INT | FK -> exercises(id), NOT NULL |
| position | INT | NOT NULL |
| target_sets | INT | DEFAULT 3 |
| notes | TEXT | |

Unique: (routine_id, position)

### habits (UNUSED -- no API routes)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| user_id | INT | FK -> users(id) ON DELETE CASCADE |
| name | VARCHAR(255) | NOT NULL |
| type | VARCHAR(20) | DEFAULT 'boolean' |
| unit | VARCHAR(50) | |
| target_value | NUMERIC | |
| category | VARCHAR(50) | DEFAULT 'personal' |
| sort_order | INT | DEFAULT 0 |
| active | BOOLEAN | DEFAULT true |
| auto_type | VARCHAR(50) | DEFAULT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### habit_entries (UNUSED -- no API routes)
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| habit_id | INT | FK -> habits(id) ON DELETE CASCADE |
| entry_date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| value | NUMERIC | DEFAULT 0 |

Unique: (habit_id, entry_date)

---

# 6. Hooks Inventory

## useAuth -- `client/src/hooks/useAuth.js`

### Purpose
Manages authentication state with localStorage persistence.

### Returns
- user: object|null -- {id, email, name}
- loading: boolean -- initial hydration
- login(email, password): function
- register(email, password, name): function
- logout(): function

### API Calls
- POST `/auth/login`, POST `/auth/register`

### Used In
- App.jsx

---

## useBreathworkTimer -- `client/src/hooks/useBreathworkTimer.js`

### Purpose
Drives breathwork session timer through protocol phases with audio cues and haptic feedback.

### Parameters
- protocol: object -- {phases: [{type, duration, instruction}], cycles: number}

### Returns
- currentPhase, currentRound, totalRounds, secondsRemaining, totalElapsed
- isRunning, isComplete, soundEnabled
- toggleSound(), initAudio(), start(), pause(), resume(), stop()

### Internal
- AudioContext for sine wave breath sounds (inhale rising 150-400Hz, exhale falling 400-150Hz)
- Sound preference persisted as `dailyforge_breathwork_sound` in localStorage

### Used In
- BreathworkTimer.jsx, SessionBreathwork.jsx

---

## useExerciseProgress -- `client/src/hooks/useExerciseProgress.js`

### Purpose
Fetches progression detail for a single exercise with stale-request cancellation.

### Parameters
- exerciseId: number, range: string ('30d'|'90d'|'all'), type: string|null

### Returns
- data: object|null, loading: boolean, error: string|null, refetch(): function

### Used In
- ExerciseProgress.jsx

---

## usePausableTimer -- `client/src/hooks/usePausableTimer.js`

### Purpose
Timestamp-based pausable timer that never drifts.

### Returns
- elapsed: number, state: 'idle'|'running'|'paused', isRunning, isPaused
- start(), pause(), resume(), reset()

### Used In
- useSessionFlow.js, ExerciseCard (DurationSetRow), SessionYoga, YogaSessionPlayer

---

## useSaveRoutine -- `client/src/hooks/useSaveRoutine.js`

### Purpose
Manages save-as-routine modal state.

### Returns
- isOpen, hasBeenSaved, open(), close(), onSaved(), canSave(exercises)

### Used In
- SessionMainWork.jsx, EmptyWorkout.jsx

---

## useSessionFlow -- `client/src/hooks/useSessionFlow.js`

### Purpose
Orchestrates 5-phase workout flow: overview -> opening_breathwork -> warmup -> main_work -> cooldown -> closing_breathwork -> summary.

### Returns
- currentPhase, phaseIndex, skippedPhases, phaseConfig, phaseResults
- sessionId, startedAt, sessionType, elapsedSeconds, isPaused, phaseBanner
- PHASES, ACTIVE_PHASES, PHASE_LABELS, PHASE_ICONS
- setSessionType(), toggleSkipPhase(), updatePhaseConfig(), recordPhaseResult()
- beginSession(), completePhase(), getActivePhases(), getNextPhase()
- pauseSession(), resumeSession(), formatTime(), getTotalDuration()

### Used In
- Session.jsx

---

## useWorkoutSession -- `client/src/hooks/useWorkoutSession.js`

### Purpose
Manages strength session lifecycle with localStorage persistence and PR tracking.

### Returns
- sessionId, workoutId, isActive, startedAt, elapsedSeconds
- exerciseSets, totalSets, totalVolume, exercisesDone, isLoading
- resumeData, sessionPrs
- checkActiveSession(), startSession(), logSet(), completeSession(), discardSession()
- resumeSession(), dismissResume(), formatTime(), setTimerDeferred(), undeferTimer()

### Persistence
- localStorage key: `dailyforge_active_session`
- Concurrency guard via pendingSets ref

### Used In
- TodayView.jsx, EmptyWorkout.jsx, SessionMainWork.jsx

---

## useYogaSession -- `client/src/hooks/useYogaSession.js`

### Purpose
Manages yoga session configuration, generation, and recent history.

### Returns
- config: {type, level, duration, focus[]}, recentSessions, isGenerating, generatedSession, error
- selectType(), selectLevel(), selectDuration(), toggleFocus(), loadRecent(), generateSession(), clearSession()

### Persistence
- Config in localStorage as `yoga_config`
- Defaults: type='vinyasa', level='intermediate', duration=30, focus=[]

### Used In
- Yoga.jsx, SessionYoga.jsx, YogaSessionPlayer.jsx

---

# 7. Context / Global State

## DataProvider -- `client/src/contexts/DataProvider.jsx`

### Context Values
| Value | Type | Purpose |
|-------|------|---------|
| workoutData | object\|null | Today's workout from `/api/workout/today` |
| workoutLoading | boolean | Initial fetch loading |
| fetchWorkout(force?) | function | Fetch today's workout (skips if <5min fresh unless force) |
| invalidateWorkout() | function | Clear stale timestamp + force refetch |

### Behavior
- Staleness: 5 minutes (STALE_MS)
- Auto-refetch on visibility change after 5+ minutes
- Deduplicates concurrent fetches
- Keeps cached data on error

### Consumer hook
- useData()

### Used By
- TodayView, SessionMainWork, Session

---

## localStorage Keys
| Key | Purpose |
|-----|---------|
| `dailyforge_token` | JWT auth token |
| `dailyforge_user` | Serialized user object |
| `dailyforge_active_session` | Active workout session state |
| `dailyforge_breathwork_sound` | Breathwork sound preference (true/false) |
| `yoga_config` | Yoga session configuration |

## sessionStorage Keys
| Key | Purpose |
|-----|---------|
| `dailyforge_rest_timer_end` | Rest timer end epoch for persistence across tab switches |

## IndexedDB
| Store | Purpose |
|-------|---------|
| `dailyforge` / `progress-photos` | Progress photo blobs + thumbnails (via localforage) |

---

# 8. Utilities & Services

## api.js -- `client/src/utils/api.js`

HTTP client wrapper around fetch with JWT auth.

### Exports
- api.get(path), api.post(path, data), api.put(path, data), api.delete(path)
- ApiError class: status, message, userMessage

### Behavior
- Base URL: `/api`
- Auto-attaches `Authorization: Bearer <token>` from localStorage
- Maps HTTP codes to user-friendly messages (0=network, 401=log in again, 429=rate limit)

---

## unitConversion.js -- `client/src/utils/unitConversion.js`

### Exports
- kgToLbs(kg), lbsToKg(lbs)
- cmToFeetInches(cm), feetInchesToCm(feet, inches)
- cmToInches(cm), inchesToCm(inches)
- calculateBMI(weightKg, heightCm), getBMICategory(bmi) -> {label, color}
- formatWeight(kg, system), formatLength(cm, system), formatHeight(cm, system)
- toKg(value, system), toCm(value, system), fromKg(kg, system), fromCm(cm, system)

### BMI Categories
- Underweight (<18.5) #60a5fa, Normal (18.5-25) #1D9E75, Overweight (25-30) #f59e0b, Obese (30+) #ef4444

---

## photoStorage.js -- `client/src/services/photoStorage.js`

### Purpose
On-device progress photo storage via IndexedDB (localforage). Photos never leave device.

### Exports
- savePhoto(file, {date?, view?}) -- saves blob + auto-thumbnail (240px, JPEG 70%), max 15MB
- getPhoto(key), deletePhoto(key), listPhotoKeys(), blobToUrl(blob)

---

# 9. Styles & Design Tokens

## Font
- Primary: `'Outfit'` (weights 300-700) from Google Fonts
- Fallback: system sans-serif
- Monospace: `SF Mono, Fira Code, monospace`

## Color Palette

### Core Colors (from tokens.jsx)
| Token | Value | Usage |
|-------|-------|-------|
| C.bg | `#0c1222` | Body/page background |
| C.accent | `#D85A30` | Primary accent (burnt orange) |
| C.green | `#1D9E75` | Success/positive |
| GOLD | `#f59e0b` | PRs, streaks, amber highlights |

### Text Colors
| Token | Value |
|-------|-------|
| C.text | `rgba(255,255,255,0.95)` |
| C.textSec | `rgba(255,255,255,0.6)` |
| C.textMuted | `rgba(255,255,255,0.4)` |
| C.textHint | `rgba(255,255,255,0.25)` |

### Surface Colors
| Token | Value |
|-------|-------|
| C.card | `rgba(255,255,255,0.06)` |
| C.border | `rgba(255,255,255,0.06)` |
| Input bg | `rgba(255,255,255,0.04)` |
| Input border (focus) | `rgba(255,255,255,0.15)` |
| Button bg | `rgba(255,255,255,0.08)` |
| Button bg (hover) | `rgba(255,255,255,0.12)` |

### Feature-Specific Colors
| Usage | Value |
|-------|-------|
| Breathwork/purple | `#a78bfa` |
| Yoga/teal | `#5DCAA5` / `#5eead4` |
| Main work/orange | `#D85A30` |
| Cardio/yellow | `#F9CB40` |
| NavBar bg | `#0a0f1c` |
| ErrorBoundary bg | `#0a1628` |

### Difficulty Colors
| Level | Value |
|-------|-------|
| Beginner | `#1D9E75` (green) |
| Intermediate | `#D85A30` (orange) |
| Advanced | `#E53E3E` (red) |

### Calendar Dot Colors
| Type | Value |
|------|-------|
| Strength | `#f59e0b` (amber) |
| Yoga | `#14b8a6` (teal) |
| Breathwork | `#3b82f6` (blue) |

### Breathwork Phase Colors
| Phase | Value |
|-------|-------|
| Inhale | `#3B82F6` (blue) |
| Exhale | `#F59E0B` (amber) |
| Hold | `#10B981` (green) |

## Global CSS (index.css)
- Box-sizing: border-box, margin/padding reset
- -webkit-tap-highlight-color: transparent
- Scrollbar hidden (`::-webkit-scrollbar { width: 0 }`)
- overflow-x: clip on body
- No CSS custom properties used -- all values hardcoded in component styles

## Notable Dimensions
- NavBar height: 56px
- App paddingBottom: 80px (NavBar clearance)
- Max page widths: 420px (workout/breathwork/yoga), 480px (profile/exercise history)
- BottomSheet default maxHeight: 60vh
- Rest timer ring: 64px

---

# 10. Seed Data

## Workouts (7 -- one per day)
| Day | Workout | Exercise Count |
|-----|---------|----------------|
| Sun | Active Recovery / Rest | 3 |
| Mon | Push (Chest/Shoulders/Triceps) | 6 |
| Tue | Pull (Back/Biceps) | 6 |
| Wed | Legs & Glutes | 6 |
| Thu | Yoga & Mobility | 6 |
| Fri | Core & Conditioning | 6 |
| Sat | Full Body Strength | 6 |

## Alternatives
~60+ alternative exercises across all days (2-3 per default exercise). Equipment swaps: barbell -> dumbbell -> bodyweight -> cable -> machine.

## Breathwork Techniques (49 total)
- Pranayama: 15 (Nadi Shodhana, Kapalabhati, Ujjayi, etc.)
- Western: 13 (Box Breathing, 4-7-8, Wim Hof, etc.)
- Therapeutic: 8 (Yoga Nidra Breath, Coherent Breathing, etc.)
- Goal-specific: 8 (Pre-lift Brace, Sprint Recovery, etc.)
- Advanced: 5 (Breath of Fire, Tummo, etc.)

Each includes: safety level (green/yellow/red), protocol phases, cycles, benefits, contraindications.

## Phase Exercises (25 total)
- Warm-up: 7 (Sun Salutation A, Cat-Cow, etc.)
- Cool-down: 8 (Downward Dog, Pigeon Pose, etc.)
- Breathwork (phase): 10 (Kapalabhati, Box Breathing, etc.)

## Strength Exercise Library
Sourced from ExerciseDB (RapidAPI) + Free Exercise DB (GitHub). Hundreds of exercises with equipment, muscles, instructions.

## Yoga Pose Library (~157 poses)
Sourced from Yoga API + Yogism + HuggingFace. Includes Sanskrit names, difficulty, practice types, hold times, categories.

---

# 11. Summary Statistics

| Category | Count |
|----------|-------|
| **Total Pages** | 13 |
| **Total Components** | 53 |
| **Total Custom Hooks** | 8 |
| **Total API Endpoints** | 42 |
| **Total Database Tables** | 18 (16 active + 2 unused) |
| **Total Seed Workouts** | 7 |
| **Total Seeded Exercises** | ~45 default + ~60 alternatives + hundreds in library |
| **Total Breathwork Techniques** | 49 |
| **Total Yoga Poses** | ~157 |
| **Total Context Providers** | 1 (DataProvider) |
| **Total localStorage Keys** | 5 |
| **Total sessionStorage Keys** | 1 |
| **Total IndexedDB Stores** | 1 |
| **External Dependencies (UI)** | recharts (charts), localforage (IndexedDB), react-router-dom |
| **External Dependencies (Server)** | express, pg, bcrypt, jsonwebtoken, helmet, cors, express-rate-limit |
| **Icon Libraries** | None -- all icons are custom inline SVGs or emoji |

### Dead Code / Unused Tables
- `habits` and `habit_entries` tables exist in schema but have no API routes or frontend references

### Missing Features (noted during audit)
- No forgot password flow
- No splash/loading screen during auth check
- No route-level code splitting
- No 404 page (silent redirects)
- No loading/disabled state on auth form submit buttons
- No password strength indicator or confirmation field
- No edit profile (name/email) capability
- No routine editing (rename, reorder exercises)
- No routine sharing
- No offline support for session data
- Error states silently swallowed in several places
- No service worker registration visible in main.jsx

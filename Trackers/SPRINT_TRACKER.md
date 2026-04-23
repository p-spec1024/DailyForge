# DailyForge — Sprint Tracker

**28 tickets + 1 health check shipped across 6 sprints (React PWA).**
**Sprint 7+: Flutter rebuild for Android.**

---

## 🚀 MAJOR PIVOT: Flutter Rebuild (Decided Apr 13, 2026)

### Decision Summary
- **Frontend:** React PWA → Flutter (Dart)
- **Backend:** Node.js + Express → **NO CHANGE** (same API)
- **Database:** Neon PostgreSQL → **NO CHANGE**
- **Target:** Android first (Google Play), iOS later

### Why Flutter?
- Better video playback and animations
- Smaller app size (10-20 MB vs 20-40 MB PWA+TWA)
- Native performance for media-heavy app
- Used by Down Dog (our main competitor)

### Folder Structure
```
D:\projects\
├── dailyforge/              ← Keep for backend + reference
│   ├── client/              ← OLD React app (reference only)
│   ├── server/              ← Backend API (KEEP FOREVER)
│   └── Trackers/            ← All tracker files
│
└── dailyforge_flutter/      ← NEW Flutter app (Sprint 7+)
    ├── lib/
    ├── android/
    └── pubspec.yaml
```

### Flutter Project Status
- ✅ Flutter installed (3.41.6)
- ✅ Android SDK configured
- ✅ Project created at `D:\projects\dailyforge_flutter`
- ✅ Dependencies added (go_router, provider, http, fl_chart, lucide_icons)
- ✅ Part 1 setup complete
- ✅ Part 2 shipped (folder structure, theme, routes, glass card)
- ✅ Part 3 shipped (services layer, auth provider, JWT storage, router guards)
- ✅ Part 4 shipped (polished auth pages, 5-tab nav, splash screen, profile logout)

---

## Sprint 7 — Flutter Foundation — Apr 14, 2026 ✅ COMPLETE

**Goal:** Set up Flutter project structure and rebuild auth + navigation.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Flutter Project Setup (Part 1) | ✅ Done | Project created, dependencies installed |
| 2 | Folder Structure + Config (Part 2) | ✅ Done | 16 files, theme, routes, glass card, API config |
| 3 | Services + Providers (Part 3) | ✅ Done | API service, auth provider, JWT storage, router guards, 401 handling |
| 4 | Auth Pages + Navigation (Part 4) | ✅ Done | Login, Register, 5-tab nav (StatefulShellRoute), splash screen, profile logout |

**Progress: 4/4 tickets done — SPRINT 7 COMPLETE**

---

## Sprint 8 — Home + Strength — Apr 14-15, 2026 ✅ COMPLETE

**Goal:** Rebuild core workout pages in Flutter.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Home Page Dashboard | ✅ Done | Greeting, streak, today card, quick starts, week progress. Built by Claude Code. |
| 2 | Strength Page + Exercise Browser | ✅ Done | Exercise browser, routines carousel, muscle filters, detail sheet. Built by Gemini CLI, reviewed and fixed by Claude Code (9 convention issues found and resolved). |
| 3 | Workout Session Logging (Full) | ✅ Done | Split into 3a/3b/3c — all shipped |
| 3a | - Session Provider + Set Logging | ✅ Done | Session provider, set logging, order enforcement (1→2→3), empty input validation (floating SnackBar), back nav guard, finish workout, strength-only filtering. Multiple List<dynamic> type fixes. |
| 3b | - Rest Timer + Settings | ✅ Done | RestTimer widget with CustomPainter ring, color transitions (green→yellow→red), SettingsProvider, SettingsBottomSheet with duration chips and toggles. |
| 3c | - PR Detection + Swap + Summary | ✅ Done | SessionSummaryPage with stats + PRs, ExerciseSwapSheet with alternatives, PrBadge widget. Known issues: PR badge not showing on card, haptic not triggering — deferred to UI polish. |
| 4 | Add Exercise + Save Routine + Resume | ✅ Done | AddExerciseSheet, SaveRoutineSheet, ResumeBanner, EmptyWorkoutPage, routine pre-load. Resume parsing fix applied. |

**Progress: 6/6 tickets done — SPRINT 8 COMPLETE**

### Key Fixes During T3a:
- CORS fix for physical device testing (server/src/index.js line 25: origin: true)
- API config for physical device (lib/config/api_config.dart line 17: PC's local IP)
- Wireless adb debugging setup (adb connect 192.168.0.XXX:5555)

---

## Sprint 9 — Breathwork + Yoga — Apr 15-16, 2026 ✅ COMPLETE

**Goal:** Rebuild breathwork and yoga pillars in Flutter.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Breathwork Page | ✅ Done | Category filters, 49 techniques, safety levels, technique cards. |
| 2 | Breathwork Timer | ✅ Done | Animated breath circle (inhale/hold/exhale), safety modal, timer provider, session logging, phase instructions, duration display fix. |
| 3 | Yoga Page + Session Builder | ✅ Done | Practice type, level, duration, focus chips, pose preview modal, config persistence. |
| 4 | Yoga Session Player | ✅ Done | Pose timer with auto-advance, play/pause/stop controls, pose swap sheet, session completion logging, recent sessions working. |

**Progress: 4/4 tickets done — SPRINT 9 COMPLETE**

---

## Sprint 10 — Profile + Analytics + Home Redesign — Apr 16-22, 2026 🔄 IN PROGRESS

**Goal:** Rebuild analytics, settings, and home page.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Profile Page + Settings | ✅ Done | User info, unit toggle, menu cards, logout |
| 2 | Workout Calendar | ✅ Done | Streak counter, colored dots, month nav, session detail sheet |
| 3 | Exercise History + Charts | ✅ Done | Pillar sections, fl_chart graphs, PR dots |
| 4 | Body Measurements | ✅ Done | Chart/list toggle, month picker, edit/delete |
| 5 | Home Page Redesign (3D Body Map) | 🔄 In Progress | See S10-T5-DESIGN.md for full details |
| 5-prep | - Blender mesh split (27/27) | ✅ Done | 26 muscle meshes + base. File: `D:\projects\dailyforge\media\3d-source\male_anatomy_split_fbx.blend` |
| 5a | - 3D Body Map UI + Rotation + Tap (mock data) | ✅ Done (architecture) | Package (interactive_3d) validated, data layer shipped, selection/tap working. UX/visual polish deferred to post-Blender-resplit (see FUTURE_SCOPE items #93-#102). Committed Apr 23, 2026. |
| 5b | - Backend Endpoints (muscle heatmap, flexibility, recent wins) | ✅ Done | Three endpoints under `/api/body-map/*` (muscle-volumes, flexibility, recent-wins). Built on `lib/data/mock_body_map_data.dart` as the contract. Smoke test at `server/scripts/test-body-map-endpoints.js` (59 checks pass). Branch `s10-t5b`, commit `501714e`. **Mock divergence:** `mockRecentWins` is `List<Map<String,String>>` with only `icon/title/subtitle` — no `type` or `achieved_at` as the original spec assumed; endpoint returns the mock shape. |
| 5c | - Remaining Home Sections + Real Data Wiring | ⏳ Planned | 3-4 days. |

**Status (Apr 22):** T1-T4 shipped. T5-prep complete. T5a unblocked, ready for Claude Code prompt.

---

## Key Learnings

- **Apr 17, 2026 learning:** Blender can silently hang on specific GLB files during interactive mesh operations (Tab into Edit Mode), even after a successful import and even across Blender versions. Always have a troubleshooting ladder ready for mesh editing tasks — never assume "import worked → editing will work." Document workarounds up front.

- **Apr 20, 2026 learning:** FBX conversion is the reliable workaround for GLB Edit Mode hangs. Blender's Text Editor runs multi-line Python scripts correctly; the Python interactive console does NOT (breaks at indentation). Always use the Text Editor + Alt+P for anything with indented blocks.

- **Apr 20, 2026 learning:** Coordinate-bounds Python scripts give 70-85% accuracy for roughly-rectangular muscle regions. Boundary imperfections compensate across muscles (over-reach on chest = smaller delt, net zero lost faces). Accept imperfections and move on rather than iterate toward perfection — iteration has diminishing returns on muscle-by-muscle basis.

- **Apr 20, 2026 learning:** Split mesh granularly (30 sub-meshes) even when current DB only needs 11 groups. Code-level grouping layer makes the mesh future-ready without re-splitting later. The expensive operation (Blender splitting) is one-time; the grouping decision (Flutter code) is cheap to change.

- **Apr 20, 2026 learning:** For bootstrapped products, prefer one-time cost solutions over subscription solutions. Option C ($5 one-time LLM) beats Option B ($10-25/mo API) for v1 launch. Revisit paid paths once the app has revenue.

- **Apr 20, 2026 evening learning:** After `P → Selection`, Blender creates a new object with `.001` suffix. The original object keeps its name but loses the split faces. Always rename the NEW `.001` object to the muscle name — never rename the original (longest-named one). Verify by clicking each object in outliner and watching what highlights in viewport.

- **Apr 20, 2026 evening learning:** Renaming in Edit Mode works fine — no need to Tab out first. Object names are independent of edit state.

- **Apr 20, 2026 evening learning:** After every split, the main body's suffix increments (`.001` → `.002` → `.003`). Always click the longest-named object to continue splitting from the main body.

- **Apr 23, 2026 learning:** `interactive_3d` package treats native as the source of truth for selection state. Bidirectional sync from Dart → native (imperatively calling `clearSelections()` on state transitions) creates a race condition with the native input pipeline — symptoms were taps dropping after the first and intermittent rotation. Fix: let native own selection, drop reactive clear calls, use only one explicit clear on mode switch (an isolated user-driven event). General principle: with small-audience packages that wrap native renderers, the native side usually owns more state than the API surface suggests. Prefer one-way observation (Flutter reads native state via callbacks) over two-way sync.

- **Apr 23, 2026 learning:** Coordinate-bounds mesh splits (used for arms in particular) produce highlight regions that don't match user expectation of where a muscle "is." Bicep split in particular covers only ~30-40% of the perceived bicep surface on the rendered figure. Fix requires re-doing the Blender split with Circle Select for rounded/curvy muscles, not re-export settings. Decision: complete all visual/interaction polish after Blender re-split, since polishing highlight behavior on meshes being replaced is wasted work.

- **Apr 23, 2026 learning:** When scoping backend endpoints for features whose Flutter client already exists (even in mock form), treat the mock data files as the API contract. Saves a round-trip of "build API → adapt client → find mismatch → fix API." For T5b specifically, `lib/data/mock_body_map_data.dart` defines the exact response shapes expected. General principle: whichever side of the client/server boundary ships first defines the contract; the other side conforms.

---

## Sprint 11 — 5-Phase Session + Launch — Planned (dates TBD)

**Goal:** Ship the differentiator and submit to Google Play.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | 5-Phase Session Integration | ⏳ Planned | Pre-session overview, orchestrator, auto-advance w/ 5s countdown, 5-phase summary |
| 2 | Mid-Session Swap | ⏳ Planned | Yoga/breathwork swap during session |
| 3 | Push Notifications | ⏳ Planned | Streak warnings, reminders |
| 4 | Google Play Submission | ⏳ Planned | Store listing, APK build, screenshots using new home design |

**Note:** Sprint 11 starts *after* Sprint 10 T5a/b/c complete.

---

## Media Generation (Parallel Track)

### New Strategy: 3D Rigged Character (Decided Apr 13, 2026)

| Step | Tool | Status |
|------|------|--------|
| 1. Generate character | Tripo AI Pro ($20/mo, 1 month) | ⏳ Pending |
| 2. Auto-rig | Tripo AI (included) | ⏳ Pending |
| 3. Pose in Blender | Blender + Python API | ⏳ Pending |
| 4. Render frames | Blender | ⏳ Pending |
| 5. Upload to ImageKit | ImageKit CDN | ⏳ Pending |
| 6. Update DB URLs | Claude Code | ⏳ Pending |

**Target:**
- 1,015 exercises → Static PNG images
- 35 complex exercises → Short MP4 videos
- Total cost: ~$20 (Tripo AI Pro, 1 month)

---

## Completed Sprints (React PWA)

### Health Check — Apr 13, 2026 (Post-Sprint 6)

Ran `/health-check` after Sprint 6 completion. All 5 recommended fixes shipped on main.

| # | Fix | Commit | Impact |
|---|-----|--------|--------|
| 1 | Error handler + ErrorBoundary | 046b41c | Prevents info leak + app crashes |
| 2 | Batch N+1 INSERTs in routines/session | f75c24b | 10-50x fewer DB round-trips |
| 3 | Password validation + Helmet | ceca2cf | Security hardening |
| 4 | Extract shared BottomSheet component | 9aa0b1d | Replaced 4 modal copies, -200 lines |
| 5 | Split Workout.jsx (1234→29 lines) | f2bc2fd | Extracted TodayView, EmptyWorkout, SettingsModal |

---

### Sprint 6 — Apr 13, 2026 ✅ COMPLETE

**Goal:** Custom Workouts & Strength Page.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Strength Page Redesign + Empty Workout | ✅ Shipped | 5-tab nav, exercise browser, muscle filter chips |
| 2 | Add Exercise to Workout | ✅ Shipped | AddExerciseModal, search ranking, reps_only flag |
| 3 | Save Workout as Routine + Timer Fix | ✅ Shipped | SaveRoutineModal, routines CRUD, timer deferral |
| 4 | Resume Logic Fix | ✅ Shipped | State restoration, timer from startedAt |

---

### Sprint 5 — Apr 11, 2026 ✅ COMPLETE

**Goal:** Phase 3 — Analytics + Choice.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Progression Graphs | ✅ Shipped | Recharts, gold PR dots, Brzycki 1RM |
| 2 | Workout Calendar | ✅ Shipped | Colored dots, streak counter |
| 3 | Body Measurements | ✅ Shipped | Weight, circumferences, BMI, charts |
| 4 | Smart Suggestions | ✅ Shipped | Rule-based for all 3 pillars |
| 5 | Workout Tab Redesign | ✅ Shipped | Dashboard, quick starts, week progress |
| 6 | Mid-Session Swap | ✅ Shipped | Yoga/breathwork swap |

---

### Sprint 4 — Apr 9, 2026 ✅ COMPLETE

**Goal:** Phase 2 — Yoga + Breathwork.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Breathwork Timer UI | ✅ Shipped | 49 techniques, circle animation |
| 2 | Yoga Session Builder | ✅ Shipped | Level filtering, 265 poses |
| 3 | 5-Phase Session Integration | ✅ Shipped | State machine, unified summary |

---

### Sprint 3 — Apr 7, 2026 ✅ COMPLETE

**Goal:** Data seeding + media infrastructure.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | ImageKit Setup | ✅ Shipped | Replaced Cloudinary |
| 2 | Strength Exercise Seeding | ✅ Shipped | 736 exercises |
| 3 | Yoga Pose Library Seeding | ✅ Shipped | 265 poses |
| 4 | Breathwork Technique Seeding | ✅ Shipped | 49 techniques |
| 5 | Exercise Illustrations | ✅ Shipped | Style locked |

---

### Sprint 2 — Apr 6, 2026 ✅ COMPLETE

**Goal:** Infrastructure upgrade + core UX.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Neon DB Migration | ✅ Shipped | From Railway PG |
| 2 | Cloudinary Setup | ✅ Shipped | Later replaced by ImageKit |
| 3 | Exercise Swap UI | ✅ Shipped | Preference saving |
| 4 | Workout Completion Summary | ✅ Shipped | PR detection |
| 5 | PR Detection + Celebration | ✅ Shipped | Gold glow, haptics |

---

### Sprint 1 — Apr 5, 2026 ✅ COMPLETE

**Goal:** Foundation.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Remove Habit Tracking | ✅ Shipped | |
| 2 | Fix Tab Switching Performance | ✅ Shipped | |
| 3 | Workout Session Logging | ✅ Shipped | |
| 4 | Rest Timer Between Sets | ✅ Shipped | |
| 4A | Codebase Cleanup | ✅ Shipped | |
| 5 | Previous Performance Display | ✅ Shipped | |

---

## How This File Works

- PM (Claude.ai) creates tickets during sprint planning
- After each ticket ships, update status to ✅ Done + date
- At sprint retro, review what shipped and plan next sprint
- Flutter rebuild uses same sprint process, different codebase

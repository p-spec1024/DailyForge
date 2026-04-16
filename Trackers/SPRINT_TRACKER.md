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

## Sprint 9 — Breathwork + Yoga — Apr 15-16, 2026 🔄 IN PROGRESS

**Goal:** Rebuild breathwork and yoga pillars in Flutter.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Breathwork Page | ✅ Done | Category filters, 49 techniques, safety levels, technique cards. |
| 2 | Breathwork Timer | ✅ Done | Animated breath circle (inhale/hold/exhale), safety modal, timer provider, session logging, phase instructions, duration display fix. |
| 3 | Yoga Page + Session Builder | ⏳ Planned | Practice type, level, focus area |
| 4 | Yoga Session Player | ⏳ Planned | Pose timer, skip, complete |

**Progress: 2/4 tickets done**

---

## Sprint 10 — Profile + Analytics (Planned)

**Goal:** Rebuild analytics and settings.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Profile Page | ⏳ Planned | Settings, logout |
| 2 | Workout Calendar | ⏳ Planned | Monthly view, session dots |
| 3 | Progression Charts | ⏳ Planned | fl_chart for graphs |
| 4 | Body Measurements | ⏳ Planned | Weight, circumferences, trends |

---

## Sprint 11 — Polish + Launch (Planned)

**Goal:** Final polish and Google Play submission.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | 5-Phase Session Integration | ⏳ Planned | Full session flow |
| 2 | Mid-Session Swap | ⏳ Planned | Yoga/breathwork swap |
| 3 | Push Notifications | ⏳ Planned | Streak warnings, reminders |
| 4 | Google Play Submission | ⏳ Planned | Store listing, APK build |

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

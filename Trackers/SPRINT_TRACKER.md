# DailyForge — Sprint Tracker

**28 tickets shipped across Sprints 1-6 (React PWA, archived).**
**Sprints 7-10 shipped (Flutter rebuild). Sprint 10 closed Apr 25, 2026.**
**Sprint 11 REDIRECTED Apr 26, 2026 — Approach 5 pivot. Original 5-phase-as-flagship scope superseded.**

---

## ⚠️ Sprint 11 REDIRECTED — Approach 5 Pivot (Apr 26, 2026)

**Original Sprint 11 scope is OBSOLETE.** Strategic planning session on Apr 26, 2026 produced a fundamental product-direction change.

### What changed
- DailyForge pivoted from **"5-phase session as flagship daily experience"** to **plan-first home page with cross-pillar focus areas (Approach 5)**.
- The 5-phase session is now **one mode among several**, not the home page identity.
- Google Play submission is **no longer a forcing function** on Sprint 11 — build it right, then ship.

### Source of truth
**`Trackers/PRE_SPRINT_11_PLANNING.md`** — full strategic decisions doc. Read this before writing any Sprint 11+ ticket prompt.

### Sprint 11+ breakdown

**Update Apr 26, 2026 (post-S11-T1):** Sprint 11 scope is now locked — see Sprint 11 section below for the 4-ticket breakdown (T1 shipped, T2–T4 pending). The 9-item sequence below maps roughly across Sprints 11–16; **Sprint 12+ remains TBD** pending a dedicated planning session.

The full Approach 5 sprint sequence has not yet been designed. Next planning session: "lets continue dailyforge — sprint breakdown for Approach 5". The sprint plan needs to sequence:
1. Breathwork tagging (content work — 49 techniques, schema in PRE_SPRINT_11_PLANNING.md §4)
2. Focus area data model (body-focus + state-focus schema)
3. Suggestion engine (focus + level → session)
4. Weekly plan UI (calendar view, day-by-day focus picker)
5. Session composer (build-your-own across pillars)
6. New home page (today's planned session, hybrid suggest+build)
7. 5-phase orchestrator (preserved, repositioned as one of several modes)
8. Onboarding flow (level + initial plan)
9. Polish + Google Play submission

Roughly 4-6 sprints of work. Original Sprint 11 ticket list (below, struck through) is parked pending the new breakdown.

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

### Folder Structure (Updated Apr 25, 2026 — Monorepo)
```
D:\projects\
├── dailyforge\              ← Active monorepo (single source of truth)
│   ├── app\                 ← Flutter app (was D:\projects\dailyforge_flutter)
│   │   ├── lib\
│   │   ├── android\
│   │   ├── assets\
│   │   └── pubspec.yaml
│   ├── server\              ← Backend API (unchanged)
│   ├── Trackers\            ← All tracker files
│   └── docs\                ← Blueprint v5
│
└── _archive\                ← Backups (do not modify)
    ├── dailyforge-react-pwa-2026-04-24.zip
    ├── dailyforge-backend-full-2026-04-24.zip
    └── dailyforge-flutter-full-2026-04-24.zip
```

**React PWA archived:** GitHub repo `dailyforge_flutter` is read-only archived; React `client/` folder zipped to `_archive/`.

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

## Sprint 10 — Profile + Analytics + Home Redesign — Apr 16-24, 2026 ✅ COMPLETE

**Goal:** Rebuild analytics, settings, and home page.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Profile Page + Settings | ✅ Done | User info, unit toggle, menu cards, logout |
| 2 | Workout Calendar | ✅ Done | Streak counter, colored dots, month nav, session detail sheet |
| 3 | Exercise History + Charts | ✅ Done | Pillar sections, fl_chart graphs, PR dots |
| 4 | Body Measurements | ✅ Done | Chart/list toggle, month picker, edit/delete |
| 5 | Home Page Redesign (3D Body Map) | ✅ Done | See S10-T5-DESIGN.md for full details |
| 5-prep | - Blender mesh split (27/27) | ✅ Done | 26 muscle meshes + base. File: `D:\projects\dailyforge\media\3d-source\male_anatomy_split_fbx.blend` |
| 5a | - 3D Body Map UI + Rotation + Tap (mock data) | ✅ Done (architecture) | Package (interactive_3d) validated, data layer shipped, selection/tap working. UX/visual polish deferred to post-Blender-resplit (see FUTURE_SCOPE items #93-#102). Committed Apr 23, 2026. |
| 5b | - Backend Endpoints (muscle heatmap, flexibility, recent wins) | ✅ Done | Three endpoints under `/api/body-map/*` (muscle-volumes, flexibility, recent-wins) wired to the `lib/data/mock_body_map_data.dart` contract. Smoke test at `server/scripts/test-body-map-endpoints.js` — 67 checks, all passing. Branch `s10-t5b`, head `c00ba9d` (pushed, **not merged** — T5c will merge together). **Mock divergence:** `mockRecentWins` is `List<Map<String,String>>` with only `icon/title/subtitle` — no `type` or `achieved_at` as the original spec assumed; endpoint returns the mock shape. **Yoga data quality improved as part of T5b cleanup:** 269 → 258 poses (11 dirty deletes), flexibility region coverage 87.7% → 93.8%, **0 dirty rows remaining**. Migrations kept under `server/scripts/{cleanup,populate}-yoga-muscles-2026-04-24.mjs` as audit trail. |
| 5c | - Remaining Home Sections + Real Data Wiring | ✅ Done | Split into 5c-a (heatmap + flexibility + recent-wins wiring) and 5c-b (three pillars + stats + weekly chart + footer + muscle-mode card). |
| 5c-a | - Home Real Data Wiring (heatmap / flexibility / recent-wins) | ✅ Done | Home page wired to real backend. 3 rounds of iterative fixes (error handling, heatmap colors, selection behavior, retry spinner). Visual polish deferred — figure washed out on cream background is a native renderer lighting issue, not a color constant issue. See FUTURE_SCOPE #110/#111. Branch `s10-t5c-a`, head `f6dd354`. |
| 5c-b | - Remaining Home Sections (pillars / stats / weekly chart / footer) | ✅ Done Apr 24, 2026 | Three-pillar home section (Strength / Yoga / Breathwork cards), Full Session placeholder (disabled, "Available in Sprint 11"), stats row, 4-week stacked chart, inspirational footer. Also shipped: FUTURE_SCOPE #107 (api_service ClientException rewrap) and #112 (muscle-mode card wired to real backend via extended muscle-volumes endpoint). 125/0 smoke test pass. Device verified on Android. Branch `s10-t5c-b`, head `4f244f2`. |

**Status (Apr 24):** Sprint 10 complete. All 5 tickets + 4 sub-tickets (5-prep / 5a / 5b / 5c-a / 5c-b) shipped.

**Note (Apr 26, 2026):** Several Sprint 10 deliverables were designed under the old "5-phase-as-flagship" model. They still work, but their *role* on the home page changes under Approach 5:
- **Three-pillar home cards (5c-b):** Will likely be reworked under Approach 5 — pillars become composition surfaces rather than the primary home navigation. Treat as transitional UI.
- **Full Session placeholder (5c-b):** "Available in Sprint 11" copy is now misleading. The 5-phase session ships eventually, but as one mode among several, not the home page identity.
- **3D body map (5a–5c-a):** Role TBD under Approach 5. Could remain as a focus-picker shortcut ("tap a muscle to plan that focus area") or become a profile/analytics surface. Decision deferred to UI specifics planning session.
- **Stats row + weekly chart:** Likely preserved largely as-is. Reframe under Approach 5 as "execution telemetry" rather than primary home content.

These are not regressions — Sprint 10 work is valid and shipped. They're flagged here so future tickets can reference them with eyes open about the redirection.

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

- **Apr 23, 2026 learning:** Sweep-normalization — when fixing a bad token in seed data, sweep the whole table, not just the rows originally flagged. For T5b: I caught the prose token `postural muscles` while reviewing one yoga pose's proposed muscles, but the same token was already in production on Mountain Pose (id=959). Fixing only the new row would have left the old one to silently fail `muscleMapping.js`'s token check. General principle: one bad token usually means more than one bad row — `ILIKE '%bad_token%'` across the whole table costs nothing and prevents partial fixes that leave silent landmines behind.

- **Apr 23, 2026 learning:** Token-list literal-replace needs a dedup check. When a code review says "replace X with Y" on a comma-separated list, doing the replacement literally silently creates duplicates if Y already exists in the list. For T5b: Upward Salute Pose's proposed tokens already contained `spinal extensors`; the literal `postural muscles → spinal extensors` would have produced `..., spinal extensors, spinal extensors`. The duplicate is harmless functionally but signals careless data hygiene. General principle: any string-substitution operation on a list-shaped field should dedup the result, not trust that the input list was minimal.

- **Apr 24, 2026 learning:** Native 3D renderer lighting can override Dart-side color constants. After 4 rounds of base color iteration (#C8C8C8 → #A8A8A8 → #808080 → #606060) with identical visual output on cream background, confirmed the issue is not the color value but the renderer's default lighting washing out whatever albedo is set. Fix paths are package-level (exposure/IBL config) or material-level (authored PBR in Blender), not Dart constants. General principle: when N iterations of the same knob produce identical output, the knob doesn't control what you think it controls. Stop turning it.

- **Apr 24, 2026 learning:** For tickets where real-device verification is the acceptance bar, Claude Code should not auto-commit on "code done / flutter analyze clean." Device behavior can diverge from what the code looks correct for (e.g. race conditions, package quirks, renderer limitations). New pattern: Claude Code builds and stops, Prashob runs device test, then greenlights commit or asks for revert. Prevents broken commits from entering branch history.

- **Apr 26, 2026 strategic learning:** "5-phase session as flagship daily experience" was an unproven structural assumption that no successful competitor validates. Down Dog, Peloton, Apple Fitness+, and Othership all use pillar-first / category-first home pages. Forcing every user into a 50-65 minute integrated session as the daily default would have alienated the 75% of users who fall outside the integrator archetype (strength-first, yoga-first, breathwork-first). Pivoted to Approach 5 — plan-first with cross-pillar focus areas — before locking Sprint 11 code. General principle: pressure-test structural assumptions against multiple user archetypes before building. If one archetype is implicitly assumed, the design has a blind spot.

- **Apr 26, 2026 strategic learning:** Ancient-tradition justification for a modern synthesis is shakier than it looks. Tristhana is breath + posture + gaze *simultaneously inside one pose*, not breath → yoga → strength sequentially. Patanjali's eight limbs include asana/pranayama/dhyana but not strength training. Multiple traditions inspire the breath-movement-stillness triad, but no single tradition prescribes the specific 5-phase order. Lead with science (concurrent training, HRV, mobility-before-strength research), use ancient practice as inspiration only — not as the marketing claim.

---

## Sprint 11 — Approach 5 Foundations (Data Layer) — Apr 26, 2026 ⏳ IN PROGRESS

**Goal:** Lay the data-layer foundations for the Approach 5 home page (cross-pillar focus areas + suggestion engine). Sprint 12 builds the suggestion engine on top of these foundations.

**Source of truth:** `Trackers/PRE_SPRINT_11_PLANNING.md` for strategy. Sprint 12+ breakdown TBD.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Breathwork tagging — schema migration + seed null-fill | ✅ Shipped Apr 26, 2026 | 5 nullable columns added to `breathwork_techniques` (`duration_min`, `duration_max`, `pre_workout_compatible`, `post_workout_compatible`, `standalone_compatible`); seed writes null pending S11-T2. Commit `a407012` on `main`. |
| 2 | Breathwork tagging — apply tags to all 49 techniques | ⏳ Next | Spec doc in flight from Claude.ai (planning artifact). Then prompt-and-execute. ~245 tag decisions (5 fields × 49 techniques). Populates the columns added in T1. |
| 3 | Focus-area data model — `focus_areas` + `focus_content_compatibility` tables | ⏳ Pending | DB-only. Independent of T2; could run in parallel. Promotes FUTURE_SCOPE #123 from future scope. |
| 4 | User level tracking — per-pillar level columns + history-based inference | ⏳ Pending | Promotes FUTURE_SCOPE #34 from future scope to launch-blocking. Required input for the suggestion engine. |

### ⚠️ Original scope (NOW OBSOLETE — Apr 26, 2026 redirect)

These tickets were planned under the old "5-phase-as-flagship" model. **They are no longer the Sprint 11 plan.** Kept here only as historical record.

| # | Ticket (OBSOLETE) | Status | Notes |
|---|------|--------|-------|
| ~~1~~ | ~~5-Phase Session Integration~~ | ❌ Superseded | Pre-session overview, orchestrator, auto-advance w/ 5s countdown, 5-phase summary. **5-phase is now one mode among several, not the flagship.** |
| ~~2~~ | ~~Mid-Session Swap~~ | ❌ Superseded | Yoga/breathwork swap during session. **Will fold into Approach 5 session player.** |
| ~~3~~ | ~~Push Notifications~~ | ⏸️ Parked | Streak warnings, reminders. **Still valuable, will land in a later sprint.** |
| ~~4~~ | ~~Google Play Submission~~ | ⏸️ Parked | Store listing, APK build, screenshots. **Will land at end of Approach 5 build, not Sprint 11.** |

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

**Note (Apr 26, 2026):** Approach 5 pivot does not change the per-exercise media generation needs — exercises still need images and videos regardless of how the home page surfaces them. This track remains parallel and unaffected.

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
- **As of Apr 26, 2026:** Sprint 11+ direction governed by `Trackers/PRE_SPRINT_11_PLANNING.md`. New sprint breakdown to be designed in dedicated planning session.

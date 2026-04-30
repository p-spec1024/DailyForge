# DailyForge — Sprint Tracker

**Sprints 1-6 shipped (28 tickets, React PWA, archived).**
**Sprints 7-10 shipped (Flutter rebuild). Sprint 10 closed Apr 25, 2026.**
**Sprint 11 closed Apr 27, 2026 (Approach 5 data layer; `sprint-11-close` tag on `main`).**
**Sprint 12 closed Apr 30, 2026 (suggestion engine + HTTP surface; `sprint-12-close` tag on `main`).**
**Sprint 13 in progress (Approach 5 home page; sprint-chained off `main`, see Sprint 13 section).**

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

## Sprint 11 — Approach 5 Foundations (Data Layer) — Apr 26–27, 2026 ✅ CLOSED Apr 27, 2026

**Goal:** Lay the data-layer foundations for the Approach 5 home page (cross-pillar focus areas + suggestion engine). Sprint 12 builds the suggestion engine on top of these foundations.

**Source of truth:** `Trackers/PRE_SPRINT_11_PLANNING.md` for strategy. Sprint 12+ breakdown TBD.

### Sprint 11 close

All 5 tickets shipped (T1, T1.5, T2, T3, T4). Data-layer foundations now in place for the Approach 5 home page and the Sprint 12 suggestion engine.

Foundations delivered:
- Breathwork tagging schema + per-difficulty duration ranges (T1, T1.5)
- Breathwork content tagged across all 49 techniques (T2, 9 columns × 49 rows)
- Focus-area data model: 17 focus areas, 35 muscle keywords, 54 compatibility rows (T3)
- User per-pillar level tracking + research-grounded inference (T4)

Branch `s11-t3` accumulates both T3 and T4 commits — sprint-close merge to `main` is the next operation. **No `s11-t4` branch was created** — Sprint 11 was chained on `s11-t3` from T3 onward (matching the Sprint 10 T5b/T5c-a/T5c-b pattern).

**Next planning gate:** Personalization algorithm. Sprint 12 (suggestion engine) cannot kick off until this is decided. Open the next planning session with: "lets continue dailyforge — personalization algorithm planning."

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Breathwork tagging — schema migration + seed null-fill | ✅ Shipped Apr 26, 2026 | 5 nullable columns added to `breathwork_techniques` (`duration_min`, `duration_max`, `pre_workout_compatible`, `post_workout_compatible`, `standalone_compatible`); seed writes null pending S11-T2. Commit `a407012` on `main`. |
| 1.5 | Schema migration: per-difficulty duration columns | ✅ Shipped Apr 27, 2026 | Drops `duration_min`/`duration_max` (added in T1, verified NULL across all 49 rows before drop — no data loss); adds 6 new nullable INT columns: `beginner_/intermediate_/advanced_duration_min/max`. Required by S11-T2 v3 spec to model progression-by-difficulty. Kept inline-`alterations` pattern in `migrate.js`; migrations-folder refactor deferred. Branch `feature/s11-t1.5-per-difficulty-duration` → `main`. |
| 2 | Breathwork tagging — apply tags to all 49 techniques | ✅ Shipped Apr 27, 2026 | Populates 9 columns on all 49 rows per `Trackers/S11-T2-tagging-spec.md` (v3, locked Apr 27, 2026): 6 per-difficulty duration columns (B/I/A × min/max — beginner NULL for the 8 advanced/red and intermediate-gated techniques per Decision 3) + 3 booleans (pre/post/standalone). Distribution: 20 pre-true / 29 post-true / 7 standalone-false. Conventions 1–4 (incl. v3 amendment for divergent-duration cluster mates) all verified row-by-row. Seed values live in a `TAGS_BY_NAME` lookup table; seed throws on any unmapped technique name. Spec + 3 upstream artifacts (research notes, framework decisions, breathwork list) committed alongside. Commit `f4cd69c` on `main`. |
| 3 | Focus-area data model — `focus_areas` + `focus_muscle_keywords` + `focus_content_compatibility` tables | ✅ Shipped Apr 27, 2026 | Schema + seed for Approach 5 focus areas. New tables: `focus_areas` (17 rows: 12 body + 5 state), `focus_muscle_keywords` (35 rows, 10 body focuses tagged — `mobility` and `full_body` are special-cased in S12 service-layer logic per spec), `focus_content_compatibility` (54 rows, role-tagged — 7 energize + 15 calm + 3 focus + 3 sleep + 2 recover state-mains, plus 24 body-focus bookends; `weight` column nullable and unpopulated until S12). Hybrid materialization per spec — body-focus content derived from existing `exercises.target_muscles` at query time; state-focus materialized. No API endpoint, no engine logic (those land in S12). Branch `s11-t3`, commit `6c12604`. Spec: `Trackers/S11-T3-focus-area-spec.md`. Closes FUTURE_SCOPE #123. |
| 4 | User level tracking — per-pillar level columns + history-based inference | ✅ Shipped Apr 27, 2026 | Final Sprint 11 ticket. New `user_pillar_levels` table + 2 PL/pgSQL functions (`recompute_user_pillar_level`, `recompute_all_user_pillar_levels`) for the Sprint 12 suggestion engine. Research-grounded thresholds (ExRx, StrengthLevel, Santos-Junior 2021, contemporary yoga + pranayama literature). Promotion-only inference; `declared` / `manual_override` sources respected. Sex-specific strength thresholds default to male until `users.sex` exists (see followups). Backfill ran on dev users; production spot-check pending post-deploy. Branch `s11-t3` (sprint-chained), commit `e61e4b3`. Spec: `Trackers/S11-T4-level-tracking-spec.md`. Closes FUTURE_SCOPE #34. |

### ⚠️ Original scope (NOW OBSOLETE — Apr 26, 2026 redirect)

These tickets were planned under the old "5-phase-as-flagship" model. **They are no longer the Sprint 11 plan.** Kept here only as historical record.

| # | Ticket (OBSOLETE) | Status | Notes |
|---|------|--------|-------|
| ~~1~~ | ~~5-Phase Session Integration~~ | ❌ Superseded | Pre-session overview, orchestrator, auto-advance w/ 5s countdown, 5-phase summary. **5-phase is now one mode among several, not the flagship.** |
| ~~2~~ | ~~Mid-Session Swap~~ | ❌ Superseded | Yoga/breathwork swap during session. **Will fold into Approach 5 session player.** |
| ~~3~~ | ~~Push Notifications~~ | ⏸️ Parked | Streak warnings, reminders. **Still valuable, will land in a later sprint.** |
| ~~4~~ | ~~Google Play Submission~~ | ⏸️ Parked | Store listing, APK build, screenshots. **Will land at end of Approach 5 build, not Sprint 11.** |

---

## Sprint 12 — Suggestion Engine — Apr 28, 2026 onward

**Goal:** Ship the rule-based composer that turns (focus + entry point + budget) into a level-appropriate, exclusion-aware session structure. Drives the Sprint 13 home page UI and Sprint 14 composer.

**Source of truth:** `Trackers/S12-suggestion-engine-spec.md` (**v2 locked Apr 28, 2026 evening**, commit `e5d911d` on `main` — supersedes v1). v2 changes are concentrated in state-focus handling: range-bracket picker (replaces fixed-budget picker), `getAvailableDurations` contract, phase-output rename to `centering / practice / reflection`, new T3.5 ticket, and Appendix A reference matrix. Body-focus paths, schema, recency, swap-counter, mobility, full_body unchanged from v1.

**Branch pattern:** Sprint-chained off `main` — T1 on `s12-t1`, T2 on `s12-t2`, T3 on `s12-t3` (off `s12-t2`). T3.5 will branch from `s12-t3`. Sprint-close merge to `main` lands all of T1–T7 with a `sprint-12-close` tag, matching Sprints 10–11.

**Progress:** T1 ✅ → T2 ✅ → T3 ✅ → T3.5 ✅ → T4 ✅ → T5 ✅ → T6 ✅ → **T7 ✅ Shipped Apr 30, 2026** — sprint complete, `s12-t7` is the merge candidate for `sprint-12-close`.

### Pending planning sessions (deferred from Sprint 11 close)

These planning sessions were noted at Sprint 11 close as gates on later sprints. None blocks T4–T7 mechanical work; all gate UX/UI sprints (13+).

1. **Personalization algorithm** — cold-start ranking, recency-vs-novelty trade-off, level-up signals feeding the suggestion ranker. Originally framed as a Sprint 12 blocker; mechanical engine work (T1–T7) is shipping without it. Will gate Sprint 13+ ranking behavior.
2. **Onboarding flow specifics** — gates the `users.sex` column add and declared-level capture. Surfaces the question of how level is set on day 1 before any session history exists.
3. **Weekly plan UI specifics** — gates Sprint 13's home page redesign.
4. **Session composer UI specifics** — gates Sprint 14's build-your-own flow (Option C hybrid).

Open with the matching session-mode opening message from Project Instructions.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Schema + seeds — `focus_overlaps`, `user_excluded_exercises`, `exercise_swap_counts`, `sessions.focus_slug`, `breathwork_techniques.settle_eligible_for` | ✅ Shipped Apr 28, 2026 | Three new tables + 1 column add + 1 column add. Idempotent. Seeded `focus_overlaps` (12 rows) and `settle_eligible_for` (5 techniques per spec table). Branch `s12-t1`, commit `7e3d0cb`. Schema applied to prod DB. **Not yet merged to `main`** — sprint-chained pattern. |
| 2 | Engine v1 — body-focus paths (cross-pillar / strength tab / yoga tab) | ✅ Shipped Apr 28, 2026 | Service-layer composer in `server/src/services/suggestionEngine.js`. Three recipes implemented: `home` → 5-phase cross-pillar, `strength_tab` → strength-only, `yoga_tab` → yoga-only (warmup/main/cooldown). Reads `user_pillar_levels`, `focus_areas`, `focus_muscle_keywords`, `focus_content_compatibility`, `breathwork_techniques`, `exercises`, `user_excluded_exercises`. Out-of-scope inputs (mobility, full_body, state focuses, `breathwork_tab` entry) throw `NotImplementedError` with explicit T3/T4 hand-off messages — scope is locked, no silent fallthrough. Smoke (`scripts/test-suggestion-engine-t2.js`): **1531 pass, 0 fail** across 10 in-scope body focuses × 3 entry points × budget 30, plus biceps budget-60/15 variants and 4 NotImplementedError throws. `/review` graded **B+** — Top 5 critical fixes applied (spec-derived strength time computation, top-level `time_budget_min` validation, renamed dual-naming `userExcludedIds`/`sessionExcludedIds`, two new smoke assertions, prototype-pollution defensive Set-based pillar/level validation). Two data-shape findings handled in code with header comments: `exercises.target_muscles` is text not array (engine uses ILIKE substring); `exercises.practice_types` contains yoga STYLES not movement-quality tokens (warmup remapped to `vinyasa\|sun_salutation\|hatha`, cooldown to `restorative\|yin\|hatha`). Branch `s12-t2`, commit `28dd40e`. Spec: §Inputs/Outputs, §Recipes — body focus from home/strength_tab/yoga_tab. |
| 3 | Engine v1 — state-focus path (settle → main → integrate, fixed-budget picker) | ✅ Shipped Apr 28, 2026 | Adds `generateStateFocus` recipe + dispatch rewire to `suggestionEngine.js`. Three-phase shape: settle (curated `settle_eligible_for` pool), main (`fcc role='main' + standalone_compatible=true`, pick-and-fit loop with bounded retries + lowest-min fallback), integrate (silent timer, `content_id=null`). Defensive throws added for state focus from body-only tabs and body focus from `breathwork_tab` (both `RangeError`). Smoke extended (`scripts/test-suggestion-engine-t2.js` — kept name as rolling sprint-12 harness): **2127 pass, 0 fail** = 1531 T2 baseline + 5 state focuses × 6 (entry-point, budget) combos + 6 throw assertions + B1–B14 per-case checks. `/review` graded **A-** — 3 of 6 issues applied (state-focus `estimated_total_min` routes through `computeEstimatedTotalMin`; pick-and-fit retry budget no longer consumed by data-error skips; fallback uses `durationsForLevel` for consistency); 2 spec-call deferrals tracked externally; 1 architecture rec deferred to sprint close. Branch `s12-t3` off `s12-t2`. **Note:** T3's fixed-budget contract is being revised by T3.5 — see architecture pivot note below. T3 helpers (`pickSettleTechnique`, `loadStateMainPool`, `fitMainCandidate`, `durationsForLevel`) carry forward unchanged. |
| 3.5 | State-focus refactor — range-bracket picker + `getAvailableDurations` + `centering/practice/reflection` phase rename | ✅ Shipped Apr 29, 2026 | Architecture pivot from T3's fixed-budget contract — see pivot note below. Replaces T3's pick-and-fit retry loop with a pre-filter approach (`techniqueFitsBracket(row, level, cfg)` predicate runs before the pick). Adds `BRACKET_TABLE` (5 brackets: `0-10 / 10-20 / 21-30 / 30-45 / endless`) and `getAvailableDurations(focus_slug, breathwork_level, userId = null)` exported helper — single SQL query, JS bucketing, optional userId pre-fetches `user_excluded_exercises`. `generateSession` accepts new `bracket` param; state-focus throws `RangeError` when bracket is missing or invalid; `time_budget_min` silently ignored on state-focus path. Phase tokens renamed `settle/main/integrate` → `centering/practice/reflection` in engine output (SQL column `breathwork_techniques.settle_eligible_for` and internal helper names unchanged). Endless mode: practice runs at picked technique's `<level>_duration_max` with 2-min centering + 2-min reflection bookends. Pre-flight diagnostic (`server/scripts/preflight-s12-t3.5-appendix-a.mjs`) caught spec-vs-data drift twice — initial 17-cell hand-derivation gap, then 2-cell amendment v1.1 transcription correction. Smoke (`scripts/test-suggestion-engine-t2.js`): **2690 pass, 0 fail** = 1531 T2 baseline + 6 T3 throws + ~230 Phase 3a matrix (75 cells × state + sample_count + unlocks_at) + ~540 Phase 3b per-available-cell generation (39 cells × ~14 sub-assertions, level-mutated test user with try/finally + SIGINT/SIGTERM restore handlers) + 7 new throw assertions (4 W4 locked/empty bracket + 2 T3.5 missing/invalid + 1 dispatch reorder). `/review` graded **A-** with 5 fixes applied: W4 locked/empty bracket throws, W3 `BRACKET_TABLE` exported (smoke imports the engine constant, no mirror), W1 optional `userId` parameter on `getAvailableDurations` for exclusion-divergence, W2 SIGINT/SIGTERM smoke handlers, S2 `Promise.all` in `generateStateFocus`. Tech debt 3/10. Engine net `+196 / -172` (deletes more than adds — `STATE_FOCUS_PHASE_MIN`, `STATE_MAIN_RETRY_LIMIT`, retry loop, lowest-min fallback all gone). Spec: `Trackers/S12-T3.5-state-focus-refactor-spec.md` + `Trackers/S12-T3.5-AMENDMENT-1-appendix-a-correction.md` (v1.1, 39 available / 20 locked / 16 empty cells). Branch `s12-t3.5` off `s12-t3`. Feature commit `8825ba5`, chore commit `486b1f6`. Pushed to `origin/s12-t3.5`; not merged to `main` (sprint-chained pattern). |
| 4 | Mobility + Full Body special-case branches | ✅ Shipped Apr 29, 2026 | Replaces T2's `NotImplementedError` throws for `mobility` / `full_body` with real recipe branches via 5 new sub-recipes (`generateCrossPillarMobility`, `generateCrossPillarFullBody`, `generateStrengthOnlyFullBody`, `generateYogaOnlyMobility`, `generateYogaOnlyFullBody`). Each parent recipe routes inline on `focus.slug`; keyworded path for the 10 muscle-keyword body focuses unchanged. Adds `compoundFilter()` SQL helper (`ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3`) + 3 new picker functions: `pickStrengthCompound`, `pickYogaCompound`, `pickYogaByStyles`. New constant `MOBILITY_MAIN_STYLES = ['hatha', 'yin', 'vinyasa']` alongside existing T2 style sets. Dispatch throws `RangeError` for `mobility` / `strength_tab`. **Pre-flight catch:** live data missing the spec's `mobility` / `flexibility` practice-type tokens (only yoga STYLE labels exist: vinyasa / hatha / yin / restorative / sun_salutation). Resolved via Amendment 1 v1 — codified the (intent → style-token) remap. Mobility-home is structurally always-skip-strength per Amendment §Mobility strength-main pool (strength `practice_types` is empty across the entire pillar) → `phases.length === 5` invariant guaranteed. Smoke (`scripts/test-suggestion-engine-t2.js`): **3097 pass, 0 fail** = ~2682 T2+T3.5 baseline + 16 T4 pre-flight + 393 T4 generation (14 cases × shape/difficulty/exclusion/bookend/compound/style/metadata sub-assertions) + 4 T4 throws. `/review` grade **A-**, 4 fixes applied: W1(a) throw on empty bookends in mobility-home + full_body-home (preserves Amendment "always 5 phases" invariant); S1 console.error logs paired with throws for forensics; S3 mobility safety throw at top of `generateStrengthOnly` (defends against dispatch reorder); S5 comment in mobility-home noting FUTURE_SCOPE #1 dependency. S2 (sub-recipe `timeBudget` validation) skipped as low-value noise; architecture extraction (engine file → directory) deferred to sprint close. Tech debt 3/10. Engine net `+447 / -29` (additive — sub-recipes carry forward T2 scaffolding rather than refactor it). Spec: `Trackers/S12-T4-mobility-fullbody-special-cases-spec.md` + `Trackers/S12-T4-AMENDMENT-1-practice-type-remap.md` (v1, codifies the practice-type style-token remap). Branch `s12-t4` off `s12-t3.5`. Feature commit `024af50`. Pushed to `origin/s12-t4`; not merged to `main` (sprint-chained pattern). |
| 5 | Recency warning logic | ✅ Shipped Apr 29, 2026 | New exported `checkRecencyOverlap(userId, currentFocusSlug)` helper in `suggestionEngine.js`. Single-table `SELECT` against `sessions` returning `(yesterday_focus, days_ago)`; warning shape per spec Appendix B (`type='recency_overlap'`, `yesterday_focus`, `current_focus`, `message`, `alternative_focus_slug='recover'`). Wired into 8 body-focus recipes (`generateCrossPillar` + `generateStrengthOnly` + `generateYogaOnly` keyworded paths, plus T4's mobility/full_body sub-recipes). State-focus path (`generateStateFocus`) explicitly NOT wired per spec line 443; smoke sub-blocks T5/9 + T5/19 verify state-focus responses always emit `warnings: []`. Persistence wiring at 4 INSERT sites: `session.js:84` (strength session start), `session.js:738` (5-phase one-shot finish), `yoga.js:445` (yoga one-shot finish), `breathwork.js:166` (breathwork one-shot finish). All accept optional `focus_slug` from req.body, validated permissively (string, 1–40 chars, else NULL — per spec Decision 3: EmptyWorkout / Routine paths leave NULL). Schema additions in `migrate.js`: `breathwork_sessions.focus_slug VARCHAR(40)` + index on `(user_id, focus_slug, created_at) WHERE completed=true` (adapted from spec's `date`-keyed index — `breathwork_sessions` has no `date` column, only `created_at`). Pre-flight (`scripts/preflight-s12-t5-overlaps.mjs`) confirms the 12 spec-asserted `focus_overlaps` pairs match live data exactly. Smoke (`scripts/test-suggestion-engine-t2.js`): **3128 pass, 0 fail** — adds T5 RECENCY BLOCK (22 sub-blocks: 1 baseline + 14 detection + 4 full-engine + 3 persistence + 2 cleanup), wrapped in try/finally + SIGINT/SIGTERM handlers that delete tagged rows on cleanup. `/review` grade **A-**, fixes applied: W1 (graceful DB-error null in helper — recency throw must not break session generation); W2 (`COALESCE(focus_slug, $5)` arg order in 5-phase UPDATE — preserves start-time slug per spec Decision 2); W3 (day-diff computed in SQL via `(CURRENT_DATE - s.date)::int AS days_ago` — eliminates JS Date / Postgres TZ asymmetry); S1 freebie (`PRETTY_SLUG` no-op removed via W3's inlining). Tech debt 3/10. Engine net `+108 / -12` (helper + 8 wire points; surgical layered work). **Two spec deviations** (documented in engine header comment): (a) 3-arm UNION collapsed to single-table `sessions` SELECT — `yoga_sessions` doesn't exist in this codebase (yoga writes to `sessions` with `type='yoga'`); (b) `breathwork_sessions` UNION arm dropped per spec line 760 — no `date` column to fit the recency window shape, AND state-focus rows are excluded by overlap rule, AND no v1 path writes body-focus slugs there. `breathwork_sessions.focus_slug` column added anyway for forward-compat analytics. When unified-session refactor lands or any path starts writing body-focus slugs to `breathwork_sessions`, the recency query needs reconsidering — captured as FUTURE_SCOPE #162. Spec: `Trackers/S12-T5-recency-warnings-spec.md`. Branch `s12-t5` off `s12-t4`. Feature commit `110e52d`. Pushed to `origin/s12-t5`; not merged to `main` (sprint-chained pattern). |
| 6 | Swap-counter + exclusion endpoints | ✅ Shipped Apr 30, 2026 | New service `server/src/services/swapCounter.js` exports `incrementSwap(userId, exerciseId, tx?)` and `setPromptState(userId, exerciseId, state, tx?)`. `incrementSwap` runs single-transaction UPSERT into `exercise_swap_counts` + RETURNING read-back + Decision-5 auto-transition (`never_prompted` → `prompted_keep` on the count=3 prompt fire); count=6 is final prompt with no further transition. `setPromptState` UPSERTs `'excluded'` (terminal) or guarded `'prompted_keep'` (cannot downgrade `'excluded'` per Appendix-A state diagram). Both accept an optional `tx` client (caller-owned BEGIN/COMMIT) for composition with route-level transactions. **Wire-point** at `server/src/routes/workout.js:213` (`PUT /api/workout/slot/:exerciseId/choose` — Flutter call-pattern grep confirmed this is the live swap surface; `PUT /api/workout/exercise-pref` at line 266 is dead — captured as FUTURE_SCOPE #164): existing slot-pref UPSERT and `incrementSwap` now run in a single transaction, gated by `chosenId !== exerciseId` (Decision 2). Same-exercise re-pick reads current count instead of returning 0 (Decision 8 always-include). Response shape extended with `should_prompt: bool`, `swap_count: int`, `prompt_state: string\|null`. **Two new endpoints** in `server/src/routes/exercises.js` (existing file extended, not new file — Decision 6 routes-layout): `POST /:id/exclude` (response `{excluded: true, already: bool, exercise_id: int}`) writes `user_excluded_exercises` row + flips `exercise_swap_counts.prompt_state='excluded'` atomically; `POST /:id/keep-suggesting` (response `{kept: true, already: bool, exercise_id: int}`) UPSERTs `prompt_state='prompted_keep'` with the terminal-state guard (criterion #14: blocked-by-excluded still returns 200 with `already: true`). Both wrap exists-check + writes in one transaction (closes TOCTOU window flagged in `/review` C1). **Spec deviation** documented in `swapCounter.js` header: `user_excluded_exercises` shape is pillar-aware `(user_id, content_type, content_id)` per S11-T1 — endpoints write `content_type='strength'`, T2 engine reads with the same predicate. Pre-flight (`server/scripts/preflight-s12-t6-schema.mjs`) verifies schema shape (columns, prompt_state CHECK, UNIQUEs) and grep-discovers handler candidates; halted on 4 candidates until Flutter call-pattern grep confirmed Option 1 (workout.js:213) was the live surface. Smoke (`scripts/test-suggestion-engine-t2.js`): **3173 pass, 0 fail** — adds T6 SWAP-EXCLUSION block (18 sub-blocks: 7 counter-state-machine progression 1→7 + 5 setPromptState idempotency/guard + 3 validation + 1 idempotent-keep + **#17 excluded-row-at-count=3 guard regression test** + **#18 10x concurrency** asserting counts 1..10 unique with prompts firing exactly at [3, 6]), wrapped in try/finally + SIGINT/SIGTERM handlers + snapshot/restore. Live HTTP round-trip (`scripts/t6-curl-roundtrip.mjs`): 19 pass, 0 fail (4-round-trip per spec acceptance: swap→count=3 prompt→exclude idempotent→keep-suggesting blocked + 404 bonus). `/review` grade **B → ≥A-** after fixes applied: C1 (TOCTOU exists-check inside transaction for both endpoints), W2 (response shapes per spec — `{excluded, already}` and `{kept, already}`, was diverging), W4 (strict `Number.isInteger` id validation rejects `"1abc"`), W7 (`prompt_state` returned in swap response), W3 (JSDoc `tx` invariant — caller must own BEGIN), W5 (lock-semantics comment near UPSERT — ON CONFLICT DO UPDATE row lock serializes concurrent calls), C3 (concurrency test #18), S6 (excluded-at-count=3 regression test #17). Deferred: W1 (rate limiting → FUTURE_SCOPE #163), C2 (phantom-row concern — spec criterion #13 explicitly mandates fresh-row create on `/keep-suggesting`; comment added at the call site to head off "fixes"). Tech debt **3/10**. Service file ~210 lines; routes net `+~110`. Spec: `Trackers/S12-T6-swap-counter-exclusion-spec.md`. Branch `s12-t6` off `s12-t5`. Will be pushed to `origin/s12-t6`; not merged to `main` (sprint-chained pattern). |
| 7 | API endpoints — `POST /api/sessions/suggest`, `GET /api/sessions/last?focus=<slug>`, `POST /api/sessions/save-as-routine` | ✅ Shipped Apr 30, 2026 | Three new endpoints over the Sprint 12 suggestion engine in a new router file `server/src/routes/sessions.js` (~360 lines), plus a new `server/src/services/sessionFormatter.js` (~250 lines) that reconstructs completed-session rows into the engine's response shape for `/last`. **Decisions per spec:** cross_pillar saves strength portion only (`user_routines` is strength-FK by design); state_focus and pillar_pure yoga/breathwork reject 400 with stable error codes (`state_focus_not_saveable_v1`, `pillar_pure_yoga_not_saveable_v1`, `pillar_pure_breathwork_not_saveable_v1`); `/last` UNION over `sessions` + `breathwork_sessions` returning whichever row is most recent; engine RangeErrors mapped to stable error codes via string-match (pre-flight inventory gates the substrings); `/save-as-routine` emits honest `dropped_phases` so Flutter can tooltip "yoga/breathwork phases regenerate next time you start this routine." **Phase 2 prep refactor** in `server/src/index.js` exposes a `createApp()` factory so the smoke harness can spawn an in-process Express app via `createApp().listen(0)` without port conflicts — server-startup behavior unchanged when `index.js` is the entry point. **Spec deviations** (documented in `routes/sessions.js` header): (a) auth middleware is `authenticate` not `requireAuth`; (b) JWT shape is `req.user.id` not `req.userId`; (c) focus_areas column is `focus_type` not `type`; (d) engine RangeError message inventory drifted from the spec mapper's expected 6 substrings (4 of 6 missed) — pre-flight surfaced the actual phrasing and the mapper substrings were updated to match (`is not valid from`, `not available from strength_tab`, etc., collapsing to 5 stable codes); (e) `/last` 5-phase reconstruction reads `sessions.phases_json` JSONB directly — Sprint 9 stored the engine-shaped phase array there, so the resolved-Q3 fallback was NOT needed; (f) breathwork `/last` reconstruction IS the documented `partial_reconstruction` case — `breathwork_sessions` only stores `technique_id`, so the formatter returns single-phase `practice` synthesis with `metadata.partial_reconstruction: true` (FUTURE_SCOPE #165 captured for full per-phase persistence later). Pre-flight (`scripts/preflight-s12-t7-shape.mjs`) verified all (b) schema shape + (c) symbol shape per principle #14 — schema clean, symbol divergences listed as warn-level findings before the build proceeded. Smoke (`scripts/test-suggestion-engine-t2.js`): **3247 / 0** = 3173 T6 baseline + ~74 across 19 sub-blocks (criteria #2–#34: validation matrix, recency-warning round-trip, exclusion-respected loop, `/last` strength + breathwork + 5-phase JSONB + UNION ordering, save-as-routine cross_pillar success + state_focus rejected + pillar_pure rejected + atomicity FK-violation rollback + round-trip via existing `GET /api/routines`), uses `createApp().listen(0)` + native `fetch` (no `supertest` dev-dep added — simpler), wrapped in try/finally + SIGINT/SIGTERM handlers + sentinel `notes='t7-smoke-fixture'` for sessions plus throwaway `__t_state_test`/`__t_body_test` focus_areas rows so cleanup never deletes legitimate user history. Live round-trip (`scripts/t7-curl-roundtrip.mjs`): **22 / 0** — register/JWT-mint → suggest body home → suggest state breathwork_tab → /last 404 → save-as-routine 200 → existing `/api/routines/:id` echo → SQL-insert fixture → /last 200 pillar_pure → state save 400 → no-JWT 401 → cleanup. `/review` trajectory **B+ → A-** with 7 fixes applied inline (1 critical, 4 warning, 2 coverage): C1 smoke harness was running unscoped `DELETE` against the test user's `calm`/`energize` history (replaced with sentinel-scoped pattern); W1 `getFocusBySlug` is_active filter leaked /suggest semantics into /last, would 400 on legitimate-but-deactivated focus replay (now takes `requireActive` flag — true for /suggest, false for /last); W2 `reconstructStrengthPhase` over-counted sets when `session_exercises` had multiple per-set rows with `sets_completed=null` (fixed via SQL `COALESCE(SUM(sets_completed), COUNT(*))` aggregation handling both per-set and aggregate writer shapes); W3 `/last` 404'd spuriously on legacy rows where `completed=true` but `completed_at IS NULL` (UNION now `COALESCE`s `completed_at` with `started_at` and `date::timestamp + 23:59:59`); W4 mapper returned `engine_error` (a 500-coded name per spec dictionary) with HTTP 400 on unmapped RangeError (renamed fallback to `unmapped_engine_error` + added `console.warn` for mapper-drift visibility); plus `pool.connect()` failure resilience (`if (tx)` guard in catch/finally) and `requireUserId` defensive middleware (a JWT signed without an `id` claim previously fell through to engine TypeError → 500; now returns clean 401); Coverage adds: sub-block 4 immediately deletes its yesterday-biceps fixture so the recency seed doesn't leak into adjacent sub-blocks, sub-block 8 verifies the inserted `content_id`s actually surface plus the aggregated `sets=3` invariant, new sub-block 8.5 covers the 5-phase JSONB reconstruction path (structural assertions because Postgres JSONB doesn't preserve key order). Tech debt **3/10**. Engine itself untouched (no schema migrations, no engine refactor). Spec: `Trackers/S12-T7-http-surface-spec.md` v1 LOCKED. Branch `s12-t7` off `s12-t6`. Refactor commit `93de264` (createApp factory), feature commit `0c47046`. Pushed to `origin/s12-t7`; not merged to `main` (sprint-chained pattern — `sprint-12-close` handles the merge in a separate session). |

### Architecture pivot note — T3 → T3.5 (Apr 28, 2026 evening)

**Decision:** T3's fixed-budget contract for state focuses is being revised by T3.5 (range-bracket picker). T3 stays committed; T3.5 layers on top as a refactor.

**What T3's smoke surfaced:** 24 DEGRADED cases out of 30 state-focus matrix entries — the engine returned durations different from the requested budget. Examples:
- `energize / breathwork_tab / 30` → engine returned 14 min (Morning Energizer's beginner_max=8 forced UNDER)
- `recover / breathwork_tab / 3` → engine returned 7 min (Diaphragmatic min=5 forced OVER)
- `sleep / home / 60` → engine returned 16 min (Deep Sleep Induction beginner_max=10)

**Root cause:** the fixed-budget picker promises a duration the content can't honestly fill. State focuses' main techniques are clustered at specific ranges (e.g. most beginner techniques are 5–10 min; only a few are 1–3 min or 10–30 min), so a budget like "30 min" or "3 min" forces the engine into degraded mode for most (focus, level) pairs. The engine reports honestly via `metadata.estimated_total_min`, but the UX presents a budget the engine can't satisfy.

**T3.5 fix:** replace the budget number with a range bracket the user picks from a content-aware shortlist. The bracket maps to the picker's allowable duration window; `getAvailableDurations(focus, level)` returns the brackets actually populated by the eligible main pool. UI never offers a range the engine will degrade on. Phase outputs renamed to `centering / practice / reflection` to match the user-facing language (Appendix A in the v2 spec).

**Why a refactor, not a rewrite:** T3's helpers (`pickSettleTechnique`, `loadStateMainPool`, `fitMainCandidate`, `durationsForLevel`) stay. The pick-and-fit loop's logic is unchanged. What changes is the duration-allocation table (range bracket → settle/main/reflection minutes) and the addition of an `endless` mode (no fixed total — practice runs at the technique's natural max). T3.5 is expected to be smaller in scope than T3.

**Followups noted during T2 (eligible for FUTURE_SCOPE — to be added post-sprint-close):**

1. **Spec acceptance #9 ("session duration within 10% of budget") is not achievable at beginner level given current pick counts and bookend `*_duration_min` clamping.** Engine now exposes the truth via `metadata.estimated_total_min`; future ticket should either scale strength sets-per-exercise with budget, tighten bookend duration ranges, or revise the spec target band.
2. **Tiny yoga pools at beginner level** for `biceps` (1 pose), `triceps` (6), `chest` (11) cause cooldown to degrade gracefully. Either re-tag yoga seed for these focuses or accept the degradation.
3. **`focus_muscle_keywords` dead seeds (13 entries with 0 substring matches against `exercises.target_muscles`):** `biceps brachii`, `biceps femoris`, `brachialis`, `calf`, `gastrocnemius`, `gluteus`, `latissimus`, `semimembranosus`, `semitendinosus`, `soleus`, `transverse`, `triceps brachii`, `vastus`. Either populate `target_muscles` to include these tokens, or drop them from the seed.
4. **`practice_types` taxonomy mismatch** — yoga STYLE labels in DB vs movement-quality tokens in spec. Either add a movement-quality tagging dimension or document the remap in the spec permanently.

---

## Sprint 13 — Approach 5 Home Page (engine consumed) — Apr 30, 2026 onward

**Goal:** Make the suggestion engine visible. The Flutter home page consumes `POST /api/sessions/suggest`, the user sees today's suggested session for a chosen focus, and tapping Start runs it through the existing pillar players. New users get a 3-screen level-capture stub. The 3D body map moves to its own dedicated tab via a new bottom nav; the Sprint-10 home page model (3-pillar cards + Full Session placeholder + body map on home) is replaced.

**Source of truth — product strategy:** `Trackers/PRE_SPRINT_11_PLANNING.md` (Approach 5). Re-read before any Sprint 13 ticket prompt.

**Source of truth — HTTP contract:** `Trackers/S12-T7-http-surface-spec.md` (locked). Sprint 13 is a Flutter-side consumer of this surface plus one new tiny backend endpoint (T2).

**Sprint planning decision log:**
1. **Framing A locked (Apr 30, 2026)** — home page first. Onboarding gets a stub only; full onboarding ships in Sprint 15. Considered Framings B (onboarding-first) and C (split home page). Rejected B because new-signups problem isn't biting yet (3 prod users, all backfilled) while the home page lying about Sprint 11 is. Rejected C because Approach 5's core promise (Option C: hybrid suggest + build) is the home page's *primary* feature; shipping suggest-only delays the central UX past Sprint 14.
2. **Body map placement: Option B — bottom nav with Body tab.** Considered four patterns: keeping it on home (rejected — competes with today's-session card), small 3D widget that fullscreens (rejected — small 3D figures lose muscle differentiation, double the renderer instances, gesture conflicts get worse), 2D heatmap card on home (strong alternative; would need new asset pipeline), dedicated tab (locked). The body map gets full-screen room to be the diagnostic tool it is; FUTURE_SCOPE #93–#102 polish items remain valid for the dedicated screen.
3. **Onboarding stub shape: 3 screens, one per pillar.** Each screen offers beginner/intermediate/advanced. Writes `source='declared'` to `user_pillar_levels`. Existing 3 prod users bypass the stub via row-count gate.
4. **Tech-debt inclusion: FUTURE_SCOPE #168 only (smoke-fixtures helper).** Lands as T7. Pure tooling, half-day ticket, pays back on T2 + T5 immediately. FUTURE_SCOPE #166 (typed-error refactor) deferred — touches engine code that just shipped to prod, bad timing during first Flutter+engine integration. #166 lands as a standalone refactor between Sprint 13 close and Sprint 14 kickoff.
5. **Repeat Last + Save explicitly deferred to Sprint 14.** Engine endpoints (`GET /api/sessions/last`, `POST /api/sessions/save-as-routine`) are live in prod from S12-T7 but Sprint 13 does not consume them. Sprint 13 home page is "today's suggestion" only.

**Branch pattern:** Sprint-chained off `main` — T1 on `s13-t1`, T2 on `s13-t2` (off `main`, parallel to T1), T7 on `s13-t7` (off `main`, parallel). T3 off `s13-t2`. T4 off `s13-t3`. T5 off `s13-t4` (or absorbed into T4 mid-build). T6 off `s13-t5`. Sprint-close merge to `main` lands all of T1–T7 with a `sprint-13-close` tag.

**Pending planning sessions (still gating future sprints, not Sprint 13):**

1. **Personalization algorithm** — gates Sprint 14+ ranking refinement. Engine v1 is pure-rule; ranking improvements need cold-start + recency-vs-novelty trade-off design. Originally noted at Sprint 11 close.
2. **Onboarding flow specifics (full version)** — gates Sprint 15. Sprint 13 stub captures level only; full flow needs philosophy intro, focus preferences, equipment capture, sex column (FUTURE_SCOPE #136), starter weekly plan seeding.
3. **Weekly plan UI specifics** — gates Sprint 14. Calendar visual model, day-by-day focus picker, edit flows.
4. **Session composer UI specifics** — gates Sprint 14. Cross-pillar browse, filters, set/rep/duration handling per pillar.

Open with the matching session-mode opening message from Project Instructions when each session is ready.

| # | Ticket | Status | Notes |
|---|--------|--------|-------|
| 1 | Onboarding stub — 3-screen level capture for new users | ⏳ Pending | Flutter. First-launch flow gated on `user_pillar_levels` row count for the authenticated user. Three screens (one per pillar), each with three chips (beginner / intermediate / advanced). Writes `source='declared'` per row. Existing users with pre-existing rows bypass entirely. Pre-flight: verify whether a `POST /api/users/pillar-levels` endpoint already exists from S11-T4 backfill work; if not, add it as part of this ticket. Spec: execution prompt only (no design doc — flow is mechanical). |
| 2 | Focus area data API — `GET /api/focus-areas` | ✅ Shipped Apr 30, 2026 | New `server/src/routes/focus-areas.js` (~27 lines) returning the 17 focus areas the Flutter home picker renders. JWT-authenticated via existing `authenticate` middleware. Single SELECT aliases `focus_type → type` and `sort_order → display_order` for client-contract stability (column rename queued for a future migration), filters `is_active = true` to mirror engine behavior at `suggestionEngine.js:202`, sorts by `(focus_type ASC, sort_order ASC)`. Mounted at `/api/focus-areas` inside `createApp()` so the smoke harness picks it up automatically. Pre-flight (`scripts/preflight-s13-t2-shape.mjs`, 6 checks) caught **three spec drifts** before any code was written: (a) column `type` vs live `focus_type`, (b) column `display_order` vs live `sort_order`, (c) state-focus order `[energize, focus, calm, sleep, recover]` (original prompt) vs `[energize, calm, focus, sleep, recover]` (live DB). PM ruling: SQL aliases for (a) and (b) so the JSON contract matches the spec; DB wins for (c) — T4 design doc Decision 4 to be amended separately. Pre-flight rerun after PM ruling: **all 6 checks PASS** (row count = 17, body=12 / state=5, required columns present + correctly typed, zero NULLs in returned columns, `sort_order` unique within `focus_type`, state order matches the locked sequence). Smoke (`scripts/test-suggestion-engine-t2.js`): **3262 pass, 0 fail** = 3253 T7 baseline + 9 T2 sub-blocks (new Phase 3g block, in-process `createApp().listen(0)` pattern from S12-T7) covering no-auth → 401, valid auth → 200, response shape `{ focus_areas: [...] }`, length === 17, body=12, state=5, every row has all 4 fields with correct types, rows sorted by `type ASC, display_order ASC`, state focuses in `display_order` are exactly `[energize, calm, focus, sleep, recover]`. Live curl roundtrip verified — `GET /api/focus-areas` with valid Bearer token → 200 + full 17-row JSON; no auth → 401. No `/review` requested (per Sprint 11 data-population pattern — tiny read endpoint, no logic surface). Branch `s13-t2` off `main`, feature commit `b13fafb`. Pushed to `origin/s13-t2`; not merged to `main` (sprint-chained pattern — `sprint-13-close` handles the merge in a separate session). |
| 3 | Suggest API client + state management | ⏳ Pending | Flutter. New service `lib/services/suggest_service.dart` (or similar) wrapping `POST /api/sessions/suggest`. Provider for current home-page session state. Handles body-focus (`time_budget_min`) vs state-focus (`bracket`) request divergence. Maps T7's stable error codes (`invalid_focus_slug`, `body_focus_requires_time_budget`, etc.) to user-facing strings. Spec: execution prompt only. |
| 4 | Home page redesign + bottom nav (Home + Body tabs) | ⏳ Pending | Flutter. The biggest ticket of the sprint. Replaces Sprint-10 home page. Sections (top → bottom): today's session card (engine output) → focus picker (17 areas, two visual groups) → recent activity (Sprint-10 stats row + 4-week chart preserved). Bottom nav scaffolding: Home + Body tabs in Sprint 13 (Library + Profile slots reserved for Sprint 14/15). Body tab routes to the existing Sprint-10 body map screen as-is — no redesign in Sprint 13. **Spec: `Trackers/S13-T4-DESIGN.md` (authored at sprint kickoff, locked before prompt).** |
| 5 | State-focus bracket picker + state-focus card rendering | ⏳ Pending | Flutter + small backend. Bracket picker bottomsheet with 5 brackets (`0-10` / `10-20` / `21-30` / `30-45` / `endless`), greyed-out states for locked brackets per T3.5's `getAvailableDurations`. Backend half: thin endpoint `GET /api/focus-areas/:slug/available-durations` wrapping the existing engine helper (verify in pre-flight whether the helper is already HTTP-reachable). State-focus card renders the engine's `centering / practice / reflection` shape using the same renderer as body-focus where possible. Spec: light spec doc if shape divergence is bigger than expected during T4 build; otherwise execution prompt only. |
| 6 | Session start handoff — wire one-tap Start to existing pillar players | ⏳ Pending | Flutter. Tapping Start on a body-focus card opens existing strength player or yoga player depending on phase. State-focus card opens existing breathwork player. Cross-pillar 5-phase routing reuses Sprint 10's 5-phase player but with engine-supplied phase content. Risk concentration: passing engine output to players that currently expect their own routine-config shape. Spec: light spec doc likely needed once T4/T5 ship — depends on player-config shape divergence surfaced during T3 build. |
| 7 | Smoke-fixtures helper — `server/scripts/lib/smoke-fixtures.mjs` | ⏳ Pending | Backend tooling. Centralizes the three sentinel-fixture patterns from Sprint 12 (T5 tagged-row, T6 snapshot/restore, T7 sentinel-DELETE). Provides: `(i)` sentinel-tagged INSERT helper, `(ii)` bulk DELETE-by-sentinel cleanup, `(iii)` snapshot/restore for tables without a sentinel column, `(iv)` try/finally + SIGINT/SIGTERM lifecycle wiring. Refactors existing T5/T6/T7 sub-blocks of `scripts/test-suggestion-engine-t2.js` to use the helper. Closes FUTURE_SCOPE #168. Spec: execution prompt only. Lands first or last in the sprint — no blockers either way. |

**Progress:** T2 ✅ Shipped Apr 30, 2026 — T1 / T3 / T4 / T5 / T6 / T7 pending.

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
- **As of Apr 26, 2026:** Sprint 11+ direction governed by `Trackers/PRE_SPRINT_11_PLANNING.md`. Sprint-by-sprint breakdown is decided at each sprint kickoff rather than designed up-front.
- **Tracker is canonical for ticket state.** Project Instructions intentionally do not duplicate ticket-level information (status, branches, smoke totals, SHAs) — read this file for those.

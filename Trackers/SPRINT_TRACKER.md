# DailyForge — Sprint Tracker

## Sprint 5 — Week of Apr 11, 2026

**Goal:** Phase 3 — Analytics + Choice. Visual proof of gains across all 3 pillars.

| # | Ticket | Branch | Status | Started | Shipped | Notes |
|---|--------|--------|--------|---------|---------|-------|
| 1 | Progression Graphs | feature/progression-graphs | ✅ Shipped | Apr 11 | Apr 12 | Recharts installed, exercise_progress_cache + breathwork_logs tables, charts for all 3 pillars (strength/yoga/breathwork), URL-based section expand state, gold PR dots via custom dot renderer, collapsed-by-default sections. Brzycki 1RM from best set, first-session-max baseline for improvement %, working-set filter (excludes warmup/dropset/failure), reps-aware PR detection consistent across chart and history, lazy cache backfill with partial-cache detection, AbortController-style stale-fetch guard via requestId epoch. |
| 2 | Workout Calendar | feature/workout-calendar | ✅ Shipped | Apr 12 | Apr 12 | Inline calendar in Profile, colored dots by session type (gold/teal/blue), bottom sheet with swipe-to-close, streak counter + highlight on consecutive days, month navigation |

**Progress: 2/? tickets shipped**

---

## Sprint 4 — Week of Apr 9, 2026

**Goal:** Complete Phase 2 — Yoga + Breathwork. Transform DailyForge into the unified 3-pillar app.

| # | Ticket | Branch | Status | Started | Shipped | Notes |
|---|--------|--------|--------|---------|---------|-------|
| 1 | Breathwork Timer UI | feature/breathwork-timer | ✅ Shipped | Apr 9 | Apr 10 | 49 techniques, expanding circle animation, phase colors, session logging. iOS wake lock deferred. |
| 2 | Yoga Session Builder | feature/yoga-session-builder | ✅ Shipped | Apr 10 | Apr 10 | Level filtering (beginner/intermediate/advanced), focus area prioritization, 265 poses, smart description fallback, scrollable info popup |
| 3 | 5-Phase Session Integration | feature/5-phase-session | ✅ Shipped | Apr 11 | Apr 11 | 5-phase session flow with state machine orchestrator, pre-session overview, phase auto-flow (no confirmation screens), unified summary, silent sit auto-end. DB migrations: category column (269 yoga poses categorized into warmup/standing/peak/floor/cooldown/savasana/flow), practice_types TEXT[] (vinyasa/hatha/yin/restorative/sun_salutation), hold_times_json JSONB, tracking_type (duration for Plank etc.), phases_json on sessions. usePausableTimer shared hook. Progressive filter broadening (min 3 poses for warm-up/cool-down). Workout tab cleanup (main work only). Consistent duration calculation. Breathing sounds with mute toggle. Skip exercise button. iOS AudioContext fix. Previous button removed from yoga phases. |

**Progress: 3/3 tickets shipped**

**Sprint 4 COMPLETE — Phase 2 (Yoga + Breathwork) done.**
DailyForge is now the unified 3-pillar app: Strength + Yoga + Breathwork in one 5-phase session.

## Database Schema Updates (Sprint 4)

| Column | Table | Type | Purpose |
|--------|-------|------|---------|
| category | exercises | VARCHAR(20) | Yoga pose role in session flow: warmup, standing, peak, floor, cooldown, savasana, flow |
| practice_types | exercises | TEXT[] | Which yoga styles a pose belongs to: vinyasa, hatha, yin, restorative, sun_salutation |
| hold_times_json | exercises | JSONB | Per-practice-type hold duration in seconds |
| tracking_type | exercises | VARCHAR(20) | Exercise input type: weight_reps (default), duration (timed holds like Plank) |
| phases_json | sessions | JSONB | Stores 5-phase session results (breathwork/yoga/strength per phase) |

---

## Sprint 3 — Week of Apr 7, 2026

**Goal:** Data seeding + media infrastructure

**Infrastructure Decision:** Neon (DB) + ImageKit (Media CDN) — replacing Cloudinary

| # | Ticket | Branch | Status | Started | Shipped | Notes |
|---|---|---|---|---|---|---|
| 1 | ImageKit Setup | infra/imagekit-setup | ✅ Shipped | Apr 7 | Apr 7 | Replace Cloudinary SDK with ImageKit |
| 2 | Strength Exercise Seeding | data/strength-exercises | ✅ Shipped | Apr 7 | Apr 7 | 736 strength exercises seeded from free-exercise-db |
| 3 | Yoga Pose Library Seeding | data/yoga-poses | ✅ Shipped | Apr 7 | Apr 7 | 265 yoga poses seeded from 4 sources (dailyforge, yoga-api, yogism, huggingface). Dedup by Sanskrit name, FK-safe cleanup, unique index added. |
| 4 | Breathwork Technique Seeding | data/breathwork-techniques | ✅ Shipped | Apr 7 | Apr 8 | 49 verified techniques (48 deduplicated + A52 from 2025 research). Safety tiers (green/yellow/red) + caution notes for advanced techniques. |
| 5 | Exercise Illustrations | content/exercise-illustrations | ✅ Shipped | Apr 8 | Apr 8 | Style locked: Hybrid Pixar bald character + deep orange-amber muscle glow (blue for breathwork). Model: Nano Banana 2 on Vertex AI Studio. 4-frame animated WebP via 2x2 grid prompts. Video: Veo 3.1, 8 sec, 1080p. Moved to parallel image/video tracks. |

**Progress: 5/5 tickets shipped**

## Media Generation Progress (Updated: Apr 9, 2026)

| Type | Target | Generated | Uploaded | Live |
|------|--------|-----------|----------|------|
| Images (4-frame WebP) | 1,050 | 0 | 0 | 0 |
| Videos (8-sec MP4) | 35 | 1 | 0 | 0 |

**Latest:**
- Apr 9: Barbell Squat video generated (test, style locked)

This section will be updated by both image and video generation tracks to keep sprint track informed of media progress.

## Tools Added

| Tool | Purpose | Location |
|------|---------|----------|
| /review | Code quality review — checks for bugs, security issues, best practices, performance | .claude/commands/review.md |
| /m-review | Media QA Agent — reviews exercise images/videos for form accuracy, character consistency, AI artifacts | .claude/commands/m-review.md |

**S3-T5 Details:**
- Style LOCKED: Hybrid Pixar bald character + deep orange-amber muscle glow
- Character: bald, Wii Sports-style face, gender-neutral, athletic build
- Outfits: navy tank (strength), teal tank (yoga), navy long-sleeve (breathwork)
- Glow: deep fiery orange-amber for strength/yoga, blue for breathwork
- Model: Nano Banana 2 (Gemini 3.1 Flash Image) on Vertex AI Studio (~$0.067/image)
- Format: 4-frame animated WebP (2x2 grid prompt → crop → stitch)
- 6 frames for complex two-phase exercises
- No videos — deferred to FUTURE_SCOPE #8
- /m-review Media QA Agent spec written (separate from code /review)
- Testing: squat (B+), Warrior II (A-), Anulom Vilom (A-)
- Next: generate hero images for priority exercises, then build /m-review + batch pipeline


## Sprint 2 — Week of Apr 6, 2026

**Goal:** Infrastructure upgrade + core UX features

| # | Ticket | Branch | Status | Started | Shipped | Notes |
|---|---|---|---|---|---|---|
| 1 | Neon DB Migration | db/neon-migration | ✅ Shipped | Apr 6 | Apr 6 | Migrated from Railway PG. Neon Singapore, SSL enabled. Cloudinary keys scaffolded. |
| 2 | Cloudinary Setup | feature/cloudinary-setup | ✅ Shipped | Apr 7 | Apr 7 | SDK installed, upload utility created, media_url column added to exercises table. |
| 3 | Exercise Swap UI | feature/exercise-swap-ui | ✅ Shipped | Apr 7 | Apr 7 | Alternative picker, save preference, reset to default. New tables: slot_alternatives, user_exercise_prefs. |
| 4 | Workout Completion Summary | feature/workout-completion-summary | ✅ Shipped | Apr 7 | Apr 7 | PR detection, full-screen summary with glass card styling. |
| 5 | PR Detection + Celebration | feature/pr-detection | ✅ Shipped | Apr 7 | Apr 7 | Real-time PR detection on log-set (weight/volume/reps). Gold glow + badges mid-workout, haptic feedback, enhanced summary. |

**Progress: 5/5 tickets shipped**

---

## Sprint 1 (Started: April 5, 2026)

**Sprint 1 COMPLETE** — 5/5 tickets shipped.

| # | Ticket | Agent | Effort | Status | Started | Shipped |
|---|---|---|---|---|---|---|
| 1 | Remove Habit Tracking | Claude Code | Small | ✅ Shipped | Apr 5 | Apr 5 |
| 2 | Fix Tab Switching Performance | Claude Code | Small | ✅ Shipped | Apr 5 | Apr 5 |
| 3 | Workout Session Logging | Claude Code | Large | ✅ Shipped | Apr 5 | Apr 5 |
| 4 | Rest Timer Between Sets | Claude Code | Medium | ✅ Shipped | Apr 6 | Apr 6 |
| 4A | Codebase Cleanup | Claude Code | Medium | ✅ Shipped | Apr 6 | Apr 6 |
| 5 | Previous Performance Display | Claude Code | Medium | ✅ Shipped | Apr 6 | Apr 6 |

---

**Ticket 4 Notes:** Codebase cleanup first (split Workout.jsx). Rest timer with progress ring, skip, auto-dismiss. Review: B+

**Ticket 5 Notes:** Per-exercise previous data. Cross-exercise data leak fixed. Review: B+

## Deferred from Reviews (fix in future refactor ticket)

- ~~Extract Workout.jsx (1197 lines) into focused component files~~ Done in Ticket 4A
- Refactor useWorkoutSession to use useReducer
- Add stale session cleanup (server-side TTL)
- Add error feedback when completeSession/logSet fails
- Add exercise-belongs-to-session validation in log-set endpoint
- Replace SELECT * with explicit column lists

---

## How This File Works

- PM (Claude.ai) creates tickets during sprint planning
- After each ticket ships, update status to ✅ Done + date
- Deferred items from /review go in the deferred section
- At sprint retro, review what shipped and plan next sprint

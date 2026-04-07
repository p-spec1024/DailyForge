# DailyForge — Sprint Tracker

## Sprint 2 — Week of Apr 6, 2026

**Goal:** Infrastructure upgrade + core UX features

| # | Ticket | Branch | Status | Started | Shipped | Notes |
|---|---|---|---|---|---|---|
| 1 | Neon DB Migration | db/neon-migration | ✅ Shipped | Apr 6 | Apr 6 | Migrated from Railway PG. Neon Singapore, SSL enabled. Cloudinary keys scaffolded. |
| 2 | Cloudinary Setup | feature/cloudinary-setup | ✅ Shipped | Apr 7 | Apr 7 | SDK installed, upload utility created, media_url column added to exercises table. |
| 3 | Exercise Swap UI | feature/exercise-swap-ui | ✅ Shipped | Apr 7 | Apr 7 | Alternative picker, save preference, reset to default. New tables: slot_alternatives, user_exercise_prefs. |
| 4 | Workout Completion Summary | feature/workout-completion-summary | ✅ Shipped | Apr 7 | Apr 7 | PR detection, full-screen summary with glass card styling. |
| 5 | PR Detection + Celebration | feature/pr-detection | 📋 Not Started | — | — | |

**Progress: 4/5 tickets shipped**

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

# DailyForge — Sprint Tracker

## Sprint 1 (Started: April 5, 2026)

| # | Ticket | Agent | Effort | Status | Date Shipped |
|---|---|---|---|---|---|
| 1 | Remove Habit Tracking | Claude Code | Small | ✅ Done | Apr 5, 2026 |
| 2 | Fix Tab Switching Performance | Claude Code | Small | ✅ Done | Apr 5, 2026 |
| 3 | Workout Session Logging | Claude Code | Large | ✅ Done | Apr 5, 2026 |
| 4 | Rest Timer Between Sets | Claude Code | Medium | 🧪 Testing | Apr 6, 2026 |
| 4A | Codebase Cleanup | Claude Code | Medium | ✅ Shipped | Apr 6, 2026 |
| 5 | Previous Performance Display | Claude Code | Medium | ⬜ Waiting on #3 | |

---

**Ticket 4 Notes:** Built, ready for iPhone testing

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

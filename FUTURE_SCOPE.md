# DailyForge — Future Scope

Features that are **not in the current build plan** but worth revisiting later. Updated whenever a "not now" feature comes up during planning or development.

---

## Tracked Features

| # | Feature | Category | Source | Date Added | Notes |
|---|---|---|---|---|---|
| 1 | Nutrition / macro tracking | Strength | Hevy user complaints | Apr 5, 2026 | Users want calorie and macro logging alongside workout tracking. Would require food database API integration. |
| 2 | Social feed (follow users, like workouts, leaderboards) | Social | Hevy competitor research | Apr 4, 2026 | Community features — workout sharing, user comparison, routine library. Large effort, not core to v1. |
| 3 | Coach platform | Social | Hevy competitor research | Apr 4, 2026 | Let coaches create programs for clients. Not relevant for personal use app. |
| 4 | Push notifications (streak-at-risk, workout reminders) | Engagement | Blueprint v3 | Apr 5, 2026 | Requires service worker push API + notification permission flow. |
| 5 | OAuth login (Google, Apple) | Auth | Blueprint v3 | Apr 5, 2026 | Currently email/password only. OAuth adds convenience but not critical for launch. |
| 6 | Desktop responsive layout | Platform | Blueprint v3 | Apr 5, 2026 | App is mobile-first. Desktop works but isn't optimized. Low priority — target users are on phone. |
| 7 | Automated browser testing (Playwright) | DevOps | iPhone testing session | Apr 7, 2026 | Add comprehensive test coverage in Phase 5 (Polish) when UI is stable. Don't add during active feature development — too much rewriting. Playwright preferred for React + real browser testing. |
| 8 | ExerciseDB full library (11K+ exercises) | Data | Sprint 3 seeding | Apr 7, 2026 | Currently using free-exercise-db (~800). Add RAPIDAPI_KEY and re-run seed script to get full 11K from ExerciseDB. |

---

## How This File Works

- PM (Claude.ai) adds entries during planning sessions
- Features move OUT of this file and INTO the sprint backlog when prioritized
- Each entry gets a date so we can see how long ideas have been waiting
- "Source" tracks where the idea came from (competitor research, user feedback, internal planning)

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
| 9 | Muscle highlight overlay (SVG toggle on video) | UI Enhancement | Sprint 3 planning | Apr 8, 2026 | Toggle to show/hide SVG overlay highlighting muscles worked. |
| 10 | Form tip text overlays on video | UI Enhancement | Sprint 3 planning | Apr 8, 2026 | Display contextual form tips at key moments during video. |
| 11 | Breathing cue animations | UI Enhancement | Sprint 3 planning | Apr 8, 2026 | Visual breathing indicators synced to exercise phases. |
| 12 | Form line/arrow animations | UI Enhancement | Sprint 3 planning | Apr 8, 2026 | Animated lines/arrows showing correct alignment on video. |
| 13 | 3D rigged character model for exercise illustrations | Media | S3-T5 research | Apr 8, 2026 | Replace per-exercise AI image generation with a single rigged 3D model of the DailyForge character. Pipeline: generate model (Tripo AI / Meshy) → auto-rig (Cascadeur / AccuRIG / Mixamo) → pose into any exercise → render frames from Blender. Solves cross-exercise character consistency permanently. One model = infinite exercises. |
| 14 | Exercise demo videos for complex movements | Media | S3-T5 research | Apr 8, 2026 | Short 4-sec looping videos (Veo 3) for ~30-50 complex multi-phase exercises where 4-6 frame animations aren't enough (Turkish Get-Up, Clean & Jerk, Sun Salutation flows). Deferred because 4-6 frame animated WebP covers 95%+ of exercises adequately. |

---

## How This File Works

- PM (Claude.ai) adds entries during planning sessions
- Features move OUT of this file and INTO the sprint backlog when prioritized
- Each entry gets a date so we can see how long ideas have been waiting
- "Source" tracks where the idea came from (competitor research, user feedback, internal planning)

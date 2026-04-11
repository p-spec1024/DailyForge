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
| 15 | iOS screen wake during breathwork | UX | S4-T1 testing | Apr 10, 2026 | navigator.wakeLock and NoSleep.js don't work on iOS Safari. Works on Android. Options: Capacitor native wrapper or prompt user to disable Auto-Lock. |
| 16 | Native haptic feedback for breathwork | UX | S4-T1 testing | Apr 10, 2026 | navigator.vibrate() not supported on iOS Safari. Works on Android. Needs native wrapper for iOS haptics. |
| 17 | Exercise swap for yoga poses | Yoga | S4-T3 iPhone testing | Apr 11, 2026 | Allow users to replace individual yoga poses during warm-up/cool-down/standalone sessions. Filter alternatives by same category + same focus area + same practice type. |
| 18 | Breathwork technique swap in session | Breathwork | S4-T3 iPhone testing | Apr 11, 2026 | Allow users to replace breathwork technique during active session (not just on overview). Filter by same purpose (energizing → energizing, calming → calming). Pre-session overview already has "change technique" — extend to mid-session. |
| 19 | Workout tab home screen redesign | UI | S4-T3 iPhone testing | Apr 11, 2026 | Redesign workout tab as a proper daily dashboard — greeting, streak stat, today's session card, 5-phase visual, quick-start buttons. Current view is functional but needs polish for a 3-pillar app. |
| 20 | Ashtanga practice type | Yoga | Down Dog comparison | Apr 11, 2026 | Down Dog has Ashtanga as a practice type. Add Ashtanga sequences to the yoga library. |
| 21 | Chair Yoga practice type | Yoga | Down Dog comparison | Apr 11, 2026 | Down Dog has Chair Yoga for accessibility. Add chair-based pose variants. |
| 22 | Progress photos (Max tier) | Body | S5-T3 research | Apr 12, 2026 | Front/side/back progress photos with side-by-side date comparison. Local storage only (privacy). Time-lapse generation for Max tier. Similar to MacroFactor gallery and Progress App. |
| 23 | Full 14-measurement body tracking (Pro tier) | Body | S5-T3 research | Apr 12, 2026 | Expand from 5 core circumferences to full 14: neck, shoulders, chest, waist, abdomen, hips, L/R bicep, L/R forearm, L/R thigh, L/R calf. Matches Hevy's measurement set. MVP ships with 5 core only. |
| 24 | Custom body measurements (Max tier) | Body | S5-T3 research | Apr 12, 2026 | Allow users to add up to 5 custom measurement types beyond the standard 14. Similar to Progress App (10 custom). |
| 25 | Apple Health / Google Fit sync | Integration | S5-T3 research | Apr 12, 2026 | Sync weight, body fat %, workouts to Apple Health / Google Fit. Currently blocked by PWA limitations — requires native wrapper (Capacitor/React Native) for background sync. Manual import button possible as interim. |
| 26 | True adaptive AI coaching (MacroFactor-style) | AI | S5-T3 research | Apr 12, 2026 | Weekly calorie/macro adjustments based on actual weight trend + logged nutrition. Requires: nutrition tracking integration (#1), 10K+ user sessions for algorithm training, sophisticated ML pipeline. NOT the same as S5-T4 rule-based progressive overload. Deferred until data scale achieved. |
| 27 | Goal setting + milestone badges | Body | S5-T3 research | Apr 12, 2026 | Target weight + rate of change → estimated completion date. Progress % ring. "On track / Behind / Ahead" indicator. Badges at 25%, 50%, 75%, 100% of goal. Deferred from S5-T3 MVP to keep scope lean. |

---

## How This File Works

- PM (Claude.ai) adds entries during planning sessions
- Features move OUT of this file and INTO the sprint backlog when prioritized
- Each entry gets a date so we can see how long ideas have been waiting
- "Source" tracks where the idea came from (competitor research, user feedback, internal planning)

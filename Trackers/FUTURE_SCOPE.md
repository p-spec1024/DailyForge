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
| 28 | ML-powered progressive overload (Vertex AI Gemini) | AI | S5-T4 planning | Apr 12, 2026 | Replace rule-based suggestions with an ML model that learns per-user response patterns: optimal step size, deload timing, exercise-specific plateaus. Service split in S5-T4 (`server/src/services/suggestions.js`) leaves a clean seam — swap `getStrengthSuggestion` / `getYogaSuggestionsBatch` / `getBreathworkSuggestionsBatch` implementations without touching routes or UI. Gated on sufficient training data (10K+ sessions per user cohort). |
| 29 | Batch strength suggestions endpoint + unit tests | DevEx | S5-T4 /review | Apr 12, 2026 | Strength suggestion still fetches per-ExerciseCard on workout start (5-8 requests). Yoga/breathwork were batched but strength path wasn't — inconsistent with house pattern. Add `/api/suggestions/strength?exerciseIds=` (or fold into `/session/previous-performance`) and fetch once in SessionMainWork. Also add Vitest coverage for the three suggestion service functions — the rule branches are now pure-ish and finally testable. |
| 30 | Algorithm Specification Document | Complete spec for yoga/strength/breathwork session generation algorithms | Algorithm Research | Apr 12, 2026 | HIGH priority. Prerequisite for building session algorithms. Based on Down Dog (200hr YTT curriculum) + Fitbod (400M+ workouts) research. |
| 31 | Weekly routine scheduling | Assign routines to specific days of the week | S5-T5 planning | Apr 12, 2026 | Let users set "Push day = Monday, Pull day = Wednesday" etc. |
| 32 | Most improved exercise metric | Dashboard metric showing biggest strength gains | S5-T5 planning | Apr 12, 2026 | Show which exercise improved most over 30/90 days. |
| 33 | Pose prerequisites system | Data model + UI for yoga pose requirements | Algorithm Research | Apr 12, 2026 | HIGH priority. Only intermediate/advanced poses have prerequisites. Beginner poses ARE the foundation. |
| 34 | User level tracking | Track user level per pillar (1-5) with DB schema | Algorithm Research | Apr 12, 2026 | HIGH priority. Beginner 1/2, Intermediate 1/2, Advanced per pillar. |
| 35 | Beginner onboarding quiz | Ask fitness level, goals, equipment on first launch | Algorithm Research | Apr 12, 2026 | HIGH priority. Sets initial levels for all 3 pillars. |
| 36 | Progressive difficulty unlocking | Unlock intermediate/advanced poses as user progresses | Algorithm Research | Apr 12, 2026 | Poses unlock when prerequisites completed enough times. |
| 37 | Muscle recovery tracking | Per-muscle-group recovery % (0-100) based on last workout | Algorithm Research | Apr 12, 2026 | Like Fitbod's muscle recovery system. Affects exercise selection. |
| 38 | Beginner programs | "First 7 Days" guided programs for all three pillars | Algorithm Research | Apr 12, 2026 | HIGH priority. Structured intro for new users. |
| 39 | Volume trend comparisons | Compare weekly/monthly volume trends in charts | S5-T5 planning | Apr 12, 2026 | Add week-over-week comparison to progression graphs. |
| 40 | Counter-pose engine | Auto-insert counter-poses after peak/intense poses | Algorithm Research | Apr 12, 2026 | After backbends → forward folds. After twist right → twist left. |
| 41 | Movement pattern tagging | Tag strength exercises with pattern (push/pull/squat/hinge/carry/core) for balanced programming | Algorithm Research | Apr 12, 2026 | Ensures workouts don't stack 3 push exercises in a row. |
| 42 | Breathwork contraindications | Array of conditions per technique (pregnancy, heart conditions, anxiety) | Algorithm Research | Apr 12, 2026 | Safety filtering for technique selection. |
| 43 | Time-of-day breathwork filtering | Tag techniques as morning/evening/pre-workout/post-workout suitable | Algorithm Research | Apr 12, 2026 | Algorithm selects energizing AM, calming PM. |
| 44 | User equipment profile | Store user's available equipment for exercise filtering | Algorithm Research | Apr 12, 2026 | Onboarding asks "what equipment do you have?" |
| 45 | Primary/secondary muscle split | Split muscle_groups into primary_muscles and secondary_muscles arrays | Algorithm Research | Apr 12, 2026 | Current muscle_groups is flat array. Need to distinguish primary target vs supporting muscles for recovery tracking (#37) and balanced programming. |
| 46 | Exercise library "Do this" button | UX | S5-T6 testing | Apr 12, 2026 | Browse any exercise → "Do this exercise" starts single-exercise session. |
| 47 | Custom workout builder | UX | S5-T6 testing | Apr 12, 2026 | HIGH priority. Create/save custom routines. Core Hevy feature missing. |
| 48 | ~~Empty workout start~~ | UX | S5-T6 testing | Apr 12, 2026 | **DONE in S6-T1.** Start blank → add exercises as you go. |
| 49 | Yoga pose explorer | UX | S5-T6 testing | Apr 12, 2026 | Browse poses → single-pose timed hold. |
| 50 | ~~Strength exercise browser~~ | UX | S5-T6 testing | Apr 12, 2026 | **DONE in S6-T1.** Dedicated exercise browse screen with filters. |
| 51 | ~~Strength page redesign~~ | UX | S5-T6 testing | Apr 12, 2026 | **DONE in S6-T1.** Dedicated Strength tab with routine selection + empty workout. Match Yoga tab UX pattern. |
| 52 | useYogaSwap hook extraction | Refactor | S5-T6 /review | Apr 12, 2026 | Extract yoga swap logic into reusable hook. Logged as architecture recommendation. |
| 53 | Breathwork cancel-resume handling | UX | S5-T6 /review | Apr 12, 2026 | Handle cancel/resume edge cases in breathwork sessions. |
| 54 | Alternatives caching | Performance | S5-T6 /review | Apr 12, 2026 | Cache exercise alternatives to reduce API calls. |
| 55 | Remove exercise from workout | UX | S6-T2 testing | Apr 13, 2026 | Allow users to remove added exercises mid-workout (X button on exercise card) |
| 56 | Workout start optimization | Performance | S6-T2 testing | Apr 13, 2026 | "Starting workout..." screen takes too long — lazy load previous performance or batch API calls |
| 57 | Extract useAddExercise hook | Refactor | S6-T2 /review | Apr 13, 2026 | handleAddExercise is triplicated across EmptyWorkoutView, SessionMainWork, and TodayView — extract to shared hook |

---

## How This File Works

- PM (Claude.ai) adds entries during planning sessions
- Features move OUT of this file and INTO the sprint backlog when prioritized
- Each entry gets a date so we can see how long ideas have been waiting
- "Source" tracks where the idea came from (competitor research, user feedback, internal planning)

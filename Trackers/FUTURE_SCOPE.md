# DailyForge — Future Scope

**Triage completed: April 13, 2026**

Features categorized for Android v1.0 launch vs future updates.

| Category | Count |
|----------|-------|
| 🚀 Before Android Launch | 40 |
| 🔄 Future Updates | 12 |
| ❌ Cut | 2 |
| ✅ Already Done | 6 |

---

## 🚀 Before Android Launch (40 items)

| # | Feature | Category | Notes |
|---|---------|----------|-------|
| 4 | Push notifications | Engagement | Streak warnings, workout reminders |
| 5 | OAuth login (Google, Apple) | Auth | Sign in with Google/Apple buttons |
| 7 | Automated testing (Playwright) | DevOps | Comprehensive test coverage |
| 10 | Form tip text overlays | UI Enhancement | Contextual tips during exercise |
| 11 | Breathing cue animations | UI Enhancement | Visual breathing indicators synced to phases |
| 12 | Form line/arrow animations | UI Enhancement | Animated lines showing correct alignment |
| 13 | 3D rigged character model | Media | Tripo AI + Blender pipeline for consistent character |
| 14 | Exercise demo videos | Media | 35 complex exercises as MP4 |
| 17 | Exercise swap for yoga poses | Yoga | Replace individual poses mid-session |
| 18 | Breathwork technique swap in session | Breathwork | Change technique mid-session |
| 20 | Ashtanga practice type | Yoga | Add Ashtanga sequences |
| 21 | Chair Yoga practice type | Yoga | Accessibility seated yoga option |
| 27 | Goal setting + milestone badges | Body | Target weight, progress %, badges at 25/50/75/100% |
| 29 | Batch strength suggestions endpoint | DevEx | Performance optimization for API calls |
| 30 | Algorithm Spec Doc implementation | Algorithm | 5-level yoga difficulty system |
| 31 | Weekly routine scheduling | UX | Assign routines to specific days |
| 32 | Most improved exercise metric | Analytics | Dashboard showing biggest gains |
| 33 | Pose prerequisites system | Algorithm | Intermediate poses require beginner completion |
| 34 | User level tracking | Algorithm | Track level per pillar (Beginner 1/2, Intermediate 1/2, Advanced) |
| 35 | Beginner onboarding quiz | Onboarding | Ask fitness level, goals, equipment on first launch |
| 36 | Progressive difficulty unlocking | Algorithm | Unlock harder poses as user progresses |
| 37 | Muscle recovery tracking | Algorithm | Per-muscle recovery % (0-100) affects exercise selection |
| 38 | Beginner programs | Content | "First 7 Days" guided programs for all pillars |
| 39 | Volume trend comparisons | Analytics | Week-over-week comparison in charts |
| 40 | Counter-pose engine | Algorithm | Auto-insert counter-poses (backbend → forward fold) |
| 41 | Movement pattern tagging | Data | Tag exercises as push/pull/squat/hinge/carry/core |
| 42 | Breathwork contraindications | Data | Conditions per technique (pregnancy, heart conditions) |
| 43 | Time-of-day breathwork filtering | Algorithm | Morning=energizing, Evening=calming |
| 44 | User equipment profile | Onboarding | Store user's available equipment for filtering |
| 45 | Primary/secondary muscle split | Data | Distinguish main vs supporting muscles |
| 46 | Exercise library "Do this" button | UX | Browse exercise → Start single-exercise session |
| 49 | Yoga pose explorer | UX | Browse poses → single-pose timed hold |
| 52 | useYogaSwap hook extraction | Refactor | Extract yoga swap logic to reusable hook |
| 53 | Breathwork cancel-resume handling | UX | Handle cancel/resume edge cases |
| 54 | Alternatives caching | Performance | Cache exercise alternatives to reduce API calls |
| 55 | Remove exercise from workout | UX | X button to remove added exercises mid-workout |
| 56 | Workout start optimization | Performance | Faster "Starting workout..." screen |
| 57 | Extract useAddExercise hook | Refactor | Deduplicate add exercise logic |
| 59 | Routine edit/reorder exercises | UX | Edit routines: rename, reorder, add/remove |
| 60 | Routine duplicate/fork | UX | Duplicate routine as starting point |

## 🔄 Future Updates (12 items)

| # | Feature | Category | Notes |
|---|---------|----------|-------|
| 1 | Nutrition / macro tracking | Strength | Food database API integration |
| 2 | Social feed | Social | Follow users, like workouts, leaderboards |
| 8 | ExerciseDB full library (11K+) | Data | Needs RAPIDAPI_KEY |
| 9 | Muscle highlight overlay | UI Enhancement | SVG toggle on exercise videos |
| 15 | iOS wake lock | Platform | Needs Capacitor native wrapper |
| 16 | Native haptic feedback | Platform | iOS needs native wrapper |
| 22 | Progress photos (Max tier) | Body | Front/side/back with comparison |
| 23 | Full 14-measurement body tracking | Body | Expand from 5 to 14 measurements |
| 24 | Custom body measurements (Max tier) | Body | User adds custom measurement types |
| 25 | Apple Health / Google Fit sync | Integration | Sync workouts to health platforms |
| 26 | True adaptive AI coaching | AI | ML-based weekly adjustments (needs 10K+ sessions) |
| 28 | ML-powered progressive overload | AI | Replace rule-based with ML (needs data) |

## ❌ Cut (2 items)

| # | Feature | Category | Reason |
|---|---------|----------|--------|
| 3 | Coach platform | Social | Not relevant for personal use app |
| 6 | Desktop responsive layout | Platform | Mobile-first app, desktop not priority |

## ✅ Already Done (6 items)

| # | Feature | Completed In |
|---|---------|--------------|
| 19 | Workout tab home screen redesign | S5-T5 |
| 47 | Custom workout builder | S6-T3 |
| 48 | Empty workout start | S6-T1 |
| 50 | Strength exercise browser | S6-T1 |
| 51 | Strength page redesign | S6-T1 |
| 58 | Extract SaveRoutineModal pattern | S6-T3 |

---

## How This File Works

- PM (Claude.ai) adds entries during planning sessions
- Features move OUT of this file and INTO the sprint backlog when prioritized
- Each entry gets a date so we can see how long ideas have been waiting
- "Source" tracks where the idea came from (competitor research, user feedback, internal planning)

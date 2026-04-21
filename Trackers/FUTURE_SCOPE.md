# DailyForge — Future Scope

**Triage completed: April 13, 2026**

Features categorized for Android v1.0 launch vs future updates.

| Category | Count |
|----------|-------|
| 🚀 Before Android Launch | 43 |
| 🔄 Future Updates | 30 |
| ❌ Cut | 2 |
| ✅ Already Done | 6 |

---

## 🚀 Before Android Launch (43 items)

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
| 61 | Breathwork audio cues | Breathwork | Phase transition sounds. Options: (A) Simple chimes/tones for inhale/hold/exhale transitions, (B) Ambient soundscapes (ocean, forest, singing bowls), (C) Voice guidance via TTS ("inhale... hold... exhale..."), (D) Premium music + voice like Othership. Start with A or C, add B/D as Pro/Max tier feature. Use `just_audio` or `audioplayers` package. |
| 62 | Premium breathwork soundscapes (Pro/Max) | Breathwork | Music-driven sessions like Othership. Curated soundscapes with background music + voice guidance. Could license royalty-free ambient tracks or commission custom production. Differentiates Pro/Max tiers. Research: Othership charges $17.99/mo primarily for their DJ-curated soundscapes. |
| 74 | Option C: LLM-assisted muscle activation tagging | Data/Algorithm | Tag all 736 exercises with primary + secondary muscles using LLM query + cross-reference with free-exercise-db + web research for disagreements. ~$5 one-time LLM cost. Creates new `exercise_muscles` table with (exercise_id, muscle_group, role: primary/secondary). Level 2 accuracy target (~88-92%). Enables accurate heatmap on 3D body map. Can run in parallel with other sprints. Est 1-2 weeks spread work. Added Apr 20, 2026 |
| 75 | Option D: Manual tagging fallback for default program exercises only | Data/Algorithm | If Option C proves too time-consuming, fallback path: hand-tag only the ~30 exercises in the default weekly program with perfect primary + secondary muscles. Rest of 706 exercises use primary-only from free-exercise-db. Accuracy for default-program users: ~95%. Accuracy for library users: ~70%. Launch-ready pragmatic backup. Added Apr 20, 2026 |

---

## 🔄 Future Updates (30 items)

| # | Feature | Category | Notes |
|---|---------|----------|-------|
| 1 | Nutrition / macro tracking | Strength | Food database API integration |
| 2 | Social feed | Social | Follow users, like workouts, leaderboards |
| 8 | ExerciseDB API upgrade (Option B) | Data | Replace free-exercise-db base (736 exercises) with ExerciseDB API (11K+ exercises). Includes structured primary + secondary muscle tags. Requires RAPIDAPI_KEY (~$10-25/mo subscription). **DEFERRED TO POST-REVENUE** per CEO decision Apr 20, 2026 — bootstrap with Option C (zero-cost LLM tagging) first; upgrade when app generates income. |
| 9 | Muscle highlight overlay | UI Enhancement | SVG toggle on exercise videos |
| 15 | iOS wake lock | Platform | Needs Capacitor native wrapper |
| 16 | Native haptic feedback | Platform | iOS needs native wrapper |
| 22 | Progress photos (Max tier) | Body | Front/side/back with comparison |
| 23 | Full 14-measurement body tracking | Body | Expand from 5 to 14 measurements |
| 24 | Custom body measurements (Max tier) | Body | User adds custom measurement types |
| 25 | Apple Health / Google Fit sync | Integration | Sync workouts to health platforms |
| 26 | True adaptive AI coaching | AI | ML-based weekly adjustments (needs 10K+ sessions) |
| 28 | ML-powered progressive overload | AI | Replace rule-based with ML (needs data) |
| 37 | Muscle recovery tracking | Algorithm | Per-muscle recovery % (0-100) affects exercise selection. Moved from Before Android Launch (Apr 17, 2026) — now partially addressed by 3D body heatmap (T5a shows volume as recovery proxy); true recovery %s can come later |
| 63 | Expanded chart view (tap to enlarge) | Analytics | Full-screen chart modal with zoom, pan, tap-for-details. Added Apr 17, 2026 |
| 64 | Yoga/Breathwork data layer on 3D body map | UI v2 | After launch, add third toggle "Breath" showing lungs/chest activity + yoga-specific flexibility zones on figure |
| 65 | Per-muscle detail drill-down page | UX v2 | Tap "View ›" on muscle tooltip card → full page with exercise history, PR timeline, recovery status, recommended exercises for that muscle |
| 66 | 3D body muscle raycasting (precise tap detection) | Tech v2 | T5a uses hotspot approach; v2 upgrades to true per-mesh raycasting for pixel-perfect muscle selection |
| 67 | Personalized 3D character (replace generic model) | Media v2 | Use Tripo AI–generated character (existing pipeline) as the body map model, so user sees themselves instead of generic anatomy |
| 68 | Body map time-travel (see past volume) | Analytics v2 | Slider above body to scrub through weeks/months showing how muscle balance evolved |
| 69 | Muscle balance score + recommendations | Algorithm v2 | Detect imbalances (e.g., chest trained 3x more than back) and suggest corrective exercises |
| 70 | True per-mesh raycasting via engine swap | Tech v2 | Currently blocked by `model_viewer_plus` WebView architecture. Requires switching to `flutter_scene` or custom platform channels. Weeks of engineering work. Only pursue if v1 performance/precision proves inadequate post-launch. Added Apr 17, 2026 |
| 71 | Hotspot to split-mesh upgrade (if hotspots ship as T5a fallback) | Tech v2 | If T5a ships with polished hotspot zones due to Blender blockers, v2 should upgrade to true split-mesh coloring for precision. Conditional future item — only applies if hotspot fallback was taken. **RESOLVED Apr 20, 2026:** Split-mesh approach working successfully; this item is no longer needed since we're not using hotspot fallback. Kept for historical record. |
| 72 | Two-model overlay approach (beautiful + invisible detection) | Tech v2 | Creative idea: layer CharacterZone model for rendering + invisible primitive shapes for tap detection, moving in sync. Not pursued in T5a due to complexity. Could revisit if hotspot precision proves inadequate. Added Apr 17, 2026 |
| 73 | Custom coordinate-based mesh splitting script | Tech v2 | Write Python script that splits mesh by vertex coordinates (chest = vertices where x between A and B, etc.). Alternative to manual Blender splitting if automated approach is preferred. **PARTIALLY IMPLEMENTED Apr 20, 2026:** We ARE using coordinate-bounds Python scripts for splitting. Future work could automate full body in one batch script instead of per-muscle interactive runs. |
| 76 | Refine muscle boundaries with per-vertex painting | Tech v2 | V1 muscle splits are coordinate-box approximations (70-85% accuracy). V2 could use Blender's sculpt-mode vertex painting with anatomy reference for higher precision. Or commission Fiverr 3D artist ($30-50) post-revenue. Added Apr 20, 2026 |
| 77 | Blender MCP integration for Tripo AI character pipeline | Tech v2 | Connect Blender to Claude Code via blender-mcp addon. Useful for future exercise character posing pipeline (Tripo AI character → Blender pose → render). 30-60 min setup cost. Deferred to when 3D character pipeline becomes active priority. Added Apr 20, 2026 |
| 78 | Revisit body map scope if v1 mesh quality disappoints | UX v2 | If user feedback on v1 body map is "boundaries look off," consider scope-down to 6 major regions (upper body front / upper body back / core / arms / upper legs / lower legs) with simpler visual treatment. Alternative to paying for precision refinement. Only pursue if feedback demands it. Added Apr 20, 2026 |
| 79 | Automated full-body split script (one-shot bounds file) | Tech v2 | Current workflow requires clicking body_lo → Tab → Alt+A → paste script → Alt+P → P → Tab → rename → Ctrl+S per muscle. For future models (Tripo AI personalized characters), write a single Python script that takes a JSON of all muscle bounds and splits + renames + saves in one pass. Would turn 30 muscles from 90 min to 5 min. Added Apr 20, 2026. **UPDATE Apr 21, 2026:** Workflow evolved to hybrid approach (script + manual polish) rather than pure one-shot bounds file. Future auto-split script should accept bounds AND allow for per-muscle manual polish step. Estimated effort now higher than original "30 muscles in 5 min" estimate. |
| 80 | Muscle mesh regeneration for new anatomy models | Tech v2 | Current bounds (documented in S10-T5-DESIGN.md) are specific to the CharacterZone model's coordinate system. Different models will have different proportions and scales. When swapping to Tripo AI personalized character (item 67), mesh splits will need to be redone. Consider auto-calibration: detect skeleton, derive landmarks, scale bounds. Added Apr 20, 2026 |
| 81 | Mesh split quality review pass | Tech v2 | After all 30 muscles are split, do a quality review pass in Flutter app running with mock data. See which muscles feel "off" when tapped (wrong coverage, missing faces, bleed into neighbors). Prioritize fixes for the worst 3-5 muscles before launch. Acceptable polish work before going live. Added Apr 20, 2026 |
| 82 | User preference: show/hide muscle splits | UX v2 | Settings toggle: "Show anatomical muscle view" (split/colored) vs "Show uniform figure" (one color, no splits). Some users may prefer the clean look, especially for meditation/breathwork screens. Low priority. Added Apr 20, 2026 |
| 83 | Per-side oblique asymmetry visualization | UX v2/Max | Oblique meshes are split L/R but grouped as single "oblique" in Flutter for v1. Max-tier feature: surface L/R imbalance in training volume to help user identify weak-side development patterns. Added Apr 21, 2026 |
| 84 | Per-side upper_back asymmetry visualization | UX v2/Max | Same pattern as obliques — split in mesh, grouped in code. Max-tier could show trap imbalance from asymmetric compound lifts. Added Apr 21, 2026 |
| 85 | Per-side lat asymmetry visualization | UX v2/Max | Same pattern. Max-tier could help identify pull-side dominance (common in mixed-hand sports). Added Apr 21, 2026 |
| 86 | Circle-select workflow documented in split guide | Docs | Apr 21 learning: coordinate-bounds scripts work for regular-shaped muscles (arms, abs), but irregular muscles (traps, lats, glutes) benefit from manual Circle Select polish. For any future model migrations, document this hybrid workflow. Added Apr 21, 2026 |
| 87 | Mesh quality review pass includes boundary bleed check | Tech v2 | During v1 polish, specifically check lats_R (known to have some stray face patches near armpit/front that weren't cleaned during session — 2-3 min cleanup). Added Apr 21, 2026. **STATUS Apr 22, 2026:** Not yet addressed; still pending review pass after T5a ships and Flutter renders the mesh. If no visible issue in-app, deprioritize. |
| 88 | Automated split verification script | Tech v2 | Write a Python script that verifies all 28 meshes exist with correct names, reports face counts, and flags any orphan/stray faces. Run before handoff to Flutter code. Saves 10 min of manual verification. Added Apr 21, 2026 |
| 89 | Dedicated adductor / abductor mesh (inner + outer thigh) | Anatomy v2 | V1 uses Option A: hamstring absorbs inner and outer thigh wraps. If users give feedback like "adductor training doesn't light anything specific," v2 could split the current ham_L/R meshes further into distinct adductor (inner), abductor (outer), and hamstring (back) regions. Would require re-splitting via Blender + updating mesh-to-DB grouping in Flutter. Estimated effort: half day Blender + 2-3 hours Flutter. Added Apr 22, 2026 |
| 90 | Per-side glute asymmetry visualization | UX v2/Max | Glutes were merged into single mesh in v1 (user doesn't distinguish per-side in fitness context). If Max-tier asymmetry feature ships later, glutes would need to be re-split into glute_L/R. Flag this re-work cost when scoping the asymmetry feature. Added Apr 22, 2026 |
| 91 | Per-side lower_back asymmetry visualization | UX v2/Max | Same pattern as glute. lower_back merged in v1, would need re-split for Max-tier asymmetry. Lumbar asymmetry can indicate rotational imbalance common in golf/tennis athletes. Added Apr 22, 2026 |
| 92 | Knee Z landmark = -0.115 for CharacterZone model | Docs | Critical landmark for any future leg-muscle operations on this model. Discovered Apr 22 during quad_L split iterations. Original estimate of -0.128 was ~10mm off. Added Apr 22, 2026 |

---

## ❌ Cut (2 items)

| # | Feature | Category | Reason |
|---|---------|----------|--------|
| 3 | Coach platform | Social | Not relevant for personal use app |
| 6 | Desktop responsive layout | Platform | Mobile-first app, desktop not priority |

---

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

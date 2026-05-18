# Schema snapshot — staging (Neon `staging` branch)

- **Generated:** 2026-05-15T12:45:56.769Z
- **Database:** `neondb`
- **Host (short):** `ep-billowing-queen-a1ise52l-pooler`
- **Source script:** `server/scripts/snapshot-schema.mjs`

Schema-only introspection (no row data). Stable JSON sidecar at the matching `.json` path is the authoritative diff target.

## Object counts

| Object | Count |
|---|---|
| Tables | 29 |
| Functions | 2 |
| Triggers | 0 |
| Enums | 0 |
| Sequences | 29 |
| Indexes (sum across tables) | 96 |
| Constraints (sum across tables) | 105 |

## Tables

| Schema | Table | Columns | Indexes | Constraints |
|---|---|---|---|---|
| public | body_measurements | 12 | 2 | 2 |
| public | breathwork_logs | 11 | 4 | 4 |
| public | breathwork_sessions | 9 | 5 | 4 |
| public | breathwork_techniques | 27 | 7 | 3 |
| public | exercise_progress_cache | 20 | 4 | 4 |
| public | exercise_swap_counts | 6 | 3 | 5 |
| public | exercises | 24 | 4 | 2 |
| public | focus_areas | 9 | 3 | 3 |
| public | focus_content_compatibility | 8 | 4 | 5 |
| public | focus_muscle_keywords | 3 | 3 | 3 |
| public | focus_overlaps | 4 | 3 | 5 |
| public | habit_entries | 4 | 5 | 3 |
| public | habits | 11 | 2 | 3 |
| public | multi_phase_sessions | 9 | 2 | 3 |
| public | progress_photos | 6 | 2 | 2 |
| public | session_exercises | 16 | 4 | 4 |
| public | sessions | 14 | 6 | 5 |
| public | slot_alternatives | 3 | 3 | 4 |
| public | user_breathwork_prefs | 5 | 3 | 5 |
| public | user_excluded_exercises | 5 | 3 | 4 |
| public | user_exercise_prefs | 5 | 4 | 5 |
| public | user_pillar_levels | 8 | 3 | 6 |
| public | user_routine_exercises | 6 | 3 | 4 |
| public | user_routines | 6 | 2 | 2 |
| public | user_settings | 7 | 2 | 3 |
| public | user_slot_prefs | 4 | 4 | 5 |
| public | users | 7 | 2 | 2 |
| public | workout_slots | 5 | 3 | 4 |
| public | workouts | 4 | 1 | 1 |

## Functions

- `public.recompute_all_user_pillar_levels(p_user_id integer)` → `SETOF user_pillar_levels` [function, plpgsql]
- `public.recompute_user_pillar_level(p_user_id integer, p_pillar character varying)` → `user_pillar_levels` [function, plpgsql]

## Triggers

_None._

## Enums

_None._

## Sequences

- `public.body_measurements_id_seq` ← `public.body_measurements.id`
- `public.breathwork_logs_id_seq` ← `public.breathwork_logs.id`
- `public.breathwork_sessions_id_seq` ← `public.breathwork_sessions.id`
- `public.breathwork_techniques_id_seq` ← `public.breathwork_techniques.id`
- `public.cross_pillar_sessions_id_seq` ← `public.multi_phase_sessions.id`
- `public.exercise_progress_cache_id_seq` ← `public.exercise_progress_cache.id`
- `public.exercise_swap_counts_id_seq` ← `public.exercise_swap_counts.id`
- `public.exercises_id_seq` ← `public.exercises.id`
- `public.focus_areas_id_seq` ← `public.focus_areas.id`
- `public.focus_content_compatibility_id_seq` ← `public.focus_content_compatibility.id`
- `public.focus_muscle_keywords_id_seq` ← `public.focus_muscle_keywords.id`
- `public.focus_overlaps_id_seq` ← `public.focus_overlaps.id`
- `public.habit_entries_id_seq` ← `public.habit_entries.id`
- `public.habits_id_seq` ← `public.habits.id`
- `public.progress_photos_id_seq` ← `public.progress_photos.id`
- `public.session_exercises_id_seq` ← `public.session_exercises.id`
- `public.sessions_id_seq` ← `public.sessions.id`
- `public.slot_alternatives_id_seq` ← `public.slot_alternatives.id`
- `public.user_breathwork_prefs_id_seq` ← `public.user_breathwork_prefs.id`
- `public.user_excluded_exercises_id_seq` ← `public.user_excluded_exercises.id`
- `public.user_exercise_prefs_id_seq` ← `public.user_exercise_prefs.id`
- `public.user_pillar_levels_id_seq` ← `public.user_pillar_levels.id`
- `public.user_routine_exercises_id_seq` ← `public.user_routine_exercises.id`
- `public.user_routines_id_seq` ← `public.user_routines.id`
- `public.user_settings_id_seq` ← `public.user_settings.id`
- `public.user_slot_prefs_id_seq` ← `public.user_slot_prefs.id`
- `public.users_id_seq` ← `public.users.id`
- `public.workout_slots_id_seq` ← `public.workout_slots.id`
- `public.workouts_id_seq` ← `public.workouts.id`

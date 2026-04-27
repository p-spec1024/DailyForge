import { pool } from './pool.js';

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_slots (
  id SERIAL PRIMARY KEY,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  label VARCHAR(100),
  workout_id INT REFERENCES workouts(id),
  UNIQUE (day_of_week)
);

CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  workout_id INT REFERENCES workouts(id),
  name VARCHAR(255) NOT NULL,
  sanskrit_name VARCHAR(255),
  target_muscles TEXT,
  type VARCHAR(50) DEFAULT 'strength',
  default_sets INT,
  default_reps INT,
  default_duration_secs INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_slot_prefs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  slot_id INT REFERENCES workout_slots(id),
  workout_id INT REFERENCES workouts(id),
  UNIQUE (user_id, slot_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  workout_id INT REFERENCES workouts(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS session_exercises (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INT REFERENCES exercises(id),
  sets_completed INT,
  reps_completed INT,
  weight NUMERIC,
  duration_secs INT,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) DEFAULT 'boolean' CHECK (type IN ('boolean', 'quantity')),
  unit VARCHAR(50),
  target_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_entries (
  id SERIAL PRIMARY KEY,
  habit_id INT REFERENCES habits(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value NUMERIC DEFAULT 0,
  UNIQUE (habit_id, entry_date)
);

CREATE TABLE IF NOT EXISTS slot_alternatives (
  id SERIAL PRIMARY KEY,
  exercise_id INT REFERENCES exercises(id) ON DELETE CASCADE,
  alternative_exercise_id INT REFERENCES exercises(id) ON DELETE CASCADE,
  UNIQUE (exercise_id, alternative_exercise_id)
);

CREATE TABLE IF NOT EXISTS user_exercise_prefs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INT REFERENCES exercises(id) ON DELETE CASCADE,
  chosen_exercise_id INT REFERENCES exercises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS breathwork_techniques (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sanskrit_name VARCHAR(100),
  tradition VARCHAR(50) NOT NULL CHECK (tradition IN ('pranayama', 'western', 'therapeutic', 'goal_specific', 'advanced')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('energizing', 'calming', 'focus', 'sleep', 'performance', 'recovery', 'therapeutic')),
  purposes TEXT[] NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  safety_level VARCHAR(10) NOT NULL DEFAULT 'green' CHECK (safety_level IN ('green', 'yellow', 'red')),
  protocol JSONB NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  benefits TEXT[],
  contraindications TEXT[],
  caution_note TEXT,
  source VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolve breathwork_techniques from v1 (52-technique) to v2 (48-technique with safety tiers)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='breathwork_techniques' AND column_name='sanskrit_name') THEN
    ALTER TABLE breathwork_techniques
      ADD COLUMN sanskrit_name VARCHAR(100),
      ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'calming',
      ADD COLUMN safety_level VARCHAR(10) NOT NULL DEFAULT 'green',
      ADD COLUMN instructions TEXT NOT NULL DEFAULT '',
      ADD COLUMN benefits TEXT[],
      ADD COLUMN caution_note TEXT,
      ADD COLUMN source VARCHAR(100);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='breathwork_techniques' AND column_name='purpose') THEN
    ALTER TABLE breathwork_techniques RENAME COLUMN purpose TO purposes;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='breathwork_techniques' AND column_name='protocol_json') THEN
    ALTER TABLE breathwork_techniques RENAME COLUMN protocol_json TO protocol;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='breathwork_techniques' AND column_name='safety_notes') THEN
    ALTER TABLE breathwork_techniques DROP COLUMN safety_notes;
  END IF;
  ALTER TABLE breathwork_techniques DROP CONSTRAINT IF EXISTS breathwork_techniques_tradition_check;
  ALTER TABLE breathwork_techniques ADD CONSTRAINT breathwork_techniques_tradition_check
    CHECK (tradition IN ('pranayama', 'western', 'therapeutic', 'goal_specific', 'advanced'));
END $$;

CREATE TABLE IF NOT EXISTS breathwork_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  technique_id INTEGER REFERENCES breathwork_techniques(id) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  rounds_completed INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  rest_timer_duration INTEGER DEFAULT 90,
  rest_timer_enabled BOOLEAN DEFAULT true,
  rest_timer_auto_start BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- S5-T1: Progression cache for fast history/chart loads.
-- kind differentiates strength/yoga (exercises.id) from breathwork (breathwork_techniques.id)
-- since those live in separate ID namespaces.
CREATE TABLE IF NOT EXISTS exercise_progress_cache (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'strength' CHECK (kind IN ('strength','yoga','breathwork')),

  -- Strength metrics
  best_weight DECIMAL(6,2),
  best_weight_date DATE,
  best_volume INTEGER,
  best_volume_date DATE,
  estimated_1rm DECIMAL(6,2),

  -- Yoga metrics
  best_hold_seconds INTEGER,
  best_hold_date DATE,

  -- Breathwork metrics
  best_breath_hold_seconds INTEGER,
  best_breath_hold_date DATE,
  total_rounds INTEGER,

  -- Common
  total_sessions INTEGER DEFAULT 0,
  first_session_date DATE,
  last_session_date DATE,
  improvement_percentage DECIMAL(6,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, exercise_id, kind)
);

-- S5-T3: Body measurements (weight, body fat, circumferences) and progress photo metadata.
CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  weight_kg DECIMAL(5,2),
  body_fat_percent DECIMAL(4,1),

  waist_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  bicep_left_cm DECIMAL(5,1),
  bicep_right_cm DECIMAL(5,1),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_photos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taken_at DATE NOT NULL,
  view VARCHAR(10) DEFAULT 'front',
  local_storage_key VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- S6-T3: User-created routines (reusable workout templates)
CREATE TABLE IF NOT EXISTS user_routines (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_routine_exercises (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES user_routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER DEFAULT 3,
  notes TEXT,
  UNIQUE(routine_id, position)
);

-- S5-T1: Optional per-technique breathwork log for hold-time/rounds tracking.
CREATE TABLE IF NOT EXISTS breathwork_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  technique_id INTEGER NOT NULL REFERENCES breathwork_techniques(id),

  rounds_completed INTEGER NOT NULL,
  avg_hold_seconds INTEGER,
  max_hold_seconds INTEGER,
  total_duration_seconds INTEGER,
  ratio_used VARCHAR(20),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- S11-T3: Focus-area data model for Approach 5 suggestion engine.
-- Three additive tables — no ALTER on existing tables. content_id in
-- focus_content_compatibility is a soft-FK (exercises.id or
-- breathwork_techniques.id depending on content_type); seed script verifies.
CREATE TABLE IF NOT EXISTS focus_areas (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(40) UNIQUE NOT NULL,
  display_name  VARCHAR(80) NOT NULL,
  focus_type    VARCHAR(10) NOT NULL CHECK (focus_type IN ('body', 'state')),
  description   TEXT,
  icon_name     VARCHAR(40),
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS focus_muscle_keywords (
  id        SERIAL PRIMARY KEY,
  focus_id  INT NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
  keyword   VARCHAR(60) NOT NULL,
  UNIQUE(focus_id, keyword)
);

CREATE TABLE IF NOT EXISTS focus_content_compatibility (
  id           SERIAL PRIMARY KEY,
  focus_id     INT NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('strength', 'yoga', 'breathwork')),
  content_id   INT NOT NULL,
  role         VARCHAR(20) NOT NULL CHECK (role IN ('main', 'warmup', 'cooldown', 'bookend_open', 'bookend_close')),
  weight       DECIMAL(3,2),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(focus_id, content_type, content_id, role)
);

-- S11-T4: Per-pillar level tracking. One row per user per pillar.
-- source governs whether inference is allowed to overwrite (declared and
-- manual_override are user-stated and never auto-changed).
-- Promotion-only by design — see recompute_user_pillar_level() below.
CREATE TABLE IF NOT EXISTS user_pillar_levels (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pillar      VARCHAR(20) NOT NULL CHECK (pillar IN ('strength', 'yoga', 'breathwork')),
  level       VARCHAR(15) NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  source      VARCHAR(20) NOT NULL DEFAULT 'inferred' CHECK (source IN ('declared', 'inferred', 'manual_override')),
  computed_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pillar)
);
`;

const s11t4Functions = `
-- S11-T4: Single-pillar inference.
-- Reads user history for the named pillar, applies research-grounded
-- thresholds (see Trackers/S11-T4-level-tracking-spec.md), and UPSERTs
-- the row in user_pillar_levels with promotion-only semantics.
CREATE OR REPLACE FUNCTION recompute_user_pillar_level(
  p_user_id INT,
  p_pillar  VARCHAR(20)
) RETURNS user_pillar_levels
LANGUAGE plpgsql
AS $func$
DECLARE
  v_existing       user_pillar_levels;
  v_computed_level VARCHAR(15) := 'beginner';
  v_session_count  INT := 0;
  v_weeks_active   NUMERIC := 0;
  v_first_date     DATE;
  v_weight_kg      NUMERIC;
  v_bench_1rm      NUMERIC;
  v_squat_1rm      NUMERIC;
  v_dl_1rm         NUMERIC;
  v_int_distinct   INT := 0;
  v_int_total      INT := 0;
  v_first_int_date DATE;
  v_int_weeks      NUMERIC := 0;
  v_adv_distinct   INT := 0;
  v_adv_total      INT := 0;
  v_result         user_pillar_levels;
  v_level_rank     INT;
  v_existing_rank  INT;
BEGIN
  IF p_pillar NOT IN ('strength', 'yoga', 'breathwork') THEN
    RAISE EXCEPTION 'Invalid pillar: %', p_pillar;
  END IF;

  SELECT * INTO v_existing
    FROM user_pillar_levels
   WHERE user_id = p_user_id AND pillar = p_pillar;

  -- Never overwrite user-stated levels.
  IF v_existing.id IS NOT NULL AND v_existing.source IN ('declared', 'manual_override') THEN
    RETURN v_existing;
  END IF;

  IF p_pillar = 'strength' THEN
    SELECT COUNT(*)::INT, MIN(date)
      INTO v_session_count, v_first_date
      FROM sessions
     WHERE user_id = p_user_id
       AND type IN ('strength', '5phase')
       AND completed = true;

    IF v_first_date IS NOT NULL THEN
      v_weeks_active := GREATEST(0, (CURRENT_DATE - v_first_date)::NUMERIC / 7);
    END IF;

    SELECT weight_kg INTO v_weight_kg
      FROM body_measurements
     WHERE user_id = p_user_id
     ORDER BY measured_at DESC
     LIMIT 1;

    SELECT MAX(epc.estimated_1rm) INTO v_bench_1rm
      FROM exercise_progress_cache epc
      JOIN exercises e ON e.id = epc.exercise_id
     WHERE epc.user_id = p_user_id
       AND epc.kind = 'strength'
       AND epc.estimated_1rm IS NOT NULL
       AND e.name ILIKE '%bench press%'
       AND e.name NOT ILIKE '%dumbbell%'
       AND e.name NOT ILIKE '%incline%'
       AND e.name NOT ILIKE '%decline%';

    SELECT MAX(epc.estimated_1rm) INTO v_squat_1rm
      FROM exercise_progress_cache epc
      JOIN exercises e ON e.id = epc.exercise_id
     WHERE epc.user_id = p_user_id
       AND epc.kind = 'strength'
       AND epc.estimated_1rm IS NOT NULL
       AND e.name ILIKE '%squat%'
       AND e.name ILIKE '%barbell%'
       AND e.name NOT ILIKE '%front%'
       AND e.name NOT ILIKE '%goblet%';

    SELECT MAX(epc.estimated_1rm) INTO v_dl_1rm
      FROM exercise_progress_cache epc
      JOIN exercises e ON e.id = epc.exercise_id
     WHERE epc.user_id = p_user_id
       AND epc.kind = 'strength'
       AND epc.estimated_1rm IS NOT NULL
       AND e.name ILIKE '%deadlift%'
       AND e.name NOT ILIKE '%romanian%'
       AND e.name NOT ILIKE '%stiff%'
       AND e.name NOT ILIKE '%sumo%';

    -- Male thresholds (users.sex absent — see spec §Sex handling).
    -- Advanced: volume-floor AND any advanced ratio.
    IF v_session_count >= 50
       AND v_weeks_active >= 78
       AND v_weight_kg IS NOT NULL
       AND (
            (v_bench_1rm IS NOT NULL AND v_bench_1rm >= 1.5  * v_weight_kg)
         OR (v_squat_1rm IS NOT NULL AND v_squat_1rm >= 1.75 * v_weight_kg)
         OR (v_dl_1rm    IS NOT NULL AND v_dl_1rm    >= 2.0  * v_weight_kg)
       ) THEN
      v_computed_level := 'advanced';
    -- Intermediate: Path A (volume floor) OR Path B (performance gate).
    ELSIF (v_session_count >= 12 AND v_weeks_active >= 8)
       OR (v_weight_kg IS NOT NULL AND (
              (v_bench_1rm IS NOT NULL AND v_bench_1rm >= 1.0  * v_weight_kg)
           OR (v_squat_1rm IS NOT NULL AND v_squat_1rm >= 1.25 * v_weight_kg)
           OR (v_dl_1rm    IS NOT NULL AND v_dl_1rm    >= 1.5  * v_weight_kg)
          )) THEN
      v_computed_level := 'intermediate';
    END IF;

  ELSIF p_pillar = 'yoga' THEN
    SELECT COUNT(*)::INT, MIN(date)
      INTO v_session_count, v_first_date
      FROM sessions
     WHERE user_id = p_user_id
       AND type = 'yoga'
       AND completed = true;

    IF v_first_date IS NOT NULL THEN
      v_weeks_active := GREATEST(0, (CURRENT_DATE - v_first_date)::NUMERIC / 7);
    END IF;

    IF v_session_count >= 100 AND v_weeks_active >= 78 THEN
      v_computed_level := 'advanced';
    ELSIF v_session_count >= 25 AND v_weeks_active >= 12 THEN
      v_computed_level := 'intermediate';
    END IF;

  ELSIF p_pillar = 'breathwork' THEN
    SELECT COUNT(*)::INT, MIN(created_at)::DATE
      INTO v_session_count, v_first_date
      FROM breathwork_sessions
     WHERE user_id = p_user_id
       AND completed = true;

    IF v_first_date IS NOT NULL THEN
      v_weeks_active := GREATEST(0, (CURRENT_DATE - v_first_date)::NUMERIC / 7);
    END IF;

    SELECT
        COUNT(DISTINCT bs.technique_id)::INT,
        COUNT(*)::INT,
        MIN(bs.created_at)::DATE
      INTO v_int_distinct, v_int_total, v_first_int_date
      FROM breathwork_sessions bs
      JOIN breathwork_techniques bt ON bt.id = bs.technique_id
     WHERE bs.user_id = p_user_id
       AND bs.completed = true
       AND bt.difficulty = 'intermediate';

    IF v_first_int_date IS NOT NULL THEN
      v_int_weeks := GREATEST(0, (CURRENT_DATE - v_first_int_date)::NUMERIC / 7);
    END IF;

    SELECT
        COUNT(DISTINCT bs.technique_id)::INT,
        COUNT(*)::INT
      INTO v_adv_distinct, v_adv_total
      FROM breathwork_sessions bs
      JOIN breathwork_techniques bt ON bt.id = bs.technique_id
     WHERE bs.user_id = p_user_id
       AND bs.completed = true
       AND bt.difficulty = 'advanced';

    -- Advanced: ≥5 advanced sessions across ≥2 distinct techniques AND
    -- ≥12 weeks since first intermediate-tier completion (conjunction).
    IF v_adv_total >= 5 AND v_adv_distinct >= 2 AND v_int_weeks >= 12 THEN
      v_computed_level := 'advanced';
    -- Intermediate: Path A (technique exposure) OR Path B (volume floor).
    ELSIF (v_int_total >= 8 AND v_int_distinct >= 2)
       OR (v_session_count >= 30 AND v_weeks_active >= 12) THEN
      v_computed_level := 'intermediate';
    END IF;
  END IF;

  -- INSERT if absent.
  IF v_existing.id IS NULL THEN
    INSERT INTO user_pillar_levels (user_id, pillar, level, source, computed_at, updated_at)
    VALUES (p_user_id, p_pillar, v_computed_level, 'inferred', NOW(), NOW())
    RETURNING * INTO v_result;
    RETURN v_result;
  END IF;

  -- Promotion-only update (never demote).
  v_level_rank := CASE v_computed_level
                    WHEN 'beginner'     THEN 1
                    WHEN 'intermediate' THEN 2
                    WHEN 'advanced'     THEN 3
                  END;
  v_existing_rank := CASE v_existing.level
                    WHEN 'beginner'     THEN 1
                    WHEN 'intermediate' THEN 2
                    WHEN 'advanced'     THEN 3
                  END;

  IF v_level_rank > v_existing_rank THEN
    UPDATE user_pillar_levels
       SET level       = v_computed_level,
           source      = 'inferred',
           computed_at = NOW(),
           updated_at  = NOW()
     WHERE id = v_existing.id
     RETURNING * INTO v_result;
  ELSE
    -- Same or lower computed level — only bump computed_at, leave level alone.
    UPDATE user_pillar_levels
       SET computed_at = NOW()
     WHERE id = v_existing.id
     RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$func$;

-- S11-T4: Wrapper — recomputes all three pillars for one user.
CREATE OR REPLACE FUNCTION recompute_all_user_pillar_levels(p_user_id INT)
RETURNS SETOF user_pillar_levels
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY SELECT * FROM recompute_user_pillar_level(p_user_id, 'strength');
  RETURN QUERY SELECT * FROM recompute_user_pillar_level(p_user_id, 'yoga');
  RETURN QUERY SELECT * FROM recompute_user_pillar_level(p_user_id, 'breathwork');
  RETURN;
END;
$func$;
`;

const alterations = `
ALTER TABLE habits ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'personal';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS auto_type VARCHAR(50) DEFAULT NULL;

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) DEFAULT 'image';

-- Sessions table: add missing columns for full session tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration INTEGER; -- in seconds
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'strength';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Session exercises: add per-set logging columns
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS set_number INTEGER;
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS rpe DECIMAL(3,1);
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) DEFAULT 'normal';
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS notes TEXT;

-- Unique constraint for atomic set upsert (ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_session_exercise_set'
  ) THEN
    ALTER TABLE session_exercises ADD CONSTRAINT uq_session_exercise_set
      UNIQUE (session_id, exercise_id, set_number);
  END IF;
END $$;

ALTER TABLE workout_slots ADD COLUMN IF NOT EXISTS phase VARCHAR(30) DEFAULT 'main';
ALTER TABLE workout_slots DROP CONSTRAINT IF EXISTS workout_slots_day_of_week_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_slots_day_phase_key'
  ) THEN
    ALTER TABLE workout_slots ADD CONSTRAINT workout_slots_day_phase_key UNIQUE (day_of_week, phase);
  END IF;
END $$;
UPDATE workout_slots SET phase = 'main' WHERE phase IS NULL OR phase = 'main';

-- 5-phase session support
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category VARCHAR(20);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS phases_json JSONB;

-- Exercise tracking type: weight_reps (default), duration (timed holds), reps_only (bodyweight)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS tracking_type VARCHAR(20) DEFAULT 'weight_reps';

-- Practice type tagging for yoga poses (array: '{vinyasa,hatha,yin}')
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS practice_types TEXT[];

-- Hold times per practice type as JSON
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS hold_times_json JSONB;

-- S5-T1: session_exercises columns for yoga/breathwork tracking
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS hold_duration_seconds INTEGER;
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS rounds_completed INTEGER;
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS technique_ratio VARCHAR(20);

-- S5-T3: User profile fields for body measurements (height required for BMI)
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm DECIMAL(5,1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_system VARCHAR(10) DEFAULT 'metric';

-- Set known isometric/hold exercises to duration tracking (exact names only)
UPDATE exercises SET tracking_type = 'duration' WHERE tracking_type = 'weight_reps' AND LOWER(name) IN (
  'plank', 'side plank', 'side plank (left)', 'side plank (right)',
  'wall sit', 'dead hang', 'l-sit',
  'hollow body hold', 'superman hold', 'glute bridge hold'
);

-- S5-T6: User breathwork technique preferences for mid-session swap
CREATE TABLE IF NOT EXISTS user_breathwork_prefs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phase VARCHAR(10) NOT NULL CHECK (phase IN ('opening', 'closing')),
  technique_id INTEGER NOT NULL REFERENCES breathwork_techniques(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, phase)
);

-- S6-T2.1: Flag bodyweight exercises as reps_only (no weight input needed)
-- Only run if we haven't flagged any yet (idempotent guard)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM exercises WHERE tracking_type = 'reps_only' LIMIT 1) THEN
    -- Equipment-based detection (most reliable — "body weight" or "body only" in description)
    UPDATE exercises SET tracking_type = 'reps_only'
    WHERE tracking_type = 'weight_reps'
      AND workout_id IS NULL
      AND (
        LOWER(description) LIKE '%equipment: body weight%'
        OR LOWER(description) LIKE '%equipment: bodyweight%'
        OR LOWER(description) LIKE '%equipment: body only%'
      );

    -- Seeded workout exercises that are bodyweight (exact names)
    UPDATE exercises SET tracking_type = 'reps_only'
    WHERE tracking_type = 'weight_reps'
      AND workout_id IS NOT NULL
      AND LOWER(name) IN (
        'pull-ups', 'push-ups', 'tricep dips',
        'russian twists', 'hanging leg raises',
        'bicycle crunches', 'dead bugs'
      );
  END IF;
END $$;

-- S6-T3: Link sessions to user routines for "last used" tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS routine_id INTEGER REFERENCES user_routines(id) ON DELETE SET NULL;

-- Fix recovery/mobility exercises that have duration but wrong tracking_type
UPDATE exercises SET tracking_type = 'duration'
WHERE tracking_type = 'weight_reps'
  AND default_duration_secs IS NOT NULL
  AND default_reps IS NULL;

-- S11-T1: Approach 5 breathwork tagging — session-position compatibility flags
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS pre_workout_compatible BOOLEAN;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS post_workout_compatible BOOLEAN;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS standalone_compatible BOOLEAN;

-- S11-T1.5: Replace single duration_min/max with per-difficulty duration columns.
-- The dropped columns were never populated (all NULL across 49 rows) — no data loss.
-- Per-difficulty ranges model progression (e.g. beginner Kapalabhati 1-3 min vs advanced 10-30 min).
ALTER TABLE breathwork_techniques DROP COLUMN IF EXISTS duration_min;
ALTER TABLE breathwork_techniques DROP COLUMN IF EXISTS duration_max;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS beginner_duration_min INT;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS beginner_duration_max INT;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS intermediate_duration_min INT;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS intermediate_duration_max INT;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS advanced_duration_min INT;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS advanced_duration_max INT;
`;

const indexes = `
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_id ON habit_entries(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_date ON habit_entries(habit_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_exercise ON session_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_slots_day_phase ON workout_slots(day_of_week, phase);
CREATE INDEX IF NOT EXISTS idx_user_slot_prefs_user_id ON user_slot_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_slot_prefs_slot_id ON user_slot_prefs(slot_id);
CREATE INDEX IF NOT EXISTS idx_slot_alternatives_exercise ON slot_alternatives(exercise_id);
CREATE INDEX IF NOT EXISTS idx_user_exercise_prefs_user ON user_exercise_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_exercise_prefs_exercise ON user_exercise_prefs(user_id, exercise_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lib_exercises_name_source ON exercises (name, source) WHERE workout_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_breathwork_sessions_user ON breathwork_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_breathwork_sessions_technique ON breathwork_sessions(technique_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_breathwork_name ON breathwork_techniques (name);
CREATE INDEX IF NOT EXISTS idx_breathwork_tradition ON breathwork_techniques (tradition);
CREATE INDEX IF NOT EXISTS idx_breathwork_difficulty ON breathwork_techniques (difficulty);
CREATE INDEX IF NOT EXISTS idx_breathwork_safety ON breathwork_techniques (safety_level);
CREATE INDEX IF NOT EXISTS idx_breathwork_category ON breathwork_techniques (category);
CREATE INDEX IF NOT EXISTS idx_progress_cache_user ON exercise_progress_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_cache_exercise ON exercise_progress_cache(exercise_id, kind);
CREATE INDEX IF NOT EXISTS idx_breathwork_logs_user ON breathwork_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_breathwork_logs_technique ON breathwork_logs(technique_id);
CREATE INDEX IF NOT EXISTS idx_breathwork_logs_date ON breathwork_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON body_measurements(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_user_date ON progress_photos(user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_breathwork_prefs_user ON user_breathwork_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_routines_user ON user_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON user_routine_exercises(routine_id);
CREATE INDEX IF NOT EXISTS idx_sessions_routine ON sessions(routine_id);

-- S11-T3: Focus-area indexes.
CREATE INDEX IF NOT EXISTS idx_focus_areas_type_active
  ON focus_areas(focus_type, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_focus_muscle_keywords_focus
  ON focus_muscle_keywords(focus_id);
CREATE INDEX IF NOT EXISTS idx_fcc_focus_role_type
  ON focus_content_compatibility(focus_id, role, content_type);
CREATE INDEX IF NOT EXISTS idx_fcc_content
  ON focus_content_compatibility(content_type, content_id);

-- S11-T4: Per-user lookup index for the inference function.
CREATE INDEX IF NOT EXISTS idx_upl_user
  ON user_pillar_levels(user_id);
`;

async function migrate() {
  console.log('Running migrations...');
  await pool.query(schema);
  console.log('Running alterations...');
  await pool.query(alterations);
  console.log('Creating indexes...');
  await pool.query(indexes);
  console.log('Defining functions...');
  await pool.query(s11t4Functions);
  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

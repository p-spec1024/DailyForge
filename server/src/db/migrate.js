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

-- S11-T1: Approach 5 breathwork tagging — duration ranges and session-position compatibility
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS duration_min INT;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS duration_max INT;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS pre_workout_compatible BOOLEAN;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS post_workout_compatible BOOLEAN;
ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS standalone_compatible BOOLEAN;
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
`;

async function migrate() {
  console.log('Running migrations...');
  await pool.query(schema);
  console.log('Running alterations...');
  await pool.query(alterations);
  console.log('Creating indexes...');
  await pool.query(indexes);
  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

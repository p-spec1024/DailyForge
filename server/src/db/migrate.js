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

CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  rest_timer_duration INTEGER DEFAULT 90,
  rest_timer_enabled BOOLEAN DEFAULT true,
  rest_timer_auto_start BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

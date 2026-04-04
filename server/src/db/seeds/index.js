import { pool } from '../pool.js';

const WORKOUTS = [
  { name: 'Push (Chest/Shoulders/Triceps)', description: 'Upper body push muscles' },
  { name: 'Pull (Back/Biceps)', description: 'Upper body pull muscles' },
  { name: 'Legs & Glutes', description: 'Lower body strength' },
  { name: 'Yoga & Mobility', description: 'Flexibility and recovery' },
  { name: 'Core & Conditioning', description: 'Core strength and cardio' },
  { name: 'Full Body Strength', description: 'Compound full-body movements' },
  { name: 'Active Recovery / Rest', description: 'Light movement and stretching' },
];

// Day mapping: 0=Sun, 1=Mon, ... 6=Sat
const SLOT_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EXERCISES = {
  0: [ // Push
    { name: 'Bench Press', target_muscles: 'chest, shoulders, triceps', type: 'strength', default_sets: 4, default_reps: 10 },
    { name: 'Overhead Press', target_muscles: 'shoulders, triceps', type: 'strength', default_sets: 3, default_reps: 10 },
    { name: 'Incline Dumbbell Press', target_muscles: 'upper chest, shoulders', type: 'strength', default_sets: 3, default_reps: 12 },
    { name: 'Lateral Raises', target_muscles: 'lateral deltoids', type: 'strength', default_sets: 3, default_reps: 15 },
    { name: 'Tricep Dips', target_muscles: 'triceps, chest', type: 'strength', default_sets: 3, default_reps: 12 },
    { name: 'Cable Flyes', target_muscles: 'chest', type: 'strength', default_sets: 3, default_reps: 12 },
  ],
  1: [ // Pull
    { name: 'Deadlift', target_muscles: 'back, hamstrings, glutes', type: 'strength', default_sets: 4, default_reps: 6 },
    { name: 'Pull-ups', target_muscles: 'lats, biceps', type: 'strength', default_sets: 3, default_reps: 8 },
    { name: 'Barbell Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 10 },
    { name: 'Face Pulls', target_muscles: 'rear deltoids, upper back', type: 'strength', default_sets: 3, default_reps: 15 },
    { name: 'Bicep Curls', target_muscles: 'biceps', type: 'strength', default_sets: 3, default_reps: 12 },
    { name: 'Hammer Curls', target_muscles: 'biceps, forearms', type: 'strength', default_sets: 3, default_reps: 12 },
  ],
  2: [ // Legs
    { name: 'Barbell Squat', target_muscles: 'quads, glutes', type: 'strength', default_sets: 4, default_reps: 8 },
    { name: 'Romanian Deadlift', target_muscles: 'hamstrings, glutes', type: 'strength', default_sets: 3, default_reps: 10 },
    { name: 'Leg Press', target_muscles: 'quads, glutes', type: 'strength', default_sets: 3, default_reps: 12 },
    { name: 'Walking Lunges', target_muscles: 'quads, glutes', type: 'strength', default_sets: 3, default_reps: 12 },
    { name: 'Calf Raises', target_muscles: 'calves', type: 'strength', default_sets: 4, default_reps: 15 },
    { name: 'Hip Thrusts', target_muscles: 'glutes', type: 'strength', default_sets: 3, default_reps: 12 },
  ],
  3: [ // Yoga - placeholders (will be enriched from NotebookLM)
    { name: 'Sun Salutation A', sanskrit_name: 'Surya Namaskar A', target_muscles: 'full body', type: 'yoga', default_duration_secs: 300 },
    { name: 'Warrior I', sanskrit_name: 'Virabhadrasana I', target_muscles: 'legs, hips, shoulders', type: 'yoga', default_duration_secs: 60 },
    { name: 'Warrior II', sanskrit_name: 'Virabhadrasana II', target_muscles: 'legs, hips, arms', type: 'yoga', default_duration_secs: 60 },
    { name: 'Downward Dog', sanskrit_name: 'Adho Mukha Svanasana', target_muscles: 'hamstrings, shoulders, calves', type: 'yoga', default_duration_secs: 60 },
    { name: 'Tree Pose', sanskrit_name: 'Vrksasana', target_muscles: 'legs, core, balance', type: 'yoga', default_duration_secs: 60 },
    { name: 'Child\'s Pose', sanskrit_name: 'Balasana', target_muscles: 'back, hips', type: 'yoga', default_duration_secs: 90 },
  ],
  4: [ // Core
    { name: 'Plank', target_muscles: 'core', type: 'strength', default_sets: 3, default_duration_secs: 60 },
    { name: 'Russian Twists', target_muscles: 'obliques', type: 'strength', default_sets: 3, default_reps: 20 },
    { name: 'Hanging Leg Raises', target_muscles: 'lower abs', type: 'strength', default_sets: 3, default_reps: 12 },
    { name: 'Mountain Climbers', target_muscles: 'core, cardio', type: 'cardio', default_sets: 3, default_duration_secs: 45 },
    { name: 'Bicycle Crunches', target_muscles: 'abs, obliques', type: 'strength', default_sets: 3, default_reps: 20 },
    { name: 'Dead Bugs', target_muscles: 'core stability', type: 'strength', default_sets: 3, default_reps: 12 },
  ],
  5: [ // Full Body
    { name: 'Clean & Press', target_muscles: 'full body', type: 'strength', default_sets: 4, default_reps: 6 },
    { name: 'Front Squat', target_muscles: 'quads, core', type: 'strength', default_sets: 3, default_reps: 8 },
    { name: 'Bent-Over Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 10 },
    { name: 'Push-ups', target_muscles: 'chest, triceps', type: 'strength', default_sets: 3, default_reps: 15 },
    { name: 'Kettlebell Swings', target_muscles: 'posterior chain', type: 'strength', default_sets: 3, default_reps: 15 },
    { name: 'Farmers Walk', target_muscles: 'grip, core, full body', type: 'strength', default_sets: 3, default_duration_secs: 45 },
  ],
  6: [ // Active Recovery
    { name: 'Foam Rolling', target_muscles: 'full body', type: 'mobility', default_duration_secs: 600 },
    { name: 'Light Walk', target_muscles: 'cardio', type: 'cardio', default_duration_secs: 1800 },
    { name: 'Stretching Routine', target_muscles: 'full body', type: 'mobility', default_duration_secs: 900 },
  ],
};

async function seed() {
  console.log('Seeding database...');

  // Insert workouts
  const workoutIds = [];
  for (const w of WORKOUTS) {
    const result = await pool.query(
      'INSERT INTO workouts (name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [w.name, w.description]
    );
    if (result.rows.length > 0) {
      workoutIds.push(result.rows[0].id);
    }
  }

  if (workoutIds.length === 0) {
    console.log('Workouts already seeded, skipping.');
    await pool.end();
    return;
  }

  // Insert workout slots (Mon=1 -> workout[0], Tue=2 -> workout[1], etc.)
  const dayToWorkout = [6, 0, 1, 2, 3, 4, 5]; // Sun=Recovery, Mon=Push, Tue=Pull, ...
  for (let day = 0; day < 7; day++) {
    await pool.query(
      'INSERT INTO workout_slots (day_of_week, label, workout_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [day, SLOT_LABELS[day], workoutIds[dayToWorkout[day]]]
    );
  }

  // Insert exercises
  for (const [workoutIdx, exercises] of Object.entries(EXERCISES)) {
    const wid = workoutIds[Number(workoutIdx)];
    for (let i = 0; i < exercises.length; i++) {
      const e = exercises[i];
      await pool.query(
        `INSERT INTO exercises (workout_id, name, sanskrit_name, target_muscles, type, default_sets, default_reps, default_duration_secs, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [wid, e.name, e.sanskrit_name || null, e.target_muscles, e.type, e.default_sets || null, e.default_reps || null, e.default_duration_secs || null, i]
      );
    }
  }

  console.log('Seeding complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

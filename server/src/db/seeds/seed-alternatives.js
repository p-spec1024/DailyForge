import { pool } from '../pool.js';

/*
 * Seed slot_alternatives — 2-3 alternatives per default exercise.
 * Alternatives are inserted as new exercises in the exercises table,
 * then linked via slot_alternatives.
 *
 * Matching criteria: same primary muscle group, mixed difficulty/equipment.
 */

const ALTERNATIVES = {
  // === Push Day (workout index 0) ===
  'Bench Press': [
    { name: 'Dumbbell Bench Press', target_muscles: 'chest, shoulders, triceps', type: 'strength', default_sets: 4, default_reps: 10, difficulty: 'intermediate', description: 'Lie on a flat bench with a dumbbell in each hand. Press up and lower with control.' },
    { name: 'Push-ups', target_muscles: 'chest, triceps', type: 'strength', default_sets: 4, default_reps: 15, difficulty: 'beginner', description: 'Classic bodyweight chest exercise. Keep core tight, lower chest to floor.' },
    { name: 'Floor Press', target_muscles: 'chest, triceps', type: 'strength', default_sets: 4, default_reps: 10, difficulty: 'intermediate', description: 'Press from the floor to limit range of motion. Great for lockout strength.' },
  ],
  'Overhead Press': [
    { name: 'Dumbbell Shoulder Press', target_muscles: 'shoulders, triceps', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Seated or standing, press dumbbells overhead.' },
    { name: 'Arnold Press', target_muscles: 'shoulders, triceps', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Rotating dumbbell press that hits all three deltoid heads.' },
    { name: 'Pike Push-ups', target_muscles: 'shoulders, triceps', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Bodyweight shoulder press variation. Hips high, lower head toward floor.' },
  ],
  'Incline Dumbbell Press': [
    { name: 'Incline Barbell Press', target_muscles: 'upper chest, shoulders', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Barbell press on an incline bench targeting upper chest.' },
    { name: 'Landmine Press', target_muscles: 'upper chest, shoulders', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Single-arm press with barbell anchored at floor. Unique pressing angle.' },
  ],
  'Lateral Raises': [
    { name: 'Cable Lateral Raises', target_muscles: 'lateral deltoids', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'intermediate', description: 'Constant tension lateral raise using cable machine.' },
    { name: 'Band Lateral Raises', target_muscles: 'lateral deltoids', type: 'strength', default_sets: 3, default_reps: 20, difficulty: 'beginner', description: 'Resistance band lateral raises. Great for warm-up or high-rep finisher.' },
  ],
  'Tricep Dips': [
    { name: 'Close-grip Bench Press', target_muscles: 'triceps, chest', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Bench press with narrow grip to emphasize triceps.' },
    { name: 'Overhead Tricep Extension', target_muscles: 'triceps', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Hold dumbbell overhead with both hands, lower behind head.' },
    { name: 'Diamond Push-ups', target_muscles: 'triceps, chest', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Push-ups with hands close together forming a diamond shape.' },
  ],
  'Cable Flyes': [
    { name: 'Dumbbell Flyes', target_muscles: 'chest', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Lie flat on bench, arc dumbbells up from wide to together above chest.' },
    { name: 'Pec Deck Machine', target_muscles: 'chest', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Machine-based chest fly with fixed path of motion.' },
  ],

  // === Pull Day (workout index 1) ===
  'Deadlift': [
    { name: 'Trap Bar Deadlift', target_muscles: 'back, hamstrings, glutes', type: 'strength', default_sets: 4, default_reps: 6, difficulty: 'intermediate', description: 'Deadlift using hex/trap bar. More quad-friendly, easier on lower back.' },
    { name: 'Rack Pull', target_muscles: 'back, glutes', type: 'strength', default_sets: 4, default_reps: 6, difficulty: 'intermediate', description: 'Partial deadlift from knee height. Focuses on lockout and upper back.' },
    { name: 'Kettlebell Deadlift', target_muscles: 'back, hamstrings, glutes', type: 'strength', default_sets: 4, default_reps: 10, difficulty: 'beginner', description: 'Deadlift pattern with kettlebell between feet. Great for learning the hinge.' },
  ],
  'Pull-ups': [
    { name: 'Lat Pulldown', target_muscles: 'lats, biceps', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'beginner', description: 'Cable machine pulldown replicating pull-up motion with adjustable weight.' },
    { name: 'Chin-ups', target_muscles: 'lats, biceps', type: 'strength', default_sets: 3, default_reps: 8, difficulty: 'intermediate', description: 'Underhand grip pull-up. More bicep involvement than standard pull-ups.' },
    { name: 'Inverted Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Bodyweight row using a bar at waist height. Scalable by adjusting angle.' },
  ],
  'Barbell Rows': [
    { name: 'Dumbbell Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Single-arm row with knee on bench. Great for isolating each side.' },
    { name: 'Cable Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Seated cable row with V-handle. Constant tension throughout movement.' },
    { name: 'T-Bar Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Row with barbell anchored at one end. Targets mid-back thickness.' },
  ],
  'Face Pulls': [
    { name: 'Band Pull-Aparts', target_muscles: 'rear deltoids, upper back', type: 'strength', default_sets: 3, default_reps: 20, difficulty: 'beginner', description: 'Pull resistance band apart at shoulder height. Great for posture.' },
    { name: 'Reverse Flyes', target_muscles: 'rear deltoids, upper back', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'beginner', description: 'Bent-over dumbbell fly targeting rear delts.' },
  ],
  'Bicep Curls': [
    { name: 'Barbell Curls', target_muscles: 'biceps', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Standing barbell curl. Allows heavier loading than dumbbells.' },
    { name: 'Concentration Curls', target_muscles: 'biceps', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Seated single-arm curl with elbow braced on inner thigh.' },
  ],
  'Hammer Curls': [
    { name: 'Cable Rope Curls', target_muscles: 'biceps, forearms', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Neutral-grip curl using cable rope attachment.' },
    { name: 'Reverse Curls', target_muscles: 'forearms, biceps', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Overhand grip curl emphasizing brachioradialis and forearms.' },
  ],

  // === Legs Day (workout index 2) ===
  'Barbell Squat': [
    { name: 'Goblet Squat', target_muscles: 'quads, glutes', type: 'strength', default_sets: 4, default_reps: 12, difficulty: 'beginner', description: 'Hold dumbbell at chest, squat deep. Great for learning squat pattern.' },
    { name: 'Front Squat', target_muscles: 'quads, core', type: 'strength', default_sets: 4, default_reps: 8, difficulty: 'intermediate', description: 'Barbell racked on front of shoulders. More quad-dominant than back squat.' },
    { name: 'Bulgarian Split Squat', target_muscles: 'quads, glutes', type: 'strength', default_sets: 4, default_reps: 10, difficulty: 'intermediate', description: 'Single-leg squat with rear foot elevated on bench.' },
  ],
  'Romanian Deadlift': [
    { name: 'Stiff-Leg Deadlift', target_muscles: 'hamstrings, glutes', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Similar to RDL with slightly more knee lockout for deeper hamstring stretch.' },
    { name: 'Single-Leg RDL', target_muscles: 'hamstrings, glutes', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Unilateral hinge movement. Improves balance and addresses imbalances.' },
    { name: 'Lying Leg Curl', target_muscles: 'hamstrings', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Machine-based hamstring curl in prone position.' },
  ],
  'Leg Press': [
    { name: 'Hack Squat', target_muscles: 'quads, glutes', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Machine squat with back supported on angled pad.' },
    { name: 'Bodyweight Squats', target_muscles: 'quads, glutes', type: 'strength', default_sets: 3, default_reps: 20, difficulty: 'beginner', description: 'High-rep bodyweight squats for endurance and mobility.' },
  ],
  'Walking Lunges': [
    { name: 'Reverse Lunges', target_muscles: 'quads, glutes', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Step backward into lunge. Easier on knees than forward lunges.' },
    { name: 'Step-ups', target_muscles: 'quads, glutes', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Step onto a box or bench. Functional single-leg movement.' },
  ],
  'Calf Raises': [
    { name: 'Seated Calf Raises', target_muscles: 'calves', type: 'strength', default_sets: 4, default_reps: 15, difficulty: 'beginner', description: 'Seated version targeting the soleus muscle of the calf.' },
    { name: 'Single-Leg Calf Raises', target_muscles: 'calves', type: 'strength', default_sets: 4, default_reps: 12, difficulty: 'intermediate', description: 'Single-leg bodyweight calf raise on a step for full range of motion.' },
  ],
  'Hip Thrusts': [
    { name: 'Glute Bridges', target_muscles: 'glutes', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'beginner', description: 'Floor-based hip extension. Lower back stays on ground.' },
    { name: 'Cable Pull-Throughs', target_muscles: 'glutes, hamstrings', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Cable hinge movement targeting glutes with constant tension.' },
  ],

  // === Core Day (workout index 4) ===
  'Plank': [
    { name: 'Dead Bug Hold', target_muscles: 'core', type: 'strength', default_sets: 3, default_duration_secs: 45, difficulty: 'beginner', description: 'Lie on back, extend opposite arm and leg while keeping core braced.' },
    { name: 'Pallof Press', target_muscles: 'core', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Anti-rotation cable press. Trains core stability.' },
  ],
  'Russian Twists': [
    { name: 'Cable Woodchops', target_muscles: 'obliques', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'intermediate', description: 'Rotational cable movement from high to low or low to high.' },
    { name: 'Side Plank', target_muscles: 'obliques', type: 'strength', default_sets: 3, default_duration_secs: 30, difficulty: 'beginner', description: 'Lateral plank position targeting obliques and lateral core.' },
  ],
  'Hanging Leg Raises': [
    { name: 'Lying Leg Raises', target_muscles: 'lower abs', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'beginner', description: 'Lie flat, raise legs to vertical while keeping lower back pressed down.' },
    { name: 'Captain Chair Knee Raises', target_muscles: 'lower abs', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'intermediate', description: 'Support yourself on arm rests, raise knees toward chest.' },
  ],
  'Mountain Climbers': [
    { name: 'Burpees', target_muscles: 'core, cardio', type: 'cardio', default_sets: 3, default_duration_secs: 45, difficulty: 'intermediate', description: 'Full-body conditioning movement combining squat, push-up, and jump.' },
    { name: 'High Knees', target_muscles: 'core, cardio', type: 'cardio', default_sets: 3, default_duration_secs: 45, difficulty: 'beginner', description: 'Running in place with high knee drive. Great for cardio conditioning.' },
  ],
  'Bicycle Crunches': [
    { name: 'V-Ups', target_muscles: 'abs, obliques', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'intermediate', description: 'Simultaneously raise legs and torso to form a V shape.' },
    { name: 'Flutter Kicks', target_muscles: 'abs', type: 'strength', default_sets: 3, default_reps: 30, difficulty: 'beginner', description: 'Alternating leg kicks while lying flat. Continuous tension on lower abs.' },
  ],
  'Dead Bugs': [
    { name: 'Bird Dogs', target_muscles: 'core stability', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'On all fours, extend opposite arm and leg. Anti-rotation stability drill.' },
    { name: 'Ab Wheel Rollouts', target_muscles: 'core', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Roll wheel forward from knees, extend body, then pull back. Advanced core work.' },
  ],

  // === Full Body Day (workout index 5) ===
  'Clean & Press': [
    { name: 'Dumbbell Thrusters', target_muscles: 'full body', type: 'strength', default_sets: 4, default_reps: 8, difficulty: 'intermediate', description: 'Front squat into overhead press in one fluid motion.' },
    { name: 'Kettlebell Clean & Press', target_muscles: 'full body', type: 'strength', default_sets: 4, default_reps: 8, difficulty: 'intermediate', description: 'Single-arm clean to overhead press with kettlebell.' },
  ],
  'Front Squat': [
    { name: 'Zercher Squat', target_muscles: 'quads, core', type: 'strength', default_sets: 3, default_reps: 8, difficulty: 'intermediate', description: 'Barbell held in crook of elbows. Keeps torso very upright.' },
    { name: 'Goblet Squat', target_muscles: 'quads, core', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'beginner', description: 'Hold dumbbell at chest, squat deep. Great for mobility and control.' },
  ],
  'Bent-Over Rows': [
    { name: 'Dumbbell Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 10, difficulty: 'intermediate', description: 'Single-arm dumbbell row with knee and hand on bench.' },
    { name: 'Pendlay Rows', target_muscles: 'back, biceps', type: 'strength', default_sets: 3, default_reps: 8, difficulty: 'intermediate', description: 'Strict barbell row from floor each rep. Explosive concentric.' },
  ],
  'Push-ups': [
    { name: 'Dumbbell Bench Press', target_muscles: 'chest, triceps', type: 'strength', default_sets: 3, default_reps: 12, difficulty: 'intermediate', description: 'Flat bench press with dumbbells for greater range of motion.' },
    { name: 'Incline Push-ups', target_muscles: 'chest, triceps', type: 'strength', default_sets: 3, default_reps: 20, difficulty: 'beginner', description: 'Push-ups with hands elevated on bench. Easier progression.' },
  ],
  'Kettlebell Swings': [
    { name: 'Dumbbell Swings', target_muscles: 'posterior chain', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'beginner', description: 'Hip-hinge swing using a single dumbbell held with both hands.' },
    { name: 'Cable Pull-Throughs', target_muscles: 'posterior chain', type: 'strength', default_sets: 3, default_reps: 15, difficulty: 'intermediate', description: 'Cable-based hip hinge movement mimicking kettlebell swing.' },
  ],
  'Farmers Walk': [
    { name: 'Suitcase Carry', target_muscles: 'grip, core, full body', type: 'strength', default_sets: 3, default_duration_secs: 45, difficulty: 'intermediate', description: 'Single-arm carry. Challenges core anti-lateral flexion.' },
    { name: 'Overhead Carry', target_muscles: 'shoulders, core, full body', type: 'strength', default_sets: 3, default_duration_secs: 30, difficulty: 'intermediate', description: 'Walk with weight locked out overhead. Builds shoulder stability.' },
  ],
};

async function seedAlternatives() {
  console.log('Seeding slot alternatives...');

  // Get all existing exercises with their names
  const { rows: exercises } = await pool.query(
    `SELECT id, name, workout_id FROM exercises ORDER BY id`
  );
  const exerciseByName = {};
  for (const ex of exercises) {
    exerciseByName[ex.name] = ex;
  }

  let alternativesInserted = 0;

  for (const [defaultName, alternatives] of Object.entries(ALTERNATIVES)) {
    const defaultEx = exerciseByName[defaultName];
    if (!defaultEx) {
      console.log(`  Skipping "${defaultName}" — not found in exercises table`);
      continue;
    }

    for (const alt of alternatives) {
      // Insert alternative exercise (or find existing)
      let altEx = exerciseByName[alt.name];
      if (!altEx) {
        const result = await pool.query(
          `INSERT INTO exercises (workout_id, name, target_muscles, type, default_sets, default_reps, default_duration_secs, difficulty, description, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, -1)
           ON CONFLICT DO NOTHING
           RETURNING id, name, workout_id`,
          [defaultEx.workout_id, alt.name, alt.target_muscles, alt.type,
           alt.default_sets || null, alt.default_reps || null,
           alt.default_duration_secs || null, alt.difficulty || null,
           alt.description || null]
        );
        if (result.rows.length > 0) {
          altEx = result.rows[0];
          exerciseByName[alt.name] = altEx;
        } else {
          // Already exists, fetch it
          const existing = await pool.query(`SELECT id, name, workout_id FROM exercises WHERE name = $1`, [alt.name]);
          if (existing.rows.length > 0) {
            altEx = existing.rows[0];
            exerciseByName[alt.name] = altEx;
          } else {
            console.log(`  Could not insert or find "${alt.name}"`);
            continue;
          }
        }
      }

      // Link as alternative
      await pool.query(
        `INSERT INTO slot_alternatives (exercise_id, alternative_exercise_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [defaultEx.id, altEx.id]
      );
      alternativesInserted++;
    }
  }

  console.log(`Seeded ${alternativesInserted} slot alternatives.`);
  await pool.end();
}

seedAlternatives().catch((err) => {
  console.error('Seed alternatives failed:', err);
  process.exit(1);
});

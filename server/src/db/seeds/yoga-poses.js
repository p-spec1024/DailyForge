import 'dotenv/config';
import { pool } from '../pool.js';

// Yoga poses sourced from DailyForge Yoga Library (NotebookLM)
// Categories: standing poses, hip openers, chest openers, spinal twists, forward folds

const YOGA_POSES = [
  // === STANDING POSES ===
  { name: 'Mountain Pose', sanskrit_name: 'Tadasana', target_muscles: 'feet, plantar fascia, postural muscles', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Chair Pose', sanskrit_name: 'Utkatasana', target_muscles: 'quads, glutes, hamstrings, deltoids, erector spinae', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Standing Forward Bend', sanskrit_name: 'Uttanasana', target_muscles: 'hamstrings, spinal extensors, piriformis, calves', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Extended Hand-Toe Pose', sanskrit_name: 'Utthita Hasta Padangusthasana', target_muscles: 'hamstrings, hip flexors, quads, balance', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Extended Side Angle Pose', sanskrit_name: 'Utthita Parsvakonasana', target_muscles: 'obliques, quads, hamstrings, glutes', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Extended Triangle Pose', sanskrit_name: 'Utthita Trikonasana', target_muscles: 'glutes, obliques, piriformis, tensor fasciae latae', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Revolved Triangle Pose', sanskrit_name: 'Parivrtta Trikonasana', target_muscles: 'hamstrings, glutes, lats, quads', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Intense Side Stretch', sanskrit_name: 'Parsvottanasana', target_muscles: 'hamstrings, calves, glutes, erector spinae', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Wide-Stance Forward Bend', sanskrit_name: 'Prasarita Padottanasana', target_muscles: 'adductors, hamstrings, glutes, erector spinae', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Warrior III', sanskrit_name: 'Virabhadrasana III', target_muscles: 'glutes, hamstrings, calves, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Half Moon Pose', sanskrit_name: 'Ardha Chandrasana', target_muscles: 'glutes, obliques, balance, legs', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Eagle Pose', sanskrit_name: 'Garudasana', target_muscles: 'shoulders, hips, legs, balance', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'King of the Dancers Pose', sanskrit_name: 'Natarajasana', target_muscles: 'quads, hip flexors, shoulders, balance', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Squat Pose', sanskrit_name: 'Upavesasana', target_muscles: 'hips, pelvic floor, ankles, adductors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },

  // === HIP OPENERS ===
  { name: 'Bound Angle Pose', sanskrit_name: 'Baddha Konasana', target_muscles: 'adductors, hip external rotators, piriformis, gracilis', type: 'yoga', difficulty: 'beginner', default_duration_secs: 90 },
  { name: 'Seated Wide-Angle Pose', sanskrit_name: 'Upavistha Konasana', target_muscles: 'piriformis, hamstrings, adductors, calves', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'One-Legged Pigeon Pose', sanskrit_name: 'Eka Pada Rajakapotasana', target_muscles: 'piriformis, glutes, hip flexors, psoas', type: 'yoga', difficulty: 'advanced', default_duration_secs: 60 },
  { name: 'Reclining Hero Pose', sanskrit_name: 'Supta Virasana', target_muscles: 'hip flexors, quads, psoas, rectus abdominis', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },

  // === CHEST OPENERS ===
  { name: 'Camel Pose', sanskrit_name: 'Ustrasana', target_muscles: 'chest, hip flexors, quads, rectus abdominis, shoulders', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Fish Pose', sanskrit_name: 'Matsyasana', target_muscles: 'chest, neck, rectus abdominis, psoas', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Wheel Pose', sanskrit_name: 'Urdhva Dhanurasana', target_muscles: 'chest, shoulders, glutes, quads, spinal extensors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Bow Pose', sanskrit_name: 'Dhanurasana', target_muscles: 'chest, shoulders, glutes, hamstrings, spinal extensors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Bridge Pose', sanskrit_name: 'Setu Bandhasana', target_muscles: 'chest, glutes, hamstrings, quads, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Cobra Pose', sanskrit_name: 'Bhujangasana', target_muscles: 'chest, spinal extensors, glutes, triceps', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Upward-Facing Dog', sanskrit_name: 'Urdhva Mukha Svanasana', target_muscles: 'chest, spinal extensors, glutes, hip flexors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Four-Footed Tabletop', sanskrit_name: 'Chatus Pada Pitham', target_muscles: 'chest, glutes, hamstrings, spinal extensors, deltoids', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Upward Plank Pose', sanskrit_name: 'Purvottanasana', target_muscles: 'chest, shoulders, hamstrings, spinal extensors, glutes', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },

  // === SPINAL TWISTS ===
  { name: 'Revolved Side Angle Pose', sanskrit_name: 'Parivrtta Baddha Parsvakonasana', target_muscles: 'obliques, spinal rotators, hamstrings, quads, lats', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Half Lord of the Fishes', sanskrit_name: 'Ardha Matsyendrasana', target_muscles: 'obliques, spinal rotators, piriformis, glutes, erector spinae', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Belly Twist', sanskrit_name: 'Jathara Parivrtti', target_muscles: 'obliques, glutes, piriformis, intercostals, pectorals', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Revolved Head-to-Knee Pose', sanskrit_name: 'Parivrtta Janu Sirsasana', target_muscles: 'obliques, hamstrings, adductors, lats, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Sage Twist III', sanskrit_name: 'Marichyasana III', target_muscles: 'obliques, abdominal organs, spinal rotators', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Sage Bharadwaja Twist', sanskrit_name: 'Bharadwajasana', target_muscles: 'spinal rotators, obliques, shoulders', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Noose Pose', sanskrit_name: 'Pasasana', target_muscles: 'spinal rotators, legs, shoulders, deep core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },

  // === FORWARD FOLDS ===
  { name: 'Seated Forward Bend', sanskrit_name: 'Paschimottanasana', target_muscles: 'hamstrings, calves, erector spinae, glutes, lats', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Head-to-Knee Pose', sanskrit_name: 'Janu Sirsasana', target_muscles: 'hamstrings, calves, spinal extensors, lats', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Turtle Pose', sanskrit_name: 'Kurmasana', target_muscles: 'hamstrings, spinal extensors, rhomboids', type: 'yoga', difficulty: 'advanced', default_duration_secs: 45 },
  { name: 'Plow Pose', sanskrit_name: 'Halasana', target_muscles: 'hamstrings, calves, spinal extensors, trapezius', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Ear-to-Knee Pose', sanskrit_name: 'Karnapidasana', target_muscles: 'spinal extensors, glutes, hamstrings, calves, trapezius', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
];

async function seedYogaPoses() {
  console.log('Seeding yoga poses from NotebookLM Yoga Library...');

  // Find the Yoga & Mobility workout
  const workoutResult = await pool.query(
    "SELECT id FROM workouts WHERE name LIKE '%Yoga%' LIMIT 1"
  );

  if (workoutResult.rows.length === 0) {
    console.error('No Yoga workout found. Run the main seed first.');
    await pool.end();
    process.exit(1);
  }

  const workoutId = workoutResult.rows[0].id;

  // Get current max sort_order for this workout
  const maxOrder = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM exercises WHERE workout_id = $1',
    [workoutId]
  );
  let sortOrder = maxOrder.rows[0].max_order + 1;

  let inserted = 0;
  let skipped = 0;

  for (const pose of YOGA_POSES) {
    // Skip if already exists (by sanskrit name)
    const existing = await pool.query(
      'SELECT id FROM exercises WHERE sanskrit_name = $1 AND workout_id = $2',
      [pose.sanskrit_name, workoutId]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO exercises (workout_id, name, sanskrit_name, target_muscles, type, default_duration_secs, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [workoutId, pose.name, pose.sanskrit_name, pose.target_muscles, pose.type, pose.default_duration_secs, sortOrder++]
    );
    inserted++;
  }

  console.log(`Done: ${inserted} poses inserted, ${skipped} skipped (already exist).`);
  await pool.end();
}

seedYogaPoses().catch((err) => {
  console.error('Yoga seed failed:', err);
  process.exit(1);
});

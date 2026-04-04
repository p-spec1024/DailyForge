import 'dotenv/config';
import { pool } from '../pool.js';

// Complete yoga poses from DailyForge Yoga Library (NotebookLM)
// Sources: Light on Yoga (Iyengar), Yoga Anatomy (Kaminoff), The Heart of Yoga (Desikachar)

const YOGA_POSES = [
  // === INVERSIONS: Headstands ===
  { name: 'Supported Headstand I', sanskrit_name: 'Salamba Sirsasana I', target_muscles: 'core, shoulders, triceps, spinal extensors, neck', type: 'yoga', difficulty: 'advanced', default_duration_secs: 60 },
  { name: 'Supported Headstand II', sanskrit_name: 'Salamba Sirsasana II', target_muscles: 'core, shoulders, triceps, spinal extensors, neck', type: 'yoga', difficulty: 'advanced', default_duration_secs: 60 },
  { name: 'Supported Headstand III', sanskrit_name: 'Salamba Sirsasana III', target_muscles: 'core, shoulders, triceps, spinal extensors, neck', type: 'yoga', difficulty: 'advanced', default_duration_secs: 45 },
  { name: 'Bound Hands Headstand', sanskrit_name: 'Baddha Hasta Sirsasana', target_muscles: 'core, shoulders, neck stabilizers', type: 'yoga', difficulty: 'advanced', default_duration_secs: 45 },
  { name: 'Free Hands Headstand', sanskrit_name: 'Mukta Hasta Sirsasana', target_muscles: 'core, shoulders, neck, balance', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Side Headstand', sanskrit_name: 'Parsva Sirsasana', target_muscles: 'obliques, core, neck, shoulders', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Revolved One-Legged Headstand', sanskrit_name: 'Parivrttaikapada Sirsasana', target_muscles: 'obliques, core, spinal rotators, neck', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'One-Legged Headstand', sanskrit_name: 'Eka Pada Sirsasana', target_muscles: 'core, hip flexors, hamstrings, neck', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },

  // === INVERSIONS: Shoulderstands ===
  { name: 'Supported Shoulderstand', sanskrit_name: 'Salamba Sarvangasana', target_muscles: 'trapezius, triceps, neck, rhomboids, shoulders', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 120 },
  { name: 'Unsupported Shoulderstand', sanskrit_name: 'Niralamba Sarvangasana', target_muscles: 'core, quads, hamstrings, glutes, psoas', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Side Shoulderstand', sanskrit_name: 'Parsva Sarvangasana', target_muscles: 'obliques, core, trapezius, neck', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Side Plow Pose', sanskrit_name: 'Parsva Halasana', target_muscles: 'obliques, spinal extensors, hamstrings', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Reclining Angle Pose', sanskrit_name: 'Supta Konasana', target_muscles: 'hamstrings, adductors, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Inverted Pose', sanskrit_name: 'Viparita Karani', target_muscles: 'hamstrings, obliques, glutes, triceps', type: 'yoga', difficulty: 'beginner', default_duration_secs: 180 },

  // === INVERSIONS: Arm-Supported ===
  { name: 'Downward-Facing Dog', sanskrit_name: 'Adho Mukha Svanasana', target_muscles: 'hamstrings, calves, lats, deltoids, quads, triceps', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Handstand', sanskrit_name: 'Adho Mukha Vrksasana', target_muscles: 'glutes, core, triceps, deltoids, lats, spinal extensors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Forearm Stand', sanskrit_name: 'Pincha Mayurasana', target_muscles: 'deltoids, triceps, core, psoas, glutes, serratus anterior', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Scorpion Pose', sanskrit_name: 'Vrschikasana', target_muscles: 'quads, core, deltoids, triceps, psoas, spinal extensors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },

  // === ARM BALANCES ===
  { name: 'Crow Pose', sanskrit_name: 'Bakasana', target_muscles: 'psoas, triceps, deltoids, serratus anterior, pectorals, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Side Crow Pose', sanskrit_name: 'Parsva Bakasana', target_muscles: 'obliques, triceps, serratus anterior, spinal rotators, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Peacock Pose', sanskrit_name: 'Mayurasana', target_muscles: 'triceps, spinal extensors, glutes, hamstrings, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Eight-Angle Pose', sanskrit_name: 'Astavakrasana', target_muscles: 'adductors, triceps, pectorals, spinal rotators, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Firefly Pose', sanskrit_name: 'Tittibhasana', target_muscles: 'arms, wrists, core, hip flexors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Side Plank Pose', sanskrit_name: 'Vasisthasana', target_muscles: 'obliques, triceps, serratus anterior, glutes, quads', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Four-Limbed Staff Pose', sanskrit_name: 'Chaturanga Dandasana', target_muscles: 'triceps, serratus anterior, core, pectorals, quads, glutes', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Arm-Pressing Pose', sanskrit_name: 'Bhujapidasana', target_muscles: 'arms, wrists, core, hip flexors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'One Hand Arm Pose', sanskrit_name: 'Eka Hasta Bhujasana', target_muscles: 'arms, core, hip flexors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Cock Pose', sanskrit_name: 'Kukkutasana', target_muscles: 'arms, wrists, core', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Tremulous Pose', sanskrit_name: 'Lolasana', target_muscles: 'wrists, arms, core', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Scale Pose', sanskrit_name: 'Tolasana', target_muscles: 'wrists, arms, core', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Sage Kasyapa Pose', sanskrit_name: 'Kasyapasana', target_muscles: 'arms, core, balance', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Sage Visvamitra Pose', sanskrit_name: 'Visvamitrasana', target_muscles: 'arms, core, hamstrings, balance', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Sage Galava Pose', sanskrit_name: 'Galavasana', target_muscles: 'shoulders, triceps, core, hips', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Two-Legged Sage Koundinya Pose', sanskrit_name: 'Dwi Pada Koundinyasana', target_muscles: 'shoulders, triceps, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'One-Legged Sage Koundinya Pose', sanskrit_name: 'Eka Pada Koundinyasana', target_muscles: 'shoulders, arms, core, spinal rotators', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Swan Pose', sanskrit_name: 'Hamsasana', target_muscles: 'forearms, wrists, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Crocodile Pose (Dynamic)', sanskrit_name: 'Nakrasana', target_muscles: 'arms, wrists, core', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Partridge Pose', sanskrit_name: 'Chakorasana', target_muscles: 'arms, wrists, core, hips', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },

  // === SEATED POSES ===
  { name: 'Staff Pose', sanskrit_name: 'Dandasana', target_muscles: 'spinal extensors, hamstrings, calves', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Easy Pose', sanskrit_name: 'Sukhasana', target_muscles: 'spinal extensors, hip rotators, pelvic floor', type: 'yoga', difficulty: 'beginner', default_duration_secs: 120 },
  { name: 'Adept Pose', sanskrit_name: 'Siddhasana', target_muscles: 'spinal extensors, hip rotators, pelvic floor', type: 'yoga', difficulty: 'beginner', default_duration_secs: 120 },
  { name: 'Hero Pose', sanskrit_name: 'Virasana', target_muscles: 'quads, tibialis anterior, spinal extensors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Thunderbolt Pose', sanskrit_name: 'Vajrasana', target_muscles: 'quads, tibialis anterior, spinal extensors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Lotus Pose', sanskrit_name: 'Padmasana', target_muscles: 'hip external rotators, glutes, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 120 },
  { name: 'Bound Lotus Pose', sanskrit_name: 'Baddha Padmasana', target_muscles: 'shoulders, chest, arms, hip rotators', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Mountain Pose in Lotus', sanskrit_name: 'Parvatasana', target_muscles: 'lats, shoulders, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Cow-Faced Pose', sanskrit_name: 'Gomukhasana', target_muscles: 'triceps, lats, piriformis, glutes, hip rotators', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Full Boat Pose', sanskrit_name: 'Paripurna Navasana', target_muscles: 'core, psoas, hip flexors, quads, spinal extensors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Half Boat Pose', sanskrit_name: 'Ardha Navasana', target_muscles: 'core, lower back', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Lion Pose', sanskrit_name: 'Simhasana', target_muscles: 'jaw, tongue, neck, platysma, fingers', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Embryo in Womb Pose', sanskrit_name: 'Garbha Pindasana', target_muscles: 'core, hip flexors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'The Great Seal', sanskrit_name: 'Mahamudra', target_muscles: 'diaphragm, spinal extensors, hamstrings, pelvic floor', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Heron Pose', sanskrit_name: 'Krounchasana', target_muscles: 'hamstrings, quads, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },

  // === BACKBENDS (not already seeded) ===
  { name: 'Locust Pose', sanskrit_name: 'Salabhasana', target_muscles: 'spinal extensors, glutes, hamstrings, triceps', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Full Locust Pose', sanskrit_name: 'Viparita Salabhasana', target_muscles: 'quads, obliques, core, neck, spinal extensors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Crocodile Pose', sanskrit_name: 'Makarasana', target_muscles: 'spinal extensors, glutes, hamstrings', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Dove Pose', sanskrit_name: 'Kapotasana', target_muscles: 'spine, chest, diaphragm, hip flexors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'King of Pigeons Pose', sanskrit_name: 'Rajakapotasana', target_muscles: 'spinal extensors, neck, shoulders, chest, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Frog Pose', sanskrit_name: 'Bhekasana', target_muscles: 'quads, core, spinal extensors, shoulders', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Side Bow Pose', sanskrit_name: 'Parsva Dhanurasana', target_muscles: 'obliques, spinal extensors, quads, shoulders', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 20 },
  { name: 'Little Thunderbolt Pose', sanskrit_name: 'Laghuvajrasana', target_muscles: 'quads, spinal extensors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'One-Legged Upward Bow', sanskrit_name: 'Eka Pada Urdhva Dhanurasana', target_muscles: 'shoulders, triceps, core, glutes, quads', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Two-Legged Inverted Staff', sanskrit_name: 'Dwi Pada Viparita Dandasana', target_muscles: 'spine, chest, arms, shoulders', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Reverse Wheel Pose', sanskrit_name: 'Viparita Chakrasana', target_muscles: 'spine, obliques, arms, wrists', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Couch Pose', sanskrit_name: 'Paryankasana', target_muscles: 'quads, hip flexors, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Big Toe Bow Pose', sanskrit_name: 'Padangustha Dhanurasana', target_muscles: 'spine, core, thighs', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },

  // === SUPINE POSES ===
  { name: 'Corpse Pose', sanskrit_name: 'Savasana', target_muscles: 'full body relaxation', type: 'yoga', difficulty: 'beginner', default_duration_secs: 300 },
  { name: 'Wind-Relieving Pose', sanskrit_name: 'Apanasana', target_muscles: 'biceps, triceps, deltoids, core', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Leg Raises', sanskrit_name: 'Urdhva Prasarita Padasana', target_muscles: 'core, hip flexors, lumbar stabilizers', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Two-Legged Table', sanskrit_name: 'Dwi Pada Pitham', target_muscles: 'quads, hamstrings, glutes, deltoids', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Reclining Bound Angle', sanskrit_name: 'Supta Baddha Konasana', target_muscles: 'adductors, hip rotators, breathing', type: 'yoga', difficulty: 'beginner', default_duration_secs: 180 },
  { name: 'Reclining Big Toe Pose', sanskrit_name: 'Supta Padangusthasana', target_muscles: 'hamstrings, calves', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Reclining Vishnu Couch', sanskrit_name: 'Anantasana', target_muscles: 'calves, adductors, obliques, hamstrings', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Reclining Turtle Pose', sanskrit_name: 'Supta Kurmasana', target_muscles: 'glutes, piriformis, hamstrings, hip rotators', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },

  // === PRONE POSES ===
  { name: 'Cobra Pose II', sanskrit_name: 'Bhujangasana II', target_muscles: 'deep spinal extensors, chest, neck, shoulders', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Formidable Face Pose', sanskrit_name: 'Ganda Bherundasana', target_muscles: 'neck, shoulders, spinal extensors, core', type: 'yoga', difficulty: 'advanced', default_duration_secs: 10 },

  // === ADDITIONAL FORWARD BENDS ===
  { name: 'Big Toe Pose', sanskrit_name: 'Padangusthasana', target_muscles: 'hamstrings, calves, spinal extensors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Hand Under Foot Pose', sanskrit_name: 'Pada Hastasana', target_muscles: 'hamstrings, calves, spinal extensors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Three-Limbed Forward Bend', sanskrit_name: 'Triang Mukhaikapada Paschimottanasana', target_muscles: 'hamstrings, quads, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Half Bound Lotus Forward Bend', sanskrit_name: 'Ardha Baddha Padma Paschimottanasana', target_muscles: 'hamstrings, hip rotators, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Upward Facing Forward Bend', sanskrit_name: 'Urdhva Mukha Paschimottanasana', target_muscles: 'hamstrings, core, spinal extensors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Both Big Toe Pose', sanskrit_name: 'Ubhaya Padangusthasana', target_muscles: 'core, hamstrings, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },

  // === ADDITIONAL TWISTS ===
  { name: 'Full Lord of the Fishes', sanskrit_name: 'Paripurna Matsyendrasana', target_muscles: 'obliques, spinal rotators, shoulders, hips', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Revolved Seated Forward Bend', sanskrit_name: 'Parivrtta Paschimottanasana', target_muscles: 'obliques, hamstrings, spinal rotators', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },

  // === RESTORATIVE & MISCELLANEOUS ===
  { name: 'Gate-Latch Pose', sanskrit_name: 'Parighasana', target_muscles: 'lats, intercostals, obliques, adductors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Cat Pose', sanskrit_name: 'Cakravakasana', target_muscles: 'spinal flexors and extensors', type: 'yoga', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Garland Pose', sanskrit_name: 'Malasana', target_muscles: 'ankles, knees, hips, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Reclining Frog Pose', sanskrit_name: 'Supta Bhekasana', target_muscles: 'quads, ankles, knees, spinal extensors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },

  // === ADVANCED FLEXIBILITY ===
  { name: 'Monkey Pose', sanskrit_name: 'Hanumanasana', target_muscles: 'hamstrings, psoas, quads, hip flexors', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Center Splits', sanskrit_name: 'Samakonasana', target_muscles: 'adductors, inner thighs', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Yoga Sleep Pose', sanskrit_name: 'Yoganidrasana', target_muscles: 'hips, hamstrings, spine', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Root Pose', sanskrit_name: 'Kandasana', target_muscles: 'hips, knees, pelvic floor', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Root Lock Pose', sanskrit_name: 'Mulabandhasana', target_muscles: 'pelvic floor, deep hip rotators', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Bow to the Ear Pose', sanskrit_name: 'Akarna Dhanurasana', target_muscles: 'hamstrings, hip flexors, arms', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 20 },
  { name: 'Horse Pose', sanskrit_name: 'Vatayanasana', target_muscles: 'hips, knees, ankles, balance', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Sage Durvasa Pose', sanskrit_name: 'Durvasasana', target_muscles: 'hamstrings, glutes, balance', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Half Bound Lotus Standing Forward Bend', sanskrit_name: 'Ardha Baddha Padmottanasana', target_muscles: 'hamstrings, hip rotators, balance', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Upward Extended One Leg Pose', sanskrit_name: 'Urdhva Prasarita Ekapadasana', target_muscles: 'hamstrings, balance, hip flexors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 20 },
  { name: 'Yoga Seal Pose', sanskrit_name: 'Yoga Mudrasana', target_muscles: 'shoulders, chest, core', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Sage Marichi Pose I', sanskrit_name: 'Marichyasana I', target_muscles: 'shoulders, core, hamstrings', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Sage Marichi Pose II', sanskrit_name: 'Marichyasana II', target_muscles: 'shoulders, core, hip rotators', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Revolved Extended Side Angle', sanskrit_name: 'Parivrtta Parsvakonasana', target_muscles: 'obliques, quads, hamstrings, spinal rotators', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Cowherd Pose', sanskrit_name: 'Goraksasana', target_muscles: 'thighs, core, balance', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Reclining Thunderbolt Pose', sanskrit_name: 'Supta Vajrasana', target_muscles: 'quads, hip flexors, spinal extensors', type: 'yoga', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Sage Vamadeva Pose', sanskrit_name: 'Vamadevasana', target_muscles: 'hips, knees, spine', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Yogi Staff Pose', sanskrit_name: 'Yogadandasana', target_muscles: 'hips, knees, external rotators', type: 'yoga', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Two Legs Behind Head Pose', sanskrit_name: 'Dwi Pada Sirsasana', target_muscles: 'hips, hamstrings, spine', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Reclining Trivikrama Pose', sanskrit_name: 'Supta Trivikramasana', target_muscles: 'hamstrings, adductors, hips', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Circle Pose', sanskrit_name: 'Mandalasana', target_muscles: 'spine, core, obliques, arms', type: 'yoga', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Heavenly Spirits Pose', sanskrit_name: 'Valakhilyasana', target_muscles: 'spine, shoulders, neck, hips', type: 'yoga', difficulty: 'advanced', default_duration_secs: 15 },
];

async function seedYogaPosesFull() {
  console.log('Seeding complete yoga library from NotebookLM...');

  const workoutResult = await pool.query(
    "SELECT id FROM workouts WHERE name LIKE '%Yoga%' LIMIT 1"
  );

  if (workoutResult.rows.length === 0) {
    console.error('No Yoga workout found. Run the main seed first.');
    await pool.end();
    process.exit(1);
  }

  const workoutId = workoutResult.rows[0].id;

  const maxOrder = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM exercises WHERE workout_id = $1',
    [workoutId]
  );
  let sortOrder = maxOrder.rows[0].max_order + 1;

  let inserted = 0;
  let skipped = 0;

  for (const pose of YOGA_POSES) {
    // Skip if sanskrit name already exists for this workout
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

  console.log(`Done: ${inserted} new poses inserted, ${skipped} skipped (already exist).`);
  await pool.end();
}

seedYogaPosesFull().catch((err) => {
  console.error('Yoga full seed failed:', err);
  process.exit(1);
});

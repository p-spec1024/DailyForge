import 'dotenv/config';
import { pool } from '../pool.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const YOGA_API_URL = 'https://yoga-api-nzy4.onrender.com/v1/poses';
const YOGISM_URL =
  'https://priyangsubanerjee.github.io/yogism/all-poses.json';
const HF_URL =
  'https://huggingface.co/datasets/omergoshen/yoga_poses/raw/main/yoga_poses.json';

const FETCH_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a Sanskrit name for deduplication. */
function normSanskrit(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .trim()
    .replace(/[āàá]/g, 'a')
    .replace(/[īìí]/g, 'i')
    .replace(/[ūùú]/g, 'u')
    .replace(/[ṣśş]/g, 's')
    .replace(/(?<![bcdgkpt])sh/g, 's')
    .replace(/[ṇñ]/g, 'n')
    .replace(/[ṭ]/g, 't')
    .replace(/[ṃ]/g, 'm')
    .replace(/[ṛ]/g, 'r')
    .replace(/[ḥ]/g, 'h')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function mapDifficulty(level) {
  if (!level) return null;
  const l = level.toLowerCase().trim();
  if (l === 'beginner' || l === 'easy' || l === '1') return 'beginner';
  if (l === 'intermediate' || l === 'medium' || l === '2') return 'intermediate';
  if (l === 'advanced' || l === 'hard' || l === 'expert' || l === '3')
    return 'advanced';
  return null;
}

/** Map HF pose_type array to target_muscles string. */
function poseTypesToMuscles(types) {
  if (!types || !types.length) return null;
  const mapping = {
    Standing: 'quads, glutes, calves, core',
    'Forward Bend': 'hamstrings, calves, spinal extensors',
    'Back Bend': 'spinal extensors, chest, shoulders',
    Twist: 'obliques, spinal rotators, core',
    Seated: 'hip rotators, spinal extensors',
    Balancing: 'core, legs, balance',
    Supine: 'back, core',
    Prone: 'spinal extensors, glutes',
    'Arm Balance': 'arms, wrists, core, shoulders',
    'Arm Leg Support': 'arms, core, legs',
    Inversion: 'shoulders, core, arms',
    'Lateral Bend': 'obliques, intercostals, lats',
  };
  const muscles = new Set();
  for (const t of types) {
    const mapped = mapping[t.trim()];
    if (mapped) {
      for (const m of mapped.split(', ')) muscles.add(m);
    }
  }
  return muscles.size > 0 ? [...muscles].join(', ') : null;
}

// ---------------------------------------------------------------------------
// Built-in pose library (from DailyForge yoga research)
// These have the richest target_muscles + difficulty data.
// ---------------------------------------------------------------------------
const BUILTIN_POSES = [
  // === STANDING POSES ===
  { name: 'Mountain Pose', sanskrit_name: 'Tadasana', target_muscles: 'feet, plantar fascia, postural muscles', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Chair Pose', sanskrit_name: 'Utkatasana', target_muscles: 'quads, glutes, hamstrings, deltoids, erector spinae', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Standing Forward Bend', sanskrit_name: 'Uttanasana', target_muscles: 'hamstrings, spinal extensors, piriformis, calves', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Extended Hand-Toe Pose', sanskrit_name: 'Utthita Hasta Padangusthasana', target_muscles: 'hamstrings, hip flexors, quads, balance', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Extended Side Angle Pose', sanskrit_name: 'Utthita Parsvakonasana', target_muscles: 'obliques, quads, hamstrings, glutes', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Extended Triangle Pose', sanskrit_name: 'Utthita Trikonasana', target_muscles: 'glutes, obliques, piriformis, tensor fasciae latae', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Revolved Triangle Pose', sanskrit_name: 'Parivrtta Trikonasana', target_muscles: 'hamstrings, glutes, lats, quads', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Intense Side Stretch', sanskrit_name: 'Parsvottanasana', target_muscles: 'hamstrings, calves, glutes, erector spinae', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Wide-Stance Forward Bend', sanskrit_name: 'Prasarita Padottanasana', target_muscles: 'adductors, hamstrings, glutes, erector spinae', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Warrior III', sanskrit_name: 'Virabhadrasana III', target_muscles: 'glutes, hamstrings, calves, spinal extensors', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Half Moon Pose', sanskrit_name: 'Ardha Chandrasana', target_muscles: 'glutes, obliques, balance, legs', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Eagle Pose', sanskrit_name: 'Garudasana', target_muscles: 'shoulders, hips, legs, balance', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'King of the Dancers Pose', sanskrit_name: 'Natarajasana', target_muscles: 'quads, hip flexors, shoulders, balance', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Squat Pose', sanskrit_name: 'Upavesasana', target_muscles: 'hips, pelvic floor, ankles, adductors', difficulty: 'beginner', default_duration_secs: 60 },

  // === HIP OPENERS ===
  { name: 'Bound Angle Pose', sanskrit_name: 'Baddha Konasana', target_muscles: 'adductors, hip external rotators, piriformis, gracilis', difficulty: 'beginner', default_duration_secs: 90 },
  { name: 'Seated Wide-Angle Pose', sanskrit_name: 'Upavistha Konasana', target_muscles: 'piriformis, hamstrings, adductors, calves', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'One-Legged Pigeon Pose', sanskrit_name: 'Eka Pada Rajakapotasana', target_muscles: 'piriformis, glutes, hip flexors, psoas', difficulty: 'advanced', default_duration_secs: 60 },
  { name: 'Reclining Hero Pose', sanskrit_name: 'Supta Virasana', target_muscles: 'hip flexors, quads, psoas, rectus abdominis', difficulty: 'intermediate', default_duration_secs: 60 },

  // === CHEST OPENERS ===
  { name: 'Camel Pose', sanskrit_name: 'Ustrasana', target_muscles: 'chest, hip flexors, quads, rectus abdominis, shoulders', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Fish Pose', sanskrit_name: 'Matsyasana', target_muscles: 'chest, neck, rectus abdominis, psoas', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Wheel Pose', sanskrit_name: 'Urdhva Dhanurasana', target_muscles: 'chest, shoulders, glutes, quads, spinal extensors', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Bow Pose', sanskrit_name: 'Dhanurasana', target_muscles: 'chest, shoulders, glutes, hamstrings, spinal extensors', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Bridge Pose', sanskrit_name: 'Setu Bandhasana', target_muscles: 'chest, glutes, hamstrings, quads, spinal extensors', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Cobra Pose', sanskrit_name: 'Bhujangasana', target_muscles: 'chest, spinal extensors, glutes, triceps', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Upward-Facing Dog', sanskrit_name: 'Urdhva Mukha Svanasana', target_muscles: 'chest, spinal extensors, glutes, hip flexors', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Four-Footed Tabletop', sanskrit_name: 'Chatus Pada Pitham', target_muscles: 'chest, glutes, hamstrings, spinal extensors, deltoids', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Upward Plank Pose', sanskrit_name: 'Purvottanasana', target_muscles: 'chest, shoulders, hamstrings, spinal extensors, glutes', difficulty: 'intermediate', default_duration_secs: 30 },

  // === SPINAL TWISTS ===
  { name: 'Revolved Side Angle Pose', sanskrit_name: 'Parivrtta Baddha Parsvakonasana', target_muscles: 'obliques, spinal rotators, hamstrings, quads, lats', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Half Lord of the Fishes', sanskrit_name: 'Ardha Matsyendrasana', target_muscles: 'obliques, spinal rotators, piriformis, glutes, erector spinae', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Belly Twist', sanskrit_name: 'Jathara Parivrtti', target_muscles: 'obliques, glutes, piriformis, intercostals, pectorals', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Revolved Head-to-Knee Pose', sanskrit_name: 'Parivrtta Janu Sirsasana', target_muscles: 'obliques, hamstrings, adductors, lats, spinal extensors', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Sage Twist III', sanskrit_name: 'Marichyasana III', target_muscles: 'obliques, abdominal organs, spinal rotators', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Sage Bharadwaja Twist', sanskrit_name: 'Bharadwajasana', target_muscles: 'spinal rotators, obliques, shoulders', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Noose Pose', sanskrit_name: 'Pasasana', target_muscles: 'spinal rotators, legs, shoulders, deep core', difficulty: 'advanced', default_duration_secs: 30 },

  // === FORWARD FOLDS ===
  { name: 'Seated Forward Bend', sanskrit_name: 'Paschimottanasana', target_muscles: 'hamstrings, calves, erector spinae, glutes, lats', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Head-to-Knee Pose', sanskrit_name: 'Janu Sirsasana', target_muscles: 'hamstrings, calves, spinal extensors, lats', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Turtle Pose', sanskrit_name: 'Kurmasana', target_muscles: 'hamstrings, spinal extensors, rhomboids', difficulty: 'advanced', default_duration_secs: 45 },
  { name: 'Plow Pose', sanskrit_name: 'Halasana', target_muscles: 'hamstrings, calves, spinal extensors, trapezius', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Ear-to-Knee Pose', sanskrit_name: 'Karnapidasana', target_muscles: 'spinal extensors, glutes, hamstrings, calves, trapezius', difficulty: 'advanced', default_duration_secs: 30 },

  // === INVERSIONS: Headstands ===
  { name: 'Supported Headstand I', sanskrit_name: 'Salamba Sirsasana I', target_muscles: 'core, shoulders, triceps, spinal extensors, neck', difficulty: 'advanced', default_duration_secs: 60 },
  { name: 'Supported Headstand II', sanskrit_name: 'Salamba Sirsasana II', target_muscles: 'core, shoulders, triceps, spinal extensors, neck', difficulty: 'advanced', default_duration_secs: 60 },
  { name: 'Supported Headstand III', sanskrit_name: 'Salamba Sirsasana III', target_muscles: 'core, shoulders, triceps, spinal extensors, neck', difficulty: 'advanced', default_duration_secs: 45 },
  { name: 'Bound Hands Headstand', sanskrit_name: 'Baddha Hasta Sirsasana', target_muscles: 'core, shoulders, neck stabilizers', difficulty: 'advanced', default_duration_secs: 45 },
  { name: 'Free Hands Headstand', sanskrit_name: 'Mukta Hasta Sirsasana', target_muscles: 'core, shoulders, neck, balance', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Side Headstand', sanskrit_name: 'Parsva Sirsasana', target_muscles: 'obliques, core, neck, shoulders', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Revolved One-Legged Headstand', sanskrit_name: 'Parivrttaikapada Sirsasana', target_muscles: 'obliques, core, spinal rotators, neck', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'One-Legged Headstand', sanskrit_name: 'Eka Pada Sirsasana', target_muscles: 'core, hip flexors, hamstrings, neck', difficulty: 'advanced', default_duration_secs: 20 },

  // === INVERSIONS: Shoulderstands ===
  { name: 'Supported Shoulderstand', sanskrit_name: 'Salamba Sarvangasana', target_muscles: 'trapezius, triceps, neck, rhomboids, shoulders', difficulty: 'intermediate', default_duration_secs: 120 },
  { name: 'Unsupported Shoulderstand', sanskrit_name: 'Niralamba Sarvangasana', target_muscles: 'core, quads, hamstrings, glutes, psoas', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Side Shoulderstand', sanskrit_name: 'Parsva Sarvangasana', target_muscles: 'obliques, core, trapezius, neck', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Side Plow Pose', sanskrit_name: 'Parsva Halasana', target_muscles: 'obliques, spinal extensors, hamstrings', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Reclining Angle Pose', sanskrit_name: 'Supta Konasana', target_muscles: 'hamstrings, adductors, spinal extensors', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Inverted Pose', sanskrit_name: 'Viparita Karani', target_muscles: 'hamstrings, obliques, glutes, triceps', difficulty: 'beginner', default_duration_secs: 180 },

  // === INVERSIONS: Arm-Supported ===
  { name: 'Downward-Facing Dog', sanskrit_name: 'Adho Mukha Svanasana', target_muscles: 'hamstrings, calves, lats, deltoids, quads, triceps', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Handstand', sanskrit_name: 'Adho Mukha Vrksasana', target_muscles: 'glutes, core, triceps, deltoids, lats, spinal extensors', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Forearm Stand', sanskrit_name: 'Pincha Mayurasana', target_muscles: 'deltoids, triceps, core, psoas, glutes, serratus anterior', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Scorpion Pose', sanskrit_name: 'Vrschikasana', target_muscles: 'quads, core, deltoids, triceps, psoas, spinal extensors', difficulty: 'advanced', default_duration_secs: 20 },

  // === ARM BALANCES ===
  { name: 'Crow Pose', sanskrit_name: 'Bakasana', target_muscles: 'psoas, triceps, deltoids, serratus anterior, pectorals, core', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Side Crow Pose', sanskrit_name: 'Parsva Bakasana', target_muscles: 'obliques, triceps, serratus anterior, spinal rotators, core', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Peacock Pose', sanskrit_name: 'Mayurasana', target_muscles: 'triceps, spinal extensors, glutes, hamstrings, core', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Eight-Angle Pose', sanskrit_name: 'Astavakrasana', target_muscles: 'adductors, triceps, pectorals, spinal rotators, core', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Firefly Pose', sanskrit_name: 'Tittibhasana', target_muscles: 'arms, wrists, core, hip flexors', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Side Plank Pose', sanskrit_name: 'Vasisthasana', target_muscles: 'obliques, triceps, serratus anterior, glutes, quads', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Four-Limbed Staff Pose', sanskrit_name: 'Chaturanga Dandasana', target_muscles: 'triceps, serratus anterior, core, pectorals, quads, glutes', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Arm-Pressing Pose', sanskrit_name: 'Bhujapidasana', target_muscles: 'arms, wrists, core, hip flexors', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'One Hand Arm Pose', sanskrit_name: 'Eka Hasta Bhujasana', target_muscles: 'arms, core, hip flexors', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Cock Pose', sanskrit_name: 'Kukkutasana', target_muscles: 'arms, wrists, core', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Tremulous Pose', sanskrit_name: 'Lolasana', target_muscles: 'wrists, arms, core', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Scale Pose', sanskrit_name: 'Tolasana', target_muscles: 'wrists, arms, core', difficulty: 'intermediate', default_duration_secs: 15 },
  { name: 'Sage Kasyapa Pose', sanskrit_name: 'Kasyapasana', target_muscles: 'arms, core, balance', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Sage Visvamitra Pose', sanskrit_name: 'Visvamitrasana', target_muscles: 'arms, core, hamstrings, balance', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Sage Galava Pose', sanskrit_name: 'Galavasana', target_muscles: 'shoulders, triceps, core, hips', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Two-Legged Sage Koundinya Pose', sanskrit_name: 'Dwi Pada Koundinyasana', target_muscles: 'shoulders, triceps, core', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'One-Legged Sage Koundinya Pose', sanskrit_name: 'Eka Pada Koundinyasana', target_muscles: 'shoulders, arms, core, spinal rotators', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Swan Pose', sanskrit_name: 'Hamsasana', target_muscles: 'forearms, wrists, core', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Crocodile Pose (Dynamic)', sanskrit_name: 'Nakrasana', target_muscles: 'arms, wrists, core', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Partridge Pose', sanskrit_name: 'Chakorasana', target_muscles: 'arms, wrists, core, hips', difficulty: 'advanced', default_duration_secs: 15 },

  // === SEATED POSES ===
  { name: 'Staff Pose', sanskrit_name: 'Dandasana', target_muscles: 'spinal extensors, hamstrings, calves', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Easy Pose', sanskrit_name: 'Sukhasana', target_muscles: 'spinal extensors, hip rotators, pelvic floor', difficulty: 'beginner', default_duration_secs: 120 },
  { name: 'Adept Pose', sanskrit_name: 'Siddhasana', target_muscles: 'spinal extensors, hip rotators, pelvic floor', difficulty: 'beginner', default_duration_secs: 120 },
  { name: 'Hero Pose', sanskrit_name: 'Virasana', target_muscles: 'quads, tibialis anterior, spinal extensors', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Thunderbolt Pose', sanskrit_name: 'Vajrasana', target_muscles: 'quads, tibialis anterior, spinal extensors', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Lotus Pose', sanskrit_name: 'Padmasana', target_muscles: 'hip external rotators, glutes, spinal extensors', difficulty: 'intermediate', default_duration_secs: 120 },
  { name: 'Bound Lotus Pose', sanskrit_name: 'Baddha Padmasana', target_muscles: 'shoulders, chest, arms, hip rotators', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Mountain Pose in Lotus', sanskrit_name: 'Parvatasana', target_muscles: 'lats, shoulders, spinal extensors', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Cow-Faced Pose', sanskrit_name: 'Gomukhasana', target_muscles: 'triceps, lats, piriformis, glutes, hip rotators', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Full Boat Pose', sanskrit_name: 'Paripurna Navasana', target_muscles: 'core, psoas, hip flexors, quads, spinal extensors', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Half Boat Pose', sanskrit_name: 'Ardha Navasana', target_muscles: 'core, lower back', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Lion Pose', sanskrit_name: 'Simhasana', target_muscles: 'jaw, tongue, neck, platysma, fingers', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Embryo in Womb Pose', sanskrit_name: 'Garbha Pindasana', target_muscles: 'core, hip flexors', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'The Great Seal', sanskrit_name: 'Mahamudra', target_muscles: 'diaphragm, spinal extensors, hamstrings, pelvic floor', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Heron Pose', sanskrit_name: 'Krounchasana', target_muscles: 'hamstrings, quads, spinal extensors', difficulty: 'intermediate', default_duration_secs: 30 },

  // === BACKBENDS ===
  { name: 'Locust Pose', sanskrit_name: 'Salabhasana', target_muscles: 'spinal extensors, glutes, hamstrings, triceps', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Full Locust Pose', sanskrit_name: 'Viparita Salabhasana', target_muscles: 'quads, obliques, core, neck, spinal extensors', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Crocodile Pose', sanskrit_name: 'Makarasana', target_muscles: 'spinal extensors, glutes, hamstrings', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Dove Pose', sanskrit_name: 'Kapotasana', target_muscles: 'spine, chest, diaphragm, hip flexors', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'King of Pigeons Pose', sanskrit_name: 'Rajakapotasana', target_muscles: 'spinal extensors, neck, shoulders, chest, core', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Frog Pose', sanskrit_name: 'Bhekasana', target_muscles: 'quads, core, spinal extensors, shoulders', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Side Bow Pose', sanskrit_name: 'Parsva Dhanurasana', target_muscles: 'obliques, spinal extensors, quads, shoulders', difficulty: 'intermediate', default_duration_secs: 20 },
  { name: 'Little Thunderbolt Pose', sanskrit_name: 'Laghuvajrasana', target_muscles: 'quads, spinal extensors', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'One-Legged Upward Bow', sanskrit_name: 'Eka Pada Urdhva Dhanurasana', target_muscles: 'shoulders, triceps, core, glutes, quads', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Two-Legged Inverted Staff', sanskrit_name: 'Dwi Pada Viparita Dandasana', target_muscles: 'spine, chest, arms, shoulders', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Reverse Wheel Pose', sanskrit_name: 'Viparita Chakrasana', target_muscles: 'spine, obliques, arms, wrists', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Couch Pose', sanskrit_name: 'Paryankasana', target_muscles: 'quads, hip flexors, spinal extensors', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Big Toe Bow Pose', sanskrit_name: 'Padangustha Dhanurasana', target_muscles: 'spine, core, thighs', difficulty: 'advanced', default_duration_secs: 15 },

  // === SUPINE POSES ===
  { name: 'Corpse Pose', sanskrit_name: 'Savasana', target_muscles: 'full body relaxation', difficulty: 'beginner', default_duration_secs: 300 },
  { name: 'Wind-Relieving Pose', sanskrit_name: 'Apanasana', target_muscles: 'biceps, triceps, deltoids, core', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Leg Raises', sanskrit_name: 'Urdhva Prasarita Padasana', target_muscles: 'core, hip flexors, lumbar stabilizers', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Two-Legged Table', sanskrit_name: 'Dwi Pada Pitham', target_muscles: 'quads, hamstrings, glutes, deltoids', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Reclining Bound Angle', sanskrit_name: 'Supta Baddha Konasana', target_muscles: 'adductors, hip rotators, breathing', difficulty: 'beginner', default_duration_secs: 180 },
  { name: 'Reclining Big Toe Pose', sanskrit_name: 'Supta Padangusthasana', target_muscles: 'hamstrings, calves', difficulty: 'intermediate', default_duration_secs: 60 },
  { name: 'Reclining Vishnu Couch', sanskrit_name: 'Anantasana', target_muscles: 'calves, adductors, obliques, hamstrings', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Reclining Turtle Pose', sanskrit_name: 'Supta Kurmasana', target_muscles: 'glutes, piriformis, hamstrings, hip rotators', difficulty: 'advanced', default_duration_secs: 30 },

  // === PRONE POSES ===
  { name: 'Cobra Pose II', sanskrit_name: 'Bhujangasana II', target_muscles: 'deep spinal extensors, chest, neck, shoulders', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Formidable Face Pose', sanskrit_name: 'Ganda Bherundasana', target_muscles: 'neck, shoulders, spinal extensors, core', difficulty: 'advanced', default_duration_secs: 10 },

  // === ADDITIONAL FORWARD BENDS ===
  { name: 'Big Toe Pose', sanskrit_name: 'Padangusthasana', target_muscles: 'hamstrings, calves, spinal extensors', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Hand Under Foot Pose', sanskrit_name: 'Pada Hastasana', target_muscles: 'hamstrings, calves, spinal extensors', difficulty: 'beginner', default_duration_secs: 45 },
  { name: 'Three-Limbed Forward Bend', sanskrit_name: 'Triang Mukhaikapada Paschimottanasana', target_muscles: 'hamstrings, quads, spinal extensors', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Half Bound Lotus Forward Bend', sanskrit_name: 'Ardha Baddha Padma Paschimottanasana', target_muscles: 'hamstrings, hip rotators, spinal extensors', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Upward Facing Forward Bend', sanskrit_name: 'Urdhva Mukha Paschimottanasana', target_muscles: 'hamstrings, core, spinal extensors', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Both Big Toe Pose', sanskrit_name: 'Ubhaya Padangusthasana', target_muscles: 'core, hamstrings, spinal extensors', difficulty: 'intermediate', default_duration_secs: 30 },

  // === ADDITIONAL TWISTS ===
  { name: 'Full Lord of the Fishes', sanskrit_name: 'Paripurna Matsyendrasana', target_muscles: 'obliques, spinal rotators, shoulders, hips', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Revolved Seated Forward Bend', sanskrit_name: 'Parivrtta Paschimottanasana', target_muscles: 'obliques, hamstrings, spinal rotators', difficulty: 'advanced', default_duration_secs: 30 },

  // === RESTORATIVE & MISCELLANEOUS ===
  { name: 'Gate-Latch Pose', sanskrit_name: 'Parighasana', target_muscles: 'lats, intercostals, obliques, adductors', difficulty: 'beginner', default_duration_secs: 30 },
  { name: 'Cat Pose', sanskrit_name: 'Cakravakasana', target_muscles: 'spinal flexors and extensors', difficulty: 'beginner', default_duration_secs: 60 },
  { name: 'Garland Pose', sanskrit_name: 'Malasana', target_muscles: 'ankles, knees, hips, spinal extensors', difficulty: 'intermediate', default_duration_secs: 45 },
  { name: 'Reclining Frog Pose', sanskrit_name: 'Supta Bhekasana', target_muscles: 'quads, ankles, knees, spinal extensors', difficulty: 'advanced', default_duration_secs: 20 },

  // === ADVANCED FLEXIBILITY ===
  { name: 'Monkey Pose', sanskrit_name: 'Hanumanasana', target_muscles: 'hamstrings, psoas, quads, hip flexors', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Center Splits', sanskrit_name: 'Samakonasana', target_muscles: 'adductors, inner thighs', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Yoga Sleep Pose', sanskrit_name: 'Yoganidrasana', target_muscles: 'hips, hamstrings, spine', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Root Pose', sanskrit_name: 'Kandasana', target_muscles: 'hips, knees, pelvic floor', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Root Lock Pose', sanskrit_name: 'Mulabandhasana', target_muscles: 'pelvic floor, deep hip rotators', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Bow to the Ear Pose', sanskrit_name: 'Akarna Dhanurasana', target_muscles: 'hamstrings, hip flexors, arms', difficulty: 'intermediate', default_duration_secs: 20 },
  { name: 'Horse Pose', sanskrit_name: 'Vatayanasana', target_muscles: 'hips, knees, ankles, balance', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Sage Durvasa Pose', sanskrit_name: 'Durvasasana', target_muscles: 'hamstrings, glutes, balance', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Half Bound Lotus Standing Forward Bend', sanskrit_name: 'Ardha Baddha Padmottanasana', target_muscles: 'hamstrings, hip rotators, balance', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Upward Extended One Leg Pose', sanskrit_name: 'Urdhva Prasarita Ekapadasana', target_muscles: 'hamstrings, balance, hip flexors', difficulty: 'intermediate', default_duration_secs: 20 },
  { name: 'Yoga Seal Pose', sanskrit_name: 'Yoga Mudrasana', target_muscles: 'shoulders, chest, core', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Sage Marichi Pose I', sanskrit_name: 'Marichyasana I', target_muscles: 'shoulders, core, hamstrings', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Sage Marichi Pose II', sanskrit_name: 'Marichyasana II', target_muscles: 'shoulders, core, hip rotators', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Revolved Extended Side Angle', sanskrit_name: 'Parivrtta Parsvakonasana', target_muscles: 'obliques, quads, hamstrings, spinal rotators', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Cowherd Pose', sanskrit_name: 'Goraksasana', target_muscles: 'thighs, core, balance', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Reclining Thunderbolt Pose', sanskrit_name: 'Supta Vajrasana', target_muscles: 'quads, hip flexors, spinal extensors', difficulty: 'intermediate', default_duration_secs: 30 },
  { name: 'Sage Vamadeva Pose', sanskrit_name: 'Vamadevasana', target_muscles: 'hips, knees, spine', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Yogi Staff Pose', sanskrit_name: 'Yogadandasana', target_muscles: 'hips, knees, external rotators', difficulty: 'advanced', default_duration_secs: 20 },
  { name: 'Two Legs Behind Head Pose', sanskrit_name: 'Dwi Pada Sirsasana', target_muscles: 'hips, hamstrings, spine', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Reclining Trivikrama Pose', sanskrit_name: 'Supta Trivikramasana', target_muscles: 'hamstrings, adductors, hips', difficulty: 'advanced', default_duration_secs: 15 },
  { name: 'Circle Pose', sanskrit_name: 'Mandalasana', target_muscles: 'spine, core, obliques, arms', difficulty: 'advanced', default_duration_secs: 30 },
  { name: 'Heavenly Spirits Pose', sanskrit_name: 'Valakhilyasana', target_muscles: 'spine, shoulders, neck, hips', difficulty: 'advanced', default_duration_secs: 15 },
];

// ---------------------------------------------------------------------------
// Data source fetchers
// ---------------------------------------------------------------------------

async function fetchYogaApi() {
  console.log('Fetching from yoga-api (Render)...');
  try {
    const res = await fetch(YOGA_API_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.log(`  yoga-api returned ${res.status}, skipping.`);
      return [];
    }
    const data = await res.json();
    console.log(`  Loaded ${data.length} poses from yoga-api`);

    return data
      .filter((p) => p.english_name && p.sanskrit_name_adapted)
      .map((p) => ({
        name: p.english_name.trim().slice(0, 255),
        sanskrit_name: p.sanskrit_name_adapted.trim(),
        description: [p.pose_description, p.pose_benefits]
          .filter(Boolean)
          .join('\n\n'),
        target_muscles: null,
        difficulty: mapDifficulty(p.difficulty_level),
        source: 'yoga-api',
      }));
  } catch (err) {
    console.log(`  yoga-api fetch failed: ${err.message}. Skipping.`);
    return [];
  }
}

async function fetchYogism() {
  console.log('Fetching from Yogism (GitHub Pages)...');
  try {
    const res = await fetch(YOGISM_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.log(`  Yogism returned ${res.status}, skipping.`);
      return [];
    }
    const data = await res.json();
    console.log(`  Loaded ${data.length} poses from Yogism`);

    return data
      .filter((p) => p.english_name && p.sanskrit_name)
      .map((p) => {
        const descParts = [p.description, p.benefits, p.steps]
          .filter(Boolean)
          .join('\n\n');
        return {
          name: p.english_name.trim().slice(0, 255),
          sanskrit_name: p.sanskrit_name.trim(),
          description: descParts || null,
          target_muscles: p.target
            ? p.target.split(/[,.;]/).map((s) => s.trim().toLowerCase()).filter(Boolean).join(', ')
            : null,
          difficulty: mapDifficulty(p.category),
          source: 'yogism',
        };
      });
  } catch (err) {
    console.log(`  Yogism fetch failed: ${err.message}. Skipping.`);
    return [];
  }
}

async function fetchHuggingFace() {
  console.log('Fetching from Hugging Face dataset...');
  try {
    const res = await fetch(HF_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.log(`  HF returned ${res.status}, skipping.`);
      return [];
    }
    const data = await res.json();
    console.log(`  Loaded ${data.length} poses from Hugging Face`);

    return data
      .filter((p) => p.name && p.sanskrit_name && !p.sanskrit_name.startsWith('http'))
      .map((p) => ({
        name: p.name.trim().slice(0, 255),
        sanskrit_name: p.sanskrit_name.trim(),
        description: null,
        target_muscles: poseTypesToMuscles(p.pose_type),
        difficulty: mapDifficulty(p.expertise_level),
        source: 'huggingface',
      }));
  } catch (err) {
    console.log(`  HF fetch failed: ${err.message}. Skipping.`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Merge & Deduplicate
// ---------------------------------------------------------------------------

function mergeAllPoses(builtIn, yogaApiData, yogismData, hfData) {
  // Key: normalized sanskrit name → merged pose record
  const merged = new Map();

  // 1. Built-in poses first (richest data)
  for (const p of builtIn) {
    const key = normSanskrit(p.sanskrit_name);
    if (!key) continue;
    merged.set(key, {
      name: p.name,
      sanskrit_name: p.sanskrit_name,
      description: null,
      target_muscles: p.target_muscles,
      difficulty: p.difficulty,
      default_duration_secs: p.default_duration_secs || 30,
      source: 'dailyforge',
    });
  }

  // 2. yoga-api: add new poses or enrich descriptions
  for (const p of yogaApiData) {
    const key = normSanskrit(p.sanskrit_name);
    if (!key) continue;
    if (merged.has(key)) {
      const existing = merged.get(key);
      if (!existing.description && p.description) {
        existing.description = p.description;
      }
    } else {
      merged.set(key, { ...p, default_duration_secs: 30 });
    }
  }

  // 3. Yogism: add new poses or enrich descriptions/muscles
  for (const p of yogismData) {
    const key = normSanskrit(p.sanskrit_name);
    if (!key) continue;
    if (merged.has(key)) {
      const existing = merged.get(key);
      if (!existing.description && p.description) {
        existing.description = p.description;
      }
      if (!existing.target_muscles && p.target_muscles) {
        existing.target_muscles = p.target_muscles;
      }
    } else {
      merged.set(key, { ...p, default_duration_secs: 30 });
    }
  }

  // 4. Hugging Face: only add new poses not in other sources
  for (const p of hfData) {
    const key = normSanskrit(p.sanskrit_name);
    if (!key) continue;
    if (merged.has(key)) {
      const existing = merged.get(key);
      if (!existing.difficulty && p.difficulty) {
        existing.difficulty = p.difficulty;
      }
      if (!existing.target_muscles && p.target_muscles) {
        existing.target_muscles = p.target_muscles;
      }
    } else {
      merged.set(key, { ...p, default_duration_secs: 30 });
    }
  }

  return [...merged.values()];
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('=== Yoga Pose Library Seeding ===\n');

  // Fetch from all external sources in parallel
  const [yogaApiData, yogismData, hfData] = await Promise.all([
    fetchYogaApi(),
    fetchYogism(),
    fetchHuggingFace(),
  ]);

  const allPoses = mergeAllPoses(BUILTIN_POSES, yogaApiData, yogismData, hfData);

  // Count by source
  const sourceCounts = {};
  for (const p of allPoses) {
    sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
  }

  console.log(`\nMerge summary:`);
  console.log(`  Built-in:     ${BUILTIN_POSES.length}`);
  console.log(`  yoga-api:     ${yogaApiData.length}`);
  console.log(`  Yogism:       ${yogismData.length}`);
  console.log(`  Hugging Face: ${hfData.length}`);
  console.log(`  After dedup:  ${allPoses.length}`);
  console.log(`  By source:    ${JSON.stringify(sourceCounts)}\n`);

  // Insert in batches using ON CONFLICT for idempotency, wrapped in a transaction
  let inserted = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Duplicate cleanup (pre-seed) ---
    const dupes = await client.query(`
      SELECT sanskrit_name, COUNT(*) AS count
      FROM exercises
      WHERE type = 'yoga' AND sanskrit_name IS NOT NULL
      GROUP BY sanskrit_name
      HAVING COUNT(*) > 1
    `);

    if (dupes.rows.length > 0) {
      console.log(`Found ${dupes.rows.length} duplicate sanskrit_name groups, cleaning up...`);
      for (const row of dupes.rows) {
        console.log(`  "${row.sanskrit_name}" — ${row.count} copies`);
      }

      // For each duplicate group, pick the keeper (richest data, then lowest id),
      // reassign any FK references, then delete the rest
      for (const row of dupes.rows) {
        // Find the best row to keep
        const best = await client.query(`
          SELECT id FROM exercises
          WHERE type = 'yoga' AND sanskrit_name = $1
          ORDER BY
            COALESCE(LENGTH(description), 0) DESC,
            (target_muscles IS NOT NULL) DESC,
            id ASC
          LIMIT 1
        `, [row.sanskrit_name]);
        const keepId = best.rows[0].id;

        // Get IDs to delete
        const losers = await client.query(`
          SELECT id FROM exercises
          WHERE type = 'yoga' AND sanskrit_name = $1 AND id != $2
        `, [row.sanskrit_name, keepId]);
        const loserIds = losers.rows.map(r => r.id);

        if (loserIds.length === 0) continue;

        // Reassign FK references to the keeper
        await client.query(`
          UPDATE session_exercises SET exercise_id = $1
          WHERE exercise_id = ANY($2::int[])
        `, [keepId, loserIds]);

        // Now safe to delete
        await client.query(`
          DELETE FROM exercises
          WHERE id = ANY($1::int[])
        `, [loserIds]);
      }

      const afterCleanup = await client.query(`
        SELECT COUNT(*) AS removed FROM exercises
        WHERE type = 'yoga' AND sanskrit_name IS NOT NULL
      `);
      console.log(`  Cleanup complete. ${afterCleanup.rows[0].removed} yoga poses remain.\n`);
    } else {
      console.log('No existing duplicates found.\n');
    }

    // --- Unique index to prevent future duplicates ---
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_sanskrit_unique
      ON exercises (sanskrit_name)
      WHERE type = 'yoga' AND sanskrit_name IS NOT NULL
    `);

    for (let i = 0; i < allPoses.length; i += BATCH_SIZE) {
      const batch = allPoses.slice(i, i + BATCH_SIZE);

      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const p of batch) {
        values.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
        );
        params.push(
          p.name,
          p.sanskrit_name,
          p.target_muscles || null,
          p.description || null,
          p.difficulty || null,
          p.default_duration_secs || 30,
          'yoga',
          p.source,
        );
      }

      const result = await client.query(
        `INSERT INTO exercises
           (name, sanskrit_name, target_muscles, description, difficulty, default_duration_secs, type, source)
         VALUES ${values.join(', ')}
         ON CONFLICT DO NOTHING`,
        params,
      );

      inserted += result.rowCount;
      skipped += batch.length - result.rowCount;

      const progress = Math.min(i + BATCH_SIZE, allPoses.length);
      process.stdout.write(`\r  Progress: ${progress}/${allPoses.length}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Print final stats
  console.log(`\n\n=== Seeding Complete ===`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already existed): ${skipped}`);

  // Verification query
  const stats = await pool.query(`
    SELECT source, difficulty, COUNT(*) AS count
    FROM exercises
    WHERE type = 'yoga' AND workout_id IS NULL
    GROUP BY source, difficulty
    ORDER BY source, difficulty
  `);
  console.log(`\nVerification (library yoga poses by source & difficulty):`);
  for (const row of stats.rows) {
    console.log(`  ${row.source || 'null'}\t${row.difficulty || 'null'}\t${row.count}`);
  }

  const total = await pool.query(
    "SELECT COUNT(*) AS count FROM exercises WHERE type = 'yoga' AND workout_id IS NULL",
  );
  console.log(`\n  Total yoga library poses: ${total.rows[0].count}`);
}

seed()
  .catch((err) => {
    console.error('Yoga seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

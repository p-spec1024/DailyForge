import 'dotenv/config';
import { pool } from '../pool.js';

// ── 25 Phase Exercises ──
const PHASE_EXERCISES = [
  // WARM-UP (exercise_type: 'stretch')
  { name: 'Sun Salutation A', type: 'stretch', target_muscles: 'full body', difficulty: 'beginner', source: 'built_in', default_duration_secs: 180,
    description: 'A flowing sequence linking breath with movement. Start standing in Tadasana. Inhale sweep arms up (Urdhva Hastasana). Exhale fold forward (Uttanasana). Inhale halfway lift (Ardha Uttanasana). Exhale step or jump back to Chaturanga Dandasana. Inhale to Upward Facing Dog. Exhale to Downward Facing Dog — hold 5 breaths. Inhale step or jump feet to hands. Exhale fold. Inhale rise to standing. Exhale hands to heart.' },
  { name: 'Cat-Cow', type: 'stretch', target_muscles: 'core, back', difficulty: 'beginner', source: 'built_in', default_reps: 10,
    description: 'Start on all fours, wrists under shoulders, knees under hips. Inhale: drop belly toward floor, lift chest and tailbone (Cow). Exhale: round spine toward ceiling, tuck chin to chest, tuck tailbone (Cat). Move slowly with breath. Each inhale-exhale cycle is one rep.' },
  { name: "World's Greatest Stretch", type: 'stretch', target_muscles: 'legs, core, back', difficulty: 'intermediate', source: 'built_in', default_reps: 5,
    description: 'From a standing position, step right foot forward into a deep lunge. Place left hand on the floor inside the right foot. Rotate torso to the right, reaching right arm to the ceiling. Hold 2-3 breaths. Return hand to floor, straighten front leg for a hamstring stretch. Repeat other side.' },
  { name: 'Arm Circles', type: 'stretch', target_muscles: 'shoulders', difficulty: 'beginner', source: 'built_in', default_reps: 15,
    description: 'Stand with arms extended to the sides at shoulder height. Make small circles forward, gradually increasing size. After 15 circles, reverse direction. Keep core engaged and shoulders relaxed away from ears.' },
  { name: 'Hip Circles', type: 'stretch', target_muscles: 'legs, core', difficulty: 'beginner', source: 'built_in', default_reps: 10,
    description: 'Stand with feet hip-width apart, hands on hips. Make large circles with your hips clockwise — push hips forward, right, back, left. Keep upper body relatively stable. Complete all reps in one direction, then reverse.' },
  { name: 'Bodyweight Squats', type: 'stretch', target_muscles: 'legs', difficulty: 'beginner', source: 'built_in', default_reps: 15,
    description: 'Stand with feet shoulder-width apart, toes slightly out. Push hips back and bend knees to lower until thighs are parallel to floor. Keep chest up, weight in heels. Drive through heels to stand. Full range of motion.' },
  { name: 'High Knees', type: 'stretch', target_muscles: 'legs, core', difficulty: 'beginner', source: 'built_in', default_duration_secs: 30,
    description: 'Stand tall. Drive right knee up toward chest while hopping on left foot. Quickly switch — left knee up, hop on right. Pump arms opposite to legs. Keep core tight, land softly on balls of feet. Maintain fast pace.' },

  // COOL-DOWN (exercise_type: 'yoga' or 'stretch')
  { name: 'Downward Facing Dog', sanskrit_name: 'Adho Mukha Svanasana', type: 'yoga', target_muscles: 'shoulders, back, legs', difficulty: 'beginner', source: 'built_in', default_duration_secs: 30,
    description: 'From all fours, tuck toes and lift hips high toward ceiling. Press hands flat, fingers spread wide. Push chest toward thighs. Straighten legs without locking knees — slight bend is fine. Head relaxed between arms, ears in line with biceps. Press heels toward floor. Hold and breathe deeply.' },
  { name: 'Pigeon Pose', sanskrit_name: 'Eka Pada Rajakapotasana', type: 'yoga', target_muscles: 'legs, core', difficulty: 'intermediate', source: 'built_in', default_duration_secs: 45,
    description: 'From Downward Dog, bring right knee forward behind right wrist. Right foot angles toward left hip. Extend left leg straight back, top of foot on floor. Square hips toward front of mat. Walk hands forward slowly, lowering chest toward floor. Rest forehead on hands or mat. Hold and breathe deeply. Feel the deep stretch in right hip and glute. Repeat other side.' },
  { name: "Child's Pose", sanskrit_name: 'Balasana', type: 'yoga', target_muscles: 'back, core', difficulty: 'beginner', source: 'built_in', default_duration_secs: 60,
    description: 'Kneel on floor, big toes touching, knees apart. Sit hips back onto heels. Walk hands forward, lowering chest between thighs. Rest forehead on mat. Arms extended or alongside body. Let entire body release and relax. Breathe into the back body. This is a full relaxation pose.' },
  { name: 'Thread the Needle', type: 'stretch', target_muscles: 'back, shoulders', difficulty: 'beginner', source: 'built_in', default_duration_secs: 30,
    description: 'Start on all fours. Inhale and reach right arm to ceiling, opening chest to the right. Exhale and thread right arm under left arm, lowering right shoulder and temple to the floor. Left hand stays planted or walks forward for deeper stretch. Hold and breathe, feeling the twist through the thoracic spine. Repeat other side.' },
  { name: 'Seated Forward Fold', sanskrit_name: 'Paschimottanasana', type: 'yoga', target_muscles: 'legs, back', difficulty: 'beginner', source: 'built_in', default_duration_secs: 30,
    description: "Sit with legs extended straight in front. Flex feet, toes pointing up. Inhale and lengthen spine tall. Exhale and hinge from hips, reaching hands toward feet. Don't round the upper back — lead with the chest. Grab shins, ankles, or feet depending on flexibility. Hold and breathe, lengthening on each inhale, deepening on each exhale." },
  { name: 'Cobra Pose', sanskrit_name: 'Bhujangasana', type: 'yoga', target_muscles: 'back, core', difficulty: 'beginner', source: 'built_in', default_duration_secs: 20,
    description: "Lie face down, hands under shoulders, elbows close to body. Press tops of feet and thighs into floor. Inhale and straighten arms to lift chest off floor. Keep shoulders down and back, away from ears. Don't push too high — maintain a comfortable backbend. Hips stay on the floor. Hold and breathe." },
  { name: 'Standing Quad Stretch', type: 'stretch', target_muscles: 'legs', difficulty: 'beginner', source: 'built_in', default_duration_secs: 30,
    description: 'Stand on left leg. Bend right knee and grab right foot or ankle with right hand behind you. Pull heel toward glute. Keep knees close together and standing leg slightly bent. Push hips slightly forward to deepen the stretch. Hold a wall for balance if needed. Repeat other side.' },
  { name: 'Shoulder Cross-Body Stretch', type: 'stretch', target_muscles: 'shoulders', difficulty: 'beginner', source: 'built_in', default_duration_secs: 30,
    description: 'Bring right arm across chest at shoulder height. Use left hand to press right arm closer to chest just above the elbow. Keep right shoulder relaxed and down. Feel the stretch in the rear deltoid and upper back. Hold and breathe. Repeat other side.' },

  // BREATHWORK (exercise_type: 'breathwork')
  { name: 'Kapalabhati', type: 'breathwork', target_muscles: 'core', difficulty: 'intermediate', source: 'built_in', default_sets: 3, default_reps: 30,
    description: 'Sit tall with spine straight, hands on knees. Take a deep breath in. Exhale sharply and forcefully through the nose by contracting the abdomen quickly. Let the inhale happen passively — the belly naturally expands. Repeat rapidly: 30 exhalations per round. Rest 30 seconds between rounds, breathing normally. 3 rounds total. Keep chest and shoulders still — all movement is in the belly.' },
  { name: 'Bhastrika', type: 'breathwork', target_muscles: 'core', difficulty: 'intermediate', source: 'built_in', default_sets: 3, default_reps: 20,
    description: 'Sit in a comfortable position with spine erect. Begin with deep forceful inhales AND exhales through the nose — both active, unlike Kapalabhati. Arms can pump up on inhale, down on exhale for energy. Start slow (1 breath per second), build to faster pace. 20 breaths per round. Rest 30 seconds between rounds. 3 rounds total. Energizes the entire body.' },
  { name: 'Box Breathing', type: 'breathwork', target_muscles: 'core', difficulty: 'beginner', source: 'built_in', default_sets: 5,
    description: 'Sit comfortably with eyes closed. Inhale slowly through the nose for 4 counts. Hold breath in for 4 counts. Exhale slowly through the nose for 4 counts. Hold breath out for 4 counts. This completes one cycle. Repeat for 5 cycles. Keep the pace steady and even. Used by Navy SEALs for calm focus under pressure.' },
  { name: 'Anulom Vilom', type: 'breathwork', target_muscles: 'core', difficulty: 'beginner', source: 'built_in', default_sets: 10,
    description: 'Sit comfortably with spine tall. Use right hand: close right nostril with thumb. Inhale slowly through left nostril for 4 counts. Close left nostril with ring finger, release right nostril. Exhale through right nostril for 4 counts. Inhale through right nostril for 4 counts. Close right, release left. Exhale through left. This is one cycle. Complete 10 cycles.' },
  { name: 'Bhramari', type: 'breathwork', target_muscles: 'core', difficulty: 'beginner', source: 'built_in', default_sets: 5,
    description: 'Sit comfortably, spine tall. Close eyes. Place index fingers on the tragus cartilage of each ear (or just in front of ear canal). Inhale deeply through the nose. Exhale slowly while making a steady humming sound like a bee. Feel the vibration in your head and chest. The exhale should be long and controlled. Complete 5 rounds. Deeply calming for the nervous system.' },
  { name: 'Nadi Shodhana', type: 'breathwork', target_muscles: 'core', difficulty: 'advanced', source: 'built_in', default_sets: 10,
    description: 'Like Anulom Vilom but with breath retention. Close right nostril with thumb. Inhale through left for 4 counts. Close both nostrils — hold for 4 counts. Release right nostril, exhale for 4 counts. Inhale right for 4 counts. Close both — hold for 4 counts. Release left, exhale for 4 counts. One cycle complete. 10 cycles. More advanced than Anulom Vilom due to the retention phase.' },
  { name: 'Wim Hof Method', type: 'breathwork', target_muscles: 'core', difficulty: 'advanced', source: 'built_in', default_sets: 3,
    description: "Sit or lie in a comfortable position. Take 30 deep breaths: inhale fully through nose or mouth (fill belly then chest), exhale naturally (don't force it out). After 30 breaths: exhale and hold — don't breathe in. Hold until you feel the urge to breathe (typically 1-2 minutes). When you must breathe: inhale fully and hold for 15 seconds. Release. This is one round. Complete 3-4 rounds. SAFETY: Always practice lying down. Never in water. Never while driving. Stop if dizzy." },
  { name: 'Ujjayi', type: 'breathwork', target_muscles: 'core', difficulty: 'intermediate', source: 'built_in', default_duration_secs: 300,
    description: 'Breathe in and out through the nose with a slight constriction at the back of the throat — like fogging a mirror but with mouth closed. Creates an audible whisper or ocean-like sound. Inhale and exhale should be equal length. Maintain throughout yoga flow practice. Helps regulate breath rhythm, builds internal heat, and improves focus.' },
  { name: 'Diaphragmatic Breathing', type: 'breathwork', target_muscles: 'core', difficulty: 'beginner', source: 'built_in', default_duration_secs: 300,
    description: 'Sit or stand with good posture. Place one hand on chest, one on belly. Inhale through nose: belly expands outward (hand rises), chest stays relatively still. Exhale through nose or mouth: belly draws inward. During heavy lifts: inhale at the easy phase, brace core and exhale through the effort phase. Strengthens breathing mechanics and core stability.' },
  { name: 'Silent Sit', type: 'breathwork', target_muscles: 'core', difficulty: 'beginner', source: 'built_in', default_duration_secs: 60,
    description: 'Sit in any comfortable position — cross-legged, on a chair, or in half-lotus. Close eyes. Hands on knees or in lap. Breathe naturally without controlling the breath. Simply observe the breath and body. If thoughts arise, let them pass without engaging. Sit for 1 minute at end of practice. This brief meditation seals the breathwork and cools the mind.' },
];

// ── Phase assignments per day ──
// day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// Spec mapping: Sun=Active Recovery, Mon=Push, Tue=Pull, Wed=Legs, Thu=Yoga, Fri=Core, Sat=Full Body

const PHASE_PLANS = {
  // MONDAY (Push)
  1: {
    opening_breathwork: ['Kapalabhati'],
    warmup: ['Sun Salutation A', 'Cat-Cow', "World's Greatest Stretch", 'Arm Circles', 'Hip Circles'],
    cooldown: ['Downward Facing Dog', 'Pigeon Pose', "Child's Pose", 'Thread the Needle', 'Cobra Pose', 'Shoulder Cross-Body Stretch'],
    closing_breathwork: ['Anulom Vilom', 'Silent Sit'],
  },
  // TUESDAY (Pull)
  2: {
    opening_breathwork: ['Box Breathing'],
    warmup: ['Sun Salutation A', 'Cat-Cow', "World's Greatest Stretch", 'Arm Circles', 'Hip Circles', 'High Knees'],
    cooldown: ['Downward Facing Dog', 'Pigeon Pose', "Child's Pose", 'Seated Forward Fold', 'Standing Quad Stretch'],
    closing_breathwork: ['Bhramari', 'Silent Sit'],
  },
  // WEDNESDAY (Legs)
  3: {
    opening_breathwork: ['Kapalabhati'],
    warmup: ['Sun Salutation A', 'Cat-Cow', "World's Greatest Stretch", 'Hip Circles', 'Bodyweight Squats'],
    cooldown: ['Downward Facing Dog', 'Pigeon Pose', "Child's Pose", 'Seated Forward Fold', 'Standing Quad Stretch', 'Cobra Pose'],
    closing_breathwork: ['Anulom Vilom', 'Silent Sit'],
  },
  // THURSDAY (Yoga)
  4: {
    opening_breathwork: ['Kapalabhati'],
    warmup: ['Sun Salutation A', 'Cat-Cow', "World's Greatest Stretch", 'Arm Circles', 'Hip Circles'],
    cooldown: ['Downward Facing Dog', 'Thread the Needle', "Child's Pose", 'Cobra Pose', 'Shoulder Cross-Body Stretch'],
    closing_breathwork: ['Anulom Vilom', 'Silent Sit'],
  },
  // FRIDAY (Core)
  5: {
    opening_breathwork: ['Wim Hof Method'],
    warmup: ['Sun Salutation A', 'Cat-Cow', "World's Greatest Stretch", 'Hip Circles', 'High Knees'],
    cooldown: ['Downward Facing Dog', 'Pigeon Pose', "Child's Pose", 'Seated Forward Fold', 'Standing Quad Stretch'],
    closing_breathwork: ['Anulom Vilom', 'Silent Sit'],
  },
  // SATURDAY (Full Body)
  6: {
    opening_breathwork: ['Bhastrika'],
    warmup: ['Sun Salutation A', 'Cat-Cow', "World's Greatest Stretch", 'Arm Circles', 'Hip Circles', 'Bodyweight Squats'],
    cooldown: ['Downward Facing Dog', 'Pigeon Pose', "Child's Pose", 'Thread the Needle', 'Seated Forward Fold', 'Cobra Pose', 'Shoulder Cross-Body Stretch', 'Standing Quad Stretch'],
    closing_breathwork: ['Nadi Shodhana', 'Silent Sit'],
  },
  // SUNDAY (Active Recovery)
  0: {
    opening_breathwork: ['Nadi Shodhana'],
    warmup: ['Sun Salutation A', 'Cat-Cow', 'Hip Circles'],
    cooldown: ['Downward Facing Dog', 'Pigeon Pose', "Child's Pose", 'Thread the Needle', 'Seated Forward Fold', 'Cobra Pose'],
    closing_breathwork: ['Wim Hof Method', 'Bhramari', 'Silent Sit'],
  },
};

const SLOT_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function seedPhases() {
  console.log('Seeding phase exercises and workout slots...');

  // 1. Insert all phase exercises (idempotent — skip if name+source already exists)
  const exerciseIdMap = {}; // name -> id
  for (const ex of PHASE_EXERCISES) {
    const existing = await pool.query(
      "SELECT id FROM exercises WHERE name = $1 AND source = 'built_in' LIMIT 1",
      [ex.name]
    );
    if (existing.rows.length > 0) {
      exerciseIdMap[ex.name] = existing.rows[0].id;
      continue;
    }
    // Insert without workout_id first (we'll link via phase workouts)
    const result = await pool.query(
      `INSERT INTO exercises (name, sanskrit_name, target_muscles, type, difficulty, source, description,
        default_sets, default_reps, default_duration_secs, sort_order, workout_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, NULL)
       RETURNING id`,
      [ex.name, ex.sanskrit_name || null, ex.target_muscles, ex.type, ex.difficulty, ex.source,
       ex.description, ex.default_sets || null, ex.default_reps || null, ex.default_duration_secs || null]
    );
    exerciseIdMap[ex.name] = result.rows[0].id;
  }
  console.log(`  Phase exercises ready: ${Object.keys(exerciseIdMap).length} exercises`);

  // 2. For each day, create phase workouts + workout_slots
  for (const [dayStr, phases] of Object.entries(PHASE_PLANS)) {
    const day = Number(dayStr);
    const dayLabel = SLOT_LABELS[day];

    for (const [phase, exerciseNames] of Object.entries(phases)) {
      const workoutName = `${dayLabel} ${phase.replace(/_/g, ' ')}`;

      // Check if workout_slot already exists for this day+phase
      const existingSlot = await pool.query(
        'SELECT id FROM workout_slots WHERE day_of_week = $1 AND phase = $2',
        [day, phase]
      );
      if (existingSlot.rows.length > 0) {
        continue; // Already seeded
      }

      // Create a workout for this phase-day combo
      let workoutResult = await pool.query(
        'SELECT id FROM workouts WHERE name = $1',
        [workoutName]
      );
      let workoutId;
      if (workoutResult.rows.length > 0) {
        workoutId = workoutResult.rows[0].id;
      } else {
        workoutResult = await pool.query(
          'INSERT INTO workouts (name, description) VALUES ($1, $2) RETURNING id',
          [workoutName, `${phase.replace(/_/g, ' ')} phase for ${dayLabel}`]
        );
        workoutId = workoutResult.rows[0].id;
      }

      // Link exercises to this workout
      for (let i = 0; i < exerciseNames.length; i++) {
        const exName = exerciseNames[i];
        const exId = exerciseIdMap[exName];
        if (!exId) {
          console.warn(`  WARNING: Exercise "${exName}" not found in map`);
          continue;
        }
        // Check if already linked
        const linked = await pool.query(
          'SELECT id FROM exercises WHERE id = $1 AND workout_id = $2',
          [exId, workoutId]
        );
        if (linked.rows.length === 0) {
          // Create a copy of the exercise for this workout (so each phase has its own)
          const srcEx = PHASE_EXERCISES.find(e => e.name === exName);
          await pool.query(
            `INSERT INTO exercises (workout_id, name, sanskrit_name, target_muscles, type, difficulty, source,
              description, default_sets, default_reps, default_duration_secs, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [workoutId, srcEx.name, srcEx.sanskrit_name || null, srcEx.target_muscles, srcEx.type,
             srcEx.difficulty, srcEx.source, srcEx.description,
             srcEx.default_sets || null, srcEx.default_reps || null, srcEx.default_duration_secs || null, i]
          );
        }
      }

      // Create workout_slot
      await pool.query(
        'INSERT INTO workout_slots (day_of_week, label, workout_id, phase) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [day, dayLabel, workoutId, phase]
      );
    }
    console.log(`  ${dayLabel}: all phases seeded`);
  }

  console.log('Phase seeding complete.');
  await pool.end();
}

seedPhases().catch((err) => {
  console.error('Phase seed failed:', err);
  process.exit(1);
});

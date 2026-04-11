/**
 * Seed yoga pose categories into the exercises table.
 * Idempotent — safe to re-run. Only updates yoga exercises.
 *
 * Categories: warmup, standing, peak, floor, cooldown, savasana, flow
 */
import { pool } from '../src/db/pool.js';

// Keywords mapped to categories (checked against lowercase pose name)
const CATEGORY_RULES = [
  // savasana first — most specific
  {
    category: 'savasana',
    keywords: ['corpse', 'savasana'],
  },
  // flow sequences
  {
    category: 'flow',
    keywords: [
      'sun salutation', 'moon salutation', 'surya namaskar', 'chandra namaskar',
      'vinyasa flow', 'salutation',
    ],
  },
  // warmup — dynamic, activating, opening
  {
    category: 'warmup',
    keywords: [
      'cat-cow', 'cat cow', 'marjaryasana', 'bitilasana',
      'neck roll', 'shoulder roll', 'arm circle', 'wrist circle',
      'tabletop', 'mountain pose', 'tadasana',
      'standing forward fold', 'uttanasana',
      'low lunge', 'anjaneyasana',
      'world\'s greatest stretch', 'downward dog', 'adho mukha', 'down dog',
      'puppy pose', 'ragdoll', 'easy pose', 'sukhasana',
      'staff pose', 'dandasana', 'child\'s pose variation',
      'dynamic', 'warm up', 'warm-up',
    ],
  },
  // cooldown — restorative, gentle, static holds
  {
    category: 'cooldown',
    keywords: [
      'child\'s pose', 'balasana',
      'supine twist', 'reclining twist', 'jathara',
      'legs up', 'viparita karani',
      'reclined bound angle', 'supta baddha', 'reclining bound',
      'happy baby', 'ananda balasana',
      'reclined pigeon', 'supine pigeon', 'thread the needle',
      'reclining hero', 'supta virasana',
      'supported bridge', 'restorative',
      'reclined hand to big toe', 'supta padangusthasana',
      'knees to chest', 'apanasana', 'wind removing',
      'reclining', 'supine',
    ],
  },
  // standing poses
  {
    category: 'standing',
    keywords: [
      'warrior', 'virabhadrasana',
      'tree pose', 'vrksasana',
      'triangle', 'trikonasana',
      'half moon', 'ardha chandrasana',
      'chair pose', 'utkatasana',
      'eagle', 'garudasana',
      'dancer', 'natarajasana',
      'extended side angle', 'utthita parsvakonasana',
      'revolved', 'parivrtta',
      'crescent lunge', 'high lunge',
      'pyramid', 'parsvottanasana',
      'wide-legged forward', 'prasarita',
      'standing split', 'urdhva prasarita',
      'goddess', 'utkata konasana',
      'standing hand to big toe', 'utthita hasta',
      'side plank', 'vasisthasana',
    ],
  },
  // peak — challenging, backbends, inversions, arm balances
  {
    category: 'peak',
    keywords: [
      'crow', 'bakasana', 'crane',
      'headstand', 'sirsasana',
      'handstand', 'adho mukha vrksasana',
      'forearm stand', 'pincha mayurasana',
      'wheel', 'urdhva dhanurasana', 'full wheel',
      'king pigeon', 'eka pada rajakapotasana',
      'firefly', 'tittibhasana',
      'scorpion', 'vrschikasana',
      'peacock', 'mayurasana',
      'eight-angle', 'astavakrasana',
      'flying', 'arm balance', 'arm-pressing',
      'camel', 'ustrasana',
      'bow', 'dhanurasana',
      'upward bow', 'wild thing', 'flip dog',
      'compass', 'parivrtta surya yantrasana',
      'inversion', 'shoulderstand', 'shoulder stand', 'sarvangasana',
      'plow', 'halasana',
      'bridge', 'setu bandha',
      'upward facing dog', 'urdhva mukha',
      'cobra', 'bhujangasana',
      'locust', 'salabhasana',
      'plank', 'chaturanga',
    ],
  },
  // floor — seated, supine, twists, hip openers
  {
    category: 'floor',
    keywords: [
      'pigeon', 'kapotasana', 'eka pada',
      'seated forward', 'paschimottanasana',
      'boat', 'navasana',
      'bound angle', 'baddha konasana', 'butterfly',
      'fire log', 'agnistambhasana',
      'hero', 'virasana',
      'lotus', 'padmasana',
      'head to knee', 'janu sirsasana',
      'seated twist', 'ardha matsyendrasana', 'marichyasana',
      'cow face', 'gomukhasana',
      'wide angle seated', 'upavistha konasana',
      'half lord of the fishes',
      'heron', 'krounchasana',
      'compass pose',
      'garland', 'malasana', 'squat',
      'gate pose', 'parighasana',
      'seated',
    ],
  },
];

async function seedCategories() {
  console.log('Fetching yoga exercises...');
  const { rows } = await pool.query(
    `SELECT id, name FROM exercises WHERE type = 'yoga'`
  );
  console.log(`Found ${rows.length} yoga exercises`);

  const updates = [];
  const uncategorized = [];

  for (const exercise of rows) {
    const nameLower = exercise.name.toLowerCase();
    let matched = false;

    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some(k => nameLower.includes(k))) {
        updates.push({ id: exercise.id, category: rule.category, name: exercise.name });
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Default: if name contains standing-ish words, standing; else floor
      if (nameLower.includes('standing') || nameLower.includes('pose')) {
        updates.push({ id: exercise.id, category: 'standing', name: exercise.name });
      } else {
        // Default to peak for unmatched poses (they tend to be more complex)
        updates.push({ id: exercise.id, category: 'peak', name: exercise.name });
      }
      uncategorized.push(exercise.name);
    }
  }

  // Batch update
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const u of updates) {
      await client.query(
        `UPDATE exercises SET category = $1 WHERE id = $2`,
        [u.category, u.id]
      );
    }

    await client.query('COMMIT');

    // Stats
    const cats = {};
    for (const u of updates) {
      cats[u.category] = (cats[u.category] || 0) + 1;
    }
    console.log('\nCategories assigned:');
    for (const [cat, count] of Object.entries(cats).sort()) {
      console.log(`  ${cat}: ${count}`);
    }

    if (uncategorized.length > 0) {
      console.log(`\n${uncategorized.length} poses defaulted (no keyword match):`);
      uncategorized.forEach(n => console.log(`  - ${n}`));
    }

    console.log(`\nDone! ${updates.length} yoga exercises categorized.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to seed categories:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCategories();

/**
 * Seed practice types and hold times for yoga exercises.
 * Idempotent — safe to re-run. Only updates yoga exercises.
 *
 * Practice types: vinyasa, hatha, yin, restorative, sun_salutation
 * Uses the existing `category` column to assign practice types and per-type hold times.
 */
import 'dotenv/config';
import { pool } from '../src/db/pool.js';

// Default hold times per practice type (seconds)
const HOLD_DEFAULTS = {
  vinyasa: 20,
  hatha: 45,
  yin: 180,
  restorative: 300,
  sun_salutation: 5,
};

// Category-based practice type mapping
// true = all poses in this category, 'some' = use name-based filtering
const CATEGORY_MAP = {
  warmup:   { vinyasa: true, hatha: true, yin: false, restorative: false, sun_salutation: 'some' },
  standing: { vinyasa: true, hatha: true, yin: false, restorative: false, sun_salutation: false },
  peak:     { vinyasa: true, hatha: true, yin: false, restorative: false, sun_salutation: false },
  floor:    { vinyasa: 'some', hatha: true, yin: 'some', restorative: 'some', sun_salutation: false },
  cooldown: { vinyasa: false, hatha: true, yin: true, restorative: 'some', sun_salutation: false },
  savasana: { vinyasa: true, hatha: true, yin: true, restorative: true, sun_salutation: false },
  flow:     { vinyasa: true, hatha: false, yin: false, restorative: false, sun_salutation: 'some' },
};

// Keywords for "some" filtering — passive/stretchy floor poses for yin
const YIN_KEYWORDS = [
  'pigeon', 'butterfly', 'bound angle', 'baddha konasana',
  'seated forward', 'paschimottanasana', 'head to knee', 'janu sirsasana',
  'fire log', 'agnistambhasana', 'cow face', 'gomukhasana',
  'wide angle seated', 'upavistha konasana', 'half lord', 'matsyendrasana',
  'hero', 'virasana', 'lotus', 'padmasana', 'garland', 'malasana',
  'dragon', 'shoelace', 'caterpillar', 'dragonfly', 'swan',
  'sleeping', 'reclined', 'supine',
];

// Active floor poses excluded from yin
const YIN_EXCLUDE = [
  'boat', 'navasana', 'plank', 'chaturanga', 'crow', 'bakasana',
  'crane', 'firefly', 'peacock', 'eight-angle', 'arm balance',
  'locust', 'salabhasana', 'cobra', 'bhujangasana',
  'upward facing', 'urdhva mukha',
];

// Gentle cooldown poses for restorative
const RESTORATIVE_KEYWORDS = [
  'child', 'balasana', 'supine twist', 'reclining twist',
  'legs up', 'viparita karani', 'reclined bound', 'supta baddha',
  'happy baby', 'knees to chest', 'apanasana',
  'supported bridge', 'restorative', 'reclining',
  'savasana', 'corpse',
];

// Floor poses that work in vinyasa (active/dynamic ones)
const VINYASA_FLOOR_KEYWORDS = [
  'plank', 'chaturanga', 'cobra', 'bhujangasana',
  'upward facing', 'urdhva mukha', 'locust', 'salabhasana',
  'boat', 'navasana', 'crow', 'bakasana',
  'bridge', 'setu bandha', 'wheel', 'dhanurasana',
  'bow', 'camel', 'ustrasana',
];

// Sun salutation component poses
const SUN_SAL_KEYWORDS = [
  'sun salutation', 'surya namaskar',
  'mountain pose', 'tadasana',
  'standing forward fold', 'uttanasana',
  'halfway lift', 'ardha uttanasana',
  'plank', 'chaturanga', 'four-limbed',
  'upward facing dog', 'urdhva mukha', 'updog', 'up dog',
  'downward facing dog', 'adho mukha', 'downdog', 'down dog',
  'cobra', 'bhujangasana',
];

// Special hold time overrides (pose name keywords -> per-type overrides)
const HOLD_OVERRIDES = [
  { keywords: ['pigeon', 'kapotasana'], overrides: { vinyasa: 25, hatha: 60 } },
  { keywords: ['seated forward', 'paschimottanasana'], overrides: { hatha: 60 } },
  { keywords: ['half lord', 'matsyendrasana', 'seated twist'], overrides: { hatha: 50 } },
  { keywords: ['warrior', 'virabhadrasana'], overrides: { hatha: 40 } },
  { keywords: ['tree', 'vrksasana', 'eagle', 'garudasana', 'dancer', 'natarajasana'], overrides: { vinyasa: 25, hatha: 40 } },
  { keywords: ['child', 'balasana'], overrides: { restorative: 240 } },
  { keywords: ['bridge', 'setu bandha'], overrides: { hatha: 40 } },
  { keywords: ['savasana', 'corpse'], overrides: { restorative: 300, yin: 300 } },
];

function matchesAny(name, keywords) {
  return keywords.some(k => name.includes(k));
}

function getPracticeTypes(pose) {
  const category = pose.category || 'peak';
  const mapping = CATEGORY_MAP[category] || CATEGORY_MAP.peak;
  const nameLower = pose.name.toLowerCase();
  const types = [];

  for (const [practiceType, rule] of Object.entries(mapping)) {
    if (rule === true) {
      types.push(practiceType);
    } else if (rule === 'some') {
      // Name-based filtering for 'some' cases
      if (practiceType === 'yin') {
        if (matchesAny(nameLower, YIN_KEYWORDS) && !matchesAny(nameLower, YIN_EXCLUDE)) {
          types.push('yin');
        }
      } else if (practiceType === 'restorative') {
        if (matchesAny(nameLower, RESTORATIVE_KEYWORDS)) {
          types.push('restorative');
        }
      } else if (practiceType === 'vinyasa') {
        if (matchesAny(nameLower, VINYASA_FLOOR_KEYWORDS)) {
          types.push('vinyasa');
        }
      } else if (practiceType === 'sun_salutation') {
        if (matchesAny(nameLower, SUN_SAL_KEYWORDS)) {
          types.push('sun_salutation');
        }
      }
    }
  }

  return types;
}

function getHoldTimes(pose, practiceTypes) {
  const holdTimes = {};
  for (const pt of practiceTypes) {
    holdTimes[pt] = HOLD_DEFAULTS[pt];
  }

  // Apply overrides
  const nameLower = pose.name.toLowerCase();
  for (const { keywords, overrides } of HOLD_OVERRIDES) {
    if (keywords.some(k => nameLower.includes(k))) {
      for (const [pt, time] of Object.entries(overrides)) {
        if (holdTimes[pt] !== undefined) {
          holdTimes[pt] = time;
        }
      }
    }
  }

  return holdTimes;
}

async function seedPracticeTypes() {
  console.log('Fetching yoga exercises...');
  const { rows } = await pool.query(
    `SELECT id, name, category FROM exercises WHERE type = 'yoga'`
  );
  console.log(`Found ${rows.length} yoga exercises`);

  const updates = [];
  const stats = {};

  for (const pose of rows) {
    const practiceTypes = getPracticeTypes(pose);
    const holdTimes = getHoldTimes(pose, practiceTypes);

    updates.push({
      id: pose.id,
      name: pose.name,
      practice_types: practiceTypes,
      hold_times_json: holdTimes,
    });

    for (const pt of practiceTypes) {
      stats[pt] = (stats[pt] || 0) + 1;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const u of updates) {
      await client.query(
        `UPDATE exercises SET practice_types = $1::text[], hold_times_json = $2 WHERE id = $3`,
        [u.practice_types, JSON.stringify(u.hold_times_json), u.id]
      );
    }

    await client.query('COMMIT');

    console.log('\nPractice types assigned:');
    for (const [pt, count] of Object.entries(stats).sort()) {
      console.log(`  ${pt}: ${count} poses`);
    }

    const noTypes = updates.filter(u => u.practice_types.length === 0);
    if (noTypes.length > 0) {
      console.log(`\n${noTypes.length} poses with no practice types:`);
      noTypes.forEach(u => console.log(`  - ${u.name}`));
    }

    console.log(`\nDone! ${updates.length} yoga exercises updated.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to seed practice types:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedPracticeTypes();

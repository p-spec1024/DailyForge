import 'dotenv/config';
import { pool } from '../pool.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const EXERCISEDB_BASE = 'https://exercisedb.p.rapidapi.com/exercises';
const FREE_DB_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const BATCH_SIZE = 100;
const API_DELAY_MS = 1200; // delay between ExerciseDB pages
const FETCH_TIMEOUT_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 10_000;

// Categories from free-exercise-db that map to type='strength'
const STRENGTH_CATEGORIES = new Set([
  'strength',
  'powerlifting',
  'strongman',
  'olympic weightlifting',
  'plyometrics',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function mapDifficulty(level) {
  if (!level) return null;
  const l = level.toLowerCase();
  if (l === 'beginner' || l === 'easy') return 'beginner';
  if (l === 'intermediate' || l === 'medium') return 'intermediate';
  if (l === 'expert' || l === 'advanced' || l === 'hard') return 'advanced';
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDescription(instructions, equipment) {
  const parts = [];
  if (equipment && equipment !== 'body weight') {
    parts.push(`Equipment: ${equipment}`);
  }
  if (Array.isArray(instructions)) {
    parts.push(instructions.join(' '));
  } else if (instructions) {
    parts.push(instructions);
  }
  return parts.join('\n\n') || null;
}

// ---------------------------------------------------------------------------
// Data source: ExerciseDB (RapidAPI)
// ---------------------------------------------------------------------------
async function fetchExerciseDB() {
  if (!RAPIDAPI_KEY) {
    console.log('⏭  No RAPIDAPI_KEY found, skipping ExerciseDB.');
    return [];
  }

  console.log('Fetching from ExerciseDB API...');
  const exercises = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${EXERCISEDB_BASE}?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`  ExerciseDB API error: ${res.status} ${res.statusText}`);
      if (res.status === 429) {
        console.log('  Rate limited — waiting 10s...');
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      break;
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    exercises.push(...batch);
    console.log(`  Fetched ${exercises.length} exercises...`);
    offset += limit;

    if (batch.length < limit) break;
    await sleep(API_DELAY_MS);
  }

  return exercises
    .filter((e) => e.name && typeof e.name === 'string')
    .map((e) => ({
    name: e.name.slice(0, 255),
    target_muscles: [e.target, ...(e.secondaryMuscles || [])]
      .filter(Boolean)
      .join(', '),
    description: buildDescription(e.instructions, e.equipment),
    difficulty: null,
    source: 'exercisedb',
    media_url: e.gifUrl || null,
    type: 'strength',
  }));
}

// ---------------------------------------------------------------------------
// Data source: free-exercise-db (GitHub)
// ---------------------------------------------------------------------------
async function fetchFreeExerciseDB() {
  console.log('Fetching from free-exercise-db (GitHub)...');
  const res = await fetch(FREE_DB_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error(`  free-exercise-db fetch error: ${res.status}`);
    return [];
  }

  const raw = await res.json();
  console.log(`  Loaded ${raw.length} total exercises from free-exercise-db`);

  // Filter to strength-related categories only
  const filtered = raw.filter(
    (e) => e.category && STRENGTH_CATEGORIES.has(e.category.toLowerCase()),
  );
  console.log(`  ${filtered.length} are strength-related`);

  return filtered
    .filter((e) => e.name && typeof e.name === 'string')
    .map((e) => ({
    name: e.name.slice(0, 255),
    target_muscles: [...(e.primaryMuscles || []), ...(e.secondaryMuscles || [])]
      .filter(Boolean)
      .join(', '),
    description: buildDescription(e.instructions, e.equipment),
    difficulty: mapDifficulty(e.level),
    source: 'free-exercise-db',
    media_url: null,
    type: 'strength',
  }));
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function seed() {
  console.log('=== Strength Exercise Seeding ===\n');

  // Fetch from both sources (in parallel where possible)
  const [exerciseDBData, freeDBData] = await Promise.all([
    fetchExerciseDB(),
    fetchFreeExerciseDB(),
  ]);

  // Deduplicate across sources — ExerciseDB takes priority
  const seen = new Set();
  const allExercises = [];

  for (const e of exerciseDBData) {
    const key = normalizeName(e.name);
    if (!seen.has(key)) {
      seen.add(key);
      allExercises.push(e);
    }
  }

  let freeDBAdded = 0;
  for (const e of freeDBData) {
    const key = normalizeName(e.name);
    if (!seen.has(key)) {
      seen.add(key);
      allExercises.push(e);
      freeDBAdded++;
    }
  }

  console.log(`\nDeduplication summary:`);
  console.log(`  ExerciseDB:        ${exerciseDBData.length}`);
  console.log(`  free-exercise-db:  ${freeDBData.length} (${freeDBAdded} unique additions)`);
  console.log(`  Cross-source dups: ${freeDBData.length - freeDBAdded}`);
  console.log(`  Total to insert:   ${allExercises.length}\n`);

  // Insert in batches using ON CONFLICT for idempotency
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < allExercises.length; i += BATCH_SIZE) {
    const batch = allExercises.slice(i, i + BATCH_SIZE);

    // Build a single multi-row INSERT for the batch
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const e of batch) {
      values.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
      );
      params.push(
        e.name,
        e.target_muscles,
        e.type,
        e.description,
        e.source,
        e.difficulty,
        e.media_url,
      );
    }

    const result = await pool.query(
      `INSERT INTO exercises
         (name, target_muscles, type, description, source, difficulty, media_url)
       VALUES ${values.join(', ')}
       ON CONFLICT (name, source) WHERE workout_id IS NULL
       DO NOTHING`,
      params,
    );

    inserted += result.rowCount;
    skipped += batch.length - result.rowCount;

    const progress = Math.min(i + BATCH_SIZE, allExercises.length);
    process.stdout.write(`\r  Progress: ${progress}/${allExercises.length}`);
  }

  console.log(`\n\n=== Seeding Complete ===`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already existed): ${skipped}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

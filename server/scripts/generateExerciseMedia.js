/**
 * Exercise Media Generation Script
 * Fetches exercises needing media and prints prompts for Vertex AI processing.
 *
 * Usage:
 *   node server/scripts/generateExerciseMedia.js [--batch-size=25] [--type=all|strength|yoga|breathwork|stretch]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });
import pg from 'pg';
import { PROMPT_TEMPLATES } from '../src/utils/mediaGenerator.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined
});

// Parse CLI args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const BATCH_SIZE = parseInt(args['batch-size']) || 25;
const EXERCISE_TYPE = args['type'] || 'all';

async function generateMediaBatch() {
  console.log(`\nStarting media generation...`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Type filter: ${EXERCISE_TYPE}\n`);

  let query = `
    SELECT id, name, type, target_muscles, sanskrit_name
    FROM exercises
    WHERE media_url IS NULL
    AND review_status = 'pending'
    AND workout_id IS NULL
  `;
  const params = [];

  if (EXERCISE_TYPE !== 'all') {
    params.push(EXERCISE_TYPE);
    query += ` AND type = $${params.length}`;
  }
  params.push(BATCH_SIZE);
  query += ` ORDER BY type, id LIMIT $${params.length}`;

  const { rows: exercises } = await pool.query(query, params);

  console.log(`Found ${exercises.length} exercises to process\n`);

  if (exercises.length === 0) {
    console.log('No exercises need media generation.');
    await pool.end();
    return [];
  }

  console.log('Exercises to generate media for:');
  console.log('================================');

  exercises.forEach((ex, i) => {
    const promptFn = PROMPT_TEMPLATES[ex.type] || PROMPT_TEMPLATES.strength;
    const prompt = promptFn(ex);
    console.log(`\n${i + 1}. [${ex.type.toUpperCase()}] ${ex.name} (ID: ${ex.id})`);
    console.log(`   Prompt: ${prompt}`);
  });

  console.log('\n================================\n');
  await pool.end();
  return exercises;
}

generateMediaBatch()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

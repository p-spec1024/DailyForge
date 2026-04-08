/**
 * Batch Exercise Media Generator
 * Generates IMAGE + VIDEO for exercises, uploads to ImageKit, updates DB.
 *
 * Usage:
 *   node --env-file=.env scripts/batchGenerateMedia.js
 *   node --env-file=.env scripts/batchGenerateMedia.js --upload-only
 *   node --env-file=.env scripts/batchGenerateMedia.js --skip-existing
 */

import { generateImage } from '../src/utils/vertexImageGen.js';
import { generateVideo } from '../src/utils/vertexVideoGen.js';
import { uploadMedia } from '../src/utils/uploadMedia.js';
import { pool } from '../src/db/pool.js';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = resolve(__dirname, '..', 'media');

// ── Exercise Definitions ─────────────────────────────────────────────
const exercises = [
  {
    name: 'Barbell Deadlift',
    type: 'strength',
    gender: 'man',
    skinTone: 'medium brown',
    clothes: 'a fitted black tank top and dark grey shorts',
    background: 'pink',
    formCues: 'Hip-hinge pattern: feet hip-width, overhand grip on barbell, chest up, back flat. Drive through heels, extend hips and knees simultaneously, lockout standing tall. Reverse the motion with control.',
    imagePosition: 'mid-lift',
    imageBody: 'Bent at the hips gripping the barbell with both hands, back flat, chest up, knees slightly bent, barbell at knee height. Core braced, shoulders over the bar.',
  },
  {
    name: 'Pushups',
    displayName: 'Push-up',
    type: 'strength',
    gender: 'woman',
    skinTone: 'light',
    clothes: 'a coral sports bra and black leggings',
    background: 'teal',
    formCues: 'Hands shoulder-width apart, full plank position. Lower chest to floor with elbows at 45 degrees, then press back up to full arm extension. Core tight throughout.',
    imagePosition: 'bottom',
    imageBody: 'In the bottom of a push-up with chest near the floor, elbows bent at 45 degrees, body in a straight plank line from head to heels. Core engaged, gaze slightly forward.',
  },
  {
    name: 'Barbell Squat',
    type: 'strength',
    gender: 'man',
    skinTone: 'dark',
    clothes: 'a white compression shirt and navy shorts',
    background: 'blue',
    formCues: 'Barbell on upper traps, feet shoulder-width, toes slightly out. Sit back and down keeping chest tall, knees tracking toes. Descend to parallel or below, then drive up through heels.',
    imagePosition: 'bottom of the squat',
    imageBody: 'In a deep squat position with barbell on upper back, thighs parallel to the floor, chest tall, knees tracking over toes. Feet flat, weight in heels.',
  },
  {
    name: 'Pullups',
    displayName: 'Pull-up',
    type: 'strength',
    gender: 'woman',
    skinTone: 'medium',
    clothes: 'a dark green tank top and black shorts',
    background: 'purple',
    formCues: 'Overhand grip slightly wider than shoulders on a pull-up bar. From dead hang, engage lats and pull chin above bar. Lower with control to full arm extension.',
    imagePosition: 'top',
    imageBody: 'Hanging from a pull-up bar with chin above the bar, arms fully engaged, lats flared. Legs together, core tight, slight lean back.',
  },
  {
    name: 'Plank',
    type: 'core',
    gender: 'man',
    skinTone: 'light',
    clothes: 'a grey t-shirt and black athletic pants',
    background: 'navy',
    formCues: 'Forearms on floor, elbows under shoulders. Body in a straight line from head to heels. Core braced, glutes engaged, neutral spine. Hold steady position.',
    imagePosition: 'hold',
    imageBody: 'In a forearm plank position with elbows directly under shoulders, body forming a perfectly straight line from head to heels. Core visibly engaged, forearms flat on the ground.',
  },
  {
    name: 'Downward Facing Dog',
    displayName: 'Downward Dog',
    type: 'yoga',
    gender: 'woman',
    skinTone: 'brown',
    clothes: 'a lavender yoga top and dark purple leggings',
    background: 'lavender',
    formCues: 'Inverted V-shape. Hands shoulder-width pressing into floor, feet hip-width. Lift hips high, press chest toward thighs, straighten legs. Head between upper arms, heels reaching toward floor.',
    imagePosition: 'hold',
    imageBody: 'In an inverted V-shape with hands pressing into the floor shoulder-width apart, hips lifted high, legs straight, heels reaching toward the floor. Head relaxed between upper arms, spine long.',
  },
  {
    name: 'Dumbbell Lunges',
    displayName: 'Lunges',
    type: 'strength',
    gender: 'man',
    skinTone: 'medium',
    clothes: 'a blue athletic shirt and dark shorts',
    background: 'green',
    formCues: 'Step forward into a lunge, front knee at 90 degrees tracking over ankle, back knee lowering toward floor. Torso upright, core engaged. Push back to standing through front heel.',
    imagePosition: 'bottom of the lunge',
    imageBody: 'In a forward lunge with front knee bent at 90 degrees over the ankle, back knee hovering just above the floor. Torso upright, hands on hips, core engaged.',
  },
];

// ── Prompt Builders ──────────────────────────────────────────────────

function buildVideoPrompt(ex) {
  const exerciseName = ex.displayName || ex.name;
  return `A 3D animated Pixar-style HUMAN fitness character performing one complete rep of ${exerciseName}.
The character is an athletic adult HUMAN ${ex.gender} with ${ex.skinTone} skin wearing ${ex.clothes}.

CAMERA MOVEMENT:
- Start FRONT VIEW medium shot showing the starting position
- Slow ZOOM IN while camera ORBITS clockwise during the movement
- CRANE UP at SIDE VIEW to show form from slightly above
- ZOOM OUT while continuing orbit to REAR VIEW
- Gentle ZOOM IN ending on three-quarter angle as character returns to start

EXERCISE FORM: ${ex.formCues}

Smooth continuous cinematic camera movement throughout.
Clean solid ${ex.background} background.
Professional fitness demonstration.

CRITICAL: Only a HUMAN character. NO animals, NO frogs, NO creatures.
One complete rep, 180-degree camera orbit with zoom variations.`;
}

function buildImagePrompt(ex) {
  const exerciseName = ex.displayName || ex.name;
  return `A 3D rendered Pixar-style HUMAN fitness character performing ${exerciseName} at the ${ex.imagePosition} position.
The character is an athletic adult HUMAN ${ex.gender} with ${ex.skinTone} skin, wearing ${ex.clothes}.
${ex.imageBody}.
Clean solid ${ex.background} background with subtle gradient.
Full body clearly visible in frame, centered composition.
Professional fitness app illustration style, smooth 3D render, soft studio lighting.
IMPORTANT: Only a HUMAN character. NO animals, NO creatures.`;
}

// ── Helpers ──────────────────────────────────────────────────────────

function slug(ex) {
  const n = ex.displayName || ex.name;
  return n.toLowerCase().replace(/\s+/g, '-');
}

async function findExerciseId(name) {
  const res = await pool.query(
    `SELECT id, type FROM exercises WHERE LOWER(name) = LOWER($1) AND workout_id IS NULL LIMIT 1`,
    [name]
  );
  return res.rows[0] || null;
}

async function updateExerciseMedia(id, mediaUrl, thumbnailUrl, mediaType) {
  await pool.query(
    `UPDATE exercises SET media_url = $1, thumbnail_url = $2, media_type = $3, review_status = 'pending' WHERE id = $4`,
    [mediaUrl, thumbnailUrl, mediaType, id]
  );
}

// ── Main ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const UPLOAD_ONLY = args.includes('--upload-only');
const SKIP_EXISTING = args.includes('--skip-existing');

async function processExercise(ex, index) {
  const label = ex.displayName || ex.name;
  const tag = `[${index + 1}/7 ${label}]`;
  const s = slug(ex);
  const folder = `/exercises/${ex.type}`;

  // Find exercise in DB
  const dbExercise = await findExerciseId(ex.name);
  if (!dbExercise) {
    console.error(`${tag} ❌ Not found in database — skipping`);
    return { name: ex.name, status: 'not_found' };
  }

  if (SKIP_EXISTING && dbExercise.media_url) {
    console.log(`${tag} ⏭ Already has media — skipping`);
    return { name: ex.name, status: 'skipped' };
  }

  console.log(`${tag} 🎬 Starting (DB id=${dbExercise.id})...`);

  let imageUrl, videoUrl, imageFileId, videoFileId;

  if (!UPLOAD_ONLY) {
    // Generate image and video in parallel
    console.log(`${tag} 🖼 Generating image...`);
    const imagePromise = generateImage(buildImagePrompt(ex), {
      outputPath: resolve(MEDIA_DIR, `${s}.png`),
      aspectRatio: '3:4',
    });

    console.log(`${tag} 🎥 Generating video...`);
    const videoPromise = generateVideo(buildVideoPrompt(ex), {
      outputPath: resolve(MEDIA_DIR, `${s}.mp4`),
      aspectRatio: '9:16',
      durationSeconds: 6,
    });

    const [imageResult, videoResult] = await Promise.all([imagePromise, videoPromise]);
    console.log(`${tag} ✅ Generation complete`);

    // Upload to ImageKit
    console.log(`${tag} ☁️ Uploading image...`);
    const imgUpload = await uploadMedia(
      Buffer.from(imageResult.base64, 'base64'),
      `${s}.png`,
      folder
    );
    imageUrl = imgUpload.url;
    imageFileId = imgUpload.fileId;

    console.log(`${tag} ☁️ Uploading video...`);
    const vidUpload = await uploadMedia(
      Buffer.from(videoResult.base64, 'base64'),
      `${s}.mp4`,
      folder
    );
    videoUrl = vidUpload.url;
    videoFileId = vidUpload.fileId;
  } else {
    // Upload existing local files
    const imgBuf = await readFile(resolve(MEDIA_DIR, `${s}.png`));
    const vidBuf = await readFile(resolve(MEDIA_DIR, `${s}.mp4`));

    console.log(`${tag} ☁️ Uploading existing files...`);
    const [imgUpload, vidUpload] = await Promise.all([
      uploadMedia(imgBuf, `${s}.png`, folder),
      uploadMedia(vidBuf, `${s}.mp4`, folder),
    ]);
    imageUrl = imgUpload.url;
    videoUrl = vidUpload.url;
  }

  // Update DB — store video URL as media_url, image as thumbnail
  await updateExerciseMedia(dbExercise.id, videoUrl, imageUrl, 'video');
  console.log(`${tag} 💾 DB updated`);

  return {
    name: ex.name,
    id: dbExercise.id,
    status: 'success',
    imageUrl,
    videoUrl,
  };
}

async function uploadTestVideo() {
  console.log('\n═══ Uploading test video ═══');
  const testPath = resolve(MEDIA_DIR, 'test-veo31-deadlift.mp4');
  const buf = await readFile(testPath);
  const result = await uploadMedia(buf, 'test-veo31-deadlift.mp4', '/exercises/test');
  console.log(`✅ Test video uploaded: ${result.url}`);
  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  DailyForge Batch Exercise Media Generator');
  console.log('═══════════════════════════════════════════\n');
  console.log(`Mode: ${UPLOAD_ONLY ? 'UPLOAD-ONLY' : 'GENERATE + UPLOAD'}`);
  console.log(`Exercises: ${exercises.length}\n`);

  // Step 1: Upload test video
  const testResult = await uploadTestVideo();

  // Step 2: Process exercises — run 2 at a time to avoid rate limits
  const CONCURRENCY = 2;
  const results = [];

  for (let i = 0; i < exercises.length; i += CONCURRENCY) {
    const batch = exercises.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((ex, j) => processExercise(ex, i + j).catch(err => ({
        name: ex.name,
        status: 'error',
        error: err.message,
      })))
    );
    results.push(...batchResults);
  }

  // Step 3: Report
  console.log('\n═══ RESULTS ═══\n');
  console.log('Test video:', testResult.url);
  console.log('');

  for (const r of results) {
    if (r.status === 'success') {
      console.log(`✅ ${r.name} (id=${r.id})`);
      console.log(`   Image: ${r.imageUrl}`);
      console.log(`   Video: ${r.videoUrl}`);
    } else {
      console.log(`❌ ${r.name}: ${r.status} ${r.error || ''}`);
    }
  }

  const ok = results.filter(r => r.status === 'success').length;
  const fail = results.length - ok;
  console.log(`\n${ok} succeeded, ${fail} failed out of ${results.length} exercises`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});

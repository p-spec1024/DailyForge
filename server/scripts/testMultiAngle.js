/**
 * Multi-Angle Image + 360° Spin Video Test — Barbell Deadlift
 *
 * Generates 4 static images (front, side, back, 3-quarter) using Imagen 3
 * and 1 spin video (360° camera orbit) using Veo 3.1.
 * Uploads all 5 files to ImageKit and reports URLs.
 *
 * Usage:
 *   node --env-file=.env scripts/testMultiAngle.js
 *   node --env-file=.env scripts/testMultiAngle.js --upload-only
 */

import { generateImage } from '../src/utils/vertexImageGen.js';
import { generateVideo } from '../src/utils/vertexVideoGen.js';
import { uploadMedia } from '../src/utils/uploadMedia.js';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = resolve(__dirname, '..', 'media');
const UPLOAD_ONLY = process.argv.includes('--upload-only');

// ── Prompts ─────────────────────────────────────────────────────────

const IMAGE_PROMPTS = [
  {
    angle: 'front',
    fileName: 'barbell-deadlift-front.png',
    prompt: `A 3D rendered Pixar-style HUMAN fitness character performing barbell deadlift at the top position.
FRONT VIEW - camera facing the character directly from the front.
The character is an athletic adult HUMAN man with medium brown skin wearing a grey tank top and black shorts.
Standing upright holding barbell at hip level, arms straight, shoulders back, chest proud.
Clean solid pink background.
Full body visible from head to feet.
Professional fitness app illustration, smooth 3D render, soft studio lighting.
ONLY a HUMAN character. NO animals.`,
  },
  {
    angle: 'side',
    fileName: 'barbell-deadlift-side.png',
    prompt: `A 3D rendered Pixar-style HUMAN fitness character performing barbell deadlift at the top position.
SIDE VIEW - camera at 90 degrees showing the character's profile from the right side.
The character is an athletic adult HUMAN man with medium brown skin wearing a grey tank top and black shorts.
Standing upright holding barbell at hip level, showing neutral spine alignment, slight knee bend, hip position.
Clean solid pink background.
Full body visible from head to feet.
Professional fitness app illustration, smooth 3D render, soft studio lighting.
ONLY a HUMAN character. NO animals.`,
  },
  {
    angle: 'back',
    fileName: 'barbell-deadlift-back.png',
    prompt: `A 3D rendered Pixar-style HUMAN fitness character performing barbell deadlift at the top position.
BACK VIEW - camera behind the character showing their back.
The character is an athletic adult HUMAN man with medium brown skin wearing a grey tank top and black shorts.
Standing upright holding barbell at hip level, showing back muscles engaged, shoulder blades retracted, spine alignment.
Clean solid pink background.
Full body visible from head to feet.
Professional fitness app illustration, smooth 3D render, soft studio lighting.
ONLY a HUMAN character. NO animals.`,
  },
  {
    angle: '3quarter',
    fileName: 'barbell-deadlift-3quarter.png',
    prompt: `A 3D rendered Pixar-style HUMAN fitness character performing barbell deadlift at the top position.
THREE-QUARTER VIEW - camera at 45 degrees front-right angle.
The character is an athletic adult HUMAN man with medium brown skin wearing a grey tank top and black shorts.
Standing upright holding barbell at hip level, showing depth and dimension of the pose.
Clean solid pink background.
Full body visible from head to feet.
Professional fitness app illustration, smooth 3D render, soft studio lighting.
ONLY a HUMAN character. NO animals.`,
  },
];

const VIDEO_PROMPT = {
  fileName: 'barbell-deadlift-360spin.mp4',
  prompt: `A 3D animated Pixar-style HUMAN fitness character holding the top position of a barbell deadlift.
The character is an athletic adult HUMAN man with medium brown skin wearing a grey tank top and black shorts.
The character stands STILL in perfect deadlift lockout position - not moving, just holding the pose.

CAMERA MOVEMENT:
- Camera performs a smooth 360-degree ORBIT around the stationary character
- Camera stays at chest height, maintaining consistent distance
- Slow, steady rotation showing: FRONT → RIGHT SIDE → BACK → LEFT SIDE → FRONT
- Full 360-degree rotation completing one full circle around the character

The character does NOT move - only the camera rotates around them like a turntable/product showcase.
Clean solid pink background.
Professional fitness demonstration.

CRITICAL: Only a HUMAN character. NO animals, NO frogs. Character remains stationary while camera orbits.
6 seconds, smooth continuous 360-degree camera rotation.`,
};

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Multi-Angle Test — Barbell Deadlift');
  console.log('═══════════════════════════════════════════\n');
  console.log(`Mode: ${UPLOAD_ONLY ? 'UPLOAD-ONLY' : 'GENERATE + UPLOAD'}\n`);

  const results = {};

  if (!UPLOAD_ONLY) {
    // ── Step 1: Generate all 4 images in parallel ───────────────────
    console.log('── Step 1: Generating 4 images (Imagen 3) ──\n');

    const imageResults = [];
    for (const img of IMAGE_PROMPTS) {
      console.log(`  🖼 Generating ${img.angle} view...`);
      const r = await generateImage(img.prompt, {
        outputPath: resolve(MEDIA_DIR, img.fileName),
        aspectRatio: '3:4',
      });
      console.log(`  ✅ ${img.angle} view done`);
      imageResults.push({ ...img, base64: r.base64 });
    }
    console.log('\n✅ All 4 images generated\n');

    // ── Step 2: Generate 360° spin video ────────────────────────────
    console.log('── Step 2: Generating 360° spin video (Veo 3.1) ──\n');

    const videoResult = await generateVideo(VIDEO_PROMPT.prompt, {
      outputPath: resolve(MEDIA_DIR, VIDEO_PROMPT.fileName),
      aspectRatio: '9:16',
      durationSeconds: 6,
    });
    console.log('\n✅ 360° spin video generated\n');

    // ── Step 3: Upload all 5 to ImageKit ────────────────────────────
    console.log('── Step 3: Uploading to ImageKit ──\n');

    for (const img of imageResults) {
      console.log(`  ☁️ Uploading ${img.fileName}...`);
      const upload = await uploadMedia(
        Buffer.from(img.base64, 'base64'),
        img.fileName,
        '/exercises/test-multi-angle'
      );
      results[img.angle] = upload.url;
      console.log(`  ✅ ${img.angle}: ${upload.url}`);
    }

    console.log(`  ☁️ Uploading ${VIDEO_PROMPT.fileName}...`);
    const vidUpload = await uploadMedia(
      Buffer.from(videoResult.base64, 'base64'),
      VIDEO_PROMPT.fileName,
      '/exercises/test-multi-angle'
    );
    results['360spin'] = vidUpload.url;
    console.log(`  ✅ 360spin: ${vidUpload.url}`);
  } else {
    // ── Upload-only mode: read from disk ────────────────────────────
    console.log('── Uploading existing files from disk ──\n');

    for (const img of IMAGE_PROMPTS) {
      console.log(`  ☁️ Uploading ${img.fileName}...`);
      const buf = await readFile(resolve(MEDIA_DIR, img.fileName));
      const upload = await uploadMedia(buf, img.fileName, '/exercises/test-multi-angle');
      results[img.angle] = upload.url;
      console.log(`  ✅ ${img.angle}: ${upload.url}`);
    }

    console.log(`  ☁️ Uploading ${VIDEO_PROMPT.fileName}...`);
    const vidBuf = await readFile(resolve(MEDIA_DIR, VIDEO_PROMPT.fileName));
    const vidUpload = await uploadMedia(vidBuf, VIDEO_PROMPT.fileName, '/exercises/test-multi-angle');
    results['360spin'] = vidUpload.url;
    console.log(`  ✅ 360spin: ${vidUpload.url}`);
  }

  // ── Report ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════\n');
  console.log(`  Front:     ${results.front}`);
  console.log(`  Side:      ${results.side}`);
  console.log(`  Back:      ${results.back}`);
  console.log(`  3-Quarter: ${results['3quarter']}`);
  console.log(`  360° Spin: ${results['360spin']}`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

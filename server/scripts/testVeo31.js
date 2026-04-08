/**
 * Quick test: Generate a single video with Veo 3.1
 * Usage: node server/scripts/testVeo31.js
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import { generateVideo } from '../src/utils/vertexVideoGen.js';

const prompt = `A 3D animated Pixar-style HUMAN fitness character performing one complete barbell deadlift rep.
The character is an athletic adult HUMAN man with medium brown skin wearing a grey tank top and black shorts.

CAMERA MOVEMENT:
- Start FRONT VIEW medium shot showing character standing with barbell at hips
- Slow ZOOM IN while camera ORBITS clockwise as character lowers the barbell
- CRANE UP at SIDE VIEW to show hip hinge and neutral spine from slightly above
- ZOOM OUT while continuing orbit to REAR VIEW showing back muscles
- Gentle ZOOM IN ending on three-quarter angle as character returns to standing

EXERCISE FORM: Hip hinge pattern, barbell stays close to body, neutral spine, knees track over toes, drive through heels to stand.

Smooth continuous cinematic camera movement throughout.
Clean solid pink background.
Professional fitness demonstration.

CRITICAL: Only a HUMAN character. NO animals, NO frogs, NO creatures.
5 seconds, one complete rep, 180-degree camera orbit with zoom variations.`;

const outputPath = join(__dirname, '..', 'media', 'test-veo31-deadlift.mp4');

console.log('Model: veo-3.1-fast-generate-001');
console.log('Output:', outputPath);
console.log('Prompt length:', prompt.length, 'chars\n');

generateVideo(prompt, {
  outputPath,
  durationSeconds: 6,
  aspectRatio: '9:16'
})
  .then(result => {
    console.log('\nDone! Video saved to:', result.outputPath);
    console.log('Base64 length:', result.base64.length);
  })
  .catch(err => {
    console.error('\nFailed:', err.message);
    process.exit(1);
  });

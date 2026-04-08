/**
 * Vertex AI Imagen 3 — Exercise illustration generator
 * Uses Application Default Credentials (ADC) for auth.
 *
 * Prerequisites:
 *   gcloud auth application-default login
 *   npm install google-auth-library
 */

import { GoogleAuth } from 'google-auth-library';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'finr-backup-2';
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const MODEL = 'imagen-3.0-generate-002';

const ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`;

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

/**
 * Generate an image using Vertex AI Imagen 3
 * @param {string} prompt - Text prompt describing the image
 * @param {object} options
 * @param {string} [options.outputPath] - File path to save the image
 * @param {string} [options.aspectRatio='1:1'] - 1:1, 3:4, 4:3, 9:16, 16:9
 * @param {number} [options.sampleCount=1] - Number of images (1-4)
 * @returns {Promise<{base64: string, outputPath?: string}>}
 */
export async function generateImage(prompt, options = {}) {
  const {
    outputPath,
    aspectRatio = '1:1',
    sampleCount = 1
  } = options;

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount,
      aspectRatio,
      outputOptions: { mimeType: 'image/png' }
    }
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex AI Imagen error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const base64 = data.predictions?.[0]?.bytesBase64Encoded;

  if (!base64) {
    throw new Error('No image returned from Vertex AI');
  }

  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(base64, 'base64'));
    console.log(`Image saved to ${outputPath}`);
  }

  return { base64, outputPath };
}

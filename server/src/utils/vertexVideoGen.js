/**
 * Vertex AI Veo — Exercise movement video generator
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
const MODEL = process.env.VEO_MODEL || 'veo-3.1-fast-generate-001';

const BASE_URL = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}`;

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

async function getAuthHeaders() {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  return {
    'Authorization': `Bearer ${accessToken.token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Generate a video using Vertex AI Veo 3.1
 * @param {string} prompt - Text prompt describing the video
 * @param {object} options
 * @param {string} [options.outputPath] - File path to save the video
 * @param {string} [options.aspectRatio='9:16'] - 16:9 or 9:16
 * @param {number} [options.durationSeconds=4] - 4, 6, or 8
 * @param {number} [options.sampleCount=1] - 1-4
 * @param {number} [options.pollIntervalMs=15000] - Polling interval
 * @param {number} [options.timeoutMs=600000] - Max wait time (10 min)
 * @returns {Promise<{base64: string, outputPath?: string}>}
 */
export async function generateVideo(prompt, options = {}) {
  const {
    outputPath,
    aspectRatio = '9:16',
    durationSeconds = 4,
    sampleCount = 1,
    pollIntervalMs = 15000,
    timeoutMs = 600000
  } = options;

  const headers = await getAuthHeaders();

  // Start the long-running operation
  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      sampleCount,
      durationSeconds,
      resolution: '720p',
      generateAudio: false,
      personGeneration: 'allow_adult'
    }
  };

  console.log('Starting video generation...');
  const res = await fetch(`${BASE_URL}:predictLongRunning`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex AI Veo error (${res.status}): ${err}`);
  }

  const operation = await res.json();
  const operationName = operation.name;
  console.log(`Operation started: ${operationName}`);

  // Poll for completion using fetchPredictOperation
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`Polling... (${elapsed}s elapsed)`);

    const pollHeaders = await getAuthHeaders();
    const pollRes = await fetch(`${BASE_URL}:fetchPredictOperation`, {
      method: 'POST',
      headers: pollHeaders,
      body: JSON.stringify({ operationName })
    });

    if (!pollRes.ok) {
      const err = await pollRes.text();
      throw new Error(`Poll error (${pollRes.status}): ${err}`);
    }

    const status = await pollRes.json();

    if (status.done) {
      if (status.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(status.error)}`);
      }

      // Vertex AI Veo returns videos in response.videos[] or response.predictions[]
      const base64 = status.response?.videos?.[0]?.bytesBase64Encoded
        || status.response?.predictions?.[0]?.bytesBase64Encoded;

      if (!base64) {
        throw new Error(`No video in response: ${JSON.stringify(status.response)}`);
      }

      console.log(`Video generated in ${elapsed}s`);

      if (outputPath) {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, Buffer.from(base64, 'base64'));
        console.log(`Video saved to ${outputPath}`);
      }

      return { base64, outputPath };
    }
  }

  throw new Error(`Video generation timed out after ${timeoutMs / 1000}s`);
}

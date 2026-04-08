/**
 * Upload media to ImageKit CDN via REST API
 * Uses the v2 upload endpoint directly (SDK v7 hangs on Node 24).
 */

const UPLOAD_URL = 'https://upload.imagekit.io/api/v2/files/upload';

function getAuth() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error('IMAGEKIT_PRIVATE_KEY not set');
  return 'Basic ' + Buffer.from(privateKey + ':').toString('base64');
}

/**
 * Upload file to ImageKit
 * @param {Buffer|string} file - File buffer or base64 string
 * @param {string} fileName - Name for the file
 * @param {string} folder - ImageKit folder path (e.g., '/exercises/strength')
 * @returns {Promise<{url: string, fileId: string}>}
 */
export async function uploadMedia(file, fileName, folder = '/exercises') {
  const base64 = Buffer.isBuffer(file) ? file.toString('base64') : file;

  const formData = new FormData();
  formData.append('file', base64);
  formData.append('fileName', fileName);
  formData.append('folder', folder);
  formData.append('useUniqueFileName', 'true');

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'Authorization': getAuth() },
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ImageKit upload error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { url: data.url, fileId: data.fileId };
}

/**
 * Generate optimized URL with transforms
 * @param {string} baseUrl - Full ImageKit URL
 * @param {object} transforms - e.g., { width: 400, height: 400, quality: 80 }
 */
export function getOptimizedUrl(baseUrl, transforms = {}) {
  const w = transforms.width ?? 400;
  const h = transforms.height ?? 400;
  const q = transforms.quality ?? 80;
  // ImageKit URL transform: insert /tr:w-400,h-400,q-80,f-webp/ after urlEndpoint
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!urlEndpoint || !baseUrl.startsWith(urlEndpoint)) return baseUrl;
  const path = baseUrl.slice(urlEndpoint.length);
  return `${urlEndpoint}/tr:w-${w},h-${h},q-${q},f-webp${path}`;
}

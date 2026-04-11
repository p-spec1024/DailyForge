import localforage from 'localforage';

const store = localforage.createInstance({
  name: 'dailyforge',
  storeName: 'progress-photos',
  description: 'Progress photo blobs (private, on-device only)',
});

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function makeThumbnail(blob, maxDim = 240) {
  // createImageBitmap is unreliable on older iOS Safari; <img> fallback works everywhere.
  const source = typeof createImageBitmap === 'function'
    ? await createImageBitmap(blob).catch(() => loadImage(blob))
    : await loadImage(blob);
  const ratio = Math.min(maxDim / source.width, maxDim / source.height, 1);
  const w = Math.round(source.width * ratio);
  const h = Math.round(source.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
}

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export async function savePhoto(file, { date = new Date(), view = 'front' } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('Image too large (max 15 MB)');
  }
  const key = `photo_${uuid()}`;
  const thumbnailBlob = await makeThumbnail(file);
  await store.setItem(key, {
    id: key,
    date: date.toISOString().slice(0, 10),
    view,
    imageBlob: file,
    thumbnailBlob,
  });
  return key;
}

export async function getPhoto(key) {
  return store.getItem(key);
}

export async function deletePhoto(key) {
  await store.removeItem(key);
}

export async function listPhotoKeys() {
  return store.keys();
}

export function blobToUrl(blob) {
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

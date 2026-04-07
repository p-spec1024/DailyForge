import imagekit from '../config/imagekit.js';

/**
 * Upload image to ImageKit
 * @param {Buffer|string} file - File buffer or base64 string
 * @param {string} fileName - Name for the file
 * @param {string} folder - ImageKit folder path (e.g., '/exercises/strength')
 * @returns {Promise<{url: string, fileId: string}>}
 */
export async function uploadMedia(file, fileName, folder = '/exercises') {
  if (!imagekit) {
    throw new Error('ImageKit is not configured');
  }

  const response = await imagekit.files.upload({
    file,
    fileName,
    folder,
    useUniqueFileName: true
  });

  return {
    url: response.url,
    fileId: response.fileId
  };
}

/**
 * Generate optimized URL with transforms
 * @param {string} path - ImageKit file path
 * @param {object} transforms - e.g., { width: 400, height: 400, quality: 80 }
 */
export function getOptimizedUrl(path, transforms = {}) {
  return imagekit.helper.buildSrc({
    path,
    transformations: [{
      width: transforms.width ?? 400,
      height: transforms.height ?? 400,
      quality: transforms.quality ?? 80,
      format: 'webp'
    }]
  });
}

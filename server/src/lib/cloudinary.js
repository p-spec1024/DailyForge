import { v2 as cloudinary } from 'cloudinary';

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error('Missing required Cloudinary env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary.
 * @param {string} filePath - Local path to the file
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<{ url: string, public_id: string }>}
 */
export async function uploadToCloudinary(filePath, folder) {
  const result = await cloudinary.uploader.upload(filePath, { folder });
  return { url: result.secure_url, public_id: result.public_id };
}

export default cloudinary;

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

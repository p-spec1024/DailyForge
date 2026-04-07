import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadMedia } from '../utils/uploadMedia.js';

const router = Router();

router.use(authenticate);

// POST /api/media/test-upload
// Body: { base64: "data:image/png;base64,..." }
router.post('/test-upload', async (req, res) => {
  try {
    const { base64 } = req.body;

    if (!base64) {
      return res.status(400).json({ error: 'base64 image required' });
    }

    const MAX_BASE64_LENGTH = 5 * 1024 * 1024;
    if (base64.length > MAX_BASE64_LENGTH) {
      return res.status(400).json({ error: 'File too large (max 5MB)' });
    }

    const result = await uploadMedia(base64, 'test-image.png', '/test');

    res.json({
      success: true,
      url: result.url,
      fileId: result.fileId
    });
  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;

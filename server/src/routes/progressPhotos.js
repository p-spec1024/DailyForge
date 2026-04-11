import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const MAX_PHOTOS_PER_USER = 50;
const ALLOWED_VIEWS = new Set(['front', 'side', 'back']);

// GET /api/progress-photos — metadata only (images live in IndexedDB on the client)
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, taken_at, view, local_storage_key, created_at
       FROM progress_photos
       WHERE user_id = $1
       ORDER BY taken_at DESC, id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/progress-photos — save metadata after IndexedDB write
router.post('/', async (req, res, next) => {
  try {
    const { taken_at, view, local_storage_key } = req.body || {};
    if (!local_storage_key || typeof local_storage_key !== 'string') {
      return res.status(400).json({ error: 'local_storage_key is required' });
    }
    const date = taken_at ? new Date(taken_at) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid taken_at' });
    }
    const safeView = typeof view === 'string' && ALLOWED_VIEWS.has(view) ? view : 'front';

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM progress_photos WHERE user_id = $1',
      [req.user.id]
    );
    if (countRows[0].count >= MAX_PHOTOS_PER_USER) {
      return res.status(409).json({ error: `Photo limit (${MAX_PHOTOS_PER_USER}) reached` });
    }

    const result = await pool.query(
      `INSERT INTO progress_photos (user_id, taken_at, view, local_storage_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, taken_at, view, local_storage_key, created_at`,
      [req.user.id, date.toISOString().slice(0, 10), safeView, local_storage_key.slice(0, 100)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/progress-photos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await pool.query(
      'DELETE FROM progress_photos WHERE id = $1 AND user_id = $2 RETURNING local_storage_key',
      [id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true, local_storage_key: result.rows[0].local_storage_key });
  } catch (err) {
    next(err);
  }
});

export default router;

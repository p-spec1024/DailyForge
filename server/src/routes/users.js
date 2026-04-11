import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/users/profile
router.get('/profile', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, height_cm, unit_system FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile — update height_cm and unit_system
router.put('/profile', async (req, res, next) => {
  try {
    const { height_cm, unit_system } = req.body || {};

    let heightCm = null;
    if (height_cm !== undefined && height_cm !== null && height_cm !== '') {
      const n = Number(height_cm);
      if (!Number.isFinite(n) || n < 50 || n > 280) {
        return res.status(400).json({ error: 'Invalid height_cm (50-280)' });
      }
      heightCm = n;
    }

    const unit = unit_system === 'imperial' ? 'imperial' : unit_system === 'metric' ? 'metric' : null;

    const result = await pool.query(
      `UPDATE users
       SET height_cm = COALESCE($1, height_cm),
           unit_system = COALESCE($2, unit_system)
       WHERE id = $3
       RETURNING id, email, name, height_cm, unit_system`,
      [heightCm, unit, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

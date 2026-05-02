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

const PILLARS = ['strength', 'yoga', 'breathwork'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

// POST /api/users/pillar-levels — upsert all 3 pillar levels for the
// authenticated user in a single transaction. Source is hardcoded to
// 'declared' (this endpoint is the onboarding-stub entry point).
//
// Body: { strength, yoga, breathwork } — each one of beginner/intermediate/advanced.
// 200 { ok, levels } on success. 400 with stable error codes on missing/invalid:
//   <pillar>_level_required, invalid_<pillar>_level (pillars checked in fixed order).
router.post('/pillar-levels', async (req, res, next) => {
  const body = req.body || {};
  for (const pillar of PILLARS) {
    if (!body[pillar]) {
      return res.status(400).json({ error: `${pillar}_level_required` });
    }
    if (!VALID_LEVELS.includes(body[pillar])) {
      return res.status(400).json({ error: `invalid_${pillar}_level` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const pillar of PILLARS) {
      await client.query(
        `INSERT INTO user_pillar_levels (user_id, pillar, level, source)
         VALUES ($1, $2, $3, 'declared')
         ON CONFLICT (user_id, pillar)
         DO UPDATE SET level = EXCLUDED.level, source = 'declared', updated_at = NOW()`,
        [req.user.id, pillar, body[pillar]]
      );
    }
    await client.query('COMMIT');
    res.json({
      ok: true,
      levels: {
        strength: body.strength,
        yoga: body.yoga,
        breathwork: body.breathwork,
      },
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* swallow — original err is the real story */ }
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/users/me/pillar-levels — return the authenticated user's
// declared/inferred levels (empty array for fresh users; that signal
// drives the onboarding-stub redirect on app launch).
router.get('/me/pillar-levels', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pillar, level, source
         FROM user_pillar_levels
        WHERE user_id = $1
        ORDER BY pillar ASC`,
      [req.user.id]
    );
    res.json({ levels: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;

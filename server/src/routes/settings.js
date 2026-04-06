import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const DEFAULTS = {
  rest_timer_duration: 90,
  rest_timer_enabled: true,
  rest_timer_auto_start: true,
};

// GET /api/settings — fetch user settings (return defaults if no row exists)
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT rest_timer_duration, rest_timer_enabled, rest_timer_auto_start
       FROM user_settings WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json(DEFAULTS);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings — update user settings (upsert)
router.put('/', async (req, res, next) => {
  try {
    const { rest_timer_duration, rest_timer_enabled, rest_timer_auto_start } = req.body;

    const duration = Number.isInteger(rest_timer_duration) && rest_timer_duration >= 10 && rest_timer_duration <= 600
      ? rest_timer_duration : DEFAULTS.rest_timer_duration;
    const enabled = typeof rest_timer_enabled === 'boolean' ? rest_timer_enabled : DEFAULTS.rest_timer_enabled;
    const autoStart = typeof rest_timer_auto_start === 'boolean' ? rest_timer_auto_start : DEFAULTS.rest_timer_auto_start;

    const result = await pool.query(
      `INSERT INTO user_settings (user_id, rest_timer_duration, rest_timer_enabled, rest_timer_auto_start, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET rest_timer_duration = EXCLUDED.rest_timer_duration,
                     rest_timer_enabled = EXCLUDED.rest_timer_enabled,
                     rest_timer_auto_start = EXCLUDED.rest_timer_auto_start,
                     updated_at = NOW()
       RETURNING rest_timer_duration, rest_timer_enabled, rest_timer_auto_start`,
      [req.user.id, duration, enabled, autoStart]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

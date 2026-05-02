// S13-T2: GET /api/focus-areas — read-only reference list of the 17 focus
// areas the Flutter home picker renders. JWT-authenticated per the Sprint 12
// convention (all /api routes require auth, even low-sensitivity reads).

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (_req, res) => {
  try {
    // `focus_type` and `sort_order` are aliased to `type` and `display_order` for
    // client contract stability. Column rename queued for a future schema migration.
    const result = await pool.query(`
      SELECT slug, display_name, focus_type AS type, sort_order AS display_order
        FROM focus_areas
       WHERE is_active = true
       ORDER BY focus_type ASC, sort_order ASC
    `);
    res.json({ focus_areas: result.rows });
  } catch (err) {
    console.error('GET /api/focus-areas error:', err);
    res.status(500).json({ error: 'engine_error' });
  }
});

export default router;

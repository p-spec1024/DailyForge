import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { recalculateBreathwork } from '../services/progressService.js';

const router = Router();

// GET /api/breathwork/techniques — list all (optionally filter by category)
router.get('/techniques', async (req, res, next) => {
  try {
    const { category } = req.query;

    let query = `SELECT id, name, sanskrit_name, tradition, category, purposes, difficulty,
      safety_level, caution_note, protocol FROM breathwork_techniques`;
    const params = [];

    if (category && category !== 'all') {
      query += ` WHERE category = $1`;
      params.push(category);
    }

    query += ` ORDER BY difficulty, name`;

    const { rows } = await pool.query(query, params);

    const techniques = rows.map((t) => {
      const { phases, cycles } = t.protocol;
      const phaseDuration = phases.reduce((sum, p) => sum + p.duration, 0);
      const totalDuration = Math.round(phaseDuration * (cycles || 1));
      return { ...t, estimated_duration: totalDuration };
    });

    res.json(techniques);
  } catch (err) {
    next(err);
  }
});

// GET /api/breathwork/techniques/:id — single technique with full protocol
router.get('/techniques/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM breathwork_techniques WHERE id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Technique not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/breathwork/sessions — log a completed breathwork session
router.post('/sessions', authenticate, async (req, res, next) => {
  try {
    const { technique_id, duration_seconds, rounds_completed, completed } = req.body;
    const user_id = req.user.id;

    if (!Number.isInteger(technique_id) || technique_id < 1) {
      return res.status(400).json({ error: 'Invalid technique_id' });
    }
    if (!Number.isInteger(duration_seconds) || duration_seconds < 0) {
      return res.status(400).json({ error: 'Invalid duration_seconds' });
    }
    if (!Number.isInteger(rounds_completed) || rounds_completed < 0) {
      return res.status(400).json({ error: 'Invalid rounds_completed' });
    }

    const { rows } = await pool.query(
      `INSERT INTO breathwork_sessions (user_id, technique_id, duration_seconds, rounds_completed, completed)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user_id, technique_id, duration_seconds, rounds_completed, !!completed],
    );

    // Update progression cache for this technique (fire-and-forget)
    if (completed) {
      recalculateBreathwork(user_id, technique_id).catch(() => {});
    }

    res.json({ id: rows[0].id, logged: true });
  } catch (err) {
    next(err);
  }
});

export default router;

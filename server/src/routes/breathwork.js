import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { recalculateBreathwork } from '../services/progressService.js';
import { getEstimatedDurationSeconds } from '../constants/breathwork-durations.js';

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

    const techniques = rows.map((t) => ({
      ...t,
      estimated_duration: getEstimatedDurationSeconds(t.name, t.category),
    }));

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
    const t = rows[0];
    res.json({
      ...t,
      estimated_duration: getEstimatedDurationSeconds(t.name, t.category),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/breathwork/alternatives — alternative techniques for mid-session swap
router.get('/alternatives', authenticate, async (req, res, next) => {
  try {
    const techniqueId = parseInt(req.query.techniqueId, 10);
    const { category } = req.query;

    if (isNaN(techniqueId)) {
      return res.status(400).json({ error: 'techniqueId is required' });
    }
    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    const { rows } = await pool.query(
      `SELECT id, name, tradition, category, difficulty, safety_level,
              (protocol->'phases') AS phases, (protocol->>'cycles')::int AS cycles
       FROM breathwork_techniques
       WHERE category = $1
         AND id != $2
         AND safety_level IN ('green', 'yellow')
       ORDER BY
         CASE WHEN safety_level = 'green' THEN 1 WHEN safety_level = 'yellow' THEN 2 ELSE 3 END,
         RANDOM()
       LIMIT 6`,
      [category, techniqueId]
    );

    const alternatives = rows.map((t) => ({
      id: t.id,
      name: t.name,
      tradition: t.tradition,
      category: t.category,
      difficulty: t.difficulty,
      safety_level: t.safety_level,
      estimated_duration: getEstimatedDurationSeconds(t.name, t.category),
    }));

    res.json({ alternatives });
  } catch (err) {
    next(err);
  }
});

// PUT /api/breathwork/preference — save preferred technique for a session phase
router.put('/preference', authenticate, async (req, res, next) => {
  try {
    const { phase } = req.body;
    const techniqueId = parseInt(req.body.technique_id, 10);
    if (!phase || !['opening', 'closing'].includes(phase)) {
      return res.status(400).json({ error: 'phase must be "opening" or "closing"' });
    }
    if (isNaN(techniqueId)) {
      return res.status(400).json({ error: 'technique_id must be a valid integer' });
    }

    await pool.query(
      `INSERT INTO user_breathwork_prefs (user_id, phase, technique_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, phase)
       DO UPDATE SET technique_id = EXCLUDED.technique_id, created_at = NOW()`,
      [req.user.id, phase, techniqueId]
    );

    res.json({ success: true, phase, technique_id: techniqueId });
  } catch (err) {
    next(err);
  }
});

// GET /api/breathwork/preferences — fetch user's saved breathwork phase preferences
router.get('/preferences', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ubp.phase, ubp.technique_id, bt.name AS technique_name
       FROM user_breathwork_prefs ubp
       JOIN breathwork_techniques bt ON bt.id = ubp.technique_id
       WHERE ubp.user_id = $1`,
      [req.user.id]
    );
    const prefs = {};
    for (const r of rows) {
      prefs[r.phase] = { technique_id: r.technique_id, technique_name: r.technique_name };
    }
    res.json(prefs);
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

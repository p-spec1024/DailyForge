import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// POST /api/session/start — start a new workout session
router.post('/start', async (req, res, next) => {
  try {
    const { workout_id, workout_ids } = req.body;
    // Support single workout_id (legacy) or array of workout_ids (phase-based)
    const primaryId = workout_id || (workout_ids && workout_ids[0]);
    if (!primaryId) {
      return res.status(400).json({ error: 'workout_id is required' });
    }

    const result = await pool.query(
      `INSERT INTO sessions (user_id, workout_id, started_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [req.user.id, primaryId]
    );

    // Copy exercises from ALL phase workouts into session_exercises
    const ids = workout_ids || [workout_id];
    for (let phaseIdx = 0; phaseIdx < ids.length; phaseIdx++) {
      await pool.query(
        `INSERT INTO session_exercises (session_id, exercise_id, sort_order)
         SELECT $1, e.id, e.sort_order + ($3 * 1000)
         FROM exercises e WHERE e.workout_id = $2
         ORDER BY e.sort_order`,
        [result.rows[0].id, ids[phaseIdx], phaseIdx]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/session/:id/complete — mark session as completed
router.put('/:id/complete', async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE sessions SET completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND completed_at IS NULL
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or already completed' });
    }

    // Auto-log habits with auto_type = 'workout'
    const autoHabits = await pool.query(
      `SELECT id FROM habits WHERE user_id = $1 AND active = true AND auto_type IN ('workout', 'breathwork')`,
      [req.user.id]
    );
    for (const habit of autoHabits.rows) {
      await pool.query(
        `INSERT INTO habit_entries (habit_id, entry_date, value)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (habit_id, entry_date) DO UPDATE SET value = 1`,
        [habit.id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

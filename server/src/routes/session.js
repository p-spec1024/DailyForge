import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// POST /api/session/start — start a new workout session
router.post('/start', async (req, res, next) => {
  try {
    const { workout_id, workout_ids, type = 'strength' } = req.body;
    const primaryId = workout_id || (workout_ids && workout_ids[0]);
    if (!primaryId) {
      return res.status(400).json({ error: 'workout_id is required' });
    }

    // Check for existing active (incomplete) session — return it instead of creating duplicate
    const existing = await pool.query(
      `SELECT * FROM sessions WHERE user_id = $1 AND completed = false ORDER BY started_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({ session: existing.rows[0] });
    }

    const result = await pool.query(
      `INSERT INTO sessions (user_id, workout_id, type, date, started_at)
       VALUES ($1, $2, $3, CURRENT_DATE, NOW())
       RETURNING *`,
      [req.user.id, primaryId, type]
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

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/session/active — check for active (incomplete) session
router.get('/active', async (req, res, next) => {
  try {
    const sessionResult = await pool.query(
      `SELECT * FROM sessions WHERE user_id = $1 AND completed = false ORDER BY started_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.json({ session: null, logged_sets: [] });
    }

    const session = sessionResult.rows[0];

    // Fetch all logged sets for this session
    const setsResult = await pool.query(
      `SELECT se.id, se.exercise_id, se.set_number, se.weight, se.reps_completed as reps,
              se.rpe, se.set_type, se.completed, se.notes, se.sort_order
       FROM session_exercises se
       WHERE se.session_id = $1
       ORDER BY se.exercise_id, se.set_number`,
      [session.id]
    );

    res.json({ session, logged_sets: setsResult.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/session/:id/log-set — log a single set during active session
router.put('/:id/log-set', async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const { exercise_id, set_number, weight, reps, rpe, set_type = 'normal' } = req.body;

    if (!exercise_id || !set_number) {
      return res.status(400).json({ error: 'exercise_id and set_number are required' });
    }

    // Verify session belongs to user and is not completed
    const sessionCheck = await pool.query(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND completed = false`,
      [sessionId, req.user.id]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Upsert: check if this set_number for this exercise already exists
    const existingSet = await pool.query(
      `SELECT id FROM session_exercises
       WHERE session_id = $1 AND exercise_id = $2 AND set_number = $3`,
      [sessionId, exercise_id, set_number]
    );

    let setResult;
    if (existingSet.rows.length > 0) {
      // UPDATE existing set
      setResult = await pool.query(
        `UPDATE session_exercises
         SET weight = $1, reps_completed = $2, rpe = $3, set_type = $4, completed = true
         WHERE id = $5
         RETURNING id, exercise_id, set_number, weight, reps_completed as reps, rpe, set_type, completed`,
        [weight, reps, rpe || null, set_type, existingSet.rows[0].id]
      );
    } else {
      // INSERT new set
      setResult = await pool.query(
        `INSERT INTO session_exercises (session_id, exercise_id, set_number, weight, reps_completed, rpe, set_type, completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING id, exercise_id, set_number, weight, reps_completed as reps, rpe, set_type, completed`,
        [sessionId, exercise_id, set_number, weight, reps, rpe || null, set_type]
      );
    }

    // Calculate running totals
    const totals = await pool.query(
      `SELECT
        COUNT(*) as total_sets,
        COALESCE(SUM(weight * reps_completed), 0) as total_volume,
        COUNT(DISTINCT exercise_id) as exercises_done
       FROM session_exercises
       WHERE session_id = $1 AND completed = true AND set_number IS NOT NULL`,
      [sessionId]
    );

    res.json({
      set: setResult.rows[0],
      session_totals: {
        total_sets: parseInt(totals.rows[0].total_sets),
        total_volume: parseFloat(totals.rows[0].total_volume),
        exercises_done: parseInt(totals.rows[0].exercises_done),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/session/:id/complete — finish the workout session
router.put('/:id/complete', async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    // Update session: completed, duration calculated from started_at
    const result = await pool.query(
      `UPDATE sessions
       SET completed = true,
           completed_at = NOW(),
           duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE id = $1 AND user_id = $2 AND completed = false
       RETURNING *`,
      [sessionId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or already completed' });
    }

    const session = result.rows[0];

    // Calculate summary stats
    const summary = await pool.query(
      `SELECT
        COUNT(*) as total_sets,
        COALESCE(SUM(weight * reps_completed), 0) as total_volume,
        COUNT(DISTINCT exercise_id) as exercises_completed,
        COALESCE(MAX(weight), 0) as max_weight
       FROM session_exercises
       WHERE session_id = $1 AND completed = true AND set_number IS NOT NULL`,
      [sessionId]
    );

    // Get per-exercise breakdown
    const exercises = await pool.query(
      `SELECT se.exercise_id, e.name, COUNT(*) as sets
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
       WHERE se.session_id = $1 AND se.completed = true AND se.set_number IS NOT NULL
       GROUP BY se.exercise_id, e.name
       ORDER BY MIN(se.id)`,
      [sessionId]
    );

    const stats = summary.rows[0];
    const durationSecs = session.duration || 0;
    const mins = Math.floor(durationSecs / 60);

    res.json({
      session: {
        id: session.id,
        completed: true,
        duration: durationSecs,
        started_at: session.started_at,
        completed_at: session.completed_at,
      },
      summary: {
        total_sets: parseInt(stats.total_sets),
        total_volume: parseFloat(stats.total_volume),
        exercises_completed: parseInt(stats.exercises_completed),
        max_weight: parseFloat(stats.max_weight),
        duration_formatted: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60} min` : `${mins} min`,
        exercises: exercises.rows.map(e => ({
          exercise_id: e.exercise_id,
          name: e.name,
          sets: parseInt(e.sets),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/session/:id — discard an active session
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2 AND completed = false RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

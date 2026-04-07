import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const ALLOWED_SESSION_TYPES = ['strength', 'yoga', 'breathwork', 'stretching'];
const ALLOWED_SET_TYPES = ['normal', 'warmup', 'dropset', 'failure'];

function parseIntParam(value) {
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

// POST /api/session/start — start a new workout session
router.post('/start', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { workout_id, workout_ids, type = 'strength' } = req.body;
    const primaryId = workout_id || (workout_ids && workout_ids[0]);
    if (!primaryId) {
      return res.status(400).json({ error: 'workout_id is required' });
    }
    const validatedType = ALLOWED_SESSION_TYPES.includes(type) ? type : 'strength';

    await client.query('BEGIN');

    // Lock row to prevent duplicate session creation (TOCTOU race)
    const existing = await client.query(
      `SELECT * FROM sessions WHERE user_id = $1 AND completed = false ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [req.user.id]
    );
    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return res.status(200).json({ session: existing.rows[0] });
    }

    const result = await client.query(
      `INSERT INTO sessions (user_id, workout_id, type, date, started_at)
       VALUES ($1, $2, $3, CURRENT_DATE, NOW())
       RETURNING *`,
      [req.user.id, primaryId, validatedType]
    );

    // Copy exercises from ALL phase workouts into session_exercises
    const ids = workout_ids || [workout_id];
    for (let phaseIdx = 0; phaseIdx < ids.length; phaseIdx++) {
      await client.query(
        `INSERT INTO session_exercises (session_id, exercise_id, sort_order)
         SELECT $1, e.id, e.sort_order + ($3 * 1000)
         FROM exercises e WHERE e.workout_id = $2
         ORDER BY e.sort_order`,
        [result.rows[0].id, ids[phaseIdx], phaseIdx]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
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
    const sessionId = parseIntParam(req.params.id);
    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const { exercise_id, set_number, weight, reps, rpe, set_type = 'normal' } = req.body;
    const exId = parseIntParam(exercise_id);
    const setNum = parseIntParam(set_number);
    if (!exId || !setNum) {
      return res.status(400).json({ error: 'exercise_id and set_number are required' });
    }

    const weightVal = parseFloat(weight);
    const repsVal = parseInt(reps, 10);
    if (isNaN(weightVal) || isNaN(repsVal) || weightVal < 0 || repsVal < 0 || repsVal > 999) {
      return res.status(400).json({ error: 'Invalid weight or reps values' });
    }
    const rpeVal = rpe != null ? parseFloat(rpe) : null;
    if (rpeVal !== null && (isNaN(rpeVal) || rpeVal < 1 || rpeVal > 10)) {
      return res.status(400).json({ error: 'RPE must be between 1 and 10' });
    }
    const validatedSetType = ALLOWED_SET_TYPES.includes(set_type) ? set_type : 'normal';

    // Verify session belongs to user and is not completed
    const sessionCheck = await pool.query(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND completed = false`,
      [sessionId, req.user.id]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Atomic upsert using ON CONFLICT
    const setResult = await pool.query(
      `INSERT INTO session_exercises (session_id, exercise_id, set_number, weight, reps_completed, rpe, set_type, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (session_id, exercise_id, set_number)
       DO UPDATE SET weight = EXCLUDED.weight, reps_completed = EXCLUDED.reps_completed,
                     rpe = EXCLUDED.rpe, set_type = EXCLUDED.set_type, completed = true
       RETURNING id, exercise_id, set_number, weight, reps_completed as reps, rpe, set_type, completed`,
      [sessionId, exId, setNum, weightVal, repsVal, rpeVal, validatedSetType]
    );

    // Calculate running totals and detect PRs in parallel
    const currentWeight = weightVal;
    const currentReps = repsVal;
    const currentVolume = weightVal * repsVal;

    const [totals, historicalBests] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) as total_sets,
          COALESCE(SUM(weight * reps_completed), 0) as total_volume,
          COUNT(DISTINCT exercise_id) as exercises_done
         FROM session_exercises
         WHERE session_id = $1 AND completed = true AND set_number IS NOT NULL`,
        [sessionId]
      ),
      // Historical bests from completed past sessions only
      pool.query(
        `SELECT
           MAX(se.weight) as best_weight,
           MAX(se.weight * se.reps_completed) as best_volume,
           MAX(se.reps_completed) FILTER (WHERE se.weight = $3) as best_reps_at_weight
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
         WHERE s.user_id = $1 AND s.completed = true
           AND se.exercise_id = $2
           AND se.completed = true AND se.set_number IS NOT NULL
           AND se.weight IS NOT NULL AND se.weight > 0`,
        [req.user.id, exId, currentWeight]
      ),
    ]);

    // Build PR list for this set
    const prs = [];
    const hist = historicalBests.rows[0];
    const prevBestWeight = hist?.best_weight != null ? parseFloat(hist.best_weight) : null;
    const prevBestVolume = hist?.best_volume != null ? parseFloat(hist.best_volume) : null;
    const prevBestReps = hist?.best_reps_at_weight != null ? parseInt(hist.best_reps_at_weight) : null;

    // Weight PR — only if there's previous history to beat
    if (currentWeight > 0 && prevBestWeight !== null && prevBestWeight > 0 && currentWeight > prevBestWeight) {
      prs.push({ type: 'weight', previous: `${prevBestWeight}kg`, new: `${currentWeight}kg` });
    }
    // Volume PR — weight × reps
    if (currentVolume > 0 && prevBestVolume !== null && prevBestVolume > 0 && currentVolume > prevBestVolume) {
      prs.push({ type: 'volume', previous: `${prevBestVolume}`, new: `${currentVolume}` });
    }
    // Reps PR — most reps at this exact weight
    if (currentWeight > 0 && currentReps > 0 && prevBestReps !== null && prevBestReps > 0 && currentReps > prevBestReps) {
      prs.push({ type: 'reps', previous: `${prevBestReps}`, new: `${currentReps}` });
    }

    res.json({
      set: setResult.rows[0],
      session_totals: {
        total_sets: parseInt(totals.rows[0].total_sets),
        total_volume: parseFloat(totals.rows[0].total_volume),
        exercises_done: parseInt(totals.rows[0].exercises_done),
      },
      prs,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/session/:id/complete — finish the workout session
router.put('/:id/complete', async (req, res, next) => {
  try {
    const sessionId = parseIntParam(req.params.id);
    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

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

    // Calculate summary stats, exercise breakdown, and PR detection in parallel
    const [summary, exercises, currentBests, previousBests] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) as total_sets,
          COALESCE(SUM(weight * reps_completed), 0) as total_volume,
          COUNT(DISTINCT exercise_id) as exercises_completed,
          COALESCE(MAX(weight), 0) as max_weight
         FROM session_exercises
         WHERE session_id = $1 AND completed = true AND set_number IS NOT NULL`,
        [sessionId]
      ),
      pool.query(
        `SELECT se.exercise_id, e.name, COUNT(*) as sets
         FROM session_exercises se
         JOIN exercises e ON e.id = se.exercise_id
         WHERE se.session_id = $1 AND se.completed = true AND se.set_number IS NOT NULL
         GROUP BY se.exercise_id, e.name
         ORDER BY MIN(se.id)`,
        [sessionId]
      ),
      // Current session bests per exercise (max weight, max reps, max volume)
      pool.query(
        `SELECT se.exercise_id, e.name,
           MAX(se.weight) as best_weight,
           MAX(se.reps_completed) as best_reps,
           MAX(se.weight * se.reps_completed) as best_volume
         FROM session_exercises se
         JOIN exercises e ON e.id = se.exercise_id
         WHERE se.session_id = $1 AND se.completed = true AND se.set_number IS NOT NULL
           AND se.weight IS NOT NULL AND se.weight > 0
         GROUP BY se.exercise_id, e.name`,
        [sessionId]
      ),
      // Previous session bests per exercise (excluding current session).
      // Note: rep PRs compare global max reps, not per-weight. E.g. doing 8 reps
      // at 60kg beats a previous best of 5 reps at 100kg. This is intentional —
      // per-weight comparison gets noisy with fractional weight differences.
      pool.query(
        `SELECT se.exercise_id,
           MAX(se.weight) as prev_best_weight,
           MAX(se.reps_completed) as prev_best_reps,
           MAX(se.weight * se.reps_completed) as prev_best_volume
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
         WHERE s.user_id = $1 AND se.session_id != $2
           AND s.completed = true
           AND se.completed = true AND se.set_number IS NOT NULL
           AND se.weight IS NOT NULL AND se.weight > 0
         GROUP BY se.exercise_id`,
        [req.user.id, sessionId]
      ),
    ]);

    // Build PR list
    const prevMap = {};
    for (const row of previousBests.rows) {
      prevMap[row.exercise_id] = row;
    }

    const prs = [];
    for (const cur of currentBests.rows) {
      const prev = prevMap[cur.exercise_id];
      const prevWeight = prev ? parseFloat(prev.prev_best_weight) : 0;
      const prevReps = prev ? parseInt(prev.prev_best_reps) : 0;
      const prevVolume = prev ? parseFloat(prev.prev_best_volume) : 0;
      const curWeight = parseFloat(cur.best_weight);
      const curReps = parseInt(cur.best_reps);
      const curVolume = parseFloat(cur.best_volume);

      if (curWeight > prevWeight && prevWeight > 0) {
        prs.push({
          exercise_id: cur.exercise_id,
          exercise_name: cur.name,
          pr_type: 'weight',
          new_value: curWeight,
          previous_best: prevWeight,
          unit: 'kg',
        });
      }
      if (curVolume > prevVolume && prevVolume > 0) {
        prs.push({
          exercise_id: cur.exercise_id,
          exercise_name: cur.name,
          pr_type: 'volume',
          new_value: curVolume,
          previous_best: prevVolume,
          unit: 'vol',
        });
      }
      if (curReps > prevReps && prevReps > 0) {
        prs.push({
          exercise_id: cur.exercise_id,
          exercise_name: cur.name,
          pr_type: 'reps',
          new_value: curReps,
          previous_best: prevReps,
          unit: 'reps',
        });
      }
    }

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
        duration_seconds: durationSecs,
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
      prs,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/session/:id — discard an active session
router.delete('/:id', async (req, res, next) => {
  try {
    const sessionId = parseIntParam(req.params.id);
    if (!sessionId) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const result = await pool.query(
      `DELETE FROM sessions WHERE id = $1 AND user_id = $2 AND completed = false RETURNING id`,
      [sessionId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/session/previous-performance — get last completed session data per exercise
router.get('/previous-performance', async (req, res, next) => {
  try {
    const { exerciseIds } = req.query;
    if (!exerciseIds) {
      return res.status(400).json({ error: 'exerciseIds query parameter is required' });
    }

    const ids = exerciseIds.split(',').map(id => parseIntParam(id.trim())).filter(id => id !== null);
    if (ids.length === 0) {
      return res.json({ previousPerformance: {} });
    }
    if (ids.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 exercise IDs allowed' });
    }

    // Find current active session to exclude it
    const activeSession = await pool.query(
      `SELECT id FROM sessions WHERE user_id = $1 AND completed = false ORDER BY started_at DESC LIMIT 1`,
      [req.user.id]
    );
    const activeSessionId = activeSession.rows[0]?.id ?? -1;

    // For each exercise, find the most recent completed session that included it,
    // then return all sets from that session for that exercise
    const previousPerformance = {};

    // Build a single query using DISTINCT ON to get the most recent session per exercise
    // Then fetch all sets from those sessions
    const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');
    const latestSessions = await pool.query(
      `SELECT DISTINCT ON (se.exercise_id)
         se.exercise_id, s.id as session_id, s.date as session_date
       FROM session_exercises se
       JOIN sessions s ON se.session_id = s.id
       WHERE s.user_id = $1
         AND s.completed = true
         AND s.id != $2
         AND se.exercise_id IN (${placeholders})
         AND se.set_number IS NOT NULL
         AND se.completed = true
       ORDER BY se.exercise_id, s.date DESC, s.id DESC`,
      [req.user.id, activeSessionId, ...ids]
    );

    if (latestSessions.rows.length > 0) {
      // Build map of exercise_id -> { session_id, session_date }
      const sessionMap = {};
      for (const row of latestSessions.rows) {
        sessionMap[row.exercise_id] = { sessionId: row.session_id, sessionDate: row.session_date };
      }

      // Fetch all sets from those sessions for those exercises in one query
      const exIds = latestSessions.rows.map(r => r.exercise_id);
      const sessIds = latestSessions.rows.map(r => r.session_id);

      const exPlaceholders = exIds.map((_, i) => `$${i + 1}`).join(',');
      const sessPlaceholders = sessIds.map((_, i) => `$${i + exIds.length + 1}`).join(',');

      const setsResult = await pool.query(
        `SELECT se.exercise_id, se.session_id, se.set_number, se.weight, se.reps_completed as reps, se.rpe
         FROM session_exercises se
         WHERE se.exercise_id IN (${exPlaceholders})
           AND se.session_id IN (${sessPlaceholders})
           AND se.set_number IS NOT NULL
           AND se.completed = true
         ORDER BY se.exercise_id, se.set_number`,
        [...exIds, ...sessIds]
      );

      // Group sets by exercise, only keeping sets from the correct session
      for (const row of setsResult.rows) {
        const info = sessionMap[row.exercise_id];
        if (!info || row.session_id !== info.sessionId) continue;

        if (!previousPerformance[row.exercise_id]) {
          previousPerformance[row.exercise_id] = {
            sessionDate: info.sessionDate,
            sets: [],
          };
        }
        previousPerformance[row.exercise_id].sets.push({
          setNumber: row.set_number,
          weight: row.weight != null ? parseFloat(row.weight) : null,
          reps: row.reps != null ? parseInt(row.reps) : null,
          rpe: row.rpe != null ? parseFloat(row.rpe) : null,
        });
      }
    }

    // Fill in nulls for exercises with no previous data
    for (const id of ids) {
      if (!previousPerformance[id]) {
        previousPerformance[id] = null;
      }
    }

    res.json({ previousPerformance });
  } catch (err) {
    next(err);
  }
});

export default router;

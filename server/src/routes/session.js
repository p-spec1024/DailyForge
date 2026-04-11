import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { recalculateForSession } from '../services/progressService.js';

const router = Router();
router.use(authenticate);

const ALLOWED_SESSION_TYPES = ['strength', 'yoga', 'breathwork', 'stretching', '5phase'];
const ALLOWED_SET_TYPES = ['normal', 'warmup', 'dropset', 'failure'];

// Breathwork technique mapping per workout type
const TECHNIQUE_MAP = {
  push:      { opening: 'Kapalabhati', closing: 'Anulom Vilom' },
  pull:      { opening: 'Kapalabhati', closing: 'Anulom Vilom' },
  upper:     { opening: 'Kapalabhati', closing: 'Anulom Vilom' },
  legs:      { opening: 'Bhastrika', closing: '4-7-8 Breathing' },
  lower:     { opening: 'Bhastrika', closing: '4-7-8 Breathing' },
  full_body: { opening: 'Breath of Fire', closing: 'Bhramari' },
  hiit:      { opening: 'Wim Hof Breathing', closing: 'Box Breathing' },
  yoga:      { opening: 'Ujjayi', closing: 'Yoga Nidra Breath' },
  rest:      { opening: 'Diaphragmatic Breathing', closing: 'Left Nostril Breathing' },
};

// Focus area mapping per workout type
const FOCUS_MAP = {
  push:      ['chest', 'shoulders'],
  pull:      ['back', 'spine'],
  upper:     ['shoulders', 'chest', 'spine'],
  legs:      ['hips', 'legs'],
  lower:     ['hips', 'legs'],
  full_body: ['full body'],
  hiit:      ['full body'],
  yoga:      ['full body'],
  rest:      ['full body'],
};

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

    // Fire-and-forget progression cache recalc for all exercises in this session
    recalculateForSession(sessionId).catch(() => {});

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

// GET /api/session/overview/:workoutId — pre-session overview for 5-phase flow
router.get('/overview/:workoutId', async (req, res, next) => {
  try {
    const workoutId = parseIntParam(req.params.workoutId);
    if (!workoutId) {
      return res.status(400).json({ error: 'Invalid workout ID' });
    }

    // Get workout info
    const wResult = await pool.query(
      `SELECT w.id, w.name, ws.day_of_week, ws.label
       FROM workouts w
       JOIN workout_slots ws ON ws.workout_id = w.id AND ws.phase = 'main'
       WHERE w.id = $1
       LIMIT 1`,
      [workoutId]
    );

    const workout = wResult.rows[0];
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    // Count exercises and estimate duration for main work
    // Formula: exercises × avgSets × 2 min (~30s work + ~90s rest per set)
    // Must match client-side calculation in Workout.jsx
    const exResult = await pool.query(
      `SELECT COUNT(*) as count,
              COALESCE(AVG(COALESCE(default_sets, 3)), 3) as avg_sets
       FROM exercises WHERE workout_id = $1 AND sort_order >= 0`,
      [workoutId]
    );
    const exerciseCount = parseInt(exResult.rows[0].count);
    const avgSets = parseFloat(exResult.rows[0].avg_sets) || 3;
    const mainEstSecs = Math.round(exerciseCount * avgSets * 2) * 60;

    // Determine workout type from name for breathwork/focus mapping
    const nameLower = workout.name.toLowerCase();
    let workoutType = 'full_body';
    if (nameLower.includes('push')) workoutType = 'push';
    else if (nameLower.includes('pull')) workoutType = 'pull';
    else if (nameLower.includes('leg') || nameLower.includes('lower')) workoutType = 'legs';
    else if (nameLower.includes('upper')) workoutType = 'upper';
    else if (nameLower.includes('hiit') || nameLower.includes('cardio')) workoutType = 'hiit';
    else if (nameLower.includes('yoga')) workoutType = 'yoga';
    else if (nameLower.includes('rest') || nameLower.includes('recovery')) workoutType = 'rest';

    const techniqueNames = TECHNIQUE_MAP[workoutType] || TECHNIQUE_MAP.full_body;

    // Look up technique IDs from breathwork_techniques
    const [openingTech, closingTech] = await Promise.all([
      pool.query(`SELECT id, name FROM breathwork_techniques WHERE LOWER(name) = LOWER($1) LIMIT 1`, [techniqueNames.opening]),
      pool.query(`SELECT id, name FROM breathwork_techniques WHERE LOWER(name) = LOWER($1) LIMIT 1`, [techniqueNames.closing]),
    ]);

    // Fallback: grab any energizing/calming technique
    let openingId = openingTech.rows[0]?.id || null;
    let openingName = openingTech.rows[0]?.name || techniqueNames.opening;
    let closingId = closingTech.rows[0]?.id || null;
    let closingName = closingTech.rows[0]?.name || techniqueNames.closing;

    if (!openingId) {
      const fb = await pool.query(`SELECT id, name FROM breathwork_techniques WHERE category = 'energizing' LIMIT 1`);
      if (fb.rows[0]) { openingId = fb.rows[0].id; openingName = fb.rows[0].name; }
    }
    if (!closingId) {
      const fb = await pool.query(`SELECT id, name FROM breathwork_techniques WHERE category = 'calming' LIMIT 1`);
      if (fb.rows[0]) { closingId = fb.rows[0].id; closingName = fb.rows[0].name; }
    }

    const focusAreas = FOCUS_MAP[workoutType] || ['full body'];

    const warmupDuration = 300;
    const cooldownDuration = 300;
    const breathworkDuration = 300;

    res.json({
      workout: {
        id: workout.id,
        name: workout.name,
        day_of_week: workout.day_of_week,
        label: workout.label,
        type: workoutType,
      },
      phases: {
        opening_breathwork: {
          suggested_technique_id: openingId,
          suggested_technique_name: openingName,
          duration: breathworkDuration,
        },
        warmup: {
          default_duration: warmupDuration,
          default_level: 'beginner',
          focus_areas: focusAreas,
        },
        main_work: {
          exercise_count: exerciseCount,
          estimated_duration: mainEstSecs,
        },
        cooldown: {
          default_duration: cooldownDuration,
          default_level: 'beginner',
          focus_areas: focusAreas,
        },
        closing_breathwork: {
          suggested_technique_id: closingId,
          suggested_technique_name: closingName,
          duration: breathworkDuration,
        },
      },
      total_estimated_duration: breathworkDuration * 2 + warmupDuration + cooldownDuration + mainEstSecs,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/session/complete-5phase — log a completed 5-phase session
router.post('/complete-5phase', async (req, res, next) => {
  try {
    const { session_id, workout_id, total_duration, phases } = req.body;

    if (!phases || typeof phases !== 'object' || Array.isArray(phases)) {
      return res.status(400).json({ error: 'phases object is required' });
    }

    const phasesStr = JSON.stringify(phases);
    if (phasesStr.length > 50000) {
      return res.status(400).json({ error: 'phases data too large' });
    }

    const dur = Math.max(0, parseInt(total_duration, 10) || 0);

    if (session_id) {
      // Update existing session
      const result = await pool.query(
        `UPDATE sessions
         SET completed = true, completed_at = NOW(),
             duration = $1, type = '5phase', phases_json = $2
         WHERE id = $3 AND user_id = $4
         RETURNING *`,
        [dur, phasesStr, session_id, req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      recalculateForSession(result.rows[0].id).catch(() => {});
      return res.json({ session: result.rows[0], logged: true });
    }

    // Create new session record
    const wId = workout_id ? parseInt(workout_id, 10) : null;
    const result = await pool.query(
      `INSERT INTO sessions (user_id, workout_id, type, date, started_at, completed_at, completed, duration, phases_json)
       VALUES ($1, $2, '5phase', CURRENT_DATE, NOW() - INTERVAL '1 second' * $3, NOW(), true, $3, $4)
       RETURNING *`,
      [req.user.id, wId, dur, phasesStr]
    );

    recalculateForSession(result.rows[0].id).catch(() => {});
    res.status(201).json({ session: result.rows[0], logged: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/session/calendar?month=YYYY-MM — sessions grouped by day + streak
router.get('/calendar', async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month query (YYYY-MM) is required' });
    }
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10);
    if (mon < 1 || mon > 12) {
      return res.status(400).json({ error: 'Invalid month' });
    }

    // Month range [first, firstOfNext)
    const firstOfMonth = `${yearStr}-${monthStr}-01`;
    const nextMon = mon === 12 ? 1 : mon + 1;
    const nextYear = mon === 12 ? year + 1 : year;
    const firstOfNext = `${nextYear}-${String(nextMon).padStart(2, '0')}-01`;

    // Fetch month sessions (completed only) joined with workout name
    const sessionsRes = await pool.query(
      `SELECT s.id, s.date, s.type, s.duration, s.phases_json, s.workout_id, w.name AS workout_name
         FROM sessions s
         LEFT JOIN workouts w ON w.id = s.workout_id
        WHERE s.user_id = $1
          AND s.completed = true
          AND s.date >= $2::date
          AND s.date <  $3::date
        ORDER BY s.date ASC, s.id ASC`,
      [req.user.id, firstOfMonth, firstOfNext]
    );

    // For session_exercises exercise count (non-5phase types)
    const sessionIds = sessionsRes.rows.map(r => r.id);
    const exerciseCounts = {};
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map((_, i) => `$${i + 1}`).join(',');
      const countsRes = await pool.query(
        `SELECT session_id, COUNT(DISTINCT exercise_id)::int AS cnt
           FROM session_exercises
          WHERE session_id IN (${placeholders})
            AND completed = true
            AND set_number IS NOT NULL
          GROUP BY session_id`,
        sessionIds
      );
      for (const row of countsRes.rows) {
        exerciseCounts[row.session_id] = row.cnt;
      }
    }

    const sessions = sessionsRes.rows.map(row => {
      const phases = row.phases_json || null;

      // Pick the "dominant" activity for a 5-phase session: whichever phase
      // actually ran. Strength main work wins if it has any exercises, else
      // yoga if warmup/cooldown ran, else breathwork.
      let mainWorkType;
      if (row.type !== '5phase') {
        mainWorkType = row.type;
      } else if (phases?.main_work?.exerciseNames?.length > 0) {
        mainWorkType = 'strength';
      } else if (phases?.warmup?.completed || phases?.cooldown?.completed) {
        mainWorkType = 'yoga';
      } else if (phases?.opening_breathwork?.completed || phases?.closing_breathwork?.completed) {
        mainWorkType = 'breathwork';
      } else {
        mainWorkType = 'strength';
      }

      let exerciseCount = 0;
      let prCount = 0;
      let summary = null;

      if (mainWorkType === 'strength') {
        if (phases?.main_work?.exerciseNames?.length > 0) {
          exerciseCount = phases.main_work.exerciseNames.length;
          prCount = parseInt(phases.main_work.prs, 10) || 0;
        } else {
          exerciseCount = exerciseCounts[row.id] || 0;
        }
        summary = row.workout_name || 'Strength';
      } else if (mainWorkType === 'yoga') {
        const poseCount = (phases?.warmup?.poses_done || 0) + (phases?.cooldown?.poses_done || 0);
        exerciseCount = poseCount;
        summary = row.workout_name || 'Yoga flow';
      } else if (mainWorkType === 'breathwork') {
        summary = phases?.opening_breathwork?.technique_name
               || phases?.closing_breathwork?.technique_name
               || 'Breathwork';
      } else {
        summary = row.workout_name || row.type;
      }

      return {
        id: row.id,
        date: typeof row.date === 'string' ? row.date : row.date.toISOString().slice(0, 10),
        type: row.type,
        main_work_type: mainWorkType,
        duration: row.duration || 0,
        summary,
        exercise_count: exerciseCount,
        pr_count: prCount,
      };
    });

    // Streak: consecutive days with ≥1 completed session counting back from today.
    // Grace rule: if today has no session, start counting from yesterday.
    const streakRes = await pool.query(
      `SELECT DISTINCT date::text AS d
         FROM sessions
        WHERE user_id = $1 AND completed = true
        ORDER BY d DESC
        LIMIT 400`,
      [req.user.id]
    );
    const sessionDates = new Set(streakRes.rows.map(r => r.d));

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let current = 0;
    const currentDates = [];
    let cursor;
    if (sessionDates.has(todayStr)) {
      cursor = new Date(today);
    } else if (sessionDates.has(yesterdayStr)) {
      cursor = new Date(yesterday);
    } else {
      cursor = null;
    }
    while (cursor) {
      const ds = cursor.toISOString().slice(0, 10);
      if (sessionDates.has(ds)) {
        current += 1;
        currentDates.push(ds);
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // Best streak: scan all historical dates once
    let best = 0;
    const sortedAsc = [...sessionDates].sort();
    let run = 0;
    let prev = null;
    for (const ds of sortedAsc) {
      if (prev) {
        const prevD = new Date(prev);
        prevD.setDate(prevD.getDate() + 1);
        const expected = prevD.toISOString().slice(0, 10);
        if (expected === ds) {
          run += 1;
        } else {
          run = 1;
        }
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prev = ds;
    }
    if (current > best) best = current;

    res.json({
      sessions,
      streak: { current, best, dates: currentDates },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

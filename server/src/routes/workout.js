import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const PHASE_ORDER = {
  opening_breathwork: 1,
  warmup: 2,
  main: 3,
  cooldown: 4,
  closing_breathwork: 5,
};

const PHASE_META = {
  opening_breathwork: { label: 'Opening Breathwork', color: '#a78bfa', default_duration_min: 5 },
  warmup: { label: 'Warm-up', color: '#5DCAA5', default_duration_min: 5 },
  main: { label: 'Main Work', color: '#D85A30', default_duration_min: 35 },
  cooldown: { label: 'Cool-down', color: '#5DCAA5', default_duration_min: 7 },
  closing_breathwork: { label: 'Closing Breathwork', color: '#a78bfa', default_duration_min: 5 },
};

// GET /api/workout/today — get today's workout with all phases
router.get('/today', async (req, res, next) => {
  try {
    const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, ...

    // Get ALL workout_slots for today, across all phases
    // Check user_slot_prefs for the main phase, use defaults for others
    const slotsResult = await pool.query(
      `SELECT ws.id AS slot_id, ws.day_of_week, ws.label, ws.phase,
              COALESCE(usp.workout_id, ws.workout_id) AS workout_id,
              w.name AS workout_name, w.description AS workout_description
       FROM workout_slots ws
       LEFT JOIN user_slot_prefs usp ON usp.slot_id = ws.id AND usp.user_id = $1
       JOIN workouts w ON w.id = COALESCE(usp.workout_id, ws.workout_id)
       WHERE ws.day_of_week = $2
       ORDER BY ws.phase`,
      [req.user.id, dayOfWeek]
    );

    if (slotsResult.rows.length === 0) {
      return res.json({ day_of_week: dayOfWeek, name: null, phases: [] });
    }

    // Find the main workout name for the header
    const mainSlot = slotsResult.rows.find(s => s.phase === 'main');
    const dayName = slotsResult.rows[0]?.label || '';

    // Fetch exercises for ALL workout_ids in one query (only real exercises, not alternatives)
    const workoutIds = [...new Set(slotsResult.rows.map(s => s.workout_id))];
    const exercisesResult = await pool.query(
      `SELECT e.id, e.workout_id, e.name, e.sanskrit_name, e.target_muscles, e.type,
              e.default_sets, e.default_reps, e.default_duration_secs,
              e.description, e.url, e.source, e.difficulty, e.sort_order,
              COALESCE(e.tracking_type, 'weight_reps') AS tracking_type
       FROM exercises e
       WHERE e.workout_id = ANY($1) AND e.sort_order >= 0
       ORDER BY e.sort_order`,
      [workoutIds]
    );

    // Get user exercise preferences to swap in chosen exercises
    const defaultExIds = exercisesResult.rows.map(e => e.id);
    const prefsResult = defaultExIds.length > 0 ? await pool.query(
      `SELECT uep.exercise_id AS original_id, e.id, e.name, e.sanskrit_name,
              e.target_muscles, e.type, e.default_sets, e.default_reps,
              e.default_duration_secs, e.description, e.url, e.source, e.difficulty,
              COALESCE(e.tracking_type, 'weight_reps') AS tracking_type
       FROM user_exercise_prefs uep
       JOIN exercises e ON e.id = uep.chosen_exercise_id
       WHERE uep.user_id = $1 AND uep.exercise_id = ANY($2)`,
      [req.user.id, defaultExIds]
    ) : { rows: [] };

    // Build map of original_exercise_id -> chosen exercise data
    const prefMap = {};
    for (const p of prefsResult.rows) {
      prefMap[p.original_id] = p;
    }

    // Group exercises by workout_id, applying user preferences
    const exercisesByWorkout = {};
    for (const ex of exercisesResult.rows) {
      if (!exercisesByWorkout[ex.workout_id]) exercisesByWorkout[ex.workout_id] = [];
      const pref = prefMap[ex.id];
      const src = pref || ex;
      exercisesByWorkout[ex.workout_id].push({
        id: src.id,
        name: src.name,
        sanskrit_name: src.sanskrit_name,
        target_muscles: src.target_muscles,
        exercise_type: src.type,
        default_sets: src.default_sets,
        default_reps: src.default_reps,
        default_duration_secs: src.default_duration_secs,
        description: src.description,
        url: src.url,
        source: src.source,
        difficulty: src.difficulty,
        tracking_type: src.tracking_type || 'weight_reps',
        // Always include the slot default exercise id for reset comparison
        default_exercise_id: ex.id,
        default_exercise_name: ex.name,
        // Include original exercise info if swapped, for reset functionality
        ...(pref ? { original_exercise_id: ex.id, original_exercise_name: ex.name } : {}),
      });
    }

    // Build phases array sorted by phase order
    const phases = slotsResult.rows
      .sort((a, b) => (PHASE_ORDER[a.phase] || 99) - (PHASE_ORDER[b.phase] || 99))
      .map(slot => {
        const meta = PHASE_META[slot.phase] || { label: slot.phase, color: '#D85A30', default_duration_min: 5 };
        const exercises = exercisesByWorkout[slot.workout_id] || [];

        // Estimate duration from exercises
        let estimatedMin = meta.default_duration_min;
        if (exercises.length > 0) {
          const totalSecs = exercises.reduce((sum, ex) => {
            if (ex.default_duration_secs) return sum + ex.default_duration_secs;
            // Estimate strength exercises at ~45s per set
            return sum + (ex.default_sets || 3) * 45;
          }, 0);
          estimatedMin = Math.max(meta.default_duration_min, Math.round(totalSecs / 60));
        }

        return {
          phase: slot.phase,
          label: meta.label,
          duration_min: estimatedMin,
          color: meta.color,
          workout_id: slot.workout_id,
          exercises,
        };
      });

    res.json({
      day_of_week: dayOfWeek,
      day_label: dayName,
      name: mainSlot ? mainSlot.workout_name : dayName,
      type: mainSlot ? mainSlot.workout_description : null,
      phases,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/workout/:workoutId/slots/:exerciseId/alternatives
router.get('/:workoutId/slots/:exerciseId/alternatives', async (req, res, next) => {
  try {
    const workoutId = parseInt(req.params.workoutId, 10);
    const exerciseId = parseInt(req.params.exerciseId, 10);
    if (isNaN(workoutId) || isNaN(exerciseId)) {
      return res.status(400).json({ error: 'Invalid workout or exercise ID' });
    }

    // Get the default exercise info
    const defaultEx = await pool.query(
      `SELECT id, name, target_muscles, difficulty FROM exercises WHERE id = $1`,
      [exerciseId]
    );
    if (defaultEx.rows.length === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    // Get alternatives
    const alts = await pool.query(
      `SELECT e.id, e.name, e.target_muscles, e.difficulty
       FROM slot_alternatives sa
       JOIN exercises e ON e.id = sa.alternative_exercise_id
       WHERE sa.exercise_id = $1
       ORDER BY e.name`,
      [exerciseId]
    );

    // Get user preference for this exercise
    const pref = await pool.query(
      `SELECT uep.chosen_exercise_id, e.name
       FROM user_exercise_prefs uep
       JOIN exercises e ON e.id = uep.chosen_exercise_id
       WHERE uep.user_id = $1 AND uep.exercise_id = $2`,
      [req.user.id, exerciseId]
    );

    const def = defaultEx.rows[0];
    res.json({
      slot_id: exerciseId,
      default_exercise: {
        id: def.id,
        name: def.name,
        muscle_groups: def.target_muscles ? def.target_muscles.split(',').map(m => m.trim()) : [],
      },
      alternatives: alts.rows.map(a => ({
        id: a.id,
        name: a.name,
        target_muscles: a.target_muscles || '',
        muscle_groups: a.target_muscles ? a.target_muscles.split(',').map(m => m.trim()) : [],
        difficulty: a.difficulty || 'intermediate',
      })),
      user_preference: pref.rows.length > 0
        ? { id: pref.rows[0].chosen_exercise_id, name: pref.rows[0].name }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/workout/slot/:exerciseId/choose — save preferred exercise for a slot
router.put('/slot/:exerciseId/choose', async (req, res, next) => {
  try {
    const exerciseId = parseInt(req.params.exerciseId, 10);
    const chosenId = parseInt(req.body.chosen_exercise_id, 10);
    if (isNaN(exerciseId) || isNaN(chosenId)) {
      return res.status(400).json({ error: 'exercise_id and chosen_exercise_id must be valid integers' });
    }

    // Verify the chosen exercise is a valid alternative for this slot
    const valid = await pool.query(
      `SELECT 1 FROM slot_alternatives
       WHERE exercise_id = $1 AND alternative_exercise_id = $2`,
      [exerciseId, chosenId]
    );
    if (valid.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid alternative for this exercise' });
    }

    // Upsert user preference
    await pool.query(
      `INSERT INTO user_exercise_prefs (user_id, exercise_id, chosen_exercise_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, exercise_id)
       DO UPDATE SET chosen_exercise_id = EXCLUDED.chosen_exercise_id, created_at = NOW()`,
      [req.user.id, exerciseId, chosenId]
    );

    res.json({ success: true, slot_id: exerciseId, chosen_exercise_id: chosenId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/workout/slot/:exerciseId/reset — remove user preference, revert to default
router.put('/slot/:exerciseId/reset', async (req, res, next) => {
  try {
    const exerciseId = parseInt(req.params.exerciseId, 10);
    if (isNaN(exerciseId)) {
      return res.status(400).json({ error: 'Invalid exercise ID' });
    }

    await pool.query(
      `DELETE FROM user_exercise_prefs WHERE user_id = $1 AND exercise_id = $2`,
      [req.user.id, exerciseId]
    );

    res.json({ success: true, slot_id: exerciseId, reset_to_default: true });
  } catch (err) {
    next(err);
  }
});

export default router;

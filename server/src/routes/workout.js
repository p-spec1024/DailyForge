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

    // Fetch exercises for ALL workout_ids in one query
    const workoutIds = [...new Set(slotsResult.rows.map(s => s.workout_id))];
    const exercisesResult = await pool.query(
      `SELECT e.id, e.workout_id, e.name, e.sanskrit_name, e.target_muscles, e.type,
              e.default_sets, e.default_reps, e.default_duration_secs,
              e.description, e.url, e.source, e.difficulty, e.sort_order
       FROM exercises e
       WHERE e.workout_id = ANY($1)
       ORDER BY e.sort_order`,
      [workoutIds]
    );

    // Group exercises by workout_id
    const exercisesByWorkout = {};
    for (const ex of exercisesResult.rows) {
      if (!exercisesByWorkout[ex.workout_id]) exercisesByWorkout[ex.workout_id] = [];
      exercisesByWorkout[ex.workout_id].push({
        id: ex.id,
        name: ex.name,
        sanskrit_name: ex.sanskrit_name,
        target_muscles: ex.target_muscles,
        exercise_type: ex.type,
        default_sets: ex.default_sets,
        default_reps: ex.default_reps,
        default_duration_secs: ex.default_duration_secs,
        description: ex.description,
        url: ex.url,
        source: ex.source,
        difficulty: ex.difficulty,
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

export default router;

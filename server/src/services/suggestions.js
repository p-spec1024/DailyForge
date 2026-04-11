import { pool } from '../db/pool.js';

const KG_PER_LB = 0.45359237;
const WEIGHT_EPSILON = 0.01;

// Progression step by unit system. Imperial lifters expect +5 lb on the bar
// (or +2.5 lb on dumbbells for microloading); doing the math in kg and
// converting produces weird fractional rounding, so we step in native units.
const PROGRESSION_STEP = {
  metric:   { barbell: 2.5, dumbbell: 1 },
  imperial: { barbell: 5,   dumbbell: 2.5 },
};

function kgToLb(kg) { return kg / KG_PER_LB; }
function roundToNearest(value, step) { return Math.round(value / step) * step; }

function topWorkingSet(sessionSets) {
  if (sessionSets.length === 0) return null;
  const maxW = Math.max(...sessionSets.map(s => s.weight));
  const atMax = sessionSets.filter(s => Math.abs(s.weight - maxW) < WEIGHT_EPSILON);
  const maxReps = Math.max(...atMax.map(s => s.reps));
  return { weight: maxW, reps: maxReps };
}

/**
 * Strength rule-based suggestion for a single exercise.
 * Queries the 2 most recent completed sessions' normal sets.
 */
export async function getStrengthSuggestion(userId, exerciseId, unit) {
  const exRes = await pool.query('SELECT name FROM exercises WHERE id = $1', [exerciseId]);
  if (exRes.rows.length === 0) return null;
  const isDumbbell = /dumbbell/i.test(exRes.rows[0].name || '');

  const { rows } = await pool.query(
    `SELECT s.id AS session_id,
            se.weight, se.reps_completed AS reps
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
      WHERE s.user_id = $1
        AND s.completed = true
        AND se.exercise_id = $2
        AND se.set_number IS NOT NULL
        AND se.completed = true
        AND COALESCE(se.set_type, 'normal') = 'normal'
        AND se.session_id IN (
          SELECT DISTINCT s2.id FROM sessions s2
          JOIN session_exercises se2 ON se2.session_id = s2.id
          WHERE s2.user_id = $1 AND s2.completed = true AND se2.exercise_id = $2
            AND COALESCE(se2.set_type, 'normal') = 'normal'
          ORDER BY s2.id DESC LIMIT 2
        )
      ORDER BY s.id DESC, se.set_number ASC`,
    [userId, exerciseId]
  );

  if (rows.length === 0) {
    return { suggestedWeight: null, suggestedReps: null, reason: null, unit };
  }

  const sessions = [];
  const seen = new Map();
  for (const row of rows) {
    if (!seen.has(row.session_id)) {
      seen.set(row.session_id, sessions.length);
      sessions.push({ sessionId: row.session_id, sets: [] });
    }
    sessions[seen.get(row.session_id)].sets.push({
      weight: Number(row.weight) || 0,
      reps: Number(row.reps) || 0,
    });
  }

  const last = topWorkingSet(sessions[0].sets);
  const prev = sessions[1] ? topWorkingSet(sessions[1].sets) : null;

  // last.weight is in kg (DB source of truth). Convert to the user's native
  // unit before applying the step so increments land on idiomatic plate math
  // (e.g. 135 → 140 lb, not 140.51 → 140).
  const lastNative = last ? (unit === 'imperial' ? kgToLb(last.weight) : last.weight) : 0;

  const weightsMatch =
    prev && last && Math.abs(last.weight - prev.weight) < WEIGHT_EPSILON;

  const steps = PROGRESSION_STEP[unit];
  const step = isDumbbell ? steps.dumbbell : steps.barbell;

  let suggestedWeight = null;
  let suggestedReps = null;
  let reason = null;

  if (prev && last && weightsMatch && last.reps >= 8 && prev.reps >= 8) {
    suggestedWeight = lastNative + step;
    suggestedReps = 8;
    reason = 'weight_increase';
  } else if (last && last.weight > 0) {
    suggestedWeight = lastNative;
    suggestedReps = last.reps + 1;
    reason = 'rep_increase';
  } else {
    return { suggestedWeight: null, suggestedReps: null, reason: null, unit };
  }

  // Round to the nearest native increment so displays stay clean.
  suggestedWeight = roundToNearest(suggestedWeight, step);

  return { suggestedWeight, suggestedReps, reason, unit };
}

/**
 * Yoga suggestions for a batch of exercise IDs. Returns a map
 * keyed by exerciseId so callers can render without per-id fetches.
 */
export async function getYogaSuggestionsBatch(userId, exerciseIds) {
  if (exerciseIds.length === 0) return {};

  const { rows: historyRows } = await pool.query(
    `SELECT se.exercise_id, se.duration_secs, s.id AS session_id
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
      WHERE s.user_id = $1
        AND s.type = 'yoga'
        AND s.completed = true
        AND se.exercise_id = ANY($2::int[])
        AND se.completed = true
        AND se.duration_secs IS NOT NULL
      ORDER BY se.exercise_id, s.id DESC`,
    [userId, exerciseIds]
  );

  const byExercise = new Map();
  for (const row of historyRows) {
    if (!byExercise.has(row.exercise_id)) byExercise.set(row.exercise_id, []);
    const list = byExercise.get(row.exercise_id);
    if (list.length < 10) list.push(Number(row.duration_secs) || 0);
  }

  // Look up defaults for exercises with no history
  const missing = exerciseIds.filter(id => !byExercise.has(id));
  const defaults = {};
  if (missing.length > 0) {
    const { rows: defRows } = await pool.query(
      `SELECT id, hold_times_json, default_duration_secs
         FROM exercises WHERE id = ANY($1::int[])`,
      [missing]
    );
    for (const row of defRows) {
      const hold = row.hold_times_json || {};
      defaults[row.id] =
        Number(hold.intermediate) ||
        Number(hold.beginner) ||
        Number(row.default_duration_secs) ||
        30;
    }
  }

  const result = {};
  for (const id of exerciseIds) {
    const history = byExercise.get(id);
    if (!history || history.length === 0) {
      if (defaults[id] != null) {
        result[id] = { suggestedHoldSeconds: defaults[id], reason: 'default' };
      }
      continue;
    }

    const lastHold = history[0] || 30;
    let suggested = lastHold;
    let reason = 'maintain';

    if (history.length >= 3 && history.slice(0, 3).every(h => h === lastHold)) {
      const bumped = Math.min(120, lastHold + 15);
      // Guard: never suggest below what the user already did.
      suggested = Math.max(bumped, lastHold);
      reason = suggested > lastHold ? 'duration_increase' : 'maintain';
    }

    result[id] = { suggestedHoldSeconds: suggested, reason };
  }

  return result;
}

/**
 * Breathwork suggestions for a batch of technique IDs.
 */
export async function getBreathworkSuggestionsBatch(userId, techniqueIds) {
  if (techniqueIds.length === 0) return {};

  const { rows } = await pool.query(
    `SELECT technique_id, rounds_completed
       FROM breathwork_sessions
      WHERE user_id = $1
        AND technique_id = ANY($2::int[])
        AND completed = true
      ORDER BY technique_id, id DESC`,
    [userId, techniqueIds]
  );

  const byTechnique = new Map();
  for (const row of rows) {
    if (!byTechnique.has(row.technique_id)) byTechnique.set(row.technique_id, []);
    const list = byTechnique.get(row.technique_id);
    if (list.length < 10) list.push(Number(row.rounds_completed) || 0);
  }

  const result = {};
  for (const id of techniqueIds) {
    const history = byTechnique.get(id);
    if (!history || history.length === 0) {
      result[id] = { suggestedCycles: 4, reason: 'default' };
      continue;
    }

    const lastCycles = history[0] || 4;
    let suggested = lastCycles;
    let reason = 'maintain';

    if (history.length >= 3) {
      const bumped = Math.min(12, lastCycles + 2);
      suggested = Math.max(bumped, lastCycles);
      reason = suggested > lastCycles ? 'cycle_increase' : 'maintain';
    }

    result[id] = { suggestedCycles: suggested, reason };
  }

  return result;
}

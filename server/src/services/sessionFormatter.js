// S12-T7: format a completed session row (sessions or breathwork_sessions) into
// the engine's response shape so /api/sessions/last shares one Flutter player UI
// with /api/sessions/suggest.
//
// Spec deviations from S12-T7-http-surface-spec.md (locked):
//
//   1. Spec referenced `session_yoga_poses` and 5-phase per-phase joining
//      tables. Pre-flight (b5) discovered ONLY three session-shaped tables:
//      sessions, breathwork_sessions, session_exercises. Yoga session items
//      live in session_exercises (yoga rows in `exercises` table; type='yoga').
//      5-phase reconstruction reads `sessions.phases_json` JSONB directly —
//      Sprint 9 stored the full engine-shaped phase array there on completion,
//      so no joining-table dispatch is needed. Resolved-Q3 fallback NOT
//      triggered for 5-phase.
//
//   2. Breathwork reconstruction IS the documented `partial_reconstruction`
//      case: breathwork_sessions only stores technique_id (no per-phase row
//      table). Single phase 'practice' with the technique; the centering /
//      reflection phases the engine emits live can't be reconstructed. The
//      response includes `metadata.partial_reconstruction: true`. FUTURE_SCOPE
//      candidate (full breathwork-session phase persistence) noted for sprint
//      close.
//
//   3. Engine's `computeEstimatedTotalMin` is private (not exported). The
//      formatter writes its own small computation that mirrors engine logic:
//      sum item.duration_minutes; for strength items (no duration) assume
//      ~3 min/set. Pre-flight (c6) confirmed.

import { pool } from '../db/pool.js';

const STRENGTH_MIN_PER_SET_FALLBACK = 3;

async function fetchUserLevels(userId) {
  const { rows } = await pool.query(
    `SELECT pillar, level FROM user_pillar_levels WHERE user_id = $1`,
    [userId]
  );
  const out = { strength: 'beginner', yoga: 'beginner', breathwork: 'beginner' };
  for (const r of rows) out[r.pillar] = r.level;
  return out;
}

function estimateTotalMin(phases) {
  let total = 0;
  for (const ph of phases) {
    for (const it of (ph.items || [])) {
      if (it.duration_minutes != null) total += Number(it.duration_minutes);
      else if (it.sets != null) total += Number(it.sets) * STRENGTH_MIN_PER_SET_FALLBACK;
    }
  }
  return Math.round(total);
}

async function reconstructStrengthPhase(sessionId) {
  // session_exercises has TWO writer shapes in this codebase: per-set rows
  // (one per logged set with sets_completed=1 each, set_number ascending) and
  // aggregate rows (one row per exercise with sets_completed=N). COALESCE
  // SUM(sets_completed) with COUNT(*) handles both correctly.
  const { rows } = await pool.query(
    `SELECT se.exercise_id,
            COALESCE(SUM(se.sets_completed)::int, COUNT(*)::int) AS sets,
            MAX(se.reps_completed)                               AS reps,
            e.name, e.default_reps
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
      WHERE se.session_id = $1
      GROUP BY se.exercise_id, e.name, e.default_reps
      ORDER BY MIN(se.sort_order) ASC, MIN(se.id) ASC`,
    [sessionId]
  );
  return rows.map((r) => ({
    content_type: 'strength',
    content_id: r.exercise_id,
    name: r.name,
    sets: r.sets ?? 1,
    reps: r.reps ?? r.default_reps ?? null,
    // tier_badge is engine-derived from level overlap; replay omits it.
    tier_badge: null,
  }));
}

async function reconstructYogaPhase(sessionId) {
  const { rows } = await pool.query(
    `SELECT se.exercise_id, se.duration_secs, se.hold_duration_seconds, se.sort_order,
            e.name, e.default_duration_secs, e.difficulty
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
      WHERE se.session_id = $1
      ORDER BY se.sort_order ASC, se.id ASC`,
    [sessionId]
  );
  return rows.map((r) => {
    const secs = r.duration_secs ?? r.hold_duration_seconds ?? r.default_duration_secs ?? 60;
    return {
      content_type: 'yoga',
      content_id: r.exercise_id,
      name: r.name,
      duration_minutes: Math.max(1, Math.round(secs / 60)),
      sets: null,
      reps: null,
      tier_badge: null,
    };
  });
}

async function reconstructBreathworkPhase(techniqueId, durationSeconds) {
  const { rows } = await pool.query(
    `SELECT id, name, difficulty FROM breathwork_techniques WHERE id = $1`,
    [techniqueId]
  );
  if (rows.length === 0) return [];
  const r = rows[0];
  const minutes = Math.max(1, Math.round((durationSeconds || 60) / 60));
  return [{
    content_type: 'breathwork',
    content_id: r.id,
    name: r.name,
    duration_minutes: minutes,
    sets: null,
    reps: null,
    tier_badge: null,
  }];
}

/**
 * Reconstruct a completed session row into engine response shape.
 *
 * @param {object} mergedRow             Merged UNION row from /last query.
 * @param {string} mergedRow.source_table 'sessions' | 'breathwork_sessions'
 * @param {number} mergedRow.session_id
 * @param {number} mergedRow.user_id
 * @param {string|null} mergedRow.pillar_type   'strength' | 'yoga' | '5phase' | 'breathwork'
 * @param {Date}   mergedRow.completed_at
 * @returns {Promise<object>} engine-shape response
 */
export async function formatLastSession(mergedRow) {
  const userLevels = await fetchUserLevels(mergedRow.user_id);
  const completedAtIso = mergedRow.completed_at instanceof Date
    ? mergedRow.completed_at.toISOString()
    : new Date(mergedRow.completed_at).toISOString();

  // ── 5-phase: read phases_json verbatim. ──────────────────────────────
  if (mergedRow.pillar_type === '5phase') {
    const { rows } = await pool.query(
      `SELECT phases_json FROM sessions WHERE id = $1`,
      [mergedRow.session_id]
    );
    const phasesJson = rows[0]?.phases_json;
    if (Array.isArray(phasesJson) && phasesJson.length > 0) {
      return {
        session_shape: 'cross_pillar',
        phases: phasesJson,
        warnings: [],
        metadata: {
          estimated_total_min: estimateTotalMin(phasesJson),
          user_levels: userLevels,
          source: 'last_completed',
          completed_at: completedAtIso,
        },
      };
    }
    // Defensive: 5-phase row missing phases_json (shouldn't happen post-Sprint-9)
    // — fall through to strength-only with partial_reconstruction.
    const strengthItems = await reconstructStrengthPhase(mergedRow.session_id);
    const phases = strengthItems.length > 0 ? [{ phase: 'main', items: strengthItems }] : [];
    return {
      session_shape: 'pillar_pure',
      phases,
      warnings: [],
      metadata: {
        estimated_total_min: estimateTotalMin(phases),
        user_levels: userLevels,
        source: 'last_completed',
        completed_at: completedAtIso,
        partial_reconstruction: true,
      },
    };
  }

  // ── Strength: pillar_pure with single 'main' phase. ──────────────────
  if (mergedRow.pillar_type === 'strength') {
    const items = await reconstructStrengthPhase(mergedRow.session_id);
    const phases = items.length > 0 ? [{ phase: 'main', items }] : [];
    return {
      session_shape: 'pillar_pure',
      phases,
      warnings: [],
      metadata: {
        estimated_total_min: estimateTotalMin(phases),
        user_levels: userLevels,
        source: 'last_completed',
        completed_at: completedAtIso,
      },
    };
  }

  // ── Yoga: pillar_pure with single 'main' phase. ──────────────────────
  if (mergedRow.pillar_type === 'yoga') {
    const items = await reconstructYogaPhase(mergedRow.session_id);
    const phases = items.length > 0 ? [{ phase: 'main', items }] : [];
    return {
      session_shape: 'pillar_pure',
      phases,
      warnings: [],
      metadata: {
        estimated_total_min: estimateTotalMin(phases),
        user_levels: userLevels,
        source: 'last_completed',
        completed_at: completedAtIso,
      },
    };
  }

  // ── Breathwork: state_focus with single 'practice' phase + partial flag. ──
  if (mergedRow.pillar_type === 'breathwork') {
    const items = await reconstructBreathworkPhase(
      mergedRow.technique_id,
      mergedRow.duration_seconds
    );
    const phases = items.length > 0 ? [{ phase: 'practice', items }] : [];
    return {
      session_shape: 'state_focus',
      phases,
      warnings: [],
      metadata: {
        estimated_total_min: estimateTotalMin(phases),
        user_levels: userLevels,
        source: 'last_completed',
        completed_at: completedAtIso,
        partial_reconstruction: true,
      },
    };
  }

  // Unknown pillar_type — defensive empty response.
  return {
    session_shape: 'pillar_pure',
    phases: [],
    warnings: [],
    metadata: {
      estimated_total_min: 0,
      user_levels: userLevels,
      source: 'last_completed',
      completed_at: completedAtIso,
      partial_reconstruction: true,
    },
  };
}

// S12-T7: HTTP surface for the suggestion engine.
//
//   POST /api/sessions/suggest           → engine HTTP face, validation + error mapping
//   GET  /api/sessions/last?focus=<slug> → most-recent-completed for focus, engine response shape
//   POST /api/sessions/save-as-routine   → strength-only save with honest dropped_phases
//
// Spec deviations from S12-T7-http-surface-spec.md (locked) — captured here so
// future maintainers see the deltas vs the spec sketch in one place:
//
//   1. Auth middleware: spec said `requireAuth`. Live export is `authenticate`
//      (server/src/middleware/auth.js). Imports below adapt; semantics
//      unchanged. Pre-flight (c1) confirmed.
//
//   2. JWT shape: spec sketch reads `req.userId`. The middleware sets `req.user`
//      to the verified JWT payload, and existing routes read `req.user.id`.
//      This file follows that pattern.
//
//   3. focus_areas column name: spec sketch reads `focusRow.type`. The actual
//      column is `focus_type` (engine queries it; pre-flight (b7) confirmed).
//      Helper `getFocusBySlug` returns `{slug, focus_type}` and route reads
//      `focus_type`.
//
//   4. /last UNION timestamp: spec said `created_at`. `sessions` has no
//      `created_at` — uses `started_at`/`completed_at`/`date`. We order by
//      `completed_at` (semantic match for "most recently completed").
//      breathwork_sessions still uses `created_at`. Pre-flight (b1) confirmed.
//
//   5. Engine RangeError mapping: spec listed 6 expected substrings; engine's
//      actual phrasing differs for 4 of them. Pre-flight (c4) inventoried all
//      10 RangeError sites and they all collapse to:
//         - 'invalid bracket value'        → invalid_bracket
//         - 'state focus requires bracket' → state_focus_requires_bracket
//         - 'is not valid from'            → invalid_focus_entry_combo
//                                            (covers state-focus-from-X and
//                                             body-focus-from-breathwork)
//         - 'not available from strength_tab' → invalid_focus_entry_combo
//                                               (covers mobility-from-strength)
//         - 'time_budget_min' (any phrasing) → invalid_time_budget
//      Mapper below uses these substrings. Engine refactor to typed errors is
//      a separate FUTURE_SCOPE item per resolved-Q5; v1 string-match accepted.
//
//   6. Routine position indexing: existing routes/routines.js uses 0-indexed
//      `position` on user_routine_exercises. We follow the same convention
//      to keep DB shape consistent across both write paths.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { generateSession } from '../services/suggestionEngine.js';
import { formatLastSession } from '../services/sessionFormatter.js';

const VALID_ENTRY_POINTS = new Set(['home', 'strength_tab', 'yoga_tab', 'breathwork_tab']);
const VALID_BRACKETS = new Set(['0-10', '10-20', '21-30', '30-45', 'endless']);
const FOCUS_SLUG_RE = /^[a-z_]{1,40}$/;

async function getFocusBySlug(slug, { requireActive = false } = {}) {
  // /suggest filters to active focuses; /last allows historical (deactivated)
  // focuses so a session done before the focus was archived is still replayable.
  const sql = requireActive
    ? `SELECT slug, focus_type FROM focus_areas WHERE slug = $1 AND is_active = true LIMIT 1`
    : `SELECT slug, focus_type FROM focus_areas WHERE slug = $1 LIMIT 1`;
  const { rows } = await pool.query(sql, [slug]);
  return rows[0] || null;
}

function mapRangeErrorToCode(message) {
  if (typeof message !== 'string') return 'unmapped_engine_error';
  if (message.includes('invalid bracket value'))               return 'invalid_bracket';
  if (message.includes('state focus requires bracket'))        return 'state_focus_requires_bracket';
  if (message.includes('is not valid from'))                   return 'invalid_focus_entry_combo';
  if (message.includes('not available from strength_tab'))     return 'invalid_focus_entry_combo';
  if (message.includes('time_budget_min'))                     return 'invalid_time_budget';
  return 'unmapped_engine_error';
}

// Defense-in-depth: a JWT signed without an `id` claim would slip past the
// auth middleware (it sets req.user = decoded payload regardless of shape) and
// produce a TypeError-→-500 inside the engine. Surface a clean 401 instead.
function requireUserId(req, res, next) {
  if (!Number.isInteger(req.user?.id) || req.user.id <= 0) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const router = Router();
router.use(authenticate);
router.use(requireUserId);

// ── POST /api/sessions/suggest ──────────────────────────────────────────
router.post('/suggest', async (req, res) => {
  const { focus_slug, entry_point, time_budget_min, bracket } = req.body || {};

  // 1. Cheap shape validation.
  if (typeof focus_slug !== 'string' || !FOCUS_SLUG_RE.test(focus_slug)) {
    return res.status(400).json({ error: 'invalid_focus_slug' });
  }
  if (!VALID_ENTRY_POINTS.has(entry_point)) {
    return res.status(400).json({ error: 'invalid_entry_point' });
  }
  if (time_budget_min !== undefined && time_budget_min !== null) {
    if (!Number.isInteger(time_budget_min) || time_budget_min < 5 || time_budget_min > 240) {
      return res.status(400).json({ error: 'invalid_time_budget' });
    }
  }
  if (bracket !== undefined && bracket !== null) {
    if (typeof bracket !== 'string' || !VALID_BRACKETS.has(bracket)) {
      return res.status(400).json({ error: 'invalid_bracket' });
    }
  }

  // 2. Resolve focus.focus_type to enforce body/state contract before engine call.
  //    /suggest requires an ACTIVE focus (deactivated focuses can't be suggested).
  const focusRow = await getFocusBySlug(focus_slug, { requireActive: true });
  if (!focusRow) {
    return res.status(400).json({ error: 'unknown_focus_slug' });
  }
  if (focusRow.focus_type === 'body' && (time_budget_min === undefined || time_budget_min === null)) {
    return res.status(400).json({ error: 'body_focus_requires_time_budget' });
  }
  if (focusRow.focus_type === 'state' && (bracket === undefined || bracket === null)) {
    return res.status(400).json({ error: 'state_focus_requires_bracket' });
  }

  // 3. Call engine — engine throws RangeError on remaining contract violations.
  try {
    const result = await generateSession({
      user_id: req.user.id,
      focus_slug,
      entry_point,
      time_budget_min: time_budget_min ?? null,
      bracket: bracket ?? null,
    });
    result.metadata = { ...(result.metadata || {}), source: 'engine_v1' };
    return res.json(result);
  } catch (err) {
    if (err instanceof RangeError) {
      const code = mapRangeErrorToCode(err.message);
      if (code === 'unmapped_engine_error') {
        // Surface mapper drift so /review or future audits catch it.
        console.warn('[T7] /suggest unmapped engine RangeError:', err.message);
      }
      return res.status(400).json({ error: code });
    }
    console.error('[T7] /suggest engine error:', err);
    return res.status(500).json({ error: 'engine_error' });
  }
});

// ── GET /api/sessions/last?focus=<slug> ─────────────────────────────────
router.get('/last', async (req, res) => {
  const focus = req.query.focus;
  if (!focus || typeof focus !== 'string') {
    return res.status(400).json({ error: 'focus_param_required' });
  }
  if (!FOCUS_SLUG_RE.test(focus)) {
    return res.status(400).json({ error: 'unknown_focus_slug' });
  }
  // /last allows historical (deactivated) focuses so completed history stays replayable.
  const focusRow = await getFocusBySlug(focus, { requireActive: false });
  if (!focusRow) {
    return res.status(400).json({ error: 'unknown_focus_slug' });
  }

  // UNION strength/yoga/5phase from sessions with breathwork from breathwork_sessions.
  // Whichever row's completion timestamp is most recent wins. Coalesce sessions'
  // completed_at with started_at and (date + 23:59:59) for legacy rows where
  // completed=true but completed_at is null.
  const { rows } = await pool.query(
    `WITH s_match AS (
       SELECT 'sessions'::text         AS source_table,
              s.id                     AS session_id,
              s.user_id                AS user_id,
              COALESCE(
                s.completed_at,
                s.started_at,
                (s.date::timestamp + TIME '23:59:59')::timestamptz
              )                        AS completed_at,
              s.type                   AS pillar_type,
              NULL::int                AS technique_id,
              NULL::int                AS duration_seconds
         FROM sessions s
        WHERE s.user_id    = $1
          AND s.focus_slug = $2
          AND s.completed  = true
        ORDER BY COALESCE(
                   s.completed_at,
                   s.started_at,
                   (s.date::timestamp + TIME '23:59:59')::timestamptz
                 ) DESC NULLS LAST
        LIMIT 1
     ),
     b_match AS (
       SELECT 'breathwork_sessions'::text AS source_table,
              bs.id                       AS session_id,
              bs.user_id                  AS user_id,
              bs.created_at               AS completed_at,
              'breathwork'::text          AS pillar_type,
              bs.technique_id             AS technique_id,
              bs.duration_seconds         AS duration_seconds
         FROM breathwork_sessions bs
        WHERE bs.user_id    = $1
          AND bs.focus_slug = $2
          AND bs.completed  = true
        ORDER BY bs.created_at DESC
        LIMIT 1
     )
     SELECT * FROM (
       SELECT * FROM s_match
       UNION ALL
       SELECT * FROM b_match
     ) merged
     ORDER BY completed_at DESC NULLS LAST
     LIMIT 1`,
    [req.user.id, focus]
  );

  if (rows.length === 0 || rows[0].completed_at == null) {
    return res.status(404).json({ error: 'last_session_not_found' });
  }

  try {
    const formatted = await formatLastSession(rows[0]);
    return res.json(formatted);
  } catch (err) {
    console.error('[T7] /last formatter error:', err);
    return res.status(500).json({ error: 'engine_error' });
  }
});

// ── POST /api/sessions/save-as-routine ──────────────────────────────────
//
// Caller-owned transaction: BEGIN/COMMIT wraps the user_routines INSERT plus
// the user_routine_exercises bulk INSERT. ROLLBACK on any failure inside the
// try block. Do NOT push DB calls into the catch — the rollback is the only
// remediation step there.
router.post('/save-as-routine', async (req, res) => {
  const { name, description, session } = req.body || {};

  // 1. Name + description validation.
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'routine_name_required' });
  }
  if (name.length > 100) {
    return res.status(400).json({ error: 'routine_name_too_long' });
  }
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return res.status(400).json({ error: 'routine_description_too_long' });
    }
    if (description.length > 500) {
      return res.status(400).json({ error: 'routine_description_too_long' });
    }
  }

  // 2. Session payload shape.
  if (!session || typeof session !== 'object' || !Array.isArray(session.phases)) {
    return res.status(400).json({ error: 'session_payload_required' });
  }

  // 3. Saveability gate by session_shape.
  switch (session.session_shape) {
    case 'state_focus':
      return res.status(400).json({ error: 'state_focus_not_saveable_v1' });
    case 'pillar_pure': {
      // Reject pure yoga / pure breathwork. Identify by content_type of any item.
      let sampleType = null;
      for (const p of session.phases) {
        const it = (p.items || [])[0];
        if (it && it.content_type) { sampleType = it.content_type; break; }
      }
      if (sampleType === 'yoga')       return res.status(400).json({ error: 'pillar_pure_yoga_not_saveable_v1' });
      if (sampleType === 'breathwork') return res.status(400).json({ error: 'pillar_pure_breathwork_not_saveable_v1' });
      // Falls through to strength — saveable.
      break;
    }
    case 'cross_pillar':
      // Saveable; strength extraction in step 4.
      break;
    default:
      return res.status(400).json({ error: 'session_payload_required' });
  }

  // 4. Extract strength items in phase order. A phase is "dropped" iff it
  // contributed no strength items (covers both empty phases and yoga/breathwork
  // phases). Mixed phases (rare; not produced by engine today) are preserved
  // because they DID contribute strength.
  const strengthItems = [];
  const strengthPhaseNames = new Set();
  for (const p of session.phases) {
    const strength = (p.items || []).filter((it) => it && it.content_type === 'strength');
    if (strength.length > 0) strengthPhaseNames.add(p.phase);
    strengthItems.push(...strength);
  }
  if (strengthItems.length === 0) {
    return res.status(400).json({ error: 'no_strength_phase_in_session' });
  }
  const droppedPhases = session.phases
    .map((p) => p.phase)
    .filter((n) => !strengthPhaseNames.has(n));

  const trimmedName = name.trim();
  const focusSlugForDesc = session.metadata?.focus_slug ?? 'unknown';
  const finalDescription = (typeof description === 'string' && description.trim().length > 0)
    ? description.trim()
    : `Saved from suggested session — focus: ${focusSlugForDesc}`;

  // 5. Persist (single transaction). If pool.connect() itself fails, tx is
  // never assigned — guard the catch/finally so we don't crash on undefined.
  let tx;
  try {
    tx = await pool.connect();
    await tx.query('BEGIN');
    const routineRow = await tx.query(
      `INSERT INTO user_routines (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
      [req.user.id, trimmedName, finalDescription]
    );
    const routineId = routineRow.rows[0].id;

    // 0-indexed position to match existing routes/routines.js convention.
    const values = [];
    const params = [];
    for (let i = 0; i < strengthItems.length; i++) {
      const it = strengthItems[i];
      const exerciseId = Number(it.content_id);
      if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
        throw new Error(`invalid content_id at strength index ${i}`);
      }
      const off = i * 4;
      values.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4})`);
      params.push(routineId, exerciseId, i, it.sets ?? 3);
    }
    await tx.query(
      `INSERT INTO user_routine_exercises (routine_id, exercise_id, position, target_sets)
       VALUES ${values.join(', ')}`,
      params
    );
    await tx.query('COMMIT');

    return res.json({
      routine_id: routineId,
      saved_phase: 'strength',
      dropped_phases: droppedPhases,
      exercise_count: strengthItems.length,
    });
  } catch (err) {
    if (tx) {
      try { await tx.query('ROLLBACK'); } catch { /* swallow rollback error */ }
    }
    console.error('[T7] /save-as-routine error:', err);
    return res.status(500).json({ error: 'engine_error' });
  } finally {
    if (tx) tx.release();
  }
});

export default router;

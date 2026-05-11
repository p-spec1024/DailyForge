// S14-T4: POST /api/cross-pillar-sessions
//
// Writes one row to cross_pillar_sessions tying together the per-pillar
// session rows already written by the embedded players, then fans the FK
// update across BOTH `sessions` (strength + yoga phases) AND
// `breathwork_sessions` (breath bookend phases). Dual-table FK design is
// AMENDMENT-1 D3 — breathwork lives in its own table, so a single FK
// column on `sessions` wouldn't cover the breath phases.
//
// Body shape:
//   {
//     focus_slug:                 string,
//     started_at:                 ISO-8601 string,
//     completed_at:               ISO-8601 string | null,
//     phases_completed:           int,
//     total_phases:               int,
//     end_intent:                 'completed' | 'end_early' | 'abandoned',
//     strength_yoga_session_ids:  int[],
//     breathwork_session_ids:     int[]
//   }
//
// Returns: { id } on 201, or { error } on validation/transaction failure.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const VALID_END_INTENTS = new Set(['completed', 'end_early', 'abandoned']);
const FOCUS_SLUG_RE = /^[a-z_0-9]{1,40}$/;
const MAX_PHASES = 20; // defensive upper bound; engine emits 4–5
const MAX_SESSION_IDS = 50; // defensive

function isIntArray(v, maxLen) {
  if (!Array.isArray(v)) return false;
  if (v.length > maxLen) return false;
  return v.every((x) => Number.isInteger(x) && x > 0);
}

function isIsoString(v) {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

const router = Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const {
    focus_slug,
    started_at,
    completed_at,
    phases_completed,
    total_phases,
    end_intent,
    strength_yoga_session_ids,
    breathwork_session_ids,
  } = req.body || {};

  // 1. Cheap shape validation.
  if (typeof focus_slug !== 'string' || !FOCUS_SLUG_RE.test(focus_slug)) {
    return res.status(400).json({ error: 'invalid_focus_slug' });
  }
  if (!isIsoString(started_at)) {
    return res.status(400).json({ error: 'invalid_started_at' });
  }
  if (completed_at !== undefined && completed_at !== null && !isIsoString(completed_at)) {
    return res.status(400).json({ error: 'invalid_completed_at' });
  }
  if (!Number.isInteger(phases_completed) || phases_completed < 0) {
    return res.status(400).json({ error: 'invalid_phases_completed' });
  }
  if (!Number.isInteger(total_phases) || total_phases <= 0 || total_phases > MAX_PHASES) {
    return res.status(400).json({ error: 'invalid_total_phases' });
  }
  if (phases_completed > total_phases) {
    return res.status(400).json({ error: 'phases_completed_exceeds_total' });
  }
  if (typeof end_intent !== 'string' || !VALID_END_INTENTS.has(end_intent)) {
    return res.status(400).json({ error: 'invalid_end_intent' });
  }
  if (!isIntArray(strength_yoga_session_ids ?? [], MAX_SESSION_IDS)) {
    return res.status(400).json({ error: 'invalid_strength_yoga_session_ids' });
  }
  if (!isIntArray(breathwork_session_ids ?? [], MAX_SESSION_IDS)) {
    return res.status(400).json({ error: 'invalid_breathwork_session_ids' });
  }

  const syIds = strength_yoga_session_ids ?? [];
  const bwIds = breathwork_session_ids ?? [];

  // 2. Persist in a single transaction.
  let tx;
  try {
    tx = await pool.connect();
    await tx.query('BEGIN');

    const insertResult = await tx.query(
      `INSERT INTO cross_pillar_sessions
         (user_id, focus_slug, started_at, completed_at, phases_completed,
          total_phases, end_intent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        req.user.id,
        focus_slug,
        started_at,
        completed_at ?? null,
        phases_completed,
        total_phases,
        end_intent,
      ]
    );
    const cpsId = insertResult.rows[0].id;

    // FK fans across both per-pillar tables. Only update rows owned by this
    // user — defense-in-depth so a malicious client can't claim sessions
    // belonging to another account.
    if (syIds.length > 0) {
      await tx.query(
        `UPDATE sessions SET cross_pillar_session_id = $1
          WHERE id = ANY($2::int[]) AND user_id = $3`,
        [cpsId, syIds, req.user.id]
      );
    }
    if (bwIds.length > 0) {
      await tx.query(
        `UPDATE breathwork_sessions SET cross_pillar_session_id = $1
          WHERE id = ANY($2::int[]) AND user_id = $3`,
        [cpsId, bwIds, req.user.id]
      );
    }

    await tx.query('COMMIT');
    return res.status(201).json({ id: cpsId });
  } catch (err) {
    if (tx) {
      try { await tx.query('ROLLBACK'); } catch { /* swallow */ }
    }
    console.error('[T4] /cross-pillar-sessions error:', err);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    if (tx) tx.release();
  }
});

export default router;

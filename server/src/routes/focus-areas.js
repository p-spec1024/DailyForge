// S13-T2: GET /api/focus-areas — read-only reference list of the 17 focus
// areas the Flutter home picker renders. JWT-authenticated per the Sprint 12
// convention (all /api routes require auth, even low-sensitivity reads).
//
// S13-T5 extends this router with two picker-support endpoints:
//   GET /:slug/available-durations  — state-focus bracket grid + suggested default
//   GET /:slug/suggested-default    — last-used duration/bracket per focus
// Both are read-only and JWT-authenticated.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import {
  getAvailableDurations,
  BRACKET_TABLE,
} from '../services/suggestionEngine.js';

const router = Router();

// Display copy for each bracket id. Source of truth for window math is the
// engine's BRACKET_TABLE; this map is the pure UI label the picker renders.
// Keys must match BRACKET_TABLE keys (hyphenated, not underscored).
const BRACKET_DISPLAY = {
  '0-10':    '0–10 min',
  '10-20':   '10–20 min',
  '21-30':   '21–30 min',
  '30-45':   '30–45 min',
  'endless': "Until I'm done",
};

const VALID_BREATHWORK_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

router.get('/', authenticate, async (_req, res) => {
  try {
    // `focus_type` and `sort_order` are aliased to `type` and `display_order` for
    // client contract stability. Column rename queued for a future schema migration.
    const result = await pool.query(`
      SELECT slug, display_name, focus_type AS type, sort_order AS display_order
        FROM focus_areas
       WHERE is_active = true
       ORDER BY focus_type ASC, sort_order ASC
    `);
    res.json({ focus_areas: result.rows });
  } catch (err) {
    console.error('GET /api/focus-areas error:', err);
    res.status(500).json({ error: 'engine_error' });
  }
});

// ── S13-T5: GET /:slug/available-durations ───────────────────────────────
//
// Returns the bracket grid the BracketPickerSheet renders for state focuses.
// Engine output is filtered server-side (Decision #10: hide locked/empty)
// and enriched with display copy + window bounds from BRACKET_TABLE.
router.get('/:slug/available-durations', authenticate, async (req, res) => {
  const { slug } = req.params;
  try {
    const focusRow = await pool.query(
      `SELECT focus_type FROM focus_areas WHERE slug = $1 AND is_active = true`,
      [slug]
    );
    if (focusRow.rows.length === 0) {
      return res.status(404).json({ error: 'unknown_focus_slug' });
    }
    if (focusRow.rows[0].focus_type !== 'state') {
      return res.status(400).json({
        error: 'invalid_focus_type_for_durations',
        message: 'Only state focuses have available durations.',
      });
    }

    const lvlRow = await pool.query(
      `SELECT level FROM user_pillar_levels
        WHERE user_id = $1 AND pillar = 'breathwork'`,
      [req.user.id]
    );
    if (lvlRow.rows.length === 0 ||
        !VALID_BREATHWORK_LEVELS.has(lvlRow.rows[0].level)) {
      return res.status(400).json({ error: 'breathwork_level_not_set' });
    }
    const breathworkLevel = lvlRow.rows[0].level;

    // Pass userId so per-user breathwork exclusions are honored when the
    // engine counts main-eligible techniques per bracket.
    const engineResult = await getAvailableDurations(
      slug, breathworkLevel, req.user.id);

    const ranges = engineResult.brackets
      .filter((b) => b.state === 'available')
      .map((b) => ({
        label: b.id,
        display: BRACKET_DISPLAY[b.id],
        min_total_minutes: BRACKET_TABLE[b.id].window_min,
        max_total_minutes: BRACKET_TABLE[b.id].window_max,
        state: b.state,
        technique_count: b.sample_count,
      }));

    // Suggested default: most-frequent prior bracket for this focus, falling
    // back to first available when history is empty or points at a bracket
    // that's not currently in the available set.
    const historyBracket = await modeStateBracket(req.user.id, slug);
    let suggestedDefault = null;
    if (ranges.length > 0) {
      const labels = new Set(ranges.map((r) => r.label));
      suggestedDefault = (historyBracket && labels.has(historyBracket))
        ? historyBracket
        : ranges[0].label;
    }

    res.json({
      focus_slug: slug,
      breathwork_level: breathworkLevel,
      ranges,
      suggested_default: suggestedDefault,
    });
  } catch (err) {
    console.error(`GET /api/focus-areas/${slug}/available-durations error:`, err);
    res.status(500).json({ error: 'engine_error' });
  }
});

// ── S13-T5: GET /:slug/suggested-default ─────────────────────────────────
//
// Lightweight history lookup for the body-focus DurationSliderSheet (and the
// state-focus sheet's pre-fetch path). Returns the user's mode-of-history
// bracket (state) or duration in minutes (body), null when no history exists.
router.get('/:slug/suggested-default', authenticate, async (req, res) => {
  const { slug } = req.params;
  try {
    const focusRow = await pool.query(
      `SELECT focus_type FROM focus_areas WHERE slug = $1 AND is_active = true`,
      [slug]
    );
    if (focusRow.rows.length === 0) {
      return res.status(404).json({ error: 'unknown_focus_slug' });
    }
    const focusType = focusRow.rows[0].focus_type;

    const suggestedDefault = focusType === 'state'
      ? await modeStateBracket(req.user.id, slug)
      : await modeBodyDuration(req.user.id, slug);

    res.json({
      focus_slug: slug,
      focus_type: focusType,
      suggested_default: suggestedDefault,
    });
  } catch (err) {
    console.error(`GET /api/focus-areas/${slug}/suggested-default error:`, err);
    res.status(500).json({ error: 'engine_error' });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────

// Mode-of-history bracket id from completed breathwork_sessions for this
// (user, focus). 30-day window first, all-time fallback, null if no rows.
// Tie-break: highest count, then most recent.
//
// Note: `breathwork_sessions.duration_seconds` is in seconds; we convert
// to minutes inline via `ROUND(duration_seconds / 60.0)` so the bracket
// CASE matches the engine's BRACKET_TABLE windows.
async function modeStateBracket(userId, focusSlug) {
  const bracketCase = `
    CASE
      WHEN ROUND(bs.duration_seconds / 60.0) <= 10 THEN '0-10'
      WHEN ROUND(bs.duration_seconds / 60.0) <= 20 THEN '10-20'
      WHEN ROUND(bs.duration_seconds / 60.0) <= 30 THEN '21-30'
      WHEN ROUND(bs.duration_seconds / 60.0) <= 45 THEN '30-45'
      ELSE 'endless'
    END`;
  const buildSql = (windowClause) => `
    SELECT bracket
      FROM (
        SELECT ${bracketCase} AS bracket, bs.created_at
          FROM breathwork_sessions bs
         WHERE bs.user_id = $1
           AND bs.focus_slug = $2
           AND bs.completed = true
           ${windowClause}
      ) sub
     GROUP BY bracket
     ORDER BY COUNT(*) DESC, MAX(created_at) DESC
     LIMIT 1`;

  let { rows } = await pool.query(
    buildSql(`AND bs.created_at >= NOW() - INTERVAL '30 days'`),
    [userId, focusSlug]
  );
  if (rows.length > 0) return rows[0].bracket;

  ({ rows } = await pool.query(buildSql(''), [userId, focusSlug]));
  return rows.length > 0 ? rows[0].bracket : null;
}

// Mode-of-history duration (minutes, snapped to 5, clamped to [30,60]) from
// completed sessions for this (user, focus). Same fallback chain as above.
//
// Note: `sessions.duration` is in seconds (insert pattern in routes/session.js
// and routes/yoga.js: `INTERVAL '1 second' * dur`). We convert to minutes
// inline via `s.duration / 60.0` then snap to nearest 5 then clamp.
async function modeBodyDuration(userId, focusSlug) {
  const snapExpr = `
    GREATEST(30, LEAST(60,
      (ROUND(s.duration / 60.0 / 5.0) * 5)::INT
    ))`;
  const buildSql = (windowClause) => `
    SELECT duration_5min
      FROM (
        SELECT ${snapExpr} AS duration_5min, s.date
          FROM sessions s
         WHERE s.user_id = $1
           AND s.focus_slug = $2
           AND s.completed = true
           AND s.duration IS NOT NULL
           ${windowClause}
      ) sub
     GROUP BY duration_5min
     ORDER BY COUNT(*) DESC, MAX(date) DESC
     LIMIT 1`;

  let { rows } = await pool.query(
    buildSql(`AND s.date >= CURRENT_DATE - INTERVAL '30 days'`),
    [userId, focusSlug]
  );
  if (rows.length > 0) return rows[0].duration_5min;

  ({ rows } = await pool.query(buildSql(''), [userId, focusSlug]));
  return rows.length > 0 ? rows[0].duration_5min : null;
}

export default router;

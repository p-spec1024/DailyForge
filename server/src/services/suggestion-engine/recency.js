// Suggestion engine — recency-overlap detection (T5).
//
// Spec: Trackers/S12-T5-recency-warnings-spec.md
// Body focuses only. Caller (each body-focus recipe) invokes this and pushes
// the returned warning (if non-null) into the response's `warnings` array.
// State focuses do NOT call this — spec line 443: "DOES NOT APPLY to state
// focuses." The 5 state-focus slugs have no edges in focus_overlaps anyway,
// so even an accidental call would return null on the adjacent-clause; the
// "do not call from state path" rule is contract-level discipline.
//
// Implementation deviation from spec §Detection query:
//   - Spec wrote a 3-arm UNION across `sessions`, `yoga_sessions`,
//     `breathwork_sessions`. Live data layer has only `sessions` (yoga and
//     5-phase rows live there with type='yoga'/'5phase'; no separate
//     yoga_sessions table exists). The UNION collapses to a single SELECT
//     against `sessions`.
//   - breathwork_sessions has no `date`/`started_at` column (only created_at)
//     and v1 has no path that writes a body-focus slug there anyway, so the
//     breathwork arm is dropped per spec line 160's allowance.
//   - When FUTURE_SCOPE #114 (unified-session model) lands, this query is
//     unchanged — `sessions` already is the unified table.
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

import { pool } from '../../db/pool.js';

/**
 * Returns a recency_overlap warning if the user's last calendar day of completed
 * sessions intersects (same or adjacent) with the focus they're requesting now.
 * Returns null on no overlap.
 *
 * Body focuses only — caller must not invoke this on state focuses.
 *
 * @param {number} userId
 * @param {string} currentFocusSlug   body focus only ('chest', 'biceps', etc.)
 * @returns {Promise<null | {
 *   type: 'recency_overlap',
 *   yesterday_focus: string,
 *   current_focus: string,
 *   message: string,
 *   alternative_focus_slug: string,
 * }>}
 */
export async function checkRecencyOverlap(userId, currentFocusSlug) {
  // Argument-shape validation throws (programming errors). Intentionally outside
  // the DB try/catch — TypeErrors from bad call sites must surface, not be swallowed.
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError(`userId must be a positive integer; got ${userId}`);
  }
  if (typeof currentFocusSlug !== 'string' || currentFocusSlug.length === 0) {
    throw new TypeError('currentFocusSlug must be a non-empty string');
  }

  // W1: recency is informational. A DB hiccup must not break session generation.
  // W3: day-diff computed in SQL (`(CURRENT_DATE - wf.d)::int`) so both sides of
  // the comparison resolve in the same Postgres-session timezone — no JS-side
  // Date math, no UTC-vs-local fragility.
  let rows;
  try {
    ({ rows } = await pool.query(
      `WITH window_focuses AS (
         SELECT s.focus_slug,
                s.started_at AS at,
                (CURRENT_DATE - s.date)::int AS days_ago
           FROM sessions s
          WHERE s.user_id = $1
            AND s.completed = true
            AND s.focus_slug IS NOT NULL
            AND s.date BETWEEN (CURRENT_DATE - INTERVAL '1 day') AND CURRENT_DATE
       )
       SELECT wf.focus_slug AS yesterday_focus,
              wf.days_ago   AS days_ago
         FROM window_focuses wf
        WHERE wf.focus_slug = $2
           OR EXISTS (
                SELECT 1
                  FROM focus_areas fa1
                  JOIN focus_overlaps fo ON fo.focus_id = fa1.id
                  JOIN focus_areas fa2  ON fa2.id = fo.overlaps_with_id
                 WHERE fa1.slug = $2
                   AND fa2.slug = wf.focus_slug
              )
        ORDER BY wf.at DESC
        LIMIT 1`,
      [userId, currentFocusSlug],
    ));
  } catch (err) {
    console.error('[checkRecencyOverlap] DB error, returning null:', err.message);
    return null;
  }

  if (rows.length === 0) return null;

  const yesterday_focus = rows[0].yesterday_focus;
  const dayPhrase = rows[0].days_ago === 0 ? 'today' : 'yesterday';

  const sameFocus = yesterday_focus === currentFocusSlug;
  const message = sameFocus
    ? `You trained ${currentFocusSlug} ${dayPhrase}. Consider a recovery focus today.`
    : `You trained ${yesterday_focus} ${dayPhrase} — ` +
      `your ${currentFocusSlug} were worked too. Consider a recovery focus today.`;

  return {
    type: 'recency_overlap',
    yesterday_focus,
    current_focus: currentFocusSlug,
    message,
    alternative_focus_slug: 'recover',
  };
}

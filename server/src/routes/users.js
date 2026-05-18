import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authChain } from '../middleware/auth.js';

const router = Router();
router.use(...authChain);

// GET /api/users/profile
router.get('/profile', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, height_cm, unit_system FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile — update height_cm and unit_system
router.put('/profile', async (req, res, next) => {
  try {
    const { height_cm, unit_system } = req.body || {};

    let heightCm = null;
    if (height_cm !== undefined && height_cm !== null && height_cm !== '') {
      const n = Number(height_cm);
      if (!Number.isFinite(n) || n < 50 || n > 280) {
        return res.status(400).json({ error: 'Invalid height_cm (50-280)' });
      }
      heightCm = n;
    }

    const unit = unit_system === 'imperial' ? 'imperial' : unit_system === 'metric' ? 'metric' : null;

    const result = await pool.query(
      `UPDATE users
       SET height_cm = COALESCE($1, height_cm),
           unit_system = COALESCE($2, unit_system)
       WHERE id = $3
       RETURNING id, email, name, height_cm, unit_system`,
      [heightCm, unit, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

const PILLARS = ['strength', 'yoga', 'breathwork'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

// POST /api/users/pillar-levels — upsert all 3 pillar levels for the
// authenticated user in a single transaction. Source is hardcoded to
// 'declared' (this endpoint is the onboarding-stub entry point).
//
// Body: { strength, yoga, breathwork } — each one of beginner/intermediate/advanced.
// 200 { ok, levels } on success. 400 with stable error codes on missing/invalid:
//   <pillar>_level_required, invalid_<pillar>_level (pillars checked in fixed order).
router.post('/pillar-levels', async (req, res, next) => {
  const body = req.body || {};
  for (const pillar of PILLARS) {
    if (!body[pillar]) {
      return res.status(400).json({ error: `${pillar}_level_required` });
    }
    if (!VALID_LEVELS.includes(body[pillar])) {
      return res.status(400).json({ error: `invalid_${pillar}_level` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const pillar of PILLARS) {
      await client.query(
        `INSERT INTO user_pillar_levels (user_id, pillar, level, source)
         VALUES ($1, $2, $3, 'declared')
         ON CONFLICT (user_id, pillar)
         DO UPDATE SET level = EXCLUDED.level, source = 'declared', updated_at = NOW()`,
        [req.user.id, pillar, body[pillar]]
      );
    }
    await client.query('COMMIT');
    res.json({
      ok: true,
      levels: {
        strength: body.strength,
        yoga: body.yoga,
        breathwork: body.breathwork,
      },
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* swallow — original err is the real story */ }
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/users/me/pillar-levels — return the authenticated user's
// declared/inferred levels (empty array for fresh users; that signal
// drives the onboarding-stub redirect on app launch).
router.get('/me/pillar-levels', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pillar, level, source
         FROM user_pillar_levels
        WHERE user_id = $1
        ORDER BY pillar ASC`,
      [req.user.id]
    );
    res.json({ levels: result.rows });
  } catch (err) {
    next(err);
  }
});

// S14-T6 §6.1.1 — GET /api/users/me/streaks
//
// Computes three streak metrics server-side so the summary page doesn't
// have to do client-date math (S12-T5 timezone-drift incident). Date math
// stays inside one Postgres session — same TZ on both sides of comparisons.
//
// S14-T6 Commit 1.7 (/review CR-1): all three queries now UNION across
// sessions + breathwork_sessions. State-focus sessions only write to
// breathwork_sessions (no `sessions` row), so the pre-fix queries returned
// zero for daily/focus/weekly on breathwork-only users. breathwork_sessions
// has no `date` column (only `created_at TIMESTAMPTZ`); we cast to date
// inside each CTE — server timezone applies (FUTURE_SCOPE #212 unifies via
// a v_completed_sessions VIEW).
//
// Response:
//   {
//     daily_streak_days: INT,
//     focus_streak: { focus_slug: STRING | null, count_this_week: INT, is_first: BOOL },
//     weekly_count: INT
//   }
//
// Query param: ?focus_slug=<slug>  (the focus the session that just ended targeted)
//   - Optional. When absent, focus_streak.focus_slug is null + count_this_week 0.
router.get('/me/streaks', async (req, res, next) => {
  try {
    const focusSlug = typeof req.query.focus_slug === 'string' && req.query.focus_slug.length > 0
      ? req.query.focus_slug
      : null;

    // 1. Daily streak — count consecutive days back from today, stopping at
    //    the first gap. Looks back at most 60 days (cap-safe for v1; 60+ day
    //    streaks are a great problem to have). Implementation: distinct
    //    session-days across BOTH session tables, gap-detect via row_number
    //    vs date offset.
    const dailyResult = await pool.query(
      `WITH user_days AS (
         SELECT date
           FROM sessions
          WHERE user_id = $1 AND completed = true
            AND date >= CURRENT_DATE - INTERVAL '60 days'
            AND date <= CURRENT_DATE
         UNION
         SELECT created_at::date AS date
           FROM breathwork_sessions
          WHERE user_id = $1 AND completed = true
            AND created_at >= (CURRENT_DATE - INTERVAL '60 days')::timestamptz
            AND created_at::date <= CURRENT_DATE
       ),
       ordered AS (
         SELECT DISTINCT date,
                ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
           FROM user_days
       ),
       streak_days AS (
         SELECT date
           FROM ordered
          WHERE date = (CURRENT_DATE - (rn - 1)::int)
       )
       SELECT COUNT(*)::int AS days FROM streak_days`,
      [req.user.id]
    );
    const dailyStreakDays = dailyResult.rows[0]?.days ?? 0;

    // 2. Focus streak — count of sessions with the target focus_slug in the
    //    current ISO week + total ever. is_first is true when total <= 1
    //    (the just-completed session is the user's only session for this
    //    focus). Both queries union sessions + breathwork_sessions so
    //    state-focus slugs (calm/energize/focus/sleep/recover) count too.
    let focusStreak = {
      focus_slug: focusSlug,
      count_this_week: 0,
      is_first: false,
    };
    if (focusSlug) {
      // S14-T6 Commit 1.8 (/review pass 2 CR-1'): UNION (not UNION ALL) so
      // a state-focus session that writes 3 breathwork_sessions rows for
      // the same day counts as 1 session-day, not 3. Same for a user who
      // does multiple phases on one day across both tables.
      const focusResult = await pool.query(
        `WITH focus_dates AS (
           SELECT date FROM sessions
            WHERE user_id = $1 AND completed = true AND focus_slug = $2
           UNION
           SELECT created_at::date AS date FROM breathwork_sessions
            WHERE user_id = $1 AND completed = true AND focus_slug = $2
         )
         SELECT
           (SELECT COUNT(*)::int FROM focus_dates
             WHERE date >= date_trunc('week', CURRENT_DATE)) AS count_this_week,
           (SELECT COUNT(*)::int FROM focus_dates) AS total`,
        [req.user.id, focusSlug]
      );
      const row = focusResult.rows[0] ?? { count_this_week: 0, total: 0 };
      focusStreak = {
        focus_slug: focusSlug,
        count_this_week: row.count_this_week,
        is_first: row.total <= 1,
      };
    }

    // 3. Weekly count — distinct session-days this week (any focus).
    //
    // S14-T6 Commit 1.8 (/review pass 2 CR-1'): UNION (not UNION ALL) dedupes
    // by date, so a cross-pillar workout (1 sessions row + 2 breathwork_sessions
    // rows, same date) counts as 1 day, not 3. A state-focus session (3
    // breathwork_sessions rows, same date) counts as 1. Matches the user-
    // facing "X sessions this week" semantic (= active days). Two real
    // sessions on the same calendar day count as 1 — under-count edge case
    // accepted in v1; the typical user does ≤ 1 session/day.
    const weeklyResult = await pool.query(
      `WITH weekly_sessions AS (
         SELECT date FROM sessions
          WHERE user_id = $1 AND completed = true
            AND date >= date_trunc('week', CURRENT_DATE)
         UNION
         SELECT created_at::date AS date FROM breathwork_sessions
          WHERE user_id = $1 AND completed = true
            AND created_at >= date_trunc('week', CURRENT_DATE)::timestamptz
       )
       SELECT COUNT(*)::int AS weekly_count FROM weekly_sessions`,
      [req.user.id]
    );
    const weeklyCount = weeklyResult.rows[0]?.weekly_count ?? 0;

    res.json({
      daily_streak_days: dailyStreakDays,
      focus_streak: focusStreak,
      weekly_count: weeklyCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

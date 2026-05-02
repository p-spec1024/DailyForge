// Home-page endpoints (S10-T5c-b + S13-T4). Backs the stats row, weekly
// chart, training-load chart, and daily-counts bar chart on the home page.
// Streak logic mirrors /api/dashboard via the shared `calculateStreak`
// helper so the two surfaces stay in sync.
//
// Contract:
//   GET /api/home/stats
//     → { streakDays, minutesThisWeek, sessionsThisYear,
//         pillarDurations: { strength, yoga, breath } }
//
//   GET /api/home/weekly-activity
//     → { weeks: [{ weekStart: 'YYYY-MM-DD', strength, yoga, breath } × 4] }
//       Oldest → newest. Week anchored to Monday (startOfWeekMonday).
//
//   GET /api/home/daily-load                                   (S13-T4)
//     → { points: [{ date: 'YYYY-MM-DD', load_minutes: int } × 30],
//         delta_pct: number | null }
//       Oldest → newest. `delta_pct` = (last-14-day avg / prior-14-day avg - 1) × 100,
//       null if either window has zero load (avoids div-by-zero noise on fresh users).
//
//   GET /api/home/daily-counts                                 (S13-T4)
//     → { points: [{ date: 'YYYY-MM-DD', sessions: int } × 14] }
//       Oldest → newest. Counts completed sessions across all pillars.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import {
  fmtDate,
  calculateStreak,
  startOfWeekMonday,
} from '../services/milestones.js';

const router = Router();
router.use(authenticate);

// Fallbacks when a user hasn't done enough sessions of a pillar to form a
// median. Matches the S10-T5c-b spec (strength 45 / yoga 20 / breath 10).
const PILLAR_FALLBACKS = { strength: 45, yoga: 20, breath: 10 };
const PILLAR_MEDIAN_WINDOW = 5;

function median(sortedArr) {
  if (sortedArr.length === 0) return null;
  const mid = Math.floor(sortedArr.length / 2);
  return sortedArr.length % 2 === 0
    ? (sortedArr[mid - 1] + sortedArr[mid]) / 2
    : sortedArr[mid];
}

function roundToFive(min) {
  return Math.round(min / 5) * 5;
}

function pillarDurationMinutes(durationsSecs, fallback) {
  const vals = durationsSecs
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const med = median(vals);
  if (med == null) return fallback;
  const rounded = roundToFive(med / 60);
  // Guard against a pathological median of < 2.5 min rounding to 0.
  return rounded > 0 ? rounded : 5;
}

router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const monday = startOfWeekMonday(today);
    const mondayStr = fmtDate(monday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = fmtDate(sunday);
    const yearStart = `${today.getFullYear()}-01-01`;

    const [
      datesRows,
      weekSecsRows,
      yearCountRows,
      strengthRows,
      yogaRows,
      breathRows,
    ] = await Promise.all([
      // Active dates for streak — UNION of completed sessions + breathwork,
      // same shape dashboard.js uses.
      pool.query(
        `SELECT date FROM (
           SELECT DISTINCT date FROM sessions
            WHERE user_id = $1 AND completed = true AND date IS NOT NULL
           UNION
           SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date AS date
             FROM breathwork_sessions
            WHERE user_id = $1 AND completed = true
         ) d ORDER BY date DESC`,
        [userId]
      ),

      // Minutes this week: sessions.duration (seconds, see migrate.js:290)
      // + breathwork_sessions.duration_seconds. Converted to minutes after
      // summing.
      pool.query(
        `SELECT
           (SELECT COALESCE(SUM(duration), 0)::bigint
              FROM sessions
             WHERE user_id = $1 AND completed = true
               AND duration IS NOT NULL
               AND date >= $2::date AND date <= $3::date) AS session_secs,
           (SELECT COALESCE(SUM(duration_seconds), 0)::bigint
              FROM breathwork_sessions
             WHERE user_id = $1 AND completed = true
               AND created_at >= $2::date
               AND created_at < ($3::date + INTERVAL '1 day')) AS breath_secs`,
        [userId, mondayStr, sundayStr]
      ),

      // Completed sessions this calendar year — both pillars.
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM sessions
             WHERE user_id = $1 AND completed = true
               AND date >= $2::date) AS session_count,
           (SELECT COUNT(*)::int FROM breathwork_sessions
             WHERE user_id = $1 AND completed = true
               AND created_at >= $2::date) AS breath_count`,
        [userId, yearStart]
      ),

      // Last N strength durations (seconds) — for median pillar time.
      pool.query(
        `SELECT duration FROM sessions
          WHERE user_id = $1 AND completed = true
            AND duration IS NOT NULL AND duration > 0
            AND type IN ('strength', '5phase')
          ORDER BY date DESC NULLS LAST, id DESC
          LIMIT $2`,
        [userId, PILLAR_MEDIAN_WINDOW]
      ),

      pool.query(
        `SELECT duration FROM sessions
          WHERE user_id = $1 AND completed = true
            AND duration IS NOT NULL AND duration > 0
            AND type = 'yoga'
          ORDER BY date DESC NULLS LAST, id DESC
          LIMIT $2`,
        [userId, PILLAR_MEDIAN_WINDOW]
      ),

      pool.query(
        `SELECT duration_seconds AS duration FROM breathwork_sessions
          WHERE user_id = $1 AND completed = true
            AND duration_seconds IS NOT NULL AND duration_seconds > 0
          ORDER BY created_at DESC
          LIMIT $2`,
        [userId, PILLAR_MEDIAN_WINDOW]
      ),
    ]);

    const dateSet = new Set(
      datesRows.rows.map((r) =>
        r.date instanceof Date ? fmtDate(r.date) : String(r.date).slice(0, 10)
      )
    );
    const streakDays = calculateStreak(dateSet, today);

    const sessionSecs = Number(weekSecsRows.rows[0]?.session_secs || 0);
    const breathSecs = Number(weekSecsRows.rows[0]?.breath_secs || 0);
    const minutesThisWeek = Math.round((sessionSecs + breathSecs) / 60);

    const sessionsThisYear =
      Number(yearCountRows.rows[0]?.session_count || 0) +
      Number(yearCountRows.rows[0]?.breath_count || 0);

    const pillarDurations = {
      strength: pillarDurationMinutes(
        strengthRows.rows.map((r) => r.duration),
        PILLAR_FALLBACKS.strength
      ),
      yoga: pillarDurationMinutes(
        yogaRows.rows.map((r) => r.duration),
        PILLAR_FALLBACKS.yoga
      ),
      breath: pillarDurationMinutes(
        breathRows.rows.map((r) => r.duration),
        PILLAR_FALLBACKS.breath
      ),
    };

    res.json({
      streakDays,
      minutesThisWeek,
      sessionsThisYear,
      pillarDurations,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/weekly-activity', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const thisMonday = startOfWeekMonday(new Date());
    // 4 buckets: [week-3, week-2, week-1, this-week]. Oldest first.
    const oldestMonday = new Date(thisMonday);
    oldestMonday.setDate(oldestMonday.getDate() - 21);
    const oldestStr = fmtDate(oldestMonday);

    const [sessionRows, breathRows] = await Promise.all([
      pool.query(
        `SELECT date, type FROM sessions
          WHERE user_id = $1 AND completed = true
            AND date IS NOT NULL
            AND date >= $2::date`,
        [userId, oldestStr]
      ),
      pool.query(
        `SELECT (created_at AT TIME ZONE 'UTC')::date AS date
           FROM breathwork_sessions
          WHERE user_id = $1 AND completed = true
            AND created_at >= $2::date`,
        [userId, oldestStr]
      ),
    ]);

    const buckets = [];
    for (let i = 0; i < 4; i++) {
      const ws = new Date(oldestMonday);
      ws.setDate(ws.getDate() + i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      buckets.push({
        weekStart: fmtDate(ws),
        weekEnd: fmtDate(we),
        strength: 0,
        yoga: 0,
        breath: 0,
      });
    }

    const bucketIndexFor = (dateStr) => {
      if (!dateStr) return -1;
      for (let i = 0; i < buckets.length; i++) {
        if (dateStr >= buckets[i].weekStart && dateStr <= buckets[i].weekEnd) {
          return i;
        }
      }
      return -1;
    };

    for (const row of sessionRows.rows) {
      const ds = row.date instanceof Date
        ? fmtDate(row.date)
        : String(row.date).slice(0, 10);
      const idx = bucketIndexFor(ds);
      if (idx < 0) continue;
      if (row.type === 'strength' || row.type === '5phase') {
        buckets[idx].strength += 1;
      } else if (row.type === 'yoga') {
        buckets[idx].yoga += 1;
      }
    }
    for (const row of breathRows.rows) {
      const ds = row.date instanceof Date
        ? fmtDate(row.date)
        : String(row.date).slice(0, 10);
      const idx = bucketIndexFor(ds);
      if (idx < 0) continue;
      buckets[idx].breath += 1;
    }

    res.json({
      weeks: buckets.map(({ weekStart, strength, yoga, breath }) => ({
        weekStart,
        strength,
        yoga,
        breath,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── S13-T4: GET /api/home/daily-load ────────────────────────────────────
//
// 30 daily totals of session minutes (sessions.duration + breathwork
// duration_seconds, both / 60). Filled forward — every day in the window
// gets a row even if the user did nothing, so the chart can render a flat
// line without gap-handling. delta_pct compares last-14d avg vs prior-14d
// avg; null when either window's sum is zero (fresh-user / inactivity).
router.get('/daily-load', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const oldest = new Date(today);
    oldest.setDate(oldest.getDate() - 29); // 30-day window inclusive
    const oldestStr = fmtDate(oldest);

    const [sessionRows, breathRows] = await Promise.all([
      pool.query(
        `SELECT date, COALESCE(SUM(duration), 0)::bigint AS secs
           FROM sessions
          WHERE user_id = $1 AND completed = true
            AND date IS NOT NULL AND duration IS NOT NULL
            AND date >= $2::date
          GROUP BY date`,
        [userId, oldestStr]
      ),
      pool.query(
        `SELECT (created_at AT TIME ZONE 'UTC')::date AS date,
                COALESCE(SUM(duration_seconds), 0)::bigint AS secs
           FROM breathwork_sessions
          WHERE user_id = $1 AND completed = true
            AND duration_seconds IS NOT NULL
            AND created_at >= $2::date
          GROUP BY (created_at AT TIME ZONE 'UTC')::date`,
        [userId, oldestStr]
      ),
    ]);

    // Build a date → minutes map, then walk every day in the window so
    // empty days emit `load_minutes: 0` (clients should never see gaps).
    const byDate = new Map();
    const addSecs = (dateRaw, secs) => {
      const ds = dateRaw instanceof Date
        ? fmtDate(dateRaw)
        : String(dateRaw).slice(0, 10);
      byDate.set(ds, (byDate.get(ds) || 0) + Number(secs || 0));
    };
    for (const r of sessionRows.rows) addSecs(r.date, r.secs);
    for (const r of breathRows.rows) addSecs(r.date, r.secs);

    const points = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(oldest);
      d.setDate(oldest.getDate() + i);
      const ds = fmtDate(d);
      const secs = byDate.get(ds) || 0;
      points.push({ date: ds, load_minutes: Math.round(secs / 60) });
    }

    // delta_pct: avg(last 14) vs avg(prior 14). Null on either-side zero.
    const prior14 = points.slice(2, 16); // days 3..16 from oldest
    const last14 = points.slice(16, 30); // days 17..30
    const sum = (arr) => arr.reduce((a, p) => a + p.load_minutes, 0);
    const priorSum = sum(prior14);
    const lastSum = sum(last14);
    const deltaPct = (priorSum > 0 && lastSum > 0)
      ? Math.round(((lastSum / priorSum) - 1) * 1000) / 10
      : null;

    res.json({ points, delta_pct: deltaPct });
  } catch (err) {
    next(err);
  }
});

// ── S13-T4: GET /api/home/daily-counts ──────────────────────────────────
//
// 14 daily counts of completed sessions across all pillars. Used by the
// 14-bar chart on the home page. Empty days emit `sessions: 0` so the
// chart renderer never has to backfill gaps.
router.get('/daily-counts', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const oldest = new Date(today);
    oldest.setDate(oldest.getDate() - 13); // 14-day window inclusive
    const oldestStr = fmtDate(oldest);

    const [sessionRows, breathRows] = await Promise.all([
      pool.query(
        `SELECT date, COUNT(*)::int AS n
           FROM sessions
          WHERE user_id = $1 AND completed = true AND date IS NOT NULL
            AND date >= $2::date
          GROUP BY date`,
        [userId, oldestStr]
      ),
      pool.query(
        `SELECT (created_at AT TIME ZONE 'UTC')::date AS date,
                COUNT(*)::int AS n
           FROM breathwork_sessions
          WHERE user_id = $1 AND completed = true
            AND created_at >= $2::date
          GROUP BY (created_at AT TIME ZONE 'UTC')::date`,
        [userId, oldestStr]
      ),
    ]);

    const byDate = new Map();
    const add = (dateRaw, n) => {
      const ds = dateRaw instanceof Date
        ? fmtDate(dateRaw)
        : String(dateRaw).slice(0, 10);
      byDate.set(ds, (byDate.get(ds) || 0) + Number(n || 0));
    };
    for (const r of sessionRows.rows) add(r.date, r.n);
    for (const r of breathRows.rows) add(r.date, r.n);

    const points = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(oldest);
      d.setDate(oldest.getDate() + i);
      const ds = fmtDate(d);
      points.push({ date: ds, sessions: byDate.get(ds) || 0 });
    }

    res.json({ points });
  } catch (err) {
    next(err);
  }
});

export default router;

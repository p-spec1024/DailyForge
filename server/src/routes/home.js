// Home-page endpoints (S10-T5c-b). Backs the stats row + weekly-activity
// chart on the new home page. Streak logic deliberately mirrors
// /api/dashboard via the shared `calculateStreak` helper so the two
// surfaces stay in sync.
//
// Contract:
//   GET /api/home/stats
//     → { streakDays, minutesThisWeek, sessionsThisYear,
//         pillarDurations: { strength, yoga, breath } }
//
//   GET /api/home/weekly-activity
//     → { weeks: [{ weekStart: 'YYYY-MM-DD', strength, yoga, breath } × 4] }
//       Oldest → newest. Week anchored to Monday (startOfWeekMonday).

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

export default router;

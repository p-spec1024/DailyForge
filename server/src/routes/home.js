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
import { authChain } from '../middleware/auth.js';
import {
  fmtDate,
  calculateStreak,
  startOfWeekMonday,
} from '../services/milestones.js';

const router = Router();
router.use(...authChain);

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

    // S16-T2c: single query against v_completed_sessions replaces 6 per-table
    // queries. duration_min (numeric minutes) and completed_date (DATE) come
    // pre-normalized from the VIEW; pillar is the source-table type column,
    // 'breathwork' for the breathwork half. ORDER BY id DESC keeps the
    // median-window pick deterministic vs the prior date-DESC-then-id-DESC
    // ordering (rows from the same date order by their insertion id).
    const { rows } = await pool.query(
      `SELECT pillar, completed_date, duration_min
         FROM v_completed_sessions
        WHERE user_id = $1
        ORDER BY completed_date DESC NULLS LAST,
                 split_part(row_id, ':', 1)::int DESC`,
      [userId]
    );

    // Streak: distinct completed_date values, formatted YYYY-MM-DD.
    const dateSet = new Set(
      rows
        .map((r) => r.completed_date)
        .filter((d) => d != null)
        .map((d) => (d instanceof Date ? fmtDate(d) : String(d).slice(0, 10)))
    );
    const streakDays = calculateStreak(dateSet, today);

    // Minutes this week: sum duration_min for rows in [monday, sunday] window.
    let minutesThisWeek = 0;
    for (const r of rows) {
      if (r.completed_date == null || r.duration_min == null) continue;
      const ds = r.completed_date instanceof Date
        ? fmtDate(r.completed_date)
        : String(r.completed_date).slice(0, 10);
      if (ds >= mondayStr && ds <= sundayStr) {
        minutesThisWeek += Number(r.duration_min);
      }
    }
    minutesThisWeek = Math.round(minutesThisWeek);

    // Sessions this year: count rows with completed_date >= yearStart.
    let sessionsThisYear = 0;
    for (const r of rows) {
      if (r.completed_date == null) continue;
      const ds = r.completed_date instanceof Date
        ? fmtDate(r.completed_date)
        : String(r.completed_date).slice(0, 10);
      if (ds >= yearStart) sessionsThisYear += 1;
    }

    // Pillar median durations: last N per pillar in seconds (duration_min × 60
    // to match the prior pillarDurationMinutes helper, which expects seconds).
    // Strength bucket includes both 'strength' and '5phase' types.
    const pickLastN = (filterFn) => {
      const picked = [];
      for (const r of rows) {
        if (picked.length >= PILLAR_MEDIAN_WINDOW) break;
        if (!filterFn(r)) continue;
        if (r.duration_min == null || Number(r.duration_min) <= 0) continue;
        picked.push(Number(r.duration_min) * 60);
      }
      return picked;
    };
    const pillarDurations = {
      strength: pillarDurationMinutes(
        pickLastN((r) => r.pillar === 'strength' || r.pillar === '5phase'),
        PILLAR_FALLBACKS.strength
      ),
      yoga: pillarDurationMinutes(
        pickLastN((r) => r.pillar === 'yoga'),
        PILLAR_FALLBACKS.yoga
      ),
      breath: pillarDurationMinutes(
        pickLastN((r) => r.pillar === 'breathwork'),
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

    // S16-T2c: single query against v_completed_sessions. pillar values
    // 'strength' + '5phase' both bucket into the strength count.
    const { rows } = await pool.query(
      `SELECT pillar, completed_date
         FROM v_completed_sessions
        WHERE user_id = $1
          AND completed_date IS NOT NULL
          AND completed_date >= $2::date`,
      [userId, oldestStr]
    );

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

    for (const row of rows) {
      const ds = row.completed_date instanceof Date
        ? fmtDate(row.completed_date)
        : String(row.completed_date).slice(0, 10);
      const idx = bucketIndexFor(ds);
      if (idx < 0) continue;
      if (row.pillar === 'strength' || row.pillar === '5phase') {
        buckets[idx].strength += 1;
      } else if (row.pillar === 'yoga') {
        buckets[idx].yoga += 1;
      } else if (row.pillar === 'breathwork') {
        buckets[idx].breath += 1;
      }
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

    // S16-T2c: single query against v_completed_sessions. duration_min comes
    // pre-normalized from the VIEW (sessions.duration / 60.0 or
    // breathwork.duration_seconds / 60.0). Aggregate per-date in JS rather
    // than SQL since the round-trip target is 1.
    const { rows } = await pool.query(
      `SELECT completed_date, duration_min
         FROM v_completed_sessions
        WHERE user_id = $1
          AND completed_date IS NOT NULL
          AND duration_min IS NOT NULL
          AND completed_date >= $2::date`,
      [userId, oldestStr]
    );

    // Build a date → minutes map, then walk every day in the window so
    // empty days emit `load_minutes: 0` (clients should never see gaps).
    // Accumulate in seconds and divide once at the end to preserve the
    // pre-migration rounding semantics.
    const secsByDate = new Map();
    for (const r of rows) {
      const ds = r.completed_date instanceof Date
        ? fmtDate(r.completed_date)
        : String(r.completed_date).slice(0, 10);
      const secs = Math.round(Number(r.duration_min) * 60);
      secsByDate.set(ds, (secsByDate.get(ds) || 0) + secs);
    }

    const points = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(oldest);
      d.setDate(oldest.getDate() + i);
      const ds = fmtDate(d);
      const secs = secsByDate.get(ds) || 0;
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

    // S16-T2c: single query against v_completed_sessions, with multi-phase
    // dedupe. A 5-phase session that writes 2-3 per-pillar rows counts as 1,
    // not 2-3. Dedupe key uses multi_phase_session_id when present; else the
    // VIEW's row_id (unique per source-table row).
    const { rows } = await pool.query(
      `SELECT row_id, multi_phase_session_id, completed_date
         FROM v_completed_sessions
        WHERE user_id = $1
          AND completed_date IS NOT NULL
          AND completed_date >= $2::date`,
      [userId, oldestStr]
    );

    const byDate = new Map();
    const seenKeys = new Set();
    for (const row of rows) {
      const dedupeKey = row.multi_phase_session_id != null
        ? `mp:${row.multi_phase_session_id}`
        : row.row_id;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      const ds = row.completed_date instanceof Date
        ? fmtDate(row.completed_date)
        : String(row.completed_date).slice(0, 10);
      byDate.set(ds, (byDate.get(ds) || 0) + 1);
    }

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

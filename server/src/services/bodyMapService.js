// Body-map data service: SQL queries + normalization for the 3D body-map
// home-page endpoints (S10-T5b).
//
// Window semantics: 'range' query param maps to a number of past days.
//   7d → 7, 30d → 30, 90d → 90, year → 365.
//
// Normalization (deviation from spec, see report):
//   The ticket asked for per-group user-relative normalization against a
//   90d personal max. After looking at the mock data shape (Quads=85,
//   Glutes=12, etc.) and re-reading the spec's "beginner's heaviest-trained
//   muscle also reads ~100" line, the cleanest interpretation that matches
//   the mock is RANK-WITHIN-WINDOW: the user's most-trained muscle in the
//   window scales to 100, others scaled relative to it. This gives a
//   differentiated heatmap regardless of absolute training intensity. We
//   also keep a 90d (or windowDays, whichever is larger) baseline so that
//   if the requested window is empty the heatmap can still show recent
//   activity from the longer baseline.

import { pool } from '../db/pool.js';
import {
  muscleTextToDbGroups,
  yogaPoseToRegions,
  STRENGTH_GROUPS,
  FLEXIBILITY_REGIONS,
} from './muscleMapping.js';
import { MILESTONES, fmtDate } from './milestones.js';

export const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, 'year': 365 };
const BASELINE_DAYS_MIN = 90;
const MILESTONE_RECENCY_DAYS = 30;
// PRs at exactly this weight are almost always placeholders for bodyweight
// exercises whose load wasn't recorded. Filter them out of recent-wins.
const MIN_PR_WEIGHT = 2;

const WORKING_SET_FILTER = "(se.set_type = 'normal' OR se.set_type IS NULL)";

export function parseRange(raw) {
  if (raw && Object.prototype.hasOwnProperty.call(RANGE_DAYS, raw)) return raw;
  return '30d';
}

function emptyVolumes(groups) {
  const out = {};
  for (const g of groups) out[g] = 0;
  return out;
}

function rankNormalize(volumeByKey, keys) {
  const result = {};
  let max = 0;
  for (const k of keys) {
    const v = volumeByKey[k] || 0;
    if (v > max) max = v;
  }
  for (const k of keys) {
    const v = volumeByKey[k] || 0;
    result[k] = max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0;
  }
  return result;
}

// Compare two PG DATE values as YYYY-MM-DD strings to dodge any local-vs-UTC
// drift in JS Date math. PG returns DATE as a Date at local-midnight; using
// the same fmtDate helper on both sides keeps the comparison TZ-stable.
function windowCutoffString(windowDays, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - windowDays);
  return fmtDate(cutoff);
}

function rowDateString(rawDate) {
  if (!rawDate) return null;
  const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
  return fmtDate(d);
}

// ─── Muscle volumes ─────────────────────────────────────────────────────

export async function getMuscleVolumes(userId, range) {
  const windowDays = RANGE_DAYS[range];
  const baselineDays = Math.max(BASELINE_DAYS_MIN, windowDays);

  // Pull all completed working sets in the BASELINE window (covers window).
  const { rows } = await pool.query(
    `SELECT s.date,
            e.target_muscles,
            se.weight,
            se.reps_completed
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
       JOIN exercises e ON e.id = se.exercise_id
      WHERE s.user_id = $1
        AND s.completed = true
        AND se.completed = true
        AND e.type = 'strength'
        AND s.date IS NOT NULL
        AND s.date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
        AND ${WORKING_SET_FILTER}`,
    [userId, baselineDays]
  );

  const cutoffStr = windowCutoffString(windowDays);
  const windowVolume = emptyVolumes(STRENGTH_GROUPS);
  const baselineVolume = emptyVolumes(STRENGTH_GROUPS);

  for (const row of rows) {
    const w = row.weight == null ? 0 : Number(row.weight);
    const reps = row.reps_completed == null ? 0 : Number(row.reps_completed);
    const setVolume = w * reps; // bodyweight (NULL weight) → 0; KNOWN LIMITATION
    if (setVolume === 0) continue;

    const groups = muscleTextToDbGroups(row.target_muscles);
    if (groups.size === 0) continue;

    const inWindow = rowDateString(row.date) >= cutoffStr;
    for (const g of groups) {
      baselineVolume[g] += setVolume;
      if (inWindow) windowVolume[g] += setVolume;
    }
  }

  // Use windowVolume primarily; fall back to baseline if window is entirely
  // empty (so a 7d view of an inactive week still shows the user's recent
  // training pattern instead of an empty heatmap).
  const totalsForRanking = Object.values(windowVolume).some((v) => v > 0)
    ? windowVolume
    : baselineVolume;

  return rankNormalize(totalsForRanking, STRENGTH_GROUPS);
}

// ─── Flexibility ────────────────────────────────────────────────────────

export async function getFlexibility(userId, range) {
  const windowDays = RANGE_DAYS[range];
  const baselineDays = Math.max(BASELINE_DAYS_MIN, windowDays);

  // Yoga sessions: pull pose info + the session's reported pose minutes.
  // We approximate region-minutes via duration_secs per session_exercise
  // when present; otherwise fall back to session.duration / pose_count.
  const { rows: sxRows } = await pool.query(
    `SELECT s.id AS session_id,
            s.date,
            s.duration AS session_duration_secs,
            e.id AS exercise_id,
            e.name AS pose_name,
            e.target_muscles,
            e.category,
            se.duration_secs AS sx_duration_secs,
            se.hold_duration_seconds AS hold_secs
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
       JOIN exercises e ON e.id = se.exercise_id
      WHERE s.user_id = $1
        AND s.completed = true
        AND se.completed = true
        AND s.type = 'yoga'
        AND e.type = 'yoga'
        AND s.date IS NOT NULL
        AND s.date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')`,
    [userId, baselineDays]
  );

  // Pre-pass: per session, count poses (for duration fallback).
  const posesPerSession = new Map();
  for (const r of sxRows) {
    posesPerSession.set(r.session_id, (posesPerSession.get(r.session_id) || 0) + 1);
  }

  const cutoffStr = windowCutoffString(windowDays);
  const windowMinutes = emptyVolumes(FLEXIBILITY_REGIONS);
  const baselineMinutes = emptyVolumes(FLEXIBILITY_REGIONS);

  for (const r of sxRows) {
    let secs = r.hold_secs ?? r.sx_duration_secs;
    if (!secs || secs <= 0) {
      const sessionSecs = r.session_duration_secs || 0;
      const poseCount = posesPerSession.get(r.session_id) || 1;
      secs = sessionSecs > 0 ? Math.round(sessionSecs / poseCount) : 30;
    }
    const minutes = secs / 60;

    const regions = yogaPoseToRegions(r.pose_name, r.target_muscles, r.category);
    if (regions.size === 0) continue;

    const inWindow = rowDateString(r.date) >= cutoffStr;
    for (const region of regions) {
      baselineMinutes[region] += minutes;
      if (inWindow) windowMinutes[region] += minutes;
    }
  }

  const totals = Object.values(windowMinutes).some((v) => v > 0)
    ? windowMinutes
    : baselineMinutes;

  return rankNormalize(totals, FLEXIBILITY_REGIONS);
}

// ─── Recent wins ────────────────────────────────────────────────────────

/**
 * Returns the last N wins as an array of { icon, title, subtitle } — all
 * string values, matching the Dart `List<Map<String, String>>` shape in
 * lib/data/mock_body_map_data.dart. We sort internally by date but do not
 * expose it in the response (mock has no date field).
 *
 * Currently emits two kinds of wins: strength PRs and lifetime session-count
 * milestones (10/25/50/100/250/500). Streak wins are intentionally not
 * emitted because we don't track max-ever streak — without that, "current
 * streak" isn't a record-class achievement worth a "win" slot. Re-add when
 * users.max_streak (or equivalent) lands.
 */
export async function getRecentWins(userId, limit) {
  const cap = Math.max(1, Math.min(10, Number(limit) || 5));

  const [prResult, totalResult] = await Promise.all([
    pool.query(
      `SELECT epc.exercise_id,
              epc.best_weight,
              epc.best_weight_date,
              e.name AS exercise_name,
              (SELECT MAX(se.reps_completed)
                 FROM session_exercises se
                 JOIN sessions s ON s.id = se.session_id
                WHERE s.user_id = $1
                  AND se.exercise_id = epc.exercise_id
                  AND se.weight = epc.best_weight
                  AND se.completed = true
                  AND s.date = epc.best_weight_date) AS reps
         FROM exercise_progress_cache epc
         JOIN exercises e ON e.id = epc.exercise_id
        WHERE epc.user_id = $1
          AND epc.kind = 'strength'
          AND epc.best_weight IS NOT NULL
          AND epc.best_weight >= $2
          AND epc.best_weight_date >= CURRENT_DATE - INTERVAL '60 days'
        ORDER BY epc.best_weight_date DESC
        LIMIT 10`,
      [userId, MIN_PR_WEIGHT]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
         FROM sessions WHERE user_id = $1 AND completed = true`,
      [userId]
    ),
  ]);

  const wins = [];

  for (const r of prResult.rows) {
    const weight = Number(r.best_weight);
    const reps = r.reps != null ? Number(r.reps) : null;
    const subtitle = reps
      ? `${r.exercise_name} — ${weight} kg × ${reps}`
      : `${r.exercise_name} — ${weight} kg`;
    wins.push({
      icon: 'trophy',
      title: 'New PR',
      subtitle,
      _date: r.best_weight_date,
    });
  }

  // Lifetime session-count milestones — only surface if the milestone session
  // happened within MILESTONE_RECENCY_DAYS. Without this guard, a user
  // sitting at exactly 250 sessions would see the milestone forever.
  const total = totalResult.rows[0]?.total || 0;
  if (MILESTONES.includes(total)) {
    const { rows: nth } = await pool.query(
      `SELECT date FROM sessions
        WHERE user_id = $1 AND completed = true AND date IS NOT NULL
        ORDER BY date ASC, id ASC
        OFFSET ($2::int - 1) LIMIT 1`,
      [userId, total]
    );
    const milestoneDate = nth[0]?.date;
    if (milestoneDate) {
      const ageDays = (Date.now() - new Date(milestoneDate).getTime()) / 86400000;
      if (ageDays <= MILESTONE_RECENCY_DAYS) {
        wins.push({
          icon: 'star',
          title: `${total} sessions`,
          subtitle: 'Lifetime milestone',
          _date: milestoneDate,
        });
      }
    }
  }

  wins.sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());
  return wins.slice(0, cap).map(({ icon, title, subtitle }) => ({ icon, title, subtitle }));
}

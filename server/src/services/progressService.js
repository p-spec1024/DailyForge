import { pool } from '../db/pool.js';

// Brzycki formula for estimated 1RM (accurate up to ~12 reps)
export function estimate1RM(weight, reps) {
  if (!weight || !reps) return null;
  if (reps === 1) return Number(weight);
  if (reps > 12) return null;
  return Math.round(Number(weight) * (36 / (37 - reps)) * 10) / 10;
}

// Total volume (kg) for a set list
export function calculateVolume(sets) {
  return sets.reduce((total, set) => total + (Number(set.weight || 0) * Number(set.reps || 0)), 0);
}

function rangeThreshold(range) {
  if (range === '30d') return "NOW() - INTERVAL '30 days'";
  if (range === '90d') return "NOW() - INTERVAL '90 days'";
  return null; // all-time
}

// ── Shared summary computation (also writes the cache) ──────────────
// Returns all-time summary for a strength exercise using:
//  • first-session max weight as improvement baseline (C2)
//  • best-set weight+reps for Brzycki 1RM (C3)
//  • working-set filter: warmups, dropsets, and failures never establish a
//    baseline or count as a PR. NULL set_type is treated as 'normal' for
//    backward compatibility with rows logged before set_type existed.
const WORKING_SET_FILTER = "(se.set_type = 'normal' OR se.set_type IS NULL)";
const WORKING_SET_FILTER_SE2 = "(se2.set_type = 'normal' OR se2.set_type IS NULL)";

async function computeStrengthSummary(userId, exerciseId) {
  const [allTime, firstSess, bestSet] = await Promise.all([
    pool.query(
      `SELECT MAX(se.weight) AS all_time_best,
              COUNT(DISTINCT s.id) AS total_sessions,
              MIN(COALESCE(s.date, DATE(s.started_at))) AS first_date,
              MAX(COALESCE(s.date, DATE(s.started_at))) AS last_date,
              SUM(CASE WHEN s.started_at >= NOW() - INTERVAL '30 days'
                       THEN se.weight * COALESCE(se.reps_completed, 0) ELSE 0 END) AS volume_month,
              SUM(se.weight * COALESCE(se.reps_completed, 0)) AS total_volume
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
        WHERE s.user_id = $1 AND se.exercise_id = $2
          AND s.completed = true AND se.completed = true
          AND se.weight IS NOT NULL AND se.weight > 0
          AND ${WORKING_SET_FILTER}`,
      [userId, exerciseId]
    ),
    // First session's max weight = baseline for improvement %
    pool.query(
      `SELECT MAX(se.weight) AS first_session_weight
         FROM session_exercises se
        WHERE se.exercise_id = $2
          AND se.completed = true
          AND se.weight IS NOT NULL AND se.weight > 0
          AND ${WORKING_SET_FILTER}
          AND se.session_id = (
            SELECT s.id FROM sessions s
              JOIN session_exercises se2 ON se2.session_id = s.id
             WHERE s.user_id = $1 AND se2.exercise_id = $2
               AND s.completed = true AND se2.completed = true
               AND se2.weight IS NOT NULL AND se2.weight > 0
               AND ${WORKING_SET_FILTER_SE2}
             ORDER BY s.started_at ASC
             LIMIT 1
          )`,
      [userId, exerciseId]
    ),
    // Best set = highest weight (ties broken by highest reps, then earliest date)
    pool.query(
      `SELECT se.weight AS best_set_weight,
              se.reps_completed AS best_set_reps,
              COALESCE(s.date, DATE(s.started_at)) AS best_weight_date
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
        WHERE s.user_id = $1 AND se.exercise_id = $2
          AND s.completed = true AND se.completed = true
          AND se.weight IS NOT NULL AND se.weight > 0
          AND se.reps_completed IS NOT NULL AND se.reps_completed > 0
          AND ${WORKING_SET_FILTER}
        ORDER BY se.weight DESC, se.reps_completed DESC, s.started_at ASC
        LIMIT 1`,
      [userId, exerciseId]
    ),
  ]);

  const a = allTime.rows[0] || {};
  const f = firstSess.rows[0] || {};
  const b = bestSet.rows[0] || {};

  const allTimeBest = parseFloat(a.all_time_best || 0);
  const firstWeight = parseFloat(f.first_session_weight || 0);
  const bestSetWeight = parseFloat(b.best_set_weight || 0);
  const bestSetReps = parseInt(b.best_set_reps || 0, 10);

  const improvement = firstWeight > 0
    ? Math.round(((allTimeBest - firstWeight) / firstWeight) * 1000) / 10
    : 0;

  // C3: Brzycki using the best set's own reps (clamped to formula's valid range)
  const est1rm = bestSetReps > 0 && bestSetReps <= 12
    ? estimate1RM(bestSetWeight, bestSetReps)
    : bestSetReps === 1 ? bestSetWeight : null;

  return {
    all_time_best: allTimeBest,
    total_sessions: parseInt(a.total_sessions || 0, 10),
    first_date: a.first_date || null,
    last_date: a.last_date || null,
    volume_month: Math.round(parseFloat(a.volume_month || 0)),
    total_volume: Math.round(parseFloat(a.total_volume || 0)),
    first_session_weight: firstWeight,
    improvement_percent: improvement,
    estimated_1rm: est1rm,
    best_weight_date: b.best_weight_date || null,
    best_set_weight: bestSetWeight,
    best_set_reps: bestSetReps,
  };
}

// Determine an exercise's "kind" (strength/yoga/breathwork)
// Breathwork uses the breathwork_techniques table (separate id namespace).
async function resolveKind(exerciseId, kindHint) {
  if (kindHint === 'breathwork') return 'breathwork';
  const { rows } = await pool.query(
    `SELECT type FROM exercises WHERE id = $1`,
    [exerciseId]
  );
  if (rows.length === 0) return kindHint || 'strength';
  const t = (rows[0].type || '').toLowerCase();
  if (t === 'yoga') return 'yoga';
  if (t === 'breathwork') return 'breathwork';
  return 'strength';
}

// ── Chart / detail data ──────────────────────────────────────────────
export async function getChartData(userId, exerciseId, range, kindHint) {
  const kind = await resolveKind(exerciseId, kindHint);
  const threshold = rangeThreshold(range);

  if (kind === 'breathwork') {
    return getBreathworkChart(userId, exerciseId, threshold);
  }
  if (kind === 'yoga') {
    return getYogaChart(userId, exerciseId, threshold);
  }
  return getStrengthChart(userId, exerciseId, threshold);
}

async function getStrengthChart(userId, exerciseId, threshold) {
  const dateFilter = threshold ? `AND s.started_at >= ${threshold}` : '';
  const priorDateFilter = threshold ? `AND s.started_at < ${threshold}` : '';
  const { rows: exRows } = await pool.query(
    `SELECT id, name, type FROM exercises WHERE id = $1`,
    [exerciseId]
  );
  if (exRows.length === 0) return null;
  const exercise = { id: exRows[0].id, name: exRows[0].name, type: 'strength' };

  // Per-session best set + total volume.
  // DISTINCT ON picks the heaviest set per session (ties broken by most reps)
  // so that the chart's PR logic matches the history list's reps-aware tie-break
  // from computeStrengthSummary. Volume is summed per-session via a correlated
  // aggregate so the chart's volume bar stays accurate.
  const { rows: chartRows } = await pool.query(
    `WITH session_best AS (
       SELECT DISTINCT ON (s.id)
              s.id AS session_id,
              s.started_at,
              COALESCE(s.date, DATE(s.started_at)) AS date,
              se.weight AS best_weight,
              se.reps_completed AS best_reps
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
        WHERE s.user_id = $1
          AND se.exercise_id = $2
          AND s.completed = true
          AND se.completed = true
          AND se.set_number IS NOT NULL
          AND se.weight IS NOT NULL AND se.weight > 0
          AND se.reps_completed IS NOT NULL AND se.reps_completed > 0
          AND ${WORKING_SET_FILTER}
          ${dateFilter}
        ORDER BY s.id, se.weight DESC, se.reps_completed DESC
     )
     SELECT sb.session_id, sb.date, sb.started_at,
            sb.best_weight, sb.best_reps,
            COALESCE((
              SELECT SUM(se.weight * COALESCE(se.reps_completed, 0))
                FROM session_exercises se
               WHERE se.session_id = sb.session_id
                 AND se.exercise_id = $2
                 AND se.completed = true
                 AND se.set_number IS NOT NULL
                 AND se.weight IS NOT NULL AND se.weight > 0
                 AND ${WORKING_SET_FILTER}
            ), 0) AS volume
       FROM session_best sb
      ORDER BY sb.started_at ASC`,
    [userId, exerciseId]
  );

  // Bootstrap the running best (weight, reps) pair from sessions *before* the
  // window so PR markers inside the window are relative to all prior history.
  // Reps-aware tie-breaking matches history's has_pr and computeStrengthSummary.
  let runningWeight = 0;
  let runningReps = 0;
  if (threshold) {
    const { rows: priorRows } = await pool.query(
      `SELECT se.weight AS prior_weight, se.reps_completed AS prior_reps
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
        WHERE s.user_id = $1 AND se.exercise_id = $2
          AND s.completed = true AND se.completed = true
          AND se.weight IS NOT NULL AND se.weight > 0
          AND se.reps_completed IS NOT NULL AND se.reps_completed > 0
          AND ${WORKING_SET_FILTER}
          ${priorDateFilter}
        ORDER BY se.weight DESC, se.reps_completed DESC, s.started_at ASC
        LIMIT 1`,
      [userId, exerciseId]
    );
    if (priorRows[0]) {
      runningWeight = parseFloat(priorRows[0].prior_weight || 0);
      runningReps = parseInt(priorRows[0].prior_reps || 0, 10);
    }
  }

  const chart_data = chartRows.map(r => {
    const weight = parseFloat(r.best_weight);
    const reps = parseInt(r.best_reps, 10);
    // Reps-aware PR: strictly heavier, OR same weight with strictly more reps.
    const isPr = weight > runningWeight
              || (weight === runningWeight && reps > runningReps);
    if (isPr) {
      runningWeight = weight;
      runningReps = reps;
    }
    return {
      date: r.date,
      weight,
      reps,
      volume: Math.round(parseFloat(r.volume || 0)),
      is_pr: isPr,
    };
  });

  // Summary (shared logic — C2/C3 fixed baseline & best-set 1RM)
  const summary = await computeStrengthSummary(userId, exerciseId);
  const currentBest = chart_data.length ? chart_data[chart_data.length - 1].weight : 0;

  // Recent sessions — last 5 with set-by-set breakdown
  const { rows: recent } = await pool.query(
    `SELECT s.id,
            COALESCE(s.date, DATE(s.started_at)) AS date,
            json_agg(json_build_object(
              'weight', se.weight,
              'reps', se.reps_completed
            ) ORDER BY se.set_number) AS sets
       FROM sessions s
       JOIN session_exercises se ON se.session_id = s.id
      WHERE s.user_id = $1 AND se.exercise_id = $2
        AND s.completed = true AND se.completed = true
        AND se.set_number IS NOT NULL
        AND ${WORKING_SET_FILTER}
      GROUP BY s.id, s.date, s.started_at
      ORDER BY s.started_at DESC
      LIMIT 5`,
    [userId, exerciseId]
  );

  return {
    exercise,
    summary: {
      current_best: currentBest,
      all_time_best: summary.all_time_best,
      improvement_percent: summary.improvement_percent,
      estimated_1rm: summary.estimated_1rm,
      total_volume_month: summary.volume_month,
      total_sessions: summary.total_sessions,
    },
    chart_data,
    recent_sessions: recent.map(r => ({ date: r.date, sets: r.sets })),
  };
}

async function getYogaChart(userId, exerciseId, threshold) {
  const dateFilter = threshold ? `AND s.started_at >= ${threshold}` : '';
  const { rows: exRows } = await pool.query(
    `SELECT id, name, sanskrit_name FROM exercises WHERE id = $1`,
    [exerciseId]
  );
  if (exRows.length === 0) return null;
  const exercise = {
    id: exRows[0].id,
    name: exRows[0].name,
    sanskrit_name: exRows[0].sanskrit_name,
    type: 'yoga',
  };

  // Use hold_duration_seconds if set, else fall back to duration_secs
  const { rows: chartRows } = await pool.query(
    `SELECT s.id AS session_id,
            COALESCE(s.date, DATE(s.started_at)) AS date,
            MAX(COALESCE(se.hold_duration_seconds, se.duration_secs)) AS hold_seconds
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
      WHERE s.user_id = $1
        AND se.exercise_id = $2
        AND s.completed = true
        AND se.completed = true
        ${dateFilter}
      GROUP BY s.id, s.date, s.started_at
      ORDER BY s.started_at ASC`,
    [userId, exerciseId]
  );

  // Bootstrap prior best for PR markers relative to all history
  let runningBest = 0;
  if (threshold) {
    const { rows: priorRows } = await pool.query(
      `SELECT MAX(COALESCE(se.hold_duration_seconds, se.duration_secs)) AS prior_best
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
        WHERE s.user_id = $1 AND se.exercise_id = $2
          AND s.completed = true AND se.completed = true
          AND s.started_at < ${threshold}`,
      [userId, exerciseId]
    );
    runningBest = parseInt(priorRows[0]?.prior_best || 0);
  }
  const chart_data = chartRows
    .filter(r => r.hold_seconds !== null)
    .map(r => {
      const hold = parseInt(r.hold_seconds);
      const isBest = hold > runningBest;
      if (isBest) runningBest = hold;
      return { date: r.date, hold_seconds: hold, is_best: isBest };
    });

  const allTimeBest = chart_data.reduce((m, p) => Math.max(m, p.hold_seconds), 0);
  const firstHold = chart_data.length ? chart_data[0].hold_seconds : 0;
  const improvement = firstHold > 0
    ? Math.round(((allTimeBest - firstHold) / firstHold) * 1000) / 10
    : 0;
  const currentBest = chart_data.length ? chart_data[chart_data.length - 1].hold_seconds : 0;

  return {
    exercise,
    summary: {
      current_best_hold: currentBest,
      all_time_best_hold: allTimeBest,
      improvement_percent: improvement,
      total_sessions: chart_data.length,
    },
    chart_data,
    recent_sessions: [],
  };
}

async function getBreathworkChart(userId, techniqueId, threshold) {
  const dateFilter = threshold ? `AND bs.created_at >= ${threshold}` : '';
  const { rows: exRows } = await pool.query(
    `SELECT id, name FROM breathwork_techniques WHERE id = $1`,
    [techniqueId]
  );
  if (exRows.length === 0) return null;
  const exercise = { id: exRows[0].id, name: exRows[0].name, type: 'breathwork' };

  // Read from breathwork_sessions (existing) plus breathwork_logs (if populated)
  const { rows: chartRows } = await pool.query(
    `SELECT DATE(bs.created_at) AS date,
            bs.duration_seconds,
            bs.rounds_completed,
            bl.max_hold_seconds
       FROM breathwork_sessions bs
       LEFT JOIN breathwork_logs bl ON bl.session_id IS NOT NULL
         AND bl.user_id = bs.user_id
         AND bl.technique_id = bs.technique_id
         AND DATE(bl.created_at) = DATE(bs.created_at)
      WHERE bs.user_id = $1
        AND bs.technique_id = $2
        AND bs.completed = true
        ${dateFilter}
      ORDER BY bs.created_at ASC`,
    [userId, techniqueId]
  );

  const chart_data = chartRows.map(r => ({
    date: r.date,
    max_hold_seconds: r.max_hold_seconds ? parseInt(r.max_hold_seconds) : null,
    rounds: parseInt(r.rounds_completed || 0),
    duration_seconds: parseInt(r.duration_seconds || 0),
  }));

  const totalDuration = chart_data.reduce((s, r) => s + r.duration_seconds, 0);
  const totalRounds = chart_data.reduce((s, r) => s + r.rounds, 0);
  const bestHold = chart_data.reduce((m, r) => Math.max(m, r.max_hold_seconds || 0), 0);
  const avgRounds = chart_data.length ? Math.round(totalRounds / chart_data.length) : 0;
  const holds = chart_data.filter(r => r.max_hold_seconds).map(r => r.max_hold_seconds);
  const avgHold = holds.length ? Math.round(holds.reduce((a, b) => a + b, 0) / holds.length) : null;

  return {
    exercise,
    summary: {
      avg_hold_seconds: avgHold,
      best_hold_seconds: bestHold || null,
      total_sessions: chart_data.length,
      total_breathwork_minutes: Math.round(totalDuration / 60),
      avg_rounds_per_session: avgRounds,
    },
    chart_data,
    recent_sessions: [],
  };
}

// ── Cache calculation ────────────────────────────────────────────────
export async function calculateProgressCache(userId, exerciseId, kindHint) {
  const kind = await resolveKind(exerciseId, kindHint);

  if (kind === 'strength') {
    const s = await computeStrengthSummary(userId, exerciseId);

    // best_volume = max per-set volume (weight × reps) across all sessions.
    // Kept as a separate query — summary doesn't need it, but the cache does.
    const { rows: volRows } = await pool.query(
      `SELECT MAX(se.weight * COALESCE(se.reps_completed, 0)) AS best_volume
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
        WHERE s.user_id = $1 AND se.exercise_id = $2
          AND s.completed = true AND se.completed = true
          AND se.weight IS NOT NULL AND se.weight > 0
          AND ${WORKING_SET_FILTER}`,
      [userId, exerciseId]
    );
    const bestVolume = volRows[0]?.best_volume
      ? Math.round(parseFloat(volRows[0].best_volume))
      : null;

    await pool.query(
      `INSERT INTO exercise_progress_cache (
         user_id, exercise_id, kind, best_weight, best_weight_date,
         best_volume, estimated_1rm, total_sessions, first_session_date,
         last_session_date, improvement_percentage, updated_at
       ) VALUES ($1,$2,'strength',$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (user_id, exercise_id, kind) DO UPDATE SET
         best_weight = EXCLUDED.best_weight,
         best_weight_date = EXCLUDED.best_weight_date,
         best_volume = EXCLUDED.best_volume,
         estimated_1rm = EXCLUDED.estimated_1rm,
         total_sessions = EXCLUDED.total_sessions,
         first_session_date = EXCLUDED.first_session_date,
         last_session_date = EXCLUDED.last_session_date,
         improvement_percentage = EXCLUDED.improvement_percentage,
         updated_at = NOW()`,
      [
        userId, exerciseId,
        s.all_time_best || null,
        s.best_weight_date,
        bestVolume,
        s.estimated_1rm,
        s.total_sessions,
        s.first_date,
        s.last_date,
        s.improvement_percent,
      ]
    );
    return;
  }

  if (kind === 'yoga') {
    const { rows } = await pool.query(
      `SELECT MAX(COALESCE(se.hold_duration_seconds, se.duration_secs)) AS best_hold,
              COUNT(DISTINCT s.id) AS total_sessions,
              MIN(COALESCE(s.date, DATE(s.started_at))) AS first_date,
              MAX(COALESCE(s.date, DATE(s.started_at))) AS last_date
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
        WHERE s.user_id = $1 AND se.exercise_id = $2
          AND s.completed = true AND se.completed = true`,
      [userId, exerciseId]
    );
    const r = rows[0] || {};
    const bestHold = parseInt(r.best_hold || 0);

    await pool.query(
      `INSERT INTO exercise_progress_cache (
         user_id, exercise_id, kind, best_hold_seconds,
         total_sessions, first_session_date, last_session_date, updated_at
       ) VALUES ($1,$2,'yoga',$3,$4,$5,$6,NOW())
       ON CONFLICT (user_id, exercise_id, kind) DO UPDATE SET
         best_hold_seconds = EXCLUDED.best_hold_seconds,
         total_sessions = EXCLUDED.total_sessions,
         first_session_date = EXCLUDED.first_session_date,
         last_session_date = EXCLUDED.last_session_date,
         updated_at = NOW()`,
      [
        userId, exerciseId,
        bestHold || null,
        parseInt(r.total_sessions || 0),
        r.first_date || null, r.last_date || null,
      ]
    );
    return;
  }

  if (kind === 'breathwork') {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS total_sessions,
              SUM(rounds_completed) AS total_rounds,
              MIN(DATE(created_at)) AS first_date,
              MAX(DATE(created_at)) AS last_date
         FROM breathwork_sessions
        WHERE user_id = $1 AND technique_id = $2 AND completed = true`,
      [userId, exerciseId]
    );
    const { rows: logRows } = await pool.query(
      `SELECT MAX(max_hold_seconds) AS best_hold
         FROM breathwork_logs
        WHERE user_id = $1 AND technique_id = $2`,
      [userId, exerciseId]
    );
    const r = rows[0] || {};
    const bestHold = parseInt(logRows[0]?.best_hold || 0);

    await pool.query(
      `INSERT INTO exercise_progress_cache (
         user_id, exercise_id, kind, best_breath_hold_seconds,
         total_rounds, total_sessions, first_session_date, last_session_date, updated_at
       ) VALUES ($1,$2,'breathwork',$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (user_id, exercise_id, kind) DO UPDATE SET
         best_breath_hold_seconds = EXCLUDED.best_breath_hold_seconds,
         total_rounds = EXCLUDED.total_rounds,
         total_sessions = EXCLUDED.total_sessions,
         first_session_date = EXCLUDED.first_session_date,
         last_session_date = EXCLUDED.last_session_date,
         updated_at = NOW()`,
      [
        userId, exerciseId,
        bestHold || null,
        parseInt(r.total_rounds || 0),
        parseInt(r.total_sessions || 0),
        r.first_date || null, r.last_date || null,
      ]
    );
  }
}

// Recalculate cache for all exercises touched by a completed session.
export async function recalculateForSession(sessionId) {
  const { rows: sessRows } = await pool.query(
    `SELECT user_id FROM sessions WHERE id = $1`,
    [sessionId]
  );
  if (sessRows.length === 0) return;
  const userId = sessRows[0].user_id;

  const { rows: exRows } = await pool.query(
    `SELECT DISTINCT se.exercise_id, e.type
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
      WHERE se.session_id = $1 AND se.completed = true`,
    [sessionId]
  );

  for (const row of exRows) {
    try {
      await calculateProgressCache(userId, row.exercise_id, (row.type || '').toLowerCase());
    } catch (err) {
      console.error(`[progress] cache recalc failed for exercise ${row.exercise_id}:`, err.message);
    }
  }
}

// Recalculate cache after a breathwork session logs.
export async function recalculateBreathwork(userId, techniqueId) {
  try {
    await calculateProgressCache(userId, techniqueId, 'breathwork');
  } catch (err) {
    console.error(`[progress] breathwork cache recalc failed for technique ${techniqueId}:`, err.message);
  }
}

// ── Cache backfill ──────────────────────────────────────────────────
// Warm the cache for every (exercise, kind) this user has logged.
// Called lazily the first time a user hits /progress/exercises with an empty
// cache — so existing users from before the cache existed get populated on
// first view instead of requiring a manual migration step.
async function backfillCacheForUser(userId) {
  const [exRes, btRes] = await Promise.all([
    pool.query(
      `SELECT DISTINCT se.exercise_id, LOWER(COALESCE(e.type, 'strength')) AS type
         FROM session_exercises se
         JOIN sessions s ON s.id = se.session_id
         JOIN exercises e ON e.id = se.exercise_id
        WHERE s.user_id = $1 AND s.completed = true AND se.completed = true`,
      [userId]
    ),
    pool.query(
      `SELECT DISTINCT technique_id
         FROM breathwork_sessions
        WHERE user_id = $1 AND completed = true`,
      [userId]
    ),
  ]);

  const tasks = [
    ...exRes.rows.map(r => calculateProgressCache(userId, r.exercise_id, r.type)),
    ...btRes.rows.map(r => calculateProgressCache(userId, r.technique_id, 'breathwork')),
  ];
  await Promise.allSettled(tasks);
}

// ── History list (reads from exercise_progress_cache) ──────────────
export async function getExerciseHistory(userId) {
  // Lazy backfill whenever the cache is missing entries for this user.
  // "Expected" = distinct exercises the user has completed in strength/yoga +
  // distinct breathwork techniques completed. If cache row count is below
  // expected, we have a partial cache (e.g. a pre-deploy user who has logged
  // one new session post-deploy) and need to warm the rest.
  //
  // Both queries are cheap (single-user scans over indexed columns) and the
  // backfill helper is idempotent via ON CONFLICT DO UPDATE.
  const [expectedRes, actualRes] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(DISTINCT se.exercise_id)::int
            FROM session_exercises se
            JOIN sessions s ON s.id = se.session_id
           WHERE s.user_id = $1
             AND s.completed = true
             AND se.completed = true)
         +
         (SELECT COUNT(DISTINCT technique_id)::int
            FROM breathwork_sessions
           WHERE user_id = $1 AND completed = true)
         AS expected`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM exercise_progress_cache WHERE user_id = $1`,
      [userId]
    ),
  ]);
  const expected = parseInt(expectedRes.rows[0]?.expected || 0, 10);
  const actual = parseInt(actualRes.rows[0]?.n || 0, 10);
  if (actual < expected) {
    await backfillCacheForUser(userId);
  }

  const [strengthRes, yogaRes, breathRes] = await Promise.all([
    pool.query(
      `SELECT c.exercise_id, e.name,
              c.best_weight,
              c.best_weight_date AS best_date,
              c.total_sessions,
              c.last_session_date AS last_session,
              -- C4: has_pr = the all-time best weight was set in the last 30 days.
              -- Matching an existing PR doesn't move best_weight_date forward
              -- (computeStrengthSummary breaks ties by earliest date), so this
              -- only fires on a genuinely new personal record.
              (c.best_weight_date IS NOT NULL
               AND c.best_weight_date >= CURRENT_DATE - INTERVAL '30 days') AS has_pr
         FROM exercise_progress_cache c
         JOIN exercises e ON e.id = c.exercise_id
        WHERE c.user_id = $1 AND c.kind = 'strength'
          AND c.best_weight IS NOT NULL
        ORDER BY c.last_session_date DESC NULLS LAST
        LIMIT 100`,
      [userId]
    ),
    pool.query(
      `SELECT c.exercise_id, e.name, e.sanskrit_name,
              c.best_hold_seconds,
              c.total_sessions,
              c.last_session_date AS last_session
         FROM exercise_progress_cache c
         JOIN exercises e ON e.id = c.exercise_id
        WHERE c.user_id = $1 AND c.kind = 'yoga'
        ORDER BY c.last_session_date DESC NULLS LAST
        LIMIT 100`,
      [userId]
    ),
    pool.query(
      `SELECT c.exercise_id, bt.name,
              c.best_breath_hold_seconds AS best_hold_seconds,
              c.total_sessions,
              c.last_session_date AS last_session
         FROM exercise_progress_cache c
         JOIN breathwork_techniques bt ON bt.id = c.exercise_id
        WHERE c.user_id = $1 AND c.kind = 'breathwork'
        ORDER BY c.last_session_date DESC NULLS LAST
        LIMIT 100`,
      [userId]
    ),
  ]);

  return {
    strength: strengthRes.rows.map(r => ({
      exercise_id: r.exercise_id,
      name: r.name,
      best_weight: parseFloat(r.best_weight || 0),
      best_date: r.best_date,
      total_sessions: parseInt(r.total_sessions || 0, 10),
      last_session: r.last_session,
      has_pr: !!r.has_pr,
    })),
    yoga: yogaRes.rows.map(r => ({
      exercise_id: r.exercise_id,
      name: r.name,
      sanskrit_name: r.sanskrit_name,
      best_hold_seconds: parseInt(r.best_hold_seconds || 0, 10),
      total_sessions: parseInt(r.total_sessions || 0, 10),
      last_session: r.last_session,
    })),
    breathwork: breathRes.rows.map(r => ({
      exercise_id: r.exercise_id,
      name: r.name,
      best_hold_seconds: r.best_hold_seconds ? parseInt(r.best_hold_seconds, 10) : null,
      total_sessions: parseInt(r.total_sessions || 0, 10),
      last_session: r.last_session,
    })),
  };
}

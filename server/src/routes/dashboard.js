import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const MILESTONES = [10, 25, 50, 100, 250, 500];

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(today) {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun
  const back = (dow + 6) % 7; // days since Monday
  d.setDate(d.getDate() - back);
  return d;
}

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const todayStr = fmtDate(today);
    const monday = startOfWeekMonday(today);
    const mondayStr = fmtDate(monday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = fmtDate(sunday);

    // Run independent queries in parallel
    const [
      userRow,
      sessionDatesRows,
      lastSessionRows,
      weekActivityRows,
      breathworkWeekRows,
      totalCountRows,
      prRows,
    ] = await Promise.all([
      pool.query(`SELECT name FROM users WHERE id = $1`, [userId]),

      // All distinct active dates (sessions ∪ standalone breathwork) — used
      // for streak + week dots so a breathwork-only day still counts.
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

      pool.query(
        `SELECT MAX(date) AS date FROM (
           SELECT date FROM sessions
            WHERE user_id = $1 AND completed = true AND date IS NOT NULL
           UNION ALL
           SELECT (created_at AT TIME ZONE 'UTC')::date AS date
             FROM breathwork_sessions
            WHERE user_id = $1 AND completed = true
         ) d`,
        [userId]
      ),

      pool.query(
        `SELECT type, COUNT(*)::int AS cnt
         FROM sessions
         WHERE user_id = $1 AND completed = true
           AND date >= $2 AND date <= $3
         GROUP BY type`,
        [userId, mondayStr, sundayStr]
      ),

      pool.query(
        `SELECT COALESCE(SUM(duration_seconds), 0)::int AS total_secs
         FROM breathwork_sessions
         WHERE user_id = $1 AND completed = true
           AND created_at >= $2::date
           AND created_at < ($3::date + INTERVAL '1 day')`,
        [userId, mondayStr, sundayStr]
      ),

      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM sessions WHERE user_id = $1 AND completed = true`,
        [userId]
      ),

      pool.query(
        `SELECT epc.exercise_id, epc.best_weight, epc.best_weight_date,
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
           AND epc.best_weight_date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY epc.best_weight_date DESC
         LIMIT 3`,
        [userId]
      ),
    ]);

    // First name
    const fullName = userRow.rows[0]?.name || '';
    const firstName = fullName.trim().split(/\s+/)[0] || '';

    // Streak calculation
    const dateSet = new Set(
      sessionDatesRows.rows.map(r =>
        r.date instanceof Date ? fmtDate(r.date) : String(r.date).slice(0, 10)
      )
    );
    let streak = 0;
    {
      const cursor = new Date(today);
      cursor.setHours(0, 0, 0, 0);
      // If today has no entry, start counting from yesterday so we don't
      // penalize users who haven't worked out yet today.
      if (!dateSet.has(fmtDate(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (dateSet.has(fmtDate(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    // Last session
    let lastSession = null;
    const lastRaw = lastSessionRows.rows[0]?.date;
    if (lastRaw) {
      const dateStr = lastRaw instanceof Date ? fmtDate(lastRaw) : String(lastRaw).slice(0, 10);
      const ms = new Date(todayStr).getTime() - new Date(dateStr).getTime();
      const daysAgo = Math.max(0, Math.round(ms / 86400000));
      lastSession = { date: dateStr, daysAgo };
    }

    // Week dots (Mon..Sun)
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(dateSet.has(fmtDate(d)));
    }
    const todayIndex = (today.getDay() + 6) % 7;

    // Week activity counts
    let workouts = 0;
    let yoga = 0;
    for (const row of weekActivityRows.rows) {
      const t = row.type;
      const c = row.cnt;
      if (t === 'strength' || t === '5phase') workouts += c;
      else if (t === 'yoga') yoga += c;
    }
    const breathworkSecs = breathworkWeekRows.rows[0]?.total_secs || 0;
    const breathworkMinutes = Math.round(breathworkSecs / 60);

    // Milestone
    const totalSessions = totalCountRows.rows[0]?.total || 0;
    const milestone = MILESTONES.includes(totalSessions)
      ? { reached: true, count: totalSessions }
      : { reached: false, count: null };

    // Recent PRs
    const recentPRs = prRows.rows
      .filter(r => r.best_weight != null)
      .map(r => ({
        exercise: r.exercise_name,
        weight: Number(r.best_weight),
        reps: r.reps != null ? Number(r.reps) : null,
        date:
          r.best_weight_date instanceof Date
            ? fmtDate(r.best_weight_date)
            : String(r.best_weight_date).slice(0, 10),
      }));

    res.json({
      user: { firstName, streak },
      lastSession,
      thisWeek: { days, todayIndex },
      recentPRs,
      weekActivity: { workouts, yoga, breathworkMinutes },
      milestone,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

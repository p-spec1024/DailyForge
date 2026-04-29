import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { setPromptState } from '../services/swapCounter.js';

const router = Router();
router.use(authenticate);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

// Allowed muscle group filters — matched against target_muscles TEXT column (comma-separated)
const MUSCLE_GROUPS = new Set([
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'legs', 'quads', 'hamstrings', 'glutes', 'calves',
  'core', 'abdominals', 'abs', 'forearms', 'traps', 'lats',
]);

// GET /api/exercises/strength — browse strength exercises with optional filters
router.get('/strength', async (req, res, next) => {
  try {
    const { muscle, search, limit: rawLimit, offset: rawOffset } = req.query;

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(rawOffset, 10) || 0, 0);

    const conditions = ["e.type = 'strength'"];
    const params = [];
    let paramIdx = 0;

    // Muscle group filter (case-insensitive substring match on target_muscles)
    if (muscle && typeof muscle === 'string') {
      const clean = muscle.toLowerCase().trim();
      if (MUSCLE_GROUPS.has(clean)) {
        paramIdx++;
        conditions.push(`LOWER(e.target_muscles) LIKE $${paramIdx}`);
        params.push(`%${clean}%`);
      }
    }

    // Search filter (name substring, case-insensitive)
    // Normalize hyphens to spaces so "pull up" matches "Pull-ups" and vice versa
    let searchEscaped = null;
    if (search && typeof search === 'string' && search.trim().length > 0) {
      paramIdx++;
      searchEscaped = search.toLowerCase().trim().replace(/[%_\\]/g, '\\$&');
      const searchNorm = searchEscaped.replace(/-/g, ' ');
      conditions.push(`REPLACE(LOWER(e.name), '-', ' ') LIKE $${paramIdx} ESCAPE '\\'`);
      params.push(`%${searchNorm}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM exercises e ${where}`,
      params
    );
    const total = countResult.rows[0].total;

    // Fetch page
    // When searching, rank by relevance: exact > starts-with > word-boundary > contains
    let orderBy = 'ORDER BY e.name ASC';
    if (searchEscaped) {
      paramIdx++;
      const rankParam = paramIdx;
      const searchNorm = searchEscaped.replace(/-/g, ' ');
      params.push(searchNorm);
      // Compare against normalized name (hyphens → spaces) for consistent matching
      orderBy = `ORDER BY
        CASE
          WHEN REPLACE(LOWER(e.name), '-', ' ') = $${rankParam} THEN 0
          WHEN REPLACE(LOWER(e.name), '-', ' ') LIKE $${rankParam} || '%' ESCAPE '\\' THEN 1
          WHEN REPLACE(LOWER(e.name), '-', ' ') LIKE '% ' || $${rankParam} || '%' ESCAPE '\\' THEN 2
          WHEN REPLACE(LOWER(e.name), '-', ' ') LIKE '%(' || $${rankParam} || '%' ESCAPE '\\' THEN 2
          ELSE 3
        END, e.name ASC`;
    }

    paramIdx++;
    const limitParam = paramIdx;
    paramIdx++;
    const offsetParam = paramIdx;

    const result = await pool.query(
      `SELECT e.id, e.name, e.target_muscles, e.description,
              e.difficulty, e.default_sets, e.default_reps, e.tracking_type
       FROM exercises e
       ${where}
       ${orderBy}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, limit, offset]
    );

    res.json({
      exercises: result.rows,
      total,
      hasMore: offset + result.rows.length < total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/exercises/muscle-groups — distinct muscle groups for filter chips
router.get('/muscle-groups', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT LOWER(TRIM(unnest(string_to_array(target_muscles, ',')))) AS muscle
       FROM exercises
       WHERE type = 'strength' AND target_muscles IS NOT NULL
       ORDER BY muscle`
    );
    const groups = result.rows.map(r => r.muscle).filter(Boolean);
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

// GET /api/exercises/:id — single exercise detail
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await pool.query(
      `SELECT id, name, target_muscles, description, difficulty,
              default_sets, default_reps, default_duration_secs,
              tracking_type, url, media_url, thumbnail_url
       FROM exercises WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Strict id parse: rejects "1abc" (parseInt would accept), 0, negatives.
function parseExerciseId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// S12-T6: POST /api/exercises/:id/exclude — exclude an exercise from suggestions.
// Idempotent (Decision 6). Single transaction wraps the exists-check + both
// writes (user_excluded_exercises + exercise_swap_counts.prompt_state='excluded')
// to close the TOCTOU window between exists-check and the writes.
// user_excluded_exercises uses pillar-aware shape (content_type='strength',
// content_id=:id) per S11-T1.
// Response: {excluded: true, already: bool, exercise_id: int} per spec.
router.post('/:id/exclude', async (req, res, next) => {
  try {
    const id = parseExerciseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const exists = await client.query(`SELECT 1 FROM exercises WHERE id = $1`, [id]);
      if (exists.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Exercise not found' });
      }

      // Captured row count tells us already=false vs already=true (spec line 178).
      const prior = await client.query(
        `SELECT 1 FROM user_excluded_exercises
          WHERE user_id = $1 AND content_type = 'strength' AND content_id = $2`,
        [req.user.id, id]
      );
      const already = prior.rows.length > 0;

      await client.query(
        `INSERT INTO user_excluded_exercises (user_id, content_type, content_id)
         VALUES ($1, 'strength', $2)
         ON CONFLICT (user_id, content_type, content_id) DO NOTHING`,
        [req.user.id, id]
      );

      await setPromptState(req.user.id, id, 'excluded', client);

      await client.query('COMMIT');
      res.json({ excluded: true, already, exercise_id: id });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// S12-T6: POST /api/exercises/:id/keep-suggesting — keep this exercise in rotation.
// Idempotent. Guarded so it cannot downgrade an 'excluded' row (terminal state).
// If currently 'excluded', the WHERE blocks the update — response is still
// 200 with {kept: true, already: true} per spec criterion 14 (the call is
// acknowledged even though state cannot change).
// Response: {kept: true, already: bool, exercise_id: int} per spec.
router.post('/:id/keep-suggesting', async (req, res, next) => {
  try {
    const id = parseExerciseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const exists = await client.query(`SELECT 1 FROM exercises WHERE id = $1`, [id]);
      if (exists.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Exercise not found' });
      }

      // Intentional UPSERT — row creation for users who have never swapped this
      // exercise is by design, not a phantom row. /review flagged as C2; deferred
      // per S12-T6 spec criterion #13 + Decision 7 (applied symmetrically here):
      // /keep-suggesting must be callable from non-swap surfaces (e.g. a future
      // Settings UI affordance). The row is a record of user intent.
      const result = await setPromptState(req.user.id, id, 'prompted_keep', client);
      // already = "row already in target/terminal state" — covers both the
      // idempotent prompted_keep case and the blocked-by-excluded case.
      const already = !result.was_inserted;

      await client.query('COMMIT');
      res.json({ kept: true, already, exercise_id: id });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;

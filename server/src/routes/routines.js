import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const MAX_EXERCISES = 50;

function validateExerciseIds(exercises) {
  for (let i = 0; i < exercises.length; i++) {
    const exId = parseInt(exercises[i].exercise_id, 10);
    if (!Number.isFinite(exId) || exId < 1) {
      return `Invalid exercise_id at position ${i}`;
    }
  }
  return null;
}

const router = Router();
router.use(authenticate);

// POST /api/routines — Save new routine
router.post('/', async (req, res, next) => {
  try {
    const { name, description, exercises } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'At least one exercise is required' });
    }
    if (exercises.length > MAX_EXERCISES) {
      return res.status(400).json({ error: 'Routine cannot have more than 50 exercises' });
    }
    const idError = validateExerciseIds(exercises);
    if (idError) {
      return res.status(400).json({ error: idError });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const routineResult = await client.query(
        `INSERT INTO user_routines (user_id, name, description)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.user.id, name.trim(), description?.trim() || null]
      );
      const routine = routineResult.rows[0];

      const values = [];
      const params = [];
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const off = i * 5;
        values.push(`($${off+1}, $${off+2}, $${off+3}, $${off+4}, $${off+5})`);
        params.push(routine.id, ex.exercise_id, i, ex.target_sets || 3, ex.notes || null);
      }
      const { rows: exerciseRows } = await client.query(
        `INSERT INTO user_routine_exercises (routine_id, exercise_id, position, target_sets, notes)
         VALUES ${values.join(', ')} RETURNING *`,
        params
      );

      await client.query('COMMIT');
      res.status(201).json({ ...routine, exercises: exerciseRows });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/routines — List user's routines
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.description, r.created_at, r.updated_at,
              COUNT(re.id)::int AS exercise_count,
              (SELECT MAX(s.started_at) FROM sessions s
               WHERE s.routine_id = r.id AND s.user_id = $1) AS last_used
       FROM user_routines r
       LEFT JOIN user_routine_exercises re ON re.routine_id = r.id
       WHERE r.user_id = $1
       GROUP BY r.id
       ORDER BY r.updated_at DESC`,
      [req.user.id]
    );
    res.json({ routines: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/routines/:id — Get routine with full exercise details
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const routineResult = await pool.query(
      'SELECT * FROM user_routines WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (routineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Routine not found' });
    }
    const routine = routineResult.rows[0];

    const exercisesResult = await pool.query(
      `SELECT re.id, re.exercise_id, re.position, re.target_sets, re.notes,
              e.name, e.target_muscles, e.type, e.default_sets, e.default_reps,
              e.default_duration_secs, e.tracking_type, e.media_url, e.thumbnail_url
       FROM user_routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id
       WHERE re.routine_id = $1
       ORDER BY re.position`,
      [id]
    );

    res.json({ ...routine, exercises: exercisesResult.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/routines/:id — Update routine
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const { name, description, exercises } = req.body;

    // Validate inputs before touching the DB
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name must be a non-empty string' });
      }
    }
    if (exercises !== undefined && Array.isArray(exercises)) {
      if (exercises.length > MAX_EXERCISES) {
        return res.status(400).json({ error: 'Routine cannot have more than 50 exercises' });
      }
      if (exercises.length > 0) {
        const idError = validateExerciseIds(exercises);
        if (idError) {
          return res.status(400).json({ error: idError });
        }
      }
    }

    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM user_routines WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update routine metadata
      const updateFields = [];
      const updateValues = [];
      let paramIdx = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIdx++}`);
        updateValues.push(name.trim());
      }
      if (description !== undefined) {
        updateFields.push(`description = $${paramIdx++}`);
        updateValues.push(typeof description === 'string' ? description.trim() || null : null);
      }
      updateFields.push(`updated_at = NOW()`);

      const routineResult = await client.query(
        `UPDATE user_routines SET ${updateFields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        [...updateValues, id]
      );

      // Replace exercises if provided
      let exerciseRows = [];
      if (exercises && Array.isArray(exercises)) {
        await client.query('DELETE FROM user_routine_exercises WHERE routine_id = $1', [id]);
        if (exercises.length > 0) {
          const values = [];
          const params = [];
          for (let i = 0; i < exercises.length; i++) {
            const ex = exercises[i];
            const off = i * 5;
            values.push(`($${off+1}, $${off+2}, $${off+3}, $${off+4}, $${off+5})`);
            params.push(id, ex.exercise_id, i, ex.target_sets || 3, ex.notes || null);
          }
          const { rows } = await client.query(
            `INSERT INTO user_routine_exercises (routine_id, exercise_id, position, target_sets, notes)
             VALUES ${values.join(', ')} RETURNING *`,
            params
          );
          exerciseRows = rows;
        }
      }

      await client.query('COMMIT');

      // If exercises weren't replaced, fetch existing ones for the response
      if (!exercises || !Array.isArray(exercises)) {
        const current = await pool.query(
          `SELECT re.id, re.exercise_id, re.position, re.target_sets, re.notes,
                  e.name, e.target_muscles, e.type
           FROM user_routine_exercises re
           JOIN exercises e ON e.id = re.exercise_id
           WHERE re.routine_id = $1
           ORDER BY re.position`,
          [id]
        );
        exerciseRows = current.rows;
      }

      res.json({ ...routineResult.rows[0], exercises: exerciseRows });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/routines/:id — Delete routine
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await pool.query(
      'DELETE FROM user_routines WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Routine not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

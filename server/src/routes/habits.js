import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { seedDefaultHabits } from '../db/seeds/default-habits.js';

const router = Router();
router.use(authenticate);

// POST /api/habits/seed-defaults — seed default habits if user has none
router.post('/seed-defaults', async (req, res, next) => {
  try {
    const result = await seedDefaultHabits(pool, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/habits/streaks — current + best streaks per habit
router.get('/streaks', async (req, res, next) => {
  try {
    const result = await pool.query(
      `WITH dated AS (
         SELECT he.habit_id, he.entry_date, he.value,
                he.entry_date - (ROW_NUMBER() OVER (PARTITION BY he.habit_id ORDER BY he.entry_date))::int AS grp
         FROM habit_entries he
         JOIN habits h ON h.id = he.habit_id
         WHERE he.value > 0 AND h.user_id = $1 AND h.active = true
       ),
       grouped AS (
         SELECT habit_id, grp, COUNT(*) AS streak_len,
                MAX(entry_date) AS last_date
         FROM dated
         GROUP BY habit_id, grp
       )
       SELECT
         h.id AS habit_id,
         COALESCE(MAX(CASE WHEN g.last_date >= CURRENT_DATE - INTERVAL '1 day' THEN g.streak_len END), 0) AS current_streak,
         COALESCE(MAX(g.streak_len), 0) AS best_streak
       FROM habits h
       LEFT JOIN grouped g ON g.habit_id = h.id
       WHERE h.user_id = $1 AND h.active = true
       GROUP BY h.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/habits — list user's active habits
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT h.*,
              COALESCE((SELECT he.value FROM habit_entries he
               WHERE he.habit_id = h.id AND he.entry_date = CURRENT_DATE), 0) AS today_value
       FROM habits h
       WHERE h.user_id = $1 AND h.active = true
       ORDER BY h.category, h.sort_order, h.created_at`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/habits — create a new habit
router.post('/', async (req, res, next) => {
  try {
    const { name, type = 'boolean', unit, target_value, category = 'personal', sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `INSERT INTO habits (user_id, name, type, unit, target_value, category, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, name, type, unit || null, target_value || null, category, sort_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/habits/:id — update a habit
router.put('/:id', async (req, res, next) => {
  try {
    const { name, category, type, unit, target_value, sort_order } = req.body;
    const result = await pool.query(
      `UPDATE habits SET
         name = COALESCE($3, name),
         category = COALESCE($4, category),
         type = COALESCE($5, type),
         unit = COALESCE($6, unit),
         target_value = COALESCE($7, target_value),
         sort_order = COALESCE($8, sort_order)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id, name, category, type, unit, target_value, sort_order]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/habits/:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE habits SET active = false WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/habits/:id/check — log or update today's habit entry
router.post('/:id/check', async (req, res, next) => {
  try {
    const { value } = req.body;
    const habitId = req.params.id;

    const habit = await pool.query(
      'SELECT id, type FROM habits WHERE id = $1 AND user_id = $2 AND active = true',
      [habitId, req.user.id]
    );
    if (habit.rows.length === 0) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const entryValue = habit.rows[0].type === 'boolean' ? (value ? 1 : 0) : Number(value);

    const result = await pool.query(
      `INSERT INTO habit_entries (habit_id, entry_date, value)
       VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (habit_id, entry_date)
       DO UPDATE SET value = $2
       RETURNING *`,
      [habitId, entryValue]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/habits/reorder — batch update sort_order
router.post('/reorder', async (req, res, next) => {
  try {
    const { habits } = req.body;
    if (!Array.isArray(habits)) return res.status(400).json({ error: 'habits array required' });

    for (const { id, sort_order } of habits) {
      await pool.query(
        'UPDATE habits SET sort_order = $3 WHERE id = $1 AND user_id = $2',
        [id, req.user.id, sort_order]
      );
    }

    res.json({ updated: habits.length });
  } catch (err) {
    next(err);
  }
});

export default router;

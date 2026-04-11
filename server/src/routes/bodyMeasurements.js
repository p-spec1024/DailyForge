import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const MEASUREMENT_FIELDS = [
  'weight_kg',
  'body_fat_percent',
  'waist_cm',
  'hips_cm',
  'chest_cm',
  'bicep_left_cm',
  'bicep_right_cm',
];

function sanitizeNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Clamp ranges so a typo can't poison the trend chart forever.
const FIELD_RANGES = {
  weight_kg: [20, 500],
  body_fat_percent: [1, 75],
  waist_cm: [30, 250],
  hips_cm: [30, 250],
  chest_cm: [30, 250],
  bicep_left_cm: [10, 100],
  bicep_right_cm: [10, 100],
};

function sanitizeField(field, v) {
  const n = sanitizeNumber(v);
  if (n == null) return null;
  const [min, max] = FIELD_RANGES[field] || [-Infinity, Infinity];
  if (n < min || n > max) return null;
  return n;
}

// Date-only strings ("2026-04-12") parse as UTC midnight, which is in the future
// for users west of UTC and yields negative "days since" values. Anchor to local noon.
function parseMeasuredAt(input) {
  if (!input) return new Date();
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T12:00:00`);
  }
  return new Date(input);
}

// GET /api/body-measurements — paginated list, newest first
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const result = await pool.query(
      `SELECT id, measured_at, weight_kg, body_fat_percent,
              waist_cm, hips_cm, chest_cm, bicep_left_cm, bicep_right_cm, notes
       FROM body_measurements
       WHERE user_id = $1
       ORDER BY measured_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/body-measurements/latest
router.get('/latest', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, measured_at, weight_kg, body_fat_percent,
              waist_cm, hips_cm, chest_cm, bicep_left_cm, bicep_right_cm, notes
       FROM body_measurements
       WHERE user_id = $1
       ORDER BY measured_at DESC
       LIMIT 1`,
      [req.user.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
});

// GET /api/body-measurements/stats — aggregated stats for summary card
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const userRes = await pool.query(
      'SELECT height_cm, unit_system FROM users WHERE id = $1',
      [userId]
    );
    const heightCm = userRes.rows[0]?.height_cm ? Number(userRes.rows[0].height_cm) : null;

    const allRes = await pool.query(
      `SELECT id, measured_at, weight_kg, body_fat_percent,
              waist_cm, hips_cm, chest_cm, bicep_left_cm, bicep_right_cm
       FROM body_measurements
       WHERE user_id = $1
       ORDER BY measured_at DESC`,
      [userId]
    );
    const rows = allRes.rows;

    if (rows.length === 0) {
      return res.json({
        latest: null,
        bmi: null,
        bmi_category: null,
        rolling_avg_7d: null,
        weight_delta_week: null,
        weight_delta_total: null,
        circumference_deltas: {},
        first_entry_date: null,
        entry_count: 0,
        days_since_last_entry: null,
      });
    }

    const latest = rows[0];
    const first = rows[rows.length - 1];

    // 7-day rolling avg of weight (most recent 7 entries that have weight)
    const weightedRecent = rows.filter((r) => r.weight_kg != null).slice(0, 7);
    const rollingAvg7d = weightedRecent.length
      ? weightedRecent.reduce((acc, r) => acc + Number(r.weight_kg), 0) / weightedRecent.length
      : null;

    // Find entry closest to 7 days ago for delta_week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const entryWeekAgo =
      rows.find((r) => new Date(r.measured_at) <= weekAgo) || rows[rows.length - 1];

    const weightDeltaWeek =
      latest.weight_kg != null && entryWeekAgo?.weight_kg != null
        ? Number(latest.weight_kg) - Number(entryWeekAgo.weight_kg)
        : null;
    const weightDeltaTotal =
      latest.weight_kg != null && first?.weight_kg != null
        ? Number(latest.weight_kg) - Number(first.weight_kg)
        : null;

    // BMI from rolling avg if available, otherwise latest weight
    const bmiWeight = rollingAvg7d ?? (latest.weight_kg != null ? Number(latest.weight_kg) : null);
    let bmi = null;
    let bmiCategory = null;
    if (bmiWeight && heightCm) {
      const m = heightCm / 100;
      bmi = bmiWeight / (m * m);
      if (bmi < 18.5) bmiCategory = 'Underweight';
      else if (bmi < 25) bmiCategory = 'Normal';
      else if (bmi < 30) bmiCategory = 'Overweight';
      else bmiCategory = 'Obese';
    }

    // Circumference deltas
    const circumferenceDeltas = {};
    const circFields = ['waist_cm', 'hips_cm', 'chest_cm', 'bicep_left_cm', 'bicep_right_cm'];
    for (const f of circFields) {
      const latestVal = latest[f] != null ? Number(latest[f]) : null;
      const firstWith = rows
        .slice()
        .reverse()
        .find((r) => r[f] != null);
      const weekAgoWith =
        rows.find((r) => new Date(r.measured_at) <= weekAgo && r[f] != null) || firstWith;
      circumferenceDeltas[f] = {
        week:
          latestVal != null && weekAgoWith?.[f] != null
            ? Number((latestVal - Number(weekAgoWith[f])).toFixed(2))
            : null,
        total:
          latestVal != null && firstWith?.[f] != null
            ? Number((latestVal - Number(firstWith[f])).toFixed(2))
            : null,
      };
    }

    const daysSinceLast = Math.floor(
      (Date.now() - new Date(latest.measured_at).getTime()) / (24 * 60 * 60 * 1000)
    );

    res.json({
      latest,
      bmi: bmi != null ? Number(bmi.toFixed(1)) : null,
      bmi_category: bmiCategory,
      rolling_avg_7d: rollingAvg7d != null ? Number(rollingAvg7d.toFixed(2)) : null,
      weight_delta_week: weightDeltaWeek != null ? Number(weightDeltaWeek.toFixed(2)) : null,
      weight_delta_total: weightDeltaTotal != null ? Number(weightDeltaTotal.toFixed(2)) : null,
      circumference_deltas: circumferenceDeltas,
      first_entry_date: first.measured_at,
      entry_count: rows.length,
      days_since_last_entry: daysSinceLast,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/body-measurements
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const measuredAt = parseMeasuredAt(body.measured_at);
    if (Number.isNaN(measuredAt.getTime())) {
      return res.status(400).json({ error: 'Invalid measured_at' });
    }

    const values = MEASUREMENT_FIELDS.map((f) => sanitizeField(f, body[f]));
    if (values.every((v) => v == null)) {
      return res.status(400).json({ error: 'At least one measurement is required' });
    }

    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;

    const result = await pool.query(
      `INSERT INTO body_measurements
        (user_id, measured_at, weight_kg, body_fat_percent,
         waist_cm, hips_cm, chest_cm, bicep_left_cm, bicep_right_cm, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.user.id, measuredAt, ...values, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/body-measurements/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const body = req.body || {};
    const values = MEASUREMENT_FIELDS.map((f) => sanitizeField(f, body[f]));
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;
    const measuredAt = body.measured_at ? parseMeasuredAt(body.measured_at) : null;
    if (measuredAt && Number.isNaN(measuredAt.getTime())) {
      return res.status(400).json({ error: 'Invalid measured_at' });
    }

    const result = await pool.query(
      `UPDATE body_measurements
       SET weight_kg = $1,
           body_fat_percent = $2,
           waist_cm = $3,
           hips_cm = $4,
           chest_cm = $5,
           bicep_left_cm = $6,
           bicep_right_cm = $7,
           notes = $8,
           measured_at = COALESCE($9, measured_at)
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [...values, notes, measuredAt, id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/body-measurements/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await pool.query(
      'DELETE FROM body_measurements WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

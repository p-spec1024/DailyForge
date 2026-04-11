import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getExerciseHistory,
  getChartData,
  calculateProgressCache,
} from '../services/progressService.js';

const router = Router();
router.use(authenticate);

function parseIntParam(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// GET /api/progress/exercises — all exercises user has logged, grouped by type
router.get('/exercises', async (req, res, next) => {
  try {
    const history = await getExerciseHistory(req.user.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// GET /api/progress/exercise/:id?range=30d|90d|all&type=strength|yoga|breathwork
router.get('/exercise/:id', async (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid exercise id' });

    const range = ['30d', '90d', 'all'].includes(req.query.range) ? req.query.range : '30d';
    const type = req.query.type; // optional hint; breathwork ids live in a separate table
    const data = await getChartData(req.user.id, id, range, type);
    if (!data) return res.status(404).json({ error: 'Exercise not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/progress/recalculate/:exercise_id — force cache recalc
router.post('/recalculate/:exercise_id', async (req, res, next) => {
  try {
    const id = parseIntParam(req.params.exercise_id);
    if (!id) return res.status(400).json({ error: 'Invalid exercise id' });
    const type = req.body?.type;
    await calculateProgressCache(req.user.id, id, type);
    res.json({ recalculated: true });
  } catch (err) {
    next(err);
  }
});

export default router;

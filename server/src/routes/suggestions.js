import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getUserUnitSystem } from '../services/users.js';
import {
  getStrengthSuggestion,
  getYogaSuggestionsBatch,
  getBreathworkSuggestionsBatch,
} from '../services/suggestions.js';

const router = Router();
router.use(authenticate);

const MAX_BATCH_IDS = 50;

function parseId(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

function parseIdList(query) {
  if (!query) return [];
  return String(query)
    .split(',')
    .map(s => parseId(s))
    .filter(id => id !== null);
}

// GET /api/suggestions/strength/:exerciseId
router.get('/strength/:exerciseId', async (req, res, next) => {
  try {
    const exerciseId = parseId(req.params.exerciseId);
    if (!exerciseId) return res.status(400).json({ error: 'Invalid exerciseId' });

    const unit = await getUserUnitSystem(req.user.id);
    const result = await getStrengthSuggestion(req.user.id, exerciseId, unit);
    if (!result) return res.status(404).json({ error: 'Exercise not found' });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/suggestions/yoga?exerciseIds=1,2,3 — batch
router.get('/yoga', async (req, res, next) => {
  try {
    const ids = parseIdList(req.query.exerciseIds);
    if (ids.length === 0) return res.json({ suggestions: {} });
    if (ids.length > MAX_BATCH_IDS) {
      return res.status(400).json({ error: `Maximum ${MAX_BATCH_IDS} exercise IDs allowed` });
    }
    const suggestions = await getYogaSuggestionsBatch(req.user.id, ids);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

// GET /api/suggestions/yoga/:exerciseId — single (compatibility)
router.get('/yoga/:exerciseId', async (req, res, next) => {
  try {
    const exerciseId = parseId(req.params.exerciseId);
    if (!exerciseId) return res.status(400).json({ error: 'Invalid exerciseId' });
    const batch = await getYogaSuggestionsBatch(req.user.id, [exerciseId]);
    const result = batch[exerciseId];
    if (!result) return res.status(404).json({ error: 'Exercise not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/suggestions/breathwork?techniqueIds=1,2,3 — batch
router.get('/breathwork', async (req, res, next) => {
  try {
    const ids = parseIdList(req.query.techniqueIds);
    if (ids.length === 0) return res.json({ suggestions: {} });
    if (ids.length > MAX_BATCH_IDS) {
      return res.status(400).json({ error: `Maximum ${MAX_BATCH_IDS} technique IDs allowed` });
    }
    const suggestions = await getBreathworkSuggestionsBatch(req.user.id, ids);
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

// GET /api/suggestions/breathwork/:techniqueId — single (compatibility)
router.get('/breathwork/:techniqueId', async (req, res, next) => {
  try {
    const techniqueId = parseId(req.params.techniqueId);
    if (!techniqueId) return res.status(400).json({ error: 'Invalid techniqueId' });
    const batch = await getBreathworkSuggestionsBatch(req.user.id, [techniqueId]);
    res.json(batch[techniqueId] || { suggestedCycles: 4, reason: 'default' });
  } catch (err) {
    next(err);
  }
});

export default router;

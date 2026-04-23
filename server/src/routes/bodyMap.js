// 3D body-map endpoints (S10-T5b). The Flutter client (lib/screens/home_3d_*)
// consumes these to power the heatmap, flexibility ring, and Recent Wins
// list on the new home page.
//
// Contract — must deserialize cleanly into the Dart types defined in
// lib/data/mock_body_map_data.dart:
//
//   GET /api/body-map/muscle-volumes?range=7d|30d|90d|year
//     → Map<String, int> with the 11 strength groups. All keys present
//       (untrained groups → 0). Values are integers 0–100.
//
//   GET /api/body-map/flexibility?range=7d|30d|90d|year
//     → Map<String, int> with keys Spine, Hips, Shoulders. All keys
//       present. Values are integers 0–100.
//
//   GET /api/body-map/recent-wins?limit=N (default 5, max 10)
//     → Array of { icon: string, title: string, subtitle: string }.
//       All values are strings (mock is List<Map<String, String>>).
//       NO `type` or `achieved_at` fields — mock doesn't include them.
//
// Design doc: docs/sprints/S10-T5-DESIGN.md

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getMuscleVolumes,
  getFlexibility,
  getRecentWins,
  parseRange,
} from '../services/bodyMapService.js';

const router = Router();
router.use(authenticate);

router.get('/muscle-volumes', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const range = parseRange(req.query.range);
    const volumes = await getMuscleVolumes(userId, range);
    res.json(volumes);
  } catch (err) {
    console.error('[body-map/muscle-volumes]', err);
    next(err);
  }
});

router.get('/flexibility', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const range = parseRange(req.query.range);
    const scores = await getFlexibility(userId, range);
    res.json(scores);
  } catch (err) {
    console.error('[body-map/flexibility]', err);
    next(err);
  }
});

router.get('/recent-wins', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const wins = await getRecentWins(userId, req.query.limit);
    res.json(wins);
  } catch (err) {
    console.error('[body-map/recent-wins]', err);
    next(err);
  }
});

export default router;

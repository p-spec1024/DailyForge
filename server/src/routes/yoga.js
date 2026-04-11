import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';
import { recalculateForSession } from '../services/progressService.js';

const router = Router();

const VALID_TYPES = ['vinyasa', 'hatha', 'yin', 'restorative', 'sun_salutation'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

// Fallback hold time ranges per practice type (seconds)
// Used when a pose has no hold_times_json entry
const HOLD_RANGES = {
  vinyasa: [20, 45],
  hatha: [45, 90],
  yin: [120, 300],
  restorative: [180, 300],
  sun_salutation: [20, 40],
};

// Average seconds per pose (including transitions) for deterministic count
const AVG_SECS_PER_POSE = {
  vinyasa: 120,      // ~2 min per pose
  hatha: 180,        // ~3 min per pose
  yin: 300,          // ~5 min per pose
  restorative: 300,  // ~5 min per pose
  sun_salutation: 90, // ~1.5 min per pose
};

// Difficulty mapping: level -> allowed difficulty values
// beginner  = easy poses only (no inversions/arm balances)
// intermediate = beginner + intermediate
// advanced  = intermediate + advanced (skews harder, skips easy filler)
const DIFFICULTY_MAP = {
  beginner: ['beginner'],
  intermediate: ['beginner', 'intermediate'],
  advanced: ['intermediate', 'advanced'],
};

// Poses unsafe for beginners — matched against lowercase pose name
const BEGINNER_EXCLUDE_KEYWORDS = [
  'headstand', 'handstand', 'forearm stand', 'scorpion',
  'crow', 'peacock', 'firefly', 'eight-angle',
  'arm balance', 'arm-pressing', 'inversion',
  'shoulder stand', 'shoulderstand',
];

// Phase time allocation (fraction of total)
const PHASE_ALLOC = {
  warmup: 0.15,
  peak: 0.60,
  cooldown: 0.20,
  savasana: 0.05,
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /api/yoga/generate — generate a yoga session sequence
router.get('/generate', authenticate, async (req, res, next) => {
  try {
    const rawType = req.query.type || 'vinyasa';
    const rawLevel = req.query.level || 'intermediate';
    const type = VALID_TYPES.includes(rawType) ? rawType : 'vinyasa';
    const level = VALID_LEVELS.includes(rawLevel) ? rawLevel : 'intermediate';
    const { duration = '30', focus } = req.query;
    const durationMins = parseInt(duration, 10);
    if (isNaN(durationMins) || durationMins < 5 || durationMins > 120) {
      return res.status(400).json({ error: 'Duration must be between 5 and 120 minutes' });
    }

    const totalSecs = durationMins * 60;
    const difficulties = DIFFICULTY_MAP[level] || DIFFICULTY_MAP.intermediate;
    const [holdMin, holdMax] = HOLD_RANGES[type] || HOLD_RANGES.vinyasa;
    const VALID_FOCUS = ['hips', 'hamstrings', 'back', 'shoulders', 'core', 'neck', 'chest', 'balance', 'twists', 'strength'];
    const focusAreas = focus
      ? focus.split(',').map(f => f.trim().toLowerCase()).filter(f => VALID_FOCUS.includes(f))
      : [];

    // Calculate deterministic target pose count based on duration and type
    const avgSecsPerPose = AVG_SECS_PER_POSE[type] || AVG_SECS_PER_POSE.vinyasa;
    const targetPoseCount = Math.max(2, Math.round(totalSecs / avgSecsPerPose));

    // Optional category filter (e.g., category_filter=warmup,flow)
    const { category_filter } = req.query;
    const categoryFilters = category_filter
      ? category_filter.split(',').map(c => c.trim().toLowerCase()).filter(Boolean)
      : [];

    // --- Progressive query: broaden filters until we have enough poses ---
    // Adjacent categories for broadening
    const ADJACENT_CATS = {
      warmup: ['flow', 'standing'],
      flow: ['warmup', 'standing'],
      cooldown: ['floor', 'savasana'],
      savasana: ['cooldown', 'floor'],
      standing: ['warmup', 'peak'],
      peak: ['standing', 'floor'],
      floor: ['cooldown', 'peak'],
    };

    const MIN_POSE_COUNT = 3;

    async function fetchPoses(cats, diffs, practiceType, focusFilter) {
      const p = [...diffs];
      let idx = diffs.length + 1;

      let ptClause = '';
      if (practiceType) {
        ptClause = ` AND practice_types @> ARRAY[$${idx}]::text[]`;
        p.push(practiceType);
        idx++;
      }

      let catClause = '';
      if (cats.length > 0) {
        const ph = cats.map((_, i) => `$${idx + i}`).join(',');
        catClause = ` AND category IN (${ph})`;
        p.push(...cats);
        idx += cats.length;
      }

      const diffPh = diffs.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await pool.query(
        `SELECT id, name, sanskrit_name, target_muscles, difficulty, default_duration_secs, description, category, hold_times_json
         FROM exercises
         WHERE type = 'yoga' AND difficulty IN (${diffPh})${ptClause}${catClause}
         ORDER BY name`,
        p
      );

      // Filter out unsafe poses for beginners
      let safe = level === 'beginner'
        ? rows.filter(r => !BEGINNER_EXCLUDE_KEYWORDS.some(k => r.name.toLowerCase().includes(k)))
        : rows;

      // Prioritize focus-matching poses
      if (focusFilter && focusFilter.length > 0) {
        const match = (pose) => {
          if (!pose.target_muscles) return false;
          const m = pose.target_muscles.toLowerCase();
          return focusFilter.some(f => m.includes(f));
        };
        safe = [...shuffle(safe.filter(match)), ...shuffle(safe.filter(r => !match(r)))];
      } else {
        safe = shuffle(safe);
      }
      return safe;
    }

    // Progressive broadening: try strict filters first, then broaden
    async function fetchWithBroadening(baseCats, minCount) {
      // Step 1: category + level + practice_type + focus
      let poses = await fetchPoses(baseCats, difficulties, type, focusAreas);
      if (poses.length >= minCount) return poses;

      // Step 2: drop focus area
      poses = await fetchPoses(baseCats, difficulties, type, []);
      if (poses.length >= minCount) return poses;

      // Step 3: drop difficulty restriction (use all levels)
      poses = await fetchPoses(baseCats, ['beginner', 'intermediate', 'advanced'], type, []);
      if (poses.length >= minCount) return poses;

      // Step 4: include adjacent categories
      const extra = baseCats.flatMap(c => ADJACENT_CATS[c] || []).filter(c => !baseCats.includes(c));
      if (extra.length > 0) {
        poses = await fetchPoses([...baseCats, ...extra], ['beginner', 'intermediate', 'advanced'], type, []);
        if (poses.length >= minCount) return poses;
      }

      // Step 5: drop practice_type filter entirely
      poses = await fetchPoses([...baseCats, ...extra], ['beginner', 'intermediate', 'advanced'], null, []);
      return poses;
    }

    // Fetch pools based on whether category_filter is specified
    let safePoses;
    if (categoryFilters.length > 0) {
      safePoses = await fetchWithBroadening(categoryFilters, MIN_POSE_COUNT);
    } else {
      safePoses = await fetchPoses([], difficulties, type, focusAreas);
    }

    if (safePoses.length === 0) {
      return res.status(404).json({ error: 'No yoga poses found for the selected criteria' });
    }

    // Use DB category column when available, fall back to keyword matching
    const PHASE_MAP = { warmup: 'warmup', flow: 'warmup', standing: 'peak', peak: 'peak', floor: 'cooldown', cooldown: 'cooldown', savasana: 'savasana' };
    const warmupKeywords = ['cat', 'cow', 'mountain', 'child', 'tabletop', 'sun salutation', 'easy pose', 'staff pose'];
    const cooldownKeywords = ['seated', 'reclining', 'supine', 'corpse', 'happy baby', 'twist', 'forward bend', 'pigeon', 'butterfly', 'bound angle'];
    const savasanaKeywords = ['corpse', 'savasana'];

    const categorize = (pose) => {
      if (pose.category && PHASE_MAP[pose.category]) {
        return PHASE_MAP[pose.category];
      }
      const nameLower = pose.name.toLowerCase();
      if (savasanaKeywords.some(k => nameLower.includes(k))) return 'savasana';
      if (warmupKeywords.some(k => nameLower.includes(k))) return 'warmup';
      if (cooldownKeywords.some(k => nameLower.includes(k))) return 'cooldown';
      return 'peak';
    };

    const pools = { warmup: [], peak: [], cooldown: [], savasana: [] };
    for (const pose of safePoses) {
      pools[categorize(pose)].push(pose);
    }
    // Ensure shuffled
    for (const key of Object.keys(pools)) pools[key] = shuffle(pools[key]);

    // --- Pose count allocation ---
    // For category-filtered requests (warmup/cooldown from 5-phase), target count based on duration
    const isWarmupCooldown = categoryFilters.length > 0 &&
      categoryFilters.some(c => ['warmup', 'flow', 'cooldown', 'savasana'].includes(c));

    let warmupCount, peakCount, cooldownCount, savasanaCount;

    if (isWarmupCooldown) {
      // For 5-phase warmup/cooldown: fit as many poses as duration allows
      // Use ~60s avg per pose as baseline, minimum 3 poses
      const nonSavasanaSecs = totalSecs * 0.85; // reserve 15% for savasana-like end
      const avgHold = 60; // seconds per pose
      const fitCount = Math.max(MIN_POSE_COUNT, Math.round(nonSavasanaSecs / avgHold));
      const allNonSavasana = [...pools.warmup, ...pools.peak, ...pools.cooldown];

      // For cooldown: put savasana at end; for warmup: no savasana
      const isCooldown = categoryFilters.includes('cooldown') || categoryFilters.includes('savasana');
      savasanaCount = isCooldown ? 1 : 0;
      warmupCount = 0;
      peakCount = 0;
      cooldownCount = Math.min(fitCount, allNonSavasana.length);
      // Remap: use cooldown slot for all non-savasana poses
      // Merge all into cooldown pool for buildPhase
      pools.cooldown = allNonSavasana;
    } else {
      // Standard full session allocation
      savasanaCount = 1;
      const remaining = Math.max(1, targetPoseCount - savasanaCount);
      warmupCount = remaining >= 3 ? Math.max(1, Math.round(remaining * PHASE_ALLOC.warmup)) : 0;
      cooldownCount = remaining >= 3 ? Math.max(1, Math.round(remaining * PHASE_ALLOC.cooldown)) : 0;
      peakCount = Math.max(1, remaining - warmupCount - cooldownCount);
    }

    // Build sequence by filling each phase with a fixed number of poses
    const poses = [];
    const usedIds = new Set();
    const buildPhase = (pool, maxPoses, phase) => {
      let count = 0;
      for (const pose of pool) {
        if (count >= maxPoses) break;
        if (usedIds.has(pose.id)) continue;
        let hold;
        if (phase === 'savasana') {
          hold = Math.round(totalSecs * PHASE_ALLOC.savasana);
        } else if (pose.hold_times_json && pose.hold_times_json[type]) {
          hold = pose.hold_times_json[type];
        } else {
          hold = Math.round((holdMin + holdMax) / 2);
        }
        usedIds.add(pose.id);
        poses.push({
          id: pose.id,
          name: pose.name,
          sanskrit_name: pose.sanskrit_name,
          target_muscles: pose.target_muscles || '',
          difficulty: pose.difficulty || 'intermediate',
          description: pose.description || '',
          hold_seconds: hold,
          phase,
        });
        count++;
      }
    };

    if (isWarmupCooldown) {
      buildPhase(pools.cooldown, cooldownCount, categoryFilters.includes('cooldown') ? 'cooldown' : 'warmup');
      if (savasanaCount > 0 && pools.savasana.length > 0) {
        buildPhase(pools.savasana, savasanaCount, 'savasana');
      }
    } else {
      buildPhase(pools.warmup.length > 0 ? pools.warmup : pools.peak, warmupCount, 'warmup');
      buildPhase(pools.peak, peakCount, 'peak');
      buildPhase(pools.cooldown.length > 0 ? pools.cooldown : pools.peak, cooldownCount, 'cooldown');
      if (pools.savasana.length > 0) {
        buildPhase(pools.savasana, savasanaCount, 'savasana');
      } else {
        poses.push({
          id: null,
          name: 'Corpse Pose',
          sanskrit_name: 'Savasana',
          target_muscles: 'full body',
          difficulty: 'beginner',
          description: '',
          hold_seconds: Math.round(totalSecs * PHASE_ALLOC.savasana),
          phase: 'savasana',
        });
      }
    }

    // Distribute hold times evenly across the duration if we have poses
    if (isWarmupCooldown && poses.length > 1) {
      const savasanaPose = poses.find(p => p.phase === 'savasana');
      const nonSavasana = poses.filter(p => p.phase !== 'savasana');
      const savasanaTime = savasanaPose ? Math.round(totalSecs * 0.15) : 0;
      const perPoseTime = Math.round((totalSecs - savasanaTime) / nonSavasana.length);
      for (const p of nonSavasana) {
        // Use DB hold time if available and reasonable, otherwise distribute evenly
        const dbHold = p.hold_seconds;
        p.hold_seconds = (dbHold && dbHold >= 15 && dbHold <= perPoseTime * 1.5) ? dbHold : perPoseTime;
      }
      if (savasanaPose) savasanaPose.hold_seconds = savasanaTime;
    }

    res.json({
      session: {
        id: crypto.randomUUID(),
        type,
        level,
        duration: durationMins,
        focus: focusAreas,
        poses,
        total_poses: poses.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/yoga/recent — last 3 yoga sessions for current user
router.get('/recent', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, duration, started_at, completed_at, notes
       FROM sessions
       WHERE user_id = $1 AND type = 'yoga' AND completed = true
       ORDER BY completed_at DESC
       LIMIT 3`,
      [req.user.id]
    );

    // Parse notes field which stores config as JSON
    const sessions = rows.map(r => {
      let config = {};
      try { config = r.notes ? JSON.parse(r.notes) : {}; } catch { /* ignore */ }
      return {
        id: r.id,
        type: config.practice_type || 'vinyasa',
        level: config.level || 'intermediate',
        duration: Math.round((r.duration || 0) / 60),
        focus: config.focus || [],
        date: r.completed_at || r.started_at,
      };
    });

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// POST /api/yoga/session — log a completed yoga session
router.post('/session', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { type, level, duration, focus, poses } = req.body;
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur < 5 || dur > 120) {
      client.release();
      return res.status(400).json({ error: 'Duration must be between 5 and 120 minutes' });
    }
    const validType = VALID_TYPES.includes(type) ? type : 'vinyasa';
    const validLevel = VALID_LEVELS.includes(level) ? level : 'intermediate';
    const durationSecs = dur * 60;

    const config = JSON.stringify({ practice_type: validType, level: validLevel, focus: focus || [] });

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO sessions (user_id, workout_id, type, date, started_at, completed_at, completed, duration, notes)
       VALUES ($1, NULL, 'yoga', CURRENT_DATE, NOW() - INTERVAL '1 second' * $2, NOW(), true, $2, $3)
       RETURNING id`,
      [req.user.id, durationSecs, config]
    );

    const sessionId = rows[0].id;

    // Log individual poses
    if (poses && poses.length > 0) {
      const values = [];
      const params = [sessionId];
      let paramIdx = 2;
      for (let i = 0; i < poses.length; i++) {
        const p = poses[i];
        const poseId = Number(p.id);
        if (!poseId || !Number.isInteger(poseId) || poseId <= 0) continue;
        const holdSecs = Math.max(0, Math.min(600, Number(p.hold_seconds) || 0));
        values.push(`($1, $${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, true)`);
        params.push(poseId, i, holdSecs);
        paramIdx += 3;
      }
      if (values.length > 0) {
        await client.query(
          `INSERT INTO session_exercises (session_id, exercise_id, sort_order, duration_secs, completed)
           VALUES ${values.join(', ')}`,
          params
        );
      }
    }

    await client.query('COMMIT');
    // Fire-and-forget progression cache recalc for logged poses
    recalculateForSession(sessionId).catch(() => {});
    res.status(201).json({ id: sessionId, logged: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

export default router;

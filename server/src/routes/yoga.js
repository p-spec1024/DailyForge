import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

const VALID_TYPES = ['vinyasa', 'hatha', 'yin', 'restorative', 'sun_salutation'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

// Hold time ranges per practice type (seconds)
// Includes both-sides time for bilateral poses
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

    // Fetch yoga poses matching difficulty
    const placeholders = difficulties.map((_, i) => `$${i + 1}`).join(',');
    const { rows: allPoses } = await pool.query(
      `SELECT id, name, sanskrit_name, target_muscles, difficulty, default_duration_secs, description
       FROM exercises
       WHERE type = 'yoga' AND difficulty IN (${placeholders})
       ORDER BY name`,
      difficulties
    );

    // Filter out unsafe poses for beginners (inversions, arm balances)
    const safePoses = level === 'beginner'
      ? allPoses.filter(p => {
          const nameLower = p.name.toLowerCase();
          return !BEGINNER_EXCLUDE_KEYWORDS.some(k => nameLower.includes(k));
        })
      : allPoses;

    if (safePoses.length === 0) {
      return res.status(404).json({ error: 'No yoga poses found for the selected criteria' });
    }

    // Separate poses by likely phase based on name/muscles
    const warmupKeywords = ['cat', 'cow', 'mountain', 'child', 'tabletop', 'sun salutation', 'easy pose', 'staff pose'];
    const cooldownKeywords = ['seated', 'reclining', 'supine', 'corpse', 'happy baby', 'twist', 'forward bend', 'pigeon', 'butterfly', 'bound angle'];
    const savasanaKeywords = ['corpse', 'savasana'];

    const categorize = (pose) => {
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

    // Prioritize focus areas in peak poses — focus-matching first, then backfill
    if (focusAreas.length > 0) {
      const focusMatch = (pose) => {
        if (!pose.target_muscles) return false;
        const muscles = pose.target_muscles.toLowerCase();
        return focusAreas.some(f => muscles.includes(f));
      };
      const matched = shuffle(pools.peak.filter(focusMatch));
      const rest = shuffle(pools.peak.filter(p => !focusMatch(p)));
      pools.peak = [...matched, ...rest];
    } else {
      pools.peak = shuffle(pools.peak);
    }
    pools.warmup = shuffle(pools.warmup);
    pools.cooldown = shuffle(pools.cooldown);

    // Allocate pose counts per phase (deterministic, based on targetPoseCount)
    const savasanaCount = 1;
    const remaining = Math.max(1, targetPoseCount - savasanaCount);
    // Only allocate warmup/cooldown if there's room (3+ non-savasana poses)
    const warmupCount = remaining >= 3 ? Math.max(1, Math.round(remaining * PHASE_ALLOC.warmup)) : 0;
    const cooldownCount = remaining >= 3 ? Math.max(1, Math.round(remaining * PHASE_ALLOC.cooldown)) : 0;
    const peakCount = Math.max(1, remaining - warmupCount - cooldownCount);

    // Build sequence by filling each phase with a fixed number of poses
    const poses = [];
    const buildPhase = (pool, maxPoses, timeBudget, phase) => {
      const used = new Set();
      let count = 0;
      for (const pose of pool) {
        if (count >= maxPoses) break;
        if (used.has(pose.id)) continue;
        const hold = phase === 'savasana'
          ? Math.round(timeBudget)
          : Math.round((holdMin + holdMax) / 2);
        used.add(pose.id);
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

    buildPhase(pools.warmup.length > 0 ? pools.warmup : pools.peak, warmupCount, totalSecs * PHASE_ALLOC.warmup, 'warmup');
    buildPhase(pools.peak, peakCount, totalSecs * PHASE_ALLOC.peak, 'peak');
    buildPhase(pools.cooldown.length > 0 ? pools.cooldown : pools.peak, cooldownCount, totalSecs * PHASE_ALLOC.cooldown, 'cooldown');

    // Always end with savasana
    if (pools.savasana.length > 0) {
      buildPhase(pools.savasana, savasanaCount, totalSecs * PHASE_ALLOC.savasana, 'savasana');
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
    res.status(201).json({ id: sessionId, logged: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

export default router;

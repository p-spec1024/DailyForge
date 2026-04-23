// Muscle text → DB group mapping for the body-map endpoints (S10-T5b).
//
// The 11 DB groups are the canonical names the Flutter client expects (see
// lib/data/mock_body_map_data.dart, mockMuscleVolumes):
//   Chest, Shoulders, Biceps, Triceps, Forearms, Core,
//   Back, Glutes, Quads, Hamstrings, Calves
//
// The 3 flexibility regions are: Spine, Hips, Shoulders.
//
// Source data: exercises.target_muscles is a free-form TEXT field. Strength
// values come from ExerciseDB + free-exercise-db; yoga values come from the
// DailyForge built-in library + yoga-api + yogism + huggingface.
//
// Distinct single-muscle tokens currently present in the DB (probed
// 2026-04-23 against the production Neon DB):
//
// strength (32 tokens, 236 distinct target_muscles rows):
//   abdominals, abductors, abs, adductors, back, biceps, calves, chest,
//   core, core stability, forearms, full body, glutes, grip, hamstrings,
//   hip flexors, lateral deltoids, lats, lower abs, lower back, middle
//   back, neck, obliques, posterior chain, quadriceps, quads, rear
//   deltoids, shoulders, traps, triceps, upper back, upper chest
//
// yoga (79 tokens across 269 poses; many descriptive non-muscle phrases —
// e.g. "boost your calorie burn" — are ignored):
//   adductors, ankles, arms, back, balance, biceps, calves, chest, core,
//   deep core, deep hip rotators, deep spinal extensors, deltoids,
//   diaphragm, erector spinae, external rotators, feet, fingers,
//   forearms, glutes, gracilis, hamstrings, hip external rotators,
//   hip flexors, hip rotators, hips, inner thighs, intercostals, jaw,
//   knees, lats, legs, lower back, lumbar stabilizers, lungs, neck,
//   neck stabilizers, obliques, pectorals, pelvic floor, piriformis,
//   plantar fascia, platysma, postural muscles, psoas, quads,
//   rectus abdominis, rhomboids, serratus anterior, shoulders, spine,
//   spinal extensors, spinal flexors and extensors, spinal rotators,
//   tensor fasciae latae, thighs, tibialis anterior, tongue, trapezius,
//   triceps, wrists, ...
//
// Tokens that intentionally don't map to any group: full body, neck,
// balance, breathing, jaw, tongue, fingers, plantar fascia, etc.

const STRENGTH_TOKEN_TO_GROUP = {
  // Chest
  'chest':            'Chest',
  'upper chest':      'Chest',
  'pectorals':        'Chest',

  // Shoulders
  'shoulders':        'Shoulders',
  'lateral deltoids': 'Shoulders',
  'rear deltoids':    'Shoulders',
  'deltoids':         'Shoulders',

  // Biceps
  'biceps':           'Biceps',

  // Triceps
  'triceps':          'Triceps',

  // Forearms
  'forearms':         'Forearms',
  'grip':             'Forearms',
  'wrists':           'Forearms',

  // Core
  'core':             'Core',
  'core stability':   'Core',
  'abs':              'Core',
  'abdominals':       'Core',
  'lower abs':        'Core',
  'obliques':         'Core',
  'rectus abdominis': 'Core',

  // Back (includes traps, lats, full posterior chain)
  'back':             'Back',
  'lats':             'Back',
  'upper back':       'Back',
  'middle back':      'Back',
  'lower back':       'Back',
  'posterior chain':  'Back',
  'traps':            'Back',
  'trapezius':        'Back',
  'rhomboids':        'Back',
  'erector spinae':   'Back',
  'spinal extensors': 'Back',

  // Glutes (incl. hip abductors anatomically)
  'glutes':           'Glutes',
  'abductors':        'Glutes',
  'piriformis':       'Glutes',

  // Quads (incl. hip flexors and adductors — closer to upper-leg region)
  'quads':            'Quads',
  'quadriceps':       'Quads',
  'hip flexors':      'Quads',
  'adductors':        'Quads',

  // Hamstrings
  'hamstrings':       'Hamstrings',

  // Calves
  'calves':           'Calves',
};

// Yoga region keywords — matched against tokens parsed from target_muscles.
// A pose can map to 0..N regions (sets, not lists).
const YOGA_REGION_TOKENS = {
  Spine: new Set([
    'spine',
    'spinal extensors',
    'spinal rotators',
    'spinal flexors and extensors',
    'deep spinal extensors',
    'erector spinae',
    'lower back',
    'lumbar stabilizers',
    'back',
  ]),
  Hips: new Set([
    'hips',
    'hip flexors',
    'hip rotators',
    'hip external rotators',
    'deep hip rotators',
    'external rotators',
    'piriformis',
    'glutes',
    'adductors',
    'abductors',
    'pelvic floor',
    'gracilis',
    'tensor fasciae latae',
    'inner thighs',
  ]),
  Shoulders: new Set([
    'shoulders',
    'deltoids',
    'lateral deltoids',
    'rear deltoids',
    'trapezius',
    'rhomboids',
    'chest',
    'pectorals',
    'serratus anterior',
  ]),
};

// Pose-name keyword overrides for poses whose target_muscles don't carry a
// region signal but whose names clearly do. Keys are lowercased substrings.
const YOGA_POSE_NAME_REGION_HINTS = [
  { match: 'pigeon',      regions: ['Hips'] },
  { match: 'eagle',       regions: ['Hips', 'Shoulders'] },
  { match: 'cobra',       regions: ['Spine'] },
  { match: 'cat',         regions: ['Spine'] },
  { match: 'cow',         regions: ['Spine'] },
  { match: 'fish',        regions: ['Spine', 'Shoulders'] },
  { match: 'bow',         regions: ['Spine'] },
  { match: 'wheel',       regions: ['Spine', 'Shoulders'] },
  { match: 'bridge',      regions: ['Spine', 'Hips'] },
  { match: 'camel',       regions: ['Spine'] },
  { match: 'locust',      regions: ['Spine'] },
  { match: 'twist',       regions: ['Spine'] },
  { match: 'frog',        regions: ['Hips'] },
  { match: 'lotus',       regions: ['Hips'] },
  { match: 'squat',       regions: ['Hips'] },
  { match: 'malasana',    regions: ['Hips'] },
  { match: 'lunge',       regions: ['Hips'] },
  { match: 'warrior',     regions: ['Hips'] },
  { match: 'pigeon',      regions: ['Hips'] },
  { match: 'dog',         regions: ['Shoulders'] }, // up/down dog stretch shoulders
  { match: 'plank',       regions: ['Shoulders'] },
  { match: 'dolphin',     regions: ['Shoulders'] },
  { match: 'handstand',   regions: ['Shoulders'] },
  { match: 'headstand',   regions: ['Shoulders'] },
  { match: 'forearm stand', regions: ['Shoulders'] },
  { match: 'chaturanga',  regions: ['Shoulders'] },
  { match: 'cow-faced',   regions: ['Shoulders'] },
  { match: 'cow face',    regions: ['Shoulders'] },
  { match: "child",       regions: ['Spine'] },
];

// One-time warning suppression for unknown muscles.
const _warnedUnknownStrength = new Set();
const _warnedUnknownYoga = new Set();

function tokenize(targetMuscles) {
  if (!targetMuscles || typeof targetMuscles !== 'string') return [];
  return targetMuscles
    .toLowerCase()
    .split(/[,;.]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Map a strength target_muscles string to a Set of canonical DB groups.
 * Unknown tokens are logged once and skipped.
 */
export function muscleTextToDbGroups(targetMuscles) {
  const groups = new Set();
  for (const token of tokenize(targetMuscles)) {
    const group = STRENGTH_TOKEN_TO_GROUP[token];
    if (group) {
      groups.add(group);
    } else if (token !== 'full body' && token !== 'neck') {
      // 'full body' and 'neck' are intentionally not mapped; don't warn.
      if (!_warnedUnknownStrength.has(token)) {
        _warnedUnknownStrength.add(token);
        console.warn(`[muscleMapping] unknown strength muscle token: "${token}"`);
      }
    }
  }
  return groups;
}

/**
 * Map a yoga pose to a Set of regions (Spine | Hips | Shoulders).
 * Combines target_muscles tokens with pose-name hints. A pose can target
 * multiple regions.
 */
export function yogaPoseToRegions(poseName, targetMuscles, _category) {
  const regions = new Set();
  const tokens = tokenize(targetMuscles);

  for (const token of tokens) {
    for (const [region, keywords] of Object.entries(YOGA_REGION_TOKENS)) {
      if (keywords.has(token)) regions.add(region);
    }
  }

  // Pose name hints add coverage for poses whose target_muscles are vague
  // (e.g. "back, core" → Spine via name match for "cobra").
  const lowerName = (poseName || '').toLowerCase();
  if (lowerName) {
    for (const hint of YOGA_POSE_NAME_REGION_HINTS) {
      if (lowerName.includes(hint.match)) {
        for (const r of hint.regions) regions.add(r);
      }
    }
  }

  if (regions.size === 0 && tokens.length > 0) {
    // First token only — keeps the warn list small.
    const probe = tokens[0];
    if (!_warnedUnknownYoga.has(probe)) {
      _warnedUnknownYoga.add(probe);
      // Quiet by default — many yoga descriptions are benefit prose, not
      // muscles. Only enable when debugging coverage.
      // console.warn(`[muscleMapping] yoga pose unmapped: "${poseName}" (first token "${probe}")`);
    }
  }
  return regions;
}

export const STRENGTH_GROUPS = [
  'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Core',
  'Back', 'Glutes', 'Quads', 'Hamstrings', 'Calves',
];

export const FLEXIBILITY_REGIONS = ['Spine', 'Hips', 'Shoulders'];

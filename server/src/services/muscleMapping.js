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

// Pose-name hints — only kept where the pose's target_muscles don't already
// carry a region signal via tokens (audited 2026-04-23 against the live DB).
// Hints are matched as whole WORDS in the lowercased pose name so that
// "Cow Pose" → Spine doesn't also fire on "Cow-Faced Pose" (which is a
// shoulder pose). The override list runs first; if any override matches,
// generic hints below it are skipped to prevent the cross-classification.
const YOGA_POSE_NAME_OVERRIDES = [
  // Compound names that would otherwise be misclassified by a generic
  // single-word hint sitting below them.
  { match: ['cow', 'faced'],  regions: ['Shoulders'] }, // Cow-Faced Pose
  { match: ['cow', 'face'],   regions: ['Shoulders'] }, // Cow Face Pose
];

const YOGA_POSE_NAME_HINTS = [
  { match: 'pigeon',  regions: ['Hips'] },        // Pigeon Pose has only "legs, core" tokens
  { match: 'fish',    regions: ['Spine'] },        // Fish Pose tokens lack any spine signal
  { match: 'camel',   regions: ['Spine'] },        // Camel Pose tokens lack any spine signal
  { match: 'frog',    regions: ['Hips'] },         // Frog Pose tokens lack any hip signal
  { match: 'lunge',   regions: ['Hips'] },         // Lunge Pose has only "arms, core, legs"
  { match: 'warrior', regions: ['Hips'] },         // Reverse Warrior has empty target_muscles
  { match: 'dolphin', regions: ['Shoulders'] },    // Dolphin Pose tokens lack shoulder signal
  { match: 'headstand', regions: ['Shoulders'] },  // Some headstand entries have prose-only muscles
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

  // Pose-name hints — whole-word match so "Cow Pose" doesn't poison
  // "Cow-Faced Pose". Overrides run first; if any override fires we skip
  // the generic single-word hints to avoid the cross-classification noted
  // in the review.
  const nameWords = (poseName || '').toLowerCase().split(/[\s\-]+/).filter(Boolean);
  if (nameWords.length) {
    const wordSet = new Set(nameWords);
    let overrideMatched = false;
    for (const ov of YOGA_POSE_NAME_OVERRIDES) {
      if (ov.match.every((w) => wordSet.has(w))) {
        for (const r of ov.regions) regions.add(r);
        overrideMatched = true;
      }
    }
    if (!overrideMatched) {
      for (const hint of YOGA_POSE_NAME_HINTS) {
        if (wordSet.has(hint.match)) {
          for (const r of hint.regions) regions.add(r);
        }
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

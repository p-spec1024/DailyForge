// HARDCODED breathwork durations in MINUTES.
// Single source of truth — do NOT compute from protocol phases/cycles.
// API returns technique.estimated_duration in SECONDS (= minutes * 60).

export const TECHNIQUE_DURATIONS = {
  // Calming
  'Box Breathing': 4,
  '4-7-8 Breathing': 3,
  'Diaphragmatic Breathing': 5,
  'Coherent Breathing': 10,
  'Resonance Breathing': 10,
  'Resonant Breathing': 10,
  'Extended Exhale': 5,
  'Physiological Sigh': 2,
  'Sama Vritti': 5,
  'Visama Vritti': 8,
  'Sitali Pranayama': 5,
  'Sitkari Pranayama': 5,
  'Sitali': 5,
  'Sitkari': 5,
  'Sheetali': 5,
  'Sheetkari': 5,

  // Pranayama
  'Nadi Shodhana': 8,
  'Anulom Vilom': 8,
  'Alternate Nostril Breathing': 8,
  'Bhramari Pranayama': 5,
  'Bhramari': 5,
  'Ujjayi Pranayama': 8,
  'Ujjayi': 8,
  'Viloma Pranayama': 8,
  'Dirga Pranayama': 8,
  'Full Yogic Breath': 8,
  'Three-Part Breath': 5,
  'Udgeeth': 5,
  'Simhasana': 3,

  // Energizing
  'Kapalabhati': 5,
  'Bhastrika': 5,
  'Bhastrika Pranayama': 5,
  'Breath of Fire': 5,
  'Surya Bhedana': 5,
  'Sun Breathing': 5,
  'Chandra Bhedana': 5,
  'Moon Breathing': 5,
  'Energizing Breath': 3,
  'Morning Energizer': 3,
  'Power Breathing': 3,
  'Pre-Workout Activation': 3,
  'Triangle Breathing': 5,

  // Focus / Meditation
  'Mindful Breathing': 10,
  'Counted Breathing': 5,
  'Breath Counting': 5,
  'Breath Awareness': 10,
  'Meditation Breathing': 10,
  'Focus Breath': 8,
  '2-to-1 Breathing': 5,
  '5-5-5-5 Square Breathing': 5,
  'A52 Breath Method': 5,

  // Therapeutic / Stress
  'Pursed Lip Breathing': 5,
  'Buteyko Method': 5,
  'Grounding Breath': 5,
  'Stress Reset': 3,
  'Pain Management Breath': 5,
  'Anti-Anxiety Breath': 5,
  'Anti-Anxiety Breathing': 5,
  'Calming Breath': 5,
  'Recovery Breathing': 5,
  'Between-Sets Recovery': 2,
  'Post-Workout Calm': 5,
  'Post-Workout Breath': 5,

  // Sleep
  'Sleep Breathing': 5,
  '4-7-8 Sleep': 5,
  'Sleep Preparation Breath': 5,
  'Deep Sleep Induction': 5,
  'Relaxation Breath': 5,

  // Goal-specific
  'Appetite Control': 5,
  'Craving Interrupt': 3,
  'Cyclic Hyperventilation': 8,

  // Advanced — capped at 20 min
  'Wim Hof Method': 12,
  'Wim Hof': 12,
  'Tummo': 15,
  'Tummo Breathing': 15,
  'Holotropic Breathwork': 20,
  'Holotropic Breathing': 20,
  'Rebirthing Breath': 15,
  'Kumbhaka': 10,
  'Kumbhaka Practice': 10,
  'Apnea Training': 10,
  'Breath Hold Training': 10,
  'Bandha Breathing': 10,
};

export const CATEGORY_DEFAULTS = {
  energizing: 5,
  calming: 5,
  focus: 8,
  sleep: 5,
  performance: 10,
  recovery: 5,
  therapeutic: 5,
  advanced: 12,
};

export function getEstimatedDurationSeconds(name, category) {
  const minutes =
    TECHNIQUE_DURATIONS[name] ?? CATEGORY_DEFAULTS[category] ?? 5;
  return minutes * 60;
}

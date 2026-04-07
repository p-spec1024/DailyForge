import 'dotenv/config';
import { pool } from '../pool.js';

// ---------------------------------------------------------------------------
// 52 Breathwork Techniques — the largest library of any fitness app
// Categories: pranayama (18), western (11), therapeutic (8),
//             performance (8), advanced (7)
// ---------------------------------------------------------------------------

const techniques = [
  // =========================================================================
  // TRADITIONAL PRANAYAMA (18)
  // =========================================================================
  {
    name: 'Anulom Vilom (Alternate Nostril)',
    tradition: 'pranayama',
    purpose: ['calming', 'focus'],
    difficulty: 'beginner',
    description:
      'A foundational pranayama technique where you alternate breathing through each nostril. Close the right nostril with your thumb and inhale through the left, then close the left with your ring finger and exhale through the right. Repeat on the other side. Balances the nervous system and calms the mind.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Close right nostril, inhale through left' },
        { type: 'exhale', duration: 4, instruction: 'Close left nostril, exhale through right' },
        { type: 'inhale', duration: 4, instruction: 'Inhale through right nostril' },
        { type: 'exhale', duration: 4, instruction: 'Close right nostril, exhale through left' },
      ],
      rounds: 10,
      total_duration_seconds: 160,
      ratio: '4-0-4-0',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Kapalabhati (Skull Shining)',
    tradition: 'pranayama',
    purpose: ['energizing'],
    difficulty: 'intermediate',
    description:
      'A powerful cleansing breath involving rapid, forceful exhalations through the nose with passive inhalations. The abdominal muscles pump sharply to drive the exhale. Generates heat, clears the nasal passages, and stimulates the nervous system.',
    protocol_json: {
      phases: [
        { type: 'exhale', duration: 0.5, instruction: 'Sharp forceful exhale through nose, pulling navel in' },
        { type: 'inhale', duration: 0.5, instruction: 'Passive inhale — let the belly release naturally' },
      ],
      rounds: 3,
      reps_per_round: 30,
      rest_between_rounds: 30,
      total_duration_seconds: 120,
      ratio: 'rapid exhales',
    },
    safety_notes: 'Stop immediately if you feel dizzy or lightheaded. Practice on an empty stomach.',
    contraindications: ['pregnancy', 'high blood pressure', 'heart conditions', 'hernia', 'epilepsy', 'recent abdominal surgery'],
  },
  {
    name: 'Bhastrika (Bellows Breath)',
    tradition: 'pranayama',
    purpose: ['energizing'],
    difficulty: 'intermediate',
    description:
      'A vigorous breathing technique with forceful, equal-length inhales and exhales through the nose. Unlike Kapalabhati, both inhale and exhale are active. Rapidly increases energy and oxygen levels, generating internal heat.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 1, instruction: 'Forceful deep inhale through nose, expanding chest' },
        { type: 'exhale', duration: 1, instruction: 'Forceful exhale through nose, contracting abdomen' },
      ],
      rounds: 3,
      reps_per_round: 20,
      rest_between_rounds: 30,
      total_duration_seconds: 150,
      ratio: 'rapid inhale/exhale',
    },
    safety_notes: 'Stop if dizzy. Not recommended during illness or fever. Practice on empty stomach.',
    contraindications: ['pregnancy', 'high blood pressure', 'anxiety disorders', 'heart conditions', 'epilepsy', 'hernia'],
  },
  {
    name: 'Bhramari (Bee Breath)',
    tradition: 'pranayama',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A soothing pranayama where you make a humming sound like a bee on each exhale. Close ears with thumbs, place fingers over eyes. The vibration calms the mind and nervous system. Excellent for reducing anxiety and improving concentration.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Deep inhale through nose' },
        { type: 'exhale', duration: 8, instruction: 'Exhale making a steady humming sound (like a bee)' },
      ],
      rounds: 7,
      total_duration_seconds: 84,
      ratio: '4-8 humming',
    },
    safety_notes: null,
    contraindications: ['active ear infection'],
  },
  {
    name: 'Ujjayi (Ocean Breath)',
    tradition: 'pranayama',
    purpose: ['focus', 'calming'],
    difficulty: 'beginner',
    description:
      'Create a soft constriction at the back of the throat to produce a gentle ocean-like sound during both inhale and exhale through the nose. This resistance slows the breath and generates internal warmth. A foundational breath used throughout yoga practice.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 5, instruction: 'Inhale through nose with slight throat constriction, creating ocean sound' },
        { type: 'exhale', duration: 5, instruction: 'Exhale through nose maintaining the soft hissing sound' },
      ],
      rounds: 12,
      total_duration_seconds: 120,
      ratio: '5-5',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Sitali (Cooling Breath)',
    tradition: 'pranayama',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A cooling pranayama where you curl the tongue into a tube and inhale through it, drawing cool air over the tongue. Exhale slowly through the nose. Reduces body heat and soothes the nervous system. Helpful in warm weather or after vigorous exercise.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Curl tongue into a tube, inhale slowly through the tongue' },
        { type: 'exhale', duration: 6, instruction: 'Close mouth, exhale slowly through nose' },
      ],
      rounds: 10,
      total_duration_seconds: 100,
      ratio: '4-6',
    },
    safety_notes: 'Not everyone can curl their tongue — use Sitkari as an alternative.',
    contraindications: ['low blood pressure', 'respiratory disorders in cold weather'],
  },
  {
    name: 'Sitkari (Hissing Breath)',
    tradition: 'pranayama',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A cooling breath where you clench the teeth lightly and inhale through the gaps, creating a hissing sound. Exhale through the nose. Similar cooling effect to Sitali and accessible to those who cannot curl their tongue.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Clench teeth gently, inhale through teeth making a hissing sound' },
        { type: 'exhale', duration: 6, instruction: 'Close mouth, exhale slowly through nose' },
      ],
      rounds: 10,
      total_duration_seconds: 100,
      ratio: '4-6',
    },
    safety_notes: null,
    contraindications: ['low blood pressure', 'respiratory disorders in cold weather'],
  },
  {
    name: 'Surya Bhedana (Right Nostril Breathing)',
    tradition: 'pranayama',
    purpose: ['energizing'],
    difficulty: 'intermediate',
    description:
      'Inhale exclusively through the right nostril and exhale through the left. In yogic tradition, the right nostril is associated with the sun (Surya) and sympathetic activation. Increases body heat and energy, stimulating the sympathetic nervous system.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Close left nostril, inhale through right' },
        { type: 'hold', duration: 4, instruction: 'Hold breath gently, both nostrils closed' },
        { type: 'exhale', duration: 6, instruction: 'Close right nostril, exhale through left' },
      ],
      rounds: 10,
      total_duration_seconds: 140,
      ratio: '4-4-6',
    },
    safety_notes: 'Avoid in hot weather or if you feel overheated.',
    contraindications: ['high blood pressure', 'heart disease', 'fever'],
  },
  {
    name: 'Chandra Bhedana (Left Nostril Breathing)',
    tradition: 'pranayama',
    purpose: ['calming', 'sleep'],
    difficulty: 'intermediate',
    description:
      'Inhale exclusively through the left nostril and exhale through the right. The left nostril is associated with the moon (Chandra) and parasympathetic activation. Cools the body, calms the mind, and promotes restful sleep.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Close right nostril, inhale through left' },
        { type: 'hold', duration: 4, instruction: 'Hold breath gently, both nostrils closed' },
        { type: 'exhale', duration: 6, instruction: 'Close left nostril, exhale through right' },
      ],
      rounds: 10,
      total_duration_seconds: 140,
      ratio: '4-4-6',
    },
    safety_notes: null,
    contraindications: ['depression', 'low blood pressure'],
  },
  {
    name: 'Nadi Shodhana (Channel Purification)',
    tradition: 'pranayama',
    purpose: ['calming', 'focus'],
    difficulty: 'intermediate',
    description:
      'An advanced form of alternate nostril breathing that includes breath retention (kumbhaka) between sides. Purifies the energy channels (nadis) and deeply balances the nervous system. More calming and meditative than basic Anulom Vilom.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Close right nostril, inhale through left' },
        { type: 'hold', duration: 8, instruction: 'Close both nostrils, hold breath' },
        { type: 'exhale', duration: 8, instruction: 'Close left nostril, exhale through right' },
        { type: 'inhale', duration: 4, instruction: 'Inhale through right nostril' },
        { type: 'hold', duration: 8, instruction: 'Close both nostrils, hold breath' },
        { type: 'exhale', duration: 8, instruction: 'Close right nostril, exhale through left' },
      ],
      rounds: 6,
      total_duration_seconds: 240,
      ratio: '4-8-8',
    },
    safety_notes: 'Reduce hold duration if uncomfortable. Never strain.',
    contraindications: ['high blood pressure (use without holds)', 'respiratory conditions'],
  },
  {
    name: 'Viloma (Against the Wave)',
    tradition: 'pranayama',
    purpose: ['focus'],
    difficulty: 'intermediate',
    description:
      'A pranayama where either the inhale or exhale is interrupted with brief pauses. In viloma inhale, you breathe in segments (pause-inhale-pause-inhale). This builds breath control and lung capacity while training focused attention.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Inhale one-third capacity' },
        { type: 'hold', duration: 2, instruction: 'Pause briefly' },
        { type: 'inhale', duration: 2, instruction: 'Inhale to two-thirds capacity' },
        { type: 'hold', duration: 2, instruction: 'Pause briefly' },
        { type: 'inhale', duration: 2, instruction: 'Inhale to full capacity' },
        { type: 'hold', duration: 2, instruction: 'Pause briefly' },
        { type: 'exhale', duration: 6, instruction: 'Smooth continuous exhale' },
      ],
      rounds: 6,
      total_duration_seconds: 108,
      ratio: 'interrupted',
    },
    safety_notes: 'Do not strain during pauses. If uncomfortable, reduce holds.',
    contraindications: null,
  },
  {
    name: 'Dirga (Three-Part Breath)',
    tradition: 'pranayama',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A complete yogic breath that fills the lungs in three stages: belly, ribcage, and upper chest. On exhale, release in reverse order. This teaches full diaphragmatic breathing and is often the first pranayama taught to beginners.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 3, instruction: 'Breathe into the belly, feeling it expand' },
        { type: 'inhale', duration: 3, instruction: 'Continue inhaling into the ribcage, feeling ribs widen' },
        { type: 'inhale', duration: 3, instruction: 'Fill the upper chest, slight lift in collarbones' },
        { type: 'exhale', duration: 3, instruction: 'Release upper chest first' },
        { type: 'exhale', duration: 3, instruction: 'Relax the ribcage' },
        { type: 'exhale', duration: 3, instruction: 'Gently draw navel toward spine to empty belly' },
      ],
      rounds: 8,
      total_duration_seconds: 144,
      ratio: '9-9 (three-part)',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Kumbhaka (Breath Retention)',
    tradition: 'pranayama',
    purpose: ['focus', 'performance'],
    difficulty: 'advanced',
    description:
      'A practice centered on deliberate breath holds (kumbhaka) after both inhale (antara) and exhale (bahya). Extended holds increase CO2 tolerance, strengthen respiratory muscles, and sharpen concentration. The cornerstone of advanced pranayama.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Deep full inhale through nose' },
        { type: 'hold', duration: 16, instruction: 'Hold after inhale — maintain relaxed body' },
        { type: 'exhale', duration: 8, instruction: 'Slow controlled exhale through nose' },
        { type: 'hold', duration: 8, instruction: 'Hold after exhale — stay calm' },
      ],
      rounds: 5,
      total_duration_seconds: 180,
      ratio: '4-16-8-8',
    },
    safety_notes: 'Build hold times gradually. Stop if dizzy or anxious. Never force retention.',
    contraindications: ['high blood pressure', 'heart conditions', 'pregnancy', 'respiratory conditions', 'anxiety disorders'],
  },
  {
    name: 'Murchha (Fainting Breath)',
    tradition: 'pranayama',
    purpose: ['calming'],
    difficulty: 'advanced',
    description:
      'A pranayama involving a long inhale, extended retention, and very slow exhale while tilting the head back slightly. Creates a sensation of lightness and mental withdrawal. Named for the swooning quality it induces, promoting deep relaxation.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 6, instruction: 'Deep slow inhale, gently tilt head back' },
        { type: 'hold', duration: 12, instruction: 'Hold breath with jalandhara bandha (chin lock)' },
        { type: 'exhale', duration: 10, instruction: 'Very slow exhale, bring head to center' },
      ],
      rounds: 5,
      total_duration_seconds: 140,
      ratio: '6-12-10',
    },
    safety_notes: 'Practice seated only. Stop immediately if faint. Must be learned from a teacher.',
    contraindications: ['low blood pressure', 'vertigo', 'cervical spine issues', 'heart conditions', 'pregnancy'],
  },
  {
    name: 'Plavini (Floating Breath)',
    tradition: 'pranayama',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'An advanced and rarely practiced pranayama where air is swallowed into the stomach, creating a feeling of lightness or floating. Traditionally said to allow a practitioner to float in water. Primarily a demonstration of breath mastery.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 8, instruction: 'Inhale deeply and swallow air into stomach' },
        { type: 'hold', duration: 10, instruction: 'Hold with air in stomach and lungs' },
        { type: 'exhale', duration: 8, instruction: 'Slowly release air through mouth' },
      ],
      rounds: 3,
      total_duration_seconds: 78,
      ratio: '8-10-8',
    },
    safety_notes: 'Extremely advanced technique. Must be practiced under expert guidance only. May cause bloating or discomfort.',
    contraindications: ['digestive disorders', 'hernia', 'GERD', 'pregnancy'],
  },
  {
    name: 'Kevali Kumbhaka (Spontaneous Retention)',
    tradition: 'pranayama',
    purpose: ['focus'],
    difficulty: 'advanced',
    description:
      'The highest form of kumbhaka where breath retention occurs spontaneously without effort. The practitioner enters a state of natural breathlessness during deep meditation. Considered the culmination of pranayama practice rather than a technique to force.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 6, instruction: 'Gentle natural inhale' },
        { type: 'exhale', duration: 6, instruction: 'Gentle natural exhale' },
        { type: 'hold', duration: 0, instruction: 'Allow breath to naturally suspend — do not force' },
      ],
      rounds: 1,
      total_duration_seconds: 600,
      ratio: 'spontaneous',
    },
    safety_notes: 'This is an advanced meditative state, not a forced technique. Requires years of practice. Only practice under experienced guidance.',
    contraindications: ['anxiety disorders', 'panic disorder'],
  },
  {
    name: 'Sama Vritti (Equal Breathing)',
    tradition: 'pranayama',
    purpose: ['calming', 'focus'],
    difficulty: 'beginner',
    description:
      'A simple and accessible pranayama where inhale, hold, exhale, and second hold are all the same length. The equal ratio creates a steady rhythm that calms the nervous system and anchors attention. An excellent entry point for breathwork.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Inhale through nose for a count of 4' },
        { type: 'hold', duration: 4, instruction: 'Hold gently for a count of 4' },
        { type: 'exhale', duration: 4, instruction: 'Exhale through nose for a count of 4' },
        { type: 'hold', duration: 4, instruction: 'Hold empty for a count of 4' },
      ],
      rounds: 8,
      total_duration_seconds: 128,
      ratio: '4-4-4-4',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Visama Vritti (Unequal Breathing)',
    tradition: 'pranayama',
    purpose: ['calming', 'focus'],
    difficulty: 'intermediate',
    description:
      'A pranayama using unequal ratios for inhale, hold, and exhale. The classic ratio is 1:4:2 (e.g., 4-16-8). By varying the ratio, you can shift the effect — longer exhales calm, longer holds build endurance. More versatile than equal breathing.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Inhale through nose for a count of 4' },
        { type: 'hold', duration: 16, instruction: 'Hold for a count of 16' },
        { type: 'exhale', duration: 8, instruction: 'Exhale slowly for a count of 8' },
      ],
      rounds: 6,
      total_duration_seconds: 168,
      ratio: '1:4:2 (4-16-8)',
    },
    safety_notes: 'Start with shorter holds (4-8-8) and build up gradually.',
    contraindications: ['high blood pressure (reduce holds)', 'anxiety disorders (reduce holds)'],
  },

  // =========================================================================
  // MODERN WESTERN METHODS (11)
  // =========================================================================
  {
    name: 'Box Breathing',
    tradition: 'western',
    purpose: ['focus', 'calming'],
    difficulty: 'beginner',
    description:
      'A structured breathing technique popularized by the U.S. Navy SEALs for stress management. Equal-length inhale, hold, exhale, and hold create a "box" pattern. Used by military, first responders, and athletes for focus under pressure.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Inhale slowly through nose for 4 seconds' },
        { type: 'hold', duration: 4, instruction: 'Hold breath for 4 seconds' },
        { type: 'exhale', duration: 4, instruction: 'Exhale slowly through mouth for 4 seconds' },
        { type: 'hold', duration: 4, instruction: 'Hold empty for 4 seconds' },
      ],
      rounds: 6,
      total_duration_seconds: 96,
      ratio: '4-4-4-4',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: '4-7-8 Breathing',
    tradition: 'western',
    purpose: ['sleep', 'calming'],
    difficulty: 'beginner',
    description:
      'Developed by Dr. Andrew Weil based on pranayama principles. The extended hold and long exhale activate the parasympathetic nervous system. Often called a "natural tranquilizer for the nervous system." Particularly effective as a sleep aid.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Inhale quietly through nose for 4 seconds' },
        { type: 'hold', duration: 7, instruction: 'Hold breath for 7 seconds' },
        { type: 'exhale', duration: 8, instruction: 'Exhale completely through mouth for 8 seconds, making a whoosh sound' },
      ],
      rounds: 4,
      total_duration_seconds: 76,
      ratio: '4-7-8',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Wim Hof Method',
    tradition: 'western',
    purpose: ['energizing', 'performance'],
    difficulty: 'advanced',
    description:
      'Developed by Wim "The Iceman" Hof. Involves 30-40 deep breaths followed by a breath hold on empty lungs, then a recovery breath with a 15-second hold. Triggers a controlled stress response, increases adrenaline, and may improve immune function.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Deep powerful inhale through nose or mouth' },
        { type: 'exhale', duration: 1, instruction: 'Relaxed exhale — let go, do not force' },
      ],
      reps_per_round: 30,
      recovery: [
        { type: 'exhale', duration: 3, instruction: 'After 30 breaths, exhale and hold' },
        { type: 'hold', duration: 90, instruction: 'Hold on empty lungs as long as comfortable' },
        { type: 'inhale', duration: 3, instruction: 'Deep recovery breath in' },
        { type: 'hold', duration: 15, instruction: 'Hold full lungs for 15 seconds' },
      ],
      rounds: 3,
      total_duration_seconds: 660,
      ratio: '30 breaths + hold',
    },
    safety_notes: 'NEVER practice near water, while driving, or standing. Tingling and lightheadedness are normal but stop if uncomfortable. Always practice lying or sitting down.',
    contraindications: ['epilepsy', 'pregnancy', 'heart conditions', 'high blood pressure', 'stroke history', 'respiratory conditions'],
  },
  {
    name: 'Coherent Breathing',
    tradition: 'western',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'Breathing at a rate of approximately 6 breaths per minute (5 seconds in, 5 seconds out) to maximize heart rate variability (HRV). Developed by Stephen Elliott. The specific rate synchronizes heart, respiratory, and blood pressure rhythms.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 5, instruction: 'Inhale slowly and smoothly through nose for 5 seconds' },
        { type: 'exhale', duration: 5, instruction: 'Exhale slowly and smoothly through nose for 5 seconds' },
      ],
      rounds: 20,
      total_duration_seconds: 200,
      ratio: '5-5 (6 breaths/min)',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Resonant Breathing',
    tradition: 'western',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'Similar to Coherent Breathing but fine-tuned to each individual\'s resonant frequency, typically between 4.5 and 6.5 breaths per minute. At resonance, HRV is maximized and baroreflex sensitivity is optimal. Often guided by biofeedback devices.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 5.5, instruction: 'Inhale smoothly through nose' },
        { type: 'exhale', duration: 5.5, instruction: 'Exhale smoothly through nose' },
      ],
      rounds: 18,
      total_duration_seconds: 198,
      ratio: '5.5-5.5 (approx 5.5 breaths/min)',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Buteyko Breathing',
    tradition: 'western',
    purpose: ['recovery'],
    difficulty: 'intermediate',
    description:
      'Developed by Dr. Konstantin Buteyko, this method focuses on nasal breathing and reducing breath volume to normalize CO2 levels. Involves controlled pauses after exhale to build CO2 tolerance. Used therapeutically for asthma and breathing pattern disorders.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 3, instruction: 'Gentle, small breath in through nose' },
        { type: 'exhale', duration: 3, instruction: 'Gentle, relaxed breath out through nose' },
        { type: 'hold', duration: 5, instruction: 'Hold after exhale (control pause) — stop before urge to breathe is strong' },
      ],
      rounds: 8,
      total_duration_seconds: 88,
      ratio: 'reduced breathing',
    },
    safety_notes: 'Never hold breath to the point of gasping. The control pause should be comfortable.',
    contraindications: ['panic disorder', 'severe asthma (without medical supervision)'],
  },
  {
    name: 'Physiological Sigh',
    tradition: 'western',
    purpose: ['calming', 'recovery'],
    difficulty: 'beginner',
    description:
      'A natural breathing pattern studied by Stanford neuroscientist Dr. Andrew Huberman. Involves a double inhale through the nose followed by an extended exhale through the mouth. Rapidly reduces stress by maximally inflating lung alveoli and increasing CO2 removal.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Inhale sharply through nose to fill lungs halfway' },
        { type: 'inhale', duration: 1, instruction: 'Second short inhale through nose to top off lungs' },
        { type: 'exhale', duration: 6, instruction: 'Long slow exhale through mouth' },
      ],
      rounds: 5,
      total_duration_seconds: 45,
      ratio: 'double inhale + long exhale',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Pursed Lip Breathing',
    tradition: 'western',
    purpose: ['recovery'],
    difficulty: 'beginner',
    description:
      'A therapeutic technique where you exhale slowly through pursed lips as if blowing through a straw. Creates back-pressure that keeps airways open longer, improving gas exchange. Widely used in pulmonary rehabilitation and chronic respiratory conditions.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Relax and inhale slowly through nose' },
        { type: 'exhale', duration: 4, instruction: 'Purse lips as if whistling, exhale slowly and gently' },
      ],
      rounds: 10,
      total_duration_seconds: 60,
      ratio: '1:2 (2-4)',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: '2-to-1 Breathing',
    tradition: 'western',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A simple technique where the exhale is twice as long as the inhale (e.g., 4 seconds in, 8 seconds out). The extended exhale activates the vagus nerve and parasympathetic response. Easy to learn and effective for immediate calm.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Inhale through nose for 4 seconds' },
        { type: 'exhale', duration: 8, instruction: 'Exhale through nose for 8 seconds' },
      ],
      rounds: 10,
      total_duration_seconds: 120,
      ratio: '4-8 (1:2)',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Triangle Breathing',
    tradition: 'western',
    purpose: ['focus'],
    difficulty: 'beginner',
    description:
      'A simplified version of box breathing with three equal phases: inhale, hold, exhale (no hold after exhale). Visualize tracing the sides of a triangle. Simpler to learn than box breathing while still providing focus and calm.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Inhale through nose for 4 seconds' },
        { type: 'hold', duration: 4, instruction: 'Hold for 4 seconds' },
        { type: 'exhale', duration: 4, instruction: 'Exhale through mouth for 4 seconds' },
      ],
      rounds: 8,
      total_duration_seconds: 96,
      ratio: '4-4-4',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Cyclic Sighing',
    tradition: 'western',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A Stanford-researched protocol involving repeated physiological sighs (double inhale + extended exhale) for 5 minutes. Shown in clinical studies to reduce anxiety and improve mood more effectively than mindfulness meditation for acute stress relief.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Inhale deeply through nose' },
        { type: 'inhale', duration: 1, instruction: 'Second quick inhale through nose to top off lungs' },
        { type: 'exhale', duration: 7, instruction: 'Slow extended exhale through mouth' },
      ],
      rounds: 10,
      total_duration_seconds: 300,
      ratio: 'cyclic double inhale + extended exhale',
    },
    safety_notes: null,
    contraindications: null,
  },

  // =========================================================================
  // THERAPEUTIC PROTOCOLS (8)
  // =========================================================================
  {
    name: 'Diaphragmatic Breathing',
    tradition: 'therapeutic',
    purpose: ['calming', 'recovery'],
    difficulty: 'beginner',
    description:
      'The foundation of therapeutic breathing. Place one hand on your chest and one on your belly. Breathe so that only the belly hand rises. Strengthens the diaphragm, improves oxygen exchange, and activates the relaxation response. Essential for anyone with shallow breathing habits.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Breathe in through nose, feeling belly push hand outward' },
        { type: 'exhale', duration: 6, instruction: 'Exhale through pursed lips, feeling belly fall inward' },
      ],
      rounds: 10,
      total_duration_seconds: 100,
      ratio: '4-6',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Breath Counting',
    tradition: 'therapeutic',
    purpose: ['focus'],
    difficulty: 'beginner',
    description:
      'A mindfulness technique where you count each exhale from 1 to 10, then restart. If you lose count, simply begin again at 1. Deceptively simple but powerful for training attention and revealing how often the mind wanders. Used in Zen meditation traditions.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Natural breath in through nose' },
        { type: 'exhale', duration: 6, instruction: 'Natural breath out, count this exhale (1 through 10)' },
      ],
      rounds: 5,
      reps_per_round: 10,
      total_duration_seconds: 300,
      ratio: '4-6 with counting',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Grounding Breath',
    tradition: 'therapeutic',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A combination of slow breathing (5 seconds in, 5 seconds out) with body awareness anchoring. On each exhale, mentally scan and release tension from a different body part. Used in trauma therapy and anxiety management to reconnect with physical sensation.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 5, instruction: 'Breathe in through nose, feeling feet on the ground' },
        { type: 'exhale', duration: 5, instruction: 'Breathe out, release tension from a body part' },
      ],
      rounds: 10,
      total_duration_seconds: 100,
      ratio: '5-5 with body awareness',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Anti-Anxiety Breath',
    tradition: 'therapeutic',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A protocol focused specifically on extending the exhale to activate the parasympathetic nervous system. Uses a 4-count inhale and progressively longer exhales (starting at 6, building to 8). Designed for in-the-moment anxiety relief.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Gentle inhale through nose for 4 counts' },
        { type: 'exhale', duration: 8, instruction: 'Slow, steady exhale through mouth for 8 counts' },
      ],
      rounds: 10,
      total_duration_seconds: 120,
      ratio: '4-8 (extended exhale)',
    },
    safety_notes: 'If 8-count exhale feels strained, start with 6 and build up.',
    contraindications: null,
  },
  {
    name: 'Pain Management Breath',
    tradition: 'therapeutic',
    purpose: ['recovery'],
    difficulty: 'intermediate',
    description:
      'A slow, deep breathing technique used in pain management protocols. Combines diaphragmatic breathing with visualization — imagine breathing "into" the area of pain. Slow breathing at 6 breaths per minute has been shown to modulate pain perception through vagal activation.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 5, instruction: 'Slow deep inhale, visualize breath flowing to the area of discomfort' },
        { type: 'hold', duration: 2, instruction: 'Brief gentle hold' },
        { type: 'exhale', duration: 7, instruction: 'Slow exhale, visualize tension and pain leaving with the breath' },
      ],
      rounds: 8,
      total_duration_seconds: 112,
      ratio: '5-2-7',
    },
    safety_notes: 'This is a complementary technique, not a substitute for medical pain management.',
    contraindications: null,
  },
  {
    name: 'COPD Breathing',
    tradition: 'therapeutic',
    purpose: ['recovery'],
    difficulty: 'beginner',
    description:
      'A combined pursed-lip and diaphragmatic breathing protocol adapted for COPD patients. Emphasizes slow, controlled exhalation and belly breathing to prevent air trapping and improve gas exchange. Part of standard pulmonary rehabilitation.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Breathe in slowly through nose, let belly rise' },
        { type: 'exhale', duration: 4, instruction: 'Purse lips and exhale slowly, twice as long as inhale' },
      ],
      rounds: 10,
      total_duration_seconds: 60,
      ratio: '2-4 (pursed lip)',
    },
    safety_notes: 'Designed for respiratory patients. Consult a healthcare provider for personalized guidance.',
    contraindications: null,
  },
  {
    name: 'Asthma Relief Breath',
    tradition: 'therapeutic',
    purpose: ['recovery'],
    difficulty: 'beginner',
    description:
      'A simplified Buteyko-inspired protocol for asthma support. Focuses on gentle nasal breathing, reduced volume, and brief comfortable breath holds. Aims to normalize breathing patterns that can worsen asthma symptoms like mouth breathing and hyperventilation.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 3, instruction: 'Small gentle breath in through nose — less than you want' },
        { type: 'exhale', duration: 3, instruction: 'Relaxed gentle exhale through nose' },
        { type: 'hold', duration: 3, instruction: 'Brief comfortable pause — stop before any urge to gasp' },
      ],
      rounds: 10,
      total_duration_seconds: 90,
      ratio: '3-3-3 (Buteyko-lite)',
    },
    safety_notes: 'Not a substitute for prescribed asthma medication. Always have your inhaler accessible.',
    contraindications: ['acute asthma attack (use inhaler instead)'],
  },
  {
    name: 'Stress Reset Breath',
    tradition: 'therapeutic',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'A quick stress-relief protocol using three consecutive physiological sighs. Takes under 30 seconds, making it ideal for acute stress moments — before a presentation, after receiving bad news, or during conflict. The fastest evidence-based calming technique.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Quick deep inhale through nose' },
        { type: 'inhale', duration: 1, instruction: 'Short second inhale to top off' },
        { type: 'exhale', duration: 6, instruction: 'Extended exhale through mouth with audible sigh' },
      ],
      rounds: 3,
      total_duration_seconds: 27,
      ratio: '3 physiological sighs',
    },
    safety_notes: null,
    contraindications: null,
  },

  // =========================================================================
  // PERFORMANCE-FOCUSED (8)
  // =========================================================================
  {
    name: 'Power Breath',
    tradition: 'performance',
    purpose: ['energizing'],
    difficulty: 'intermediate',
    description:
      'An energizing breath pattern with a fast, powerful inhale and sharp exhale, used to boost alertness and energy before demanding tasks. Combines elements of Kapalabhati with diaphragmatic power. Popular in martial arts and athletic warm-ups.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 1, instruction: 'Fast powerful inhale through nose, expanding diaphragm' },
        { type: 'exhale', duration: 1, instruction: 'Sharp forceful exhale through mouth with a "ha" sound' },
      ],
      rounds: 3,
      reps_per_round: 15,
      rest_between_rounds: 20,
      total_duration_seconds: 90,
      ratio: 'fast inhale, sharp exhale',
    },
    safety_notes: 'Stop if dizzy. Not recommended first thing in the morning on an empty stomach.',
    contraindications: ['high blood pressure', 'heart conditions', 'pregnancy'],
  },
  {
    name: 'Pre-Workout Activation',
    tradition: 'performance',
    purpose: ['energizing'],
    difficulty: 'beginner',
    description:
      'A light version of Kapalabhati designed for pre-workout activation. Moderate-speed breaths to raise alertness and warm up respiratory muscles without the intensity of full Kapalabhati. Ideal for the first 2 minutes of a warm-up.',
    protocol_json: {
      phases: [
        { type: 'exhale', duration: 1, instruction: 'Moderately sharp exhale through nose, pull belly in' },
        { type: 'inhale', duration: 1, instruction: 'Passive inhale, let belly release' },
      ],
      rounds: 3,
      reps_per_round: 20,
      rest_between_rounds: 15,
      total_duration_seconds: 90,
      ratio: 'Kapalabhati-lite',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Between-Sets Recovery',
    tradition: 'performance',
    purpose: ['recovery'],
    difficulty: 'beginner',
    description:
      'A shortened box breathing protocol (3-3-3-3) designed for use between exercise sets. Helps lower heart rate, clear metabolic byproducts, and restore focus before the next set. Compact enough for 60-90 second rest periods.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 3, instruction: 'Inhale through nose for 3 seconds' },
        { type: 'hold', duration: 3, instruction: 'Hold for 3 seconds' },
        { type: 'exhale', duration: 3, instruction: 'Exhale through mouth for 3 seconds' },
        { type: 'hold', duration: 3, instruction: 'Hold empty for 3 seconds' },
      ],
      rounds: 5,
      total_duration_seconds: 60,
      ratio: '3-3-3-3',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Post-Workout Calm',
    tradition: 'performance',
    purpose: ['calming'],
    difficulty: 'beginner',
    description:
      'An extended exhale protocol (4 in, 8 out) for post-workout cooldown. Activates the parasympathetic nervous system to shift from fight-or-flight into rest-and-digest. Accelerates recovery by reducing cortisol and calming the heart rate.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Inhale through nose for 4 seconds' },
        { type: 'exhale', duration: 8, instruction: 'Slow exhale through mouth for 8 seconds' },
      ],
      rounds: 10,
      total_duration_seconds: 120,
      ratio: '4-8',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Athletic Focus Breath',
    tradition: 'performance',
    purpose: ['focus'],
    difficulty: 'intermediate',
    description:
      'Combines coherent breathing (5-5 ratio) with mental visualization. During inhale, visualize energy building; during exhale, visualize performing the upcoming athletic task. Used by sports psychologists for pre-competition mental preparation.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 5, instruction: 'Inhale, visualize energy building and muscles activating' },
        { type: 'exhale', duration: 5, instruction: 'Exhale, visualize executing your best performance' },
      ],
      rounds: 12,
      total_duration_seconds: 120,
      ratio: '5-5 with visualization',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Tummo (Inner Fire)',
    tradition: 'performance',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'An ancient Tibetan Buddhist meditation technique that combines breathing with visualization of inner fire. Involves vigorous "vase breathing" — deep breaths held at the belly with visualization of heat at the navel. Practitioners can measurably raise body temperature.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Deep inhale through nose, visualize flame at navel center' },
        { type: 'hold', duration: 10, instruction: 'Hold with gentle abdominal lock (vase breath), visualize fire growing' },
        { type: 'exhale', duration: 6, instruction: 'Slow exhale, visualize heat radiating through entire body' },
      ],
      rounds: 7,
      total_duration_seconds: 140,
      ratio: '4-10-6 with visualization',
    },
    safety_notes: 'Advanced technique requiring proper instruction. Do not practice in extreme cold without supervision. Mental visualization component is essential — not just a breathing exercise.',
    contraindications: ['heart conditions', 'high blood pressure', 'pregnancy', 'psychiatric conditions'],
  },
  {
    name: 'Apnea Training',
    tradition: 'performance',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'A progressive breath-hold training protocol used by freedivers and swimmers. Alternates between rest breaths and increasing-duration holds. Builds CO2 tolerance, improves oxygen efficiency, and extends comfortable breath-hold time.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 4, instruction: 'Full deep breath in through nose' },
        { type: 'hold', duration: 30, instruction: 'Hold — start at 30 seconds, add 5 seconds per round' },
        { type: 'exhale', duration: 4, instruction: 'Controlled exhale through mouth' },
        { type: 'inhale', duration: 4, instruction: 'Recovery breath in' },
        { type: 'exhale', duration: 4, instruction: 'Recovery breath out' },
        { type: 'inhale', duration: 4, instruction: 'Recovery breath in' },
        { type: 'exhale', duration: 4, instruction: 'Recovery breath out' },
      ],
      rounds: 6,
      total_duration_seconds: 360,
      ratio: 'progressive holds',
    },
    safety_notes: 'NEVER practice near water or alone. Always have a spotter. Stop immediately if you experience contractions or dizziness. Never hyperventilate before holds.',
    contraindications: ['heart conditions', 'epilepsy', 'respiratory conditions', 'pregnancy', 'sickle cell disease'],
  },
  {
    name: 'Hypoxic Training',
    tradition: 'performance',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'A reduced-oxygen breathing technique used to simulate altitude training. Involves breathing through a restricted airway or reducing breath volume. Stimulates erythropoietin (EPO) production and improves oxygen-carrying efficiency in the blood.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 3, instruction: 'Small restricted inhale — less air than you want' },
        { type: 'exhale', duration: 3, instruction: 'Normal exhale through nose' },
        { type: 'hold', duration: 10, instruction: 'Hold on exhale — build air hunger gradually' },
      ],
      rounds: 6,
      rest_between_rounds: 60,
      total_duration_seconds: 456,
      ratio: 'reduced oxygen + holds',
    },
    safety_notes: 'Only practice seated or lying down. Stop immediately if you feel faint, nauseous, or have heart palpitations. Not a substitute for actual altitude training. Build gradually over weeks.',
    contraindications: ['heart conditions', 'anemia', 'pregnancy', 'respiratory conditions', 'epilepsy', 'sickle cell disease'],
  },

  // =========================================================================
  // ADVANCED / SPECIALIZED (7)
  // =========================================================================
  {
    name: 'Holotropic Breathwork',
    tradition: 'advanced',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'Developed by Stanislav Grof as a therapeutic tool. Involves prolonged rapid deep breathing (30-60+ minutes) with evocative music to induce altered states of consciousness. Used for psychological exploration and emotional release. Always requires a trained facilitator.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Deep fast inhale through mouth — connected, no pause' },
        { type: 'exhale', duration: 2, instruction: 'Full exhale through mouth — immediately inhale again' },
      ],
      rounds: 1,
      total_duration_seconds: 3600,
      ratio: 'continuous rapid breathing',
    },
    safety_notes: 'MUST be done with a trained facilitator (sitter). Extended sessions can produce intense physical and emotional experiences. Not a self-practice technique. Ensure safe environment with trained support.',
    contraindications: ['heart conditions', 'high blood pressure', 'epilepsy', 'pregnancy', 'glaucoma', 'recent surgery', 'psychiatric conditions', 'osteoporosis'],
  },
  {
    name: 'Rebirthing Breath',
    tradition: 'advanced',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'Developed by Leonard Orr. Uses conscious connected breathing — continuous inhales and exhales with no pause. Typically practiced for 1-2 hours with a trained practitioner. Intended to process stored physical and emotional tension.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 3, instruction: 'Inhale deeply — connect directly to exhale with no pause' },
        { type: 'exhale', duration: 3, instruction: 'Relaxed exhale — immediately flow into next inhale' },
      ],
      rounds: 1,
      total_duration_seconds: 3600,
      ratio: 'connected circular breathing',
    },
    safety_notes: 'Requires a certified Rebirthing Breathwork practitioner. Can produce intense emotional releases. Not suitable for self-practice by beginners.',
    contraindications: ['heart conditions', 'epilepsy', 'pregnancy', 'psychiatric conditions', 'recent surgery'],
  },
  {
    name: 'Transformational Breath',
    tradition: 'advanced',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'Created by Dr. Judith Kravitz. A three-level breathing system combining conscious connected breathing with body mapping, toning, and movement. Focuses on opening the respiratory system to its full potential. Practiced in guided sessions.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 2, instruction: 'Open-mouth inhale into lower belly — full and connected' },
        { type: 'exhale', duration: 1, instruction: 'Relaxed exhale — let go completely, no effort' },
      ],
      rounds: 1,
      total_duration_seconds: 2400,
      ratio: 'conscious connected, 2:1 inhale emphasis',
    },
    safety_notes: 'Requires a certified Transformational Breath facilitator. Emotional and physical releases are expected and normal.',
    contraindications: ['heart conditions', 'epilepsy', 'pregnancy', 'detached retina', 'psychiatric conditions'],
  },
  {
    name: 'Shamanic Breathing',
    tradition: 'advanced',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'A rhythmic breathing practice often accompanied by drumming or repetitive music at 4-4.5 beats per second (theta frequency). Combines rapid breathing with auditory driving to induce trance-like states. Used in ceremonial and therapeutic contexts.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 1.5, instruction: 'Deep rhythmic inhale through mouth, matching the drum beat' },
        { type: 'exhale', duration: 1.5, instruction: 'Strong exhale through mouth, continuous rhythm' },
      ],
      rounds: 1,
      total_duration_seconds: 1800,
      ratio: 'rhythmic with drumming',
    },
    safety_notes: 'Should be facilitated by an experienced practitioner. Can produce intense altered states. Ensure a safe, supported environment.',
    contraindications: ['heart conditions', 'epilepsy', 'pregnancy', 'psychiatric conditions', 'PTSD (without therapeutic support)'],
  },
  {
    name: 'Biodynamic Breath',
    tradition: 'advanced',
    purpose: ['performance'],
    difficulty: 'advanced',
    description:
      'Developed by Giten Tonkov. Integrates connected breathing with movement, touch, sound, and emotional expression. Designed to release trauma stored in the body through a somatic approach. Typically practiced in multi-session programs.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 3, instruction: 'Deep connected inhale through mouth with body movement' },
        { type: 'exhale', duration: 3, instruction: 'Exhale with vocalization or sound — allow expression' },
      ],
      rounds: 1,
      total_duration_seconds: 2400,
      ratio: 'connected with movement + sound',
    },
    safety_notes: 'Requires a certified Biodynamic Breathwork practitioner. Combines breath with bodywork and emotional processing. Not a self-practice technique.',
    contraindications: ['heart conditions', 'epilepsy', 'pregnancy', 'psychiatric conditions', 'recent surgery'],
  },
  {
    name: 'Zen Breath Meditation',
    tradition: 'advanced',
    purpose: ['focus'],
    difficulty: 'intermediate',
    description:
      'A Zen Buddhist practice (susokukan) of simply observing the breath without controlling it. Attention rests on the natural flow of air at the nostrils. When the mind wanders, gently return awareness to the breath. The simplest yet most challenging breath practice — pure awareness.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 0, instruction: 'Natural inhale — observe without controlling' },
        { type: 'exhale', duration: 0, instruction: 'Natural exhale — simply witness the breath' },
      ],
      rounds: 1,
      total_duration_seconds: 600,
      ratio: 'natural, uncontrolled',
    },
    safety_notes: null,
    contraindications: null,
  },
  {
    name: 'Yoga Nidra Breath',
    tradition: 'advanced',
    purpose: ['sleep'],
    difficulty: 'intermediate',
    description:
      'The breath awareness component of Yoga Nidra (yogic sleep). Involves lying in savasana and observing the natural breath without alteration, often with a body scan. The practice of non-doing allows the body to drop into the hypnagogic state between waking and sleeping.',
    protocol_json: {
      phases: [
        { type: 'inhale', duration: 0, instruction: 'Observe natural inhale — do not deepen or change it' },
        { type: 'exhale', duration: 0, instruction: 'Observe natural exhale — let the body breathe itself' },
      ],
      rounds: 1,
      total_duration_seconds: 1200,
      ratio: 'natural observation',
    },
    safety_notes: null,
    contraindications: null,
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;

async function seed() {
  console.log(`Seeding ${techniques.length} breathwork techniques...`);

  let inserted = 0;

  for (let i = 0; i < techniques.length; i += BATCH_SIZE) {
    const batch = techniques.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const t of batch) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}::jsonb, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      params.push(
        t.name,
        t.tradition,
        t.purpose,
        t.difficulty,
        JSON.stringify(t.protocol_json),
        t.safety_notes,
        t.contraindications,
        t.description
      );
    }

    const result = await pool.query(
      `INSERT INTO breathwork_techniques (name, tradition, purpose, difficulty, protocol_json, safety_notes, contraindications, description)
       VALUES ${values.join(', ')}
       ON CONFLICT (name) DO NOTHING`,
      params
    );

    inserted += result.rowCount;
  }

  // Verify
  const { rows } = await pool.query(
    `SELECT tradition, COUNT(*)::int AS count FROM breathwork_techniques GROUP BY tradition ORDER BY tradition`
  );

  console.log(`\nInserted ${inserted} new techniques.`);
  console.log('\nTechnique count by category:');
  for (const r of rows) {
    console.log(`  ${r.tradition}: ${r.count}`);
  }

  const total = await pool.query('SELECT COUNT(*)::int AS total FROM breathwork_techniques');
  console.log(`\nTotal: ${total.rows[0].total} techniques`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());

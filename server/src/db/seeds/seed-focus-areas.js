import 'dotenv/config';
import { pool } from '../pool.js';

// ---------------------------------------------------------------------------
// S11-T3 — Focus-area data model
//
// Seeds three tables (focus_areas, focus_muscle_keywords,
// focus_content_compatibility) per Trackers/S11-T3-focus-area-spec.md.
// Idempotent via TRUNCATE. Run after seed-breathwork-techniques.js.
// ---------------------------------------------------------------------------

// 12 body focuses (sort_order 10–120) + 5 state focuses (sort_order 200–240).
const FOCUS_AREAS = [
  // Body
  { slug: 'chest',      display_name: 'Chest',      focus_type: 'body', description: 'Pectoral development through pushing movements and chest-opening yoga.', icon_name: 'bench',          sort_order: 10  },
  { slug: 'back',       display_name: 'Back',       focus_type: 'body', description: 'Pulling strength and posterior chain mobility.',                          icon_name: 'arrow-bigger-up', sort_order: 20  },
  { slug: 'shoulders',  display_name: 'Shoulders',  focus_type: 'body', description: 'Deltoid strength and shoulder mobility.',                                 icon_name: 'shield',         sort_order: 30  },
  { slug: 'biceps',     display_name: 'Biceps',     focus_type: 'body', description: 'Biceps and elbow flexor isolation.',                                      icon_name: 'flame',          sort_order: 40  },
  { slug: 'triceps',    display_name: 'Triceps',    focus_type: 'body', description: 'Triceps and pressing accessories.',                                       icon_name: 'flame',          sort_order: 50  },
  { slug: 'core',       display_name: 'Core',       focus_type: 'body', description: 'Trunk stability, abs, obliques, lower back.',                             icon_name: 'target',         sort_order: 60  },
  { slug: 'glutes',     display_name: 'Glutes',     focus_type: 'body', description: 'Hip extensors and gluteal development.',                                  icon_name: 'circle',         sort_order: 70  },
  { slug: 'quads',      display_name: 'Quads',      focus_type: 'body', description: 'Quadriceps and knee extension.',                                          icon_name: 'triangle',       sort_order: 80  },
  { slug: 'hamstrings', display_name: 'Hamstrings', focus_type: 'body', description: 'Posterior thigh and hip-hinge work.',                                     icon_name: 'triangle',       sort_order: 90  },
  { slug: 'calves',     display_name: 'Calves',     focus_type: 'body', description: 'Lower-leg strength and ankle mobility.',                                  icon_name: 'move-vertical',  sort_order: 100 },
  { slug: 'mobility',   display_name: 'Mobility',   focus_type: 'body', description: 'Full-body flexibility, joint range, dynamic warmup.',                     icon_name: 'waves',          sort_order: 110 },
  { slug: 'full_body',  display_name: 'Full Body',  focus_type: 'body', description: 'Compound movements and integrator sessions across all groups.',           icon_name: 'user',           sort_order: 120 },
  // State
  { slug: 'energize', display_name: 'Energize', focus_type: 'state', description: 'Activate the nervous system, elevate alertness and oxygenation.', icon_name: 'zap',    sort_order: 200 },
  { slug: 'calm',     display_name: 'Calm',     focus_type: 'state', description: 'Down-regulate the stress response, lower heart rate and tension.', icon_name: 'wind',   sort_order: 210 },
  { slug: 'focus',    display_name: 'Focus',    focus_type: 'state', description: 'Build mental concentration and steady attention.',                  icon_name: 'target', sort_order: 220 },
  { slug: 'sleep',    display_name: 'Sleep',    focus_type: 'state', description: 'Prepare the body for restorative sleep.',                           icon_name: 'moon',   sort_order: 230 },
  { slug: 'recover',  display_name: 'Recover',  focus_type: 'state', description: 'Restore the system after intensity or stress.',                     icon_name: 'heart',  sort_order: 240 },
];

// Muscle keywords per body focus (mobility + full_body have none — handled
// as service-layer special cases in S12 via practice_types and compound
// detection respectively).
const MUSCLE_KEYWORDS = {
  chest:      ['chest', 'pectoral', 'pec'],
  back:       ['back', 'lat', 'latissimus', 'rhomboid', 'trapezius', 'rear deltoid'],
  shoulders:  ['shoulder', 'deltoid', 'delt'],
  biceps:     ['bicep', 'biceps brachii', 'brachialis'],
  triceps:    ['tricep', 'triceps brachii'],
  core:       ['abs', 'abdominal', 'oblique', 'core', 'transverse'],
  glutes:     ['glute', 'gluteus'],
  quads:      ['quad', 'quadriceps', 'vastus'],
  hamstrings: ['hamstring', 'biceps femoris', 'semitendinosus', 'semimembranosus'],
  calves:     ['calf', 'calves', 'gastrocnemius', 'soleus'],
};

// State-focus → breathwork technique names (looked up by name to get
// content_id). Per spec §Seed 3 — names verified to exist in DB during
// pre-flight check (Apr 27, 2026).
//
// 4-7-8 Breathing is included under both `calm` (per spec table) and
// `sleep` (because category='sleep' in the current DB, per pre-flight).
const STATE_BREATHWORK = {
  energize: [
    { name: 'Bhastrika',                role: 'main', notes: 'Forceful breathing, strong sympathetic activation. Intermediate.' },
    { name: 'Kapalabhati',              role: 'main', notes: 'Skull-shining breath, classic AM activator. Intermediate.' },
    { name: 'Surya Bhedana',            role: 'main', notes: 'Right-nostril sympathetic activator. Intermediate.' },
    { name: 'Wim Hof Method',           role: 'main', notes: 'Modern Western activator. Intermediate.' },
    { name: 'Cyclic Hyperventilation',  role: 'main', notes: 'Western cousin of Wim Hof. Intermediate.' },
    { name: 'Morning Energizer',        role: 'main', notes: 'App-internal AM tool. Beginner-friendly.' },
    { name: 'Pre-Workout Activation',   role: 'main', notes: 'Engine should still respect intermediate gating from beginner_duration_min IS NULL.' },
  ],
  calm: [
    { name: 'Nadi Shodhana',            role: 'main', notes: 'Foundational alternate-nostril, parasympathetic.' },
    { name: 'Anulom Vilom',             role: 'main', notes: 'Parasympathetic alternate-nostril.' },
    { name: 'Bhramari',                 role: 'main', notes: 'Bee breath, vagal-activating hum.' },
    { name: 'Sitali',                   role: 'main', notes: 'Cooling tongue-curl.' },
    { name: 'Sitkari',                  role: 'main', notes: 'Cooling teeth-hissing.' },
    { name: '4-7-8 Breathing',          role: 'main', notes: "Weil's protocol, canonical calm." },
    { name: 'Box Breathing',            role: 'main', notes: '4-4-4-4, balanced calm.' },
    { name: 'Coherent Breathing',       role: 'main', notes: '5-5 resonance frequency.' },
    { name: 'Extended Exhale',          role: 'main', notes: 'Long exhale, vagal-dominant.' },
    { name: '5-5-5-5 Square Breathing', role: 'main', notes: 'Slower box, 3 bpm.' },
    { name: 'A52 Breath Method',        role: 'main', notes: 'Slow nasal pattern.' },
    { name: 'Anti-Anxiety Breath',      role: 'main', notes: '4-2-6-2 vagal activator.' },
    { name: 'Grounding Breath',         role: 'main', notes: '5-4-3-2-1 sensory anchor.' },
    { name: 'Diaphragmatic Breathing',  role: 'main', notes: 'Belly breathing foundation.' },
    { name: 'Post-Workout Calm',        role: 'main', notes: 'Designed for HRV recovery.' },
  ],
  focus: [
    { name: 'Ujjayi',         role: 'main', notes: 'Throat-constricted ocean breath.' },
    { name: 'Breath Counting', role: 'main', notes: 'Count exhales 1–10.' },
    { name: 'Focus Breath',   role: 'main', notes: '4-4-4-4 box, pre-deep-work.' },
  ],
  sleep: [
    { name: 'Sleep Preparation Breath', role: 'main', notes: '4-7-8 in bedtime context.' },
    { name: 'Deep Sleep Induction',     role: 'main', notes: '4-0-8-0 with body release.' },
    { name: '4-7-8 Breathing',          role: 'main', notes: "Canonical sleep protocol; category='sleep' in DB per S11-T2." },
  ],
  recover: [
    { name: 'Diaphragmatic Breathing', role: 'main', notes: 'Foundational recovery. Also seeded under calm — different focus context.' },
    { name: 'Post-Workout Calm',       role: 'main', notes: 'HRV recovery designed for post-exercise. Also seeded under calm.' },
  ],
};

// Body-focus bookend pair — applied identically to all 12 body focuses.
const BOOKENDS = [
  { name: 'Morning Energizer', role: 'bookend_open',  notes: 'Beginner-safe sympathetic primer. Sets tone for body work.' },
  { name: 'Post-Workout Calm', role: 'bookend_close', notes: 'Beginner-safe parasympathetic recovery. Closes body work.' },
];

// Expected counts (used for hard-fail assertions). Per-focus keyword breakdown
// in spec §Verification Queries sums to 35; the spec's top-line "36" total is
// a known off-by-one inconsistency (the per-focus list is authoritative).
const EXPECTED = {
  focus_areas_total: 17,
  focus_areas_body: 12,
  focus_areas_state: 5,
  focus_muscle_keywords_total: 35,
  focus_content_compatibility_total: 54, // 7+15+3+3+2 state-main + 24 body bookends
  focus_content_compatibility_weight_not_null: 0,
};

async function lookupBreathworkIdsByName(client, names) {
  const result = await client.query(
    `SELECT id, name FROM breathwork_techniques WHERE name = ANY($1::text[])`,
    [names],
  );
  const map = new Map(result.rows.map((r) => [r.name, r.id]));
  const missing = names.filter((n) => !map.has(n));
  if (missing.length) {
    throw new Error(
      `Missing breathwork techniques referenced by S11-T3 seed: ${missing.join(', ')}`,
    );
  }
  return map;
}

async function seed() {
  console.log('Seeding S11-T3 focus-area data...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Phase 0: idempotent reset.
    await client.query(
      'TRUNCATE focus_content_compatibility, focus_muscle_keywords, focus_areas RESTART IDENTITY CASCADE',
    );

    // Phase 1: focus_areas.
    const focusIdBySlug = new Map();
    for (const fa of FOCUS_AREAS) {
      const r = await client.query(
        `INSERT INTO focus_areas (slug, display_name, focus_type, description, icon_name, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [fa.slug, fa.display_name, fa.focus_type, fa.description, fa.icon_name, fa.sort_order],
      );
      focusIdBySlug.set(fa.slug, r.rows[0].id);
    }
    console.log(`  focus_areas: inserted ${focusIdBySlug.size} rows`);

    // Phase 2: focus_muscle_keywords.
    let keywordCount = 0;
    for (const [slug, keywords] of Object.entries(MUSCLE_KEYWORDS)) {
      const focusId = focusIdBySlug.get(slug);
      for (const kw of keywords) {
        await client.query(
          `INSERT INTO focus_muscle_keywords (focus_id, keyword) VALUES ($1, $2)`,
          [focusId, kw],
        );
        keywordCount++;
      }
    }
    console.log(`  focus_muscle_keywords: inserted ${keywordCount} rows`);

    // Phase 3: focus_content_compatibility.
    // Collect every breathwork name we reference, look up IDs in one query.
    const allNames = new Set();
    for (const rows of Object.values(STATE_BREATHWORK)) {
      for (const r of rows) allNames.add(r.name);
    }
    for (const r of BOOKENDS) allNames.add(r.name);
    const breathworkIdByName = await lookupBreathworkIdsByName(
      client,
      Array.from(allNames),
    );

    let fccCount = 0;

    // 3a: state-focus seeds.
    for (const [slug, rows] of Object.entries(STATE_BREATHWORK)) {
      const focusId = focusIdBySlug.get(slug);
      for (const row of rows) {
        const contentId = breathworkIdByName.get(row.name);
        await client.query(
          `INSERT INTO focus_content_compatibility
             (focus_id, content_type, content_id, role, weight, notes)
           VALUES ($1, 'breathwork', $2, $3, NULL, $4)`,
          [focusId, contentId, row.role, row.notes],
        );
        fccCount++;
      }
    }

    // 3b: body-focus bookends — loop over all 12 body focuses.
    const bodyFocuses = FOCUS_AREAS.filter((f) => f.focus_type === 'body');
    for (const fa of bodyFocuses) {
      const focusId = focusIdBySlug.get(fa.slug);
      for (const bookend of BOOKENDS) {
        const contentId = breathworkIdByName.get(bookend.name);
        await client.query(
          `INSERT INTO focus_content_compatibility
             (focus_id, content_type, content_id, role, weight, notes)
           VALUES ($1, 'breathwork', $2, $3, NULL, $4)`,
          [focusId, contentId, bookend.role, bookend.notes],
        );
        fccCount++;
      }
    }
    console.log(`  focus_content_compatibility: inserted ${fccCount} rows`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ---- Assertions (post-commit, against the live tables) ----
  const failures = [];

  const totals = await pool.query(
    `SELECT focus_type, COUNT(*)::int AS n FROM focus_areas GROUP BY focus_type`,
  );
  const totalsBy = Object.fromEntries(totals.rows.map((r) => [r.focus_type, r.n]));
  const totalFa = (totalsBy.body || 0) + (totalsBy.state || 0);
  if (totalFa !== EXPECTED.focus_areas_total) {
    failures.push(`focus_areas total: expected ${EXPECTED.focus_areas_total}, got ${totalFa}`);
  }
  if ((totalsBy.body || 0) !== EXPECTED.focus_areas_body) {
    failures.push(`focus_areas body: expected ${EXPECTED.focus_areas_body}, got ${totalsBy.body}`);
  }
  if ((totalsBy.state || 0) !== EXPECTED.focus_areas_state) {
    failures.push(`focus_areas state: expected ${EXPECTED.focus_areas_state}, got ${totalsBy.state}`);
  }

  const kw = await pool.query(`SELECT COUNT(*)::int AS n FROM focus_muscle_keywords`);
  if (kw.rows[0].n !== EXPECTED.focus_muscle_keywords_total) {
    failures.push(
      `focus_muscle_keywords: expected ${EXPECTED.focus_muscle_keywords_total}, got ${kw.rows[0].n}`,
    );
  }

  const fcc = await pool.query(`SELECT COUNT(*)::int AS n FROM focus_content_compatibility`);
  if (fcc.rows[0].n !== EXPECTED.focus_content_compatibility_total) {
    failures.push(
      `focus_content_compatibility: expected ${EXPECTED.focus_content_compatibility_total}, got ${fcc.rows[0].n}`,
    );
  }

  const weighted = await pool.query(
    `SELECT COUNT(*)::int AS n FROM focus_content_compatibility WHERE weight IS NOT NULL`,
  );
  if (weighted.rows[0].n !== EXPECTED.focus_content_compatibility_weight_not_null) {
    failures.push(
      `focus_content_compatibility WHERE weight IS NOT NULL: expected ${EXPECTED.focus_content_compatibility_weight_not_null}, got ${weighted.rows[0].n}`,
    );
  }

  // Soft-FK validation: every breathwork content_id must resolve to a real
  // breathwork_techniques.id.
  const orphans = await pool.query(
    `SELECT fcc.id, fcc.content_id
       FROM focus_content_compatibility fcc
      LEFT JOIN breathwork_techniques bt ON bt.id = fcc.content_id
      WHERE fcc.content_type = 'breathwork' AND bt.id IS NULL`,
  );
  if (orphans.rows.length > 0) {
    failures.push(
      `Orphan breathwork refs in focus_content_compatibility: ${orphans.rows.length} row(s)`,
    );
  }

  if (failures.length > 0) {
    console.error('\n✗ Seed assertions FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n✓ focus_areas seeded: ${totalFa} rows (${totalsBy.body} body, ${totalsBy.state} state)`);
  console.log(`✓ focus_muscle_keywords seeded: ${kw.rows[0].n} rows`);
  console.log(`✓ focus_content_compatibility seeded: ${fcc.rows[0].n} rows`);
  console.log(`✓ rows with weight IS NOT NULL: ${weighted.rows[0].n}`);
  console.log('✓ all soft-FK checks pass');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

# S11-T3 — Focus-Area Data Model Spec

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 27, 2026
**Version:** v1
**Status:** LOCKED. Drives the S11-T3 Claude Code prompt.
**Depends on:** S11-T1 / S11-T1.5 / S11-T2 (breathwork tagging shipped, commit `f4cd69c`)
**Blocks:** Sprint 12 (suggestion engine)

---

## Purpose

Build the database schema and seed data for the focus-area model that the Sprint 12 suggestion engine will query. Focus areas are the user-facing vocabulary on the home page ("biceps," "energize," "mobility") that map across all three pillars to compatible content.

This ticket is **schema + seed only**. No API endpoint, no engine logic, no UI. Those land in S12+.

---

## Decisions locked (Apr 27, 2026 planning conversation)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Body-focus modeling | First-class rows in `focus_areas` (not app-code labels) |
| 2 | Compatibility fidelity | Role-tagged seeds; `weight` column added but left NULL (populated in S12) |
| 3 | Where mappings live | Hybrid — state-focus materialized in join table, body-focus derived from existing `target_muscles` via service-layer query |
| 4 | Endpoint scope | Schema only; `/api/focus-areas` ships in S12 with the suggestion engine |
| 5 | Body-focus seed granularity | Mid — 12 focuses (matches the 11 strength muscle groups + mobility + full-body) |

---

## Schema

Three new tables. All migrations land in `server/src/db/migrate.js` (per existing convention) under a single `S11-T3` block.

### Table 1: `focus_areas`

Master vocabulary table. Every user-selectable focus is one row.

```sql
CREATE TABLE IF NOT EXISTS focus_areas (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(40) UNIQUE NOT NULL,
  display_name  VARCHAR(80) NOT NULL,
  focus_type    VARCHAR(10) NOT NULL CHECK (focus_type IN ('body', 'state')),
  description   TEXT,
  icon_name     VARCHAR(40),
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_areas_type_active
  ON focus_areas(focus_type, is_active)
  WHERE is_active = true;
```

**Field notes:**
- `slug` — stable machine-readable identifier. Used by Flutter app and engine. Once seeded, never changed.
- `display_name` — user-facing label. Editable.
- `focus_type` — drives which query path the engine takes (body = derived; state = materialized).
- `icon_name` — `lucide_icons` reference string (e.g. `'dumbbell'`, `'wind'`). Picked by Flutter UI; nullable so seed can populate later.
- `sort_order` — controls focus-picker UI ordering. Body focuses come first (0–99), state focuses second (100–199), reserved space for future categories.
- `is_active` — soft-disable without deleting. Prevents broken FK references in user plan history.

### Table 2: `focus_muscle_keywords`

For body focuses only. Lists the muscle-keyword tokens that a body focus matches against existing `exercises.target_muscles` strings (and yoga `target_muscles` — same column name, same table).

```sql
CREATE TABLE IF NOT EXISTS focus_muscle_keywords (
  id        SERIAL PRIMARY KEY,
  focus_id  INT NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
  keyword   VARCHAR(60) NOT NULL,
  UNIQUE(focus_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_focus_muscle_keywords_focus
  ON focus_muscle_keywords(focus_id);
```

**Usage pattern (informational, lands in S12):** Service-layer code joins `focus_areas` → `focus_muscle_keywords` and runs `target_muscles ILIKE '%' || keyword || '%'` against `exercises` to derive the body-focus content set. No materialization needed because `target_muscles` is the authoritative source and rebuilding the cache on every tag change is overhead we don't need.

**Note on schema reuse:** The strength muscle taxonomy already lives in `exercises.target_muscles` as free-text. No new lookup table. Yoga poses use the same column on the same table (post-T5b cleanup). This keeps body-focus a pure derivation off existing data.

### Table 3: `focus_content_compatibility`

Materialized join for state-focus → content (and curated body-focus overrides for yoga warmups/cooldowns).

```sql
CREATE TABLE IF NOT EXISTS focus_content_compatibility (
  id           SERIAL PRIMARY KEY,
  focus_id     INT NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('strength', 'yoga', 'breathwork')),
  content_id   INT NOT NULL,
  role         VARCHAR(20) NOT NULL CHECK (role IN ('main', 'warmup', 'cooldown', 'bookend_open', 'bookend_close')),
  weight       DECIMAL(3,2),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(focus_id, content_type, content_id, role)
);

CREATE INDEX IF NOT EXISTS idx_fcc_focus_role_type
  ON focus_content_compatibility(focus_id, role, content_type);

CREATE INDEX IF NOT EXISTS idx_fcc_content
  ON focus_content_compatibility(content_type, content_id);
```

**Field notes:**
- `content_id` is **not** a true foreign key. It points to `exercises.id` when `content_type IN ('strength', 'yoga')` and to `breathwork_techniques.id` when `content_type = 'breathwork'`. We accept the soft-FK tradeoff to avoid two near-identical join tables. Seed integrity is verified by the seed script.
- `role` — five values cover the full session structure:
  - `main` — primary work of the session
  - `warmup` — early-session preparation
  - `cooldown` — late-session recovery
  - `bookend_open` — opening breathwork for a body-focus session (typically energizing)
  - `bookend_close` — closing breathwork for a body-focus session (typically calming)
- `weight` — DECIMAL(3,2), nullable, range 0.00–1.00. **Left NULL for all v1 seeds.** Populated in S12 once the engine is built and weight semantics are pinned down. Including the column now avoids a future migration.
- `notes` — free-text rationale for the row. Helpful for future curators reviewing why a particular yoga pose was tagged as "biceps cooldown."

---

## Seeds (full row-by-row)

Total seed: **17 `focus_areas` rows + 35 `focus_muscle_keywords` rows + ~110 `focus_content_compatibility` rows.**

### Seed 1: `focus_areas` (17 rows)

#### Body focuses (12 rows, sort_order 10–120)

| slug | display_name | focus_type | description | icon_name | sort_order |
|---|---|---|---|---|---|
| `chest` | Chest | body | Pectoral development through pushing movements and chest-opening yoga. | `bench` | 10 |
| `back` | Back | body | Pulling strength and posterior chain mobility. | `arrow-bigger-up` | 20 |
| `shoulders` | Shoulders | body | Deltoid strength and shoulder mobility. | `shield` | 30 |
| `biceps` | Biceps | body | Biceps and elbow flexor isolation. | `flame` | 40 |
| `triceps` | Triceps | body | Triceps and pressing accessories. | `flame` | 50 |
| `core` | Core | body | Trunk stability, abs, obliques, lower back. | `target` | 60 |
| `glutes` | Glutes | body | Hip extensors and gluteal development. | `circle` | 70 |
| `quads` | Quads | body | Quadriceps and knee extension. | `triangle` | 80 |
| `hamstrings` | Hamstrings | body | Posterior thigh and hip-hinge work. | `triangle` | 90 |
| `calves` | Calves | body | Lower-leg strength and ankle mobility. | `move-vertical` | 100 |
| `mobility` | Mobility | body | Full-body flexibility, joint range, dynamic warmup. | `waves` | 110 |
| `full_body` | Full Body | body | Compound movements and integrator sessions across all groups. | `user` | 120 |

#### State focuses (5 rows, sort_order 200–240)

| slug | display_name | focus_type | description | icon_name | sort_order |
|---|---|---|---|---|---|
| `energize` | Energize | state | Activate the nervous system, elevate alertness and oxygenation. | `zap` | 200 |
| `calm` | Calm | state | Down-regulate the stress response, lower heart rate and tension. | `wind` | 210 |
| `focus` | Focus | state | Build mental concentration and steady attention. | `target` | 220 |
| `sleep` | Sleep | state | Prepare the body for restorative sleep. | `moon` | 230 |
| `recover` | Recover | state | Restore the system after intensity or stress. | `heart` | 240 |

**Note on icons:** `icon_name` values are `lucide_icons` strings used by the Flutter focus-picker UI. Some icons are placeholders (e.g. `flame` for both biceps and triceps) — the Flutter UI ticket can refine these. Seed sets reasonable defaults; UI work owns final selection.

### Seed 2: `focus_muscle_keywords` (35 rows)

Maps body focuses to the keyword tokens used to ILIKE-match against `exercises.target_muscles`. Tokens chosen to match the actual muscle-name strings present in the strength + yoga seed data. Lowercase; the engine query normalizes both sides.

| Focus slug | Keywords |
|---|---|
| `chest` | `chest`, `pectoral`, `pec` |
| `back` | `back`, `lat`, `latissimus`, `rhomboid`, `trapezius`, `rear deltoid` |
| `shoulders` | `shoulder`, `deltoid`, `delt` |
| `biceps` | `bicep`, `biceps brachii`, `brachialis` |
| `triceps` | `tricep`, `triceps brachii` |
| `core` | `abs`, `abdominal`, `oblique`, `core`, `transverse` |
| `glutes` | `glute`, `gluteus` |
| `quads` | `quad`, `quadriceps`, `vastus` |
| `hamstrings` | `hamstring`, `biceps femoris`, `semitendinosus`, `semimembranosus` |
| `calves` | `calf`, `calves`, `gastrocnemius`, `soleus` |
| `mobility` | (no keywords — see note below) |
| `full_body` | (no keywords — see note below) |

**Why `mobility` and `full_body` have no keywords:**

These two focuses don't map to specific muscle tokens. Their content selection runs through different paths in S12:

- **`mobility`** — selects yoga poses whose `practice_types` array contains `'flexibility'` or `'mobility'`, plus dynamic warmup strength exercises. Service-layer logic in S12 will special-case this slug.
- **`full_body`** — selects compound multi-muscle exercises (defined by `target_muscles` containing 3+ groups) plus full-body yoga sequences. Service-layer logic in S12 will special-case this slug.

Both are documented as service-layer special cases in this spec so S12 doesn't accidentally try to look them up via `focus_muscle_keywords` and fail. The `focus_areas` rows still exist (so they appear in the picker UI); their content path is just different.

### Seed 3: `focus_content_compatibility` (~110 rows)

Two seed sources: state-focus content (the larger seed) + curated body-focus bookends (the smaller, optional one).

**Convention for state-focus rows:** the engine maps user-facing state slugs to internal `breathwork_techniques.category` values per PRE_SPRINT_11_PLANNING §4:

| State focus | breathwork.category values |
|---|---|
| `energize` | `energizing`, `performance` |
| `calm` | `calming`, `recovery` (subset) |
| `focus` | `focus` |
| `sleep` | `sleep` |
| `recover` | `recovery` |

**Eligibility rules for state-focus seeds (apply to all state rows):**
- `role='main'` requires `breathwork_techniques.standalone_compatible = true`
- `role='warmup'` for state sessions requires `pre_workout_compatible = true` (rare — used only when state session is paired with body work)
- `role='cooldown'` for state sessions requires `post_workout_compatible = true`

These rules ensure state-focus seeds inherit the safety boundaries we set in S11-T2.

#### State-focus seeds — by state

The seed script loads breathwork techniques by name (lookup against `breathwork_techniques.name`) to get the `content_id`, since the IDs are SERIAL and may shift between environments. Names are stable across environments.

##### `energize` (state focus)

Maps to `category IN ('energizing', 'performance')`. Filters on `standalone_compatible = true` for `main` role.

| Technique name | Role | Notes |
|---|---|---|
| Bhastrika | main | Forceful breathing, strong sympathetic activation. Intermediate. |
| Kapalabhati | main | Skull-shining breath, classic AM activator. Intermediate. |
| Surya Bhedana | main | Right-nostril sympathetic activator. Intermediate. |
| Wim Hof Method | main | Modern Western activator. Intermediate. |
| Cyclic Hyperventilation | main | Western cousin of Wim Hof. Intermediate. |
| Morning Energizer | main | App-internal AM tool. Beginner-friendly. |
| Pre-Workout Activation | main | Engine should still respect intermediate gating from beginner_duration_min IS NULL. |

##### `calm` (state focus)

Maps to `category IN ('calming', 'recovery')` filtered by `standalone_compatible = true` for `main` role. We deliberately exclude `recovery` techniques whose primary intent is between-set rather than session-anchor (`Between-Sets Recovery` is excluded by `standalone_compatible = false` already).

| Technique name | Role | Notes |
|---|---|---|
| Nadi Shodhana | main | Foundational alternate-nostril, parasympathetic. |
| Anulom Vilom | main | Parasympathetic alternate-nostril. |
| Bhramari | main | Bee breath, vagal-activating hum. |
| Sitali | main | Cooling tongue-curl. |
| Sitkari | main | Cooling teeth-hissing. |
| 4-7-8 Breathing | main | Weil's protocol, canonical calm. |
| Box Breathing | main | 4-4-4-4, balanced calm. |
| Coherent Breathing | main | 5-5 resonance frequency. |
| Extended Exhale | main | Long exhale, vagal-dominant. |
| 5-5-5-5 Square Breathing | main | Slower box, 3 bpm. |
| A52 Breath Method | main | Slow nasal pattern. |
| Anti-Anxiety Breath | main | 4-2-6-2 vagal activator. |
| Grounding Breath | main | 5-4-3-2-1 sensory anchor. |
| Diaphragmatic Breathing | main | Belly breathing foundation. |
| Post-Workout Calm | main | Designed for HRV recovery. |

##### `focus` (state focus)

Maps to `category = 'focus'` filtered by `standalone_compatible = true` for `main` role.

| Technique name | Role | Notes |
|---|---|---|
| Ujjayi | main | Throat-constricted ocean breath. |
| Breath Counting | main | Count exhales 1–10. |
| Focus Breath | main | 4-4-4-4 box, pre-deep-work. |

##### `sleep` (state focus)

Maps to `category = 'sleep'` filtered by `standalone_compatible = true` for `main` role.

| Technique name | Role | Notes |
|---|---|---|
| Sleep Preparation Breath | main | 4-7-8 in bedtime context. |
| Deep Sleep Induction | main | 4-0-8-0 with body release. |

(`category='sleep'` has 3 rows; the third row #17 4-7-8 Breathing is canonically `category='sleep'` per S11-T2. Verify in seed script — if confirmed, add as third `sleep`/main row.)

##### `recover` (state focus)

Maps to `category = 'recovery'` filtered by `standalone_compatible = true` for `main` role.

| Technique name | Role | Notes |
|---|---|---|
| Diaphragmatic Breathing | main | Foundational recovery. (Also seeded under `calm` — same technique, different focus context. Allowed by `UNIQUE(focus_id, content_type, content_id, role)`.) |
| Post-Workout Calm | main | HRV recovery designed for post-exercise. (Also seeded under `calm`.) |

#### Body-focus bookend seeds (optional, curated)

For body focuses, the engine derives main strength + yoga work from `focus_muscle_keywords` at query time. But the **opening and closing breathwork bookends** are worth curating once: they apply identically across all 12 body focuses.

**Convention:** every body focus gets the same two bookend mappings. Rather than duplicate 12 × 2 = 24 rows by hand, the seed script LOOPS over body focuses and inserts the same two bookend rows for each.

| Bookend role | Technique name | Rationale |
|---|---|---|
| `bookend_open` | Morning Energizer | Beginner-safe sympathetic primer. Sets tone for body work. |
| `bookend_close` | Post-Workout Calm | Beginner-safe parasympathetic recovery. Closes body work. |

Total bookend rows: **24** (12 body focuses × 2 bookend roles).

**Why these two specifically:**
- Both are `beginner` difficulty (no level-gating issues for default suggestions)
- Both are `standalone_compatible = true` (won't surface as engine-rejected)
- Morning Energizer is `pre_workout_compatible = true`; Post-Workout Calm is `post_workout_compatible = true` — direct match for bookend semantics
- Both have full duration coverage across all three difficulty tiers

S12 may add more bookend variety later (level-gated alternatives for intermediate/advanced users). v1 keeps it minimal.

#### Total `focus_content_compatibility` row count

| Source | Rows |
|---|---|
| `energize` state seeds | 7 |
| `calm` state seeds | 15 |
| `focus` state seeds | 3 |
| `sleep` state seeds | 2–3 (verify in seed script) |
| `recover` state seeds | 2 |
| Body-focus bookends | 24 |
| **Total** | **~53** |

(Earlier estimate of ~110 was conservative; final count after de-duplication is ~53. Spec is authoritative.)

---

## Seed script structure

The seed script is **new** at `server/src/db/seeds/seed-focus-areas.js`. It runs after `seed-breathwork-techniques.js` (since it references breathwork rows by name) and after the strength/yoga seeds (in case the muscle-keyword normalization wants to validate against existing `target_muscles` data, though this is informational only — the keywords are authored, not derived).

### Required behavior

1. **Idempotent.** Use `TRUNCATE focus_content_compatibility, focus_muscle_keywords, focus_areas RESTART IDENTITY CASCADE;` at the top, then re-insert. Same pattern as `seed-breathwork-techniques.js`.

2. **Lookup-by-name for breathwork references.** The seed reads `breathwork_techniques.id` via `SELECT id FROM breathwork_techniques WHERE name = $1`. If a referenced name is not found, the script logs an error and exits non-zero. This catches missing breathwork rows immediately rather than producing silent NULL FKs.

3. **Soft-FK validation.** For every `focus_content_compatibility` insert, verify the referenced `content_id` exists in the appropriate table (`breathwork_techniques` for `content_type='breathwork'`, `exercises` for the others). Log + exit on miss.

4. **Inline data, not external JSON.** Keep the seed data as JS objects in the seed script itself (matches `seed-breathwork-techniques.js` convention).

5. **Console summary at end.** Print:
   ```
   ✓ focus_areas seeded: 17 rows (12 body, 5 state)
   ✓ focus_muscle_keywords seeded: 35 rows
   ✓ focus_content_compatibility seeded: 53 rows
   ```

### Wiring into existing seed pipeline

Add a call to the seed runner (likely `server/src/db/seed.js` or similar — confirm existing pattern). Order after breathwork.

---

## Migration script

New migration block in `server/src/db/migrate.js` under an `S11-T3` comment header. Three `CREATE TABLE IF NOT EXISTS` calls + three `CREATE INDEX IF NOT EXISTS` calls per the schema section above.

**No `ALTER TABLE` on existing tables.** This ticket is purely additive — no changes to `exercises`, `breathwork_techniques`, or any other table.

---

## Verification queries

The seed script should run these post-seed and assert expected counts:

```sql
-- 17 focus areas: 12 body + 5 state
SELECT focus_type, COUNT(*) FROM focus_areas GROUP BY focus_type;
-- Expected: body=12, state=5

-- 35 muscle keywords across 10 body focuses (mobility + full_body have none)
SELECT COUNT(*) FROM focus_muscle_keywords;
-- Expected: 35

SELECT fa.slug, COUNT(fmk.id) AS keyword_count
FROM focus_areas fa
LEFT JOIN focus_muscle_keywords fmk ON fmk.focus_id = fa.id
WHERE fa.focus_type = 'body'
GROUP BY fa.slug
ORDER BY fa.sort_order;
-- Expected: chest=3, back=6, shoulders=3, biceps=3, triceps=2, core=5, glutes=2,
--           quads=3, hamstrings=4, calves=4, mobility=0, full_body=0

-- ~53 compatibility rows, distributed by focus
SELECT fa.slug, fcc.role, COUNT(*) AS n
FROM focus_content_compatibility fcc
JOIN focus_areas fa ON fa.id = fcc.focus_id
GROUP BY fa.slug, fcc.role
ORDER BY fa.sort_order, fcc.role;
-- Expected (state focuses): main rows per the seed table above
-- Expected (body focuses): each gets bookend_open=1, bookend_close=1

-- All weights NULL in v1
SELECT COUNT(*) FROM focus_content_compatibility WHERE weight IS NOT NULL;
-- Expected: 0
```

Bake these as assertions in the seed script (not just informational queries). Hard-fail with non-zero exit if any expected value mismatches.

---

## Out of scope for T3

Explicitly **not** in this ticket:

- `/api/focus-areas` endpoint (S12-T1 scope)
- Suggestion engine logic — focus → session generation (S12)
- Flutter focus-picker UI (later sprint)
- Weight values populated (S12 follow-up)
- Movement-pattern body focuses — push, pull, hinge, squat (FUTURE_SCOPE #41)
- Per-side focuses — left bicep, right glute (FUTURE_SCOPE #96)
- Service-layer helpers for body-focus content derivation (S12)

Document these in the ticket completion report so the Sprint 12 kickoff can pick them up cleanly.

---

## Acceptance criteria

A device test isn't meaningful here (no UI surface). Verification is:

1. ✅ `migrate.js` runs cleanly on a fresh DB and on an existing DB without errors (idempotent via `IF NOT EXISTS`).
2. ✅ `seed-focus-areas.js` runs cleanly after breathwork seed, prints expected counts, and all assertion queries pass.
3. ✅ Foreign key on `focus_id` correctly cascades — deleting a `focus_areas` row removes its `focus_muscle_keywords` and `focus_content_compatibility` children.
4. ✅ Spot-check queries (run by Prashob post-build):

   ```sql
   -- All body focuses present
   SELECT slug, display_name FROM focus_areas WHERE focus_type='body' ORDER BY sort_order;

   -- All state focuses present
   SELECT slug, display_name FROM focus_areas WHERE focus_type='state' ORDER BY sort_order;

   -- Calm focus has the canonical breathwork techniques as 'main'
   SELECT bt.name
   FROM focus_content_compatibility fcc
   JOIN focus_areas fa ON fa.id = fcc.focus_id
   JOIN breathwork_techniques bt ON bt.id = fcc.content_id
   WHERE fa.slug = 'calm' AND fcc.role = 'main' AND fcc.content_type = 'breathwork'
   ORDER BY bt.name;

   -- Every body focus has both bookends
   SELECT fa.slug, COUNT(*) FILTER (WHERE fcc.role='bookend_open') AS opens,
                    COUNT(*) FILTER (WHERE fcc.role='bookend_close') AS closes
   FROM focus_areas fa
   LEFT JOIN focus_content_compatibility fcc ON fcc.focus_id = fa.id
   WHERE fa.focus_type = 'body'
   GROUP BY fa.slug
   ORDER BY fa.sort_order;
   -- Expected: opens=1, closes=1 for all 12 body focuses
   ```

5. ✅ No `/review` needed (per Apr 27 process learning — data-population tickets with sanity-checked specs and assertion queries don't benefit from `/review`).

---

## Open follow-ups for S12

- Populate `weight` values once engine semantics are pinned down. Suggested calibration approach: start with subjective expert ranking (1–5 → 0.20–1.00 in 0.20 steps), refine after engine produces sample sessions.
- Author additional bookend variety for intermediate/advanced users (currently single beginner-safe pair).
- Decide whether `mobility` and `full_body` get their own `focus_content_compatibility` curation or stay pure-derived from `practice_types` and compound-detection logic.
- Consider whether `recover` should pull from yoga (yin / restorative) and/or strength (mobility / light-active) in addition to breathwork.

---

*Doc owner: Prashob (CEO/PM) + Claude.ai (Architect).*
*Place this doc in `D:\projects\dailyforge\Trackers\` alongside `S11-T2-tagging-spec.md`.*

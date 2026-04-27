# S11-T2 — Breathwork technique reference list

**Generated:** 2026-04-27
**Source:** `server/src/db/seeds/seed-breathwork-techniques.js`
**Total techniques:** 49 (matches expected)

This list is a read-only reference for the S11-T2 tagging spec doc. The 5 new tag fields (`duration_min`, `duration_max`, `pre_workout_compatible`, `post_workout_compatible`, `standalone_compatible`) are intentionally NOT in this table — they will be filled in the spec doc, then applied by S11-T2.

The `id` column is a positional index (1–49) based on array order in the seed file. The seed uses `TRUNCATE … RESTART IDENTITY` and inserts in this order, so these indices should match the DB `SERIAL` IDs after a fresh seed — but treat them as placeholders if the DB has been re-seeded out of order.

---

## Tradition counts

| Tradition | Count |
|---|---|
| pranayama | 15 |
| western | 13 |
| therapeutic | 8 |
| goal_specific | 8 |
| advanced | 5 |
| **Total** | **49** |

> Note: spec expected `performance` as a tradition value; actual data uses `goal_specific` for that bucket. No row has `tradition='performance'`. See Anomalies.

## Category counts

| Category | Count |
|---|---|
| calming | 22 |
| therapeutic | 7 |
| energizing | 6 |
| performance | 5 |
| focus | 3 |
| sleep | 3 |
| recovery | 3 |
| **Total** | **49** |

## Difficulty counts

| Difficulty | Count |
|---|---|
| beginner | 35 |
| intermediate | 8 |
| advanced | 6 |
| **Total** | **49** |

---

## Full list

| # | Name | Sanskrit | Tradition | Category | Difficulty | Safety | Protocol summary | Contraindications |
|---|---|---|---|---|---|---|---|---|
| 1 | Nadi Shodhana | Nadi Shodhana | pranayama | calming | beginner | green | 4-4-4-4 alternate nostril, 10 cycles | — |
| 2 | Anulom Vilom | Anulom Vilom | pranayama | calming | beginner | green | 4-0-4-0 alternate nostril, no holds | — |
| 3 | Kapalabhati | Kapalabhati | pranayama | energizing | intermediate | yellow | rapid forced exhales, 30/round @ ~60 bpm | Pregnancy, High BP, Heart conditions, Hernia, Recent abdominal surgery, Epilepsy |
| 4 | Bhastrika | Bhastrika | pranayama | energizing | intermediate | yellow | forceful in+out @ ~30 bpm, 20 cycles | Pregnancy, High BP, Heart conditions, Anxiety disorders, Vertigo |
| 5 | Bhramari | Bhramari | pranayama | calming | beginner | green | 4-0-8-0 humming exhale (bee breath) | — |
| 6 | Ujjayi | Ujjayi | pranayama | focus | beginner | green | 4-0-4-0 throat-constricted ocean breath | — |
| 7 | Sitali | Sitali | pranayama | calming | beginner | green | 4-0-4-0 inhale through curled tongue | Asthma in cold weather, Chronic bronchitis, Excessive mucus |
| 8 | Sitkari | Sitkari | pranayama | calming | beginner | green | 4-0-4-0 hissing inhale through teeth | Asthma in cold weather, Sensitive teeth |
| 9 | Surya Bhedana | Surya Bhedana | pranayama | energizing | intermediate | yellow | 4-4-4-0 right-nostril inhale only | High BP, Heart disease, Anxiety, Hyperthyroidism |
| 10 | Chandra Bhedana | Chandra Bhedana | pranayama | calming | intermediate | green | 4-4-4-0 left-nostril inhale only | Depression (use sparingly), Low BP, Colds/congestion |
| 11 | Dirga Pranayama | Dirga Pranayama | pranayama | calming | beginner | green | 6-0-6-0 three-part full yogic breath | — |
| 12 | Sama Vritti | Sama Vritti | pranayama | calming | beginner | green | 4-4-4-4 equal-ratio breathing | — |
| 13 | Visama Vritti | Visama Vritti | pranayama | calming | intermediate | yellow | 4-8-8-0 (1:2:2 unequal ratio) | Heart conditions for extended holds, Anxiety for long retentions |
| 14 | Udgeeth | Udgeeth | pranayama | calming | beginner | green | 4-0-12-0 with OM chant on exhale | — |
| 15 | Simhasana | Simhasana | pranayama | energizing | beginner | green | 4-0-4-0 with 'HA' roar, tongue out | — |
| 16 | Box Breathing | — | western | calming | beginner | green | 4-4-4-4 (Navy SEAL standard) | — |
| 17 | 4-7-8 Breathing | — | western | sleep | beginner | green | 4-7-8-0 with whoosh exhale | — |
| 18 | Wim Hof Method | — | western | performance | advanced | red | 30 deep breaths + retention, 3–4 rounds | NEVER near water/driving, Epilepsy, Pregnancy, Severe heart conditions, Uncontrolled high BP |
| 19 | Physiological Sigh | — | western | calming | beginner | green | double inhale + long exhale | — |
| 20 | Coherent Breathing | — | western | calming | beginner | green | 6-0-6-0 @ 5 bpm (max HRV) | — |
| 21 | Resonant Breathing | — | western | calming | beginner | green | 5-0-5-0 @ 6 bpm (resonant rate) | — |
| 22 | 2-to-1 Breathing | — | western | calming | beginner | green | 4-0-8-0 exhale 2× inhale | — |
| 23 | Triangle Breathing | — | western | calming | beginner | green | 4-4-4-0 (box without out-hold) | — |
| 24 | Extended Exhale | — | western | calming | beginner | green | 4-0-8-0 slow complete exhale | — |
| 25 | Breath Counting | — | western | focus | beginner | green | natural pace, count exhales 1–10 | — |
| 26 | Cyclic Hyperventilation | — | western | energizing | intermediate | yellow | 25 forceful inhales + breath hold | Anxiety disorders, Panic disorder, Pregnancy, Heart conditions |
| 27 | 5-5-5-5 Square Breathing | — | western | calming | beginner | green | 5-5-5-5 slower box @ 3 bpm | — |
| 28 | A52 Breath Method | — | western | calming | beginner | green | 5-0-5-2 evidence-based slow nasal | — |
| 29 | Diaphragmatic Breathing | — | therapeutic | recovery | beginner | green | 4-0-6-0 belly-only breathing | — |
| 30 | Pursed Lip Breathing | — | therapeutic | therapeutic | beginner | green | 2-0-4-0 exhale through pursed lips | — |
| 31 | Buteyko Method | — | therapeutic | therapeutic | intermediate | yellow | reduced-volume nasal + Control Pause | Not a replacement for asthma medication, Learn from qualified instructor first |
| 32 | Grounding Breath | — | therapeutic | calming | beginner | green | 4-0-6-0 + 5-4-3-2-1 sensory anchor | — |
| 33 | Stress Reset | — | therapeutic | calming | beginner | green | 3 physiological sighs in a row | — |
| 34 | Pain Management Breath | — | therapeutic | therapeutic | beginner | green | 4-0-6-0 with breath-to-pain visualization | — |
| 35 | Anti-Anxiety Breath | — | therapeutic | calming | beginner | green | 4-2-6-2 vagal activator | — |
| 36 | Sleep Preparation Breath | — | therapeutic | sleep | beginner | green | 4-7-8-0 lying in bed | — |
| 37 | Morning Energizer | — | goal_specific | energizing | beginner | green | 3-0-2-0 × 20, 2 rounds (strong inhale) | — |
| 38 | Pre-Workout Activation | — | goal_specific | performance | intermediate | yellow | 2-0-1-0 × 20, 2 rounds (Kapalabhati-lite) | High BP, Heart conditions |
| 39 | Between-Sets Recovery | — | goal_specific | recovery | beginner | green | 3-3-3-3 quick box, 3 cycles | — |
| 40 | Post-Workout Calm | — | goal_specific | recovery | beginner | green | 4-0-8-0 sympathetic→parasympathetic | — |
| 41 | Focus Breath | — | goal_specific | focus | beginner | green | 4-4-4-4 box × 5, pre-deep-work | — |
| 42 | Deep Sleep Induction | — | goal_specific | sleep | beginner | green | 4-0-8-0 with progressive body release | — |
| 43 | Appetite Control | — | goal_specific | therapeutic | beginner | green | 4-4-6-2 emotional-eating interrupt | — |
| 44 | Craving Interrupt | — | goal_specific | therapeutic | beginner | green | 5-5-5-5 slow box for craving cycle | — |
| 45 | Tummo | — | advanced | performance | advanced | red | 30 breaths + hold + inner-fire visualization | Requires proper training, Heart conditions, Pregnancy, Epilepsy, Psychiatric conditions |
| 46 | Kumbhaka | Kumbhaka | advanced | performance | advanced | red | 4-16-8-0 (1:4:2 traditional retention) | Heart conditions, High BP, Pregnancy, Glaucoma, Respiratory conditions |
| 47 | Holotropic Breathwork | — | advanced | therapeutic | advanced | red | continuous connected, 1–3 hours | Requires trained facilitator, Heart conditions, Epilepsy, Pregnancy, Psychiatric conditions, Glaucoma, Recent surgery |
| 48 | Rebirthing Breath | — | advanced | therapeutic | advanced | red | circular connected, no pause | Requires trained facilitator, Psychiatric conditions, Epilepsy, Pregnancy, Heart conditions |
| 49 | Apnea Training | — | advanced | performance | advanced | red | 4-30-4-0 progressive breath holds | NEVER practice near water, Heart conditions, Respiratory conditions, Fainting history |

---

## Anomalies / flags

- **Tradition value `goal_specific` is not in the spec's expected set** (`pranayama / western / therapeutic / performance / advanced`). 8 rows use `goal_specific` (rows 37–44). The spec doc should decide: (a) treat `goal_specific` as the canonical name for that bucket and update the expected-values list, or (b) rename to `performance` and reseed. No row in the actual data has `tradition='performance'`.
- **All `category` values conform** to the expected 7-value set (`energizing / calming / focus / sleep / performance / recovery / therapeutic`). No anomalies.
- **All `difficulty` values conform** to the expected 3-value set (`beginner / intermediate / advanced`). No anomalies.
- **No duplicate names.** All 49 names are unique.
- **Sanskrit-name coverage:** all 15 pranayama-tradition rows have a non-null `sanskrit_name`. Among non-pranayama rows, only `Kumbhaka` (advanced) carries one — appropriate since it is a Sanskrit term. Consistent; no action needed.
- **Semantic near-duplicate:** row 17 (`4-7-8 Breathing`, western/sleep) and row 36 (`Sleep Preparation Breath`, therapeutic/sleep) share the identical `4-7-8-0` protocol; row 36's notes explicitly say "Same as 4-7-8". They are framed differently (sit vs. lying-in-bed) and routed to different traditions, so it is intentional, but the S11-T2 tagging spec should treat them consistently for `pre_workout_compatible` / `post_workout_compatible` / `standalone_compatible`.
- **Other near-duplicates worth noting** for tagging consistency:
  - `2-to-1 Breathing` (22), `Extended Exhale` (24), `Post-Workout Calm` (40), `Deep Sleep Induction` (42) all share `4-0-8-0` ratio.
  - `Box Breathing` (16), `Sama Vritti` (12), `Focus Breath` (41) all share `4-4-4-4` ratio.
  - `5-5-5-5 Square Breathing` (27) and `Craving Interrupt` (44) share `5-5-5-5` ratio.
- **Capitalization:** mostly Title Case, but `4-7-8 Breathing`, `2-to-1 Breathing`, `5-5-5-5 Square Breathing`, `A52 Breath Method` deviate intentionally for technical names. Acceptable.

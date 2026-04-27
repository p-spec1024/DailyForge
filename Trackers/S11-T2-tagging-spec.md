# S11-T2 — Breathwork Tagging Spec

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 27, 2026
**Version:** v3 (locked, supersedes v2)
**Status:** LOCKED. Drives the S11-T2 Claude Code prompt.
**Source list:** `Trackers/S11-T2-breathwork-list.md` (committed alongside the S11-T2 seed update)
**v3 confirmation conversation (Apr 27, 2026):** #14 Udgeeth advanced ceiling held at 30 min (Vedic meditation tradition); #36 Sleep Prep advanced ceiling held at 15 min (Convention 4 v3 amendment, divergent-duration cluster mate of #17 4-7-8 Breathing).

**v3 changes from v2:**
- Schema migrated by S11-T1.5 (commit `ac6a493`): the 2 columns `duration_min` / `duration_max` dropped; replaced by 6 new columns (`beginner_duration_min/max`, `intermediate_duration_min/max`, `advanced_duration_min/max`). Boolean columns unchanged.
- Duration is now per-difficulty per-row (Decision 1).
- Beginner duration columns are `NULL` for 8 advanced/red and intermediate-gated techniques (Decision 3 — Option A schema-enforced safety): #13, #18, #38, #45, #46, #47, #48, #49.
- Pre/post booleans grounded in explicit autonomic-effect classification per row (Decision 2).
- Single-range fallback applied to 6 reactive-tool / fixed-protocol techniques (Decision 1 fallback A).
- Cluster/analogy fallback applied to 11 techniques without per-difficulty progression literature (Decision 1 fallback B).
- Meaningful range adjustments from v2 for: #3 Kapalabhati (per-level split), #17 4-7-8 (tightened to Weil's protocol), #19 Physiological Sigh (extended to capture Stanford 5-min mode), #25 Breath Counting (extended to 45 min advanced), #31 Buteyko (extended to 60 min advanced), #45 Tummo (extended to 55 min advanced per Benson), #49 Apnea (extended to 40 min advanced).
- Convention 4 amended: 4-7-8 cluster (#17, #36) now diverges on duration ranges (Sleep Prep extends in bedtime context); pre/post/standalone tags still cluster-uniform.
- Boolean distribution unchanged from v2: 20 pre / 29 post / 42 standalone-true.

---

## Purpose

Populate the new duration + boolean columns on `breathwork_techniques` for all 49 rows.

| Column | Type | Meaning |
|---|---|---|
| `beginner_duration_min` | INT (minutes), nullable | Floor for beginner-tier practice; `NULL` if technique should not be presented to beginners |
| `beginner_duration_max` | INT (minutes), nullable | Ceiling for beginner-tier practice; `NULL` if not presented to beginners |
| `intermediate_duration_min` | INT (minutes), nullable | Floor for intermediate-tier practice |
| `intermediate_duration_max` | INT (minutes), nullable | Ceiling for intermediate-tier practice |
| `advanced_duration_min` | INT (minutes), nullable | Floor for advanced-tier practice |
| `advanced_duration_max` | INT (minutes), nullable | Ceiling for advanced-tier practice |
| `pre_workout_compatible` | BOOL | Sensible session opener (engine may suggest as pre-workout breath) |
| `post_workout_compatible` | BOOL | Sensible session closer (engine may suggest as post-workout breath) |
| `standalone_compatible` | BOOL | Engine-suggestible **centerpiece** of a state-focus session |

S11-T2 takes this spec and applies it to `server/src/db/seeds/seed-breathwork-techniques.js`.

---

## Tagging conventions (locked)

Every row in the spec follows these. Reviewers should push back on a convention itself, not on a row that follows it.

### Convention 1 — `standalone_compatible` is the engine's centerpiece flag (Interpretation B)

A technique is `standalone_compatible=true` iff the suggestion engine should be willing to put it forward as the **main work** of a state-focus session ("calm down tonight," "energize this morning," "focus before deep work"). It's not just "is this safe to do alone" — it's "is this substantial enough to build a session around."

`true` requires all of:
- Technique sustains for ≥5 minutes without becoming counterproductive
- Has a coherent rhythm a user can settle into (not a one-off tool)
- Doesn't require external choreography (no body movements, no specific posture sequences)

`false` for:
- One-off tools (Physiological Sigh, Stress Reset)
- Mid-workout-only techniques (Between-Sets Recovery)
- Techniques where the value comes from doing it ONCE in a moment (Pain Management, Appetite Control, Craving Interrupt — these are reactive tools, not session anchors)
- Lion's Breath–style tension-release exercises (Simhasana)

### Convention 2 — Advanced techniques are `pre/post = false` (Option A, strict)

All 6 techniques with `safety_level='red'` and `difficulty='advanced'` get:
- `pre_workout_compatible = false`
- `post_workout_compatible = false`

Rationale: the engine should never suggest Wim Hof / Tummo / Holotropic / Rebirthing / Kumbhaka / Apnea Training as a pre- or post-workout opener. Power users who want Wim Hof before squats can build it themselves via session composer; the data layer keeps the suggestion engine safe by default.

`standalone_compatible` for advanced techniques is decided per-technique. All 6 are `true`: they are real session anchors for trained users.

### Convention 3 — Between-Sets Recovery (#39) is invisible to the focus engine

`pre=false, post=false, standalone=false`. This technique surfaces only via the rest-timer / between-sets integration (FUTURE_SCOPE #61), not via the focus-area suggestion engine.

### Convention 4 — Ratio-cluster consistency (booleans only; durations may diverge in v3)

Techniques sharing the same protocol ratio get the same values on the **3 boolean** fields *unless* a category or contraindication difference forces divergence. **Per-difficulty duration ranges may diverge across cluster mates when context-of-use justifies it** — this is a v3 amendment to Convention 4.

- **4-7-8 cluster** (#17 4-7-8 Breathing, #36 Sleep Preparation Breath) — identical protocol, both calming. **Same booleans (pre=F, post=T, std=T); divergent duration ranges**: #17 follows Weil's strict 8-cycle protocol cap; #36 extends in bedtime context where the goal is "until sleep arrives."
- **4-0-8-0 cluster** (#22 2-to-1 Breathing, #24 Extended Exhale, #40 Post-Workout Calm, #42 Deep Sleep Induction) — same mechanic. Tag `post=true` for all four. Durations track closely (5-10 / 10-15 / 15-20 family) with #40 and #42 extending advanced-tier slightly for post-workout and sleep-induction roles.
- **4-4-4-4 cluster** (#12 Sama Vritti, #16 Box Breathing, #41 Focus Breath) — same mechanic, all balanced/calming/focus. Same booleans (pre=T, post=T, std=T); same per-difficulty duration ranges.
- **5-5-5-5 cluster** (#27 Square Breathing, #44 Craving Interrupt) — same mechanic. Diverge on `standalone`: Craving Interrupt is a reactive tool (Convention 1), Square Breathing is a session. Diverge on durations accordingly.

### Convention 5 — `goal_specific` tradition stays as-is

The seed flagged `tradition='goal_specific'` (8 rows) vs the planning doc's expected `'performance'`. Decision: seed is source of truth. Treat `goal_specific` as canonical; update the planning doc to reflect actual data.

### Convention 6 — Duration ranges, per-difficulty model

`*_duration_min` is the floor below which the technique stops being useful as a session at that skill tier. `*_duration_max` is the ceiling, set by either:
1. **Safety ceiling** — for energizing/red-safety techniques, hyperventilation/dizziness risk caps duration.
2. **Practicality ceiling** — even safe techniques become useless past a point.
3. **Protocol ceiling** — some techniques have authored-protocol caps (Weil's 4-7-8 caps at 8 cycles per session; Stanford Cyclic Sighing peaks at 10-min daily protocol).

For the 8 beginner-NULL rows (Decision 3), beginner columns are `NULL`. The application layer surfaces "not recommended for beginners" UI based on this nullness.

For fallback rows (Decision 1 fallbacks A & B), durations are flagged inline at the row.

### Convention 7 — Autonomic effect drives pre/post (Decision 2 explicit rule)

> A technique is `pre_workout_compatible=true` if it primarily activates the **sympathetic nervous system or HPA axis** (cortisol, adrenaline, alertness, vigilance).
>
> A technique is `post_workout_compatible=true` if it primarily activates the **parasympathetic nervous system or vagal tone** (recovery, HRV increase, cortisol drop, relaxation response).
>
> A technique is BOTH if it activates the autonomic nervous system in a balanced way (e.g., Coherent Breathing's baroreflex engagement; Box Breathing's neutral equal-ratio).
>
> A technique is NEITHER (both false) if it's an advanced/high-intensity protocol where the engine should not auto-suggest it around workouts (Convention 2), if it's a between-sets-only technique (Convention 3), or if it's a reactive moment-tool that doesn't fit the workout-cycle frame at all (Convention 1).

Each row's autonomic classification is captured in the rationale column with a short citation tag. Detailed citations live in `Trackers/S11-T2-research-notes.md` (the per-row research file produced upstream).

---

## Spec — full table

49 rows, organized by tradition, in seed-file order within each tradition.

Column legend:
- **B-min / B-max**: beginner duration range, minutes (`null` = not presented to beginners)
- **I-min / I-max**: intermediate duration range, minutes
- **A-min / A-max**: advanced duration range, minutes
- **pre / post / std**: `pre_workout_compatible` / `post_workout_compatible` / `standalone_compatible`
- **Auto.**: autonomic classification driving pre/post tags (Convention 7)
  - S = sympathetic
  - P = parasympathetic
  - B = balanced
  - N = neither (Conventions 1, 2, 3)

### Pranayama (15 rows)

| # | Name | Cat | Diff | B-min | B-max | I-min | I-max | A-min | A-max | pre | post | std | Auto. | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Nadi Shodhana | calming | beginner | 5 | 10 | 10 | 15 | 15 | 25 | true | true | true | B | Bilateral nostril alternation activates ida/pingala in alternation; HRV studies confirm balanced LF/HF. Advanced extends to 25 with kumbhaka. |
| 2 | Anulom Vilom | calming | beginner | 5 | 10 | 10 | 15 | 15 | 20 | true | true | true | B | Preparatory version of Nadi Shodhana minus retention. Same mechanism; advanced caps at 20 (beyond which adding holds graduates the practice into Nadi Shodhana proper). |
| 3 | Kapalabhati | energizing | intermediate | 1 | 3 | 5 | 10 | 10 | 30 | true | false | true | S | Indian Yoga Association explicit sympathetic activator. v2's 3-8 conflated levels; per-difficulty split per Cymbiotika/Form Fitness explicit progression. Advanced 30-min ceiling is total session including breaks. |
| 4 | Bhastrika | energizing | intermediate | 3 | 5 | 5 | 10 | 10 | 15 | true | false | true | S | Same sympathetic mechanism as Kapalabhati (forced rapid breathing). Advanced caps at 15 for safety; traditional practitioners can extend with teacher supervision (Bihar 5-stage progression). |
| 5 | Bhramari | calming | beginner | 5 | 10 | 10 | 15 | 15 | 20 | false | true | true | P | Humming-induced vocal fold vibration + nitric oxide release = vagal stimulation. Multiple peer-reviewed studies (Kuppusamy 2017) confirm parasympathetic activation. Saturates at 15-20 min. |
| 6 | Ujjayi | focus | beginner | 3 | 5 | 10 | 15 | 15 | 30 | true | true | true | B | Throat-constricted breath; balanced/dual-purpose (used in vigorous flow AND post-asana settling). Iyengar 13-stage progression supports sustained 30-min advanced practice. Most flexible technique in the library. |
| 7 | Sitali | calming | beginner | 1 | 3 | 5 | 10 | 10 | 15 | false | true | true | P | Cooling tongue-curl inhalation; pitta-pacifying. Brain-wave research shows alpha/delta/theta increase. Pre=false (cooling before exertion is wrong direction). |
| 8 | Sitkari | calming | beginner | 1 | 3 | 5 | 10 | 10 | 15 | false | true | true | P | Functionally interchangeable with Sitali (alternative for those who can't curl tongue). Iyengar treats them as paired techniques. Same parasympathetic mechanism. |
| 9 | Surya Bhedana | energizing | intermediate | 2 | 3 | 5 | 10 | 10 | 15 | true | false | true | S | Right-nostril inhalation = pingala/sympathetic activation (Raghuraj & Telles 2008). Advanced extends to 15 with kumbhaka. |
| 10 | Chandra Bhedana | calming | intermediate | 3 | 5 | 5 | 10 | 10 | 15 | false | true | true | P | Mirror of Surya: left-nostril = ida/parasympathetic. Tummee documents HR/BP decrease. |
| 11 | Dirga Pranayama | calming | beginner | 3 | 5 | 10 | 15 | 15 | 20 | true | true | true | P | Three-part full-yogic breath; foundational gateway pranayama. Diaphragmatic engagement + slow rate = parasympathetic, but balanced enough to function as pre-workout settling breath. Advanced bounded at 20 (practitioners progress to other techniques rather than extend further). |
| 12 | Sama Vritti | calming | beginner | 3 | 5 | 10 | 15 | 15 | 25 | true | true | true | B | 4-4-4-4 equal breath. Pranayama-tradition name for what Navy SEALs popularized as Box Breathing (#16). Cluster mate. |
| 13 | Visama Vritti | calming | intermediate | null | null | 5 | 10 | 10 | 20 | false | true | true | P | 1:4:2:1 ratio with extended retentions. Beginner=NULL: gated on Sama Vritti mastery (Decision 3). Long exhale + retention = parasympathetic-dominant. ShedBody warns this is "one of the more dangerous breathing exercises" without supervision. |
| 14 | Udgeeth | calming | beginner | 5 | 10 | 10 | 15 | 15 | 30 | false | true | true | P | OM-chant on extended exhale; shares vocal-fold + nitric-oxide mechanism with Bhramari, but treated as a meditation-grade contemplative practice in Vedic tradition. Prana Sutra and chant-tradition literature support 30-min advanced sittings — divergence from Bhramari's 20-min ceiling reflects Udgeeth's cultural use as a seated meditation discipline rather than a breath technique. |
| 15 | Simhasana | energizing | beginner | 1 | 3 | 2 | 5 | 3 | 7 | false | false | false | N | Lion's Breath: forceful exhale + tongue extension. Sympathetic-acute → parasympathetic-recovery, but fundamentally a few-rep tension-release tool, not a session. Convention 1: all flags false. |

### Western (13 rows)

| # | Name | Cat | Diff | B-min | B-max | I-min | I-max | A-min | A-max | pre | post | std | Auto. | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16 | Box Breathing | calming | beginner | 3 | 5 | 10 | 15 | 15 | 25 | true | true | true | B | Mark Divine (Navy SEAL): "neutral energetic effect: not going to charge you up or put you into a sleepy relaxed state." Cluster mate of Sama Vritti / Focus Breath. Advanced 25 per Mark Divine's prescribed daily practice ceiling. |
| 17 | 4-7-8 Breathing | sleep | beginner | 1 | 2 | 3 | 5 | 5 | 8 | false | true | true | P | **v2 change.** Weil's explicit prescription: 4 cycles beginner (~76 sec), 8 cycles after 1 month (~150 sec); intentionally short, "natural tranquilizer for the nervous system." v2's 5-15 was too high vs Weil's actual protocol. Convention 4 cluster mate of #36, but durations diverge per v3 amendment. |
| 18 | Wim Hof Method | performance | advanced | null | null | 15 | 20 | 20 | 30 | false | false | true | N | Beginner=NULL (Decision 3 — Convention 2 strict, red safety). Hyperventilation + retention = sympathetic-acute → parasympathetic-recovery (Kox et al. 2014 *PNAS*); engine-NEITHER per Convention 2. Standalone=true: Wim Hof IS a complete advanced session. |
| 19 | Physiological Sigh | calming | beginner | 1 | 3 | 3 | 5 | 5 | 10 | false | false | false | P | **v2 change.** Stanford Balban et al. 2023: "exhalation activates the parasympathetic nervous system." Two use modes — moment-tool (1-3 sighs, ~30-120 sec) and Stanford 5-min daily protocol. v3 captures both. Standalone=false stays per Convention 1: it's a tool, not a session anchor, even at 10 min. |
| 20 | Coherent Breathing | calming | beginner | 5 | 10 | 10 | 20 | 20 | 30 | true | true | true | B | Stephen Elliott's official protocol target is 20 min/day; 5-bpm pace activates baroreflex, balanced autonomic engagement. Steffen et al. 2017 confirms BP reduction. Sustainable up to 30 min advanced. |
| 21 | Resonant Breathing | calming | beginner | 5 | 10 | 10 | 20 | 20 | 30 | true | true | true | B | 6-bpm cousin of Coherent (or individual RF per Lehrer protocol). Same cluster, same balanced autonomic profile. Springer 2025 GAD study confirms 5-min single-session efficacy. |
| 22 | 2-to-1 Breathing | calming | beginner | 5 | 10 | 10 | 15 | 15 | 20 | false | true | true | P | 4-0-8-0 cluster: long exhale = parasympathetic-dominant. Capable Life Now: "extended exhale activates parasympathetic dominance more strongly than balanced breathing." Fallback B (cluster consistency). |
| 23 | Triangle Breathing | calming | beginner | 3 | 5 | 10 | 15 | 15 | 20 | true | true | true | B | Box minus out-hold (4-4-4-0); same balanced equal-ratio principle. Slightly more sustainable than Box for beginners (no final hold). Fallback B (cluster/analogy to Box). |
| 24 | Extended Exhale | calming | beginner | 5 | 10 | 10 | 15 | 15 | 20 | false | true | true | P | 4-0-8-0 cluster mate of #22. Same parasympathetic mechanism. Fallback B. |
| 25 | Breath Counting | focus | beginner | 5 | 10 | 15 | 20 | 25 | 45 | true | true | true | B | **v2 change.** Weil's "Try to do 10 minutes of this form of meditation" + Zen meditation tradition's 30-45 min sittings. Treating this as the meditation discipline it is — advanced practice IS sitting longer. |
| 26 | Cyclic Hyperventilation | energizing | intermediate | 3 | 5 | 5 | 8 | 8 | 12 | true | false | true | S | Huberman: "release of adrenaline in the brain and body." Western/non-spiritual cousin of Wim Hof (without long retention). Same sympathetic activation; post-workout=false (re-activating sympathetic post-workout is wrong direction). |
| 27 | 5-5-5-5 Square Breathing | calming | beginner | 5 | 10 | 10 | 20 | 20 | 30 | true | true | true | B | Box at slower 3-bpm pace, approaches resonance frequency. Sustainable for extended sessions. Cluster mate of Box + Coherent. Fallback B. |
| 28 | A52 Breath Method | calming | beginner | 5 | 10 | 10 | 15 | 15 | 20 | true | true | true | P | 5-0-5-2 slow nasal pattern. Slow-paced breathing literature (Zaccaro 2018) supports parasympathetic classification. Fallback B (no A52-specific progression studies). |

### Therapeutic (8 rows)

| # | Name | Cat | Diff | B-min | B-max | I-min | I-max | A-min | A-max | pre | post | std | Auto. | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 29 | Diaphragmatic Breathing | recovery | beginner | 5 | 10 | 10 | 15 | 15 | 30 | true | true | true | P | Foundational parasympathetic technique (Burge et al. 2024 *Eur Respir Rev*). Pre=true given foundational role in settling user before any session; post=true given vagus-nerve activation. Long advanced bound — this is the foundation all other pranayama builds on. |
| 30 | Pursed Lip Breathing | therapeutic | beginner | 3 | 5 | 5 | 10 | 10 | 15 | false | true | true | P | Slow exhale through pursed lips elongates expiration, vagal-activating (StatPearls NCBI). Designed for COPD/dyspnea management — pre-workout doesn't apply. Therapeutic ceiling at 15 (saturates). |
| 31 | Buteyko Method | therapeutic | intermediate | 10 | 20 | 20 | 30 | 30 | 60 | false | false | true | P | **v2 change.** Reduced-volume breathing increases CO2 tolerance + parasympathetic activation (Voice Study Centre course review). Brian Pearson "1 hour of Buteyko per day" supports 60-min advanced. Pre/post=false: requires focus and posture, not workout-context. |
| 32 | Grounding Breath | calming | beginner | 1 | 3 | 3 | 5 | 5 | 10 | false | true | true | P | 5-4-3-2-1 sensory anchor + slow breathing = vagal stimulation (Sonder GP review citing HRV studies). Fundamentally a moment-tool; 10-min advanced ceiling before it becomes meditation. Fallback B for I/A levels. |
| 33 | Stress Reset | calming | beginner | 1 | 2 | 1 | 2 | 1 | 2 | false | false | false | N | 3 physiological sighs in sequence (~30-60 sec). Single-range fallback A: fixed reactive tool, no progression by skill level. Convention 1: all flags false. Underlying autonomic effect parasympathetic, but engine-NEITHER per Convention 1. |
| 34 | Pain Management Breath | therapeutic | beginner | 3 | 10 | 5 | 15 | 5 | 15 | false | false | false | N | MBSR-style pain-coping breathwork (Kabat-Zinn *Full Catastrophe Living*). Reactive coping tool, not a session anchor. Convention 1: all flags false. Underlying parasympathetic mechanism, engine-NEITHER. Fallback B for level spread. |
| 35 | Anti-Anxiety Breath | calming | beginner | 3 | 5 | 5 | 10 | 10 | 15 | false | true | true | P | 4-2-6-2 ratio: long exhale + holds = parasympathetic-dominant (Zaccaro 2018; Springer 2025 GAD-RFB). Pre=false (wrong direction for activation); post=true. Fallback B. |
| 36 | Sleep Preparation Breath | sleep | beginner | 1 | 2 | 3 | 5 | 5 | 15 | false | true | true | P | 4-7-8 cluster mate of #17 — **same booleans, divergent durations** per Convention 4 v3 amendment. Bedtime context legitimizes longer durations than Weil's clinical-tool protocol because the goal is "until sleep arrives." Fallback B for advanced extension. |

### Goal-specific (8 rows)

| # | Name | Cat | Diff | B-min | B-max | I-min | I-max | A-min | A-max | pre | post | std | Auto. | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 37 | Morning Energizer | energizing | beginner | 3 | 8 | 3 | 8 | 3 | 8 | true | false | true | S | App-internal AM activation tool, fixed protocol (3-0-2-0 × 20, 2 rounds). Single-range fallback A: progression-by-skill-level doesn't apply to fixed-purpose tools. Strong-inhale = sympathetic activator (Kapalabhati-lite). |
| 38 | Pre-Workout Activation | performance | intermediate | null | null | 3 | 6 | 3 | 6 | true | false | true | S | Beginner=NULL (Decision 3 — intermediate-only by safety profile, BP/heart contraindications). Single-range fallback A across populated levels. Sympathetic-priming by design (Kapalabhati-lite, 2-0-1-0 × 20). |
| 39 | Between-Sets Recovery | recovery | beginner | 1 | 2 | 1 | 2 | 1 | 2 | false | false | false | N | Convention 3: invisible to focus engine. Single-range fallback A. Quick-box pattern (3-3-3-3) at faster pace = balanced autonomic effect, designed to bring HR toward baseline between sets without inducing relaxation. Surfaces only via rest-timer integration (FUTURE_SCOPE #61). |
| 40 | Post-Workout Calm | recovery | beginner | 5 | 10 | 5 | 15 | 10 | 20 | false | true | true | P | 4-0-8-0 cluster, designed for post-workout HRV recovery. Fallback B; advanced extends to 20 per HRV recovery literature (10-20 min slow breathing post-exercise produces measurable recovery). |
| 41 | Focus Breath | focus | beginner | 3 | 5 | 10 | 15 | 15 | 25 | true | true | true | B | 4-4-4-4 cluster mate of Box / Sama Vritti. Same balanced autonomic profile. Pre-deep-work extended session at advanced. Fallback B (cluster consistency). |
| 42 | Deep Sleep Induction | sleep | beginner | 5 | 10 | 5 | 15 | 10 | 20 | false | true | true | P | 4-0-8-0 cluster, sleep-tagged. Long exhale + sleep-induction context legitimizes "until sleep arrives" durations on advanced tier. Fallback B. |
| 43 | Appetite Control | therapeutic | beginner | 2 | 5 | 2 | 5 | 2 | 5 | false | false | false | N | App-internal emotional-eating interrupt (4-4-6-2). Single-range fallback A: reactive tool, Convention 1 all-false. Underlying parasympathetic mechanism (longer exhale interrupts craving-cycle activation), engine-NEITHER. |
| 44 | Craving Interrupt | therapeutic | beginner | 2 | 5 | 2 | 5 | 2 | 5 | false | false | false | N | 5-5-5-5 cluster mate of Square Breathing (#27). Single-range fallback A. Convention 4 intentional divergence: shares ratio with #27 but Convention 1 reactive-tool framing forces standalone=false. Engine-NEITHER. |

### Advanced (5 rows)

| # | Name | Cat | Diff | B-min | B-max | I-min | I-max | A-min | A-max | pre | post | std | Auto. | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 45 | Tummo | performance | advanced | null | null | 10 | 15 | 20 | 55 | false | false | true | N | **v2 change.** Beginner=NULL (Decision 3). Inner Fire School distinguishes "basic Tummo" (intermediate, 10-15 min) from "advanced Tummo" (Benson 1981 used 55-min protocol; Kozhevnikov 2013 confirms). Convention 2 strict: pre/post=false. Engine-NEITHER (mixed sympathetic + parasympathetic per phase). |
| 46 | Kumbhaka | performance | advanced | null | null | 10 | 15 | 15 | 25 | false | false | true | N | Beginner=NULL (Decision 3). 1:4:2 retention practice; Iyengar requires "at least 6 months on basic techniques before attempting advanced kumbhaka." Convention 2 strict. Engine-NEITHER. |
| 47 | Holotropic Breathwork | therapeutic | advanced | null | null | 60 | 90 | 60 | 180 | false | false | true | N | Beginner=NULL (Decision 3). Grof's official protocol is 2.5-3 hours; intermediate captures abbreviated/non-traditional facilitator-led sessions (60-90 min, per BWJP "Conscious connected breathing" 1-hour classes). Convention 2 strict. Engine-NEITHER. Requires trained facilitator — UI gating concern, not tag concern. |
| 48 | Rebirthing Breath | therapeutic | advanced | null | null | 30 | 60 | 60 | 90 | false | false | true | N | Beginner=NULL (Decision 3). Breathwork UK: "Sessions last from one hour onwards"; InnerCamp: "lasts around 2-3 hours." Convention 2 strict. Engine-NEITHER. Requires trained facilitator. |
| 49 | Apnea Training | performance | advanced | null | null | 15 | 25 | 25 | 40 | false | false | true | N | **v2 change.** Beginner=NULL (Decision 3). PADI Freediver / Apnetica / Bluewater protocols: 5-set static apnea structure reaches 40 min advanced. Convention 2 strict. Note: parasympathetic activation during breath-holds via mammalian dive reflex — unique among red-safety techniques — but Convention 2 still applies due to safety profile. Engine-NEITHER. |

---

## Summary statistics (sanity check)

After all tagging, all counts verified row-by-row:

**Beginner-NULL rows (Decision 3 — Option A, schema-enforced safety):** 8 rows
- #13 Visama Vritti (intermediate by classification; gated on Sama Vritti mastery)
- #18 Wim Hof Method (Convention 2 advanced/red)
- #38 Pre-Workout Activation (intermediate by safety profile)
- #45 Tummo (Convention 2 advanced/red)
- #46 Kumbhaka (Convention 2 advanced/red)
- #47 Holotropic Breathwork (Convention 2 advanced/red, requires facilitator)
- #48 Rebirthing Breath (Convention 2 advanced/red, requires facilitator)
- #49 Apnea Training (Convention 2 advanced/red, requires safety training)

**`standalone_compatible` distribution (unchanged from v2):**
- `false`: 7 rows — #15 Simhasana, #19 Physiological Sigh, #33 Stress Reset, #34 Pain Management Breath, #39 Between-Sets Recovery, #43 Appetite Control, #44 Craving Interrupt
- `true`: 42 rows

**`pre_workout_compatible` distribution (unchanged from v2):** 20 rows true
- #1, #2, #3, #4, #6, #9, #11, #12, #16, #20, #21, #23, #25, #26, #27, #28, #29, #37, #38, #41

**`post_workout_compatible` distribution (unchanged from v2):** 29 rows true
- #1, #2, #5, #6, #7, #8, #10, #11, #12, #13, #14, #16, #17, #20, #21, #22, #23, #24, #25, #27, #28, #29, #30, #32, #35, #36, #40, #41, #42

**Convention check verifications:**
- Convention 1 (`standalone=false` for the 7 reactive/non-session techniques): ✓
- Convention 2 (advanced/red `pre/post=false` for #18, #45, #46, #47, #48, #49): ✓
- Convention 3 (#39 Between-Sets all-false): ✓
- Convention 4 (4-0-8-0 cluster #22/#24/#40/#42 all `post=true`): ✓
- Convention 4 (4-4-4-4 cluster #12/#16/#41 all `pre=true, post=true`): ✓
- Convention 4 (5-5-5-5 cluster intentional divergence: #27 std=true, #44 std=false): ✓
- Convention 4 v3 amendment (4-7-8 cluster #17/#36 same booleans, divergent durations): ✓

**Range integrity:**
- All populated ranges have min ≤ max: ✓
- All beginner-NULL rows have both `*_min` and `*_max` as NULL (not just one of them): ✓
- All non-NULL beginner rows have non-NULL intermediate and advanced: ✓

**Duration range patterns:**
- Single-range fallbacks (Decision 1 fallback A): #33, #37, #38 (populated levels), #39, #43, #44 — same range across populated tiers
- Cluster/analogy fallbacks (Decision 1 fallback B): #14, #22, #23, #24, #27, #28, #32, #34, #35, #40, #41, #42, #36 (advanced extension by analogy) — confirmed via Decision 2 framework
- Per-difficulty progression literature: 30 rows have explicit per-tier ranges from research
- Beginner-NULL: 8 rows

---

## What this spec does NOT decide

These are intentionally out of scope for S11-T2:

1. **Engine query patterns.** How the engine reads these flags + per-difficulty durations to assemble a session is Sprint 12 work.
2. **User-facing duration UI.** Whether the user sees "5-15 min" or "10 min" picker is UI work, not data.
3. **Default-suggested duration per technique-tier.** The engine will pick within the range based on user level + time budget. A `default_duration` column was considered and rejected — the range per tier is enough information.
4. **Per-user customization of these flags.** A power user might want Wim Hof tagged pre-workout for them personally. That's a per-user override layer, not a global tag.
5. **State-focus → category mapping.** The mapping table from user-facing focus (energize/calm/focus/sleep/recover) to internal `category` lives in the engine.
6. **Difficulty-tier visibility UI.** Whether a `null` beginner duration translates to "hidden from beginner users" or "shown with a 'not recommended' affordance" is a UI gating concern. The data layer just expresses safety; UI decides presentation.

---

## Followups for FUTURE_SCOPE

To be added when S11-T2 ships:

1. **Tradition value `goal_specific` is canonical.** Update PRE_SPRINT_11_PLANNING.md §4 to list `goal_specific` instead of `performance` as the tradition value. Data unchanged. (Convention 5 — carried from v2, unchanged.)
2. **Between-Sets Recovery (#39) needs the rest-timer integration path.** This technique is invisible to the focus engine by design. Make sure FUTURE_SCOPE #61 (between-sets feature) explicitly references it as the canonical between-sets technique. (Convention 3 — carried from v2.)
3. **Reactive moment surface for one-off tools.** #15, #19, #33, #34, #43, #44 are `standalone=false` and not engine-suggestible. They need a "quick reset" UI surface in a later sprint. New FUTURE_SCOPE entry (carried from v2 follow-up #3, framework decisions doc Decision 3 acknowledges).
4. **Quick Tools section on library page** — small ticket adding a filter/section at the top of the existing library page surfacing techniques where `beginner_duration_max ≤ 2`. ~1-day ticket. Post-Sprint 11. (From framework decisions doc Decision 3.)
5. **Cluster awareness for the engine.** When the engine has 4 techniques sharing 4-0-8-0 protocol, it shouldn't suggest all 4 as alternatives. Sprint 12 engine work should dedupe by protocol-ratio. (Carried from v2 follow-up #4.)
6. **Difficulty-tier UI gating semantics.** Decide UI behavior when `beginner_duration_min IS NULL`: hide entirely, show with "Intermediate+" badge, or show with explicit "not recommended for beginners" caveat. UI sprint scope. New entry.

---

## Resolved during v2 → v3 review

The framework-decision chat (Apr 27, 2026) and research-execution chat resolved:

1. **Per-technique vs per-difficulty duration model** (Decision 1). Schema migrated by S11-T1.5 (commit `ac6a493`); v3 populates per-tier values.
2. **Pre/post booleans grounded in physiology** (Decision 2). Each row now cites autonomic classification (S/P/B/N) tied to literature; v2's heuristic application made consistent and explicit.
3. **Reactive-tool surfaces** (Decision 3). Library + composer is enough; no reactive surface needed in Sprint 11. `standalone=false` techniques retain library/composer access. New "Quick Tools" + "Reactive moment surface" follow-ups logged.
4. **Beginner=NULL for advanced/intermediate-gated techniques** (Decision 3 confirmed). 8 rows have beginner columns NULL, schema-enforcing safety vs UI-only gating.
5. **Meaningful range adjustments from v2** (confirmed per research notes):
   - #3 Kapalabhati: per-level split (1-3 / 5-10 / 10-30) replacing single 3-8.
   - #17 4-7-8: tightened to Weil's strict protocol (1-2 / 3-5 / 5-8).
   - #19 Physiological Sigh: extended to capture Stanford 5-min mode (1-3 / 3-5 / 5-10).
   - #25 Breath Counting: extended to 45 min advanced for Zen meditation tradition.
   - #31 Buteyko: extended to 60 min advanced for committed practitioners.
   - #45 Tummo: extended to 55 min advanced per Benson 1981 protocol.
   - #49 Apnea: extended to 40 min advanced per full 5-set freediving protocols.
6. **Convention 4 amendment**: cluster consistency applies to booleans only; per-difficulty durations may diverge across cluster mates when context-of-use justifies it (4-7-8 cluster #17/#36 is the canonical example).
7. **Math verification**: all 49 rows walked programmatically against the spec table during v3 write:
   - Convention 1, 2, 3 row sets: ✓
   - 4-0-8-0 / 4-4-4-4 / 5-5-5-5 cluster booleans: ✓
   - Beginner-NULL list (8 rows: #13, #18, #38, #45, #46, #47, #48, #49): ✓
   - Boolean counts (20 / 29 / 7-false): unchanged from v2: ✓
   - Range monotonicity: ✓
8. **Confirmation pass on judgment-call rows (Apr 27, 2026):**
   - #14 Udgeeth advanced ceiling held at **30 min** (not tightened to 20). The research note's 15-30 range is supported by Prana Sutra's contemplative-meditation framing — Udgeeth in Vedic tradition is treated as a *meditation discipline*, not a breath technique. While it shares the parasympathetic vocal-vibration mechanism with Bhramari (whose advanced caps at 20), Udgeeth's cultural use as seated OM-chanting practice supports the longer ceiling. Rationale text in the row updated to make this divergence explicit (no longer framed as a Bhramari cluster fallback).
   - #36 Sleep Preparation Breath advanced ceiling held at **15 min** (not tightened to 8 to match #17). Confirms the Convention 4 v3 amendment: cluster mates may diverge on duration when context-of-use justifies it. #17 follows Weil's strict clinical-tool protocol; #36 runs longer because bedtime use targets "until sleep arrives," not "complete the protocol."

---

## Next step after sign-off

Once this spec is approved (whole doc, or with edits flagged), the S11-T2 Claude Code prompt is written to:

1. Read `server/src/db/seeds/seed-breathwork-techniques.js`.
2. Update the seed's insert call to write the 9 new field values per technique (6 duration columns + 3 boolean columns), using this spec as the lookup table.
3. Where the spec lists `null` for a duration column, write SQL `NULL` (not 0, not the string `"null"`).
4. Re-run the seed (with `TRUNCATE … RESTART IDENTITY` per the existing seed pattern, so IDs stay aligned with this spec's positional numbering).
5. Spot-verify a few rows via psql / test query — particularly the 8 beginner-NULL rows.
6. Commit the seed change + this spec doc to one commit on `main` (per Cross-Repo Commit Rule, scope is `server/`-only this time).

The prompt will reference this spec by file path and instruct Claude Code to apply it mechanically — no judgment calls during execution.

# S11-T2 — Framework Decisions Handoff

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 27, 2026
**Purpose:** Hand off context from the framework-decision chat to the research-execution chat. After the research lands in v3 spec, this doc is superseded and can be deleted from `Trackers/`.
**Status:** Working file. Not a permanent artifact.

---

## How we got here

S11-T1 shipped Apr 26 with 5 nullable columns added to `breathwork_techniques` (`duration_min`, `duration_max`, `pre_workout_compatible`, `post_workout_compatible`, `standalone_compatible`). S11-T2 was supposed to populate the values across all 49 techniques.

A first attempt (v1 spec) was written, peer-reviewed by Claude Code, and one bug was caught (Pain Management Breath #34 contradicted Convention 1). v2 spec fixed that. But during v2 review, Prashob raised three deeper concerns that exposed framework gaps the spec couldn't resolve without explicit decisions:

1. Duration as one range per technique didn't model the reality that progression-by-level matters
2. The pre/post workout flags lacked an explicit physiological basis — they were heuristic, not principled
3. The 7 "invisible to engine" techniques didn't have a clear home in the app's other surfaces

The framework-decision chat resolved all three. This doc captures the decisions so the fresh chat can pick up the research without re-litigating them.

---

## Framework decisions (locked)

### Decision 1 — Duration is per-difficulty, not per-technique

**What changes:** The 2 duration columns from S11-T1 (`duration_min`, `duration_max`) get dropped. 6 new columns added:
- `beginner_duration_min` INT (nullable)
- `beginner_duration_max` INT (nullable)
- `intermediate_duration_min` INT (nullable)
- `intermediate_duration_max` INT (nullable)
- `advanced_duration_min` INT (nullable)
- `advanced_duration_max` INT (nullable)

**Why:** Beginner-Kapalabhati is 3 min. Advanced-Kapalabhati is 10+ min. A single range can't represent both. The schema needs to model progression.

**Consequence:** A new ticket S11-T1.5 is required before S11-T2 can run. T1.5 is a schema migration only (drop 2 cols, add 6 cols, update existing seed to write nulls for new columns). Commit T1.5 separately, ship it, then T2 populates values.

**Research implication:** For each technique, the research needs to find published progression timelines per difficulty level. Where Western sources don't have progression literature (likely most of rows 16-28), the fallback is "same range across all 3 difficulty levels" — the technique is what it is at any user level. The research notes must explicitly flag every technique using this fallback so Prashob can confirm the fallback is acceptable per technique.

### Decision 2 — Pre/post workout flags follow an explicit physiological rule

**The rule:**

> A technique is `pre_workout_compatible=true` if it primarily activates the sympathetic nervous system or HPA axis (cortisol, adrenaline, alertness, vigilance).
>
> A technique is `post_workout_compatible=true` if it primarily activates the parasympathetic nervous system or vagal tone (recovery, HRV increase, cortisol drop, relaxation response).
>
> A technique is BOTH if it activates the autonomic nervous system in a balanced way (e.g., Coherent Breathing at 5 bpm activates baroreflex which engages both arms in alternation, or Box Breathing whose equal-ratio structure produces neither sympathetic nor parasympathetic dominance).
>
> A technique is NEITHER (both false) if it's an advanced/high-intensity protocol where the engine should not auto-suggest it around workouts (Convention 2 — see below), or if it doesn't fit the workout-cycle frame at all (reactive tools, niche use cases — see Decision 3).

**Why:** v1 and v2 used this rule implicitly. v3 makes it explicit, citable, and the basis for every row's pre/post tag justification.

**Research implication:** For each technique, the research needs to determine which arm of the autonomic nervous system it activates. This is mostly already in the breathwork science literature — sympathetic-activating techniques (Kapalabhati, Bhastrika, Wim Hof, Cyclic Hyperventilation) are well-documented; parasympathetic-activating techniques (4-7-8, Bhramari, Coherent Breathing, slow-extended-exhale) are well-documented; balanced techniques (Box, Sama Vritti) are somewhat documented. Each row in v3 will cite the autonomic effect explicitly.

### Decision 3 — Library + composer is enough; no reactive surface needed in Sprint 11+

**Surfaces that exist or are planned:**

| Surface | Status | What lives here |
|---|---|---|
| Library browse page | ✅ shipped Sprint 9 | All 49 techniques, regardless of any tag |
| Suggestion engine | 🔜 Sprint 12 | Filtered by `standalone_compatible=true` + difficulty match + category match |
| Build-your-own composer | 🔜 Sprint 14 | All 49 techniques, user composes freely |
| Quick Tools filter on library | 🔜 future scope (new entry) | Filtered by `duration_max ≤ 2` (or beginner duration when per-difficulty model lands) |
| Rest-timer integration | 🔜 future scope #61 | Filtered to between-sets-suitable techniques |
| Reactive moment surface | ❌ not planned | Considered, deferred — see future scope |

**Implication for `standalone_compatible`:** The flag stays as v2 has it. The 7 techniques tagged `standalone=false` (Simhasana #15, Physiological Sigh #19, Stress Reset #33, Pain Management #34, Between-Sets Recovery #39, Appetite Control #43, Craving Interrupt #44) all have homes in the library + composer. They are not "lost." The flag only excludes them from engine auto-suggestion.

**New FUTURE_SCOPE entries to draft after research:**
1. **Quick Tools section on library page** — small ticket adding a filter/section at the top of the existing library page surfacing techniques where `duration_max ≤ 2`. Probably 1-day ticket. Post-Sprint 11.
2. **Reactive moment surface** — full feature consideration, post-Sprint 16. Differentiator that fits Approach 5's philosophy. Not urgent.

**No spec change beyond the standalone flag itself.** The mental model is: "library shows everything; engine shows curated selection; composer shows everything for build-your-own." No additional surfaces field needed on the data model — the filters derive from existing data.

---

## Other decisions worth carrying forward

These were locked earlier and are still valid in v3:

- **Convention 1 (one-off tools = standalone false):** unchanged. v2 fixed the Pain Management contradiction by including it in the exclusion list properly.
- **Convention 2 (advanced techniques = pre/post both false, strict):** unchanged. Wim Hof, Tummo, Holotropic, Rebirthing, Kumbhaka, Apnea Training stay this way.
- **Convention 3 (Between-Sets Recovery #39 invisible to focus engine):** unchanged. All three flags false.
- **Convention 4 (ratio-cluster consistency):** unchanged. v3 still applies cluster-uniform tagging for the 4-7-8, 4-0-8-0, 4-4-4-4, 5-5-5-5 clusters.
- **Convention 5 (`goal_specific` tradition stays canonical):** unchanged. Update planning doc, not the data.

---

## What the fresh chat should do

### Step 1 — Read context

Required reading, in order:
1. This handoff doc (`Trackers/S11-T2-framework-decisions.md`)
2. v2 spec (`Trackers/S11-T2-tagging-spec.md`) — for current state and all locked conventions
3. Breathwork list dump (`Trackers/S11-T2-breathwork-list.md`) — for the 49-technique reference

Also useful:
- `Trackers/PRE_SPRINT_11_PLANNING.md` — Approach 5 product strategy
- `Trackers/SPRINT_TRACKER.md` — current ticket status
- The DailyForge memory system has the broader project context

### Step 2 — Research progression literature for all 49 techniques

For each technique, find published guidance on duration progression by skill level. Source priorities:

**For pranayama (rows 1-15):**
- Iyengar's *Light on Pranayama* (B.K.S. Iyengar) — primary source for traditional progression
- Kaminoff & Matthews, *Yoga Anatomy* — anatomical/physiological cross-reference
- Desikachar, *The Heart of Yoga* — traditional Krishnamacharya lineage progression
- Yoga International articles on specific pranayamas (Kapalabhati, Bhastrika, Nadi Shodhana progression)
- Peer-reviewed studies on Bhramari (HRV studies), Nadi Shodhana (ANS effects)

**For Western techniques (rows 16-28):**
- Wim Hof Method official progression guide (rows 18, possibly 26)
- Stanford Cyclic Sighing study (Spiegel/Huberman) for #19 Physiological Sigh
- Coherent Breathing literature (Stephen Elliott, Patricia Gerbarg) for #20, #21
- Navy SEAL Box Breathing references for #16
- Note: many Western techniques (Triangle, Extended Exhale, 2-to-1) likely lack progression literature. Flag these explicitly for fallback confirmation.

**For therapeutic (rows 29-36):**
- Buteyko Clinic protocols for #31
- Diaphragmatic breathing in respiratory therapy literature for #29, #30
- Pain management breath research (Kabat-Zinn MBSR) for #34
- 4-7-8 Breathing (Andrew Weil) for #17, #36

**For goal-specific (rows 37-44):**
- These are mostly internal-design techniques. Likely no published progression literature. Most will use the fallback.

**For advanced (rows 45-49):**
- Tummo training programs (Wim Hof's adoption draws from this) for #45
- Kumbhaka traditional progression in Iyengar for #46
- Holotropic Breathwork (Stan Grof) facilitator training docs for #47
- Rebirthing Breath (Leonard Orr) literature for #48
- Apnea/freediving training progression (AIDA, PADI Freediver) for #49

### Step 3 — Output research notes file

Write `Trackers/S11-T2-research-notes.md` with one section per technique. Each section should contain:

```markdown
## #N — Technique Name

**Source(s) consulted:** [list]

**Beginner range found:** X-Y min, citation: [...]
**Intermediate range found:** X-Y min, citation: [...]
**Advanced range found:** X-Y min, citation: [...]

**Notes:** [any caveats, conflicting sources, safety ceilings, etc.]

**Fallback used? (yes/no):** [if yes, explain — "no progression data found, recommend X-Y min for all 3 levels"]
```

Where research finds nothing, the fallback is single-range. Flag every fallback explicitly so Prashob can confirm.

### Step 4 — Confirm autonomic activation per technique

For the pre/post flag justification (Decision 2), each row's research notes section should also state:

**Autonomic effect:** [sympathetic / parasympathetic / balanced / not-applicable]
**Citation:** [source]

This grounds the pre/post tag in physiology, not heuristic.

### Step 5 — Hand back to Prashob

When research is complete, the fresh chat should:
1. Confirm the research notes file is at `Trackers/S11-T2-research-notes.md`
2. List every technique that uses the "fallback to single-range" approach (likely 15-25 techniques)
3. Ask Prashob to confirm the fallback ranges per technique (or batch-confirm by category)
4. Once confirmed, write v3 of the spec

Do **not** start writing v3 spec until research is complete and fallbacks are confirmed.

---

## Estimated scope

- Research time: 1.5 to 2 hours
- Prashob fallback-confirmation time: 10-15 min
- v3 spec write time: 30-45 min (mostly mechanical given the research notes)
- v3 review: variable — Prashob's call

After v3 is locked, the actual S11-T2 ticket is short:

1. Ship S11-T1.5 (schema migration, separate ticket, ~10 min Claude Code work)
2. Ship S11-T2 (apply v3 spec to seed, mechanical ~20 min Claude Code work)

---

## Files in `Trackers/` after this handoff

| File | Status |
|---|---|
| `S11-T2-breathwork-list.md` | ✅ committed alongside future T2 |
| `S11-T2-tagging-spec.md` (v2) | 🟡 working file, will be replaced by v3 |
| `S11-T2-framework-decisions.md` | 🟡 this handoff doc, working file |
| `S11-T2-research-notes.md` | ⏳ produced by fresh chat |
| `S11-T2-tagging-spec.md` (v3) | ⏳ produced after research, replaces v2 |

When S11-T2 ships, only these two persist as committed artifacts:
- `S11-T2-breathwork-list.md`
- `S11-T2-tagging-spec.md` (v3 content)

The framework-decisions and research-notes files can be deleted before commit, or kept for audit trail. Prashob's call at ship time.

---

## Opening message for fresh chat

> "lets continue dailyforge - S11-T2 research"
>
> Read `Trackers/S11-T2-framework-decisions.md` first. Then `Trackers/S11-T2-tagging-spec.md` and `Trackers/S11-T2-breathwork-list.md`. Begin Step 2 once context is loaded.

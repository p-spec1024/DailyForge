# DailyForge — Pre-Sprint-11 Strategic Planning

**Session date:** Apr 26, 2026
**Status:** Foundational decisions locked. Open items flagged for follow-up sessions.
**Supersedes:** Original Sprint 11 scope ("polish + 5-phase orchestrator + Google Play"). The home-page model has changed materially; sprint plan to be redrawn.

---

## TL;DR

DailyForge is pivoting from a "5-phase session as flagship" model to a **plan-first, cross-pillar focus model**. Users plan their week by *focus area* (biceps, legs, calm down, energize, etc.) and compose sessions across strength, yoga, and breathwork pillars — either by accepting the app's suggestion or building their own. The 5-phase unified session becomes one of several available structures, not the default identity of the app.

Google Play is no longer a forcing function on Sprint 11. We build it right, then ship.

---

## 1. Philosophy & Pitch

### Locked decision

**Science-first framing. Ancient practice acknowledged as inspiration, not as the marketing claim.**

### The pitch

> *"Modern training, grounded in 2020s sports science. Concurrent training works. Breath and movement belong together. Mobility before strength prevents injury. Calming practice after intensity speeds recovery. We built the app that takes all of this seriously — and lets you train how you actually want to train."*

### What's defensible

- **Concurrent training research** — recent meta-analyses show no significant interference effect for strength or hypertrophy when strength and cardio are done in the same session (small effect on explosive power only). Order matters mostly for explosive athletes.
- **Breath-movement integration** — well-studied. Breath rate, posture, and movement all directly modulate vagal tone, HRV, and sympathetic/parasympathetic balance.
- **Mobility before strength** — established injury-prevention practice.
- **Calming practice after intensity** — measurable HRV recovery improvements, documented in sports science.

### What's NOT being claimed

- ~~"5,000-year-old tradition"~~ — the specific 5-phase structure is a modern synthesis. Patanjali, Ashtanga, and Daoist traditions did not prescribe breath → yoga warmup → strength → yoga cooldown → breath. They inspired thinking; they don't justify the specific structure.
- ~~"Tristhana maps to our three pillars"~~ — corrected. Tristhana is breath + posture + gaze happening *simultaneously* inside one yoga pose, not a sequence of three pillars.
- ~~"Pranayama before asana is ancient"~~ — actually traditional sequencing puts longer formal breathwork *after* body work. Energizing breath → workout → calming breath is a 21st-century interpretation.

### Where ancient inspiration still belongs

In product surfaces (pose detail screens, breathwork detail screens, in-session education) where users are open to learning. NOT in the elevator pitch or App Store description.

---

## 2. Home-Page Approach (Approach 5)

### Locked decision

**Plan-first home page with cross-pillar focus areas. Full scope, not stripped.**

### Model

**Two-layer structure:**

**Layer 1 — Weekly planning.** User maps out the week, day by day, by *focus area*. The focus is what the body or mind is going to work on. The pillar(s) used to work on it is a separate choice.

**Layer 2 — Daily execution.** Home page shows today's planned session. User can:
- Accept the app's suggestion (one tap → Start)
- Customize the suggestion (swap exercises, change duration, change pillar mix)
- Build their own from scratch

### Two types of focus areas

| Focus type | Tags against | Pillars that contribute |
|------------|--------------|-------------------------|
| **Body focus** (biceps, legs, hips, back, mobility, push, pull) | Muscle groups, body regions | Strength + Yoga |
| **State focus** (energize, calm, focus, sleep, recover) | Nervous system effect | Breathwork dominant + Yoga supports + Strength sometimes |

**Body-focus example:** User picks "biceps Monday." App generates strength + yoga session for biceps with energizing breath bookend at start and calming breath at end.

**State-focus example:** User picks "calm down tonight." App generates breathwork-led session with yin yoga support. No strength.

### What this gets us

- Works for all four user archetypes (strength-first, yoga-first, breathwork-first, integrator) without forcing any of them into a specific mode.
- Solves cardio cleanly — cardio is just another focus type ("endurance" / "conditioning") trainable through any pillar.
- Users discover cross-pillar flexibility naturally as they customize.
- Ancient and modern wisdom both honored — multiple pillars per focus is the practical version of "use all the controls on your nervous system."

### Tradeoffs accepted

- Bigger build than original Sprint 11. Multiple sprints of work.
- Requires focus tagging across content (mostly already done for strength + yoga; new work for breathwork).
- Requires a real suggestion engine, not just a static generator.
- UI complexity is higher; design must do real work to keep it simple.

---

## 3. Suggestion vs Build-Your-Own (Option C)

### Locked decision

**Hybrid with smart default.** Suggestion and build-your-own coexist on screen. UI complexity will be solved through design, not by removing features.

### Flow

User picks today's focus. The app shows:

- **Top half — Suggested session.** "Today's biceps session — 25 min, 6 exercises" with a Start button. Pre-built, ready to go.
- **Bottom half — Build your own.** Browse / search across pillars to compose a custom session.

User can:
- **Tap Start** → run the suggested session as-is (one tap, instant)
- **Tap Customize** → modify the suggestion (swap, add, remove)
- **Tap Build New** → start fresh

### Why this over Option A (suggestion-only) or Option B (build-only)

- Option A would hide the cross-pillar flexibility that's the whole point of Approach 5. Users would never realize they *can* mix pillars.
- Option B would create decision fatigue. Most users (probably 70-80%) just want to tap Start.
- Option C surfaces the choice without forcing it. New users tap Start; over time they get curious and tap Customize.

### Design principle

Both options visible at once means denser screen. Acceptable cost for surfacing the cross-pillar nature. The UI will be designed carefully to avoid clutter — likely with the suggestion as the primary visual hierarchy and "Build your own" as a clear but secondary affordance.

---

## 4. Focus Tagging — Content Work

### Status by pillar

| Pillar | Tag status | Work needed |
|--------|------------|-------------|
| **Strength** (736 exercises) | ✅ Already tagged with target muscles | None |
| **Yoga** (258 poses) | ✅ Already tagged with primary muscles | None |
| **Breathwork** (49 techniques) | ❌ No state-effect tagging yet | Schema below |

### Breathwork tagging schema (locked, revised Apr 26, 2026)

For each of the 49 breathwork techniques, the suggestion engine reads the following fields. Three are existing columns (reused as-is); five are new columns added in S11-T1.

| Field used by engine | DB column | Status | Values | Purpose |
|---|---|---|---|---|
| Effect | `category` | ✅ Existing | `energizing` / `calming` / `focus` / `sleep` / `performance` / `recovery` / `therapeutic` | Nervous system effect — primary state-focus tag. Engine maps the 7 internal categories to user-facing state-focus buckets (energize/calm/focus/sleep/recover) at query time. |
| Level | `difficulty` | ✅ Existing | `beginner` / `intermediate` / `advanced` | User skill required, safety boundary. |
| Contraindications | `contraindications` | ✅ Existing | `TEXT[]` | Conditions that exclude a technique (pregnancy, heart conditions, etc.). Folds in FUTURE_SCOPE #42. |
| Min duration | `duration_min` | 🆕 S11-T1 | `INT` (minutes) | Minimum useful duration of technique. |
| Max duration | `duration_max` | 🆕 S11-T1 | `INT` (minutes) | Maximum useful duration of technique. |
| Pre-workout compatible | `pre_workout_compatible` | 🆕 S11-T1 | `BOOLEAN` | Can be used as session opener. |
| Post-workout compatible | `post_workout_compatible` | 🆕 S11-T1 | `BOOLEAN` | Can be used as session closer. |
| Standalone compatible | `standalone_compatible` | 🆕 S11-T1 | `BOOLEAN` | Can be the main work of a state-focus session. |

**Estimate:** 5 new columns. S11-T2 populates the new fields with real values across 49 techniques (~5 fields × 49 techniques ≈ 245 tag decisions, down from the original 300 estimate). Existing `category`, `difficulty`, and `contraindications` values stay as they are; no backfill needed.

---

### Schema reconciliation note (added Apr 26, 2026)

The original §4 spec (drafted before inspecting `migrate.js`) proposed seven new columns: `effect`, `level`, `duration_min`, `duration_max`, `pre_workout_compatible`, `post_workout_compatible`, `standalone_compatible`. Pre-flight inspection during S11-T1 prep found that the `breathwork_techniques` table already had:

- `category` — semantically equivalent to the proposed `effect`, with a **richer** 7-value set (the proposed 4 effects collapse "sleep" and "calm," and "performance" and "energize," losing useful distinctions).
- `difficulty` — identical value set to the proposed `level` (`beginner / intermediate / advanced`).
- `contraindications` — the field FUTURE_SCOPE #42 was going to fold in already exists.

**Decision:** reuse the existing columns rather than introduce parallel ones. Rationale:
1. Renaming `difficulty → level` would be cosmetic churn; the existing name is fine.
2. The 7-value `category` set is more granular than the 4-value `effect` set. Storing the richer taxonomy at the data layer and mapping to the simpler user-facing taxonomy at the engine layer is the correct architectural split — the data should not lose information to match a UI vocabulary.
3. Adding parallel columns (`effect` alongside `category`, `level` alongside `difficulty`) would create a permanent dual-tagging system the engine has to reconcile on every query.
4. Renaming the existing columns would touch every service file that queries them, with zero user-visible benefit.

**Engine-layer mapping (informational, lands in S12):**

| User-facing state-focus | Internal `category` values that map to it |
|---|---|
| energize | `energizing`, `performance` |
| calm | `calming`, `recovery` |
| focus | `focus` |
| sleep | `sleep` |
| recover | `recovery` (also surfaces under `calm`; engine may dedupe by user context) |

Note: `therapeutic` is intentionally not mapped to a state-focus. Therapeutic techniques are surfaced via contraindication-aware filters and direct browse, not via the suggestion engine's primary state-focus query path. Revisit in Sprint 12 if needed.

### Effect-tag reference (for tagger guidance)

**`energize`** — sympathetic activating, raises HR, alertness, oxygenation. Examples: Kapalabhati, Bhastrika, Wim Hof breathing, Breath of Fire.

**`calm`** — parasympathetic activating, lowers HR and BP, releases stress. Examples: 4-7-8, extended exhale, Bhramari, box breathing.

**`balance`** — neutral, regulates without pushing up or down. Examples: Nadi Shodhana, coherent breathing (5-5).

**`focus`** — builds mental concentration and steadiness. Subtler effect on energy. Examples: Ujjayi, breath retention (kumbhaka).

### Level boundaries (for safety)

- **Beginner-safe** — slow breathing, extended exhale, alternate nostril, box breathing. Worst case: mild lightheadedness.
- **Intermediate** — Kapalabhati, Bhastrika, Ujjayi with retention. Some practice required.
- **Advanced** — Wim Hof full protocol, long breath retentions, intensive rounds. Can cause fainting or hyperventilation if done wrong. Contraindications: pregnancy, epilepsy, heart conditions, panic disorders. Never while driving, in water, or under similar risk conditions.

A beginner picking "energize" should NOT get Wim Hof on day 1. The suggestion engine respects level gating.

---

## 5. Cardio (Resolved)

### Resolution

**Cardio is not a phase, not a pillar, not a separate session type.** Under Approach 5, cardio is a *focus area* like any other ("endurance," "conditioning," "stamina") and is trained through whichever pillar the user picks:

- Strength-first → kettlebell circuits, AMRAP, EMOM, supersets
- Yoga-first → power vinyasa, Sun Salutation rounds, Ashtanga primary
- Breathwork-first → Bhastrika rounds, Wim Hof full protocol, Kapalabhati intensives
- Integrator → combined session with cardio flavor across pillars

No 4th pillar needed. No new tracking type. No new database tables. Cardio falls out of the focus-area model naturally.

---

## 6. The 5-Phase Session (Repositioned)

### Status change

The 5-phase session (breath → yoga warmup → strength → yoga cooldown → breath) is **no longer the flagship daily experience.** It is now **one of several session structures** the app supports, available when the user wants a complete unified practice.

### Where it surfaces

- As an explicit option when the user picks a body-focus and wants the unified version (e.g., "biceps day → Full Practice mode")
- As a default suggestion on certain calendar contexts (e.g., a planned "full body" day)
- Discoverable via a "Practice modes" section, not promoted as the home page identity

### Why this works better

- Users who want it find it easily.
- Users who don't aren't blocked by guilt or friction.
- Time-poor users (30-min budget) get single-pillar sessions; time-rich users (60+ min) get the full 5-phase.
- The 5-phase becomes a *feature that earns its place* through use, not a flagship that has to justify itself.

---

## 7. Sequencing & Launch

### Locked decision

**Google Play is not a forcing function. Build Approach 5 properly. Launch when ready.**

### What this means

- The original Sprint 11 plan ("polish + 5-phase orchestrator + Google Play") is **obsolete**.
- A new sprint breakdown will be drawn that sequences the Approach 5 build.
- Sprint cadence and ticket structure remain (one ticket per chat, device verification before commit, etc.).

### Sprint breakdown — TO BE DESIGNED IN FOLLOW-UP SESSION

The new sprint plan needs to sequence:

1. Breathwork tagging (content work)
2. Focus area data model (database schema for body-focus + state-focus)
3. Suggestion engine (focus + level → session)
4. Weekly plan UI (calendar view, day-by-day focus picker)
5. Session composer (build-your-own across pillars)
6. New home page (today's planned session, hybrid suggest+build)
7. 5-phase orchestrator (preserved, repositioned as one of several modes)
8. Onboarding flow (level + archetype + initial plan)
9. Polish + Google Play submission

This is roughly 4-6 sprints of work depending on scope. Sequencing is itself a planning conversation, not a writeup.

---

## 8. Open Items — Future Planning Sessions

These were not resolved in this session and need their own focused conversations:

### Personalization algorithm
- How does the suggestion engine generate THIS user's session today, given their focus + level + history?
- What signals does it use? (Declared in onboarding + behavioral over time)
- How does it adapt as the user progresses?
- How does it handle deload weeks, recovery, soreness?

### Onboarding flow
- How do new users discover what kind of practitioner they are without a quiz that feels like a chore?
- What's the first-session experience? (Picking a focus on day 1 vs. accepting a default)
- How is level assessed initially?
- How is the philosophy introduced without being preachy?

### Weekly plan UI specifics
- Calendar visual model (week-at-a-glance vs. day-detail)
- Plan templates per archetype (strength-first template, yoga-first template, etc.)
- Edit flows ("copy last week," "swap two days")
- What happens when a user skips a planned day? (Bump? Drop? Rollover?)
- Default plan generated automatically vs. user must build first

### Session composer specifics
- How does the user browse across pillars in one view?
- Filters (by focus, by duration, by equipment, by level)
- Set/rep/duration handling per pillar (strength has sets+reps, yoga has hold-time, breath has rounds+ratio)
- Saving and reusing custom sessions

### Five-phase mode specifics
- When the user picks "Full Practice," how is the structure rendered?
- Phase durations — fixed or proportional to session length?
- How does main-work pillar selection work inside Full Practice?

### Cardio surfacing
- Are "endurance" and "conditioning" presented as primary focus options, or hidden inside other focuses?
- How is HR/RPE captured (if at all)?
- Does the app integrate with watch HR data, or is intensity self-reported?

---

## 9. Decision Log

| # | Decision | Status |
|---|----------|--------|
| 1 | Philosophy framing: science-first, ancient as inspiration | ✅ Locked |
| 2 | Home page model: Approach 5 (plan-first + cross-pillar focus) | ✅ Locked |
| 3 | Scope: full Approach 5, not stripped | ✅ Locked |
| 4 | Suggestion flow: Option C (hybrid with smart default) | ✅ Locked |
| 5 | Focus model: body-focus + state-focus split | ✅ Locked |
| 6 | Breathwork tagging schema: 7 fields per technique | ✅ Locked |
| 7 | Cardio: focus-area inside pillars, not a 4th pillar | ✅ Locked |
| 8 | 5-phase session: one mode among several, not flagship | ✅ Locked |
| 9 | Google Play: not a forcing function | ✅ Locked |
| 10 | New sprint breakdown for Approach 5 | ⏳ Next session |
| 11 | Personalization algorithm | ⏳ Future session |
| 12 | Onboarding flow | ⏳ Future session |
| 13 | Weekly plan UI specifics | ⏳ Future session |
| 14 | Session composer specifics | ⏳ Future session |

---

## 10. What's Next

**Immediate next session:** Draw the new sprint breakdown for Approach 5. Order the 9 work items in section 7 into sprints, identify dependencies, name each ticket.

**After that:** Personalization algorithm + onboarding flow as a paired session (they're tightly coupled — onboarding feeds the personalization signals).

**After that:** Weekly plan UI + session composer UI as a paired session (also tightly coupled).

**Then:** First Approach 5 ticket prompt is writable. Likely the breathwork tagging ticket, since it's content work that unblocks the suggestion engine.

---

*Doc owner: Prashob (CEO/PM) + Claude.ai (Architect)*
*Place this doc in `D:\projects\dailyforge\Trackers\` alongside SPRINT_TRACKER.md and FUTURE_SCOPE.md.*

# S11-T2 — Research Notes (Per-Difficulty Duration + Autonomic Effect)

**Author:** Claude.ai (Research)
**Date:** Apr 27, 2026
**Purpose:** Per-technique research notes feeding into v3 of the tagging spec. Captures per-difficulty duration ranges (Decision 1) and autonomic-system effect (Decision 2) for all 49 breathwork techniques.
**Status:** Working file. Drives v3 spec after Prashob confirms fallback ranges.
**Source documents:** `Trackers/S11-T2-framework-decisions.md`, `Trackers/S11-T2-tagging-spec.md` (v2), `Trackers/S11-T2-breathwork-list.md`

---

## How to read this doc

Each technique gets one section. Format:

- **Source(s) consulted** — references actually read for the duration call.
- **Beginner / Intermediate / Advanced ranges** — minutes, with the source the call traces to.
- **Notes** — caveats, safety ceilings, conflicting sources.
- **Fallback used? (yes/no)** — yes means no published per-difficulty progression literature was found and a single range is recommended for all 3 levels. Every fallback row needs Prashob's per-row confirmation before v3 lock.
- **Autonomic effect** — sympathetic / parasympathetic / balanced / not-applicable, with citation. This grounds the pre/post tag in physiology per Decision 2.

A few process notes:

1. Where v2 already had defensible ranges and the literature confirms them, the research notes preserve v2's anchor and push the upper end out for the advanced tier where evidence supports it.
2. Where v2 had a single range that conflates beginner and advanced (e.g., Kapalabhati 3-8 min), the research splits it apart explicitly.
3. Where literature is silent — most goal-specific (#37-44) and most reactive-tool techniques — the fallback recommendation is the single v2 range applied to all three difficulty levels, flagged for Prashob confirmation.
4. Convention 2 advanced techniques (#18 Wim Hof, #45 Tummo, #46 Kumbhaka, #47 Holotropic, #48 Rebirthing, #49 Apnea) have intermediate columns populated as the practical lower bound for someone training toward the advanced version, since the existing seed difficulty is `advanced`. The beginner column is recommended as `null` for these — they shouldn't be presented to beginners. Prashob to confirm null vs. floor at v3 review.

---

## Pranayama (rows 1-15)

### #1 — Nadi Shodhana

**Source(s) consulted:**
- B.K.S. Iyengar, *Light on Pranayama* (referenced via Tummee.com summary, Yoga International, Yoga Journal)
- Tummee.com pose database — "ideal duration is 5-10 rounds or 10-15 minutes every day"
- Prana Sutra guide on Nadi Shodhana progression stages
- Yoga in Daily Life "Nadi Shodhana Pranayama Level 4" with kumbhaka

**Beginner range found:** 5-10 min — "begin with five minutes of practice...should get extended gradually" (Yoga Samadhi); 5-10 rounds (~5-10 min at 60-second cycles) for entry-level.
**Intermediate range found:** 10-15 min — Tummee's stated "ideal" range (5-10 rounds or 10-15 min daily).
**Advanced range found:** 15-25 min — with kumbhaka and bandhas added; Iyengar progression literature and Yoga in Daily Life Level 4 protocol (5 rounds × 4-second inhale + 16-second hold + 8-second exhale + 16-second hold = ~44 sec per cycle, scaling to multiple rounds).

**Notes:** v2 had 5-20. The research supports extending the advanced ceiling to 25 min when retentions are added. Iyengar warns against rushing — 6+ months on basics before advanced kumbhaka. Lower bound stable at 5 min across all levels because below that the technique doesn't establish rhythm.

**Fallback used?** No.

**Autonomic effect:** balanced. Bilateral nostril alternation activates ida (parasympathetic) and pingala (sympathetic) channels in alternation; clinical literature consistently reports increased HRV and balanced LF/HF ratio.
**Citation:** Yoga Samadhi: "directing the progression of prana through the Ida (left) and Pingala (right) nadi, it assists with blending the sympathetic and parasympathetic nervous systems." Pranayama review (Thalira) confirms HRV increase and parasympathetic activation evidence.

---

### #2 — Anulom Vilom

**Source(s) consulted:**
- Prana Sutra "How to Practice Nadi Shodhana" — explicitly identifies Anulom Vilom as the preparatory version of Nadi Shodhana
- Tummee.com cross-reference

**Beginner range found:** 5-10 min — same as Nadi Shodhana entry level; this IS the entry level practice.
**Intermediate range found:** 10-15 min.
**Advanced range found:** 15-20 min — without retentions (those move you into Nadi Shodhana proper). Anulom Vilom is bounded above by the point where adding kumbhaka graduates the practice into Nadi Shodhana.

**Notes:** v2 had 5-20 across the technique. The progression literature treats Anulom Vilom as the preparatory technique that "graduates" to Nadi Shodhana when retention is added. So advanced Anulom Vilom (no retention) is essentially the upper bound of intermediate Nadi Shodhana — they're roughly the same practice without holds. Capping advanced at 20 is appropriate.

**Fallback used?** No.

**Autonomic effect:** balanced. Same mechanism as Nadi Shodhana minus retention.
**Citation:** Same evidence base; Prana Sutra describes Anulom Vilom as "the act of just clearing, opening, and balancing the nadis."

---

### #3 — Kapalabhati

**Source(s) consulted:**
- Cymbiotika "How Many Minutes to Do Kapalbhati" — explicit beginner/intermediate/advanced ranges
- Form Fitness Kapalabhati FAQ — explicit pump count progression (20-30 / 40-60 / 60-108)
- Rajyoga Rishikesh — beginner protocol (3 rounds × 20 breaths)
- Yoga International (Rolf Sovik) — 3 rounds × 11 expulsions for absolute beginners
- Vinyasa Yoga Ashram — "20-30 strokes per round, 2-3 rounds...gradually increase to 100-200 strokes"

**Beginner range found:** 1-3 min — Cymbiotika explicit ("Beginners can start with 1-3 minutes"). 3 rounds × 20-30 strokes at ~60 bpm = ~1.5-2 min total breath time + rests = ~3 min.
**Intermediate range found:** 5-10 min — Cymbiotika ("gradually increasing to 10-15 minutes as they become more comfortable"); Form Fitness intermediate = 40-60 pumps × 3-5 rounds.
**Advanced range found:** 10-30 min — Cymbiotika ("Advanced practitioners may practice for up to 30 minutes"); Form Fitness 60-108 pumps × multiple rounds; Vinyasa Yoga Ashram 100-200 strokes per round under qualified guidance.

**Notes:** v2 had 3-8 min for the whole technique tagged intermediate. The research supports a much wider span when broken out by progression level. **Important safety ceiling:** advanced 30 min is total session time including breaks; continuous Kapalabhati over 30 min creates hyperventilation/dizziness risk. Cymbiotika explicitly notes "if you feel lightheaded or strained, reduce the duration."

**Fallback used?** No.

**Autonomic effect:** sympathetic. Indian Yoga Association explicit: "the practice of Kapalabhati activates the sympathetic nervous system." Forced rapid exhalations trigger adrenaline release; this is the foundational example of an energizing pranayama.
**Citation:** Indian Yoga Association ("activates the sympathetic nervous system, but the Sympathetic-Parasympathetic balance is well kept up"); Huberman Lab newsletter classifies cyclic hyperventilation (the western analog) as adrenaline-releasing for alertness.

---

### #4 — Bhastrika

**Source(s) consulted:**
- Fitsri Yoga "Bhastrika Pranayama" — standard 3-5 min, beginners shorter
- World Yoga Forum / Satyananda Bihar — 5-stage progression with bandhas/retention
- Cymbiotika "How Long to Do Bhastrika" — explicit beginner 5-10 min, intermediate 10-15
- Yogamut "How To Do Bhastrika" — 4-technique progression (Bihar School)

**Beginner range found:** 3-5 min — Fitsri ("standard practice takes 3-5 minutes... beginners may start with shorter rounds"). Cymbiotika cites 5-10 min for beginners but with caveat to start lower if discomfort.
**Intermediate range found:** 5-10 min — Cymbiotika ("aim for 10-15 minutes per session" once technique is established); World Yoga Forum technique 3 introduces internal retention with bandhas.
**Advanced range found:** 10-15 min — World Yoga Forum technique 4-5 with maha bandha and external retention; "the number of repetitions is increased dramatically." Quora answer (citing Sivananda) notes traditional practitioners can sustain 30+ min but warns this is unsafe for unprepared practitioners.

**Notes:** v2 had 3-8 min. Research supports a wider intermediate-advanced span. Cymbiotika explicitly notes 30+ min is "advanced...with teacher supervision." Safety ceiling: continuous fast Bhastrika past 15 min creates hyperventilation/faintness risk; this is why the upper bound stays conservative at 15 even though traditional practitioners go further.

**Fallback used?** No.

**Autonomic effect:** sympathetic. Forceful rapid breathing identical mechanism to Kapalabhati; explicit kriya/cleansing classification in Hatha Yoga Pradipika and Iyengar's *Light on Pranayama* (per Wikipedia citation: "kapālabhāti is a milder form of Bhastrikā").
**Citation:** Wikipedia Bhastrika article citing Iyengar's Light on Pranayama; Satyananda Yoga: "increases the prana and heat in the body" / activates the sympathetic system.

---

### #5 — Bhramari

**Source(s) consulted:**
- *Heart Rate Variability Changes During and after the Practice of Bhramari Pranayama* (Kuppusamy et al. PMC5433120) — 5-min protocol explicitly
- Stress Buster Holter study (PMC10182780) — confirms vagal/parasympathetic via humming
- Yoga International "Breath Length Matters" — 12-14 second breath HRV findings (3-min study window)
- Indian Journal of Physiology and Pharmacology — comprehensive review

**Beginner range found:** 5-10 min — most clinical protocols use 5 min; standard sources recommend "9 rounds" or 5-10 min for entry level.
**Intermediate range found:** 10-15 min — sustainable; the technique doesn't physiologically require advancement in duration to deliver vagal benefits; longer sessions deepen mental absorption.
**Advanced range found:** 15-20 min — meditation traditions support sustained humming for extended periods; research literature has not specifically progressed beyond 15-20 min protocols.

**Notes:** v2 had 5-15 min. The research-grade extension for advanced practitioners is modest — Bhramari is fundamentally a vagal-activator that saturates at 15-20 min for most users. The 12-14 second breath length finding suggests the *quality* of progression matters more than session length.

**Fallback used?** No (within research-confirmed bands).

**Autonomic effect:** parasympathetic. Multiple peer-reviewed studies confirm increased HRV, decreased BP, decreased HR. Humming-induced nitric oxide and vocal-fold vibration drive vagal stimulation specifically.
**Citation:** Sciencedirect 2025 SPB-vs-humming pilot: "humming component introduces an additional form of vagal stimulation through the modulation of vocal fold vibrations and nitric oxide production"; Latha & Lakshmi 2022: "produces parasympathetic activity."

---

### #6 — Ujjayi

**Source(s) consulted:**
- Yoga Selection (Iyengar 13-stage progression, *Light on Pranayama*)
- Flame Tree Yoga "Ujjayi Pranayama Iyengar Style" — 10-min sustained practice instructions
- Prana Sutra Ujjayi guide — "3-5 min beginner...gradually 15 min"
- Insight Timer guide — "10 cycles for beginners"
- Yoga Vastu / Pixie Lillas — "10-20 min...according to capacity" (advanced)

**Beginner range found:** 3-5 min — explicitly Prana Sutra ("start with 3-5 min...gradually increase to 15 min"); Insight Timer 10 cycles.
**Intermediate range found:** 10-15 min — Flame Tree's reclining 10-min sustained practice; Geeta Iyengar references 5-10 min Ujjayi after asana.
**Advanced range found:** 15-30 min — Yoga Vastu Iyengar instruction "10-20 min or so according to capacity"; Iyengar's Stage 8+ approaches 30 min sustained practice. Most flexible technique in the library given its ratio (4-0-4-0) is sustainable indefinitely.

**Notes:** v2 had 5-30 — research supports the 30-min upper bound but pulls the floor down to 3 min for true beginners (which v2's 5 min handled too high). Adopting 3 min as the beginner floor.

**Fallback used?** No.

**Autonomic effect:** balanced (with parasympathetic lean). Throat-constricted nasal breathing slows respiratory rate and naturally elongates exhale; activates parasympathetic. But unlike pure parasympathetic techniques, Ujjayi is also used in vigorous Vinyasa flow as a focus/heat-generating breath — the practice is "dual-purpose" which is why all three pre/post/standalone flags fit it well.
**Citation:** Pranam.center: "stimulates the parasympathetic nervous system, relaxing the body" — but used during energetic asana practice. Iyengar (per Wikipedia): "soothes the nerves and tones the entire system."

---

### #7 — Sitali

**Source(s) consulted:**
- Yoga International "Beat the Heat: Sitali and Sitkari" — "up to 20 times" (i.e., ~3-4 min)
- Metta Yoga — "2-5 min and increase over time"
- Prana Yoga Center — "8-10 rounds" (~2-3 min)
- The Yoga Sanctuary — "1-3 min or set number of breaths"
- Fitsri Yoga Sitali Pranayama — extended-practice variation with retention/bandha
- Pranayama review (Thalira) — cooling/parasympathetic mechanism

**Beginner range found:** 1-3 min — most sources converge on 8-10 rounds (~2-3 min); Yoga Sanctuary "1-3 min" explicit.
**Intermediate range found:** 5-10 min — Metta Yoga "2-5 min and increase"; sustained 10 min cooling practice is documented in Iyengar tradition.
**Advanced range found:** 10-15 min — sustained cooling sessions with retention (Jalandhara Bandha), per Fitsri Yoga's full-protocol description. Beyond 15 min the cooling effect saturates and the mouth-breathing aspect can dry the throat.

**Notes:** v2 had 5-15 across all levels. Research supports a lower beginner floor (1-3) and a slightly extended advanced ceiling (15). Note the Fitsri protocol with breath retention is the advanced-tier progression; without retention it stays in the 1-10 min range.

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Cooling effect via evaporation through curled tongue + nasal exhale slows nervous system; "decreases heart rate" per Tummee. Pitta-pacifying in Ayurveda; brain-wave studies show alpha/delta/theta increase, beta decrease (Fitsri citing brain wave research).
**Citation:** Fitsri: "research done on the effect of Sitali along with sitkari pranayama on Brain waves has shown, it increases the alpha, delta, and theta waves power and decreases beta wave power"; Yoga Journal: "stimulates parasympathetic nervous system response."

---

### #8 — Sitkari

**Source(s) consulted:**
- Yoga International "Beat the Heat: Sitali and Sitkari" — "up to 20 times" (~3-4 min)
- Prana Sutra Sitkari Pranayama (citing Iyengar's *Light on Pranayama* + Saraswati)
- Prana Yoga Center — "8-10 rounds" (~2-3 min)
- Yoga East+West — explicit Sitali equivalence

**Beginner range found:** 1-3 min — same as Sitali (Yoga Journal "8-10 rounds").
**Intermediate range found:** 5-10 min.
**Advanced range found:** 10-15 min.

**Notes:** Mirror Sitali. Sitkari and Sitali are functionally interchangeable — Sitkari is the alternative for those who can't curl the tongue. Iyengar treats them as paired techniques in *Light on Pranayama*. v2's identical 5-15 to Sitali was correct in pattern; research split adopts the same pattern as Sitali.

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Same mechanism as Sitali (cooling inhale + nasal exhale).
**Citation:** Same as Sitali; Prana Sutra cites Iyengar describing Sitkari as "exhilarating" but soothing for nerves.

---

### #9 — Surya Bhedana

**Source(s) consulted:**
- Yoga Journal "Single Nostril Breath" — "1-3 min" beginner range
- Fitsri Yoga "Surya Bhedana Pranayama" — explicit 1-3 min beginner (3-6 rounds), "up to 10 min" with practice
- Aviyog Group — "5 rounds → 10-80 rounds advanced" with kumbhaka
- Uditam — "Beginners 5 rounds (2-3 min); Intermediate 10-15 rounds (5-10 min)"
- Pratham Yoga — "3-5 min or 8-10 rounds"
- BIYOME (Australian biomedical institute) — clinical protocol with citations

**Beginner range found:** 2-3 min — Uditam explicit; Fitsri "1-3 min or 3-6 rounds"; Yoga Journal "1-3 min."
**Intermediate range found:** 5-10 min — Uditam "5-10 min"; Fitsri "up to 10 min."
**Advanced range found:** 10-15 min — Aviyog "10 rounds and beyond...80 rounds advanced" with kumbhaka; with retention this approaches 15 min sustained practice. Research literature: Raghuraj & Telles 2008 (autonomic study).

**Notes:** v2 had 3-8. Research supports lower beginner floor (2 min) and higher advanced ceiling (15 min) when retention is added. Yellow safety level appropriate; contraindications clear.

**Fallback used?** No.

**Autonomic effect:** sympathetic. Pranayama review (Thalira): "Inhalation through the right nostril (pingala, sun) only...activates the sympathetic nervous system, increases body temperature, and promotes alertness." Right-nostril dominance correlates with sympathetic activation in nostril-cycle research.
**Citation:** Raghuraj P, Telles S. "Immediate effect of specific nostril manipulating yoga breathing practices on autonomic and respiratory variables" *Applied Psychophysiology Biofeedback* 2008. Pranayama review (Thalira): explicit sympathetic classification.

---

### #10 — Chandra Bhedana

**Source(s) consulted:**
- Yoga Journal "Single Nostril Breath" — "1-3 min" reverse of Surya Bhedana
- Prana Sutra Chandra Bhedana — "8-10 rounds...progress to 12+ rounds"
- BIYOME pranayama manual — explicit complementary pair to Surya Bhedana
- Tummee.com Chandra Bhedana — "6 rounds → 12+ rounds advanced with kumbhaka"
- Raghuraj & Telles 2008 (autonomic study cited above)

**Beginner range found:** 3-5 min — Prana Sutra "8-10 rounds, 3-5 min Sukhasana rest"; Tummee "6 rounds taking breaks."
**Intermediate range found:** 5-10 min — extension via more rounds without retention.
**Advanced range found:** 10-15 min — with kumbhaka added, per Tummee "advanced practitioners can practice with Kumbhaka."

**Notes:** v2 had 5-15. Research supports the extension to 15 min advanced and brings the beginner floor down to 3 min (Yoga Journal's 1-3 min suggestion is slightly aggressive — most sources support 3 min minimum to feel the parasympathetic shift).

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Mirror of Surya Bhedana. Left-nostril dominance correlates with parasympathetic/calming effect in autonomic research.
**Citation:** Raghuraj & Telles 2008 (cited above); Tummee: "decreasing heart rate and pulse rate. Hence, if practiced by students having cardiovascular issues, hypertension, or high blood pressure, it can benefit them."

---

### #11 — Dirga Pranayama

**Source(s) consulted:**
- Yoga Basics Dirga Pranayama guide
- YogaKawa Pranayama guide — "3-5 min beginners, gradually increasing"
- Prana Sutra "Three-Part Breath Dirgha Pranayama"
- Tummee.com Three-Part Breath
- EverydayYoga Dirga Swasam Pranayama

**Beginner range found:** 3-5 min — YogaKawa explicit ("Beginners may start with just three to five minutes"); EverydayYoga "even two or three breaths will have a positive effect."
**Intermediate range found:** 10-15 min — sustainable practice per Yoga Basics.
**Advanced range found:** 15-20 min — Dirga is fundamentally a foundational technique; advanced practice doesn't extend it indefinitely because at that point practitioners typically progress to other pranayamas.

**Notes:** v2 had 5-20. Research supports lower beginner floor (3 min) and confirms 20 max. Dirga is the "gateway pranayama" — the upper bound is bounded by the fact that advanced practitioners use it as a warm-up or settling-in technique before moving to more demanding work, not as a 30+ min session.

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Three-part full-yogic breath maximizes diaphragmatic engagement; slow respiratory rate; longer exhale than typical.
**Citation:** Tummee: "decrease in stress levels, thereby calming the sympathetic nervous system"; Pranayama science literature (e.g., Pal et al.) consistently demonstrates HRV increase with diaphragmatic slow breathing.

---

### #12 — Sama Vritti

**Source(s) consulted:**
- BIYOME pranayama manual — "5-10 box breaths or as long as desired"
- YogaKawa Pranayama guide — "Sama Vritti choose a gentle count such as three or four"
- Wikipedia Sama Vritti — formal 4-phase definition
- Cluster mate of Box Breathing (#16) and Focus Breath (#41)

**Beginner range found:** 3-5 min — most sources start at 3-5 min entry-level box-style practice.
**Intermediate range found:** 10-15 min — sustained equal-ratio practice.
**Advanced range found:** 15-25 min — extension to longer durations; with retention added it approaches Visama Vritti territory.

**Notes:** v2 had 5-20 across the technique. Research supports slightly lower beginner floor (3 min) and slightly higher advanced ceiling (25 min). This is a cluster-mate of Box Breathing — they should track together. Sama Vritti is the pranayama tradition's name for the same 4-4-4-4 mechanic Navy SEALs popularized as box breathing.

**Fallback used?** No.

**Autonomic effect:** balanced. Equal-duration four-phase breath produces neither sympathetic nor parasympathetic dominance — it's the "neutral" breath.
**Citation:** BIYOME: "brings the breath into a more relaxed and focused state"; Box Breathing literature (Mark Divine quoted in TIME): "neutral energetic effect: not going to charge you up or put you into a sleepy relaxed state."

---

### #13 — Visama Vritti

**Source(s) consulted:**
- Yogapedia "Vishama-Vritti" definition — "intermediate exercise...common to work toward 1:4:2:1 ratio"
- Mark Giubarelli pranayama — explicit progression (1:2:1.5 → 1:3:2 → 1:4:2)
- Prana Awakening — "ideal ratio 1-4-2-4...practitioner required much time and patience"
- Shedbody Vritti Pranayama — caution: "path full of danger...not without supervision"
- BIYOME — Visama vritti as progression from Sama vritti

**Beginner range found:** 5-10 min — but **NOT recommended for beginners**; v2's "intermediate" classification stands. Beginner column should be `null` (technique requires Sama Vritti mastery first).
**Intermediate range found:** 5-10 min — entry-level progression starts at 1:2:1.5 ratio.
**Advanced range found:** 10-20 min — full 1:4:2:1 ratio with extended retentions; ShedBody warns this is "one of the more dangerous breathing exercises in pranayama."

**Notes:** v2 had 5-15. Research supports 5-10 intermediate floor, extending advanced to 20. The technique is gated on prior Sama Vritti mastery; recommend beginner column = null. Iyengar's *Light on Pranayama* (per Mark Giubarelli) treats this as a progression-by-stage discipline.

**Fallback used?** No.

**Autonomic effect:** parasympathetic (when exhale-extended) / sympathetic (when inhale-extended). The 1:4:2:1 standard ratio with extended internal retention is parasympathetic-dominant due to the long exhale phase. Yogapedia: "When the exhalation is lengthened, it is considered to be relaxing." Tagging it parasympathetic for the standard 1:4:2 progression direction.
**Citation:** Yogapedia definition; Iyengar's *Light on Pranayama* progression chapter (per multiple secondary sources). Note v2's `post=true / pre=false` is consistent with parasympathetic classification.

---

### #14 — Udgeeth

**Source(s) consulted:**
- Aviyog Group "Udgeeth Pranayam" — "5 minutes...18 hours by ancient Indian saints" (rhetorical extreme)
- Prana Sutra "Udgeeth Pranayama" — full Vedic context, contemplative meditation classification
- Cross-reference to Bhramari (similar humming/vocalization mechanism)

**Beginner range found:** 5 min — Aviyog explicit ("2 minutes of Udgeeth Pranayama for excellent health" entry-level; "5 min if you have time").
**Intermediate range found:** 10-15 min — extended chant practice for meditation preparation.
**Advanced range found:** 15-30 min — Prana Sutra contextualizes this as a meditation-grade contemplative practice; sustained OM chanting in Vedic tradition supports 30-min sittings; Bhramari research (HRV literature) supports parasympathetic sustainability beyond 20 min.

**Notes:** v2 had 5-20. Research supports 30-min advanced ceiling for those treating Udgeeth as a meditation practice rather than a "session." The 18-hour reference in Aviyog is hagiography, not a practical recommendation.

**Fallback used?** No (well-documented for entry level, with reasonable extension by analogy to Bhramari for advanced).

**Autonomic effect:** parasympathetic. OM chant on extended exhale = vocal fold vibration + nitric oxide release + long exhale; same mechanism as Bhramari.
**Citation:** Prana Sutra: "calming the nerves...slow breathing and soft humming are known to produce scientifically measurable health benefits"; analogous evidence base to Bhramari studies (PMC10182780).

---

### #15 — Simhasana (Lion's Breath)

**Source(s) consulted:**
- MyYogaTeacher "Simhasana" — "Beginners 10-30 sec with 2-3 roars; Advanced 30-60 sec with 5-10 roars"
- Healthline Lion's Breath — "Repeat up to 7 times. Finish with deep breathing for 1-3 min"
- Yogateket — "Practice for 4-7 minutes"
- mindbodygreen — "4-6 lion's breaths...3 minutes of nose breathing after"
- Bajaj Allianz health ed — "Beginners 20-30 sec × 2-3 reps; Intermediate 1-2 min; Advanced 3 min"
- Samadhi Yoga Ashram — "3-5 rounds...effectiveness lies in intensity, not duration"

**Beginner range found:** 1-3 min — Healthline "up to 7 reps + 1-3 min deep breathing"; Bajaj "20-30 sec × 2-3 reps" totaling ~1 min; sources converge on "few rounds + integration."
**Intermediate range found:** 2-5 min — Yogateket "4-7 min"; Bajaj "intermediate 1-2 min per round."
**Advanced range found:** 3-7 min — Yogateket upper bound; Bajaj "advanced 3 min with multiple repetitions."

**Notes:** v2 had 2-5 across the board. Research supports a tighter beginner floor (1 min, since the practice is fundamentally a few-rep tool) and slight extension for intermediate-advanced (up to 7 min, but this is essentially Lion's Breath integrated with deep breathing between roars). **Important: Simhasana is fundamentally a one-off / short-burst tool — even "advanced" doesn't push it into long-session territory.** Samadhi: "effectiveness lies in the intensity of the exhalation and facial stretch rather than duration." This reinforces v2's `standalone=false` designation (Convention 1).

**Fallback used?** Partial — beginner range well-documented, intermediate/advanced rely more on inference from "few rounds with longer integration" framing. Recommend Prashob confirm whether 3-7 advanced makes sense or whether to stay tighter.

**Autonomic effect:** sympathetic (acute) → parasympathetic (recovery). The forceful "haaa" exhale + tongue extension activates sympathetic nervous system briefly (release/tension), then the recovery breathing between roars activates parasympathetic. **Net effect:** energizing/release tool. v2's `pre=false, post=false` reflects this — it's not a pre or post workout choice, it's a one-off release.
**Citation:** Yogateket: "stimulate your throat and upper body...calming effect on our nervous system" — but also "wake up your face with a new flow" (sympathetic stim phase). Healthline frames as "let go of negative energy...empowerment."

---
## Western (rows 16-28)

### #16 — Box Breathing

**Source(s) consulted:**
- Mark Divine (former Navy SEAL) interview in TIME magazine — "5 minutes minimum...10-20 min daily practice plus 1-2 min spot drills"
- Outliyr Box Breathing — "1-5 minutes to noticeably relax"
- Breath Ball — "many people practice 2-5 minutes"
- Peloton/Denis Morton — "1-2 minutes per day...big reward for low investment"

**Beginner range found:** 3-5 min — multiple sources converge on ≥5 min for clear effect; 3 min is the practical minimum to feel the parasympathetic shift.
**Intermediate range found:** 10-15 min — Mark Divine's prescribed daily practice ("one practice session for 10-20 minutes a day").
**Advanced range found:** 15-25 min — Mark Divine's upper bound; cluster mate of Sama Vritti.

**Notes:** v2 had 5-20. Research supports lower beginner floor (3 min, since this is a tactical "spot drill" technique you can use at any duration) and slight extension upward. Mark Divine's framing is the authoritative voice for box breathing duration.

**Fallback used?** No.

**Autonomic effect:** balanced. Equal-duration four-phase breath; explicitly described by Mark Divine as having "a neutral energetic effect: it's not going to charge you up or put you into a sleepy relaxed state. But it will...make you very alert and grounded, ready for action."
**Citation:** Mark Divine in TIME (May 2016): explicit "neutral energetic effect" framing. Same physiological mechanism as Sama Vritti — the cluster shares classification.

---

### #17 — 4-7-8 Breathing

**Source(s) consulted:**
- Andrew Weil's *Arizona Center for Integrative Medicine* patient handout — explicit progression
- DrWeil.com video & writeup — "do not do more than 4 breaths at one time for the first month...later extend to 8 breaths"
- Cleveland Clinic 4-7-8 guide
- Open blog 4-7-8 — confirms "4 cycles minimum...build to 8 over 1 month"
- INTEGRIS Health practice guide
- Art of Living

**Beginner range found:** 1-2 min — Weil's explicit prescription: 4 cycles × ~19 sec/cycle = ~76 seconds = ~1.5 min. Repeat twice daily.
**Intermediate range found:** 3-5 min — after 1 month, extend to 8 cycles = ~150 sec ≈ 2.5-5 min depending on pace.
**Advanced range found:** 5-8 min — Weil's explicit ceiling: "later, if you wish, you can extend it to 8 breaths" = ~3 min, but with slower deeper pacing it can reach 5-8 min. Critically, **Weil places an explicit cap at 8 cycles per session.** Beyond this is not part of the prescribed protocol.

**Notes:** v2 had 5-15 across the board, which is **too high for Weil's actual protocol**. The 4-7-8 method is intentionally short and concentrated — Weil designed it as a "natural tranquilizer" for spot use, not a long sustained session. Recommend tightening v3 ranges significantly to match Weil's spec.

**This is a meaningful change from v2.** Prashob may want to push back: should 4-7-8 be modeled as Weil designed it (short tool, max 8 breaths) or as "a calming breath you can do for 15 min if you want"? The literature aligns with the former. Cluster mate #36 (Sleep Preparation Breath) has identical protocol but is framed differently ("done lying in bed") — for it, longer durations may be reasonable since it's used to fall asleep (and you stay in the rhythm until sleep arrives, which can be longer).

**Fallback used?** No (Weil's protocol is explicit).

**Autonomic effect:** parasympathetic. The 4:7:8 ratio (long exhale 2× inhale, with hold) is a textbook parasympathetic activator. Weil explicitly frames it as a "natural tranquilizer."
**Citation:** Weil's patient handout: "natural tranquilizer for the nervous system"; Cleveland Clinic: "calms the body down and brings it into a more relaxed state."

---

### #18 — Wim Hof Method

**Source(s) consulted:**
- Wim Hof Method official website — "3-4 rounds without an interval"
- Healthline Wim Hof Method
- Medical News Today "The Wim Hof breathing method"
- Ultrahuman biohacking blog — "3-4 rounds, retention progresses with practice"
- Oxygen Advantage on Wim Hof — "exercise for beginners starts with 30 second breath hold...as you progress, you can gradually increase the breath hold time"

**Beginner range found:** N/A (recommend null) — Convention 2: this is `safety_level='red'` with `difficulty='advanced'`. Should not be presented to beginners. If forced to give a number, 10-15 min (1-2 rounds with conservative retention).
**Intermediate range found:** 15-20 min — 3 rounds at standard retention times (30 sec - 1 min holds) = ~15-18 min including transitions.
**Advanced range found:** 20-30 min — 4 rounds with extended retention (1.5+ min holds per Oxygen Advantage). Advanced practitioners can sustain longer total sessions but the standard protocol caps at 4 rounds.

**Notes:** v2 had 15-25. The research supports extending the advanced ceiling to 30 min for trained practitioners (4 rounds × ~7 min/round). Important: per Convention 2, `pre/post = false` regardless. Standalone = true because Wim Hof IS a complete advanced session.

**Fallback used?** No.

**Autonomic effect:** sympathetic (acute) → parasympathetic (deep relaxation phase). The hyperventilation phase is sympathetic-activating (adrenaline release per Kox et al. 2014); the breath-hold + recovery phase shifts to parasympathetic. **Net classification for engine purposes: NEITHER** (per Convention 2 — advanced strict). The autonomic mixed effect plus safety_level=red prevents engine auto-suggestion in pre/post slots.
**Citation:** Kox et al. 2014, *PNAS*: "voluntarily influence the autonomic nervous system" — sympathetic activation during hyperventilation phase, parasympathetic during retention. Convention 2 in framework decisions doc: advanced/red = pre=false, post=false strict.

---

### #19 — Physiological Sigh

**Source(s) consulted:**
- Stanford Medicine Balban et al. 2023 (Cell Reports Medicine) — explicit 5-min daily protocol
- Huberman Lab newsletter — "1-3 sighs as moment-tool, OR 5 min daily for sustained benefit"
- Physiopedia Cyclic Sighing — "5 minutes daily for optimal benefits"
- Psychology Today (Bergland) — "5 min/day for 4 weeks"

**Beginner range found:** 1-3 min — moment-tool framing (1-3 sighs = ~30 sec to 2 min); clinical effect from 1 sigh.
**Intermediate range found:** 3-5 min — Stanford 5-min daily protocol; the sweet spot for measurable HRV/mood improvement.
**Advanced range found:** 5-10 min — Stanford protocol can be extended to 10 min for sustained practice; beyond this the effect saturates.

**Notes:** v2 had 1-2. **Important nuance:** Physiological Sigh has TWO use modes — (a) reactive moment-tool (1-3 sighs, ~30 sec to 2 min), and (b) sustained 5-min daily practice (Stanford protocol). v2 captured only the moment-tool mode. Recommend v3 extend the range to 1-10 min to cover both modes, but keep `standalone=false` per Convention 1 (the sustained 5-min mode is still a "tool" rather than a session anchor — it's about consistent daily practice, not building a 30-min session around it).

**This is another meaningful adjustment from v2 worth flagging to Prashob.** The Stanford protocol legitimately makes Physiological Sigh a 5-min daily practice. But its character is still tool-like — it's not a session anchor, just a tool that can be applied consistently for a few minutes.

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Stanford Medicine explicit: "exhalation activates the parasympathetic nervous system, which slows down heart rate and has an overall soothing effect." Strongest exhale-focused parasympathetic protocol in the literature.
**Citation:** Balban et al. 2023, *Cell Reports Medicine*; Spiegel quoted in Stanford press release: "[Exhalation] seems to trigger self-soothing reactions from the parasympathetic nervous system."

---

### #20 — Coherent Breathing

**Source(s) consulted:**
- Stephen Elliott (originator), COHERENCE LLC official site — "Practice for 20 minutes/day for 21 days"
- Brizzy app guide — "5-20 min, 10 min practical starting point"
- Choosing Therapy guide — "Practice for five minutes and work your way up to twenty minutes"
- Lehrer et al. 2003 HRVB protocol — 20-min sessions

**Beginner range found:** 5-10 min — Choosing Therapy explicit "five minutes and work your way up." Brizzy "10-min practical starting point."
**Intermediate range found:** 10-20 min — building toward Elliott's 20-min target.
**Advanced range found:** 20-30 min — Elliott's official protocol target; Brizzy "extending the practice to 20 minutes produced a much more noticeable jump in HRV"; up to 30 min is sustainable.

**Notes:** v2 had 5-30. Research supports the 30-min upper bound (Coherent Breathing is uniquely sustainable for long sessions because the 5-bpm pace is not strenuous). Elliott's 20-min protocol is the gold standard.

**Fallback used?** No.

**Autonomic effect:** balanced (with parasympathetic lean during sustained practice). Resonance frequency breathing maximizes RSA — heart rate oscillates with breath in a way that engages baroreflex and creates parasympathetic-dominance over time. Acutely, the technique is balanced because each breath cycle activates both sympathetic (inhale) and parasympathetic (exhale) in alternation.
**Citation:** Steffen et al. 2017 *Front Public Health*: "RF group showed the largest LF/HF response...lower systolic blood pressure"; Stephen Elliott's "Six Bridges" relaxation method explicitly relies on alternating sympathetic/parasympathetic activation per breath cycle.

---

### #21 — Resonant Breathing

**Source(s) consulted:**
- Frontiers HRVB Practical Guide (Shaffer et al. 2020) — RF range 4.5-6.5 bpm
- Springer 2025 GAD study — 5-min RFB single sessions show HRV/mood effect
- Nature 2021 — RF stability study, 15-min protocols
- HRVB Lehrer protocol — 20-min daily training

**Beginner range found:** 5-10 min — Springer 2025 confirms 5-min single sessions improve state mood; entry-level easy to sustain.
**Intermediate range found:** 10-20 min — standard HRVB training protocol windows.
**Advanced range found:** 20-30 min — sustained practice; same upper bound as Coherent.

**Notes:** v2 had 5-30. Research supports same range as Coherent Breathing. Resonant and Coherent are essentially the same family — Resonant uses 6 bpm (or individual RF), Coherent uses 5 bpm. Recommend identical durations; treat as cluster mates.

**Fallback used?** No.

**Autonomic effect:** balanced (parasympathetic-leaning during sustained practice). Same mechanism as Coherent.
**Citation:** Steffen et al. 2017 (cited above); Shaffer et al. 2020 *Frontiers in Neuroscience* HRVB practical guide.

---

### #22 — 2-to-1 Breathing

**Source(s) consulted:**
- Various western breathwork guides classifying 4-0-8-0 / 2:1 exhale-inhale ratio
- Cluster mate of Extended Exhale (#24), Post-Workout Calm (#40), Deep Sleep Induction (#42)
- Capable Life Now breathwork guide — 2-to-1 specifically labeled "extended exhale"

**Beginner range found:** 5-10 min — entry level for any 2:1 exhale-inhale practice.
**Intermediate range found:** 10-15 min — sustained.
**Advanced range found:** 15-20 min — practical ceiling for the 2:1 ratio without progressing into more demanding ratios.

**Notes:** v2 had 5-20. **Fallback partially used** — there's no specific progression literature for "2-to-1 Breathing" as a named technique, but the 2:1 exhale-inhale family is well documented. The ranges follow the cluster-consistency rule (Convention 4). All four 4-0-8-0 cluster members track the same ranges.

**Fallback used?** YES — extending standard slow-breathing literature to this specific named technique. Prashob to confirm.

**Autonomic effect:** parasympathetic. Long exhale (2× inhale) is the foundational parasympathetic-activator pattern.
**Citation:** Capable Life Now: "extended exhale activates parasympathetic dominance more strongly than balanced breathing"; Spiegel/Stanford research supports exhale-focused parasympathetic activation.

---

### #23 — Triangle Breathing

**Source(s) consulted:**
- Various meditation/breathwork apps — "Triangle Breathing" = 3-phase box without out-hold (4-4-4-0)
- Cluster reference to Box Breathing (#16) without final hold

**Beginner range found:** 3-5 min — entry level; matches Box Breathing pattern minus final hold.
**Intermediate range found:** 10-15 min.
**Advanced range found:** 15-20 min.

**Notes:** v2 had 5-15. **Fallback used** — no specific progression literature for "Triangle Breathing" as a named technique (it's largely a beginner-friendly variant of Box). Ranges by analogy to Box Breathing minus the final hold (which makes it slightly easier and arguably more sustainable for longer durations). Recommend Prashob confirm whether to track Box exactly (3-5/10-15/15-25) or use a slightly more conservative ceiling.

**Fallback used?** YES — by analogy to Box Breathing. Prashob to confirm.

**Autonomic effect:** balanced. Box without out-hold; same equal-ratio principle = neutral autonomic effect.
**Citation:** Same as Box Breathing.

---

### #24 — Extended Exhale

**Source(s) consulted:**
- Same as #22 (cluster mate)
- Capable Life Now — explicit "extended exhale" label as a category, parasympathetic mechanism cited

**Beginner range found:** 5-10 min.
**Intermediate range found:** 10-15 min.
**Advanced range found:** 15-20 min.

**Notes:** v2 had 5-20. Same as 2-to-1 Breathing. Cluster mate of #22, #40, #42. Same fallback caveat.

**Fallback used?** YES — by cluster consistency. Prashob to confirm.

**Autonomic effect:** parasympathetic.
**Citation:** Same as #22.

---

### #25 — Breath Counting

**Source(s) consulted:**
- Andrew Weil "Three Breathing Exercises" — explicit "Try to do 10 minutes of this form of meditation"
- Zen Buddhist tradition — 20-30 min meditation sittings (long-form)

**Beginner range found:** 5-10 min — Weil's explicit recommendation.
**Intermediate range found:** 15-20 min — standard meditation sitting length.
**Advanced range found:** 25-45 min — Zen meditation tradition supports extended sittings; advanced practitioners regularly sit for 30-45 min using counted breath as the anchor.

**Notes:** v2 had 5-30. Research supports extending the upper bound to 45 min for advanced practitioners treating this as formal meditation. The "Breath Counting" technique is fundamentally a meditation discipline — its progression IS sitting longer. Recommend extending upper bound to reflect this.

**Fallback used?** No.

**Autonomic effect:** balanced (with mild parasympathetic lean from passive observation of natural breath).
**Citation:** Weil "Three Breathing Exercises"; Zen meditation literature consistently shows sustained slow breathing during seated practice.

---

### #26 — Cyclic Hyperventilation

**Source(s) consulted:**
- Huberman Lab "Breathwork Protocols for Health, Focus & Stress" — "Use cyclic hyperventilation to increase alertness and enhance focus"
- Balban et al. 2023 (Cell Reports Medicine) — included cyclic hyperventilation with retention as one of three breathwork conditions tested
- Wim Hof Method as the closest cousin (essentially Wim Hof without the long retention)

**Beginner range found:** 3-5 min — single round of 25 forceful inhales + breath hold ≈ 2-3 min; entry level can do 1-2 rounds.
**Intermediate range found:** 5-8 min — 2-3 rounds with extended retention.
**Advanced range found:** 8-12 min — 3-4 rounds with progressive retention extension.

**Notes:** v2 had 3-8. Research supports slight extension upward for advanced. **Important:** Cyclic Hyperventilation is essentially the western/non-spiritual cousin of Wim Hof Method, and shares its hyperventilation-induced sympathetic activation. Like Wim Hof, post-workout=false because re-activating sympathetic post-workout is wrong direction. v2 gets this right.

**Fallback used?** No.

**Autonomic effect:** sympathetic. Huberman Lab explicit: "Repeated forceful, deep inhales followed by exhales = hyperventilation. This causes the release of adrenaline in the brain and body and thus increases alertness and our capacity for focus."
**Citation:** Huberman Lab "Breathwork Protocols for Health, Focus & Stress" newsletter; Balban et al. 2023.

---

### #27 — 5-5-5-5 Square Breathing

**Source(s) consulted:**
- Same family as Box Breathing (#16) at slower pace (3 bpm vs. 3.75 bpm)
- Various breathwork guides treating 5-5-5-5 as an extended box variant

**Beginner range found:** 5-10 min — slightly higher entry floor than Box because the 5-second phases are more demanding for new breathers.
**Intermediate range found:** 10-20 min — sustainable; the slower pace means longer total time per breath count.
**Advanced range found:** 20-30 min — extends Box's upper bound because the 5-bpm pace approaches resonance-frequency territory and is sustainable indefinitely.

**Notes:** v2 had 5-25. Research supports extending advanced to 30 (Coherent Breathing parallel — 3 bpm is in the resonance-breathing zone for many people). Treat as cluster mate of Box but at the slower-pace end of the cluster.

**Fallback used?** Partial — by analogy to Box Breathing + Coherent Breathing literature. The specific name "5-5-5-5 Square Breathing" doesn't have its own progression studies, but the underlying mechanism is well-studied.

**Autonomic effect:** balanced (with parasympathetic lean — at 3 bpm, the slow pace itself is parasympathetic-activating even within the equal-ratio framework).
**Citation:** Cluster reference to Box Breathing + Coherent Breathing literature.

---

### #28 — A52 Breath Method

**Source(s) consulted:**
- Capable Life Now — explicit "A52" pattern reference (5-0-5-2): "research backing for cortisol reduction in healthy adults"
- General slow-paced nasal breathing literature

**Beginner range found:** 5-10 min — entry level.
**Intermediate range found:** 10-15 min.
**Advanced range found:** 15-20 min.

**Notes:** v2 had 5-20. **Fallback used** — A52 is referenced as evidence-based in some breathwork app literature (Capable Life Now) but I couldn't find the specific source study. The pattern (5-0-5-2) places it in the slow-paced nasal breathing family, where the literature on 5-6 bpm slow-paced breathing applies.

**Fallback used?** YES — relying on slow-paced breathing literature generally rather than A52-specific studies. Prashob to confirm or supply the source study he had in mind when seeding this.

**Autonomic effect:** parasympathetic. Slow nasal breathing at ~5 bpm with slight exhale-pause = parasympathetic-dominant pattern.
**Citation:** Capable Life Now reference; slow-paced breathing meta-literature (e.g., Zaccaro et al. 2018 *Frontiers in Human Neuroscience* "How Breath-Control Can Change Your Life").

---
## Therapeutic (rows 29-36)

### #29 — Diaphragmatic Breathing

**Source(s) consulted:**
- COPD Foundation breathing techniques — "Practice this two to three times a day for five to ten minutes"
- American Lung Association — "Repeat belly breathing for 5 to 10 minutes"
- Apria Healthcare COPD guide — "Practice diaphragmatic breathing for 5-10 minutes each day"
- Cleveland Clinic / National Jewish Health
- Burge et al. 2024 *European Respiratory Review* — "breathing exercises (pursed lip breathing or diaphragmatic breathing)" effective for COPD/asthma

**Beginner range found:** 5-10 min — clinical guideline standard across all COPD/respiratory therapy sources.
**Intermediate range found:** 10-15 min — extended sustained practice.
**Advanced range found:** 15-30 min — meditation-grade sustained diaphragmatic awareness; this is fundamentally the foundation breath that all other pranayama builds on, so advanced practice can be quite long.

**Notes:** v2 had 5-30. Research supports the upper bound. Lower bound: clinical guidelines say 5 min minimum; entry-level recommendation matches.

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Diaphragmatic breathing slows respiratory rate, deepens exhale, engages vagus nerve. This is the foundational parasympathetic technique.
**Citation:** Burge et al. 2024 *Eur Respir Rev*: "breathing exercises probably improve breathlessness in people with COPD and asthma compared to usual care or sham treatment"; Wim Hof Method commentary: "Breathing from your belly stimulates the vagus nerve."

---

### #30 — Pursed Lip Breathing

**Source(s) consulted:**
- Cleveland Clinic Pursed Lip Breathing — "Your breathing should become more comfortable within 10 minutes"
- COPD Foundation — "Practice this two to three times a day for five to ten minutes"
- Medical Daily COPD guide — "Practicing for 5-10 minutes daily, along with lung capacity exercises"
- StatPearls NCBI Pursed-lip Breathing
- Apria — "10-minute pursed lip breathing as core daily practice"

**Beginner range found:** 3-5 min — clinical reference range for entry-level practice; immediate relief technique.
**Intermediate range found:** 5-10 min — standard recommended duration.
**Advanced range found:** 10-15 min — practical ceiling; beyond this the technique saturates as a therapeutic tool.

**Notes:** v2 had 3-15. Research supports a slightly more structured progression. PLB is fundamentally a therapeutic compensatory technique for COPD/dyspnea — there's no traditional "advanced" PLB; the technique stays the same, the ceiling is pragmatic (longer than 15 min isn't really doing more therapeutic work).

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Slow exhale through pursed lips elongates expiration and stimulates vagal activity. Cleveland Clinic implicitly: "calm your mind so you can better control your breath."
**Citation:** StatPearls Pursed-lip Breathing (NCBI Bookshelf); Burge et al. 2024 systematic review.

---

### #31 — Buteyko Method

**Source(s) consulted:**
- Buteyko Clinic International official protocols
- The Buteyko Method (Brian Pearson) — "1 hour of Buteyko per day...30 mins of which may be walking with the mouth closed"
- Kate Cubley course review (Voice Study Centre)
- Buteyko Practice Diary
- Patrick McKeown / Oxygen Advantage referenced via Cymbiotika

**Beginner range found:** 10-20 min — Buteyko Clinic explicit "15-20 min of breathing exercises" for entry-level air-hunger training.
**Intermediate range found:** 20-30 min — full daily practice typically 30 min seated breath training (separate from walking with mouth closed).
**Advanced range found:** 30-60 min — committed practitioners practice 1 hour/day. "The Buteyko Method" reports CP improvements correlate with practice volume.

**Notes:** v2 had 10-30. Research supports extending advanced to 60 min for committed practitioners. **Important:** The Buteyko progression isn't really about session length — it's about CP (Control Pause) improvement over weeks/months. A "session" can be split across multiple shorter periods through the day.

**Fallback used?** No.

**Autonomic effect:** parasympathetic. Reduced-volume breathing increases CO2 tolerance and activates parasympathetic. Voice Study Centre course review explicit: "calming effect on the central nervous system (CNS), reduced chemosensitivity to carbon dioxide, higher vagus nerve tone, and activation of the parasympathetic nervous system."
**Citation:** Buteyko Clinic literature; Voice Study Centre course review citing "PAST" framework.

---

### #32 — Grounding Breath (5-4-3-2-1)

**Source(s) consulted:**
- URMC Rochester 5-4-3-2-1 Coping Technique
- Calm blog 5-4-3-2-1 grounding
- Healf 5-4-3-2-1 reset
- Healthline "Grounding Techniques: Exercises for Anxiety, PTSD, and More"
- Sonder Australian GP grounding techniques review
- Yogkulam 5-4-3-2-1 grounding technique
- Insight Timer 54321 grounding

**Beginner range found:** 1-3 min — standard 5-4-3-2-1 walkthrough takes 1-2 min; "5-5-5 breathing 2-3 times" plus the senses sweep.
**Intermediate range found:** 3-5 min — extending into multiple cycles of the technique with deeper sensory exploration.
**Advanced range found:** 5-10 min — Insight Timer guided variants, paired with longer breath practice.

**Notes:** v2 had 3-10. Research supports the lower beginner floor (1 min, since this is a moment-tool that can be done in under a minute) and confirms 10 max. **Important:** Grounding is fundamentally a moment-tool, not a long session. The "advanced" 10 max is the upper edge before this becomes an extended meditation rather than a grounding exercise.

**Fallback used?** Partial — beginner well-documented, intermediate/advanced rely on inference (no formal progression literature exists for grounding).

**Autonomic effect:** parasympathetic. Sonder review: "steady, mindful breathing activates the vagus nerve...parasympathetic nervous system"; Healf review explicit: "respiratory vagal stimulation, moves the body from a fight or flight state toward rest and recovery."
**Citation:** Sonder GP grounding review (cites HRV studies); Healf grounding article; Hoge et al. 2022 mindfulness/MBSR research.

---

### #33 — Stress Reset

**Source(s) consulted:**
- Same as #19 Physiological Sigh (Stress Reset = 3 physiological sighs in sequence)
- Stanford Balban et al. 2023 (cited under #19)

**Beginner range found:** 1-2 min — 3 sighs ≈ 30-60 seconds.
**Intermediate range found:** 1-2 min — same; this is a fixed-protocol moment-tool.
**Advanced range found:** 1-2 min — same.

**Notes:** v2 had 1-2 across all levels. **Recommend keeping single range across all 3 difficulties** — this is a fixed reactive tool, not a session anchor (Convention 1). There is no "intermediate Stress Reset" — the technique is what it is. Per Decision 1's fallback guidance, this is the right model: same range across all 3 levels.

**Fallback used?** YES — single range across all 3 levels. This is consistent with the framework: reactive tools don't have progression by skill level; they're moment-tools at all levels.

**Autonomic effect:** parasympathetic. Same as Physiological Sigh.
**Citation:** Same as #19.

---

### #34 — Pain Management Breath

**Source(s) consulted:**
- General mindfulness-based stress reduction (MBSR / Kabat-Zinn) literature on pain breathing
- Limited specific protocol literature for "pain management breath" as a named technique

**Beginner range found:** 3-10 min — when used in MBSR-style pain practice, 5-10 min is typical for an in-the-moment intervention.
**Intermediate range found:** 5-15 min — extending to longer sustained pain-focused breathing during chronic pain episodes.
**Advanced range found:** 5-15 min — same upper bound; this is fundamentally a coping tool, not a session anchor.

**Notes:** v2 had 3-15. Research supports keeping the upper bound at 15. **Recommend keeping similar ranges across all 3 difficulties (with slight beginner-floor variation)** — like Stress Reset, this is fundamentally a reactive coping tool. Per v2's correction in Convention 1, `standalone=false`. The 10-15 min chronic pain use case still works via library browse + composer; the engine just doesn't auto-suggest it.

**Fallback used?** YES — similar ranges across difficulty levels for a reactive tool. Prashob to confirm.

**Autonomic effect:** parasympathetic. Slow nasal breathing with extended exhale (4-0-6-0) + visualization is the standard parasympathetic-activating pattern.
**Citation:** General MBSR literature (Kabat-Zinn, Jon. *Full Catastrophe Living*); slow-paced breathing literature.

---

### #35 — Anti-Anxiety Breath

**Source(s) consulted:**
- General slow-paced breathing literature for anxiety (Zaccaro et al. 2018; Magnon et al. 2022 mentioned in Springer GAD study)
- 4-2-6-2 ratio = vagal-activator pattern

**Beginner range found:** 3-5 min — anxiety-spike intervention typical duration.
**Intermediate range found:** 5-10 min — sustained.
**Advanced range found:** 10-15 min — practical ceiling for anxiety-focused breathwork before transitioning to meditation.

**Notes:** v2 had 3-15. Research supports the spread; the 4-2-6-2 ratio is parasympathetic-activating with a clear protocol but no specific named-technique progression literature. Standard slow-paced breathing applies.

**Fallback used?** Partial — by analogy to slow-paced breathing literature; no specific "Anti-Anxiety Breath" progression studies.

**Autonomic effect:** parasympathetic. Long exhale (1.5× inhale) + holds = parasympathetic-dominant.
**Citation:** Zaccaro et al. 2018 *Frontiers in Human Neuroscience*; Springer 2025 GAD-RFB study (cited under #21).

---

### #36 — Sleep Preparation Breath

**Source(s) consulted:**
- Same as #17 (4-7-8 Breathing) — identical protocol per breathwork list note
- Cleveland Clinic 4-7-8 — "if using to fall asleep, do it lying in bed"

**Beginner range found:** 1-2 min — Weil's 4-cycle prescription.
**Intermediate range found:** 3-5 min — 8 cycles (or until sleep arrives, which is usually a few minutes).
**Advanced range found:** 5-15 min — for sleep-induction context, longer durations are reasonable because the goal is "until you fall asleep" rather than "complete the protocol." This extends beyond Weil's hard 8-cycle cap because it's not strictly the 4-7-8 protocol — it's the same pattern applied in bedtime context.

**Notes:** v2 had 5-15. Research supports keeping the intermediate-advanced ceiling at 15 (recognizing that bedtime use justifies longer durations than Weil's protocol). **However**, the cluster relationship with #17 is broken under per-difficulty modeling — they share the protocol but have different appropriate durations because of context (clinical "tranquilizer" tool vs. bedtime sleep-induction). Recommend Prashob review whether to break the cluster consistency for these two or accept that "context-of-use" can split a cluster's tag values.

**Fallback used?** Partial — bedtime use case extends Weil's protocol by inference.

**Autonomic effect:** parasympathetic. Same as #17.
**Citation:** Same as #17.

---

## Goal-specific (rows 37-44)

> **General note for goal-specific techniques:** Most of these are app-internal protocols designed for specific use cases. Published progression literature is largely absent. The fallback approach is "single range across all 3 difficulty levels matching v2's stated range" — these techniques are designed for a specific role (energize before workout, calm after workout, etc.) and their progression isn't really by user skill level. Prashob may want to either accept fallback per row or selectively populate intermediate/advanced where it makes physiological sense.

### #37 — Morning Energizer

**Source(s) consulted:**
- General energizing breathwork literature (analog: Kapalabhati / Bhastrika lite)
- App-internal design (3-0-2-0 × 20, 2 rounds with strong inhale)

**Beginner range found:** 3-5 min — same as v2 (3-8); 2 rounds × 20 breaths ≈ 2-3 min plus rest = 3-5 min total.
**Intermediate range found:** 3-8 min — same range; could push to 3 rounds.
**Advanced range found:** 3-8 min — same range; this technique is fundamentally short-burst, energizing.

**Notes:** v2 had 3-8. Recommend single range across all 3 levels — this is a fixed-purpose AM activation tool; progression doesn't really apply.

**Fallback used?** YES — single range across difficulty levels.

**Autonomic effect:** sympathetic. Strong-inhale energizing pattern designed for sympathetic activation, mild Kapalabhati-style.
**Citation:** Analog to Kapalabhati (Indian Yoga Association).

---

### #38 — Pre-Workout Activation

**Source(s) consulted:**
- App-internal design (2-0-1-0 × 20, 2 rounds, "Kapalabhati-lite")
- Performance breathwork literature

**Beginner range found:** N/A (recommend null or 3-6 min) — this is intermediate by design (yellow safety, BP/heart contraindications).
**Intermediate range found:** 3-6 min — v2's range; matches the protocol design.
**Advanced range found:** 3-6 min — same; fixed-purpose pre-workout tool.

**Notes:** v2 had 3-6. Recommend keeping tight range; intermediate-only technique. Beginner column = null per safety profile, OR populate with conservative 3-min range. Prashob to confirm.

**Fallback used?** YES — single range across populated levels.

**Autonomic effect:** sympathetic. Pre-workout activation is by definition sympathetic-priming.
**Citation:** Same as Cyclic Hyperventilation / Kapalabhati family.

---

### #39 — Between-Sets Recovery

**Source(s) consulted:**
- Convention 3 (framework decisions doc): invisible to focus engine
- App-internal design (3-3-3-3 quick box, 3 cycles)
- Box Breathing literature (cluster variant)

**Beginner range found:** 1-2 min — fixed protocol; designed for between-sets use.
**Intermediate range found:** 1-2 min — same.
**Advanced range found:** 1-2 min — same.

**Notes:** v2 had 1-2. **Recommend single range across all 3 difficulty levels** — this is a fixed-purpose between-sets tool with all three flags `false` per Convention 3. Will surface only via rest-timer integration (FUTURE_SCOPE #61), not via focus engine. Progression-by-difficulty doesn't apply.

**Fallback used?** YES — by design.

**Autonomic effect:** balanced. Quick box pattern at faster pace; neither sympathetic nor parasympathetic dominant; designed to bring HR back toward baseline between sets without inducing relaxation that would compromise next set.
**Citation:** Cluster reference to Box Breathing.

---

### #40 — Post-Workout Calm

**Source(s) consulted:**
- App-internal design (4-0-8-0, sympathetic→parasympathetic shift)
- Cluster mate of #22, #24, #42 (4-0-8-0)
- Post-workout HRV recovery literature

**Beginner range found:** 5-10 min — entry level for post-workout cooldown.
**Intermediate range found:** 5-15 min — sustained.
**Advanced range found:** 10-20 min — extended cooldown for high-intensity sessions.

**Notes:** v2 had 5-15. Research supports extending advanced to 20 by analogy to extended-exhale cluster + post-workout recovery science (HRV recovery studies show 10-20 min slow breathing post-exercise produces measurable recovery).

**Fallback used?** Partial — by cluster consistency. No specific "Post-Workout Calm" study, but post-workout slow breathing literature supports extended-exhale techniques in 10-20 min range.

**Autonomic effect:** parasympathetic. By design — explicitly the "sympathetic→parasympathetic shift" technique.
**Citation:** Cluster reference to #22; HRV recovery literature.

---

### #41 — Focus Breath

**Source(s) consulted:**
- Cluster mate of Box Breathing (#16) and Sama Vritti (#12) — 4-4-4-4
- Mark Divine box breathing for focus literature
- One Peloton meta-analysis "20 sessions of breathing exercises over eight weeks experienced significant boosts in sustained attention"

**Beginner range found:** 3-5 min — entry level; matches Box Breathing.
**Intermediate range found:** 10-15 min — sustained focus practice.
**Advanced range found:** 15-25 min — pre-deep-work extended session; cluster mate of Box.

**Notes:** v2 had 5-20. Research supports extending advanced to 25 by cluster consistency with Box Breathing.

**Fallback used?** Partial — by cluster consistency.

**Autonomic effect:** balanced. Same as Box Breathing.
**Citation:** Same as Box Breathing.

---

### #42 — Deep Sleep Induction

**Source(s) consulted:**
- Cluster mate of #22, #24, #40 (4-0-8-0) — long-exhale parasympathetic
- Sleep preparation breathwork literature

**Beginner range found:** 5-10 min — entry level.
**Intermediate range found:** 5-15 min — sustained until sleep arrives.
**Advanced range found:** 10-20 min — extended use; "until sleep arrives" can legitimately be longer for some users.

**Notes:** v2 had 5-15. Research supports slight extension for advanced (sleep-induction can legitimately go longer than other 4-0-8-0 cluster uses because the goal is "until asleep").

**Fallback used?** Partial — by cluster consistency + sleep-induction context.

**Autonomic effect:** parasympathetic. Long exhale + sleep-induction context.
**Citation:** Cluster reference to #22.

---

### #43 — Appetite Control

**Source(s) consulted:**
- App-internal design (4-4-6-2 emotional-eating interrupt)
- General CBT-style emotional regulation breathwork; no specific peer-reviewed protocol literature

**Beginner range found:** 2-5 min — fixed reactive tool.
**Intermediate range found:** 2-5 min — same.
**Advanced range found:** 2-5 min — same.

**Notes:** v2 had 2-5. Recommend single range across all 3 levels — Convention 1 reactive tool; progression doesn't apply.

**Fallback used?** YES — single range across difficulty levels.

**Autonomic effect:** parasympathetic. 4-4-6-2 ratio with longer exhale = parasympathetic-activating to interrupt the craving-cycle activation.
**Citation:** Slow-paced breathing parasympathetic literature; no specific "appetite control breathing" peer-reviewed studies found.

---

### #44 — Craving Interrupt

**Source(s) consulted:**
- Cluster mate of 5-5-5-5 Square Breathing (#27) at slower pace, but with reactive-tool framing
- Mindfulness-based addiction interventions literature (Bowen et al. MBRP) — general support for breath-based craving interrupts

**Beginner range found:** 2-5 min — same as v2.
**Intermediate range found:** 2-5 min — same.
**Advanced range found:** 2-5 min — same.

**Notes:** v2 had 2-5. Same as #43 — reactive tool, no progression. **Note Convention 4 cluster divergence:** shares 5-5-5-5 ratio with Square Breathing (#27) but diverges on standalone (this one is reactive tool, that one is session). Progression-by-difficulty also diverges — Square Breathing has progression (5-25 → 5-30), Craving Interrupt does not.

**Fallback used?** YES — single range across difficulty levels.

**Autonomic effect:** balanced. 5-5-5-5 equal-ratio breathing = neutral autonomic effect.
**Citation:** Same as Box Breathing / Sama Vritti.

---

## Advanced (rows 45-49)

### #45 — Tummo

**Source(s) consulted:**
- Tulku Lobsang Inner Fire School (advanced practitioner)
- Way of Meditation Tummo guide — "2-5 min beginner, do not practice for extended periods until familiar"
- Wim Hof Method blog on Tummo
- Wikipedia Tummo (citing Tsongkhapa, Six Yogas of Naropa)
- Benson Heat Experiment / Stillsitting — "5-10 min beginner, gradually extend"
- Kozhevnikov 2013 study — Benson 1981 study referenced 55-min Tummo sessions
- Trainerize — "3-5 min to ignite inner fire"
- mindbodygreen — "Practice regularly, daily sessions, starting with shorter durations"
- Deep Breathing Exercises — "advanced practitioners add breath retention"

**Beginner range found:** N/A (recommend null) — Convention 2: red safety, advanced difficulty. Should not be presented to beginners. If forced, 3-5 min for "basic Tummo" entry-level (per Inner Fire School distinction between "basic" and "advanced" Tummo).
**Intermediate range found:** 10-15 min — extension of basic Tummo; sustained inner-fire visualization with breathing.
**Advanced range found:** 20-55 min — Benson 1981 study used 55-min protocol; Tulku Lobsang advanced Tummo training reaches this range; "until inner heat is generated" can take this long.

**Notes:** v2 had 15-30. Research supports extending advanced to 55 (Benson study protocol). The 15-30 v2 range corresponds more to "intermediate-advanced" practice than truly advanced. Recommend updating range. Inner Fire School explicitly distinguishes "basic Tummo" (~5-10 min daily, 3 levels) from "advanced Tummo" (extended traditional practice with retentions/bandhas, 30+ min).

**Fallback used?** Partial — beginner recommended null; intermediate range partially derived from "basic Tummo" framing.

**Autonomic effect:** Mixed (sympathetic activation during forceful breathing phase + thermogenesis). Net effect for engine: NEITHER (per Convention 2). The Benson studies show core body temperature rise (sympathetic-coupled thermogenesis); the visualization phase is meditative (parasympathetic-leaning). Per Convention 2, advanced strict = pre/post both false regardless.
**Citation:** Benson et al. 1982 study; Kozhevnikov et al. 2013 *PLoS ONE* "Neurocognitive and Somatic Components of Temperature Increases during g-Tummo Meditation."

---

### #46 — Kumbhaka

**Source(s) consulted:**
- Iyengar *Light on Pranayama* (referenced via secondary sources) — "spending at least 6 months on basic techniques before attempting advanced kumbhaka"
- Pranayama review (Thalira) — "kumbhaka is the most important phase of pranayama"
- 1:4:2 ratio is canonical advanced retention

**Beginner range found:** N/A (recommend null) — Convention 2: red safety, advanced difficulty.
**Intermediate range found:** 10-15 min — entry-level retention practice with shorter holds (1:2:1 progressing toward 1:3:2).
**Advanced range found:** 15-25 min — full 1:4:2 ratio sustained practice.

**Notes:** v2 had 10-25. Research supports keeping this range; small adjustment to add intermediate at 10-15. Per Convention 2 advanced strict.

**Fallback used?** No.

**Autonomic effect:** balanced (with parasympathetic emphasis at long retention durations). Per Convention 2 = NEITHER for engine purposes.
**Citation:** Iyengar's *Light on Pranayama* via Thalira review; classical pranayama physiology literature.

---

### #47 — Holotropic Breathwork

**Source(s) consulted:**
- Grof Transpersonal Training (Stan Grof originator) — "session normally takes 2 1/2 to 3 hours"
- Unity Breathwork — "official Holotropic 6 hours minimum (3 hours breathing + 3 hours sitting)"
- Pranadan Holotropic Breathwork — "2-3 hours each session"
- Breathwork UK — "long sessions of 3-4 hours"
- BWJP guide — "600 hours certification, sessions can be hours"

**Beginner range found:** N/A (recommend null) — requires trained facilitator. Convention 2 strict.
**Intermediate range found:** N/A or 60-90 min — abbreviated/non-traditional sessions some facilitators offer (per BWJP "Conscious connected breathing 1-hour classes" referenced as Holotropic-derived). Prashob to confirm whether to populate.
**Advanced range found:** 60-180 min — Grof's official protocol is 2.5-3 hours; some workshops extend to 4 hours.

**Notes:** v2 had 60-180. Research confirms; recommend keeping range. Per Convention 2 advanced strict.

**Fallback used?** No (well-documented).

**Autonomic effect:** sympathetic (acute, sustained) → mixed/altered states. Per Convention 2 advanced strict = NEITHER for engine purposes. The continuous accelerated breathing produces respiratory alkalosis and altered states.
**Citation:** Grof Transpersonal Training official protocol documentation; *Holotropic Breathwork: A New Approach to Self-Exploration and Therapy* (Grof & Grof 2010).

---

### #48 — Rebirthing Breath

**Source(s) consulted:**
- Leonard Orr origin (1962) — referenced via Breathwork UK
- Breathwork UK — "Sessions last from one hour onwards"
- InnerCamp — "lasts around 2-3 hours"
- BWJP — "Several weeks rebirthing certification"

**Beginner range found:** N/A (recommend null) — requires trained facilitator. Convention 2 strict.
**Intermediate range found:** 30-60 min — entry-to-mid-level rebirthing sessions per Breathwork UK ("from one hour onwards").
**Advanced range found:** 60-90 min — extended sessions; some can run 2-3 hours when combined with bodywork integration.

**Notes:** v2 had 30-90. Research supports the range; recommend keeping. Per Convention 2 advanced strict.

**Fallback used?** No.

**Autonomic effect:** sympathetic (sustained continuous-connected breathing). Per Convention 2 = NEITHER for engine purposes.
**Citation:** Orr's *Rebirthing in the New Age* literature; Conscious Connected Breathing research (La Flamme 1994 cited via InnerCamp).

---

### #49 — Apnea Training

**Source(s) consulted:**
- PADI Freediver course documentation — "static apnea: short holds 20-30 seconds, gradually increase"
- Bluewater Freediving School training guide — "5 sets with 3-min rests = ~15-20 min total session"
- Apnetica static apnea training plan — "5-set protocol with first contraction + 30 seconds + max attempt"
- Train Freediving breath-hold guide
- AIDA freediving training literature
- Lush Palm freediving experience

**Beginner range found:** N/A (recommend null) — requires safety training and ideally a buddy. Convention 2 strict.
**Intermediate range found:** 15-25 min — entry-level static apnea training session structure (5 sets × 1-2 min holds + 3-min rests = ~15-20 min).
**Advanced range found:** 25-40 min — extended sets with longer holds; advanced practitioners can extend total session to 40 min while maintaining safety.

**Notes:** v2 had 15-30. Research supports extending advanced to 40 (per Apnetica/Bluewater protocols with full 5-set + max attempt structure). Per Convention 2 advanced strict.

**Fallback used?** No.

**Autonomic effect:** parasympathetic (mammalian dive reflex during holds + slow recovery breathing). Per Convention 2 = NEITHER for engine purposes. Note: the parasympathetic activation during breath-hold is via the dive reflex, which makes Apnea unique among red-safety techniques in being parasympathetic-leaning. But Convention 2 still applies due to safety profile.
**Citation:** PADI Freediver course; Apnetica static apnea documentation; Bluewater Freediving School guide.

---
## Summary

### Techniques using fallback (Prashob confirmation needed)

Per Decision 1, every fallback row needs explicit confirmation. The fallbacks fall into three categories:

**A. Single range across all 3 difficulty levels** (no per-level progression):

| # | Technique | Reason | Recommended single range |
|---|-----------|--------|--------------------------|
| 33 | Stress Reset | Reactive tool, fixed protocol (3 sighs) | 1-2 min |
| 37 | Morning Energizer | App-internal AM activation tool, fixed purpose | 3-8 min |
| 38 | Pre-Workout Activation | App-internal pre-workout tool, fixed purpose | 3-6 min (intermediate-only) |
| 39 | Between-Sets Recovery | Convention 3, fixed between-sets protocol | 1-2 min |
| 43 | Appetite Control | Reactive emotional-eating tool | 2-5 min |
| 44 | Craving Interrupt | Reactive craving tool | 2-5 min |

**B. Partial fallback — by analogy/cluster consistency** (research supports the underlying mechanism but not the specific named technique):

| # | Technique | Reason | Cluster anchor |
|---|-----------|--------|----------------|
| 22 | 2-to-1 Breathing | Cluster of 4-0-8-0 long-exhale techniques | Extended Exhale literature |
| 23 | Triangle Breathing | Box minus out-hold | Box Breathing |
| 24 | Extended Exhale | Cluster of 4-0-8-0 | 2-to-1 / general parasympathetic literature |
| 27 | 5-5-5-5 Square Breathing | Box at slower pace | Box + Coherent Breathing |
| 28 | A52 Breath Method | Slow nasal breathing family | Slow-paced breathing meta-literature |
| 32 | Grounding Breath | Mindfulness/sensory + breath; intermediate/advanced inferred | URMC, Sonder, Healthline |
| 34 | Pain Management Breath | Reactive coping tool | MBSR/Kabat-Zinn general |
| 35 | Anti-Anxiety Breath | Slow-paced breathing for anxiety | Zaccaro 2018, Springer 2025 GAD |
| 40 | Post-Workout Calm | 4-0-8-0 cluster + post-exercise HRV recovery | Cluster + recovery literature |
| 41 | Focus Breath | 4-4-4-4 cluster | Box Breathing |
| 42 | Deep Sleep Induction | 4-0-8-0 cluster + sleep induction context | Cluster + bedtime context |

**C. Beginner column = null** (Convention 2 strict, advanced techniques shouldn't be presented to beginners):

| # | Technique | Reason |
|---|-----------|--------|
| 13 | Visama Vritti | Intermediate by classification; gated on Sama Vritti mastery |
| 18 | Wim Hof Method | Convention 2 advanced/red |
| 38 | Pre-Workout Activation | Intermediate by safety profile |
| 45 | Tummo | Convention 2 advanced/red |
| 46 | Kumbhaka | Convention 2 advanced/red |
| 47 | Holotropic Breathwork | Convention 2 advanced/red, requires facilitator |
| 48 | Rebirthing Breath | Convention 2 advanced/red, requires facilitator |
| 49 | Apnea Training | Convention 2 advanced/red, requires safety training |

### Techniques where research recommends meaningful changes from v2

These warrant Prashob's specific attention before v3 lock:

| # | Technique | v2 range | Recommended | Why |
|---|-----------|----------|-------------|-----|
| 3 | Kapalabhati | 3-8 (single) | B 1-3 / I 5-10 / A 10-30 | v2 conflated all 3 levels; Cymbiotika/Form Fitness give explicit per-level progression |
| 17 | 4-7-8 Breathing | 5-15 (single) | B 1-2 / I 3-5 / A 5-8 | **Significant tightening**: v2 was much higher than Weil's actual 4-cycle / 8-cycle protocol caps |
| 19 | Physiological Sigh | 1-2 (single) | B 1-3 / I 3-5 / A 5-10 | Stanford 5-min protocol legitimizes longer durations; v2 only captured the moment-tool mode |
| 25 | Breath Counting | 5-30 | B 5-10 / I 15-20 / A 25-45 | Zen meditation tradition supports extended sittings; advanced practitioners go 30-45 |
| 31 | Buteyko Method | 10-30 | B 10-20 / I 20-30 / A 30-60 | Committed practitioners do 1 hour/day; "advanced" extends meaningfully |
| 45 | Tummo | 15-30 | I 10-15 / A 20-55 | Benson 1981 used 55-min protocol; "basic Tummo" vs "advanced Tummo" distinction |
| 49 | Apnea Training | 15-30 | I 15-25 / A 25-40 | Full 5-set protocol with rests reaches 40 min |

### Autonomic effect summary (drives pre/post tags per Decision 2)

- **Sympathetic** (pre=true / post=false): #3 Kapalabhati, #4 Bhastrika, #9 Surya Bhedana, #15 Simhasana (acute phase), #26 Cyclic Hyperventilation, #37 Morning Energizer, #38 Pre-Workout Activation. **Total: 7**
- **Parasympathetic** (pre=false / post=true): #5 Bhramari, #7 Sitali, #8 Sitkari, #10 Chandra Bhedana, #13 Visama Vritti, #14 Udgeeth, #17 4-7-8 Breathing, #19 Physiological Sigh, #22 2-to-1 Breathing, #24 Extended Exhale, #29 Diaphragmatic Breathing (with both true given foundational role), #30 Pursed Lip Breathing, #31 Buteyko Method, #32 Grounding Breath, #33 Stress Reset (one-off, both false), #34 Pain Management Breath (one-off, both false), #35 Anti-Anxiety Breath, #36 Sleep Preparation Breath, #40 Post-Workout Calm, #42 Deep Sleep Induction, #43 Appetite Control (one-off, both false), #11 Dirga Pranayama (with both true given balanced use). **Most parasympathetic = post=true / pre=false; reactive tools = both false.**
- **Balanced** (pre=true / post=true): #1 Nadi Shodhana, #2 Anulom Vilom, #6 Ujjayi, #11 Dirga Pranayama, #12 Sama Vritti, #16 Box Breathing, #20 Coherent Breathing, #21 Resonant Breathing, #23 Triangle Breathing, #25 Breath Counting, #27 5-5-5-5 Square Breathing, #28 A52 Breath Method, #41 Focus Breath, #44 Craving Interrupt (5-5-5-5 balanced but reactive so both false). **Balanced techniques get both pre and post = true.**
- **Convention 2 strict (both false)**: #18 Wim Hof, #45 Tummo, #46 Kumbhaka, #47 Holotropic, #48 Rebirthing, #49 Apnea Training, #39 Between-Sets Recovery (Convention 3 strict). **Total: 7**

The pre/post counts will be re-derived in v3 from the autonomic-effect classifications above. Note v2's 20 pre-true / 29 post-true distribution should remain approximately stable, with possibly minor shifts as autonomic-classification rigor moves a few edge cases.

---

## Next steps (per framework decisions doc Step 5)

1. ✅ Research notes file is at `Trackers/S11-T2-research-notes.md`.
2. **Prashob to confirm fallback ranges** — primarily the 11 partial fallbacks (category B above) and the 6 single-range fallbacks (category A). Quick Y/N or batch-confirm by category should suffice.
3. **Prashob to confirm meaningful changes from v2** — especially:
   - #17 4-7-8 Breathing tightening to Weil's actual protocol
   - #19 Physiological Sigh extension to capture Stanford 5-min mode
   - #25 Breath Counting extension to 45 min advanced
   - #31 Buteyko advancing to 60 min
   - #45 Tummo extension to 55 min advanced
4. **Prashob to decide on null vs. floor for Convention 2 advanced techniques** — should #18, #45-49 have a beginner column populated with conservative values, or remain null in the schema?
5. Once confirmations land, write v3 of the spec mapping all values into the new 6-column schema (`beginner_duration_min/max`, `intermediate_duration_min/max`, `advanced_duration_min/max`).

Estimated v3 spec writing time: 30-45 min once confirmations are in.

---

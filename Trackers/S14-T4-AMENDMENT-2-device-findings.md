# S14-T4 — AMENDMENT 2 — Device-test findings (phase labels + audio)

**Date:** May 11, 2026
**Source:** Prashob device test (steps from spec §11)
**Trigger:** Device test surfaced two issues during cross-pillar full-body 67-min flow on Samsung Android.

This amendment captures device-driven findings that arrived **after** the pre-flight drift log (`S14-T4-AMENDMENT-1-pre-flight-drifts.md`). The two artifacts are kept separate because they have different provenance: AMENDMENT-1 was architect-side resolution before code was written, AMENDMENT-2 is device-side findings during acceptance.

---

## Finding 1 — Phase labels show internal engine slugs

### Symptom

Home page "Today" card subtitle reads:

> Bookend Open → Yoga warm → Strength → Breath → Bookend Close

These are engine-internal phase slugs (`bookend_open`, `bookend_close`) prettified with a generic `_` → space + title-case transform. Not user-facing language.

### Expected

Per Blueprint v5 §6, the five phases are user-facing:
- Opening (5 min energizing breath)
- Warm-up (5–7 min yoga)
- Main Work (30–40 min strength / yoga / HIIT)
- Cool-down (5–8 min yoga)
- Closing (5 min calming breath + 1 min silent sit)

### Root cause

The Today-card phase-summary builder concatenates phase slugs via `phase.replaceAll('_', ' ').titleCase()` (or equivalent). No explicit slug → display-string map. Engine emits `bookend_open` and the UI lifts it verbatim.

### Resolution — fix-forward

Add an explicit `phaseDisplayLabel(String slug, String contentType)` helper. Single function, single import site.

**Mapping (definitive):**

| Engine slug | Display label | Notes |
|---|---|---|
| `bookend_open` | Opening | Cross-pillar phase 1 |
| `warmup` | Warm-up | Cross-pillar phase 2 (yoga) |
| `main` | Strength / Yoga / Breathwork | Pillar-pure phase, label = `contentType` title-cased |
| `cooldown` | Cool-down | Cross-pillar phase 4 (yoga) |
| `bookend_close` | Closing | Cross-pillar phase 5 |
| `centering` | Centering | State-focus leg 1 |
| `practice` | Practice | State-focus leg 2 |
| `reflection` | Reflection | State-focus leg 3 |
| _(any other slug)_ | _slug_ → `replaceAll('_', ' ')` → title-case | Defensive fallback for unknown future slugs |

**Files affected (likely — pre-flight discovers):**

1. `app/lib/pages/home/widgets/todays_session_card.dart` (or equivalent — wherever the "Today" card subtitle is built). Search `bookend` in `app/lib/`.
2. `app/lib/pages/session/widgets/phase_indicator.dart` if it labels segments.
3. `app/lib/pages/session/widgets/phase_preview_sheet.dart` if it lists phases.

**New file:**

- `app/lib/utils/phase_label.dart` — single-purpose helper. Top-level function `String phaseDisplayLabel(String slug, {String? contentType})`. No class wrapper.

**Test:** Today card subtitle on home page reads:
> Opening → Warm-up → Strength → Closing  (for biceps 4-phase — no cool-down)

or:

> Opening → Warm-up → Strength → Cool-down → Closing  (for full-body 5-phase)

**Severity:** Cosmetic, but it's the first thing the user sees on Today card. Ship-blocker for polish.

**Effort:** ~30 LOC + 2-3 call-site replacements. ~15 min.

---

## Finding 2 — Breathwork player has no audio

### Symptom

Phase 1 (`bookend_open` breathwork) plays the visual timer circle correctly but **emits no audio cues**. Verified silent in both standalone Breathwork-tab usage AND embedded cross-pillar phase.

### Investigation — NOT a T4 regression

Past-conversation search (this chat) confirmed: **Sprint 9 (Flutter breathwork rebuild, Apr 16, 2026) explicitly chose option B: "No audio for now, add later."** The React PWA had Web AudioContext-driven sine wave + filtered noise breath sounds (Sprint 4 work, later refined in `S4-T3`). The Flutter port never carried that audio implementation forward — it shipped silent by design and has been silent for 25 days.

T4 extracted `BreathworkPlayer` from `BreathworkTimerPage` faithfully. There was no audio plumbing to lose. The standalone-vs-embedded check confirms parity: both are silent because both inherit from the same Sprint 9 codebase.

### Resolution — defer to FUTURE_SCOPE

Add a new FUTURE_SCOPE entry (next sequential number — `#205` or whatever the current next is):

> **#XXX — Breathwork audio (Flutter)** | Mobile / Polish | Sprint 9 shipped Flutter breathwork silent — no inhale/hold/exhale audio cues. React PWA had Web AudioContext-driven sounds (Sprint 4 `S4-T3`) but were not ported. Implementation options for Flutter: (a) `audioplayers` package + pre-recorded chime/breath MP3s in `app/assets/audio/`; (b) `flutter_tts` for spoken cues ("inhale… hold… exhale…"); (c) `just_audio` + procedurally-generated breath envelopes via PCM buffer. Recommend (a) for simplicity — pre-recorded soft chimes at phase transitions match what top breathwork apps (Othership, Breathwrk) do for non-narrated mode. Surfaced May 11, 2026 during S14-T4 device test. **NOT a T4 regression** — silent state predates T4 by 25 days.

This is **not** a T4 fix. Document and move on.

### What this means for T4 acceptance

T4's definition-of-done does not include audio. The breathwork phase works as specified — timer ticks, phase circle animates, completion fires `onPhaseComplete`. Audio is a separate product gap that pre-existed T4.

**Ship T4 with audio gap documented in FUTURE_SCOPE.**

---

## Finding 3 — Hardware back button on session page (NON-ISSUE)

Verified during device test: Android hardware back button triggers the close-confirm bottom sheet rather than popping to previous route. This is the intended `PopScope` behavior per spec Decision #10. Documented here for completeness — no action.

---

## Drift log delta (rolls up into the T4 drift table)

| # | Date | Source | Drift | Resolution |
|---|---|---|---|---|
| D7 | May 11, 2026 | Device test | Today card subtitle shows engine slugs `bookend_open`/`bookend_close` instead of user labels "Opening"/"Closing" | Fix-forward via new `app/lib/utils/phase_label.dart` helper + 2-3 call-site updates. Single commit on `s14-t4` before the feature commit. |
| D8 | May 11, 2026 | Device test | Breathwork player has no audio in either standalone or embedded mode | NOT T4 — pre-existing Sprint 9 deferral (option B chosen Apr 16). Filed as FUTURE_SCOPE entry. Ship T4 as-is. |
| D9 | May 11, 2026 | Device test | Hardware back button on session page triggers close-confirm | Non-issue — intended `PopScope` behavior per spec Decision #10. |

---

## Commit plan delta

Original T4 commit plan had a single feature commit. AMENDMENT-2 adds **one prepended commit before the feature commit**:

```
git add app/lib/utils/phase_label.dart
git add app/lib/pages/home/widgets/todays_session_card.dart
git add app/lib/pages/session/widgets/phase_indicator.dart    # if touched
git add app/lib/pages/session/widgets/phase_preview_sheet.dart # if touched
git commit -m "fix(s14-t4): use user-facing phase labels instead of engine slugs

Today card subtitle and phase indicator were rendering engine-internal slugs
('bookend_open', 'bookend_close') prettified to title case. Added a single
phaseDisplayLabel() helper mapping engine slugs to Blueprint v5 user labels
(Opening / Warm-up / Strength / Cool-down / Closing for cross-pillar;
Centering / Practice / Reflection for state-focus).

Surfaced during S14-T4 device test. Documented in
Trackers/S14-T4-AMENDMENT-2-device-findings.md."
```

Then the original feature commit, then the tracker chore commit. **Three commits total** instead of two.

---

*Authored May 11, 2026 from device-test findings. Companion to AMENDMENT-1 (pre-flight drifts).*

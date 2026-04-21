# S10-T5: Home Page Redesign — Design Document

**Status:** Blender mesh splitting ✅ **COMPLETE (27/27)**. All workflow learnings captured. Ready for GLB export and T5a Claude Code implementation.
**Created:** Apr 17, 2026
**Last Updated:** Apr 22, 2026 (mesh splitting complete; final count 27 total = 26 muscle + 1 base)
**Owner:** Prashob (CEO/PO), Claude.ai (PM)

---

## Why This Ticket Exists

The existing DailyForge home page (from the React PWA era, rebuilt in Flutter Sprint 8) is functional but generic — dashboard cards, stats, quick-start buttons. Prashob wants DailyForge to feel like a top-tier App Store app. A distinctive hero feature creates differentiation that no other fitness/yoga/breathwork app currently has.

**Sequencing note:** Sprint 10's original scope (T1-T4) shipped complete. T5 was scoped in **late on Apr 17, 2026** during a design exploration session, adding a fifth ticket to Sprint 10 rather than pushing home redesign to Sprint 11. Reason: Sprint 11's 5-phase session launch point depends on the home page design, so doing home first avoids rework.

---

## Design Direction (LOCKED)

### Visual Language
- **Color world:** Light mode, cream background (#fafaf7), white cards, soft shadows
- **Aesthetic reference:** Apple Health + Whoop + Oura — premium, polished, data-rich
- **Accent color:** Coral (#D85A30 for primary, #8A3410 for deep coral text)

### Hero Feature: Interactive 3D Body Map
- **Full-body rotatable anatomical figure** at top of home page
- **User can drag to rotate 360°** in any direction (not just 4 preset angles)
- **Individual muscles are tappable** — tap a muscle, it stays selected with visible highlight
- **Tooltip card below figure updates** with that muscle's data (last trained, volume, top exercise)
- **Tap the same muscle to deselect**
- **Heatmap coloring:** Base color (fresh) → coral → deep red (heavily trained), based on training volume

### Muscle Base Color (LOCKED Apr 17, 2026)
**`#C8C8C8` — neutral gray.**

Full heatmap ramp:
- 0-20 (fresh): `#C8C8C8`
- 20-40 (light): `#F5C4B3`
- 40-60 (medium): `#F0997B`
- 60-80 (heavy): `#D85A30`
- 80-100 (max): `#993C1D`

### Two Data Modes on Figure
- **Muscles** — strength volume heatmap (default)
- **Flexibility** — spine/hips/shoulders mobility from yoga session data

### Scroll Layout (below the 3D figure)
1. Selected muscle card (data for whichever muscle is tapped)
2. Heatmap legend (5-color gradient explainer)
3. Today's session card — small, secondary, "Start full session" button
4. Stats row (Streak / Minutes / Year)
5. Last 4 weeks activity chart (stacked bars: strength/yoga/breath)
6. Recent wins (PRs, milestones)
7. Inspirational stat at bottom ("47 days of practice in 2026")

---

## Tech Stack Decisions (LOCKED)

| Decision | Chosen |
|---|---|
| Rendering approach | `model_viewer_plus` (WebView-based) |
| Model source | CharacterZone (free Sketchfab CC-BY) |
| Rotation interaction | Free-drag 360° |
| Muscle interaction | Split mesh (per-muscle precision) |

---

## Muscle Split Plan (LOCKED Apr 20, 2026; FINAL COUNT Apr 22, 2026)

**Total: 27 meshes** — 26 tappable muscle regions + 1 base.

Rationale: split mesh granularly now so future DB upgrades (L/R asymmetry tracking, upper/lower distinctions) don't require re-splitting. Code-level grouping layer maps 26 muscle meshes to the DB's 11 muscle groups. Merged meshes (abs_upper, abs_lower, lower_back, glutes) reflect the fact that these muscles train bilaterally and users don't think per-side; obliques and upper_back kept split for potential Max-tier asymmetry tracking.

**Historical note on count:** Originally planned 30 meshes → revised to 28 during execution (abs merged, glutes merged) → final tally on completion is 27 (correct math: 26 muscle + 1 base). Design doc earlier referenced "28 total" which was an off-by-one typo.

### Final split list (all 27 completed ✅)

| # | Region | Sub-meshes | Today's DB group |
|---|---|---|---|
| 1-2 | Chest | chest_L, chest_R | Chest |
| 3-4 | Shoulders | delt_L, delt_R | Shoulders |
| 5-6 | Biceps | bicep_L, bicep_R | Biceps |
| 7-8 | Triceps | tricep_L, tricep_R | Triceps |
| 9-10 | Forearms | forearm_L, forearm_R | Forearms |
| 11 | Upper abs | abs_upper (merged) | Core (grouped) |
| 12 | Lower abs | abs_lower (merged) | Core (grouped) |
| 13-14 | Obliques | oblique_L, oblique_R | Core (grouped) |
| 15-16 | Upper back / traps | upper_back_L, upper_back_R | Back (grouped) |
| 17-18 | Lats | lats_L, lats_R | Back (grouped) |
| 19 | Lower back | lower_back (merged) | Back (grouped) |
| 20 | Glutes | glutes (merged) | Glutes |
| 21-22 | Quads | quad_L, quad_R | Quads |
| 23-24 | Hamstrings | ham_L, ham_R | Hamstrings |
| 25-26 | Calves | calf_L, calf_R | Calves |
| 27 | Base (head, neck, hands, feet, shins, joints, inner thigh gaps) | base | — (not tappable) |

### Code-level grouping (for Flutter)

```dart
// lib/data/muscle_groups.dart
const Map<String, List<String>> dbGroupToMeshes = {
  'Chest': ['chest_L', 'chest_R'],
  'Shoulders': ['delt_L', 'delt_R'],
  'Biceps': ['bicep_L', 'bicep_R'],
  'Triceps': ['tricep_L', 'tricep_R'],
  'Forearms': ['forearm_L', 'forearm_R'],
  'Core': ['abs_upper', 'abs_lower', 'oblique_L', 'oblique_R'],
  'Back': ['upper_back_L', 'upper_back_R', 'lats_L', 'lats_R', 'lower_back'],
  'Glutes': ['glutes'],
  'Quads': ['quad_L', 'quad_R'],
  'Hamstrings': ['ham_L', 'ham_R'],
  'Calves': ['calf_L', 'calf_R'],
};
```

---

## Muscle Activation Data Strategy (LOCKED Apr 20, 2026)

**Path: Option C (hybrid LLM-assisted tagging)**

Reasoning: zero ongoing cost (no API subscription), decent accuracy (~88-92%), bootstrap-friendly. ExerciseDB API upgrade (Option B) deferred to post-revenue.

### Level 2 muscle mapping (primary + secondary)

Each exercise will have both primary AND secondary muscles tagged. Matches what Fitbod, MuscleWiki, Dr Muscle ship. Feels accurate to users.

### Implementation plan (deferred, not blocking)

1. New schema: `exercise_muscles` table with (exercise_id, muscle_group, role: 'primary'|'secondary')
2. Script runs LLM query per exercise: "primary + secondary muscles?"
3. Cross-reference free-exercise-db tags; flag disagreements
4. Web research flagged exercises
5. Re-seed DB

**Time cost:** 1-2 weeks of spread-out work, parallel to other sprints. Not blocking T5a/b/c.

---

## Blender Split Execution Log

### Apr 17 blocker
Blender 5.1 and 4.2 both hung entering Edit Mode on CharacterZone GLB.

### Apr 20 morning: FBX workaround succeeded
Conversion via Aspose online converter (GLB → FBX). Import settings: "Animation" unchecked. Edit Mode entered cleanly within 10 seconds.

### Apr 20 evening: Workflow fully debugged
After initial renaming confusion, the workflow pattern became rock-solid. Pace settled at ~3 min per muscle for scripted splits, ~5 min for circle-select polished splits.

### Apr 21: Upper body + core + back complete
12 additional muscles split in a long session. 20/27 total. Mesh count reduced from 30 to 27 via merging (abs, lower_back, glutes merged to single meshes).

### Apr 22: Legs complete, all splits done ✅

Final session completed remaining 7 splits (quad_L/R, ham_L/R, calf_L/R, base rename).

**Final completed splits (27/27):**

| # | Mesh | Method | Notes |
|---|---|---|---|
| 1 | chest_L | Script | Bounds X 0.000→0.027, Y -0.020→-0.002, Z -0.038→-0.015 |
| 2 | chest_R | Script | Bounds X -0.025→0.000, Y -0.020→-0.002, Z -0.038→-0.015 |
| 3 | delt_L | Script | Bounds X 0.020→0.035, Y -0.020→0.015, Z -0.024→-0.008 |
| 4 | delt_R | Script | Bounds X -0.035→-0.020, Y -0.020→0.015, Z -0.024→-0.008 |
| 5 | bicep_L | Script | Bounds X 0.025→0.050, Y -0.013→-0.002, Z -0.035→-0.020 |
| 6 | bicep_R | Script | Bounds X -0.050→-0.025, Y -0.013→-0.002, Z -0.035→-0.020 |
| 7 | tricep_L | Script | Bounds X 0.025→0.050, Y 0.002→0.015, Z -0.035→-0.020 |
| 8 | tricep_R | Script | Bounds X -0.050→-0.025, Y 0.002→0.015, Z -0.035→-0.020 |
| 9 | forearm_L | Script | Elbow X≈0.050 → wrist X≈0.076 |
| 10 | forearm_R | Script | Mirror of forearm_L |
| 11 | abs_upper | Script | Merged single mesh (was planned L/R) |
| 12 | abs_lower | Script | Merged single mesh (was planned L/R) |
| 13 | oblique_L | Script + polish | Kept L/R split for future asymmetry feature |
| 14 | oblique_R | Script + polish | Kept L/R split for future asymmetry feature |
| 15 | upper_back_L | Circle Select polish | Irregular trap shape |
| 16 | upper_back_R | Circle Select polish | Irregular trap shape |
| 17 | lats_L | Script + polish | Redone with tighter Z (-0.055 upper) |
| 18 | lats_R | Script + polish | Redone with tighter Z (-0.055 upper) |
| 19 | lower_back | Script | Merged single mesh; Z -0.055 to -0.068 |
| 20 | glutes | Script | Merged single mesh; Z -0.068 to -0.090 |
| 21 | quad_L | Script + polish | Final bounds X -0.003→0.030, Y -0.025→-0.005, Z -0.115→-0.090 |
| 22 | quad_R | Manual (Circle Select) | Mirror of quad_L, done manually |
| 23 | ham_L | Circle Select | Back of thigh; includes inner/outer wrap (Option A) |
| 24 | ham_R | Circle Select | Mirror of ham_L |
| 25 | calf_L | Circle Select | Back of lower leg, knee to ankle |
| 26 | calf_R | Circle Select | Mirror of calf_L |
| 27 | base | Auto-rename | Remaining head, neck, hands, feet, shins, joints, inner thigh gaps |

**File location:** `D:\projects\dailyforge\media\3d-source\male_anatomy_split_fbx.blend`

**Axis convention verified:**
- Z = vertical (up positive, head Z=0.014, feet Z=-0.163). Total height 17.7cm.
- X = width (figure's left positive, figure's right negative). Body centerline X=0.
- Y = depth (front of body negative, back of body positive).

---

## Key Landmarks (For Future Reference)

| Landmark | X | Y | Z |
|----------|---|---|---|
| Head top | 0.000 | 0.000 | +0.014 |
| Left foot | +0.024 | -0.014 | -0.163 |
| Right foot | -0.024 | -0.021 | -0.163 |
| Left nipple | +0.011 | -0.012 | -0.037 |
| Left shoulder peak | +0.023 | +0.003 | -0.016 |
| Top of sternum | +0.0008 | -0.00003 | -0.0206 |
| Delt ends, arm begins | X ≈ 0.025 (left) | — | — |
| Elbow | X ≈ 0.050 (left) | — | — |
| Wrist | X ≈ 0.076 (left) | — | — |
| Hand tips | X ≈ 0.170 (left) | — | — |
| Lats bottom / lumbar top | — | — | Z ≈ -0.055 |
| Lower back → glutes transition | — | — | Z ≈ -0.068 |
| Glute bottom / thigh crease | — | — | Z ≈ -0.090 |
| Knee | — | — | **Z ≈ -0.115** (discovered Apr 22 — ~10mm higher than original -0.128 estimate) |

---

## Workflow Pattern (Finalized)

1. In Object Mode, click `body_low__Body_Low_SP_blinn1SG1_0.00X` in outliner (longest-named object = main body mesh)
2. Tab → Edit Mode. Verify top-left label shows that long name.
3. Press `3` → Face Select mode
4. Press `Alt+A` → Deselect all
5. Either:
   - **Script path:** Paste Python in Text Editor panel → `Alt+P` to run (coordinate-bounds selection)
   - **Manual path:** Press `C` for Circle Select → brush-select the region (middle-mouse or Ctrl-drag to subtract)
6. Visually verify selection from front/side/back views
7. `P` → Selection → splits faces into new object
8. `Tab` → Object Mode
9. In outliner, find NEW object (will have `.001` suffix)
10. Click the new object, `F2` → type muscle name lowercase (e.g. `bicep_L`) → Enter
11. `Ctrl+S` → save

**Critical workflow insight:** After each split, the remaining body mesh suffix increments. Longest-named object in outliner is always the main body to split from.

---

## Key Process Learnings

1. **Python console is for one-liners. Use Text Editor for multi-line scripts.** Multi-line paste into the interactive console breaks at indented blocks.

2. **Coordinate-bounds scripts give 70-85% accuracy** for roughly-rectangular muscle regions. For irregular shapes (traps, lats, legs), combine with Circle Select polish.

3. **Circle Select is the superior tool for curvy muscles.** Legs especially — quads, hams, calves are all cylinder-wrapped shapes that don't fit box bounds well. Pure Circle Select is faster and more accurate than script-then-polish for these.

4. **Save after every split.** Ctrl+S. No exceptions.

5. **Mesh names must be lowercase + underscore + uppercase side letter** (e.g. `chest_L` not `Chest_L.001`). Flutter code matches these strings exactly.

6. **After `P → Selection`, rename the NEW `.001` object, not the original.** The original keeps its long `body_low_` name and becomes the next split source.

7. **Edit-mode renaming works fine.** F2 works regardless of edit state.

8. **Knee Z is ≈ -0.115, not -0.128.** Original estimate was off. Legs are shorter relative to total body height than expected. Relevant for any future model-specific work.

9. **Option A for hamstring scope (wrap back half of thigh):** Since there's no adductor/abductor mesh, hamstring absorbs inner and outer thigh wraps. Matches user UX expectation (tap side of thigh → "leg lights up"), avoids orphan gray faces.

10. **Hybrid workflow beat pure script.** Original plan was script-only. Reality: script got us to ~70%, Circle Select polish got the remaining 30%. For future models, plan on this hybrid approach from the start.

---

## Python Script Template (For Reference / Future Models)

```python
import bpy
import bmesh

obj = bpy.context.edit_object
if obj is None:
    print("ERROR: Not in Edit Mode")
else:
    bm = bmesh.from_edit_mesh(obj.data)
    for f in bm.faces:
        f.select = False
    bm.select_flush(False)
    
    # [MUSCLE_NAME] bounds
    xmin, xmax = ?, ?
    ymin, ymax = ?, ?
    zmin, zmax = ?, ?
    
    count = 0
    for f in bm.faces:
        center = f.calc_center_median()
        world = obj.matrix_world @ center
        if (xmin <= world.x <= xmax and 
            ymin <= world.y <= ymax and 
            zmin <= world.z <= zmax):
            f.select = True
            count += 1
    
    bmesh.update_edit_mesh(obj.data)
    print(f"Selected {count} faces for [MUSCLE_NAME]")
```

---

## Sub-Ticket Breakdown

### S10-T5a: 3D Body Map UI + Rotation + Tap (Mock Data)
**Status:** 🟢 **Unblocked** — all mesh splits complete. Ready for Claude Code prompt.
**Estimate:** 3-4 days
**Next step:** Export split model as GLB → write fresh Claude Code prompt → implement

### S10-T5b: Backend Endpoints
**Status:** ⏳ Planned (can start anytime — doesn't need the split)
**Estimate:** 1-2 days

### S10-T5c: Remaining Home Sections + Real Data Wiring
**Status:** ⏳ Planned
**Estimate:** 3-4 days

**Total T5 estimate:** 7-10 working days of Flutter work remaining. Blender work complete.

---

## Dependencies for Sprint 11

Sprint 11 (5-phase session + Google Play launch) **starts after T5a/b/c complete**. Accepted trade-off: launch slips ~2 weeks for flagship feature quality.

---

## Deferred to V2 (Post-Launch)

- Yoga/breathwork data layer on figure (third "Breath" mode)
- Per-muscle detail drill-down page
- True per-mesh raycasting (engine swap required)
- Tripo AI personalized character model
- Body map time-travel / muscle balance score
- ExerciseDB upgrade (Option B) once app has revenue
- Asymmetry visualization using oblique_L/R and upper_back_L/R splits (Max tier feature)

---

## Change Log

- **Apr 17, 2026** — Ticket scoped. Model chosen. Design direction locked.
- **Apr 17, 2026 (evening)** — Blender blockers hit. Troubleshooting ladder documented.
- **Apr 20, 2026 morning** — FBX workaround succeeded. 2/30 muscles split (chest_L, chest_R).
- **Apr 20, 2026 morning** — 30-split plan locked (vs original 22). Future-ready for DB granularity upgrades.
- **Apr 20, 2026 morning** — Option C locked for muscle activation data (bootstrap, no API cost).
- **Apr 20, 2026 morning** — Level 2 muscle mapping (primary + secondary) locked for accuracy.
- **Apr 20, 2026 evening** — 6 more muscles split. Total 8/30. Renaming workflow debugged.
- **Apr 21, 2026** — 12 more muscles split. Total 20/28. Mesh count reduced from 30 to 28 via merging (abs, lower_back, glutes).
- **Apr 21, 2026** — Circle Select workflow adopted as standard alongside coordinate-bounds scripts.
- **Apr 21, 2026** — Lats redone after initial over-coverage into lumbar.
- **Apr 22, 2026** — ✅ **FINAL 7 SPLITS COMPLETE** (quad_L/R, ham_L/R, calf_L/R, base). Total 27/27.
- **Apr 22, 2026** — Knee Z discovered at -0.115 (not -0.128). Manual Circle Select was the primary tool for all leg muscles.
- **Apr 22, 2026** — Final mesh count corrected from "28" to **27** (26 muscle + 1 base). Earlier "28" was an off-by-one typo in plan docs.

---

### Apr 21, 2026 — Execution Decisions (During Second Split Session)

**Mesh merging decisions made during live execution:**

1. **abs merged to single meshes:** `abs_upper_L/R` combined to single `abs_upper`. Same for `abs_lower`. Reasoning: abs are a continuous rectus abdominis muscle; users don't think "left ab vs right ab" in fitness context.

2. **lower_back merged to single mesh:** Lumbar erector spinae is contiguous across the spine; typically trained as one unit.

3. **glutes merged to single mesh:** Glutes train together in hip-dominant exercises; users don't distinguish per-side.

4. **Oblique and upper_back kept as L/R split:** For Max-tier future asymmetry visualization feature. Flutter code groups them under single tap target for now.

5. **Workflow evolution — Circle Select became standard** for irregular shapes (traps, lats, all legs).

---

### Apr 22, 2026 — Legs Execution Notes

**All 6 leg muscles done with Circle Select (manual polish), not scripts.**

- **quad_L:** Required 3 script iterations before getting bounds right (knee Z was the blocker). Final required manual inner-thigh polish via `C`.
- **quad_R:** Done purely manually by user using Circle Select, mirroring quad_L visually.
- **ham_L:** Done manually. Initial attempt included calf territory; user trimmed with Ctrl-drag in Circle Select before splitting.
- **ham_R:** Done manually.
- **calf_L and calf_R:** Both done manually.
- **base:** Auto-rename of remaining body mesh.

**Key takeaway:** For cylindrical/curvy muscles (legs), Circle Select alone beats script+polish. For future models, skip scripts entirely on legs.

---

### Final Mesh Count Table

| Category | Original Plan (Apr 20) | Final (Apr 22) |
|---|---|---|
| Chest | 2 (L/R) | 2 (L/R) |
| Delt | 2 (L/R) | 2 (L/R) |
| Bicep | 2 (L/R) | 2 (L/R) |
| Tricep | 2 (L/R) | 2 (L/R) |
| Forearm | 2 (L/R) | 2 (L/R) |
| Abs Upper | 2 (L/R) | **1 (merged)** |
| Abs Lower | 2 (L/R) | **1 (merged)** |
| Obliques | 2 (L/R) | 2 (L/R) |
| Upper Back | 2 (L/R) | 2 (L/R) |
| Lats | 2 (L/R) | 2 (L/R) |
| Lower Back | 2 (L/R) | **1 (merged)** |
| Glutes | 2 (L/R) | **1 (merged)** |
| Quads | 2 (L/R) | 2 (L/R) |
| Hams | 2 (L/R) | 2 (L/R) |
| Calves | 2 (L/R) | 2 (L/R) |
| Base | 1 | 1 |
| **TOTAL** | **31** | **27** ✅ |

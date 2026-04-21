# S10-T5: Home Page Redesign — Design Document

**Status:** Blender mesh splitting 20/28 complete (71%). Workflow fully debugged; Circle Select is now standard alongside coordinate-bounds scripts.
**Created:** Apr 17, 2026
**Last Updated:** Apr 21, 2026 (12 more muscles split; mesh count reduced from 30 to 28 via merging)
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

## Muscle Split Plan (LOCKED Apr 20, 2026; revised Apr 21, 2026)

**Total: 28 meshes (reduced from 30 due to merging abs and glutes L/R during execution)** — 27 tappable + 1 base.

Rationale: split mesh granularly now so future DB upgrades (L/R asymmetry tracking, upper/lower distinctions) don't require re-splitting. Code-level grouping layer maps 28 meshes to the DB's 11 muscle groups. Merged meshes (abs_upper, abs_lower, lower_back, glutes) reflect the fact that these muscles train bilaterally and users don't think per-side; obliques and upper_back kept split for potential Max-tier asymmetry tracking.

### Split list

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
| 27 | Base (head, neck, hands, feet, joints) | base | — (not tappable) |

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

After initial renaming confusion (detailed in "Learnings" below), the workflow pattern is now rock-solid. Pace is ~3 min per muscle.

### Current state (end of Apr 20 evening session)

**Completed splits (20/28):**

| # | Mesh | Notes |
|---|---|---|
| 1 | chest_L | Bounds X 0.000→0.027, Y -0.020→-0.002, Z -0.038→-0.015 |
| 2 | chest_R | Bounds X -0.025→0.000, Y -0.020→-0.002, Z -0.038→-0.015 |
| 3 | delt_L | Bounds X 0.020→0.035, Y -0.020→0.015, Z -0.024→-0.008 |
| 4 | delt_R | Bounds X -0.035→-0.020, Y -0.020→0.015, Z -0.024→-0.008 |
| 5 | bicep_L | Bounds X 0.025→0.050, Y -0.013→-0.002, Z -0.035→-0.020 |
| 6 | bicep_R | Bounds X -0.050→-0.025, Y -0.013→-0.002, Z -0.035→-0.020 |
| 7 | tricep_L | Bounds X 0.025→0.050, Y 0.002→0.015, Z -0.035→-0.020 |
| 8 | tricep_R | Bounds X -0.050→-0.025, Y 0.002→0.015, Z -0.035→-0.020 |
| 9 | forearm_L | Elbow X≈0.050 → wrist X≈0.076 (tighter than original 0.120 estimate) |
| 10 | forearm_R | Mirror of forearm_L |
| 11 | abs_upper | Merged single mesh (was planned L/R) |
| 12 | abs_lower | Merged single mesh (was planned L/R) |
| 13 | oblique_L | Kept L/R split for future asymmetry feature |
| 14 | oblique_R | Kept L/R split for future asymmetry feature |
| 15 | upper_back_L | Circle Select polish applied (irregular trap shape) |
| 16 | upper_back_R | Circle Select polish applied (irregular trap shape) |
| 17 | lats_L | Redone with tighter Z (-0.055 upper); Circle Select polish |
| 18 | lats_R | Redone with tighter Z (-0.055 upper); has minor stray faces near armpit/front (~2-3 min cleanup remaining) |
| 19 | lower_back | Merged single mesh; Z -0.055 to -0.068 (narrower than expected) |
| 20 | glutes | Merged single mesh; Z -0.068 to -0.090 |

**File location:** `D:\projects\dailyforge\media\3d-source\male_anatomy_split_fbx.blend`

**Axis convention verified:**
- Z = vertical (up positive, head Z=0.014, feet Z=-0.163). Total height 17.7cm.
- X = width (figure's left positive, figure's right negative). Body centerline X=0.
- Y = depth (front of body negative, back of body positive).

**Workflow pattern (finalized):**
1. In Object Mode, click `body_low__Body_Low_SP_blinn1SG1_0.00X` in outliner (longest-named object = main body mesh)
2. Tab → Edit Mode. Verify top-left label shows that long name.
3. Press `3` → Face Select mode
4. Press `Alt+A` → Deselect all
5. In Text Editor panel, paste Python script (use Text Editor, NOT Python console — multi-line paste fails in console)
6. `Alt+P` → Run script
7. Visually verify selection from front/side/back views as needed
8. `P` → Selection → splits faces into new object
9. `Tab` → Object Mode
10. In outliner, find NEW object (will have `.001` suffix added to original name, e.g. `body_low__Body_Low_SP_blinn1SG1_0.001.001`)
11. Click the new object to select it
12. `F2` → type muscle name lowercase (e.g. `bicep_L`) → Enter
13. `Ctrl+S` → save

**Critical workflow insight:** After each split, the remaining body mesh gets its suffix incremented (e.g. `.001` → `.002` → `.003`). The **longest-named object in the outliner is always the main body to split from**.

### Remaining splits (8/28)

- Quads (2): quad_L, quad_R
- Hamstrings (2): ham_L, ham_R
- Calves (2): calf_L, calf_R
- Base (1): auto-result after all other splits

**Estimated remaining time:** ~30 min Blender work (6 leg muscles at ~3-5 min each + base auto-naming).

### Key process learnings

1. **Python console is for one-liners. Use Text Editor for multi-line scripts.** Multi-line paste into the interactive console breaks at indented blocks.

2. **Coordinate-bounds approach gives 70-85% accuracy** for roughly-rectangular muscle regions. Won't be perfect (muscles are fan/curve shapes, not boxes). Accept imperfections and move on.

3. **Save after every split.** Ctrl+S. If Blender crashes, we don't lose hours of work.

4. **Mesh names must be lowercase + underscore + uppercase side letter** (e.g. `chest_L` not `Chest_L.001`). Flutter code will match these strings exactly.

5. **When a split produces unexpected results, check what's in each object.** After renaming confusion on Apr 20 evening, we discovered that `P → Selection` creates a new object and leaves the original object keeping its old name with the selected faces REMOVED. The NEW object gets `.001` suffix. Rename the NEW object, not the original.

6. **The naming issue solved:** The confusion earlier came from renaming the wrong object after splits. Once we verified each object's actual contents by clicking in outliner and seeing what highlights in the viewport, we were able to rename everything correctly. All 8 current splits are verified correct.

7. **Edit-mode renaming works fine.** Don't need to Tab out of Edit Mode to use F2. The object name is independent of edit state.

8. **After each split, the main body mesh suffix increments.** Started as `body_low__Body_Low_SP_blinn1SG1_0`, then `.001`, now `.002` after the bicep_R split. Always click the longest-named one.

### Python script template

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

### Key landmarks (for bound calculations)

| Landmark | X | Y | Z |
|----------|---|---|---|
| Head top | 0.000 | 0.000 | +0.014 |
| Left foot | +0.024 | -0.014 | -0.163 |
| Right foot | -0.024 | -0.021 | -0.163 |
| Left nipple | +0.011 | -0.012 | -0.037 |
| Left shoulder peak | +0.023 | +0.003 | -0.016 |
| Top of sternum | +0.0008 | -0.00003 | -0.0206 |

Calculated/derived landmarks from splits:
- delt ends, bicep/tricep begins: X ≈ 0.025 (left side)
- Upper arm to elbow: X range ≈ 0.025 to 0.050
- Elbow to wrist (forearm): X range ≈ 0.050 to ~0.090 (approximate; to verify when splitting)
- Hand tips: X ≈ 0.170

Verified/discovered during Apr 21 session:
- Lats bottom (where lumbar starts): Z ≈ -0.055
- Lower back extent: Z -0.055 to -0.068 (narrow band — lumbar is smaller than expected)
- Glutes top: Z ≈ -0.068 (where lower_back ends)
- Glutes bottom (thigh crease): Z ≈ -0.090
- Elbow: X ≈ 0.050 (left side)
- Wrist: X ≈ 0.076 (left side — tighter than originally estimated 0.120)

---

## Sub-Ticket Breakdown

### S10-T5a: 3D Body Map UI + Rotation + Tap (Mock Data)
**Status:** 🔴 Blocked on remaining 8/28 mesh splits (about 30 min of Blender work)
**Estimate:** 3-4 days after all splits done

### S10-T5b: Backend Endpoints
**Status:** ⏳ Planned (can start anytime — doesn't need the split)
**Estimate:** 1-2 days

### S10-T5c: Remaining Home Sections + Real Data Wiring
**Status:** ⏳ Planned
**Estimate:** 3-4 days

**Total T5 estimate:** 7-10 working days of Flutter work + remaining ~70 min of Blender work.

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

---

## Change Log

- **Apr 17, 2026** — Ticket scoped. Model chosen. Design direction locked.
- **Apr 17, 2026 (evening)** — Blender blockers hit. Troubleshooting ladder documented.
- **Apr 20, 2026 morning** — FBX workaround succeeded. 2/30 muscles split (chest_L, chest_R).
- **Apr 20, 2026 morning** — 30-split plan locked (vs original 22). Future-ready for DB granularity upgrades.
- **Apr 20, 2026 morning** — Option C locked for muscle activation data (bootstrap, no API cost).
- **Apr 20, 2026 morning** — Level 2 muscle mapping (primary + secondary) locked for accuracy.
- **Apr 20, 2026 evening** — 6 more muscles split (delt_L, delt_R, bicep_L, bicep_R, tricep_L, tricep_R). Total 8/30.
- **Apr 20, 2026 evening** — Renaming workflow confusion debugged and documented. Pattern now rock-solid.
- **Apr 20, 2026 evening** — All bounds for upper body arms recorded for reference.
- **Apr 21, 2026** — 12 more muscles split (forearm_L/R, abs_upper, abs_lower, oblique_L/R, upper_back_L/R, lats_L/R, lower_back, glutes). Total 20/28.
- **Apr 21, 2026** — Mesh count reduced from 30 to 28. Merged abs_upper, abs_lower, lower_back, and glutes to single meshes (trained bilaterally; users don't think per-side). Obliques and upper_back kept L/R for future Max-tier asymmetry feature.
- **Apr 21, 2026** — Circle Select workflow adopted as standard alongside coordinate-bounds scripts for irregular muscle shapes (traps, lats).
- **Apr 21, 2026** — Lats redone after initial over-coverage into lumbar area blocked lower_back. Re-split with tighter Z upper bound (-0.055).

---

### Apr 21, 2026 — Execution Decisions (During Second Split Session)

**Mesh merging decisions made during live execution:**

1. **abs merged to single meshes:** `abs_upper_L/R` combined to single `abs_upper`. Same for `abs_lower`. Reasoning: abs are a continuous rectus abdominis muscle; users don't think "left ab vs right ab" in fitness context. Simpler mesh structure matches app UX.

2. **lower_back merged to single mesh:** Single `lower_back` instead of `lower_back_L/R`. Reasoning: lumbar erector spinae is contiguous across the spine; typically trained as one unit (deadlifts, hyperextensions).

3. **glutes merged to single mesh:** Single `glutes` mesh instead of `glute_L/R`. Reasoning: glutes train together in hip-dominant exercises; users don't distinguish per-side.

4. **Oblique and upper_back kept as L/R split:** Despite similar reasoning applying, kept these split in mesh for Max-tier future feature potential (asymmetry visualization). Flutter code groups them under single tap target.

5. **Workflow evolution — Circle Select became standard:**
   - Original plan: script-only, accept 70-85% accuracy
   - Reality: some muscles (traps, lats) have irregular shapes that coordinate-bounds scripts can't capture well
   - Solution: Use script to get roughly 50-70% accuracy, then Circle Select (`C` key) to brush-add and Ctrl-drag to subtract for final polish
   - Time cost: ~3-5 min per complex muscle, worth the quality improvement for flagship UX

6. **Lats redone after over-coverage:** Initial lats split extended down into lumbar area, blocking lower_back. Merged back via Ctrl+J, re-split with tighter Z bounds (-0.055 upper limit), then lower_back fit cleanly below.

**Updated final mesh count:**

| Category | Original Plan | Final |
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
| Quads | 2 (L/R) | 2 (L/R) — planned |
| Hams | 2 (L/R) | 2 (L/R) — planned |
| Calves | 2 (L/R) | 2 (L/R) — planned |
| Base | 1 | 1 |
| **TOTAL** | **31** | **28** |

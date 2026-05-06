# S13-T5 AMENDMENT-1 — Half-Pie Picker Redesign (replaces slider + bracket grid)

**Status:** LOCKED
**Locked:** May 3, 2026
**Author:** Claude.ai (Architect)
**Owner:** Prashob (CEO/PO)
**Parent spec:** `Trackers/S13-T5-DESIGN.md` (v1.0, locked)
**Sequence:** Authored after T5 base build completed and device-tested. Replaces the body-focus continuous Material slider AND the state-focus 4-pill grid with a unified half-pie picker shape.

---

## 1. Why this amendment exists

T5 base shipped two different picker widgets:

- **Body focus** → `DurationSliderSheet` (Material slider, 30–60 min, 5-min steps).
- **State focus** → `BracketPickerSheet` (4 numbered pills + 1 endless pill below a divider).

Device verification surfaced two real complaints:

1. **Slider feels generic / outdated.** Material `Slider` is the Flutter default; it does not match the visual ambition of the rest of the app. The user-facing description was "old school, outdated."
2. **Two visually distinct pickers feels inconsistent.** Body focus and state focus appear in the same flow (tap any focus on the home pie → sheet opens). Having two unrelated widgets for what is conceptually the same action ("pick a duration") breaks the user's mental model.

The product call: **unify the duration picker into one shape, and make that shape echo the home pie's visual identity.**

After exploring four directions (number wheel, pill chips, chunky knob with bubble, radial dial) plus four picker shapes (half-pie fan, clock arc, vertical fill bar, mini pie matching home), the locked answer is **half-pie fan, sized identically across both pickers, with segment count adapting to data shape**.

This is the same family pattern as the home pie itself: the home pie has 12 body focuses on the outer ring and 5 state focuses on the inner ring. Different counts, same visual language.

---

## 2. Locked design — the half-pie family

### 2.1 Shape rule

Both pickers render a **half-pie fan** filling the upper half of a fixed canvas. The pie occupies the bottom half of the visual space (flat side down, dome side up — standard fan shape). Same diameter, same canvas dimensions, same center point. Only the segment count differs by data shape.

### 2.2 Segment counts

| Picker | Segments | Values | Layout |
|---|---|---|---|
| Body | 3 wedges | `30 min` / `45 min` / `60 min` | 60° each (180° / 3) |
| State | 5 wedges | `0–10` / `10–20` / `21–30` / `30–45` / `∞` (endless) | 36° each (180° / 5) |

The endless option for state focus is the **rightmost wedge** of the state half-pie. No separate tab, no divider, no bolt-on. It is one of the wedges, rendered with the `∞` symbol instead of a numeric range. This was the architecturally clean answer that fell out of the family rule — every option is a wedge, no exceptions.

### 2.3 Canvas dimensions

- SVG `viewBox`: `0 0 360 220` (renders at full sheet width, ~360 px on standard phones).
- Pie center: `(180, 180)`.
- Pie radius: `160 px`.
- Wedge fill area extends from center at `(180, 180)` to outer arc.
- Sheet vertical space below the pie: button area only (no labels, no subtitle, no extra widgets).

(Mockup widget used `0 0 180 110` and radius `80` for compact side-by-side display. The Flutter implementation scales up to the full sheet width — half-pie fills the available width with appropriate padding.)

### 2.4 Wedge rendering

**Each wedge is a closed SVG `path` of the form:**
```
M <cx> <cy> L <p1.x> <p1.y> A <r> <r> 0 0 1 <p2.x> <p2.y> Z
```
where `(p1, p2)` are the two arc endpoints for that wedge.

**Stroke:** 2 px solid `#FFFFFF` between wedges (white divider, matches home pie).

**Fill states:**

| State | Body wedge fill | State wedge fill |
|---|---|---|
| Unselected | `#FAF8F2` (page background — wedge "disappears" into the canvas, only the divider strokes show) | `#FAF8F2` (same) |
| Selected | `#534AB7` (purple, body accent) | `#E1F5EE` (light teal, state accent fill — same as the previously shipped pill `selected` state) |
| Pressed (during tap) | Slight opacity dip (~0.92) for 100 ms | Same |

**No hover states** (mobile-only).

### 2.5 Wedge label rendering

Each wedge contains an SVG `<text>` element positioned at the wedge midpoint, ~50–55% of the radius from center.

**Body wedges:**
- Numeric label: `30` / `45` / `60` — `font-size: 22px`, `font-weight: 500`, color depends on selected state (white on selected purple, `#5F5E5A` on unselected).
- Unit suffix `min`: `font-size: 11px`, regular weight, positioned below the numeric label, color `#EEEDFE` on selected purple, `#888780` on unselected.

**State wedges (numbered):**
- Range label: `0–10` / `10–20` / `21–30` / `30–45` — `font-size: 12px`, `font-weight: 500`, color `#0F6E56` on selected, `#5F5E5A` on unselected.
- No `min` suffix on state wedges (range strings are self-explanatory; sheet title says "How long" — clearly minutes).

**State endless wedge:**
- Single `∞` symbol: `font-size: 18px`, regular weight, color `#0F6E56` on selected, `#5F5E5A` on unselected.

### 2.6 Sheet chrome (unchanged from T5 base)

- Drag handle at top: 36×4 px, `#D3D1C7`, 2 px rounded.
- Title: `How long for <Focus name>?` — 17 pt semibold, centered, `#2C2C2A`.
- Subtitle: **REMOVED** for body picker (the wedge labels are self-explanatory). State picker subtitle reads: `Pick a duration that feels right.` (kept).
- Pie below title with appropriate vertical padding.
- `Start session` button below pie: full-width, 42 px tall, 10 px corners, `#534AB7` for body / `#1D9E75` for state, white text "Start session".
- Sheet bottom radius: 8 px.

### 2.7 Default selection on open

Unchanged from T5 base spec §7 / §8:

- **State:** mode of user's history → fall back to `0–10` for new users.
- **Body:** mode of user's history → fall back to `30 min` for new users.
- Last-picked persists per focus via `t5.lastPicked.<focus_slug>` in `StorageService`. On re-tap of same focus, last-picked beats history mode.

The selected wedge renders in its accent fill on sheet open. No "loading then snap" animation needed since the body picker has no backend dependency for the suggested-default response shape (the picker itself doesn't render values it didn't already know — there are no locked or empty wedges in body since the engine supports any 5-min step from 30 to 60 within tolerance).

For state, the existing `available-durations` endpoint still gates which wedges are tappable. Wedges whose bracket is not in the response's `ranges` list are rendered with **reduced opacity (~0.4)** and are non-tappable. This replaces the T5 base behavior of hiding unavailable brackets entirely, because in the half-pie shape, hiding wedges would create asymmetric gaps that break the visual.

> **Drift from T5 base Decision #10:** original spec said "hide unusable brackets entirely." With the half-pie locked, hiding a wedge would distort the pie. Amendment supersedes: render unusable wedges at reduced opacity, non-tappable. This is the cleanest accommodation of the new shape; the user-facing effect is similar (unusable options are clearly distinct), the visual is preserved.

### 2.8 Motion

- Sheet entrance: 300 ms ease-out slide up (unchanged).
- Sheet dismiss: 250 ms ease-in slide down (unchanged).
- Wedge tap: 100 ms opacity dip on press (replaces the previous pill `scale(0.98)` press animation since the wedge is a fixed-shape SVG path, not a card).
- Selected wedge fill change: 150 ms ease-out color transition.

### 2.9 Haptics

Unchanged from T5 base:
- Wedge tap → `HapticFeedback.lightImpact()`.
- Confirm button tap → `HapticFeedback.mediumImpact()`.
- (The slider's per-step `selectionClick()` haptic is gone — no more drag, no more snap-to-step events.)

### 2.10 Accessibility

Each wedge gets:
- `Semantics(label: '<duration label>, <selected | not selected>', button: true)`.
- 44×44 px minimum tap target (the wedges are physically larger than 44 px at full sheet width even in the 5-segment state picker).
- Selected state announced by screen readers via `Semantics(selected: true)`.

---

## 3. Files to change

### 3.1 New widget

**`app/lib/widgets/sheets/half_pie_picker_sheet.dart`** — single new widget that handles both body and state pickers via a config object.

```dart
class HalfPiePickerSheet extends StatefulWidget {
  final String focusSlug;
  final String focusName;
  final FocusType focusType;  // body | state
  // ...
}

class _HalfPiePickerConfig {
  final List<_WedgeData> wedges;
  final Color selectedFill;
  final Color buttonColor;
  final String? subtitle;
  // ...
}

class _WedgeData {
  final String value;        // '30' or '0_10' or 'endless'
  final String label;        // '30' or '0–10' or '∞'
  final String? unit;        // 'min' for body, null for state
  final bool available;      // false → reduced opacity, non-tappable
  final double startAngle;   // degrees from positive x-axis (CCW)
  final double sweepAngle;   // degrees (60 for body, 36 for state)
}
```

Public function `Future<String?> showHalfPiePicker(BuildContext context, {required String focusSlug, required String focusName, required FocusType focusType})` replaces the two existing show functions.

### 3.2 Files to delete

- `app/lib/widgets/sheets/duration_slider_sheet.dart` — replaced by `HalfPiePickerSheet`.
- `app/lib/widgets/sheets/bracket_picker_sheet.dart` — replaced by `HalfPiePickerSheet`.

### 3.3 Files to modify

**`app/lib/pages/home/home_page.dart`** — change tap handler to call `showHalfPiePicker` instead of the two separate functions:

```dart
// OLD:
picked = focus.type == 'state'
  ? await showBracketPickerSheet(context, focusSlug: slug, focusName: focus.displayName)
  : await showDurationSliderSheet(context, focusSlug: slug, focusName: focus.displayName);

// NEW:
picked = await showHalfPiePicker(
  context,
  focusSlug: slug,
  focusName: focus.displayName,
  focusType: focus.type == 'state' ? FocusType.state : FocusType.body,
);
```

The downstream call to `selectBodyFocus` / `selectStateFocus` is unchanged.

**`app/lib/main.dart`** — no changes (`FocusDurationProvider` still wired; `HalfPiePickerSheet` consumes it for state-focus availability via existing methods).

**`app/lib/services/focus_duration_service.dart`** — no changes.

**`app/lib/providers/focus_duration_provider.dart`** — no changes.

### 3.4 Backend

No backend changes. The `available-durations` and `suggested-default` endpoints are unchanged.

### 3.5 Smoke

The smoke block `T5-PICKER-API` from T5 base is unchanged — it tests the backend endpoints, which are untouched.

The Flutter widget tests (if any) targeting `DurationSliderSheet` and `BracketPickerSheet` need updating. Pre-flight to confirm what exists.

---

## 4. Removed from spec

| Item | Reason |
|---|---|
| Continuous slider gesture | Replaced by tap-to-select wedges. |
| 5-min step granularity (35/40/50/55) | Body now has 3 fixed values: 30/45/60. The middle values are gone. Engine still supports any 5-min step internally; the picker just doesn't expose them. |
| `~Y min main work` subtitle | Removed for body picker — the wedge label IS the answer; no need for derived math. |
| `selectionClick()` haptic on every step | No more steps, no more haptic per step. Single `lightImpact()` per wedge tap. |
| Tick marks (30 / 45 / 60 labels) | Were a slider concept; gone. |
| Live value animation between steps | No more between-states; tap is discrete. |
| Hide unavailable state brackets | Replaced by reduced-opacity render; see §2.7 drift note. |

---

## 5. Acceptance criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Body picker renders half-pie with 3 wedges (30/45/60) at correct angles | Device test |
| 2 | State picker renders half-pie with 5 wedges (0–10/10–20/21–30/30–45/∞) at correct angles | Device test |
| 3 | Both pies are visually identical in size, position, and chrome | Side-by-side visual review |
| 4 | Tapping a body wedge selects it (purple fill, white label) and enables Start | Device test |
| 5 | Tapping a state wedge selects it (light teal fill, dark teal label) and enables Start | Device test |
| 6 | State picker hides wedges that the engine reports as unavailable... ACTUALLY, dims them at reduced opacity per §2.7 | Device test against seeded user with limited level |
| 7 | Endless wedge (rightmost in state picker) selectable; on confirm, session card title reads `<Focus> · Open` | Device test |
| 8 | Default selection on open uses mode-of-history → falls back to spec defaults for new users | Device test with fresh and seeded users |
| 9 | Last-picked-per-focus persists; same-focus re-tap pre-selects last value | Device test |
| 10 | Sheet dismiss-by-swipe does not fire suggest; pie selection reverts | Device test |
| 11 | `flutter analyze` clean (no new info-level hints over T4/T5-base baseline) | Build artifact |
| 12 | Old slider and bracket-picker widgets are deleted, not orphaned | Code review |
| 13 | Single `HalfPiePickerSheet` widget handles both pickers via config | Code review |

---

## 6. Pre-flight (Claude Code)

Before writing code:

1. Confirm `app/lib/widgets/sheets/duration_slider_sheet.dart` and `bracket_picker_sheet.dart` exist as shipped in T5 base.
2. Confirm `home_page.dart` currently calls `showBracketPickerSheet` and `showDurationSliderSheet` (the two functions to replace).
3. Confirm `FocusDurationProvider` still exposes `fetchAvailableDurations` and `fetchSuggestedDefault` (still used by the unified widget).
4. Confirm `StorageService.setPreference` / `getPreference` / `removePreference` still work for `t5.lastPicked.<slug>` keys.
5. Confirm any existing widget tests targeting the deleted widgets are identified for update or removal.

If any check diverges, halt and surface in chat. (Project Instructions principle #14.)

---

## 7. Out of scope

| Item | Reason |
|---|---|
| Drag gesture along the pie | Tap-only, matches home pie picker behavior. Drag-to-rotate or arc-drag is out of v1.1. |
| Animation between wedges (e.g. selected wedge "expands") | Subtle fill change is enough. Wedge-expansion animation is FUTURE_SCOPE polish. |
| Showing tooltips on hover/long-press | Mobile-only; long-press behavior reserved for future "remove from suggestions" surface. |
| Custom wedge SVG shapes (e.g. rounded outer corners) | Standard SVG `path` arcs are shipping. Visual flourishes are FUTURE_SCOPE. |
| Per-focus color customization within state pie | All state wedges use the same accent color. Per-bracket colors would dilute the green-state identity. |

---

## 8. Drift log

(Populated as Claude Code or pre-flight surfaces drifts.)

| Date | Source | Drift | Resolution |
|---|---|---|---|
| _(empty at lock)_ | | | |

---

## 9. Versioning

- This is **v1.0** of AMENDMENT-1.
- Subsequent revisions follow `vN.M`.
- Drift log entries are additive.
- If the half-pie shape itself needs to change later, that's a new amendment, not a v2 of this one.

---

## 10. Relationship to T5 base

T5 base spec (`S13-T5-DESIGN.md`) is **not retired**. It still owns:

- Backend endpoint contracts (§7).
- Mode-of-history default algorithm (§9).
- Pre-flight checklist for the engine helper (§12).
- Smoke test plan (§13).

This amendment supersedes T5 base only on the Flutter widget layer:
- §5 of T5 base (BracketPickerSheet) — superseded.
- §6 of T5 base (DurationSliderSheet) — superseded.
- §10 of T5 base (visual specs for those two widgets) — superseded.

Everything else in T5 base stands.

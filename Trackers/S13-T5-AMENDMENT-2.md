# S13-T5 AMENDMENT-2 — Picker Visual Unification

**Status:** LOCKED
**Locked:** May 3, 2026
**Author:** Claude.ai (Architect)
**Owner:** Prashob (CEO/PO)
**Parent spec:** `Trackers/S13-T5-DESIGN.md` (v1.0) → `S13-T5-AMENDMENT-1.md` (v1.0, half-pie redesign)
**Sequence:** Authored after AMENDMENT-1 device-tested. Refines the half-pie picker visuals to make body and state pickers feel like the same widget, not two siblings.

---

## 1. Why this amendment exists

AMENDMENT-1 shipped the half-pie shape successfully. Both pickers render correctly with the right wedge counts and identical sheet chrome. But on device, the two pickers don't feel unified visually:

1. **Different selected colors.** Body uses solid purple `#534AB7` with white text (high-contrast, confident). State uses light teal `#E1F5EE` with dark teal text `#0F6E56` (low-contrast, subtle — almost reads as unselected).
2. **Different button colors.** Purple body button vs green state button.
3. **Different pie sizes.** State picker pie renders larger than body picker pie due to subtitle padding differences and `min` suffix taking vertical space on body wedges.
4. **Subtitle present only on state picker.** Body has no subtitle.
5. **`min` suffix on body wedges only.** State wedges show range strings without `min`. Body shows `45` + `min`. Asymmetric.

The user-facing complaint: "they don't look like the same widget."

This amendment unifies the visual treatment so both pickers are **visually indistinguishable except for the wedge count and labels**. Same accent color, same sizing, same chrome, same label format.

---

## 2. Locked design changes

### 2.1 Accent color — single unified color

**Before:** Body used purple `#534AB7`, state used green `#1D9E75` for selected wedge fill and Start button.
**After:** Both pickers use **terracotta `#C97B5E`** for selected wedge fill AND Start button.

This breaks the app-wide body-purple / state-green color logic intentionally — but only inside the picker surface. The picker is a transient overlay; it doesn't need to remind the user what focus type they tapped (the title `How long for <Focus>?` does that). The home pie and session card preserve the body-purple / state-green identity outside the picker.

**Color tokens:**
- Selected wedge fill: `#C97B5E` (terracotta)
- Selected wedge text: `#FFFFFF` (white), `font-weight: 600`
- Start button: `#C97B5E` background, `#FFFFFF` text, `font-weight: 600`
- Unselected wedge fill: `#FAF8F2` (page background — wedges "disappear" into canvas, only divider strokes show)
- Unselected wedge text: `#5F5E5A` (existing secondary text color)
- White divider stroke between wedges: `#FFFFFF`, 2 px

### 2.2 Pie size — pull back ~10–15%

**Before:** State picker rendered larger than body picker due to chrome differences. Body was already on the larger side.
**After:** Both pickers use the **same fixed canvas dimensions and pie radius**, sized smaller than body's current size by 10–15%.

**Implementation:** the `AspectRatio(360/220)` from AMENDMENT-1 stays the same shape, but the `SizedBox` wrapping the `CustomPainter` gets a **maxWidth constraint of 280 px** (was: full sheet width minus padding ≈ 328 px on standard phones).

Pie centered horizontally with appropriate padding. The constraint reduces pie width by ~15% on standard phones. Both pickers use the same constraint — no per-focus-type sizing.

### 2.3 Subtitle — present on both pickers, identical copy

**Before:** Body picker had no subtitle. State picker showed `Pick a duration that feels right.`
**After:** Both pickers show the subtitle `Pick a duration that feels right.`

Style: `13 pt`, regular, `#888780`, centered, 4 px below title, 16 px above pie.

### 2.4 `min` suffix — removed from body wedges

**Before:** Body wedges showed two-line labels: `45` (large) + `min` (small below). State wedges showed range strings only.
**After:** Both pickers show **only the value** on each wedge. No `min` suffix.

**Body wedges:** Single line. `30` / `45` / `60`. Centered in wedge.
**State wedges:** Single line. `0–10` / `10–20` / `21–30` / `30–45` (numbered) and `∞` (endless). Centered in wedge.

The title (`How long for <Focus>?`) and subtitle (`Pick a duration that feels right.`) establish the unit context. No need to repeat `min` on every wedge. Reduces visual clutter, makes labels bigger, makes the two pickers symmetric.

### 2.5 Wedge label sizing — unified across pickers

Since both pickers now show single-line labels:

- **Body wedges** (3 segments, larger arc area): label `font-size: 22 px`, `font-weight: 500`, white when selected, `#5F5E5A` when unselected.
- **State numbered wedges** (5 segments, smaller arc area): label `font-size: 13 px`, `font-weight: 500`, white when selected, `#5F5E5A` when unselected.
- **State endless wedge** (`∞` glyph): `font-size: 18 px`, regular, white when selected, `#5F5E5A` when unselected.

Font weights bump to **600** for selected wedge labels (extra emphasis on the active choice). Unselected stays at 500.

### 2.6 Selected state — fill + text only, no border

The terracotta selected fill is bold enough on its own. No additional border, no shadow, no scale-up. The selected wedge is unambiguous via fill color alone.

### 2.7 Disabled / unavailable wedges (state picker only)

Unchanged from AMENDMENT-1 §2.7: render at opacity 0.4, non-tappable. Color logic does not apply to disabled wedges (they remain `#FAF8F2` fill, `#5F5E5A` text, just at reduced opacity).

### 2.8 Sheet chrome (unchanged from AMENDMENT-1)

- Drag handle: 36×4 px, `#D3D1C7`, 2 px rounded.
- Sheet bg: `#FFFFFF`. Top corners 16 px, bottom corners 8 px.
- Title: `How long for <Focus>?` — 17 pt, `FontWeight.w500`, `#2C2C2A`, centered.
- Confirm button: full-width, 42 px tall, 10 px corners, terracotta `#C97B5E`, white text "Start session", `FontWeight.w600`.

### 2.9 Motion and haptics (unchanged from AMENDMENT-1)

- Sheet entrance: 300 ms ease-out slide up.
- Wedge tap: 100 ms opacity dip on press.
- Selected fill change: 150 ms ease-out color transition.
- `HapticFeedback.lightImpact()` on wedge tap.
- `HapticFeedback.mediumImpact()` on confirm.

---

## 3. Files to change

### 3.1 Modify: `app/lib/widgets/sheets/half_pie_picker_sheet.dart`

The single existing widget. Changes are localized to its `_HalfPieConfig` initialization and the `CustomPainter` color/sizing constants.

**Body config diff:**
- `selectedFill`: `Color(0xFF534AB7)` → `Color(0xFFC97B5E)`
- `selectedTextColor`: `Color(0xFFFFFFFF)` (unchanged)
- `buttonColor`: `Color(0xFF534AB7)` → `Color(0xFFC97B5E)`
- `subtitle`: `null` → `'Pick a duration that feels right.'`
- Wedge label format: drop the `unit` field rendering entirely. Remove `min` text from each body wedge.
- Wedge label font size: bump from current size to `22 px` for body wedges. Selected weight `600`, unselected weight `500`.

**State config diff:**
- `selectedFill`: `Color(0xFFE1F5EE)` → `Color(0xFFC97B5E)`
- `selectedTextColor`: `Color(0xFF0F6E56)` → `Color(0xFFFFFFFF)`
- `buttonColor`: `Color(0xFF1D9E75)` → `Color(0xFFC97B5E)`
- `subtitle`: `'Pick a duration that feels right.'` (unchanged)
- Wedge label font size: `13 px` for numbered wedges (may be unchanged from current; verify), `18 px` for endless ∞ glyph. Selected weight `600`, unselected weight `500`.

**Sizing diff (applies to both):**
- Wrap the existing `AspectRatio(360/220)` in a `Center` containing a `ConstrainedBox(maxWidth: 280)`. This caps the pie width at 280 px on phones with sheet width > 280 px. On narrower phones, pie scales down naturally.
- Pre-flight check: confirm 280 px is the right cap. If the sheet is rendering noticeably wider on Prashob's test phone (Samsung Galaxy at standard width), 280 should pull back ~15%. If it's pulling back too aggressively, adjust to 300.

### 3.2 No backend changes

`available-durations` and `suggested-default` endpoints unchanged. No smoke updates needed.

### 3.3 No other Flutter file changes

- `home_page.dart` — no changes (tap handler still calls `showHalfPiePicker`).
- `main.dart` — no changes.
- `focus_duration_provider.dart` / `focus_duration_service.dart` — no changes.
- Old slider / bracket-picker widgets — already deleted in AMENDMENT-1.

---

## 4. Removed in this amendment

| Item | Reason |
|---|---|
| Per-focus-type accent color (purple body / green state) inside picker | Unified to single terracotta. Body/state distinction handled by title text + home pie + session card chrome. |
| `min` suffix on body wedges | Title context establishes the unit. Saves vertical space, makes labels bigger and symmetric. |
| Subtitle absence on body picker | Both pickers now show same subtitle. Symmetry. |
| Larger pie on state picker | Both pickers share same canvas constraint. |

---

## 5. Acceptance criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Body and state pickers render at identical pie size (within 1 px) on the same phone | Open both back-to-back; visually compare or screenshot side-by-side |
| 2 | Selected wedge in body picker fills terracotta `#C97B5E` with white text | Device test |
| 3 | Selected wedge in state picker fills terracotta `#C97B5E` with white text | Device test |
| 4 | Start button on both pickers is terracotta `#C97B5E` with white text, readable contrast | Device test |
| 5 | Body wedges show only `30` / `45` / `60` (no `min` suffix) | Device test |
| 6 | State wedges show only `0–10` / `10–20` / `21–30` / `30–45` / `∞` | Device test |
| 7 | Both pickers show subtitle `Pick a duration that feels right.` | Device test |
| 8 | Disabled state wedges still render at 0.4 opacity, non-tappable | Device test (if any unavailable for tested user) |
| 9 | `flutter analyze` clean (no new info-level hints) | Build artifact |
| 10 | Pie does not overflow narrow phones (test at 360 px sheet width) | Device test |

---

## 6. Pre-flight (Claude Code)

Before writing code:

1. Confirm `app/lib/widgets/sheets/half_pie_picker_sheet.dart` exists post-AMENDMENT-1.
2. Locate the `_HalfPieConfig` initialization for body and state. Confirm field names match those in the spec (`selectedFill`, `buttonColor`, `subtitle`, etc.) — if Claude Code chose different names during AMENDMENT-1 build, adapt.
3. Locate the `CustomPainter` text-rendering code. Confirm where wedge label `unit` is rendered (currently `min` for body). Identify the rendering path to remove.
4. Locate the `AspectRatio` or `SizedBox` wrapping the pie. Confirm where to insert the `ConstrainedBox(maxWidth: 280)`.
5. Verify the existing wedge text positioning math doesn't depend on having a two-line label (since we're going to single line for all body wedges).

If any check diverges from spec assumptions, halt and surface in chat.

---

## 7. Out of scope

| Item | Reason |
|---|---|
| Changing the pie shape | AMENDMENT-1 locked the half-pie. This amendment is visual polish only. |
| Adding animation when wedge is selected | Subtle fill change is enough. Animations are FUTURE_SCOPE. |
| Per-bracket color variation in state picker | All wedges use the same terracotta. |
| Custom shadow or glow on selected wedge | Solid fill is enough. |
| Re-introducing `min` suffix | Locked out. Title carries the unit context. |
| Restoring purple/green accent for body/state | Locked out. Picker uses unified terracotta. |
| Backend changes | None needed. |

---

## 8. Drift log

| Date | Source | Drift | Resolution |
|------|--------|-------|------------|
| _(empty at lock)_ | | | |

---

## 9. Versioning

This is **v1.0** of AMENDMENT-2. Subsequent revisions follow `vN.M`. Drift entries additive.

---

## 10. Relationship to AMENDMENT-1 and T5 base

- **T5 base** still owns: backend endpoints, mode-of-history algorithm, smoke plan.
- **AMENDMENT-1** still owns: half-pie shape, segment counts, tap-detection logic, widget architecture (single `HalfPiePickerSheet` with config), file deletes (slider + bracket-grid widgets gone).
- **AMENDMENT-2 (this doc)** supersedes AMENDMENT-1 only on:
  - §2.1 wedge fill colors (per-focus-type → unified terracotta)
  - §2.5 wedge label rendering (drops `min` suffix on body, bumps font weights)
  - §2.6 sheet chrome (subtitle now on both pickers)
  - Sizing (pie pulled back ~15%)

Everything else in AMENDMENT-1 stands.

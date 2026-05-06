# S13-T4 — AMENDMENT 1 — Pie-Segment Picker + Polish

**Date:** May 3, 2026
**Origin:** Device test on Prashob's phone, post-build (Sprint 13 T4)
**Status:** LOCKED
**Supersedes:** Sections of `S13-T4-DESIGN.md` referenced below

---

## 1. Why this amendment

The original design doc locked an "orbit" focus picker — 12 body chips on an outer ring + 5 state chips on an inner ring + center progress ring. Build shipped per spec. Device test surfaced two real problems:

1. **Selected-chip behavior fights the layout.** The selected chip is supposed to grow + fill solid color + show text inside (Decision #8 in original spec). On a real phone, the chip is too small to grow into a text-bearing shape without overflowing. Implementation attempts produced a floating banner alongside the chip rather than text inside it — visually broken.

2. **17 small chips on one screen is dense.** Even after the implementation bug is fixed, the underlying pattern (small chips, tiny labels) fights phone-screen ergonomics. Senior-design judgment: stop iterating on the orbit shape; pick a different geometry.

This amendment swaps the orbit for a **pie-segment picker** that uses larger, finger-friendly tap targets (whole pie slices) instead of small circles.

---

## 2. What changes

### 2.1 Focus picker geometry — REPLACED

**Original (`S13-T4-DESIGN.md` §4.3):** Two concentric rings of chip-circles, 12 body chips (outer, 30° apart, ~17–20px radius), 5 state chips (inner, 72° apart, ~14–17px radius), center progress ring.

**Amended:** Two concentric **pie rings**:
- **Outer ring:** 12 body-focus pie segments at 30° each, between an inner radius of ~62px and outer radius of ~115px. Each segment is filled (selected = solid `#534AB7`, unselected = `#FAF8F2` with white 2px divider stroke between segments). Single emoji centered in each segment, no text.
- **Inner ring:** 5 state-focus pie segments at 72° each, between an inner radius of ~24px and outer radius of ~58px. Same color logic with state-green (`#E1F5EE` background, `#1D9E75` selected fill).
- **Center disc:** White, 22px radius, holds the weekly progress percentage. Progress ring stroke (3px green) wraps the white disc on the inner radius.

### 2.2 Selected segment treatment

- Selected segment uses solid focus-type color fill (body purple / state green).
- Selected segment displays the **focus name as a small label** centered in the segment, with the emoji directly above. Body segments have enough arc length at this radius to fit names like "Hamstrings" or "Mobility" in 9pt — verified by SVG mockup. State segments fit names like "Energize" / "Recover" in 9pt.
- Unselected segments display **emoji only**, larger (14pt) so the picker still reads as a visual map.
- No floating labels, no banner-attachment patterns. The label lives **inside** the segment.

### 2.3 Tap interaction

- Hit-test = whole segment, not just the emoji.
- Tap any segment → fire `selectFocus(focus_slug)` → engine call → today's session card updates → tapped segment becomes selected.
- 300ms debounce same as orbit.
- No drag-to-rotate, no gesture work in v1.

### 2.4 Streak chip — hide when zero

`S13-T4-DESIGN.md` §4.1 originally rendered `🔥 N` always. **Amended:** if `streakDays == 0`, hide the chip entirely (zero space, not "🔥 0").

### 2.5 Body-map icon — swap to `LucideIcons.scan`

`S13-T4-DESIGN.md` §4.7 / §4.8 referenced a body-silhouette icon for the top-right app-bar action that opens the 3D body map. The currently-shipped icon (`Icons.person_outline` or similar) collides visually with the bottom-nav Profile tab. **Amended:** use `LucideIcons.scan` from the `lucide_icons` package (already in `pubspec.yaml`). Custom body-silhouette SVG remains FUTURE_SCOPE alongside the picker icon set.

---

## 3. What stays the same

- Sprint 12 engine endpoints unchanged.
- HomePage layout order unchanged: app bar → Today's session card → focus picker (now pie) → training load chart → stat tiles → 14-day bar chart → 5-tab bottom nav.
- Engine call signature unchanged: `POST /api/sessions/suggest` with `{focus_slug}`; state focuses default to `21–30` bracket per AMENDMENT-equivalent decisions in original doc Decision #4.
- All other Decisions (#1–9) in original spec unchanged.
- All HTTP through `ApiService`, provider follows `ChangeNotifier`, `flutter analyze` clean.

---

## 4. Acceptance criteria (delta from original §9)

Original criteria 1, 2, 4, 5, 6, 7, 8, 9, 10, 11 stand unchanged.

Original criterion #3 (selected chip shows text label; unselected chips show emoji only) is **reworded** to:

> Selected pie segment shows emoji + focus name inside the segment, filled with focus-type color. Unselected segments show emoji only on neutral background.

New criteria:

| # | Criterion | Verification |
|---|-----------|--------------|
| 12 | Streak chip hidden when `streakDays == 0` | Device test on fresh user account |
| 13 | Top-right body-map icon is `LucideIcons.scan`, opens `/body` route | Device test |
| 14 | Pie-segment hit area covers the whole segment, not just emoji | Device test (tap empty area inside a segment) |

---

## 5. Out of scope (unchanged)

All FUTURE_SCOPE items from original §10 still deferred. New items added by this amendment:

- Drag-to-rotate the pie ring (would let the user rotate the selected segment to the top for a satisfying interaction; deferred to a polish ticket)
- Custom body-silhouette icon for the body-map action (currently `LucideIcons.scan`)

---

## 6. References

- Original spec: `Trackers/S13-T4-DESIGN.md`
- Device-test screenshots: chat session with Prashob, May 3, 2026
- Pie-picker mockup: chat session with Prashob, May 3, 2026 (Option B from "orbit_picker_alternatives_round2" widget)

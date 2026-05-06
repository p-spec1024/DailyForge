# S13-T5 — State-Focus Bracket Picker + Body-Focus Duration Slider — Design Doc

**Status:** DRAFT pending Prashob greenlight
**Drafted:** May 3, 2026
**Author:** Claude.ai (Architect)
**Owner:** Prashob (CEO/PO)
**Supersedes:** T4's tap-and-instant-suggest model (Decision #4 in `S13-T4-DESIGN.md`); T4's `full_body` auto-suggest on first load.
**Depends on:** S13-T4 (home page) shipped, S12-T3.5 (`getAvailableDurations` exported helper) shipped, S12-T7 (`POST /api/sessions/suggest` accepting `bracket` and `time_budget_min`) shipped.
**Blocks:** S13-T6 (session start handoff to existing pillar players).

---

## 1. Purpose

T4 shipped the home page with a tap-and-instant-suggest model — every focus tap immediately fires `/api/sessions/suggest` with engine defaults (`time_budget` and `bracket` unset; engine picks `30 min` for body focuses and `21–30` for state focuses). That model gave us a working home page fast, but it makes two compromises:

1. **State focus dishonesty.** The S12 v2 spec (Decision #17) is explicit that state-focus content cannot honestly promise a single duration value — the picker exists *because* range-brackets are required for honesty. T4 hard-defaults `21–30` for every state-focus tap, which silently violates the contract on first load.
2. **Body focus rigidity.** A user who wants a 45-min biceps session has no way to ask for one. The slider exists to give them that knob.

T5 replaces the auto-suggest model with **tap → sheet → pick → suggest** for both focus types. The home page first load shows an empty session-card slot until the user taps a focus.

This is a real refactor of T4's flow, not just additive UI. The design doc calls out the T4 paths being deleted and the T4 paths being preserved.

---

## 2. Design philosophy (non-negotiable)

The picker is **the moment the user commits to today's session.** It's not a settings dialog or a configurator — it's the one tap where the user says "this is what I'm doing now." That weight earns the picker dedicated polish: a continuous slider with haptic ticks for body focus, a calm bracket grid for state focus.

References for the slider: Apple Health's workout-duration picker (haptic + value-display + snap), Linear's number input, Things 3's date scrubbers. Anti-references: stepper buttons (cold), wheel pickers (form-y), dropdown menus (administrative).

References for the bracket grid: Calm's session-length picker, Headspace's "How long do you have?" sheet. Anti-references: pillchips with locked/empty grey-out states (the user shouldn't see what they can't have — this is a Q3 decision from T5 planning).

---

## 3. Locked decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Picker scope | T5 ships **both** state-focus bracket sheet AND body-focus duration slider. Single sprint, single coherent flow. | Symmetric UX. Tap any focus → sheet → pick → suggest. Consistency over staggered rollout. |
| 2 | State-focus picker shape | 5 brackets per S12 spec: `0–10` / `10–20` / `21–30` / `30–45` / `Until I'm done`. Backend gates which are available. | Locked from S12 v2 spec §State-focus picker. T5 only renders. |
| 3 | Body-focus picker shape | Continuous Material slider, range `30 min` to `60 min`, **5-min steps** (`30/35/40/45/50/55/60` — 7 stops). | Spec §Body-focus pickers locks home as `30 / 60 only`. T5 expands to a slider. 5-min granularity is the precision-vs-feel sweet spot — engine treats requests as `±10%` tolerance, so `35` honestly composes inside that band. |
| 4 | Body-focus picker — yoga-tab `15-min` option | **Out of scope.** T5 is the *home* slider only. The S12 spec's yoga-tab `15/30/45/60` picker remains a future yoga-tab ticket. | Home is cross-pillar (5-phase math floors at 30 min). 15-min cross-pillar would force degraded sessions. Yoga-tab is single-pillar and bends to 15. Different surface, different ticket. |
| 5 | Picker entry — state focus | Tap a state focus on the pie → bracket sheet opens → user picks → `/suggest` fires with `bracket`. | Honesty: every state-focus session is an explicit bracket choice. No silent default. |
| 6 | Picker entry — body focus | Tap a body focus on the pie → slider sheet opens → user picks → `/suggest` fires with `time_budget_min`. | Symmetric with state focus. Every session is an active choice. |
| 7 | Default value — state focus | Mode of user's prior `breathwork_sessions` for this focus, mapped to bracket. Tie-break toward most recent. New user (no history) → `0–10`. | "What the user mostly does" — closes FUTURE_SCOPE #144. Gentle fallback for new users. |
| 8 | Default value — body focus | Mode of user's prior `sessions` (strength + 5-phase rows) for this focus, snapped to nearest 5-min step. Tie-break toward most recent. New user → `30 min`. | Same shape as state-focus default. New-user fallback = shortest honest cross-pillar option. |
| 9 | Default-history window | Last 30 days, fallback to all-time, fallback to spec default. | 30 days captures recent habit; all-time fallback handles users who paused; spec default handles cold start. |
| 10 | Unusable brackets — render? | **Hide** locked-by-level and empty brackets entirely. Sheet shows only `available` brackets (plus `endless` if available). | Q3 from T5 planning: "just don't show them." Cleaner. Progression-as-feature surfaces elsewhere if we want it later (FS deferred). |
| 11 | First-load home behavior | **No auto-suggest.** Empty session-card slot with welcoming prompt copy. User must tap a focus. | T4's `full_body` auto-suggest is removed. Every session is an active choice. |
| 12 | Pie default visual selection | Pie keeps `full_body` visually highlighted on first load. Tapping the highlighted wedge still opens the picker (any tap = picker, regardless of selection state). | Pie isn't blank, but no engine call fires until the user acts. |
| 13 | Sheet dismiss behavior | Swipe down or tap-outside-scrim dismisses without firing suggest. No "cancel" button. Pie selection rolls back to pre-tap state. | Standard bottomsheet behavior. Cancel is implicit. |
| 14 | Re-entering picker after a session is shown | Tapping the same focus again re-opens the picker, pre-selected to last-picked value (not history-mode). Tapping a different focus opens its picker pre-selected from history-mode. | Once a user has picked, "their pick" beats "history mode" for the rest of the session — but only for that focus. Switching focuses re-reads history. |
| 15 | Pre-existing session state on tap | If a session card is already showing, tapping any focus opens the picker. On confirm, the new session replaces the old one. On dismiss, the existing session card stays. | No silent overwrite. User confirms intent. |
| 16 | State-focus card phase rendering | New `StateFocusSessionCard` widget renders the 3-phase `centering / practice / reflection` shape using the same chrome as body-focus card (top label + title + subtitle). Phase summary subtitle: `"Centering · Practice · Reflection"` (single line). | Reuse card chrome → consistency. New phase row renderer → honest about the different shape underneath. |
| 17 | Engine `endless` mode in card subtitle | Card title shows `<Focus> · Open` (e.g. `Calm · Open`) instead of `<Focus> · 25 min`. Subtitle reads `Centering · Practice · Reflection · ∞`. | "Open" reads warmer than "endless" or "until done"; `∞` symbol is universal for unlimited. |
| 18 | Persisting last-picked-value | Persist per-focus last-picked value in `SharedPreferences` via existing `StorageService` keyed `t5.lastPicked.<focus_slug>`. Used for Decision #14's same-focus re-pick behavior. | Survives app restart. Per-focus, not global, so calm/biceps/sleep each remember their own pick. |
| 19 | Slider haptics | `HapticFeedback.selectionClick()` on every snap-to-step (every 5 minutes during drag). | Tactile confirmation. Material standard. |
| 20 | Slider live value display | Big number above the slider (label `min` to the right, smaller). Subtitle below number reads `~Y min main work` where Y interpolates linearly from `(30 → 18)` to `(60 → 40)`. | Q5c decision: subtitle gives the slider purpose without bookend math leaking. |
| 21 | Slider tick marks | Three labeled ticks: `30` / `45` / `60` only. No tick at the 5-min steps in between. | All 7 ticks would clutter. Three anchor points are enough — the snapping handles precision. |
| 22 | Sheet height | `~60% of screen height` for both sheets. `showModalBottomSheet` with `isScrollControlled: true` and `DraggableScrollableSheet` if needed for shorter phones. | Generous canvas for the picker without taking the whole screen. |

---

## 4. Page anatomy — flow changes

### 4.1 Home page first load (changed from T4)

**Before T5 (T4 behavior):**
- Page mounts → `HomeProvider._loadInitial` calls `/api/sessions/suggest` with `focus_slug: 'full_body'` immediately.
- Session card renders with the engine's pick.
- Pie shows `full_body` selected.

**After T5:**
- Page mounts → `HomeProvider._loadInitial` calls all the home-aggregation slices (stats, weekly-activity, daily-load, daily-counts, focus-areas, pillar-levels) **but does NOT call `/suggest`.**
- Session card slot renders empty-state copy: a centered prompt `"Pick today's focus →"` with a subtle arrow nudge toward the pie. Soft grey card chrome (`#FAF8F2` background, `#E6E4DC` border).
- Pie shows `full_body` visually selected.
- `SuggestProvider` is in its `idle` state — no session has been requested.

**Empty session-card visual:**
- Same outer dimensions as the populated card (no layout shift on tap).
- Centered text in `#5F5E5A`, `15pt`, italic-light.
- Animated chevron `›` to the right of the text, gentle horizontal pulse animation (1.2s cycle, 4px translation).

### 4.2 Tap-on-pie flow

**Old (T4):**
```
Pie tap → setSelectedFocus → SuggestProvider.fetchSuggestion(focusSlug)
→ session card swaps in
```

**New (T5):**
```
Pie tap → setSelectedFocus (visual only)
→ check focus.type
  → 'body' → showModalBottomSheet(DurationSliderSheet(focus))
  → 'state' → showModalBottomSheet(BracketPickerSheet(focus))
→ user picks value (or dismisses)
  → on pick: SuggestProvider.fetchSuggestion(focusSlug, time_budget_min OR bracket)
            → session card swaps in
            → persist t5.lastPicked.<focus_slug> to SharedPreferences
  → on dismiss: pie selection reverts to pre-tap value, no engine call fires
```

### 4.3 Same-focus re-tap flow

After a session card is showing, tapping the same focus on the pie:
1. Picker opens.
2. Pre-selection comes from `t5.lastPicked.<focus_slug>` (not history-mode).
3. On pick, new `/suggest` fires; old card is replaced.
4. On dismiss, existing card stays (pie state unchanged).

### 4.4 Different-focus tap flow

After a session card is showing, tapping a different focus:
1. Picker opens.
2. Pre-selection comes from history-mode (not `t5.lastPicked.<focus_slug>` — since this is a fresh focus context).
3. On pick, new `/suggest` fires; old card is replaced; pie selection updates.
4. On dismiss, existing card stays; pie selection reverts to old focus.

---

## 5. BracketPickerSheet (state focus)

### 5.1 Layout

```
┌─────────────────────────────────────┐
│        Drag handle (centered)        │
│                                      │
│       How long for Calm?            │  ← Title, 22pt, semibold
│   Pick a duration that feels right.  │  ← Subtitle, 14pt, #5F5E5A
│                                      │
│    ┌────────┐  ┌──────────┐         │
│    │ 0–10   │  │  10–20   │         │  ← Bracket pills (only available ones)
│    │  min   │  │   min    │         │
│    └────────┘  └──────────┘         │
│    ┌────────┐                       │
│    │ 21–30  │  ← Highlighted        │  ← Default selection
│    │  min   │  (mode-of-history     │
│    └────────┘   or 0–10 fallback)   │
│                                      │
│         ┌──────────────┐            │
│         │ Until I'm    │            │  ← Endless option, full-width
│         │   done   ∞   │            │
│         └──────────────┘            │
│                                      │
│  ┌──────────────────────────────┐   │
│  │     Start Session           │    │  ← Confirm button, full-width
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 5.2 Bracket pill spec

- Pill dimensions: minimum `120px wide × 64px tall`. Rounded `14px` corners.
- Layout: 2-up grid, 12px gap. If only 1 numbered bracket is available, it centers in the row; the endless pill stays full-width below.
- Endless pill: full-width, separated from the numbered grid by 16px vertical gap and a hairline divider (`#E6E4DC`).

### 5.3 Pill states

| State | Background | Border | Text color | Notes |
|---|---|---|---|---|
| Unselected | `#FFFFFF` | `1px solid #D3D1C7` | `#2C2C2A` (primary), `#5F5E5A` (`min` label) | Tappable. |
| Selected | `#E1F5EE` (state-accent bg) | `1.5px solid #1D9E75` | `#0F6E56` (state-accent text) | Currently chosen. |
| Pressed (during tap) | Slight darken on background, scale `0.98` for 100ms | unchanged | unchanged | Material ripple. |

Locked-by-level and empty brackets are **not rendered** (Decision #10).

### 5.4 Pill text

- Numbered: top line `0–10` (16pt semibold), bottom line `min` (12pt regular, `#5F5E5A` even on selected — kept secondary).
- Endless: top line `Until I'm done` (16pt semibold), bottom line `∞` (24pt regular, centered).

### 5.5 Confirm button

- Full-width, `48px tall`, `#1D9E75` background, white text, `8px` rounded corners.
- Label: `Start Session`.
- Disabled if no bracket selected (defensive — should never happen with default-selection logic).
- On tap: dismiss sheet → trigger `SuggestProvider.fetchSuggestion(focusSlug, bracket: <pickedSlug>)`.

### 5.6 Title / subtitle copy

- Title: `How long for <Focus name>?` (e.g. `How long for Calm?`)
- Subtitle: `Pick a duration that feels right.` (single line)

### 5.7 Loading and error states

**Available-durations loading:**
- Skeleton row of 3 grey pill placeholders (no shimmer — too much motion for a calm sheet). 200ms minimum to avoid flash.

**Available-durations error:**
- Error card replaces pill grid. Copy: `Couldn't load duration options.` Below: small grey button `Retry`.
- If retry also fails, copy adjusts to: `Still can't reach the server. Check your connection.`
- No bracket fallback — better to fail visibly than to lie about availability.

**No available brackets returned (edge case — should not happen):**
- Replace pill grid with: `No durations available for <Focus name> at your level yet.` and a `Back` button that dismisses the sheet.

---

## 6. DurationSliderSheet (body focus)

### 6.1 Layout

```
┌─────────────────────────────────────┐
│        Drag handle (centered)        │
│                                      │
│       How long for Biceps?         │  ← Title, 22pt, semibold
│                                      │
│                                      │
│              45                     │  ← Big number, 64pt
│              min                    │  ← Unit, 18pt, secondary
│         ~25 min main work           │  ← Subtitle, 13pt, #5F5E5A
│                                      │
│    ●━━━━━━━━━━●━━━━━━━●━━━━━●       │  ← Slider track (filled left of thumb)
│    30          45          60        │  ← Tick labels under track
│                                      │
│                                      │
│  ┌──────────────────────────────┐   │
│  │     Start Session           │    │  ← Confirm button
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 6.2 Slider spec

- Material 3 `Slider` widget (or custom for full polish — Claude Code judgment).
- Range: `30.0` to `60.0`. Divisions: `6` (yields steps at `30/35/40/45/50/55/60` — 7 stops including endpoints).
- Track: `4px tall`. Active (left of thumb) `#534AB7`. Inactive (right) `#EEEDFE`.
- Thumb: `24px circle`, `#534AB7` fill, `2px white` ring, soft shadow `0 2px 6px rgba(0,0,0,0.12)`.
- Tick marks: only visible at `30 / 45 / 60`. No marks at intermediate steps.
- On drag, snap-to-step on every change (not just on release).
- Haptic `selectionClick()` on every snap (every 5 min).

### 6.3 Live value display

- Big number: `64pt`, semibold, `#2C2C2A`, centered above slider.
- Updates **every step**, animated `100ms ease-out` between values (slight ease so it doesn't feel jumpy).
- Unit `min`: `18pt`, regular, `#5F5E5A`, baseline-aligned below the number.

### 6.4 Subtitle (`~Y min main work`)

- `13pt`, regular, `#5F5E5A`.
- Y = `round((mainAt30) + (totalMin - 30) * (mainAt60 - mainAt30) / (60 - 30))`
  - With `mainAt30 = 18` and `mainAt60 = 40`, this is `Y = round(18 + (totalMin - 30) * 22/30)`.
  - At 30 → 18; at 35 → 22; at 40 → 25; at 45 → 29; at 50 → 33; at 55 → 36; at 60 → 40.
- Updates live with the slider.
- The `~` is intentional — bookend math is approximate per the spec's degradation tolerance.

### 6.5 Confirm button

- Full-width, `48px tall`, `#534AB7` background (body-focus accent), white text, `8px` rounded corners.
- Label: `Start Session`.
- On tap: dismiss sheet → trigger `SuggestProvider.fetchSuggestion(focusSlug, time_budget_min: <slidervalue>)`.

### 6.6 Title / subtitle copy

- Title: `How long for <Focus name>?` (e.g. `How long for Biceps?`)
- No subtitle for the body-focus sheet — the slider's live value display is the entire affordance, no additional explanation needed.

### 6.7 Loading and error states

**No loading state** — the slider sheet has no backend dependency. Opens immediately.

**Error states** apply only when the user confirms and the `/suggest` call fails — those are handled at the page level, not the sheet level (sheet has already dismissed). Page surfaces a snackbar with retry.

---

## 7. Backend — `GET /api/focus-areas/:slug/available-durations`

### 7.1 Endpoint contract

```
GET /api/focus-areas/:slug/available-durations
Authorization: Bearer <jwt>

Response 200:
{
  "focus_slug": "calm",
  "breathwork_level": "beginner",
  "ranges": [
    {
      "label": "0_10",
      "display": "0–10 min",
      "min_total_minutes": 1,
      "max_total_minutes": 10,
      "state": "available",
      "technique_count": 4
    },
    {
      "label": "endless",
      "display": "Until I'm done",
      "min_total_minutes": null,
      "max_total_minutes": null,
      "state": "available",
      "technique_count": 4
    }
    // locked / empty entries omitted from list per Decision #10
  ]
}
```

### 7.2 Behavior

- JWT auth via existing `authenticate` middleware. Returns 401 if missing.
- `:slug` validated against `focus_areas.slug`. Returns 404 with `{error: 'unknown_focus_slug'}` if not found.
- Resolves `:slug` → `focus_areas.focus_type`. If `focus_type !== 'state'`, returns 400 with `{error: 'invalid_focus_type_for_durations', message: 'Only state focuses have available durations.'}`. Body focuses don't need this endpoint — slider is fully client-side.
- Reads `req.user.id` from JWT; reads breathwork pillar level from `user_pillar_levels` (joins on `user_id` + `pillar='breathwork'`).
- Calls existing `getAvailableDurations(focus_slug, breathwork_level)` from `server/src/services/suggestionEngine.js`.
- Filters response: only `ranges` with `state === 'available'` are returned (Decision #10). Others are stripped server-side. **Engine output is unchanged** — filtering happens at the route layer.
- Returns 500 with `{error: 'engine_error'}` on unexpected throws (shouldn't happen — engine helper is deterministic).

### 7.3 Stable error codes

| Code | HTTP status | When |
|---|---|---|
| `unknown_focus_slug` | 404 | Slug not in `focus_areas` |
| `invalid_focus_type_for_durations` | 400 | Slug is body-focus, not state |
| `breathwork_level_not_set` | 400 | User has no `user_pillar_levels` row for `breathwork`. Should not happen post-T1 onboarding, but defensive. |
| `engine_error` | 500 | Catch-all |

### 7.4 Pre-flight (Claude Code must verify before writing the route)

1. **`getAvailableDurations` export shape.** Read `server/src/services/suggestionEngine.js`. Confirm the function is exported and accepts `(focus_slug, breathwork_level)`. Confirm response shape matches the v2 spec §getAvailableDurations contract section.
2. **Existing `focus-areas.js` route file shape.** Read `server/src/routes/focus-areas.js` (S13-T2 file). Pattern-match the new endpoint to the existing one (auth middleware, query style, error code style).
3. **`user_pillar_levels` schema.** Confirm the table has `(user_id, pillar, level)` rows with `pillar` ENUM including `breathwork`.
4. **`focus_areas.focus_type` column.** Confirm it exists and contains `'state'` for the 5 state focuses (per S11-T3 schema).
5. **Engine helper output already filters `endless` correctly.** Per S12 v2 spec line 387, `endless` is `available` when the focus has at least one main-eligible technique at the user's level. Smoke must verify this end-to-end.

If any of these diverge from spec assumptions, halt and surface in chat before writing. (Pattern locked Project Instructions principle #14.)

---

## 8. Flutter — Models, services, providers

### 8.1 New model: `AvailableDurations` (`app/lib/models/available_durations.dart`)

```dart
class AvailableDurations {
  final String focusSlug;
  final String breathworkLevel;
  final List<DurationBracket> ranges;
}

class DurationBracket {
  final String label;          // '0_10' | '10_20' | '21_30' | '30_45' | 'endless'
  final String display;        // '0–10 min' | 'Until I'm done'
  final int? minTotalMinutes;  // null for endless
  final int? maxTotalMinutes;  // null for endless
  final String state;          // 'available' (always — server filters)
  final int? techniqueCount;
}
```

Strict JSON parsing — factory throws `FormatException` on shape violations (matches T3 `SuggestedSession` parser pattern).

### 8.2 New service: `FocusDurationService` (`app/lib/services/focus_duration_service.dart`)

```dart
class FocusDurationService {
  Future<AvailableDurations> fetchAvailableDurations(String focusSlug);
}

class FocusDurationServiceException implements Exception {
  final String? code;     // null for network/parse errors
  final String message;
}
```

- HTTP via existing `ApiService` (auth + timeout + 401-logout inherited).
- Route: `GET /api/focus-areas/:slug/available-durations`.
- Maps `ApiException` → `FocusDurationServiceException` matching T3's `SuggestServiceException` mapping pattern.
- Stable error codes consumed: `unknown_focus_slug`, `invalid_focus_type_for_durations`, `breathwork_level_not_set`, `engine_error`, plus T3's `network_error` synthesized on connectivity issues.

### 8.3 New provider: `FocusDurationProvider` (`app/lib/providers/focus_duration_provider.dart`)

Pattern-matches `SuggestProvider` (extends `ChangeNotifier`).

States: `idle | loading | success | error`. Holds:
- `AvailableDurations? data`
- `String? errorCode`
- `bool get isLoading`

Methods:
- `Future<void> fetchFor(String focusSlug)` — guards against stale-response race using slug-check on result (T3 pattern).
- `void clear()`.

Wired in `main.dart` alongside `SuggestProvider`.

### 8.4 New widgets

**`BracketPickerSheet` (`app/lib/widgets/sheets/bracket_picker_sheet.dart`)**

- StatefulWidget. Opens via `showModalBottomSheet`.
- On open: triggers `FocusDurationProvider.fetchFor(focusSlug)` and reads `t5.lastPicked.<focus_slug>` from `StorageService` to compute initial selection.
- Renders 3 phases: loading (skeleton pills), success (filtered grid), error (retry card).
- Default selection logic:
  1. If `t5.lastPicked.<focus_slug>` exists AND its bracket is in the available list → use it.
  2. Else compute mode-of-history (see §9) → if available and in list → use it.
  3. Else → `0_10` if available, else first available bracket.
- On confirm: persist `t5.lastPicked.<focus_slug>` and pop sheet with `Navigator.pop(context, pickedBracket)`.

**`DurationSliderSheet` (`app/lib/widgets/sheets/duration_slider_sheet.dart`)**

- StatefulWidget. Opens via `showModalBottomSheet`.
- No backend dependency.
- Default value logic:
  1. If `t5.lastPicked.<focus_slug>` exists → use it (snapped to nearest 5-min step).
  2. Else compute mode-of-history (see §9) → snap to nearest 5-min step → clamp to [30, 60].
  3. Else → `30`.
- On confirm: persist `t5.lastPicked.<focus_slug>` and pop sheet with `Navigator.pop(context, pickedMinutes)`.

**`StateFocusSessionCard` (`app/lib/widgets/cards/state_focus_session_card.dart`)**

- Renders the engine's state-focus shape (`session_shape: 'state_focus'`, phases `centering / practice / reflection`).
- Same outer chrome as body-focus card (top label `TODAY`, focus pill, title, subtitle, recency warning slot, Start button).
- Subtitle reads: `Centering · Practice · Reflection` (or `Centering · Practice · Reflection · ∞` for endless).
- Title: `<Focus name> · <total_min> min` (or `<Focus name> · Open` for endless).
- Same Start button color/shape as body-focus card.

### 8.5 Modified files

**`app/lib/pages/home/home_page.dart`** — change pie tap handler:
```dart
// Old (T4):
onFocusTap: (slug) async {
  setSelectedFocus(slug);
  await context.read<SuggestProvider>().fetchSuggestion(slug);
}

// New (T5):
onFocusTap: (slug) async {
  setSelectedFocus(slug); // visual update only
  final focus = focusAreasProvider.findBySlug(slug);
  final picked = focus.type == 'state'
    ? await showBracketPickerSheet(context, focusSlug: slug)
    : await showDurationSliderSheet(context, focusSlug: slug);

  if (picked == null) {
    // dismissed — revert selection
    setSelectedFocus(previousSelectedFocus);
    return;
  }

  if (focus.type == 'state') {
    await context.read<SuggestProvider>().fetchSuggestion(
      slug, bracket: picked as String);
  } else {
    await context.read<SuggestProvider>().fetchSuggestion(
      slug, timeBudgetMin: picked as int);
  }
}
```

**`app/lib/providers/home_provider.dart`** — remove auto-suggest:
```dart
// Old (T4): _loadInitial included a call to SuggestProvider.fetchSuggestion('full_body')
// New (T5): _loadInitial does NOT call SuggestProvider. Session card stays empty until user taps.
```

**`app/lib/providers/suggest_provider.dart`** — extend `fetchSuggestion` signature:
```dart
// Old (T3):
Future<void> fetchSuggestion(String focusSlug, {String entryPoint = 'home'})

// New (T5):
Future<void> fetchSuggestion(
  String focusSlug, {
  String entryPoint = 'home',
  int? timeBudgetMin,
  String? bracket,
})
```

The model and JSON parsing already accommodate both — T3's strict parser handles state-focus `centering/practice/reflection` shape and body-focus `bookend_open/warmup/main/cooldown/bookend_close` shape (verified during T4 build per the SPRINT_TRACKER fix-forward note).

**`app/lib/services/suggest_service.dart`** — add `timeBudgetMin` and `bracket` to request body shape, send conditionally based on which is non-null.

**`app/lib/services/storage_service.dart`** — no changes (T3 already added `removePreference`; `setPreference`/`getPreference` cover the persistence needs).

**`app/lib/main.dart`** — wire `FocusDurationProvider`.

### 8.6 Empty session card slot

New widget: `EmptySessionCardSlot` (`app/lib/widgets/cards/empty_session_card_slot.dart`).

- Same dimensions and outer chrome as session card (no layout shift).
- Centered text + animated chevron per §4.1.
- Pure presentational — no provider dependency.

`HomePage` renders `EmptySessionCardSlot` when `SuggestProvider.state == idle`. Renders the appropriate card (body or state) when `SuggestProvider.state == success`. Renders an error retry card on `error`.

---

## 9. Mode-of-history default — algorithm

### 9.1 State focus

Query: most-frequent bracket from user's last 30 days of `breathwork_sessions` for this focus.

```sql
SELECT bracket, COUNT(*) AS n, MAX(created_at) AS recency
FROM (
  SELECT
    bs.created_at,
    CASE
      WHEN bs.duration_minutes <= 10 THEN '0_10'
      WHEN bs.duration_minutes <= 20 THEN '10_20'
      WHEN bs.duration_minutes <= 30 THEN '21_30'
      WHEN bs.duration_minutes <= 45 THEN '30_45'
      ELSE 'endless'  -- shouldn't happen at this date; defensive
    END AS bracket
  FROM breathwork_sessions bs
  WHERE bs.user_id = $1
    AND bs.focus_slug = $2
    AND bs.created_at >= NOW() - INTERVAL '30 days'
    AND bs.completed = true
) sub
GROUP BY bracket
ORDER BY n DESC, recency DESC
LIMIT 1;
```

If no rows in last 30 days → run again without the `INTERVAL` clause.
If still no rows → return `null`. Sheet falls back to spec default (`0_10`).

**Implementation note:** This query lives in **the backend** (`getAvailableDurations` route extension OR a sibling helper endpoint), not in Flutter. Returning the suggested-default in the same endpoint as the available-durations response is cleaner than a separate Flutter query.

**Decision: extend the `available-durations` endpoint response with a `suggested_default` field.**

```jsonc
{
  "focus_slug": "calm",
  "breathwork_level": "beginner",
  "ranges": [...],
  "suggested_default": "0_10"  // NEW
}
```

`suggested_default` is always one of the labels in `ranges` (or `null` if all available brackets have zero history — then Flutter applies its fallback chain).

### 9.2 Body focus

Query: most-frequent duration from user's last 30 days of `sessions` (strength + 5-phase rows) for this focus, snapped to 5-min steps.

```sql
SELECT duration_5min, COUNT(*) AS n, MAX(date) AS recency
FROM (
  SELECT
    s.date,
    -- Round duration_minutes to nearest 5, clamp to [30, 60]
    GREATEST(30, LEAST(60, ROUND(s.duration_minutes / 5.0) * 5))::INT AS duration_5min
  FROM sessions s
  WHERE s.user_id = $1
    AND s.focus_slug = $2
    AND s.date >= CURRENT_DATE - INTERVAL '30 days'
    AND s.completed = true
    AND s.duration_minutes IS NOT NULL
) sub
GROUP BY duration_5min
ORDER BY n DESC, recency DESC
LIMIT 1;
```

Same fallback chain as state focus.

**Implementation note:** Body focus has no equivalent endpoint to `/available-durations`. We need a new lightweight endpoint OR fold into another existing call.

**Decision: new endpoint `GET /api/focus-areas/:slug/suggested-default`.**

```
GET /api/focus-areas/:slug/suggested-default
Authorization: Bearer <jwt>

Response 200:
{
  "focus_slug": "biceps",
  "focus_type": "body",
  "suggested_default": 45  // minutes for body, bracket label string for state
}
```

For body focus, returns `int` (minutes 30–60). For state focus, returns the bracket label `string`. Defensive null when no history exists. Same JWT/error-code conventions as the duration endpoint.

This endpoint is called when the slider sheet opens (body focus) before the user sees the slider position. ~80ms typical roundtrip; sheet renders the slider at the spec fallback (`30`) immediately and animates to the suggested-default value when the response arrives. (No janky pop — the slider just slides up to the new value with a 300ms ease.)

### 9.3 Why two endpoints, not one

**State focus picker needs:** which brackets are available + which is the default → 1 endpoint = available-durations with `suggested_default` field.

**Body focus picker needs:** which value is the default. (No availability check — slider always allows 30–60.) Simpler endpoint.

The two endpoints share the focus-areas namespace and return-shape style. Clean separation.

---

## 10. Visual specifications

### 10.1 Colors (inherit from T4 design doc §8)

- Background: `#FAF8F2` (page), `#FFFFFF` (sheet, cards)
- Borders: `#D3D1C7`, dividers `#E6E4DC`
- Text: `#2C2C2A` / `#5F5E5A` / `#888780`
- Body focus accent: `#534AB7` (slider thumb, confirm button), `#EEEDFE` (slider inactive track), `#3C3489` (text emphasis)
- State focus accent: `#1D9E75` (selected pill border, confirm button), `#E1F5EE` (selected pill bg), `#0F6E56` (selected pill text)
- Empty card slot: `#FAF8F2` bg, `#E6E4DC` border, `#5F5E5A` text

### 10.2 Typography

- Sheet title: `22pt`, semibold, `#2C2C2A`
- Sheet subtitle: `14pt`, regular, `#5F5E5A`
- Slider big number: `64pt`, semibold, `#2C2C2A`
- Slider unit (`min`): `18pt`, regular, `#5F5E5A`
- Slider subtitle: `13pt`, regular, `#5F5E5A`
- Bracket pill primary text: `16pt`, semibold
- Bracket pill secondary (`min` / `∞`): `12pt` regular / `24pt` regular
- Confirm button: `16pt`, semibold, white

### 10.3 Spacing and dimensions

- Sheet padding: `20px` horizontal, `16px` top, `24px` bottom
- Drag handle: `40px wide × 4px tall`, `#D3D1C7`, `4px` rounded, centered, `12px` top margin
- Title-to-content gap: `16px`
- Pill grid gap: `12px` between cells, `16px` row gap
- Endless pill margin: `16px` above (with hairline divider)
- Slider track-to-tick-label gap: `8px`
- Confirm button: full-width, `48px tall`, `16px` margin top from content
- Sheet corner radius: `20px` top corners only

### 10.4 Motion

- Sheet entrance: `300ms ease-out` slide up
- Sheet dismiss: `250ms ease-in` slide down
- Bracket pill press: `100ms` scale `0.98` then back
- Slider value snap: `100ms ease-out` between values
- Confirm button press: `100ms` scale `0.97` + opacity `0.92`
- Empty card chevron pulse: `1.2s` cycle, `4px` translation, ease-in-out

### 10.5 Haptics

- Bracket pill tap: `HapticFeedback.lightImpact()`
- Slider snap (every 5 min): `HapticFeedback.selectionClick()`
- Confirm button tap: `HapticFeedback.mediumImpact()`
- Sheet dismiss: no haptic (system handles)

---

## 11. Acceptance criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | First-load home shows empty session-card slot, no `/suggest` call fires | Device test + network log |
| 2 | Pie has `full_body` visually selected on first load | Device test |
| 3 | Tapping a body focus opens DurationSliderSheet | Device test |
| 4 | Slider snaps at 5-min steps with haptic ticks | Device test |
| 5 | Slider live value updates with `~Y min main work` subtitle | Device test |
| 6 | Confirming slider fires `/suggest` with `time_budget_min` | Network log + session card renders |
| 7 | Tapping a state focus opens BracketPickerSheet | Device test |
| 8 | Bracket grid hides locked/empty brackets | Device test against seeded user with mixed availability |
| 9 | Confirming bracket fires `/suggest` with `bracket` | Network log + session card renders |
| 10 | State-focus session card renders `centering/practice/reflection` subtitle | Device test |
| 11 | Endless bracket renders `<Focus> · Open` title and `Centering · Practice · Reflection · ∞` subtitle | Device test |
| 12 | Sheet dismiss-by-swipe reverts pie selection without firing suggest | Device test |
| 13 | Same-focus re-tap opens sheet at last-picked value | Device test |
| 14 | Different-focus tap opens sheet at history-mode default | Device test |
| 15 | New user (no history) sees state default = `0_10`, body default = `30 min` | Device test with fresh account |
| 16 | `flutter analyze` clean (no new info-level hints over T4 baseline) | Build artifact |
| 17 | All HTTP through `ApiService` | Code review |
| 18 | Backend smoke for `available-durations` and `suggested-default` endpoints adds ≥40 passing assertions | Smoke run |
| 19 | Body focus slider has zero backend dependency for sheet open (sheet renders before suggested-default response) | Code review + network log |
| 20 | Picker pre-fetches `suggested-default` in parallel with sheet animation; if response arrives mid-animation, slider animates to new value smoothly | Device test |

---

## 12. Pre-flight (Claude Code)

Before writing code, verify:

1. **`getAvailableDurations` exported helper shape and behavior** (per §7.4).
2. **T3 `SuggestProvider.fetchSuggestion` signature** — confirm the existing optional params and how to extend without breaking T4's call site.
3. **`focus_areas` table schema** — confirm `focus_type` column name (T2 aliased to `type` in API; raw DB column is `focus_type`).
4. **`breathwork_sessions` table** — verify it has `focus_slug`, `duration_minutes`, `completed`, `created_at`, `user_id` columns. If `focus_slug` missing on this table, the mode-of-history query needs different shape.
5. **`sessions` table** — verify `focus_slug`, `duration_minutes`, `completed`, `date`, `user_id` columns.
6. **`StorageService` API** — confirm `getPreference`, `setPreference`, `removePreference` (latter added by T3).
7. **`HomeProvider._loadInitial` shape** — confirm where the `full_body` auto-suggest call lives so it can be cleanly removed without breaking other slice loads.
8. **`SuggestProvider` state machine** — confirm the `idle / loading / success / error` states exist; if not, reconcile with whatever names T3 used.
9. **`focus_areas.is_active` filter** — confirm T2's filter pattern carries over to the new endpoint.
10. **5-tab nav** — confirm T4's nav reconstruction; T5 doesn't change nav but mustn't break it.

If any check diverges from spec assumptions, halt and surface in chat. Pattern locked Project Instructions principle #14.

---

## 13. Smoke test additions

New block in `server/scripts/test-suggestion-engine-t2.js` using the `smoke-fixtures.mjs` helper from S13-T7.

### 13.1 `available-durations` endpoint

For each of the 5 state focuses × 3 user levels (15 cells):
- Insert sentinel user with the appropriate `user_pillar_levels` row.
- Issue `GET /api/focus-areas/:slug/available-durations`.
- Assert response 200, valid JSON shape, `ranges` filtered to `state === 'available'`, `suggested_default` is one of returned labels or `null`.
- Assert no locked/empty brackets leak.

Plus throws:
- 404 on `/unknown_focus`
- 400 on body-focus slug (`/biceps/available-durations`)
- 400 on user with no breathwork pillar level
- 401 without auth

### 13.2 `suggested-default` endpoint

For body and state focuses × 3 history-states (no history, single completed session, mixed history):
- Seed `sessions` / `breathwork_sessions` with sentinel rows.
- Issue `GET /api/focus-areas/:slug/suggested-default`.
- Assert correct mode-and-recency tie-break.
- Assert null when no history.
- Cleanup via sentinel.

Plus throws (same shape as 13.1).

### 13.3 Target

- Block name: `T5-PICKER-API`
- Estimated assertions: ~60 across both endpoints.
- Smoke target: existing 3262 + 60 = ~3322 pass / 0 fail.

---

## 14. Out of scope (FUTURE_SCOPE)

| Item | Reason |
|---|---|
| Yoga-tab `15-min` cross-pillar slider option | Home is cross-pillar with 30-min floor. Yoga-tab is a separate surface, separate ticket. |
| Locked-by-level "unlock at intermediate" hint in picker | Decision #10 hides locked brackets entirely. Progression-as-feature surface comes later. |
| "Coming soon" hint for empty brackets | Same as above — empty brackets hidden. |
| Custom slider widget (vs Material Slider) | If Material Slider polish proves limiting, custom replacement is its own ticket. T5 ships with Material as v1. |
| Strength-tab and breathwork-tab pickers | Out of scope — T5 is the home surface only. Those tabs already have their own session-config UIs from Sprints 8/9. |
| Multi-focus-per-day planning | Sprint 14+ weekly plan UI. T5 is single-focus-per-day. |
| Cross-pillar "save state-focus session" handling | S12-T7 Decision #2 rejected save-as-routine for state focus with stable error. T5 doesn't change that. |
| Persisting picker state across app launches beyond `lastPicked.<focus_slug>` | One-key-per-focus is enough for v1. Aggregate analytics (most-loved focus, etc.) is FS work. |

---

## 15. Drift log

(Populated as Claude Code or pre-flight surfaces drifts before/during build.)

| Date | Source | Drift | Resolution |
|------|--------|-------|------------|
| _(empty at draft)_ | | | |

---

## 16. Versioning notes

- This is **v1.0** of the T5 design doc.
- Subsequent versions follow `vN.M` pattern from T4 (`v1.0` → `v1.1` for in-doc corrections; `v2.0` if scope expands).
- Drift log entries are additive — never remove rows; add resolution notes.
- Amendment docs (`S13-T5-AMENDMENT-N-<topic>.md`) for mid-build pivots, per Project Instructions principle #16.

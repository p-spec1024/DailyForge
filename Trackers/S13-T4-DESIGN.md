# S13-T4 — Approach 5 Home Page Redesign — Design Doc

**Status:** LOCKED
**Locked:** May 2, 2026
**Author:** Claude.ai (Architect)
**Owner:** Prashob (CEO/PO)
**Supersedes:** Sprint 10 home page (3D body map + 3-pillar layout + "Full Session — Available in Sprint 11" placeholder)

---

## 1. Purpose

Sprint 12 shipped the suggestion engine + HTTP surface. The engine is reachable from the wire (`POST /api/sessions/suggest`, `GET /api/sessions/last`, `POST /api/sessions/save-as-routine`) but no screen consumes it.

T4 builds the home page that consumes the engine. This is the screen the user sees on every cold open of the app from now on.

The Sprint 10 home page is removed. The 3D body map is moved to a dedicated **Body** tab in the bottom nav.

---

## 2. Design philosophy (non-negotiable)

The home page is **the configurator for today's session**, not a menu. The user is operating the engine, not browsing content.

This commits to a specific aesthetic: **calm, configurator-style, low chrome**. References: Down Dog (configurator panel), Apple typography restraint, Linear (knob-style controls). Anti-references: Hevy (list-of-routines), Peloton (magazine feed), Nike Training Club (image-card library).

This is the only home-page direction this ticket builds. Alternatives were explored and rejected.

---

## 3. Locked decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Section order | App bar → Today's session card → **Circular orbit focus picker** (with center progress ring) → Strava-red flow chart (training load) → 2 stat tiles (Streak / This Week) → 4-week bar chart → Bottom nav | Locked from approved mockup. Hero-first, then engine controls, then progress glance. |
| 2 | Bottom nav | 2 tabs: **Home**, **Body** | Honest about current scope. Library + Profile slot in cleanly when Sprint 14/15 lands them. Greyed-out "coming soon" tabs read as unfinished. |
| 3 | Default focus for fresh user | `full_body` | Safest first session for someone who just onboarded. Engine handles `full_body` via compound-detection (S11-T3, S12 spec §6). |
| 4 | State-focus tap behavior | **Tap and swap** (same as body focus) | Consistency over a bracket-sheet detour. User can change time/intensity from session card if needed. T5 (bracket picker) handles the detailed picker UX separately when explicitly invoked. |
| 5 | Fresh user (no pillar levels) | Redirect to T1 onboarding flow | Engine cannot suggest without level data. T1 already shipped the onboarding stub for this. |
| 6 | "Different session?" affordance | **Dropped** | Orbit picker replaces it. Tapping any chip swaps the session. No separate link needed. |
| 7 | Recency warning placement | Quiet inline subtitle under "Biceps · 30 min" on the session card | Engine returns `recency_warning` field; render as small grey/amber text. No banner, no shouting. |
| 8 | Orbit chip text behavior | **Selected chip = text label.** Unselected chips = icon/emoji only. Tap any chip → it becomes selected → text appears on the new selection, old one shrinks back to icon. | Solves the small-chip-tiny-text readability problem. Pattern locked from chat session (May 2). |
| 9 | Sex-specific strength suggestions | **Out of scope** — stays in FUTURE_SCOPE #136 | Engine applies male thresholds to all users. Acceptable for current 3-user pre-launch. Resolves with `users.sex` column during full onboarding. |

---

## 4. Page anatomy (top to bottom)

### 4.1 Status / app bar
- Greeting line: `Today` (left) + streak chip (right, format `🔥 N`)
- No back button, no settings gear (settings move to Body tab or Profile in S14/15)

### 4.2 Today's session card (hero)
The engine's pick for the user. Bound to `POST /api/sessions/suggest` with the currently-selected focus.

**Visual structure:**
- Top row: small uppercase `TODAY` label (left) + focus-type pill `Body` or `State` (right, color-coded: body = purple `#3C3489` on `#EEEDFE`, state = green `#0F6E56` on `#E1F5EE`)
- Title: `<Focus name> · <minutes> min` (e.g. `Biceps · 30 min`)
- Subtitle: phase summary (e.g. `Yoga warm → Strength → Breath`) — single line, grey
- **Recency warning subtitle** (conditional): if engine returns `recency_warning`, render below subtitle as one line of small amber text. Format: e.g. `You trained back yesterday — biceps will pair well`
- Big primary `Start` button (full width, app green `#1D9E75`, white text)

**Tap behavior:**
- Tap `Start` → navigate to session player (T6 wires this — for T4, we set up the route call signature only, with a `// TODO: T6` placeholder if T6 hasn't merged)
- Tap card body (anywhere except button) → no-op for v1 (future: open a "session details" sheet)

### 4.3 Circular orbit focus picker
The headline piece of this redesign. Two concentric rings of focus chips with a progress ring in the dead center.

**Outer ring — body focuses (12 chips):**
Arranged at 30° intervals. Currently selected chip rendered larger (~20px radius) and filled with body-purple `#534AB7`, text in white. Unselected chips ~17px radius, white background, 0.5px `#D3D1C7` border, text `#5F5E5A`.

Per Decision #8: **selected chip shows the text label.** Unselected chips show an icon only — emoji is acceptable for v1 (locked icon set is FUTURE SCOPE; deferred). Recommended emoji map:

| Slug | Emoji |
|------|-------|
| biceps | 💪 |
| triceps | 💪 |
| chest | 🫁 |
| shoulders | 🤲 |
| back | ↩ |
| core | 🧱 |
| glutes | 🍑 |
| hamstrings | 🦵 |
| quads | 🦵 |
| calves | 🦶 |
| hips | ⚓ |
| mobility | 🫧 |

> **Note for Claude Code:** the same emoji on biceps/triceps and hamstrings/quads is intentional placeholder — the muscle-region overlap is real and a custom icon set lands in a future ticket. Do not "fix" by inventing emoji; ship as-listed.

**Inner ring — state focuses (5 chips):**
Arranged at 72° intervals at smaller radius (~55px from center vs ~92px for body). Same selected/unselected logic. Selected fill = state-green `#1D9E75`. Recommended emoji:

| Slug | Emoji |
|------|-------|
| energize | ⚡ |
| calm | 🌊 |
| focus | 🎯 |
| sleep | 🌙 |
| recover | 🍃 |

**Center progress ring:**
A circular progress ring showing **weekly sessions completed vs goal** (default goal: 5 sessions/week — pull from existing `user_settings` if present, fall back to constant 5). Renders inside a white inner disc (~28px radius). Format: `<percent>%` in the center, small `WEEKLY` label below in 6pt grey.

**Tap behavior:**
- Tap any chip → fire `POST /api/sessions/suggest` with the new focus → today's session card updates → tapped chip becomes selected, previous selection shrinks back to icon.
- The ring itself is not draggable in v1. (Drag-to-rotate is FUTURE_SCOPE — see §10.)
- Center progress ring is read-only for v1. Tap = no-op.

### 4.4 Strava-red flow chart (training load)
A flowing area chart showing **training load over the past 30 days**. Filled gradient red (`#FC4C02` at 0.18 opacity → 0 at bottom), 2px solid red line on top, highlight dot at the trailing edge.

**Header:**
- Left: small `TRAINING LOAD` label, big number (e.g. `+18%`), small subtitle `↗ vs last 14 days`
- Right: small grey label `Last 30 days`

**Data source:**
For v1, "training load" = sum of session durations bucketed by day, smoothed (3-day moving average). Pull from `sessions` table. The `+18%` delta = (last 14 days avg) vs (prior 14 days avg).

**Note:** if session-load data is sparse (new user, < 7 days history), show a placeholder state: same chart frame, low-opacity flat line at zero, no big delta number, label reads `Build your first 7 days to see trends`.

### 4.5 Stat tiles (2 across)
Two equal-width white cards in a grid:
- **Streak** — `<N> days`
- **This week** — `<N> sessions`

Same data sources as Sprint 10 home page.

### 4.6 4-week bar chart
A simple 14-bar vertical bar chart showing daily session count for the last 14 days (despite the section label "Last 4 weeks" — this matches the approved mockup; if the chart eventually needs to truly be 28 days, expand later. For v1: 14 daily bars).

Bars green `#1D9E75`, rounded corners, no axes, no gridlines.

### 4.7 Bottom nav
Two tabs:
- **Home** (current screen, active)
- **Body** (routes to existing 3D body map at `/body-map` — no redesign in this ticket, just relocation)

---

## 5. Engine integration contract

The home page calls these existing endpoints:

| Endpoint | When | Payload |
|----------|------|---------|
| `POST /api/sessions/suggest` | On mount + on focus chip tap | `{ focus_slug, time_budget?, intensity? }` — for v1, time_budget and intensity are unset (engine defaults apply) |
| `GET /api/users/me/pillar-levels` | On mount, to detect fresh user | If 0 rows returned → redirect to onboarding |
| `GET /api/focus-areas` | On mount, to populate the orbit chip metadata | Already shipped in S13-T2 |

T4 does NOT consume these (out of scope, T6 territory):
- `POST /api/exercises/:id/exclude`
- `POST /api/exercises/:id/keep-suggesting`
- `GET /api/sessions/last`
- `POST /api/sessions/save-as-routine`

For training load chart and stats: read from existing `sessions` aggregation endpoints. If a needed aggregation endpoint doesn't exist yet, surface this in pre-flight — Claude Code should NOT invent a new endpoint without flagging.

---

## 6. State management

New provider: `HomePageProvider extends ChangeNotifier`

State:
- `selectedFocus: FocusArea?`
- `currentSuggestion: SessionSuggestion?` (response from `POST /api/sessions/suggest`)
- `isSuggestionLoading: bool`
- `suggestionError: String?`
- `pillarLevels: List<PillarLevel>` (used only to detect fresh-user redirect)
- `weeklyProgressPercent: int` (for center ring)
- `trainingLoadDelta: double?` (for flow chart header)
- `barChartData: List<DailyCount>` (for bottom bar chart)

Methods:
- `Future<void> initialize()` — called once on mount
- `Future<void> selectFocus(FocusArea focus)` — called on chip tap; updates selectedFocus, fires suggest, updates currentSuggestion

Provider follows existing pattern: extends `ChangeNotifier`, uses `notifyListeners()`, persists nothing (re-fetched on each mount). All HTTP through `ApiService`.

---

## 7. Routing

`go_router` config:
- `/` → `HomePage` (this ticket)
- `/body` → existing 3D body map page (relocated from `/`)
- `/onboarding` → existing T1 onboarding stub

The bottom nav uses `StatefulShellRoute.indexedStack` so tab switches preserve scroll position. (If the existing nav implementation differs, Claude Code matches whatever pattern is already in use — pre-flight to confirm.)

---

## 8. Visual specifications (for the build)

### Colors (use existing app theme tokens where present)
- Background: `#FAF8F2` (page), `#FFFFFF` (cards)
- Borders: `#D3D1C7` (visible borders), `#E6E4DC` (subtle dividers)
- Text: `#2C2C2A` (primary), `#5F5E5A` (secondary), `#888780` (tertiary), `#B4B2A9` (muted)
- Body focus accent: `#534AB7` (selected fill), `#EEEDFE` (chip background), `#3C3489` (chip text)
- State focus accent: `#1D9E75` (selected fill), `#E1F5EE` (chip background), `#0F6E56` (chip text)
- Streak chip: `#FAEEDA` (bg) / `#854F0B` (text)
- Recency warning text: `#854F0B` (amber)
- Strava chart: `#FC4C02` (line/fill)
- Bar chart: `#1D9E75` (bars)

### Typography
Use existing app fonts. The mockup used a serif accent for the greeting; if the app already has a serif in its theme, use it. Otherwise use the existing display sans. Do not import a new font for this ticket.

### Card radii
- Outer phone shape: `32px`
- Card cells: `14px`
- Chips/pills: `999px`
- Buttons: `8px` (rectangular) or `999px` (pill)

### Spacing
- Page padding: `12px` horizontal, `14px` top
- Card-to-card vertical gap: `8–10px`
- Within-card padding: `14px` (sometimes `12px` for compact cards)

---

## 9. Acceptance criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Home page renders with engine-suggested session for default focus (`full_body`) on first visit | Device test |
| 2 | Tapping any orbit chip swaps the session card via `/api/sessions/suggest` | Device test |
| 3 | Selected chip shows text label; unselected chips show emoji/icon only | Visual review |
| 4 | Recency warning renders as inline amber text under session subtitle when engine returns one | Smoke test with seeded recency overlap |
| 5 | Fresh user (no `user_pillar_levels` rows) is redirected to `/onboarding` on home open | Manual test with dev-fresh user |
| 6 | Streak, this-week count, training-load delta, and 4-week bar chart all render with real data | Device test |
| 7 | Tapping "Body" in bottom nav navigates to existing 3D body map page | Device test |
| 8 | Tapping "Start" on session card navigates toward session player (or shows TODO if T6 not merged) | Device test |
| 9 | `flutter analyze` clean | Build artifact |
| 10 | All HTTP calls go through `ApiService` (auth + timeout + 401-logout inherited) | Code review |
| 11 | Provider extends `ChangeNotifier` and uses `notifyListeners()` | Code review |

---

## 10. Out of scope (FUTURE_SCOPE)

| Item | Reason |
|------|--------|
| Custom icon set for orbit chips (replacing emoji) | Design pass deserves its own ticket; emoji is acceptable v1 |
| Drag-to-rotate orbit | Tap is sufficient for v1; rotation interaction needs gesture-handling pass |
| Sex-specific strength suggestions | FUTURE_SCOPE #136 (resolves with `users.sex` onboarding) |
| Session details sheet on card body tap | v1 ships with tap-Start-only |
| Center progress ring tap interaction | Read-only for v1 |
| 28-day true bar chart (vs current 14) | Will revisit if the label "Last 4 weeks" becomes confusing |
| Time/intensity controls on home page | Generator-panel knobs explored and shelved in favor of orbit; revisit if engine variety becomes a complaint |
| Library + Profile bottom nav tabs | Sprint 14/15 |

---

## 11. Pre-flight (for Claude Code)

Before writing UI code, Claude Code must verify:

1. **Engine response shape:** call `POST /api/sessions/suggest` with `{ focus_slug: 'full_body' }` against running dev server, capture and document response shape. The home page DTO must match what the engine actually returns (per Principle #14 — pre-flight verification before client modeling).
2. **`/api/focus-areas` response shape:** confirm the endpoint shape from S13-T2; orbit chip data model derives from this.
3. **`/api/users/me/pillar-levels` response shape:** confirm from S13-T1.
4. **Existing aggregation endpoints for training load / streak / weekly count / bar chart:** scan `server/src/routes/` for existing endpoints. If gap exists (e.g. no training-load endpoint), STOP and flag — do not invent a new server endpoint in this ticket.
5. **Existing nav implementation:** confirm whether `go_router` is already wired for `/body`, and whether bottom-nav state-preservation is in use.
6. **Existing theme tokens:** confirm whether colors above already exist in the app theme; reuse if so.
7. **Existing Sprint 10 home page file:** locate it in `app/lib/`. T4 replaces this file (or adds new + redirects route). Confirm the file path so the deletion is honest.
8. **`ApiService` and `StorageService` shape:** confirm the request/response signature so new HTTP calls match existing seams (per Principle #19).

Halt on any disagreement between this design doc and live data/code shape. Surface mismatch as a question rather than auto-fixing.

---

## 12. References

- Approved home-page mockup: chat session with Prashob, May 2, 2026 (circular orbit + Strava-red chart + center progress ring)
- Sprint 12 spec: `Trackers/S12-suggestion-engine-spec.md`
- Approach 5 product strategy: `Trackers/PRE_SPRINT_11_PLANNING.md`
- Engine HTTP surface: `Trackers/S12-T7-http-surface-spec.md`
- T1 (onboarding stub) and T2 (focus-areas API) shipped commits: see `Trackers/SPRINT_TRACKER.md`

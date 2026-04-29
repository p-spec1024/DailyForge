# S12-T7 — HTTP Surface Spec (suggest / last / save-as-routine)

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 30, 2026
**Version:** v1
**Status:** DRAFT pending Prashob review of Decisions 1, 4, 6, 9, and the open questions in §Open questions. Locks on greenlight.
**Depends on:** S12-T1 through S12-T6 (entire Sprint 12 engine + state machine + write side) — all shipped.
**Branch:** `s12-t7` off `s12-t6`
**Blocks:** Sprint 13 (home page UI consumes `POST /api/sessions/suggest`; "Repeat Last" affordance consumes `GET /api/sessions/last`; "Save Session" consumes the save-as-routine endpoint).
**Sprint-close ticket:** T7 is the last Sprint 12 ticket. Once it ships and passes /review, the chained branch `s12-t7` is the merge candidate for `sprint-12-close` tag.

---

## Why this ticket exists

T2 through T6 built the engine and its write-side state machine — but every test ran service-layer-direct (`generateSession()` called from a node script). No HTTP client can use any of it yet. T7 puts an HTTP face on the engine: three endpoints, validated request shape, JSON response, JWT-authenticated. Flutter's Sprint 13 home page is gated on this surface existing.

The work is mechanical Express routing + request validation + response shaping over an engine that already returns the right structure. The interesting decisions are:

1. **Decision 14 from the parent spec said "save = save as routine."** The parent spec was written before T2's engine output crystallized. T2 ships sessions as cross-pillar (strength + yoga + breathwork phases). `user_routines` is **strength-only** (the FK is `exercises.id`). So "save the suggested session as a routine" can only save the *strength portion* of a cross-pillar session — the yoga and breathwork phases are silently dropped. That's a substantive shape question, not a wiring question. Decision 1 below addresses it.

2. **Decision 14's "Repeat Last" `GET /api/sessions/last?focus=<slug>` returns "the most recent completed session matching the focus, formatted as a session structure the player can replay."** Cross-pillar sessions are not stored as a single completed entity — they're stored as separate strength + yoga + breathwork rows. There's no "completed cross-pillar session" entity in the DB. So either (a) we return the most recent *strength-only* completion for the focus (definitionally narrower than "last suggested session"), (b) we synthesize a cross-pillar reconstruction from the most recent session per phase, or (c) we add a `suggested_sessions` cache table to record what the engine returned. Decision 4 picks one.

3. **Bracket vs time_budget routing.** T3.5 added the `bracket` parameter for state focuses; `time_budget_min` is for body focuses. The HTTP layer needs to validate whichever is required for the resolved focus type. The engine already throws on missing/invalid; T7 turns those throws into proper HTTP 400 responses with explanatory error codes.

4. **What does the `POST /api/sessions/suggest` request shape look like?** The engine's input (post-T3.5) is `{user_id, focus_slug, entry_point, time_budget_min?, bracket?}`. `user_id` comes from JWT middleware; the rest are body params. Decision 6 below locks the validation contract so Flutter doesn't have to guess.

The pre-flight scope follows the T6 pattern (principle #14 expanded): verify (a) any hand-derived data, (b) live table/column shape that the spec assumes, (c) the actual file/symbol shape of the engine's exports + the existing `user_routines` route handlers that we're reusing.

---

## What's in scope

| Surface | T7 work |
|---------|---------|
| `POST /api/sessions/suggest` | New endpoint. JWT auth required. Validates body, calls `generateSession`, returns engine output verbatim plus error mapping. |
| `GET /api/sessions/last?focus=<slug>` | New endpoint. JWT auth required. Returns the most recent completed session matching the focus, in the engine's response shape (so the same player UI consumes both endpoints). |
| `POST /api/sessions/save-as-routine` | New endpoint OR thin wrapper around existing `POST /api/routines`. Decision 1 below picks one. Validates that the session payload contains a strength phase; 400s if it does not. |
| Existing `server/src/routes/routines.js` | Untouched if Decision 1 picks the wrapper-endpoint path. Lightly extended if Decision 1 picks "extend the existing endpoint to accept engine-shaped payload." |
| Smoke harness (`scripts/test-suggestion-engine-t2.js`) | Extended with T7 HTTP-LAYER block — supertest-style or `fetch`-against-localhost calls, validation matrix, last-session retrieval, save-as-routine round-trip. |
| Live HTTP round-trip (`scripts/t7-curl-roundtrip.mjs`) | New, mirroring `t6-curl-roundtrip.mjs`. End-to-end exercise against a running server: register → login → suggest body focus → suggest state focus → save → fetch last → repeat. |
| Pre-flight (`scripts/preflight-s12-t7-shape.mjs`) | New. Verifies (b) and (c) per principle #14: engine exports, `sessions.focus_slug` column, `user_routines` and `user_routine_exercises` tables, route mount points in `server/src/index.js`, JWT middleware availability. |

## What's out of scope

| Item | Why out, where it goes |
|------|------------------------|
| Flutter wiring of any of the three endpoints | Sprint 13 home page work. T7 ships the HTTP surface; Flutter consumes it next sprint. Manual curl/Postman acceptance covers T7. |
| Saving non-strength portions of a cross-pillar session as anything | `user_routines` is strength-only by FK design. Cross-pillar "save" would need a new `saved_sessions` table per Decision 1's path B. We pick path A (strength-only save with explicit warning) as v1. Any cross-pillar save story is FUTURE_SCOPE post-Sprint-12. |
| Personalized `alternative_focus_slug` when last-session retrieval finds no matches | Out-of-scope per FUTURE_SCOPE #161 (still pending Sprint 14+ personalization work). T7 returns 404 when no last session is found, with a clear error code. UI handles the empty state. |
| Caching the engine output | The engine recomputes per call. Cost of one `generateSession` is modest (a handful of indexed queries). Caching the response is FUTURE_SCOPE #143-class work — not v1. |
| Rate limiting on `/api/sessions/suggest` | Same scope discipline as T6's exclude/keep-suggesting endpoints. Already captured in FUTURE_SCOPE #163 cluster. T7 is on the same to-do list, NOT a separate ticket. |
| Pagination on `/api/sessions/last` | The endpoint returns at most one session — the most recent. No pagination. |
| Versioning the API surface (`/v1/`) | Sprint 12 didn't introduce versioning; T7 keeps the existing flat `/api/...` path convention. If versioning lands, it lands as a separate uniform refactor. |
| Telemetry / logging on engine calls | Beyond standard request logging that already exists. Engine-output telemetry is Sprint 14+ analytics work. |

---

## Decisions to lock (Apr 30 review)

| # | Decision | Recommendation | Rationale |
|---|----------|----------------|-----------|
| 1 | **Save-as-routine — endpoint shape and what gets saved.** Engine output is cross-pillar; `user_routines` is strength-only. | **Path A: New endpoint `POST /api/sessions/save-as-routine`. Extracts the strength phase from the engine payload, calls the existing routine-create logic with `name` from request body. Returns 400 if no strength phase exists. Returns 200 with `{routine_id, saved_phase: 'strength', dropped_phases: ['warmup_yoga', 'cooldown_yoga', 'bookend_breathwork']}` so Flutter knows what was preserved.** | Honesty over silence. The user pressing "Save" on a cross-pillar session deserves to know that only the strength sequence is being saved. The dropped_phases array gives Flutter the data to surface a tooltip ("yoga and breathwork phases will regenerate next time you start this routine") without re-spec. **Alternatives considered:** Path B — new `saved_sessions` table preserving the full cross-pillar shape (rejected: that's Sprint 14+ scope, doubles the storage model right before launch). Path C — silently drop non-strength phases, hide it from the UI (rejected: contradicts "honesty" principle from T3.5 — promise what you can deliver). |
| 2 | **Save-as-routine — what about state-focus sessions?** State-focus sessions have NO strength phase by construction. | **Reject the save with a 400 and `{error: 'state_focus_not_saveable_v1'}`.** | The right v1 answer for state focuses is "use Repeat Last" (Decision 14 from parent spec) — that already gives them the consistency they want. Saving a state-focus session as a routine doesn't fit `user_routines` at all. Better to fail loudly than to silently save an empty routine. **Alternative:** save `centering` and `practice` techniques into a future `saved_breathwork_sessions` table — same Sprint 14+ scope rejection as Decision 1. |
| 3 | **Save-as-routine — pillar_pure yoga and breathwork sessions from yoga_tab/breathwork_tab.** | **Same as Decision 2: reject with 400, `{error: 'pillar_pure_<yoga|breathwork>_not_saveable_v1'}`.** | Yoga sessions go through the existing yoga session player which already has its own session-config persistence. Breathwork singletons are cheap to repick by name. Both have "Repeat Last" coverage. Saving them as `user_routines` doesn't fit the table. Same v1 rejection as state-focus. |
| 4 | **`GET /api/sessions/last` — what counts as "the last session"?** Cross-pillar sessions don't exist as single completed entities. | **Path A: Return the most recent row from `sessions` (table) where `focus_slug = $1` AND `completed = true` AND `user_id = $2`, formatted as a session structure.** This row is whichever phase the user *finished* most recently for that focus — for a cross-pillar session that means the strength phase (T5 set `focus_slug` on `sessions.session_id` for the strength row of a 5-phase). The endpoint returns the strength portion only, in the engine's `session_shape: 'pillar_pure'` format. **Path A2 (variant):** also check `breathwork_sessions` for `focus_slug = $1 AND completed = true`; if its `created_at` is more recent than the `sessions` match, return the breathwork session instead. Decision: **Path A (strength + yoga via `sessions`; breathwork via `breathwork_sessions` UNION'd by `created_at`).** | The `sessions` table holds strength + yoga + 5-phase rows (per T5's recency-window analysis); `breathwork_sessions` holds breathwork singletons. UNION'ing is cheap and matches user intent: "what did I do for this focus most recently?" — answered honestly. **Path B (synthesize cross-pillar from per-phase last-rows) was considered and rejected** as too fictional: it would compose a session the user never actually executed. Repeat Last must be honest about replay. **Path C (cache engine output in a new `suggested_sessions` table) was considered and rejected** because it doubles writes and the v1 use case is "what did I actually do?" not "what did the engine last show me?" |
| 5 | **`/api/sessions/last` — what's the response shape?** | **Match the engine's response shape (`session_shape`, `phases`, `warnings: []`, `metadata`) so a single Flutter player consumes both endpoints uniformly. `metadata.source = 'last_completed'` (vs. engine's default `metadata.source = 'engine_v1'` — see Decision 8) so Flutter can distinguish.** | One player UI, two paths to it. Otherwise Flutter has to maintain a second renderer for the "last completed" path. Source field lets the UI optionally distinguish ("Repeat your last") without forking the data model. |
| 6 | **`POST /api/sessions/suggest` — request body and validation.** | **Body shape: `{focus_slug: string, entry_point: enum, time_budget_min?: int, bracket?: enum}`. `user_id` from JWT. Validation order: (1) auth → 401 if missing; (2) `focus_slug` present + valid format → 400 `{error: 'invalid_focus_slug'}` if not; (3) `entry_point` in enum → 400; (4) resolve `focus.type`; (5) if `body` focus → require `time_budget_min` and reject `bracket` (silently allow if passed but ignore — symmetric with engine behavior); (6) if `state` focus → require `bracket` and reject `time_budget_min` (silently ignore); (7) call engine; (8) catch `RangeError` → 400 with the error message; (9) catch other errors → 500.** | The engine already throws on contract violations. T7's job is to turn engine throws into HTTP 400s with stable error codes the Flutter UI can render. The validation order matches the engine's internal order so error messages align. |
| 7 | **Error code stability.** Flutter consumes these endpoints; error strings need to be code-readable, not human-readable. | **Use stable snake_case codes in `{error: 'code_string'}`. Codes (locked):** `invalid_focus_slug`, `unknown_focus_slug` (focus_areas lookup miss), `invalid_entry_point`, `body_focus_requires_time_budget`, `state_focus_requires_bracket`, `invalid_time_budget` (non-int or out-of-range), `invalid_bracket`, `invalid_focus_entry_combo` (e.g. body focus from breathwork_tab), `engine_error` (catch-all 500 — should never happen but lock the shape), `last_session_not_found` (404), `state_focus_not_saveable_v1`, `pillar_pure_yoga_not_saveable_v1`, `pillar_pure_breathwork_not_saveable_v1`, `routine_name_required`, `routine_name_too_long` (>100 char per `user_routines.name` schema). | Stable identifiers > drift-prone strings. Flutter switch-cases on these. Human-readable text comes from a Flutter-side dictionary keyed on these codes. |
| 8 | **Engine response — does T7 add anything to the engine's output?** | **Add `metadata.source = 'engine_v1'` to the engine response on the way out (T7 wraps it; engine doesn't need to know).** Otherwise pass through verbatim. | Lets the player UI tell engine output apart from "last completed" replay. Single field, zero engine changes. |
| 9 | **Save-as-routine name handling.** | **Required body field `name: string` (1-100 chars). 400 if missing or too long. No name auto-generation in v1.** Flutter UI prompts the user (matching the existing Sprint 8 SaveRoutineSheet pattern). | The existing routines API requires `name`; staying consistent. Auto-generating "Biceps Routine - Apr 30" is a UX call that belongs to Flutter, not the server. |
| 10 | **Save-as-routine `description` field — populate it?** | **Optional. If absent, default to `'Saved from suggested session — focus: <focus_slug>'`. If passed, use as-is (1-500 char, 400 if too long).** | Searchability + provenance. The default reads cleanly in the routines list. |
| 11 | **`/api/sessions/last` query param validation.** | **`focus` query param required. 400 with `routine_name_required`-style code (`focus_param_required`) if absent. Validate against `focus_areas.slug` — 400 `unknown_focus_slug` if not in the table.** | Symmetric with `/suggest` validation. |
| 12 | **JWT middleware.** | **Use existing `requireAuth` middleware. Inject `req.userId`. No new middleware.** | Same as T6. Routine. |
| 13 | **Routes-layout — where does the file live?** | **`server/src/routes/sessions.js` (NEW file).** Mount at `/api/sessions/*` in `index.js`. The save-as-routine endpoint also lives here (despite its semantic affinity with routines) because it's a session-flow endpoint, not a routine-CRUD endpoint. | Sessions get their own house. Mirrors T6's "exercises.js gets the exercise-state endpoints" pattern. |
| 14 | **Save-as-routine endpoint path.** Two options under Decision 13's `sessions.js`. | **`POST /api/sessions/save-as-routine`** (verb-y but semantically clear) **vs `POST /api/sessions/routines`** (RESTier but less obvious). **Pick: `POST /api/sessions/save-as-routine`.** | The save action is not a CRUD-on-sessions operation — it's an action that emits a routine. The verb-y path makes the cross-table effect explicit. Same reasoning as Stripe's `POST /charges/:id/refund` over `POST /charges/:id/refunds`. |
| 15 | **HTTP status code conventions.** | **200 OK on successful suggest/last/save (no 201 even on routine-create — the response is conceptually about the saved-session result, not a "created routine resource"). 400 for client validation. 401 for missing auth. 404 for last-session-not-found and unknown ids. 500 for engine internals.** | Consistent with the rest of the DailyForge API. Sprint 8 used 200 on routine-create per `APP_AUDIT.md` line 1584 (`Created (201)` is documented but reality matches 200). T7 holds the existing pattern. **Open question 1 below asks Prashob to confirm 201 vs 200 on save-as-routine.** |

---

## Implementation contract

### File layout

```
server/src/routes/sessions.js                        ← NEW (this ticket)
server/src/index.js                                  ← extend: mount /api/sessions/*
server/src/services/suggestionEngine.js              ← exists; T7 imports generateSession
server/src/services/sessionFormatter.js              ← NEW: formats sessions/breathwork_sessions rows into engine response shape (used by /last)
server/scripts/preflight-s12-t7-shape.mjs            ← NEW: see §Pre-flight diagnostic
server/scripts/test-suggestion-engine-t2.js          ← exists; extend with T7 HTTP-LAYER block
server/scripts/t7-curl-roundtrip.mjs                 ← NEW: live HTTP round-trip
```

> Claude Code: confirm `requireAuth` middleware filename and import path during build. Pre-flight grep verifies the symbol exists before T7 imports.

### Endpoint 1 — `POST /api/sessions/suggest`

```
Request:
  POST /api/sessions/suggest
  Authorization: Bearer <jwt>
  Content-Type: application/json
  Body:
    {
      "focus_slug":      "biceps",
      "entry_point":     "home",
      "time_budget_min": 30           // body focus (omit for state)
    }
  -- OR --
    {
      "focus_slug":      "calm",
      "entry_point":     "breathwork_tab",
      "bracket":         "10-20"      // state focus (omit for body)
    }

Response 200 (engine output verbatim + metadata.source):
  {
    "session_shape": "cross_pillar" | "pillar_pure" | "state_focus",
    "phases":   [ ... engine output ... ],
    "warnings": [ ... engine output ... ],
    "metadata": {
      "estimated_total_min": 28,
      "user_levels": { "strength": "beginner", "yoga": "beginner", "breathwork": "beginner" },
      "source": "engine_v1"   // T7 adds this
    }
  }

Response 400 (validation failure — see §Error codes for stable codes):
  { "error": "invalid_focus_slug" }
  { "error": "unknown_focus_slug" }
  { "error": "invalid_entry_point" }
  { "error": "body_focus_requires_time_budget" }
  { "error": "state_focus_requires_bracket" }
  { "error": "invalid_time_budget" }
  { "error": "invalid_bracket" }
  { "error": "invalid_focus_entry_combo" }

Response 401 (no/invalid JWT): { "error": "unauthorized" }
Response 500 (engine internal): { "error": "engine_error" }
```

**Implementation sketch:**

```js
router.post('/suggest', requireAuth, async (req, res) => {
  const { focus_slug, entry_point, time_budget_min, bracket } = req.body || {};

  // 1. Shape validation (cheap, do first)
  if (typeof focus_slug !== 'string' || !/^[a-z_]{1,40}$/.test(focus_slug)) {
    return res.status(400).json({ error: 'invalid_focus_slug' });
  }
  if (!['home', 'strength_tab', 'yoga_tab', 'breathwork_tab'].includes(entry_point)) {
    return res.status(400).json({ error: 'invalid_entry_point' });
  }
  if (time_budget_min !== undefined && time_budget_min !== null) {
    if (!Number.isInteger(time_budget_min) || time_budget_min < 5 || time_budget_min > 240) {
      return res.status(400).json({ error: 'invalid_time_budget' });
    }
  }
  if (bracket !== undefined && bracket !== null) {
    if (!['0-10', '10-20', '21-30', '30-45', 'endless'].includes(bracket)) {
      return res.status(400).json({ error: 'invalid_bracket' });
    }
  }

  // 2. Resolve focus.type to enforce body/state contract
  const focusRow = await getFocusBySlug(focus_slug);     // helper — see Decision 11
  if (!focusRow) return res.status(400).json({ error: 'unknown_focus_slug' });

  if (focusRow.type === 'body' && (time_budget_min == null)) {
    return res.status(400).json({ error: 'body_focus_requires_time_budget' });
  }
  if (focusRow.type === 'state' && (bracket == null)) {
    return res.status(400).json({ error: 'state_focus_requires_bracket' });
  }

  // 3. Call engine — engine throws RangeError on remaining contract violations
  try {
    const result = await generateSession({
      user_id: req.userId,
      focus_slug,
      entry_point,
      time_budget_min: time_budget_min ?? null,
      bracket: bracket ?? null,
    });
    result.metadata = { ...(result.metadata || {}), source: 'engine_v1' };
    return res.json(result);
  } catch (err) {
    if (err instanceof RangeError) {
      // Map known engine throws to stable codes:
      const code = mapRangeErrorToCode(err.message);   // helper — see §Error mapping
      return res.status(400).json({ error: code });
    }
    console.error('[T7] /suggest engine error:', err);
    return res.status(500).json({ error: 'engine_error' });
  }
});
```

**Error mapping helper:**

```js
// server/src/routes/sessions.js
function mapRangeErrorToCode(message) {
  // Engine throw messages are stable enough — cover the known surface.
  if (message.includes('body focus requires time_budget_min')) return 'body_focus_requires_time_budget';
  if (message.includes('state focus requires bracket'))        return 'state_focus_requires_bracket';
  if (message.includes('invalid bracket value'))               return 'invalid_bracket';
  if (message.includes('state focus from'))                    return 'invalid_focus_entry_combo';
  if (message.includes('body focus from breathwork_tab'))      return 'invalid_focus_entry_combo';
  if (message.includes('mobility from strength_tab'))          return 'invalid_focus_entry_combo';
  return 'engine_error';   // unknown — bubble up so /review catches the gap
}
```

> The mapper is intentionally string-matching. Engine throw messages are part of the contract pre-flight verifies. If a future engine refactor changes the message text, pre-flight catches the drift before this mapper goes stale.

---

### Endpoint 2 — `GET /api/sessions/last?focus=<slug>`

```
Request:
  GET /api/sessions/last?focus=biceps
  Authorization: Bearer <jwt>

Response 200 (in engine response shape; metadata.source='last_completed'):
  {
    "session_shape": "pillar_pure",         // see §"last" reconstruction below
    "phases":   [ ... reconstructed from DB row ... ],
    "warnings": [],                         // never emitted on /last
    "metadata": {
      "estimated_total_min": 28,
      "user_levels": { ... },
      "source": "last_completed",
      "completed_at": "2026-04-29T18:42:11Z"  // T7-only field
    }
  }

Response 400: { "error": "focus_param_required" } | { "error": "unknown_focus_slug" }
Response 401: { "error": "unauthorized" }
Response 404: { "error": "last_session_not_found" }
```

**Reconstruction logic (Decision 4, Path A):**

```sql
-- Pseudocode — final query owned by Claude Code, may differ in trivia.
-- Returns AT MOST one row.

WITH strength_or_yoga AS (
  SELECT
    'strength_or_yoga'::text     AS source_table,
    s.id                         AS session_id,
    s.created_at                 AS completed_at,
    s.type                       AS pillar_type,    -- 'strength' | 'yoga' | '5_phase'
    s.focus_slug
  FROM sessions s
  WHERE s.user_id    = $1
    AND s.focus_slug = $2
    AND s.completed  = true
  ORDER BY s.created_at DESC
  LIMIT 1
),
breathwork AS (
  SELECT
    'breathwork'::text           AS source_table,
    bs.id                        AS session_id,
    bs.created_at                AS completed_at,
    'breathwork'::text           AS pillar_type,
    bs.focus_slug
  FROM breathwork_sessions bs
  WHERE bs.user_id    = $1
    AND bs.focus_slug = $2
    AND bs.completed  = true
  ORDER BY bs.created_at DESC
  LIMIT 1
)
SELECT *
FROM (
  SELECT * FROM strength_or_yoga
  UNION ALL
  SELECT * FROM breathwork
) merged
ORDER BY completed_at DESC
LIMIT 1;
```

The result row tells the formatter which phase-level table to query for the `phases` reconstruction. The formatter (`sessionFormatter.js`) maps:

- `pillar_type='strength'` → query `session_exercises` for the strength phase, `session_shape='pillar_pure'`, single `phase: 'main'`.
- `pillar_type='yoga'` → query `session_yoga_poses` (or wherever yoga session items land — pre-flight verifies the table name), `session_shape='pillar_pure'`, single `phase: 'main'`.
- `pillar_type='breathwork'` → query the breathwork-session joining row(s); `session_shape='state_focus'`, three phases (`centering`, `practice`, `reflection`).
- `pillar_type='5_phase'` → query `session_exercises` for the strength portion, plus the 5-phase joining tables for the yoga warmup/cooldown and breathwork bookends; `session_shape='cross_pillar'`, full 5-phase output.

**Important:** the 5-phase reconstruction is the trickiest case because it spans `sessions` + per-phase joining tables. Pre-flight verifies the joining-table names exist. If they don't (Sprint 9 might have stored 5-phase phases differently than the v1 spec assumed), the spec adjusts to "5-phase last-session reconstructs to strength-only with `metadata.partial_reconstruction=true`," and the gap is logged as FUTURE_SCOPE.

**No reconstructed row → 404.** No silent empty-state. The Flutter UI handles 404 with an empty-state illustration ("No previous session for this focus yet").

---

### Endpoint 3 — `POST /api/sessions/save-as-routine`

```
Request:
  POST /api/sessions/save-as-routine
  Authorization: Bearer <jwt>
  Content-Type: application/json
  Body:
    {
      "name":         "Biceps blast",
      "description":  "Optional, max 500 chars",     // optional
      "session": {                                    // engine output payload — passed back as-is
        "session_shape": "cross_pillar",
        "phases": [ ... ],
        "warnings": [],
        "metadata": { ... }
      }
    }

Response 200 (success):
  {
    "routine_id":      127,
    "saved_phase":     "strength",
    "dropped_phases":  ["bookend_open", "warmup", "cooldown", "bookend_close"],
    "exercise_count":  6
  }

Response 400 (validation):
  { "error": "routine_name_required" }
  { "error": "routine_name_too_long" }
  { "error": "routine_description_too_long" }
  { "error": "session_payload_required" }
  { "error": "state_focus_not_saveable_v1" }
  { "error": "pillar_pure_yoga_not_saveable_v1" }
  { "error": "pillar_pure_breathwork_not_saveable_v1" }
  { "error": "no_strength_phase_in_session" }       // cross_pillar with empty main phase

Response 401: { "error": "unauthorized" }
```

**Implementation sketch:**

```js
router.post('/save-as-routine', requireAuth, async (req, res) => {
  const { name, description, session } = req.body || {};

  // 1. Name validation
  if (typeof name !== 'string' || name.length === 0) {
    return res.status(400).json({ error: 'routine_name_required' });
  }
  if (name.length > 100) return res.status(400).json({ error: 'routine_name_too_long' });
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') return res.status(400).json({ error: 'routine_description_too_long' });
    if (description.length > 500) return res.status(400).json({ error: 'routine_description_too_long' });
  }

  // 2. Session payload validation
  if (!session || typeof session !== 'object' || !Array.isArray(session.phases)) {
    return res.status(400).json({ error: 'session_payload_required' });
  }

  // 3. Saveability gate by session_shape
  switch (session.session_shape) {
    case 'state_focus':
      return res.status(400).json({ error: 'state_focus_not_saveable_v1' });
    case 'pillar_pure': {
      // Reject if it's pure yoga or pure breathwork. Identify by phase content.
      const sample = session.phases[0]?.items?.[0]?.content_type;
      if (sample === 'yoga')       return res.status(400).json({ error: 'pillar_pure_yoga_not_saveable_v1' });
      if (sample === 'breathwork') return res.status(400).json({ error: 'pillar_pure_breathwork_not_saveable_v1' });
      // Falls through to strength — saveable.
      break;
    }
    case 'cross_pillar':
      // Saveable but only the strength portion. Validation happens in step 4.
      break;
    default:
      return res.status(400).json({ error: 'session_payload_required' });
  }

  // 4. Extract strength items
  const strengthItems = session.phases
    .flatMap(p => (p.items || []).filter(it => it.content_type === 'strength'));
  if (strengthItems.length === 0) {
    return res.status(400).json({ error: 'no_strength_phase_in_session' });
  }

  // 5. Persist (single transaction)
  const tx = await db.connect();
  try {
    await tx.query('BEGIN');
    const routineRow = await tx.query(
      `INSERT INTO user_routines (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
      [req.userId, name, description ?? `Saved from suggested session — focus: ${session.metadata?.focus_slug ?? 'unknown'}`]
    );
    const routineId = routineRow.rows[0].id;

    // Insert routine_exercises in order. Default target_sets per item.sets if present.
    for (let i = 0; i < strengthItems.length; i++) {
      const it = strengthItems[i];
      await tx.query(
        `INSERT INTO user_routine_exercises (routine_id, exercise_id, position, target_sets) VALUES ($1, $2, $3, $4)`,
        [routineId, it.content_id, i + 1, it.sets ?? 3]
      );
    }
    await tx.query('COMMIT');

    // Compute dropped phases for the response (informational, not the engine truth)
    const droppedPhases = session.phases
      .filter(p => !p.items?.some(it => it.content_type === 'strength'))
      .map(p => p.phase);

    return res.json({
      routine_id:     routineId,
      saved_phase:    'strength',
      dropped_phases: droppedPhases,
      exercise_count: strengthItems.length,
    });
  } catch (err) {
    await tx.query('ROLLBACK');
    console.error('[T7] /save-as-routine error:', err);
    return res.status(500).json({ error: 'engine_error' });
  } finally {
    tx.release();
  }
});
```

**Note on transaction usage:** mirrors T6's pattern — caller-owned BEGIN/COMMIT, ROLLBACK on any failure inside the try block. JSDoc on the route handler should call out the transaction boundary so future maintainers don't push DB calls into the catch block.

---

### Pre-flight diagnostic

**Per principle #14 (T6's expansion):** verify (a) hand-derived data, (b) live table/column shape, (c) actual file/symbol shape.

```js
// server/scripts/preflight-s12-t7-shape.mjs

// === (a) Hand-derived data ===
// T7 has no hand-derived matrix. Skip.

// === (b) Schema shape ===

// 1. sessions table:
//    - has columns id, user_id, type, focus_slug, completed, created_at
//    - focus_slug is VARCHAR(40) NULLABLE (T5 added)
//    - the partial index on (user_id, focus_slug, created_at) WHERE completed=true exists
//      (added in T5 via migrate.js — check it landed)
// Assert: column types/nullability + index existence (pg_indexes).

// 2. breathwork_sessions table:
//    - has columns id, user_id, focus_slug, completed, created_at
//    - focus_slug VARCHAR(40) NULLABLE (T5 added)
// Assert: column shape + the partial index on (user_id, focus_slug, created_at).

// 3. user_routines + user_routine_exercises shape (per APP_AUDIT.md lines 1910-1930):
//    - user_routines(id, user_id, name VARCHAR(100), description, created_at, updated_at)
//    - user_routine_exercises(id, routine_id FK, exercise_id FK, position, target_sets, notes)
//    - UNIQUE(routine_id, position)
// Assert: column types + UNIQUE constraint exists.

// 4. The phase-level joining tables (used by /last reconstruction):
//    - session_exercises (Sprint 1 — exists per APP_AUDIT.md line 1727)
//    - whatever Sprint 9 named the yoga-session items table
//    - whatever Sprint 9 named the breathwork-session items rows (if separate from breathwork_sessions itself)
// Assert by schema query: list candidate tables matching prefix `session_*` and report.
// If the spec's reconstruction logic depends on a table that doesn't exist, halt and ask.

// === (c) Handler/symbol shape ===

// 5. requireAuth middleware: confirm import path
//    grep -rn 'requireAuth\|authMiddleware' server/src/middleware/ -l
//    Report file + named export.

// 6. generateSession exported from server/src/services/suggestionEngine.js:
//    grep -n 'export.*generateSession\|module.exports' server/src/services/suggestionEngine.js
//    Confirm signature accepts {user_id, focus_slug, entry_point, time_budget_min, bracket}.

// 7. Existing route mount points in server/src/index.js:
//    grep -n 'app.use.*\/api\/' server/src/index.js
//    Report current mount table. T7's new mount goes in the same block.

// 8. Engine throw messages — the strings the error mapper string-matches against:
//    Pattern-grep the engine for `throw new RangeError(`. List every found message.
//    Compare against the mapper's expected strings. Halt if a known message is absent
//    (engine refactored without updating mapper) or if a new message exists that the
//    mapper doesn't cover (T7 needs to extend mapper).

// === Failure mode ===
// If any (b) check fails: halt. The migration is missing or the schema drifted.
// If (c) finds zero matches for a required symbol: halt. The spec assumed an export that doesn't exist.
// If (c) finds the symbol but with a different signature: halt with a diff. PM (Claude.ai) updates spec.
// If (c) finds engine throw messages the mapper doesn't cover: halt with the list. Mapper needs extension before build proceeds.
```

The pre-flight is the gate. T7 does NOT modify schema. T7 does NOT modify the engine. It only adds a thin HTTP layer over both. If pre-flight reveals a structural assumption is wrong, the build halts, the spec is amended, then the build resumes — never patches the smoke or hides the gap in the route handler.

---

## Acceptance criteria

T7 ships when:

1. **Pre-flight passes** — schema matches §Implementation contract; engine exports verified; engine throw-message inventory matches the mapper.
2. **`POST /api/sessions/suggest` — body focus from home, valid budget.** Returns 200 with engine output verbatim + `metadata.source='engine_v1'`. `session_shape='cross_pillar'`. 5 phases. No warnings (or 1 warning if recency overlap fixture is present).
3. **`POST /api/sessions/suggest` — state focus from breathwork_tab, valid bracket.** Returns 200, `session_shape='state_focus'`, 3 phases (`centering/practice/reflection`).
4. **`POST /api/sessions/suggest` — body focus, missing time_budget.** Returns 400 with `{error: 'body_focus_requires_time_budget'}`.
5. **`POST /api/sessions/suggest` — state focus, missing bracket.** Returns 400 with `{error: 'state_focus_requires_bracket'}`.
6. **`POST /api/sessions/suggest` — body focus, invalid time_budget (4 or 241 or "abc" or null).** Returns 400 with `{error: 'invalid_time_budget'}`.
7. **`POST /api/sessions/suggest` — state focus, invalid bracket ("0-15" or null).** Returns 400 with `{error: 'invalid_bracket'}`.
8. **`POST /api/sessions/suggest` — unknown focus_slug ("xyz").** Returns 400 with `{error: 'unknown_focus_slug'}`.
9. **`POST /api/sessions/suggest` — invalid entry_point ("yoga_page").** Returns 400 with `{error: 'invalid_entry_point'}`.
10. **`POST /api/sessions/suggest` — body focus from breathwork_tab.** Returns 400 with `{error: 'invalid_focus_entry_combo'}`. (Engine throws; mapper translates.)
11. **`POST /api/sessions/suggest` — state focus from strength_tab.** Returns 400 with `{error: 'invalid_focus_entry_combo'}`.
12. **`POST /api/sessions/suggest` — mobility from strength_tab.** Returns 400 with `{error: 'invalid_focus_entry_combo'}`. (T4's structural throw.)
13. **`POST /api/sessions/suggest` — recency-warning surfaces.** Insert a yesterday strength session for biceps; suggest biceps today. Response includes `warnings: [{type: 'recency_overlap', ...}]`.
14. **`POST /api/sessions/suggest` — exclusion respected.** Exclude an exercise via T6's endpoint. Suggest the focus that would surface it. Across 20 calls, the excluded exercise never appears.
15. **`POST /api/sessions/suggest` — no JWT.** Returns 401.
16. **`POST /api/sessions/suggest` — invalid JWT.** Returns 401.
17. **`GET /api/sessions/last?focus=biceps` — no prior session.** Returns 404 with `{error: 'last_session_not_found'}`.
18. **`GET /api/sessions/last?focus=biceps` — strength session yesterday.** Returns 200 with `session_shape='pillar_pure'`, single phase, `metadata.source='last_completed'`, `metadata.completed_at` ISO8601.
19. **`GET /api/sessions/last?focus=calm` — breathwork session 3 days ago.** Returns 200 with `session_shape='state_focus'`, 3 phases. (Pulled from `breathwork_sessions`.)
20. **`GET /api/sessions/last?focus=biceps` — both a strength session yesterday AND a breathwork session 2 days ago tagged biceps (edge case fixture).** Returns the strength one (more recent). Confirms UNION ordering.
21. **`GET /api/sessions/last` — missing focus param.** Returns 400 with `{error: 'focus_param_required'}`.
22. **`GET /api/sessions/last?focus=xyz` — unknown slug.** Returns 400 with `{error: 'unknown_focus_slug'}`.
23. **`GET /api/sessions/last` — no JWT.** Returns 401.
24. **`POST /api/sessions/save-as-routine` — cross_pillar success.** Suggest biceps from home (cross_pillar with strength main phase). Save with name="Test Routine". Returns 200 with `routine_id`, `saved_phase='strength'`, `dropped_phases=['bookend_open', 'warmup', 'cooldown', 'bookend_close']`, `exercise_count` matches main phase count. Verify rows in `user_routines` and `user_routine_exercises`.
25. **`POST /api/sessions/save-as-routine` — state_focus rejected.** Suggest calm from breathwork_tab. Save attempt. Returns 400 with `{error: 'state_focus_not_saveable_v1'}`. No rows inserted.
26. **`POST /api/sessions/save-as-routine` — pillar_pure yoga rejected.** Suggest mobility from yoga_tab. Save attempt. Returns 400 with `{error: 'pillar_pure_yoga_not_saveable_v1'}`.
27. **`POST /api/sessions/save-as-routine` — pillar_pure breathwork rejected.** (Save a session whose phases all contain breathwork — synthesize the payload manually since no entry-point produces this currently.) Returns 400 with `{error: 'pillar_pure_breathwork_not_saveable_v1'}`.
28. **`POST /api/sessions/save-as-routine` — missing name.** 400 with `{error: 'routine_name_required'}`.
29. **`POST /api/sessions/save-as-routine` — name 101 chars.** 400 with `{error: 'routine_name_too_long'}`.
30. **`POST /api/sessions/save-as-routine` — description 501 chars.** 400 with `{error: 'routine_description_too_long'}`.
31. **`POST /api/sessions/save-as-routine` — empty session.** Body has `{name, session: {phases: []}}`. 400 with `{error: 'no_strength_phase_in_session'}`.
32. **`POST /api/sessions/save-as-routine` — atomicity.** Force a DB error mid-INSERT (mock the routine_exercises insert to fail). `user_routines` row is rolled back. No orphan routine.
33. **`POST /api/sessions/save-as-routine` — saved routine appears in existing `GET /api/routines`.** End-to-end through the existing routines API. Confirms the wrapper writes to the same table the existing list-routines reads.
34. **`POST /api/sessions/save-as-routine` — no JWT.** 401.
35. **All Sprint 12 prior smoke continues to pass.** T2 / T3 / T3.5 / T4 / T5 / T6 smoke unchanged. T7 block adds assertions; nothing existing breaks.
36. **`/review` grade ≥ A-.** Per the standard process for logic tickets.

---

## Smoke harness extension

`scripts/test-suggestion-engine-t2.js` (rolling Sprint 12 harness) gets a new T7 block. Pattern matches T6: try/finally restores DB state, SIGINT/SIGTERM handlers re-restore on abort. T7's smoke uses **in-process `supertest`-style or direct `fetch` against a per-test-spawned Express app instance** to exercise HTTP handlers without spinning up a real server every assertion.

```
T7 HTTP-LAYER BLOCK
===================
Setup: spawn a test Express app instance via `createApp()` factory (refactor index.js
       if needed to expose this — see open question 4). Pick test user with valid JWT.
       Wrap entire block in try / finally / signal handlers.

Sub-block 1: /suggest body-focus happy path                       (criterion #2)
Sub-block 2: /suggest state-focus happy path                      (criterion #3)
Sub-block 3: /suggest validation matrix — 9 error cases           (criteria #4-#12)
Sub-block 4: /suggest recency-warning round-trip                  (criterion #13)
Sub-block 5: /suggest exclusion round-trip                        (criterion #14)
Sub-block 6: /suggest auth — missing/invalid JWT                  (criteria #15-#16)
Sub-block 7: /last 404 — no prior session                         (criterion #17)
Sub-block 8: /last 200 — strength session                         (criterion #18)
Sub-block 9: /last 200 — breathwork session                       (criterion #19)
Sub-block 10: /last UNION ordering                                (criterion #20)
Sub-block 11: /last validation                                    (criteria #21-#22)
Sub-block 12: /last auth                                          (criterion #23)
Sub-block 13: /save-as-routine cross_pillar success               (criterion #24)
Sub-block 14: /save-as-routine state_focus rejected               (criterion #25)
Sub-block 15: /save-as-routine pillar_pure rejected (yoga + bw)   (criteria #26-#27)
Sub-block 16: /save-as-routine validation                         (criteria #28-#31)
Sub-block 17: /save-as-routine atomicity                          (criterion #32)
Sub-block 18: /save-as-routine round-trip via existing API        (criterion #33)
Sub-block 19: /save-as-routine auth                               (criterion #34)

Cleanup: DELETE seeded routines + routine_exercises + sessions + breathwork_sessions
         tagged for this user. Verify counts back to snapshot. Throw on mismatch.
```

Each sub-block contributes 2–8 assertions. Estimated additions: ~110 assertions. Smoke total will become **`3173 + ~110 ≈ 3283`**.

The atomicity test (sub-block 17) requires injecting a failing transaction client. Same pattern as T6 sub-block 16 — wrap the route handler's transaction acquisition with a test-only mock path. If invasive, drop to manual-only verification with `psql` and document as in T6.

---

## Live HTTP round-trip (`scripts/t7-curl-roundtrip.mjs`)

Mirrors `t6-curl-roundtrip.mjs`. End-to-end against a running server (assumes `npm run dev` is up):

```
1. Register a fresh test user → capture JWT.
2. Suggest body focus (biceps, home, 30) → verify response shape.
3. Suggest state focus (calm, breathwork_tab, 10-20) → verify response shape.
4. Try /last for biceps → expect 404.
5. Save the body-focus suggestion as routine "T7 Roundtrip" → expect 200 + routine_id.
6. Verify via GET /api/routines/:id that the routine exists with the right exercise count.
7. Insert a fake completed strength session for biceps via direct SQL.
8. Try /last for biceps → expect 200 + session_shape='pillar_pure'.
9. Try save-as-routine on the state-focus suggestion → expect 400 + state_focus_not_saveable_v1.
10. Try /suggest with no JWT → expect 401.
11. Cleanup: DELETE routine, session, user.
```

Target: ~25 pass, 0 fail.

---

## Tech-debt budget

3/10. Same neighborhood as T5 and T6. The work is:

- One new route file (`sessions.js`) with ~250 lines (3 endpoints + error mapper + helpers).
- One new formatter service (`sessionFormatter.js`) with ~150 lines (DB-row → engine-shape transformer per pillar_type, four cases).
- One mount-point change in `index.js` (~3 lines).
- One pre-flight script (~180 lines, slightly larger than T6's because (b) covers more tables).
- Smoke block (~400 lines — 19 sub-blocks, the most of any S12 ticket).
- Round-trip script (~180 lines).

No architecture pivots. No schema changes. The transaction pattern is identical to T6's. The error-mapping pattern is novel for the codebase but small enough to inline.

**The two things pushing this above 2/10:**

1. **Last-session reconstruction across 4 pillar_type cases.** Each case touches a different joining table (`session_exercises`, the yoga session table whose name is pre-flight-verified, breathwork-session items, 5-phase joining tables). The formatter dispatches and Sprint 9's exact yoga/breathwork persistence layouts are not in this spec author's context at write-time — pre-flight surfaces them. There's a risk the 5-phase reconstruction needs to degrade to "strength-only with `partial_reconstruction=true`" if the joining tables don't exist as assumed. Spec acknowledges that path explicitly.

2. **Save-as-routine cross_pillar payload extraction.** The strength-extraction loop is straightforward, but the `dropped_phases` response field requires correctly identifying which engine phases had no strength items. Easy to get subtly wrong (e.g. miscounting a `main` phase that had only one yoga pose as "dropped" when actually it should be enumerated). A unit test on the extraction helper would catch this — folded into smoke sub-block 13.

---

## Followups for FUTURE_SCOPE (post-Sprint-12, if surfaced during build)

1. **Cross-pillar saved sessions (`saved_sessions` table).** Decision 1 and 2/3 limit save to strength-only because `user_routines` is strength-FK. Sprint 14+ work to add a `saved_sessions` table that holds the full engine output (denormalized JSONB or per-phase joining), preserving cross-pillar shape. Trigger: a user asks for "save my whole biceps + yoga session" or composer Sprint 14 creates the same need.
2. **Personalized `alternative_focus_slug` on /last 404.** When `/last` returns 404 for a focus, the response could include a "try one of these" affordance based on the user's history. Currently we return 404 with no recommendation (Flutter handles empty-state). Pairs with FUTURE_SCOPE #161 (personalized alternatives in recency warnings) — both gated on the personalization-algorithm planning.
3. **Pagination / history on `/api/sessions/last`.** v1 returns at most 1 row. A `?limit=N` would let a "Recent sessions for this focus" surface emerge in Sprint 14+. Trivial extension — out of v1 scope.
4. **Engine output telemetry.** Log every `/suggest` call's response shape, focus, level, level-recompute hits, and `metadata.estimated_total_min`-vs-budget delta. Lets us measure the v1 acceptance criterion #9 target (within 10% of budget) against real users. Sprint 14+ analytics work.
5. **Explicit "session executed" tracking.** Currently sessions get logged when the user finishes (the existing 4 INSERT sites T5 wired). The `/suggest` response doesn't get any post-execution feedback loop. v2: surface a `POST /api/sessions/executed` to mark a suggested session as adopted (vs. discarded) so the engine can learn user pickiness over time. Sprint 14+ personalization work.
6. **Server-side caching of `/suggest`.** A user opening the home page twice in 30 seconds gets two different engine outputs (random sampling). Could cache by `(user_id, focus_slug, entry_point, time_budget_min/bracket)` for ~5 minutes. Sprint 14+ if telemetry shows real cost from re-requests.
7. **Delete a saved routine via the same surface.** v1 reuses the existing `DELETE /api/routines/:id`. If the save-as-routine surface evolves to include richer metadata (provenance, regenerate-from-suggestion link), the delete may need a session-aware variant.
8. **Reset/un-exclude from /save-as-routine flow.** Out of T7 scope — covered by T6 followup #6.

---

## Open questions for Prashob

1. **Decision 15 — 200 vs 201 on `/save-as-routine`.** I went with 200 because the response is conceptually about the saved-session result (echoed dropped_phases etc.) rather than a routine resource handle. The existing `POST /api/routines` per APP_AUDIT.md uses 201 nominally though docs vs runtime may already drift. Worth standardizing — do you want me to set `/save-as-routine` to 201 to match the documented routines convention, or keep 200 for the "session save action" framing? **Recommendation:** keep 200; the response is action-result, not resource-create.

2. **Decision 1, 2, 3 — saveability gates.** This is the spec's biggest substantive call. Three pieces:
   - Cross_pillar saves strength-only with `dropped_phases` honesty.
   - State-focus rejected outright.
   - Pillar_pure yoga and breathwork rejected outright.
   Are all three the right v1 line, or do you want any of them to silently degrade instead of 400? **Recommendation:** keep all three as 400 — silent degradation contradicts T3.5's "honesty over silence" pattern. Flutter's UX for the 400 is a tooltip ("State sessions can't be saved as routines yet — try Repeat Last").

3. **Decision 4 — `/last` reconstruction approach.** Path A (UNION over `sessions` + `breathwork_sessions`, return whichever is most recent) is the v1 pick. The two riskier alternatives — Path B (synthesize cross-pillar from per-phase last-rows) and Path C (cache engine output in a new table) — are explicitly rejected. Path A's risk is the 5-phase reconstruction case where pre-flight may surface that the per-phase joining tables don't allow clean reconstruction. If that happens, the spec falls back to "5-phase last-session reconstructs to strength-only with `metadata.partial_reconstruction=true`" — capturing the gap as FUTURE_SCOPE rather than amending T7's scope mid-build. **Are you OK with that fallback?**

4. **Smoke harness app-instance pattern.** T7's smoke needs to call HTTP handlers. Two options:
   - **(a) Refactor `server/src/index.js` to expose a `createApp()` factory** so the smoke can spawn an in-process Express app per test (or per file). Cleaner test isolation; small ~30-line refactor to `index.js`.
   - **(b) Have the smoke spawn a `child_process.exec('npm run dev')` once and run `fetch` against `localhost:PORT`.** No code change to `index.js`; flakier (port conflicts, startup races); slower.
   **Recommendation:** (a). The `createApp()` refactor is one of those small structural changes that pays for itself across every future HTTP-layer test. The downside is that it's a server-startup change inside a feature ticket, which usually I'd avoid — but pre-flight catches whether the refactor is safe. **Does this feel like a reasonable in-T7 cost, or do you want me to spec the refactor as its own micro-ticket (T7.0) ahead of the main ticket?**

5. **Engine throw-message inventory in pre-flight (Decision 6 § Error mapping).** The mapper string-matches against engine throw messages. Pre-flight lists every `throw new RangeError(` in the engine and compares against the mapper's expected strings. If a known message is missing, build halts. If a new message exists that the mapper doesn't cover, build halts. **Are you OK with this approach, or would you rather we use a typed-error pattern (engine throws a class with a `code` property, mapper reads `err.code`)?** Typed errors are nicer; refactoring the engine to use them is ~30 lines across 8 throw sites and would be a small T7.x sub-ticket. v1 string-match is fine for the small surface but accumulates fragility.

6. **`/save-as-routine` request shape — pass full session payload back, or pass just the focus_slug + regenerate?** I went with "pass full session payload" (Flutter sends the engine's previous response back to the server). Alternative: Flutter sends `{name, focus_slug, entry_point, time_budget_min/bracket}` and the server re-calls `generateSession` to get fresh phases, then saves those. **Recommendation:** pass-full-payload. The whole point of "save this session" is *this specific session* — re-generating gives the user a different one (random sampling). Need confirmation though because the alternative is more REST-y.

7. **Save-as-routine `name` uniqueness.** `user_routines` does NOT have a UNIQUE on `(user_id, name)`. Two saves with the same name produce two routines. **Is that intentional v1 behavior**, or should `/save-as-routine` 409-Conflict on duplicate name? **Recommendation:** allow duplicates v1 — match existing `POST /api/routines` behavior; the existing `SaveRoutineSheet` from Sprint 8 doesn't enforce uniqueness either. Flutter can soft-warn on duplicate but the server stays permissive.

8. **`createApp()` refactor — does it land on `s12-t7` or as a pre-T7 chore?** If we're doing it (open question 4 path a), I'd prefer it as a separate commit on the same branch (`s12-t7`) so /review can score it independently from the route work. Confirms: same branch is fine, separate commit, /review on whole-ticket sees both.

---

## Appendix A — Endpoint summary

```
+----------------------------------------+--------+----------------------------------+----------------+
| Endpoint                               | Method | Body / Query                     | Auth           |
+----------------------------------------+--------+----------------------------------+----------------+
| /api/sessions/suggest                  | POST   | {focus_slug, entry_point,        | requireAuth    |
|                                        |        |  time_budget_min?, bracket?}     |                |
| /api/sessions/last?focus=<slug>        | GET    | (query: focus)                   | requireAuth    |
| /api/sessions/save-as-routine          | POST   | {name, description?, session}    | requireAuth    |
+----------------------------------------+--------+----------------------------------+----------------+
```

Mount in `server/src/index.js`:

```js
// existing mounts ...
app.use('/api/sessions', sessionsRouter);
```

---

## Appendix B — Stable error code dictionary

| Code | HTTP | When |
|------|------|------|
| `unauthorized` | 401 | JWT missing or invalid (existing middleware behavior; T7 doesn't override) |
| `invalid_focus_slug` | 400 | `focus_slug` is not a string or fails `/^[a-z_]{1,40}$/` regex |
| `unknown_focus_slug` | 400 | `focus_slug` does not match any row in `focus_areas` |
| `invalid_entry_point` | 400 | `entry_point` not in the 4-value enum |
| `body_focus_requires_time_budget` | 400 | Body focus + missing/null `time_budget_min` |
| `state_focus_requires_bracket` | 400 | State focus + missing/null `bracket` |
| `invalid_time_budget` | 400 | `time_budget_min` not a positive integer in [5, 240] |
| `invalid_bracket` | 400 | `bracket` not in the 5-value enum |
| `invalid_focus_entry_combo` | 400 | Engine throws on body-focus-from-breathwork-tab, state-focus-from-strength-tab, mobility-from-strength-tab, etc. |
| `engine_error` | 500 | Engine non-RangeError exception (should never happen post-S12) |
| `last_session_not_found` | 404 | `/last` UNION returns zero rows |
| `focus_param_required` | 400 | `/last` missing `?focus=` query param |
| `state_focus_not_saveable_v1` | 400 | `/save-as-routine` with `session.session_shape='state_focus'` |
| `pillar_pure_yoga_not_saveable_v1` | 400 | `/save-as-routine` with pillar_pure session containing yoga items |
| `pillar_pure_breathwork_not_saveable_v1` | 400 | `/save-as-routine` with pillar_pure session containing breathwork items |
| `routine_name_required` | 400 | `/save-as-routine` missing or empty `name` |
| `routine_name_too_long` | 400 | `name.length > 100` |
| `routine_description_too_long` | 400 | `description.length > 500` |
| `session_payload_required` | 400 | `/save-as-routine` missing `session` object or malformed |
| `no_strength_phase_in_session` | 400 | Cross_pillar session has empty strength items array (defensive — engine shouldn't produce this) |

Flutter consumes these as switch-case keys. Adding a new code requires extending this table AND the Flutter copy dictionary.

---

## Appendix C — Sample request / response payloads

### `POST /api/sessions/suggest` — body focus

**Request:**
```json
{
  "focus_slug": "biceps",
  "entry_point": "home",
  "time_budget_min": 30
}
```

**Response 200:**
```json
{
  "session_shape": "cross_pillar",
  "phases": [
    {
      "phase": "bookend_open",
      "items": [
        { "content_type": "breathwork", "content_id": 12, "name": "Box Breathing", "duration_minutes": 2, "tier_badge": null }
      ]
    },
    {
      "phase": "warmup",
      "items": [
        { "content_type": "yoga", "content_id": 87, "name": "Cat-Cow", "duration_minutes": 1, "tier_badge": null },
        { "content_type": "yoga", "content_id": 102, "name": "Sun Salutation A", "duration_minutes": 3, "tier_badge": null }
      ]
    },
    {
      "phase": "main",
      "items": [
        { "content_type": "strength", "content_id": 245, "name": "Barbell Curl", "sets": 3, "reps": 10, "tier_badge": "standard" },
        { "content_type": "strength", "content_id": 312, "name": "Hammer Curl",  "sets": 3, "reps": 12, "tier_badge": "standard" },
        { "content_type": "strength", "content_id": 401, "name": "Cable Curl",   "sets": 3, "reps": 12, "tier_badge": "foundational" }
      ]
    },
    {
      "phase": "cooldown",
      "items": [
        { "content_type": "yoga", "content_id": 156, "name": "Forward Fold", "duration_minutes": 2, "tier_badge": null }
      ]
    },
    {
      "phase": "bookend_close",
      "items": [
        { "content_type": "breathwork", "content_id": 8, "name": "Diaphragmatic", "duration_minutes": 2, "tier_badge": null }
      ]
    }
  ],
  "warnings": [],
  "metadata": {
    "estimated_total_min": 28,
    "user_levels": { "strength": "beginner", "yoga": "beginner", "breathwork": "beginner" },
    "source": "engine_v1"
  }
}
```

### `POST /api/sessions/suggest` — state focus

**Request:**
```json
{
  "focus_slug": "calm",
  "entry_point": "breathwork_tab",
  "bracket": "10-20"
}
```

**Response 200:**
```json
{
  "session_shape": "state_focus",
  "phases": [
    { "phase": "centering",  "items": [ { "content_type": "breathwork", "content_id": 8,  "name": "Diaphragmatic",   "duration_minutes": 2, "tier_badge": null } ] },
    { "phase": "practice",   "items": [ { "content_type": "breathwork", "content_id": 23, "name": "Coherent Breath",  "duration_minutes": 12, "tier_badge": "standard" } ] },
    { "phase": "reflection", "items": [ { "content_type": "breathwork", "content_id": null, "name": "Silent reflection", "duration_minutes": 2, "tier_badge": null } ] }
  ],
  "warnings": [],
  "metadata": {
    "estimated_total_min": 16,
    "user_levels": { "strength": "beginner", "yoga": "beginner", "breathwork": "beginner" },
    "source": "engine_v1"
  }
}
```

### `GET /api/sessions/last?focus=biceps`

**Response 200:**
```json
{
  "session_shape": "pillar_pure",
  "phases": [
    {
      "phase": "main",
      "items": [
        { "content_type": "strength", "content_id": 245, "name": "Barbell Curl", "sets": 3, "reps": 10, "tier_badge": null }
      ]
    }
  ],
  "warnings": [],
  "metadata": {
    "estimated_total_min": 25,
    "user_levels": { "strength": "beginner", "yoga": "beginner", "breathwork": "beginner" },
    "source": "last_completed",
    "completed_at": "2026-04-29T18:42:11Z"
  }
}
```

**Response 404:**
```json
{ "error": "last_session_not_found" }
```

### `POST /api/sessions/save-as-routine`

**Request:**
```json
{
  "name": "Biceps blast",
  "description": "My go-to biceps routine",
  "session": {
    "session_shape": "cross_pillar",
    "phases": [ /* full engine output, echoed back from earlier /suggest call */ ],
    "warnings": [],
    "metadata": { "source": "engine_v1", "estimated_total_min": 28, "user_levels": {} }
  }
}
```

**Response 200:**
```json
{
  "routine_id": 127,
  "saved_phase": "strength",
  "dropped_phases": ["bookend_open", "warmup", "cooldown", "bookend_close"],
  "exercise_count": 3
}
```

**Response 400 — state focus:**
```json
{ "error": "state_focus_not_saveable_v1" }
```

---

**End of spec. Awaiting greenlight on Decisions 1, 4, 6, 9, and the open questions in §Open questions before the Claude Code prompt is written.**

# S12-T6 — Swap-Counter + Exclusion Endpoints Spec

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 30, 2026
**Version:** v1
**Status:** DRAFT pending Prashob review of Decisions 1, 2, 3, 5, 7, and the routes-layout open question. Locks on greenlight.
**Depends on:** S12-T1 (`exercise_swap_counts` and `user_excluded_exercises` tables exist), S12-T2 (engine reads `user_excluded_exercises` to filter strength candidates) — both shipped.
**Branch:** `s12-t6` off `s12-t5`
**Blocks:** S12-T7 (HTTP surface — `POST /api/sessions/suggest` consumes the engine's already-filtered output; T6 just makes sure the filter has data to act on).

---

## Why this ticket exists

T1 created the schema (`exercise_swap_counts`, `user_excluded_exercises`). T2 wired the **read side** — the strength picker filters out `id NOT IN user_excluded_exercises` via the existing `userExcludedIds` set in `loadStrengthCandidatePool`. The **write side** does not exist yet:

1. **Swap-counter increment.** Today, when a user swaps an exercise mid-workout (Sprint 8 `ExerciseSwapSheet`), the existing handler swaps the slot's chosen exercise. It does *not* tell `exercise_swap_counts` that anything happened. T6 makes the swap a tracked event: `swap_count++`, `last_swapped_at = NOW()`, `prompt_state` advances per the threshold rules.
2. **3rd-swap prompt response.** When `swap_count` lands on 3 (first time) or 6 (after the user said "keep suggesting"), the swap response carries `should_prompt: true` so the Flutter UI can show the "want to stop seeing this?" sheet.
3. **Two new endpoints.** `POST /api/exercises/:id/exclude` mirrors a row into `user_excluded_exercises` and flips `prompt_state` to `'excluded'`. `POST /api/exercises/:id/keep-suggesting` flips `prompt_state` to `'prompted_keep'`.

The work is mechanical SQL + endpoint scaffolding. The interesting calls are: **which existing handler do we extend** (Decision 1 — schema/route-shape preflight), **what's the canonical request/response shape** (Decisions 2, 3, 7), and **what counts as a "swap" for the counter** (Decision 5).

The pre-flight scope here is explicitly broader than T3.5/T5 — see §Pre-flight diagnostic. T5 surfaced that hand-derived matrices aren't the only thing pre-flight should verify; **table existence and column shape** belong in pre-flight too. T6 codifies that.

---

## What's in scope

| Surface | T6 work |
|---------|---------|
| Existing strength swap handler | Extended: after the swap mutation, fire the increment + prompt-state SQL block; include `should_prompt` and `swap_count` in the response. |
| `POST /api/exercises/:id/exclude` | New endpoint. Idempotent INSERT into `user_excluded_exercises`. UPDATE `exercise_swap_counts.prompt_state = 'excluded'` for the row. |
| `POST /api/exercises/:id/keep-suggesting` | New endpoint. UPDATE `exercise_swap_counts.prompt_state = 'prompted_keep'`. |
| `exerciseSwap.js` (or wherever the increment helper lives) | New small service or inlined block — single transaction containing the upsert + the read-back. |
| Smoke harness (`scripts/test-suggestion-engine-t2.js`) | Extended with T6 SWAP-EXCLUSION block — fixture inserts, increment-up-the-ladder, prompt-state transitions, exclusion round-trip back through engine. |
| Pre-flight (`scripts/preflight-s12-t6-schema.mjs`) | New. Verifies `exercise_swap_counts` and `user_excluded_exercises` table+column shape against this spec, AND verifies the existing swap-handler file/symbol shape Claude Code reports during build. See §Pre-flight diagnostic. |

## What's out of scope

| Item | Why out, where it goes |
|------|------------------------|
| Yoga and breathwork swap counters | Spec line 180 locked: `exercise_swap_counts` is **strength only** in v1. Yoga (`yoga_sessions` swap UI from Sprint 9) and breathwork (mid-session swap) don't track counts. If we want them later, extend the table or add per-pillar tables — Sprint 13+. |
| Flutter swap-prompt UI | T6 emits `should_prompt: true`; the prompt sheet itself is Sprint 13 home/composer work. |
| Flutter "Excluded Exercises" Settings screen | Already in spec §Followups #2 (FUTURE_SCOPE deferred). Users who exclude by mistake reach out via support in v1. |
| Anti-recency exercise filtering ("don't suggest barbell squat 3 days running") | Covered by FUTURE_SCOPE post-Sprint-12 followup #3. |
| Backfilling existing swap history into `exercise_swap_counts` | No historical event log exists for past swaps. T6 starts fresh from ship-day. Acceptable — the 3 prod users have negligible swap history. |
| Reset/un-exclude endpoint | Part of the deferred Settings UI. v1 users contact support if they want to undo an exclusion. |
| Per-routine vs cross-routine counter scope | T6 counts globally per `(user_id, exercise_id)` — same as the table's UNIQUE constraint. The user swaps Burpees once in routine A, once in routine B, once in routine C → that's 3 swaps, prompt fires. The table's design intent. |

---

## Decisions to lock (Apr 30 review)

| # | Decision | Recommendation | Rationale |
|---|----------|----------------|-----------|
| 1 | **Which existing handler is the increment trigger?** Spec line 584 says "every time `AlternativePicker` resolves to a swap" — but the actual server surface needs verification. | **`PUT /api/workout/slot/:exerciseId/choose`** is the React-PWA-era surface per `APP_AUDIT.md` line 1642 (`{chosen_exercise_id}` body). Whether the Flutter app calls this endpoint or a Sprint-8-introduced new one is **the open question**. Build prompt asks Claude Code to confirm during build — `grep -rn "exercise_swap_counts\|/swap\|slot/.*choose\|exercise-pref" server/src/routes/` and report the actual handler signature before writing the increment block. If Flutter introduced a new endpoint in Sprint 8 (e.g. `POST /api/workout/swap`), extend that one instead. **Either way, the increment block is identical**; only the file:line where it lands shifts. | The audit reflects React PWA. Flutter rebuild may or may not have moved this. The pre-flight (§Pre-flight diagnostic) catches this before code is written. |
| 2 | **Increment scope — what counts as a "swap"?** | **Every time the user picks a different exercise via the swap UI (`chosen_exercise_id !== current_exercise_id`).** If the user opens the swap sheet and picks the *same* exercise (rare but possible), that's a no-op — no increment. If the user picks a different exercise, increment regardless of whether the swap is for a single session or persists as preference. | The swap counter is about "the user keeps wanting to get rid of this exercise" signal. Same-exercise re-pick is not that signal. Spec doesn't address this explicitly; calling it out so the increment SQL is gated on `WHERE chosen_exercise_id <> $exerciseId`. |
| 3 | **Atomicity — do increment + read-back run in one transaction?** | **Yes, single transaction.** Either both succeed or neither. Avoids: increment lands, prompt-state read fails, response returns no `should_prompt` even though the count crossed 3. | Postgres `BEGIN; INSERT...ON CONFLICT...; SELECT swap_count, prompt_state FROM... ; COMMIT;` — three statements, one round-trip via `pg.connect().query()` chain. Trivial. |
| 4 | **Prompt-state transition rules — what fires `should_prompt: true`?** | **Per spec lines 605-606 verbatim:** `swap_count = 3 AND prompt_state = 'never_prompted'` → `should_prompt: true`. `swap_count = 6 AND prompt_state = 'prompted_keep'` → `should_prompt: true`. Else → `should_prompt: false`. | Restating to lock. **One subtle add:** the `prompt_state` does NOT auto-transition when `should_prompt` is sent. The state transitions only when the user *responds* (via `/exclude` or `/keep-suggesting`). If the prompt is dismissed without a response (e.g. user closes the app), the next swap won't re-prompt at count=4 — the prompt will fire again only at count=6 if they responded "keep." If they never responded, the prompt could fire repeatedly at counts 3, 4, 5, ... — see Decision 5. |
| 5 | **What if the user dismisses the prompt without responding?** | **Treat dismissal as "keep suggesting" implicitly. The server transitions `prompt_state` to `'prompted_keep'` the moment `should_prompt: true` is returned.** This means the user only sees the prompt at count=3 (then again at 6, then never). | The alternative — "wait for explicit response" — leaves the prompt in a re-fire loop at every subsequent swap, which is annoying. Implicit "keep suggesting" matches the spec's intent (one prompt at 3, one final at 6, then leave them alone) and keeps the server-side state machine deterministic. **Caveat:** if Flutter ships the prompt UI (Sprint 13) with explicit "dismiss" handling that calls `/keep-suggesting`, this server-side auto-transition becomes redundant but harmless. **Alternative considered & rejected:** transition only on explicit response — rejected because it lets the prompt re-fire. |
| 6 | **Should `/exclude` 200 if the row is already excluded?** | **Yes, 200 with `{excluded: true, already: true}`.** Idempotent. Same for `/keep-suggesting` if already in `prompted_keep` state. | RESTful idempotency. The Flutter UI should not need to track local state to avoid double-calls. |
| 7 | **Exclude endpoint — what about exercises with no `exercise_swap_counts` row?** | **Allow.** The Flutter UI may call `/exclude` from a surface that wasn't a swap (e.g. a future "exclude this exercise" Settings affordance, or a long-press menu on a card). In that case, INSERT into `user_excluded_exercises` and UPSERT `exercise_swap_counts` with `swap_count=0, prompt_state='excluded'`. | The exclusion is the user's intent; the swap counter is just the trigger surface. Decoupling them future-proofs against #2 (Settings UI) and #11 in spec followups. **Alternative considered & rejected:** require a swap-counts row to exist — rejected because it adds a 404 case for no good reason. |
| 8 | **Response shape on the swap handler — do we add `should_prompt` always or only when true?** | **Always include `should_prompt: bool` and `swap_count: int`.** Flutter doesn't need to feature-detect. | Stable response shape, smaller diff for Flutter wiring. |
| 9 | **`/exclude` and `/keep-suggesting` — `:id` is `exercise_id`, right?** | **Yes — the strength `exercises.id`.** | Restating; route param naming is unambiguous. |
| 10 | **Flutter wiring — is that part of T6?** | **No — server-only.** T6 ships the endpoints and emits `should_prompt`. Flutter consumes in Sprint 13 alongside the prompt-sheet UI work. Manual test for T6 acceptance is a curl/Postman round-trip. | Same scope discipline as T5 (T5 emits `warnings`; Flutter consumes in Sprint 13). |

---

## The swap-counter rule — exact restatement

When a strength swap occurs (`chosen_exercise_id <> current_exercise_id`):

1. **Increment.** UPSERT `(user_id, current_exercise_id)` into `exercise_swap_counts`. New row → `swap_count=1`. Existing row → `swap_count++`. Always `last_swapped_at = NOW()`.
2. **Read back.** SELECT `swap_count, prompt_state`.
3. **Decide prompt.**
   - `swap_count = 3 AND prompt_state = 'never_prompted'` → `should_prompt = true`. **Server transitions `prompt_state` to `'prompted_keep'` immediately** (Decision 5 — implicit-keep-on-dismissal).
   - `swap_count = 6 AND prompt_state = 'prompted_keep'` → `should_prompt = true`. **Server does NOT transition on this fire** — the user has had their final prompt; whatever they pick is the answer (or no-answer = silence forever).
   - Otherwise → `should_prompt = false`.
4. **Respond.** Existing swap response shape, plus `should_prompt: bool` and `swap_count: int`.

When the user responds to the prompt:

- `POST /api/exercises/:id/exclude` → INSERT into `user_excluded_exercises` (idempotent), UPDATE `exercise_swap_counts.prompt_state = 'excluded'`. Engine never surfaces this exercise again (T2 already filters).
- `POST /api/exercises/:id/keep-suggesting` → UPDATE `exercise_swap_counts.prompt_state = 'prompted_keep'`. (No-op if already there per Decision 5's auto-transition; idempotent per Decision 6.)

When the user excludes from a non-swap surface (Decision 7):

- Same `/exclude` endpoint. UPSERT a `(user_id, exercise_id)` row into `exercise_swap_counts` with `swap_count = COALESCE(existing, 0), prompt_state = 'excluded'`. INSERT into `user_excluded_exercises`.

---

## Implementation contract

### File layout

```
server/src/routes/workout.js  (or wherever swap lands)    ← exists; extend swap handler with §Increment block
server/src/routes/exercises.js (or new file)              ← new endpoints /exclude and /keep-suggesting
server/src/services/swapCounter.js                        ← NEW: small service exporting incrementSwap(userId, exerciseId, tx) + setPromptState(userId, exerciseId, state, tx)
server/scripts/preflight-s12-t6-schema.mjs                ← NEW: see §Pre-flight diagnostic
server/scripts/test-suggestion-engine-t2.js               ← exists; extend with §Smoke block
```

> Claude Code: confirm the swap-handler filename, route path, and current response shape during the build. Don't assume `workout.js` — `APP_AUDIT.md` was the React-PWA surface; Flutter may have a different layout. Pre-flight reports the verified location; spec adapts.

### `incrementSwap` — exported service

```js
/**
 * Increments the swap count for an exercise the user is swapping AWAY from.
 * Returns the read-back state for the caller to decide whether to prompt.
 *
 * Single transaction: UPSERT + SELECT.
 * Caller passes a pg client `tx` if part of a larger transaction; otherwise
 * a fresh client is acquired internally.
 *
 * @param {number} userId
 * @param {number} exerciseId         // the exercise being swapped AWAY from
 * @param {pg.Client | null} tx       // optional existing transaction
 * @returns {Promise<{swap_count: number, prompt_state: string, should_prompt: boolean}>}
 */
async function incrementSwap(userId, exerciseId, tx = null) { ... }
```

### Increment + read-back SQL (single transaction)

```sql
-- Step 1: UPSERT
INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, last_swapped_at)
VALUES ($1, $2, 1, NOW())
ON CONFLICT (user_id, exercise_id)
DO UPDATE SET
  swap_count     = exercise_swap_counts.swap_count + 1,
  last_swapped_at = NOW()
RETURNING swap_count, prompt_state;

-- (No separate SELECT needed — RETURNING gives us the post-update row.)

-- Step 2: Decide should_prompt in JS:
--   should_prompt = (swap_count === 3 && prompt_state === 'never_prompted')
--                || (swap_count === 6 && prompt_state === 'prompted_keep');

-- Step 3: If should_prompt && swap_count === 3, transition state (Decision 5):
UPDATE exercise_swap_counts
SET prompt_state = 'prompted_keep'
WHERE user_id = $1 AND exercise_id = $2
  AND prompt_state = 'never_prompted';
-- (Guarded by WHERE so we never rewrite an `excluded` row.)
```

`$1 = userId`, `$2 = exerciseId`. Three statements, one transaction.

### `POST /api/exercises/:id/exclude` — handler

```js
// Request: POST /api/exercises/:id/exclude
// Auth: required (req.userId from JWT middleware)
// Body: none
// Response 200:
//   { excluded: true, already: false }   // first-time exclude
//   { excluded: true, already: true }    // already-excluded (idempotent)
// Response 404 if exercise_id doesn't exist in `exercises`.
// Response 400 if :id is not a positive integer.
```

```sql
-- Single transaction:

-- 1. Validate exercise exists
SELECT 1 FROM exercises WHERE id = $2;
-- (404 if zero rows)

-- 2. Idempotent INSERT into user_excluded_exercises
INSERT INTO user_excluded_exercises (user_id, exercise_id)
VALUES ($1, $2)
ON CONFLICT (user_id, exercise_id) DO NOTHING
RETURNING 1;
-- (Captured row count tells us already=false vs already=true.)

-- 3. Sync prompt_state on swap_counts; UPSERT in case the exclude came from
--    a non-swap surface and there's no existing row (Decision 7).
INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, prompt_state)
VALUES ($1, $2, 0, 'excluded')
ON CONFLICT (user_id, exercise_id)
DO UPDATE SET prompt_state = 'excluded';
```

### `POST /api/exercises/:id/keep-suggesting` — handler

```js
// Request: POST /api/exercises/:id/keep-suggesting
// Auth: required
// Body: none
// Response 200:
//   { kept: true, already: false }
//   { kept: true, already: true }
// Response 404 if exercise_id doesn't exist.
// Response 400 if :id invalid.
```

```sql
-- Validate exercise exists (404 if not)
SELECT 1 FROM exercises WHERE id = $2;

-- UPSERT to 'prompted_keep' — guarded WHERE so we don't downgrade 'excluded' back to 'prompted_keep'.
INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, prompt_state)
VALUES ($1, $2, 0, 'prompted_keep')
ON CONFLICT (user_id, exercise_id)
DO UPDATE SET prompt_state = 'prompted_keep'
WHERE exercise_swap_counts.prompt_state IN ('never_prompted', 'prompted_keep');
-- (If row is already 'excluded', the WHERE blocks the update — return already=true.)
```

### Wire point in the swap handler

Wherever the strength swap mutation lives (Decision 1 / pre-flight verifies):

```js
// AFTER the existing slot-choice mutation (workout_exercise_choices update or equivalent):

if (chosenExerciseId !== currentExerciseId) {
  const swapState = await incrementSwap(req.userId, currentExerciseId, tx);
  return res.json({
    ...existingResponseShape,
    should_prompt: swapState.should_prompt,
    swap_count: swapState.swap_count,
  });
}
return res.json({ ...existingResponseShape, should_prompt: false, swap_count: 0 });
```

The existing response shape is preserved; T6 only adds two fields. Flutter's existing swap-success path keeps working unchanged until Sprint 13 reads the new fields.

### Pre-flight diagnostic

**This is the operative pre-flight rule for T6, expanded from principle #14:**

> Pre-flight verifies (a) any hand-derived data structures used for assertions, AND (b) live table/column shape against any spec assumption, AND (c) the actual file/symbol shape of any handler the spec extends. The smoke harness does not run until pre-flight passes. Disagreement aborts the build; the spec or the assumption is corrected, not the smoke.

T6 has no hand-derived matrix (per (a)), so pre-flight focuses on (b) and (c):

```js
// server/scripts/preflight-s12-t6-schema.mjs

// === (b) Schema shape ===

// 1. exercise_swap_counts table exists with the spec's columns:
//    - id SERIAL PK
//    - user_id INT NOT NULL FK -> users(id) ON DELETE CASCADE
//    - exercise_id INT NOT NULL FK -> exercises(id) ON DELETE CASCADE
//    - swap_count INT NOT NULL DEFAULT 0
//    - last_swapped_at TIMESTAMPTZ
//    - prompt_state VARCHAR(20) NOT NULL DEFAULT 'never_prompted'
//      CHECK (prompt_state IN ('never_prompted', 'prompted_keep', 'excluded'))
//    - UNIQUE(user_id, exercise_id)
// Source of truth: Trackers/S12-suggestion-engine-spec.md lines 158-167.
// Assert: column names, types, NOT NULLs, CHECK constraint values, UNIQUE index.

// 2. user_excluded_exercises table exists with whatever shape T1 created.
//    T2 reads it via `WHERE id NOT IN (SELECT exercise_id FROM user_excluded_exercises WHERE user_id = $1)`
//    so the minimum contract is (user_id, exercise_id) with a UNIQUE constraint.
// Assert: table exists, has user_id and exercise_id columns, UNIQUE on the pair.

// 3. exercises table has id PK (sanity — used by FK).

// === (c) Handler shape ===

// Run a grep against server/src/routes/ for the strength swap handler:
//   - PUT  /api/workout/slot/:exerciseId/choose            (React-PWA-era)
//   - PUT  /api/workout/exercise-pref                      (React-PWA-era)
//   - POST /api/workout/swap                               (potential Sprint-8 introduction)
//   - any other route that takes a {chosen_exercise_id} body
// Report the matched file, route, and current response shape to stdout.
// The build prompt then incorporates the verified location into the
// `incrementSwap` wire-point.

// === Failure mode ===
// If schema check fails: throw, abort. Surface what's missing — e.g. "prompt_state column
// missing CHECK constraint, found 'never_prompted_X' literal — was T1 amended?"
// If handler check finds zero matches: throw, abort. Spec assumed an existing handler
// to extend; if there isn't one, T6's scope is wrong — refer back to PM (Claude.ai)
// for a re-spec, don't invent a new endpoint silently.
// If handler check finds multiple matches: throw, abort. Report all matches; PM picks one.
```

The pre-flight is the gate. If it fails, the build halts. T6 does NOT modify schema (T1 owned that) — it only verifies what T1 produced. T6 does NOT invent handlers — it only extends what Sprint 8/9 produced.

---

## Acceptance criteria

T6 ships when:

1. **Pre-flight passes** — schema matches §Implementation contract; existing strength swap handler is located and named in the build report.
2. **Increment first swap.** Empty `exercise_swap_counts` for `(user, exercise)`. Trigger one swap. Row exists with `swap_count=1, prompt_state='never_prompted', last_swapped_at` recent.
3. **Increment up to 3.** Two more swaps. Row reads `swap_count=3, prompt_state='prompted_keep'` (auto-transitioned per Decision 5). Response includes `should_prompt: true, swap_count: 3`.
4. **No re-prompt at 4 and 5.** Two more swaps. `swap_count=5, prompt_state='prompted_keep'`. Response includes `should_prompt: false`.
5. **Re-prompt at 6.** One more swap. `swap_count=6, prompt_state='prompted_keep'` (no transition this time per Decision 4). Response includes `should_prompt: true, swap_count: 6`.
6. **No re-prompt past 6.** Three more swaps. `swap_count=9, prompt_state='prompted_keep'`. Response includes `should_prompt: false`.
7. **Same-exercise re-pick is a no-op.** Open swap sheet, pick the *same* exercise. `swap_count` unchanged. Response includes `should_prompt: false, swap_count: <unchanged>`.
8. **Exclude endpoint — first call.** `POST /api/exercises/:id/exclude` → 200 with `{excluded: true, already: false}`. Row in `user_excluded_exercises`. `exercise_swap_counts.prompt_state = 'excluded'`.
9. **Exclude endpoint — idempotent.** Second call → 200 with `{excluded: true, already: true}`. No duplicate row.
10. **Exclude endpoint — non-swap origin.** Call `/exclude` for an exercise the user has *never* swapped. Row created in both tables: `user_excluded_exercises` with `(user, exercise)`, `exercise_swap_counts` with `swap_count=0, prompt_state='excluded'`.
11. **Exclude endpoint — invalid exercise.** Call with non-existent exercise_id → 404.
12. **Keep-suggesting endpoint.** `POST /api/exercises/:id/keep-suggesting` for an exercise in `prompt_state='prompted_keep'` → 200 with `{kept: true, already: true}`. State unchanged.
13. **Keep-suggesting from `never_prompted`.** Endpoint creates the row with `prompt_state='prompted_keep'` (Decision 6 idempotent UPSERT covers this). 200 with `{kept: true, already: false}`.
14. **Keep-suggesting does NOT downgrade `excluded`.** Exclude an exercise. Then call `/keep-suggesting`. Row stays `'excluded'` per the guarded UPDATE WHERE. Response 200 with `{kept: true, already: true}` (because the WHERE blocks but the call is still acknowledged).
15. **Engine round-trip — exclusion takes effect.** Exclude exercise X. Call the suggestion engine. X never appears in the output across N=20 runs. (T2 already filters — this confirms T6's write made it to T2's read.)
16. **Engine round-trip — `prompted_keep` does NOT exclude.** A `prompt_state='prompted_keep'` row does NOT remove the exercise from suggestions. Engine still surfaces it. (Confirms `user_excluded_exercises` is the only exclusion source, not `prompt_state` field interpretation.)
17. **Atomicity.** Force a DB error mid-transaction (e.g. inject a fake `tx.query` failure on step 2). Increment is rolled back; `swap_count` unchanged from the pre-call value. Verify by retry-after-error.
18. **All Sprint 12 prior smoke continues to pass.** T2/T3/T3.5/T4/T5 smoke unchanged. New T6 block adds assertions; no existing assertions break.
19. **`/review` grade ≥ A-.** Per the standard process for logic tickets.

---

## Smoke harness extension

`scripts/test-suggestion-engine-t2.js` (rolling Sprint 12 harness) gets a new section. Pattern matches T3.5/T4/T5: try/finally restores DB state, SIGINT/SIGTERM handlers re-restore on abort.

```
T6 SWAP-EXCLUSION BLOCK
=======================
Setup: pick test user, pick a strength exercise unlikely to collide with prior fixtures
       (e.g. by id range or by tagged name). Snapshot existing
       exercise_swap_counts and user_excluded_exercises rows for this user.
       Wrap entire block in try / finally / signal handlers.

Sub-block 1: empty baseline                                      (criterion #2)
Sub-block 2: increment to 3 — auto-transition + should_prompt    (criterion #3)
Sub-block 3: counts 4 and 5 — no re-prompt                       (criterion #4)
Sub-block 4: count 6 — final prompt fires                        (criterion #5)
Sub-block 5: counts 7-9 — silence                                (criterion #6)
Sub-block 6: same-exercise re-pick no-op                         (criterion #7)
Sub-block 7: /exclude first call                                 (criterion #8)
Sub-block 8: /exclude idempotent                                 (criterion #9)
Sub-block 9: /exclude non-swap origin (different exercise)       (criterion #10)
Sub-block 10: /exclude invalid id → 404                          (criterion #11)
Sub-block 11: /keep-suggesting from prompted_keep                (criterion #12)
Sub-block 12: /keep-suggesting from never_prompted               (criterion #13)
Sub-block 13: /keep-suggesting does not downgrade excluded       (criterion #14)
Sub-block 14: engine excludes excluded exercises                 (criterion #15)
Sub-block 15: engine still serves prompted_keep                  (criterion #16)
Sub-block 16: atomicity — forced rollback                        (criterion #17)

Cleanup: DELETE the seeded rows in user_excluded_exercises and exercise_swap_counts
         for this user. Verify counts back to snapshot. Throw on mismatch.
```

Each sub-block contributes 2–6 assertions. Estimated additions: ~70 assertions. Smoke total will become `3128 + ~70 ≈ 3198`.

The sub-blocks 14 and 15 (engine round-trip) reuse the existing `generateSession` harness from T2 — they're not new HTTP calls, they're direct service-level checks that the candidate pool's exclusion filter respects T6's writes.

The atomicity test (sub-block 16) is the trickiest — it requires a mock failure injection. Two acceptable patterns: (a) wrap `incrementSwap` to accept an injected failing client, or (b) skip this sub-block in the smoke and verify atomicity manually with `psql` + a deliberate FK violation. Prefer (a). If (a) is too invasive, drop to (b) and document.

---

## Tech-debt budget

3/10. Same neighborhood as T5. The work is:

- One service file (`swapCounter.js`) with ~50 lines.
- Two new endpoints in `exercises.js` (or wherever they fit) with ~80 lines each including validation.
- One wire-point change in the existing swap handler (~10 lines).
- One pre-flight script (~120 lines, similar size to `preflight-s12-t5-overlaps.mjs`).
- Smoke block (~250 lines).

No architecture pivots, no new abstractions, no schema work. The transactional UPSERT pattern is already proven in T1 / T5 migrations.

The one thing pushing this above 2/10: the **state-machine semantics** (`never_prompted → prompted_keep → excluded`, with the auto-transition on `should_prompt: true`) is implicit in the spec but not visualized as a state diagram anywhere. Decision 5 codifies the implicit-keep-on-dismissal; that decision deserves a comment block in `swapCounter.js` so a future maintainer doesn't undo it as an apparent bug. Header comment lifts directly from the spec's "exact restatement" section.

---

## Followups for FUTURE_SCOPE (post-Sprint-12, if surfaced during build)

1. **Settings UI for excluded exercises.** Already deferred (spec line 625, FUTURE_SCOPE post-Sprint-12 #2). T6 makes the `/exclude` endpoint idempotent from non-swap surfaces (Decision 7), so a future Settings screen has the API ready without re-spec.
2. **Yoga and breathwork swap counters.** Spec line 180 explicit out-of-scope. If users start asking for "stop suggesting Pigeon Pose," extend the table or add `pose_swap_counts` / `breathwork_swap_counts`. Sprint 14+.
3. **Swap-count decay over time.** A user who swapped Burpees 3 times two years ago shouldn't necessarily still be hidden. Add `last_swapped_at`-based decay: if `last_swapped_at < NOW() - INTERVAL '6 months'`, soft-reset `swap_count` to 0 next time. v2 polish.
4. **Per-routine vs cross-routine counter scope.** v1 counts globally. If a user has Routine A (push day) and Routine B (full body), and Burpees appears in both, the swap counter doesn't differentiate. Maybe it should — "I want Burpees in my push day routine but not my full body routine." Requires a `routine_id` column on `exercise_swap_counts`. Sprint 14+ if a user asks.
5. **Telemetry on prompt acceptance rate.** Are users actually responding to the prompt, or dismissing it? Decision 5 makes dismissal indistinguishable from "keep suggesting" server-side, so we'd need a separate event log to measure. Skip until growth-stage analytics work.
6. **Reset / un-exclude endpoint.** `DELETE /api/exercises/:id/exclude`. Required for the Settings UI in #1. Trivial but out of T6 scope. Sprint 14+.

---

## Open questions for Prashob

1. **Decision 1 (which existing handler) — confirm pre-flight approach.** I'm specifying that the build prompt asks Claude Code to grep for the swap surface and report before writing the increment block. If you'd rather I do a utility-chat pre-pass first ("read these files and tell me what the swap handler looks like") and then write the spec against verified reality, I can. **Recommendation:** the pre-flight script approach is fine — it's small enough and the build halts cleanly on disagreement. But if you want utility-chat first, say so.
2. **Decision 2 (same-exercise re-pick is no-op) — confirm.** Reasonable read of intent but spec doesn't address. Calling it out so we don't increment on a UI quirk.
3. **Decision 5 (auto-transition on should_prompt) — confirm.** This is the biggest call. Locks the state machine to "user sees the prompt at most twice." Alternative: re-fire on every swap until the user responds (annoying). I want eyes on this because it's a behavioral commitment.
4. **Decision 7 (allow /exclude with no swap-counts row) — confirm.** Future-proofs against the Settings UI. Locks the endpoint as an idempotent "I don't want this exercise" affordance, not a "swap aftermath" affordance.
5. **Decisions 6, 8 (response shapes) — confirm.** Stable shapes, idempotent semantics. Routine.
6. **Routes-layout open question.** Where do `/exclude` and `/keep-suggesting` live? Three options:
   - `server/src/routes/exercises.js` (new file, semantically aligned with `:id` being an exercise)
   - `server/src/routes/workout.js` (alongside the existing slot-choose handler)
   - `server/src/routes/preferences.js` (treats exclusions as a preference category)
   **Recommendation:** new file `exercises.js`. Cleaner ownership, easy to find, no growth-coupling with workout. Pre-flight verifies whether `exercises.js` already exists and the build adapts (extend vs create).
7. **Smoke sub-block 16 (atomicity test).** Is the mock-injection pattern (a) acceptable, or do you prefer the manual-only verification (b)? I'd default to (a) but want to flag because injecting into `incrementSwap` adds a bit of test-only surface.

---

## Appendix A — State machine diagram

```
                        swap_count = 3
                        AND state = never_prompted
              ┌───────────────────────────────────────┐
              │                                       │
              ▼                                       │
        ┌───────────┐    /keep-suggesting        ┌───────────────┐
        │           │   (or implicit on          │               │
        │ never_    │    should_prompt:true)     │ prompted_keep │
        │ prompted  ├───────────────────────────►│               │
        │           │                            │               │
        └─────┬─────┘                            └───────┬───────┘
              │                                          │
              │   /exclude                               │   /exclude
              │   (any time)                             │   (any time)
              ▼                                          ▼
                ┌─────────────────────────────────────┐
                │              excluded               │
                │   (terminal — engine never serves)  │
                └─────────────────────────────────────┘
```

- Counts 1, 2: stay in `never_prompted`. Response `should_prompt: false`.
- Count 3 (in `never_prompted`): auto-transition to `prompted_keep`. Response `should_prompt: true`.
- Counts 4, 5: stay in `prompted_keep`. Response `should_prompt: false`.
- Count 6 (in `prompted_keep`): NO transition. Response `should_prompt: true` (final prompt).
- Counts 7+: stay in `prompted_keep`. Response `should_prompt: false`. Forever silent unless user calls `/exclude`.

---

## Appendix B — Sample request / response payloads

### Swap handler response (extended shape)

**Before T6:**
```json
{ "success": true, "chosen_exercise_id": 412 }
```

**After T6 — no prompt:**
```json
{
  "success": true,
  "chosen_exercise_id": 412,
  "should_prompt": false,
  "swap_count": 1
}
```

**After T6 — prompt fires (count=3):**
```json
{
  "success": true,
  "chosen_exercise_id": 412,
  "should_prompt": true,
  "swap_count": 3
}
```

### `POST /api/exercises/:id/exclude`

**Request:**
```http
POST /api/exercises/279/exclude
Authorization: Bearer <jwt>
```

**Response 200 — first time:**
```json
{ "excluded": true, "already": false }
```

**Response 200 — already excluded:**
```json
{ "excluded": true, "already": true }
```

**Response 404:**
```json
{ "error": "exercise_not_found" }
```

### `POST /api/exercises/:id/keep-suggesting`

**Request:**
```http
POST /api/exercises/279/keep-suggesting
Authorization: Bearer <jwt>
```

**Response 200 — first time or transitioning from never_prompted:**
```json
{ "kept": true, "already": false }
```

**Response 200 — already in prompted_keep, or excluded (terminal, no-op):**
```json
{ "kept": true, "already": true }
```

---

**End of spec. Awaiting greenlight on Decisions 1, 2, 3, 5, 7, and the routes-filename open question (#6) before the Claude Code prompt is written.**

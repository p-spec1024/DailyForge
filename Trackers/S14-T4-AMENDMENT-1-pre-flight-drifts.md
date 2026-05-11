# S14-T4 Amendment 1 — Pre-flight drift findings & resolutions

**Date:** 2026-05-11
**Status:** Surfaced at pre-flight (gates 1–5). Architect-greenlit; build proceeds.
**Spec:** `Trackers/S14-T4-spec.md` v1.0 (LOCKED)
**Triggers:** Spec §3 halt-on-drift; build prompt §3 pre-flight halt-gate
**Author:** Claude Code (build agent)

---

## Summary

The five pre-flight halt-gates all passed for their primary check (navigation extractable, providers screen-state-clean, scaffolds composable, engine emission matches §15 mapping, Lesson #3 preserved). They also surfaced **six secondary drift findings** between the spec / build prompt and the live code/infrastructure. None are blockers; all have clean resolutions agreed with the architect at greenlight time.

This amendment is the on-disk record of the drifts and their resolutions so the spec stays clean (v1.0 = green) per principle #11 + #16.

---

## Drift inventory

| # | Drift | Spec / prompt reference | Resolution |
|---|---|---|---|
| **D1** | Provider scoping in embedded mode requires `ChangeNotifierProvider(create:…)` inside the player widget, not a top-level swap | Spec Decision #12 ("each embedded player gets its own provider instance scoped to the phase") | Build-time pattern. Embedded `StrengthPlayer` / `YogaSessionPlayer` wrap their subtree in `ChangeNotifierProvider<Provider>(create: (ctx) => Provider(ctx.read<ApiService>()))` when `isEmbedded == true`. Top-level singleton stays for standalone routes. (No spec edit.) |
| **D2** | Yoga's `POST /api/yoga/session` is a one-shot end-of-session write; in embedded mode the player must call `logSession` itself before emitting `onPhaseComplete` or no `sessions` row exists for FK update | Spec Decision #6 (one sessions row per pillar phase) | Build-time pattern. Embedded `YogaSessionPlayer` calls `session.logSession(api)` inside its completion handler, then emits `onPhaseComplete(PhaseResult{sessionId: <returned>, ...})`. The yoga endpoint returns `{id}` — captured as `sessionId` on the PhaseResult. (No spec edit.) |
| **D3** | Breathwork sessions write to the separate `breathwork_sessions` table — NOT `sessions`. The spec's cross-pillar FK ALTER on `sessions.cross_pillar_session_id` doesn't cover breath bookend phases | Spec Decision #6 + Build prompt §2 + §6 | **Dual-ALTER:** add `cross_pillar_session_id INT REFERENCES cross_pillar_sessions(id)` to BOTH `sessions` and `breathwork_sessions`. The new `POST /api/cross-pillar-sessions` endpoint takes two ID arrays: `strength_yoga_session_ids[]` (for `sessions`) and `breathwork_session_ids[]` (for `breathwork_sessions`). Transactional update fans across both tables. Architect-approved. |
| **D4** | `server/migrations/` folder doesn't exist; the project applies schema via inline string constants in `server/src/db/migrate.js` | Build prompt §2 ("File: `server/migrations/20260510_create_cross_pillar_sessions.sql`") | **Inline schema:** add `CREATE TABLE IF NOT EXISTS cross_pillar_sessions (...)` to the `schema` constant in `server/src/db/migrate.js`; add the `ALTER TABLE … ADD COLUMN IF NOT EXISTS cross_pillar_session_id ...` lines (×2 — sessions + breathwork_sessions) to the `alterations` constant; add new indexes to `indexes`. Apply via `node --env-file=.env src/db/migrate.js`. Idempotent. Architect-approved. |
| **D5** | `server/scripts/lib/smoke-fixtures.mjs` helper doesn't exist; spec and build prompt reference `withFixtureLifecycle`, `sentinelFor`, `insertSentinelRow`, `deleteBySentinel` | Spec §10 + Build prompt §6 | **Inline sentinel pattern:** match the T1 (`s14-t1-smoke-fixture`) and T3 (`s14-t3-smoke-fixture-pose`) precedent. New T4 smoke block embeds its own sentinel-tagged insert/cleanup. SIGINT/SIGTERM cleanup handlers also inline per existing T1/T3 patterns. Architect-approved. The earlier T3 block already documented this same drift (`test-suggestion-engine-t2.js` line 3038). |
| **D6** | Engine rejects `time_budget_min=45` from `entry_point=home`. Valid budgets: 30 + 60 only. Spec §11 device flow + build-prompt DoD #2 both reference 45 min | Spec §11 step 1, §10 DoD #2; Build prompt §10 | **Drop 45 from device flow.** Acceptance test boots full_body at 30 OR 60 min. Engine bracket table stays as locked in S12-T6. AMENDMENT supersedes the 45-min reference. Architect-approved. |

---

## Why each non-trivial drift is acceptable

### D3 (dual-table FK) — preserves analytics & query-ability

Decision #6's intent is per-pillar history visibility + cross-pillar grouping. Adding the FK to both tables is the minimum schema delta that keeps both views. The cross-pillar endpoint becomes:

```js
// POST /api/cross-pillar-sessions
// Body: {
//   focus_slug, started_at, completed_at, phases_completed, total_phases, end_intent,
//   strength_yoga_session_ids: number[],
//   breathwork_session_ids:    number[]
// }
// Transaction:
//   1. INSERT INTO cross_pillar_sessions (...) RETURNING id
//   2. UPDATE sessions             SET cross_pillar_session_id = $1 WHERE id = ANY($2)
//   3. UPDATE breathwork_sessions  SET cross_pillar_session_id = $1 WHERE id = ANY($3)
// Returns: { id }
```

`PhaseResult.sessionId` stays the only identity field on the result object; the orchestrator partitions results by `contentType` when collecting IDs for the endpoint call.

### D4 (inline schema) — matches existing project convention

Every migration shipped so far in this repo (S5, S6, S11, S12, S14-T1) lives inline in `migrate.js`. There is no precedent for a separate per-migration .sql file. Adding one for T4 would be inconsistent + risk requiring a new migration runner. Inline is correct.

### D5 (inline sentinel) — matches existing T1 + T3 precedent

T1's smoke block uses `notes='s14-t1-smoke-fixture'` for UPDATE-after-insert tagging on `sessions` (lines 2872–2877 of test-suggestion-engine-t2.js). T3 uses `name='s14-t3-smoke-fixture-pose'` for `exercises` rows (line 3072 of same file). T4 follows: `notes='s14-t4-smoke-fixture'` for the cross-pillar `sessions` writes + a dedicated marker for `cross_pillar_sessions` rows (e.g. `focus_slug='s14_t4_smoke_fixture'` — sentinel string the engine never produces because slug regex rejects digits → just `s14_t4_smoke`).

### D6 (drop 45) — engine bracket lock

S12-T6 locked the home-tab bracket table to (30, 60). Widening for T4 would be a separate engine ticket. The device flow's 45-min test was an architect-side carryover, not a deliberate constraint.

---

## Build-prompt diffs implied by this amendment

These are the exact prompt-text overrides. I'll honor these when writing code; the prompt itself is throwaway so no edit is shipped.

**§2 (DB migration) overrides:**
- File path: `server/src/db/migrate.js` (modify in-place, not a new .sql file).
- ALTER fans across both `sessions` AND `breathwork_sessions`.

**§4 (Orchestrator wiring) override:**
- The 3-case content_type switch is exhaustive — no `default: throw` needed in production. (Pre-flight gate 4 confirmed engine never emits another value for cross_pillar.) The build prompt's defensive `default: throw StateError(...)` stays as a guard rail.

**§5 (Provider extensions) override:**
- `PhaseResult.sessionId` is nullable. Breathwork phases populate `sessionId` from the `breathwork_sessions.id` write (semantically the breathwork session id, not a `sessions` table id). The cross-pillar endpoint payload partitions IDs by `contentType`.

**§6 (Server endpoint) override:**
- Payload shape carries TWO id arrays (see D3 resolution above).
- Smoke uses inline sentinel pattern (no `smoke-fixtures.mjs`).

**§10 (DoD) override:**
- "All 4 cross-pillar shape variants pass: full-body 30/45/60 min and biceps 30 min" → reads as "full-body 30 + 60 min and biceps 30 + 60 min".

**§11 (Device acceptance flow) override:**
- Step 1 picks full_body + 30 OR 60 min (no 45).
- Steps 14, 15, 16 (quit-intent tests) — same change applies if they reference 45.

---

## Project Instructions principle compliance

- **#11 (spec-first)** — Spec stays at v1.0 LOCKED. Amendment doc captures drifts; spec body is untouched.
- **#14 (pre-flight halt-gate)** — Five gates ran; this amendment is the artifact.
- **#15 (no `.5` suffix)** — T4 stays T4; this is an amendment, not T4.5.
- **#16 (mid-build drift → AMENDMENT)** — D1–D6 captured here, not in the spec.

---

*Authored by Claude Code on 2026-05-11 after architect greenlight. Build phases 1–7 commence immediately.*

# Sprint 16 Outline — Engine & API Hardening (Stabilization Part 2)

**Status:** Outline only. Full spec to be authored at Sprint 15 close, using S15 lessons.
**Predecessor:** Sprint 15 (Foundation).
**Successor:** Sprint 17 (Security, safety, polish).

---

## Sprint goal

Harden the public API and the engine error surface. Reduce blast radius of suggestion-engine changes. Establish meaningful test coverage now that staging DB exists.

## Theme

Hardening. Tightening the seams between modules. Test-first refactors.

## Ticket count

6 tickets, all `server/` and a small `app/` slice.

---

## Tickets

### S16-T1 — ApiService consolidation — ✅ SHIPPED 2026-05-19

Consolidate `app/lib/services/api_service.dart` into a single `_sendRaw()` core. Unified handling of timeout, 401 logout, JSON parsing, network exception wrapping. `get`/`getList`/`post`/`put`/`delete` become thin wrappers. Resolves `getList()` divergence ChatGPT flagged in §5.2. Touches every Flutter service that uses ApiService — incidental verification across the app.

**Open question resolved:** `getList` stays as a thin wrapper, not folded into `get<T>()`. Pre-flight enumerated 58 call sites total (3 `getList` + 31 `get` + 13 `post` + 7 `put` + 4 `delete`); folding would require touching all 34 `get`/`getList` sites to add type parameters for zero behavioral gain. See `Trackers/S16-T1-consumers.md`. Feat `a9b314c`.

### S16-T2 — Typed engine errors — ✅ SHIPPED 2026-05-19

`RangeError` substring matching in `server/src/routes/sessions.js` replaced with `EngineContractError({ code, message, details })` thrown from the engine. Route catch is a single `instanceof EngineContractError` branch that emits `{ error: err.message, code: err.code, details: err.details }` with HTTP 400. Response shape is additive — `error` field byte-identical to legacy lowercase code for old-APK backward compat; `code` (SCREAMING_SNAKE_CASE) + `details` are new. Flutter `ApiException` carries nullable `code`; `_mapApiException` switches on it with legacy substring fallback. Sentry `beforeSend` tags `engine_code` + `http_status` for filterable observability. 4 wire codes (INVALID_BRACKET, INVALID_FOCUS_ENTRY_COMBO, INVALID_TIME_BUDGET, STATE_FOCUS_REQUIRES_BRACKET) from 10 throw sites. Resolves ChatGPT review §3.3 / FS #166. Smoke `71 / 0`. Feat `89b3e06` + chore (this).

### S16-T2c — Unified sessions VIEW — ✅ SHIPPED 2026-05-20

Postgres VIEW `v_completed_sessions` UNIONs `sessions` (filter `completed = true`) and `breathwork_sessions` (filter `completed = true`) with normalized columns (`row_id`, `user_id`, `pillar`, `completed_at`, `started_at`, `duration_min`, `focus_slug`, `multi_phase_session_id`, `completed_date`). 4 home endpoints migrated to query the VIEW instead of per-table UNION ALLs: `/api/home/stats` (6→1), `/weekly-activity` (2→1), `/daily-load` (2→1), `/daily-counts` (2→1 with multi-phase dedupe). Response shapes byte-identical to pre-migration snapshots (captured at `b6aaf06`). Drive-by fix: line 363 of `migrate.js` had unescaped backticks in a SQL comment that prematurely closed the schema template literal — pre-existing parse error blocking `node src/db/migrate.js`; escaped, file now runs cleanly + idempotently. Resolves ChatGPT review §10 P5 / F7 / finding #50. Closes FS #212 + FS #260. Smoke `23 / 0`. Feat `6a6f53e` + chore (this).

### S16-T2b — Endpoint-aware timeouts — ✅ SHIPPED 2026-05-21

`ApiConfig.timeoutFor(path)` returns 35s for `/sessions/suggest` and `/sessions/start-from-list`; 20s default elsewhere (bumped from a flat 15s). Override map keys reference path constants directly so any rename fails the build — slowness is opt-in, compile-time-checked. `_sendRaw` reads the policy per request; old `_kRequestTimeout` constant deleted. User-facing timeout copy ("DailyForge took too long to respond. Please try again.") differentiated from network copy ("Check your connection and try again.") at the service layer — `TimeoutError` class in `suggest_service.dart` + `.timeout()` factory in `focus_duration_service.dart` (HTTP-layer `TimeoutApiException` keeps the technical message for logs/Sentry). Sentry `beforeSend` tags timeout events with `timeout_seconds` + `endpoint_path` alongside the existing `http_status`. Resolves ChatGPT review §5.3 / rows #31 + #32. Closes FS #209. Smoke `5 / 0`. Feat `3d1aecb` + chore (this).

### S16-T3 — Test coverage expansion (9 high-value tests)

Add the 9 tests ChatGPT identified in §5.6:
1. `ApiConfig` URL joining cannot double `/api`
2. `ApiService` 401 clears token and calls unauthorized callback
3. `SuggestProvider` discards late response after focus changes
4. `MultiPhaseSessionProvider` state transitions (pause/resume/skip/end/complete)
5. `SessionLauncher` routes correctly by `session_shape`
6. Auth integer-id rejection (depends on S15-T6)
7. Engine error code mapping stability (depends on S16-T2)
8. Multi-phase route transaction rollback on second-update failure
9. Bonus integration test: `/api/sessions/suggest` → save → retrieve round trip on staging

Now possible because staging DB exists (S15-T1). Per PI #12, this is NOT a data-population ticket — `/review` applies.

### S16-T4 — Large file split: `server/src/routes/session.js` (933 LOC)

Split into multiple route files by concern: legacy session endpoints, multi-phase session endpoints, session retrieval. Behavior-preserving — pure file reorganization. Per ChatGPT §5.1.

### S16-T5 — Large file split: `app/lib/pages/session/multi_phase_session_page.dart` (716 LOC)

Split into: host chrome (Scaffold + AppBar), player resolver (which embeddable player for which phase), dialogs (quit confirm, complete confirm), summary navigation. Per ChatGPT §5.1.

### S16-T6 — Large file split: `app/lib/providers/workout_session_provider.dart` (784 LOC)

Split into: session state machine, set logging, routine handling. Behavior-preserving. Per ChatGPT §5.1.

---

## Out of scope for S16

- Engine new features (still on hold)
- UI redesign (S18)
- Security hygiene (S17)
- Breathwork safety (S17)
- Cross-pillar 4-phase fallback FS #198 (S17)

---

## Risks

- **S16-T1** touches every Flutter service. High blast radius if `ApiService` semantics change unintentionally. Mandatory pre-flight to enumerate every consumer.
- **S16-T2** requires S15-T4 to have shipped cleanly. If S15-T4 needed a T4.5 follow-up, S16-T2 timing slips.
- **S16-T3** test fixtures must use sentinel pattern (PI #17). Without that, tests pollute staging.

---

## Open questions

- ~~Should `ApiService.getList()` actually remain or fold entirely into `get()` with type signatures? Defer to spec authoring.~~ **Resolved at S16-T1 spec time, confirmed by 58-call-site inventory:** `getList` stays as a thin wrapper. See S16-T1 ticket entry above.
- Are there latent endpoints in `routes/session.js` worth deleting during the split, vs. preserving? Defer to pre-flight audit.

---

## When to write the full spec

After Sprint 15 close, re-read this outline, factor in:
- Any S15-T4 `.5`-follow-up learnings
- Any S15-T1 environment learnings
- Any S15-T6 auth audit learnings

Then author `SPRINT_16_PLAN.md` with full pre-flight, acceptance criteria, build steps, test plans per ticket.

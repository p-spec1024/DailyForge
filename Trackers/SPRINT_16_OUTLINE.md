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

### S16-T2 — Typed engine errors + endpoint-aware timeouts

Replace `RangeError` substring matching in `server/src/routes/sessions.js` with `EngineContractError({ code, message, detail })` instances thrown from the engine. Route mapper becomes `if (err instanceof EngineContractError) return res.status(400).json({ error: err.code })`. Pairs with timeout work: `defaultTimeout = 20s`, `engineTimeout = 35s` for `/sessions/suggest` and engine-heavy routes. Updates timeout copy from "Check your connection" to "DailyForge took too long to respond. Please try again." Depends on S15-T4 having extracted the `errors.js` shell.

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

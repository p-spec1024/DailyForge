# Sprint 17 Outline — Security, Safety, Polish (Stabilization Part 3)

**Status:** Outline only. Full spec to be authored at Sprint 16 close.
**Predecessor:** Sprint 16 (Engine & API hardening).
**Successor:** Sprint 18 (UI redesign).

---

## Sprint goal

Final stabilization before broader invite beta. Security hygiene, safety baseline, last large-file splits, and the substitution-ladder feature that's been waiting.

## Theme

Last mile before signups open beyond 10-20 trusted users.

## Ticket count

6 tickets.

---

## Tickets

### S17-T1 — Security hygiene bundle

Three security items, one ticket since they're all small and share a pattern:
1. CORS allowlist — replace `cors({ origin: true })` with env-driven allowlist (`CORS_ORIGINS` env var, mobile/native requests still allowed via no-origin check). Per ChatGPT §3.6.
2. Remove dev media endpoint from production — guard `POST /api/media/test-upload` behind `NODE_ENV !== 'production'` or remove entirely. Per ChatGPT §5.5.
3. Rate limiting on `/api/sessions/suggest` — engine route is high-cost; add per-user rate limit (e.g., 30 req/min). Per ChatGPT §8.2. Extend the existing auth-rate-limiter pattern.

### S17-T2 — Breathwork safety pack

ChatGPT §8.4 minimum bar for invite beta. Five components:
1. Onboarding disclaimer screen — first-launch acknowledgement.
2. Per-technique safety warnings — every yellow/red technique shows safety notes before start.
3. User acknowledgement gate — high-intensity techniques (red) require explicit "I understand the risks" tap before first use.
4. "Stop immediately if dizzy/unwell" copy — surfaced in active breathwork player UI.
5. Avoid medical claims — content audit pass to remove anything that reads as therapeutic claim.

Touches `app/`. Some content authoring required (founder).

### S17-T3 — FS #198 cross-pillar 4-phase substitution ladder

Implement the engine substitution ladder for cross-pillar sessions when a phase emits zero items. Currently `biceps` emits only 4 phases and yoga cooldown pool can be empty. The ladder picks next-best filler from a defined priority order. Per ChatGPT §6 P1 and the original FS #198. Now safer to ship because engine extraction (S15-T4) modularized the picker logic.

### S17-T4 — Large file split: `app/lib/widgets/sheets/half_pie_picker_sheet.dart` (750 LOC)

Split into: rendering (the visual half-pie), option calculation (which focuses are available + their states), interaction state (selection, drag, animation). Per ChatGPT §5.1.

### S17-T5 — Large file split: `app/lib/players/breathwork_player.dart` (713 LOC)

Split into: pre-start (setup, technique selection), active timer (the core breathwork loop), embedded completion (when running inside multi-phase session). Per ChatGPT §5.1.

### S17-T6 — Large file splits: yoga and strength players

Split `app/lib/players/yoga_session_player.dart` (611 LOC) into timer/pose-display/completion. Split `app/lib/players/strength_player.dart` (591 LOC) into embedded setup/set list/completion. Two files, one ticket since the patterns are similar. Per ChatGPT §5.1.

---

## Out of scope for S17

- UI redesign (S18)
- Onboarding flow (S19+)
- Weekly plan + session composer (S19+)
- 5-phase session mode (S19+)
- Google Play submission (S20+)
- Professional breathwork warning review (F5 — public/paid launch gate)

---

## Risks

- **S17-T2** depends on having a working onboarding screen. If onboarding hasn't started by S17, this becomes "build minimal onboarding to host the disclaimer." Scope may grow.
- **S17-T3** depends on S15-T4 engine extraction having shipped cleanly. The ladder logic plugs into the modular pickers.
- **S17-T1** CORS tightening could break Flutter dev hot reload if not careful. Test on physical Android during build.

---

## Sprint close criteria summary

After S17 ships, the app should be:
- **Safe to open to 20-50 invite-only users** without significant infrastructure risk.
- **Free of "developer-only" exposure** (test endpoints, permissive CORS).
- **Production-observable** (Sentry catching real bugs).
- **Engine-extensible** (ready for equipment/injury/contraindication work).
- **Testable** (CI + staging DB + test coverage baseline).

S18 onward is **UI polish + product features**, not infrastructure.

---

## When to write the full spec

After Sprint 16 close, re-read this outline, factor in:
- Onboarding state at that time (S17-T2 dependency)
- Any engine extraction debt remaining
- Any user feedback from S15-S16 invite beta if you've opened it

Then author `SPRINT_17_PLAN.md`.

# S14-T6 — AMENDMENT-1

**Date:** May 12, 2026
**Trigger:** Pre-flight diagnostic (Claude Code, May 12) surfaced two spec-vs-reality drifts and one semantics shift that needs codifying.
**Status:** LOCKED
**Original spec:** `Trackers/S14-T6-spec.md` v1 (stays as v1 — this amendment is the canonical contract going forward)

---

## 1. What this amendment changes

Three corrections to S14-T6 v1, all surfaced by pre-flight before code was written:

| # | Topic | v1 spec said | Reality is | Amendment |
|---|---|---|---|---|
| 1 | Yoga `metadata.source` emission | Engine already emits it; UI just reads it | Engine emits zero `source` keys across all 8 metadata sites. Engine does not currently commit to one yoga style per session — main-phase pool spans all 5 styles freely | Engine adds **pre-pick style filter** (Decision A below) and emits `metadata.source` deterministically |
| 2 | Yoga swap fallback location | Server-side fallback in `server/src/routes/yoga.js` swap handler | Yoga swap endpoint `/alternatives` receives `practiceType` as a **client-supplied query param**. Server has no session context at swap time. | Three-tier fallback lives **client-side** in the Flutter yoga caller — computes `sessionStyle` and passes it as `practiceType` query param |
| 3 | Breathwork cap timing | "Complete current cycle and stop" (semantically unclear) | Existing `_advancePhase` (L248) end-of-round branch is the clean injection point; check fires **after** a cycle completes | Cap semantics: **"always ≥ engine budget, never <"** — the player finishes whichever cycle is in progress when budget is reached, then stops |

---

## 2. Decision A — Engine pre-pick yoga style filter

**Locked approach: (b) Pre-pick filter** from pre-flight Q1.

**Why this and not the alternatives:**

- **(a) Post-pick modal style** — picks poses freely from all styles, then derives `metadata.source` from whichever style had the most poses. Creates cosmetic ties ("2 vinyasa + 2 hatha — which is it?"). Rejected.
- **(c) Deterministic `'vinyasa'` default** — always emit `'vinyasa'` regardless of what was picked. Cheapest, but lies about the session content. Rejected.
- **(b) Pre-pick filter** — engine commits to one style up front based on level, filters main-phase pool to that style. Coherent end-to-end. Honest. Feeds future personalization ("I prefer yin in the evening") cleanly. Matches industry pattern (Down Dog, Glo).

**Style selection rule (level-based):**

| User yoga level | Picked style | Rationale |
|---|---|---|
| `beginner` | `hatha` | Slower pace, longer holds, accessible breath cues |
| `intermediate` | `vinyasa` | Flow-based, breath-linked movement |
| `advanced` | `vinyasa` | Same flow base; advanced poses ride on top |

**Why not yin/restorative/power at this stage:**
- `yin` and `restorative` are state-focus styles (calm/recover/sleep), not body-focus. State-focus yoga sessions don't exist in v1 — state focus uses breathwork. Defer to a future ticket if state-focus yoga lands.
- `power` is too narrow for cold-start defaults. Surface via user preference in a future personalization ticket.

**Engine implementation site:** `server/src/services/suggestionEngine.js` — pillar-pure yoga main-phase pool query (around line 713–726 per PF3 grep). Before SELECTing eligible poses, resolve `selectedStyle` from the level-based table, then filter the WHERE clause to that style.

**Metadata emission:**
```jsonc
"metadata": {
  "estimated_total_min": INT,
  "user_levels": {...},
  "source": "hatha" | "vinyasa"   // NEW — always emitted for pillar-pure yoga
}
```

Cross-pillar sessions: yoga warmup + cooldown phases inherit the same style logic. Engine emits one `metadata.source` per session, scoped to the yoga phases.

**Smoke addition (replaces the §6.6 smoke in spec):**
- For each level (beginner/intermediate/advanced), generate a pillar-pure yoga session.
- Assert `metadata.source` is the expected level-mapped style.
- Assert all picked poses' `practice_type` matches `metadata.source` (no cross-style bleed).

---

## 3. Decision B — Client-side yoga swap 3-tier fallback

**Locked location: client-side.** Server-side fallback in `yoga.js` is removed from scope.

**Why:**

Pre-flight surfaced that the existing yoga swap endpoint receives `practiceType` as a **query param from the Flutter client**:

```
GET /api/yoga/alternatives?practiceType=vinyasa&...
```

Server has no session context at swap time — it just answers "give me 3 alternative poses in this style." The intelligence about *which style this session is* lives on the client side, which already holds the session object.

**Flutter implementation:**

In the yoga page caller (likely `app/lib/pages/yoga/yoga_player_page.dart` or the swap trigger inside `MultiPhaseSessionPage` for cross-pillar yoga phases), compute `sessionStyle` before calling `/alternatives`:

```dart
// 3-tier fallback for yoga style
String resolveSessionStyle(YogaSession session) {
  return session.metadata?.source        // engine-emitted (Decision A)
      ?? session.yogaStyle                // stored on the session object
      ?? 'vinyasa';                       // hard fallback (Decision #10 from spec)
}

// Use in swap call
final alternatives = await yogaApi.fetchAlternatives(
  practiceType: resolveSessionStyle(currentSession),
  // ... other params
);
```

**Server-side `yoga.js` swap handler:** unchanged. Continues to accept `practiceType` as a query param. No server work in this amendment.

**Smoke coverage:** the new pre-pick filter smoke (Decision A) covers engine emission. Client-side fallback chain has no equivalent smoke (it's pure client logic) — covered by unit tests added to the yoga adapter tests (FS #204):

- Add 1 test case: `resolveSessionStyle` returns `metadata.source` when present
- Add 1 test case: returns `yogaStyle` when `metadata.source` is null
- Add 1 test case: returns `'vinyasa'` when both are null

This bumps FS #204 from 12 test cases to 15.

---

## 4. Decision C — Breathwork cap semantics: "always ≥ engine budget, never <"

**Locked behavior: cap fires at end-of-round, not mid-cycle.**

**Concrete example:**
- Engine budget: 3 minutes (180 seconds)
- Box breathing cycle: 16 seconds (4-4-4-4)
- After 11 cycles: 176 seconds elapsed
- 12th cycle starts at 176s, completes at 192s
- Player stops at 192s — 12 seconds longer than engine budget

**Why this is acceptable:**

1. **Cycle integrity is the UX contract.** Cutting mid-inhale or mid-hold feels jarring and broken. Users perceive partial cycles as a bug.
2. **Engine budget is a target, not a hard ceiling.** Bookends running 10–15s long doesn't break downstream phases.
3. **Predictable semantics.** "Always ≥ budget" is easy to reason about in tests and in future maintenance. The alternative ("sometimes under, sometimes over depending on cycle length") would be harder to verify.

**Implementation site:** `BreathworkTimerProvider._advancePhase` at the end-of-round branch (~L248 per PF2 finding). Before triggering the next cycle, check:

```dart
if (_mode == BreathworkMode.capped &&
    _elapsed >= _maxDuration!) {
  _onComplete?.call();
  _resetState();
  return;
}
// otherwise proceed to next cycle
```

**Unit test update (spec §6.5 test 1):**

The original test said:
> `startCapped` with 30s cap on a 10s-per-cycle technique → runs 3 cycles, stops at ~30s.

Update to reflect locked semantics:
> `startCapped` with 30s cap on a 10s-per-cycle technique → runs 3 cycles, stops at ~30s (cycle boundary, may overshoot by < cycle length).

Original test 2 stays as-is (5s cap on 10s cycle → runs 1 cycle, stops at ~10s).

Add a new test case (Test 6 — replaces empty slot):
> `startCapped` with 25s cap on a 10s-per-cycle technique → runs 3 cycles, stops at ~30s (overshoot of 5s — verify behavior is "complete the in-progress cycle", not "cancel it").

---

## 5. Touch list adjustments to spec §7

### Added to spec §7

**Modified (new entry):**
- `server/src/services/suggestionEngine.js` — implement pre-pick style filter in pillar-pure yoga path (Decision A), emit `metadata.source`

**Smoke harness:**
- New sub-block: engine yoga style emission (3 cases × level)

### Removed from spec §7

- `server/src/routes/yoga.js` — three-tier style fallback removed (was Decision B's original location). The route file is **not modified** by T6.

### Modified inside FS #204 (spec §6.9)

Test count: 12 → 15 (3 new tests for client-side `resolveSessionStyle` fallback chain).

---

## 6. Spec sections superseded

The following spec sections are now read through the lens of this amendment:

- **§6.5 (Breathwork duration cap)** — cap semantics locked per Decision C. Test wording updated.
- **§6.6 (Yoga swap-from-engine fix)** — relocated client-side per Decision B. Engine-side amendment (Decision A) now lives in §6.7 territory (engine work).
- **§6.7 (FS #198 substitution ladder)** — unchanged; engine pre-pick filter is independent.
- **§6.9 (FS #204 unit tests)** — test count 12 → 15.

The base spec (§1–§5, §8–§12) is unchanged.

---

## 7. What this amendment retires when

This amendment retires when:

- A future ticket introduces user-driven yoga style preference (Sprint 15+ personalization), at which point Decision A's level→style mapping table is superseded by user-pref lookup.
- Decisions B and C are permanent contracts going forward.

---

## End of S14-T6 AMENDMENT-1

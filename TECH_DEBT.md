# DailyForge — Tech Debt & Known Gaps

Tracks anything that was **specced in the Blueprint but not yet built**, deferred schema work, implementation shortcuts, and things Claude Code flagged during builds.

Different from FUTURE_SCOPE.md — that file is for *new* features not in the current plan. This file is for gaps in what's *already planned*.

---

## Open Items

| # | Area | Gap | Discovered | Sprint | Notes |
|---|---|---|---|---|---|
| 1 | Breathwork | No `breathwork_techniques` table in DB | Apr 7, 2026 | S2-T1 | Breathwork exists as rows in `exercises` table only. Dedicated table needed for phase timing (`inhale/hold/exhale` durations), tradition, purpose, safety notes, difficulty. Blueprint schema has this as a first-class table. Blocker for breathwork timer screen. |

---

## Resolved Items

| # | Area | Gap | Resolved | Sprint | How it was fixed |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

---

## How This File Works

- **PM (Claude.ai)** adds entries when gaps are discovered during planning or when Claude Code flags something during a build
- **Claude Code** adds entries when it encounters a spec vs. implementation mismatch
- Items move to **Resolved** when the fix is shipped and merged
- Each item should reference the Blueprint section it came from so nothing gets forgotten

---

## Reference — Blueprint v4 `breathwork_techniques` schema

```
breathwork_techniques:
  id, name, tradition, purpose, protocol_json, safety_notes, difficulty
```

`protocol_json` stores phase timing, e.g.:
```json
{
  "phases": [
    { "type": "inhale", "duration": 4 },
    { "type": "hold", "duration": 7 },
    { "type": "exhale", "duration": 8 }
  ],
  "rounds": 5,
  "total_duration": 300
}
```

Fix ticket when ready: `db/breathwork-schema` — create table + seed all 52 techniques with timing data.

# S15-T6-AMENDMENT-1 — pre-flight findings

**Date:** May 17, 2026
**Spec amended:** `S15-T6-spec.md` (server test infrastructure)
**Trigger:** Claude Code pre-flight, May 17, 2026 — three drifts surfaced between spec assumptions and live repo state.
**Status:** Locked at greenlight, ready for build resume.

> Per PI #16: when pre-flight surfaces spec-vs-data drift mid-build, write an `AMENDMENT-N` doc rather than patching the spec in place. Original spec stays clean as v1; amendment is the canonical contract for the build.

---

## Drift log

| # | Spec said | Live reality | Resolution |
|---|-----------|--------------|------------|
| 1 | `server/test/helpers/db-sentinel.js` re-exports six helpers from `server/scripts/lib/smoke-fixtures.mjs` (§3.2, §3.7) | `server/scripts/lib/smoke-fixtures.mjs` does not exist. The sentinel pattern lives inline inside `server/scripts/test-suggestion-engine-t2.js`; was never extracted into a shared module. | **Drop §3.7 from T6 scope.** No DB helper in this ticket. The 3 smoke tests (§3.4) don't write to DB; S15-T7 (auth) doesn't write to DB either. When a future ticket actually writes to DB in tests, that ticket either extracts the sentinel pattern OR builds the helper directly. Premature here. |
| 2 | JWT mint helper imports `config` from `'../../src/config.js'` (§3.5) | Config lives at `server/src/config/env.js`. The export shape is `{ secret: process.env.JWT_SECRET, ... }` at `server/src/config/env.js:17`. | **Fix the import path.** `import { config } from '../../src/config/env.js';` — everything else in §3.5 holds. |
| 3 | Spec mentions "Node 20+" runtime (§3.1, §3.4) | CI uses Node 24 (`.github/workflows/checks.yml`). `node:test` is GA from Node 20 onward, so 24 is fine. Spec is editorially stale, not technically wrong. | **Editorial nudge.** §3.1 should read "Node's built-in `node:test` module (Node 20+; CI uses 24)" — or drop the version mention entirely. No code change. |

---

## Effective contract for the build

The build proceeds against `S15-T6-spec.md` v1 **with the following overrides** from this amendment:

### Override 1 — §3.2 directory layout

Strike `test/helpers/db-sentinel.js` from the file list. Effective layout:

```
server/
├── package.json
├── test/
│   ├── README.md
│   ├── helpers/
│   │   ├── app-factory.js
│   │   └── jwt-mint.js
│   └── smoke.test.js
```

### Override 2 — §3.7 deletion

§3.7 ("DB sentinel helper") is **removed from T6 scope** in its entirety. No file `db-sentinel.js` is created. No re-export from `smoke-fixtures.mjs` happens.

### Override 3 — §3.5 import path

The JWT mint helper at `server/test/helpers/jwt-mint.js` imports `config` from the correct path:

```js
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env.js';

export function mintTestJwt(payload = {}) {
  const finalPayload = { id: 1, email: 'test@dailyforge.local', ...payload };
  return jwt.sign(finalPayload, config.jwt.secret, { expiresIn: '1h' });
}

export function bearerHeader(payload = {}) {
  return `Bearer ${mintTestJwt(payload)}`;
}
```

Everything else in §3.5 holds — function shape, default payload, sign options.

### Override 4 — §3.1 wording (editorial)

When updating spec wording at post-ship time (NOT now — don't touch the spec mid-build), change "Node 20+" to "Node 20+ (CI uses 24)". For the actual build, no code change is gated by this; ignore.

### Override 5 — §3.9 README

Drop the line "Fixtures use sentinels (see PI #17). Never `DELETE WHERE user_id = ...`." from the README content. With §3.7 dropped, T6 has no fixture story to document. Whoever lands the first DB-touching test adds that section to the README at that time.

The rest of the README content in §3.9 stands.

---

## Out-of-scope follow-ups (do NOT do in T6)

These were considered and explicitly deferred:

- **Extract sentinel pattern from `test-suggestion-engine-t2.js` into a shared module.** Real refactor of a 4000-line smoke script. Probably FS #217 / #218 territory. When the first DB-touching test is needed, decide then.
- **Rename `config.js` references everywhere.** Out of scope for T6. The spec drift is documented above; not a code cleanup.
- **Update spec v1 in place.** PI #16 says amendments, not in-place patches. Spec v1 stays clean; this amendment is the contract.

---

## Build resumption checklist

After this amendment is committed alongside the T6 ticket commit:

- [x] Drop `test/helpers/db-sentinel.js` from §3.2 and §3.7.
- [x] Apply correct import path in `test/helpers/jwt-mint.js` per Override 3.
- [x] Drop the sentinel line from `test/README.md`.
- [ ] Pre-flight items (a) through (f) have all been resolved or noted in this amendment. Resume build at §5 step 2 (install supertest).
- [ ] All other §3 acceptance criteria remain in force as written in spec v1.

---

## Cross-references

- `S15-T6-spec.md` — original spec, v1.
- `S15-T6-prompt.md` — Claude Code prompt (throwaway).
- PI #16 — amendment-doc pattern.

This amendment is committed to `Trackers/` as part of the T6 ticket commit (not the chore commit), making it permanent build artifact.

---

*Authored May 17, 2026 in response to Claude Code pre-flight on T6 build. Greenlit by Prashob.*

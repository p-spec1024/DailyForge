# FS-#261 — Schema Audit: Staging vs `migrate.js`

**Ticket type:** Process audit. Behavior-preserving on the wire and at runtime. May produce schema-backfill changes to `migrate.js`.
**Branch:** `audit-fs261-schema-vs-staging` (off `main`, NOT sprint-chained).
**PR:** Separate PR off main. Not part of PR #4 (s16-t1 chain).
**Priority:** Process risk. Not blocking, but enterprise audit discipline says it gets done before any new environment needs a fresh DB seed.
**Estimated time:** Half day (Outcome A — clean audit) to 1.5 days (Outcome B — drift found, backfill required).

**Touches:**
- Possibly `server/scripts/migrate.js` (only if drift is found — backfill blocks added with proper idempotency)
- `Trackers/S16-FS261-schema-audit-2026-05-21.md` (NEW — committed artifact of the audit findings)
- `Trackers/FUTURE_SCOPE.md` (close FS #261, possibly add follow-up FS for CI gate)
- `Trackers/PRE_SPRINT_11_PLANNING.md` or equivalent dev-process doc (NEW section: "Schema changes go through migrate.js")
- `docs/ARCHITECTURE.md` (audit-point timestamp note in the database section)

---

## Source

FS #261 (added in S16-T2c chore commit `b443b2c`, May 20, 2026):

> Audit how schema changes have hit staging since migrate.js parse error landed (last working SHA ≤ 3dcd09d, May 2026). Context: migrate.js has been parse-broken since ≤3dcd09d but staging schema appears current. This means schema changes have been applied via raw psql or other out-of-band means, bypassing the canonical migration script's idempotency guarantees and prod-mutation guards. Severity: medium — not blocking, but real process risk before any environment needs a fresh DB seed.

S16-T2c fixed the parse error. This ticket answers: **"What schema changes hit staging while `migrate.js` was unrunnable, and are they captured anywhere?"**

---

## Why this matters for enterprise

DailyForge is targeting Play Store and (later) App Store distribution. That implies multiple environments over the product's lifecycle:

- **Production** (current, 5 users on Neon `production` branch)
- **Staging** (current, Neon `staging` branch)
- **Beta / pre-prod** (future, when public beta starts)
- **Dev sandboxes** (future, for any new contractors / Claude Code sessions that need isolated DBs)
- **CI ephemeral DBs** (future, for automated test runs)

Every one of those environments will be spun up by running `migrate.js` against a fresh Neon branch. If `migrate.js` is missing schema that exists in production today, **every new environment will silently be broken**. The app might start, but specific queries against missing columns/tables will fail at runtime.

This audit establishes the canonical truth: **does `migrate.js` produce a schema identical to staging?** If yes, we lock down the discipline. If no, we backfill the gaps now while we know about them.

---

## Outcome scenarios

**Outcome A (most likely): clean audit.**

`migrate.js` against a fresh Neon branch produces a schema identical to staging (modulo seeded data). No backfill needed. We commit the audit artifact, document the discipline going forward, and close FS #261. ~30-60 min.

**Outcome B (possible): drift found.**

The diff surfaces tables/columns/indexes/functions/triggers in staging that aren't in `migrate.js`. For each drift item, decide:
- (i) Is it intentional and needs to be backfilled into `migrate.js`? Add an idempotent `DO $migrate_<name>$ ... END` block.
- (ii) Is it accidental (e.g. a developer ran an experimental ALTER and forgot to clean up)? Document, decide whether to remove from staging or fold into migrate.js.
- (iii) Is it test/scratch data that shouldn't be in any environment? Clean up staging.

Backfill changes are committed to `migrate.js`, then re-verified by re-running the audit. Loop until clean. ~1-1.5 days.

---

## Pre-flight diagnostics

Standard PI #14 halt-on-drift. Sub-steps:

### (a) Verify migrate.js currently parses and runs

Confirm S16-T2c's parse fix at `6a6f53e` is still intact:

```bash
cd D:\projects\dailyforge\server
node --check src/db/migrate.js
```

Must exit 0. If syntax errors surface, halt — the parse fix has regressed and that's a separate ticket.

Then verify `npm run db:migrate` against staging completes cleanly (idempotent — already-applied changes should no-op):

```bash
npm run db:migrate
```

If `migrate.js` errors mid-run, halt. The audit assumes a fully-working migrate.js as the canonical source.

### (b) Neon branch creation procedure

Confirm Neon CLI access and the procedure for creating an audit branch. The audit branch's name should be `s16-fs261-audit-2026-05-21` (or whatever the current date is at audit time).

Source the branch from:
- **`production`** if we want to audit against what real users have. Risk: this includes all 5 production users' data, which may have privacy implications during diff.
- **An empty default branch** if we want to audit purely against `migrate.js`'s output, no data interference.

Recommendation: source from an **empty default** (no data, just schema). This makes the diff purely about schema, not data.

Steps:
1. Create branch: `neonctl branches create --name s16-fs261-audit-2026-05-21`
2. Note its `DATABASE_URL`.
3. Run `migrate.js` against it with that DATABASE_URL.

Document the exact CLI invocations in the build report.

### (c) Pg_dump availability and version match

`pg_dump` must be installed locally and its major version must match Neon's Postgres version. Mismatched versions produce confusing diff noise.

```bash
pg_dump --version
```

If Neon is on Postgres 16 and local `pg_dump` is 15, install the matching version OR run `pg_dump` from a Docker container with the right version. Document the version used in the audit artifact.

### (d) Seed-data invariant inventory

The audit checks not just schema but seed-data invariants. Confirm the expected counts:
- `focus_areas`: exactly 17 rows (12 body + 5 state)
- `breathwork_techniques`: exactly 49 rows
- `focus_muscle_keywords`: 35 rows
- `focus_compatibility_mappings`: 54 rows
- `focus_overlaps`: 12 rows

These come from `migrate.js`'s seed inserts. Cross-reference against `migrate.js` to confirm the seed counts are deterministic (i.e. `migrate.js` always produces exactly N rows).

If any seed insert is not idempotent (e.g. `INSERT ... ON CONFLICT DO NOTHING` is missing), flag — that's a separate hygiene issue.

### Pre-flight greenlight

One-paragraph summary, standard format.

---

## The audit procedure

### Step 1: Create audit branch

```bash
neonctl branches create --name s16-fs261-audit-2026-05-21
```

Note the connection string. Set as environment variable for subsequent steps:

```bash
AUDIT_DATABASE_URL="<neon connection string>"
```

### Step 2: Run migrate.js against the audit branch

```bash
DATABASE_URL=$AUDIT_DATABASE_URL node src/db/migrate.js
```

Confirm output indicates "Migrations complete" and no errors.

### Step 3: Dump audit branch schema

```bash
pg_dump $AUDIT_DATABASE_URL --schema-only --no-owner --no-acl > /tmp/audit-schema.sql
```

Flags explained:
- `--schema-only`: structure, not data
- `--no-owner`: strip owner clauses (Neon role names differ between branches)
- `--no-acl`: strip GRANT/REVOKE statements (Neon adds default permissions per branch)

### Step 4: Dump staging schema

```bash
STAGING_DATABASE_URL="<staging connection string>"
pg_dump $STAGING_DATABASE_URL --schema-only --no-owner --no-acl > /tmp/staging-schema.sql
```

### Step 5: Diff

```bash
diff -u /tmp/audit-schema.sql /tmp/staging-schema.sql > /tmp/schema-diff.patch
```

If empty: **Outcome A**. Skip to Step 9.

If non-empty: **Outcome B**. Continue.

### Step 6: Classify each drift item

For each block in `schema-diff.patch`, classify:

| Drift type | Action |
|---|---|
| Column added in staging, not in `migrate.js` | Backfill `migrate.js` with idempotent ALTER |
| Index added in staging, not in `migrate.js` | Backfill `migrate.js` with idempotent CREATE INDEX |
| Function body different | Investigate — may need to update `migrate.js`'s function definition |
| VIEW different | Update `migrate.js`'s CREATE OR REPLACE VIEW block |
| Constraint added/removed | Backfill or document why |
| Extra table in staging | Likely scratch — discuss with Prashob, may need cleanup or backfill |
| Extra column in audit branch but not staging | `migrate.js` has dead code — discuss whether to remove |

Document every drift item in the audit artifact, including the resolution decision.

### Step 7: Backfill (if needed)

For each "backfill into migrate.js" item, add a properly-idempotent block. Example pattern (matching the existing migrate.js style):

```js
await query(`
  DO $migrate_add_focus_slug_to_sessions$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'focus_slug'
    ) THEN
      ALTER TABLE sessions ADD COLUMN focus_slug TEXT;
    END IF;
  END $migrate_add_focus_slug_to_sessions$;
`);
```

Each backfill block:
- Named uniquely (matches the migrate.js convention)
- Idempotent (checks `information_schema` or `pg_indexes` before applying)
- Commented inline: `// Backfilled from staging in FS #261 audit, 2026-05-21`

### Step 8: Re-run audit

Delete the audit branch, recreate, re-run steps 2-5. Diff must now be empty.

If diff is still non-empty, the backfill missed something. Loop.

### Step 9: Seed-data invariant check

Against staging:

```sql
SELECT 'focus_areas' AS table, COUNT(*) FROM focus_areas
UNION ALL SELECT 'breathwork_techniques', COUNT(*) FROM breathwork_techniques
UNION ALL SELECT 'focus_muscle_keywords', COUNT(*) FROM focus_muscle_keywords
UNION ALL SELECT 'focus_compatibility_mappings', COUNT(*) FROM focus_compatibility_mappings
UNION ALL SELECT 'focus_overlaps', COUNT(*) FROM focus_overlaps;
```

Compare against the expected counts from pre-flight (d). If staging deviates from `migrate.js`'s seed output:
- Either staging has been manually edited (decide whether to revert or fold into seed)
- Or migrate.js's seed inserts aren't deterministic (separate hygiene issue, flag)

### Step 10: Commit the audit artifact

Write `Trackers/S16-FS261-schema-audit-2026-05-21.md`:

```markdown
# Schema Audit — Staging vs migrate.js

**Date:** 2026-05-21
**Auditor:** Claude Code session
**migrate.js SHA at audit time:** <git rev-parse HEAD:server/scripts/migrate.js>
**Staging branch:** Neon `staging`
**Audit branch:** Neon `s16-fs261-audit-2026-05-21` (deleted post-audit)
**pg_dump version:** <version>
**Postgres version:** <version>

## Outcome

[ A / B ] — [one sentence summary]

## Schema diff

[Paste the diff. If empty: "No drift detected." If non-empty, paste with each item classified.]

## Seed-data invariants

| Table | Expected | Actual | Match |
|---|---|---|---|
| focus_areas | 17 | ... | ... |

## Backfilled changes (if Outcome B)

[List each ALTER/CREATE INDEX/etc backfilled into migrate.js, with the commit SHA that applied it.]

## Re-audit verification (if Outcome B)

After backfills, re-ran audit on Neon branch `s16-fs261-audit-2026-05-21-rerun`. Diff: [empty / non-empty + details]

## Process going forward

This audit establishes that as of 2026-05-21, `migrate.js` and `staging` are in sync. To maintain this:

1. All schema changes go through `migrate.js`. No raw psql, no Neon Console SQL editor.
2. Future audits should re-run this procedure at sprint close, or when any new environment is provisioned.
3. CI gate (follow-up FS): on every PR that touches `migrate.js`, run it against a fresh Neon branch and verify schema identical to staging.
```

### Step 11: Update migrate.js with audit-point header

At the top of `migrate.js`, after the existing imports/setup, add a comment block:

```js
// ============================================================================
// Audit point: 2026-05-21 (FS #261)
// On this date, migrate.js was verified to produce a schema identical to the
// staging Neon branch. See Trackers/S16-FS261-schema-audit-2026-05-21.md.
//
// Going forward, all schema changes go through this file. No raw psql, no
// Neon Console SQL editor. Future audits move this timestamp forward.
// ============================================================================
```

Subsequent audits update this comment block (or add new ones below).

### Step 12: Process discipline doc

Find the appropriate dev-process doc (likely `Trackers/PRE_SPRINT_11_PLANNING.md`, but Claude Code identifies in pre-flight). Add a new section:

```markdown
## Schema discipline

All schema changes for DailyForge go through `server/scripts/migrate.js`. No exceptions:

- ❌ No raw psql for schema changes
- ❌ No Neon Console SQL editor for schema changes
- ❌ No ALTER TABLE statements run from a Node REPL
- ✅ All schema changes added as idempotent `DO $migrate_<name>$` blocks in migrate.js
- ✅ Run `npm run db:migrate` after pulling latest

Why: every new environment (beta, dev sandbox, CI ephemeral DB, future production replicas) is provisioned by running `migrate.js` against a fresh Neon branch. If `migrate.js` is missing schema, every new environment will be silently broken.

Last audited: 2026-05-21 (see Trackers/S16-FS261-schema-audit-2026-05-21.md).
```

### Step 13: Delete audit branch

```bash
neonctl branches delete s16-fs261-audit-2026-05-21
```

Don't leave audit branches around — they accumulate.

### Step 14: Close FS #261

In `Trackers/FUTURE_SCOPE.md`, mark FS #261 as:

```
✅ CLOSED — Audit complete 2026-05-21, see Trackers/S16-FS261-schema-audit-2026-05-21.md. Outcome: [A / B]. [feat-sha if Outcome B]
```

Add a new FS entry for the CI gate follow-up:

```
#262 | CI gate: on every PR touching migrate.js, run it against a fresh Neon branch and verify schema identical to staging | DB / CI
Source: FS #261 audit, 2026-05-21
Severity: low (preventive, not currently a known risk)
Trigger: any future contractor working on schema, or any future "fresh DB" provisioning need
Context: FS #261 audit confirmed migrate.js and staging are in sync as of 2026-05-21. To prevent future drift, the diff procedure from FS #261 should be automated as a CI step.
```

### Step 15: Commit

**If Outcome A (no backfill):**

Single chore commit:

```
chore: complete FS #261 schema audit (no drift detected)

Audited migrate.js against staging Neon branch on 2026-05-21. Schema
diff was empty (modulo expected differences: Neon role names, GRANTs).
Seed-data invariants verified.

migrate.js now carries an audit-point header. Dev-process doc updated
with the "all schema changes through migrate.js" discipline.

FS #261 closed. FS #262 added (CI gate follow-up).

Files changed:
- server/scripts/migrate.js (+audit-point header)
- Trackers/S16-FS261-schema-audit-2026-05-21.md (new artifact)
- Trackers/PRE_SPRINT_11_PLANNING.md (or equivalent — process discipline section)
- Trackers/FUTURE_SCOPE.md (FS #261 closed, FS #262 added)
- docs/ARCHITECTURE.md (audit-point note in DB section)
```

**If Outcome B (backfill required):**

Two commits — first the backfill, then the chore:

```
feat(db): backfill <N> drifted schema items into migrate.js

Audit per FS #261 found <N> schema items present in staging but
missing from migrate.js. Backfilled with idempotent DO blocks.

Items backfilled:
- <item 1>
- <item 2>
...

Verified by re-running migrate.js against a fresh Neon audit branch
and confirming schema diff is now empty.

Files changed:
- server/scripts/migrate.js
```

Then the chore commit as above.

Push the branch, open a PR off main, watch for CI green.

---

## Acceptance criteria

1. Audit artifact `Trackers/S16-FS261-schema-audit-2026-05-21.md` exists, committed, contains the full diff (or "No drift detected"), seed-data invariants table, and process-going-forward section.
2. If Outcome B: `migrate.js` updated with idempotent backfill blocks; re-audit produces empty diff.
3. `migrate.js` carries an audit-point header.
4. Dev-process doc has a "Schema discipline" section.
5. FS #261 closed in `FUTURE_SCOPE.md`.
6. FS #262 added for the future CI gate.
7. Audit branch deleted from Neon (no zombie branches).
8. PR opened off main with descriptive title (`audit: FS #261 — schema vs migrate.js`).
9. CI green on the PR.

---

## Rollback plan

**Outcome A:** No code changes other than process docs. Revert is trivial; nothing to break.

**Outcome B:** The backfill changes to `migrate.js` are idempotent — running them against staging is a no-op (the changes already exist there). Running them against a fresh DB applies the changes. Revert would mean re-introducing the drift, which we don't want — so the rollback strategy is "don't" unless a specific backfill block is found to be wrong, in which case revert that specific block, re-audit, and propose a corrected version.

---

## Definition of done

- [ ] Pre-flight (a)–(d) complete.
- [ ] Audit branch created on Neon.
- [ ] `migrate.js` runs against the audit branch cleanly.
- [ ] Both schemas dumped via `pg_dump`.
- [ ] Diff classified (empty or per-item resolution).
- [ ] Backfill committed if needed; re-audit shows empty diff.
- [ ] Seed-data invariants verified.
- [ ] Audit artifact committed.
- [ ] `migrate.js` audit-point header added.
- [ ] Dev-process doc updated.
- [ ] FS #261 closed, FS #262 added.
- [ ] Audit branch deleted.
- [ ] PR opened off main with audit summary.
- [ ] CI green.

---

## File outputs

- **Spec (this file):** `Trackers/FS261-schema-audit-spec.md` — committed.
- **Audit artifact:** `Trackers/S16-FS261-schema-audit-2026-05-21.md` — committed (produced during audit).
- **Claude Code prompt:** throwaway markdown delivered in chat. Not committed.

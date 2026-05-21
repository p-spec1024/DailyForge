# Schema Audit — Staging vs migrate.js (FS #261)

**Date:** 2026-05-21
**Auditor:** Claude Code session (Opus 4.7)
**Spec:** `Trackers/FS261-schema-audit-spec.md`
**Audit branch:** `audit-fs261-schema-vs-staging` (off `main`)
**Staging:** Neon `dailyforge` project, `staging` branch
**Audit project (temporary, deleted post-audit):** Neon project `dailyforge-fs261-audit-2026-05-21-rerun` (`hidden-silence-31274940`, `aws-ap-southeast-1`)
**pg_dump version:** _N/A — pg_dump not available on Windows dev box; used Node-based introspection via `server/scripts/schema-diff.mjs` instead. See Methodology._
**Postgres version:** `PostgreSQL 17.10 (322a063) on aarch64-unknown-linux-gnu`
**migrate.js SHA at audit time:** _filled at commit time — see commit body_

---

## Outcome

**B — Drift detected and resolved.**

The FS #261 hypothesis is **confirmed**: there were 14 schema items in staging not in `migrate.js`, plus 2 internal `migrate.js` CREATE/ALTER inconsistencies, for 16 backfill changes. The canonical "out-of-band SQL on staging" pattern is real and documented; the most explicit case (`sessions.focus_slug`) was even self-flagged in a `migrate.js` comment at line 797 as "added directly to prod DB out-of-band; not duplicated here."

After the backfill:
- `migrate.js` re-run against a fresh Neon project produces a schema **identical** to staging modulo the `v_completed_sessions` VIEW.
- The VIEW is C1 drift attributable to PR #4 (s16-t1) — `feat(db): unified sessions VIEW + migrate 4 home endpoints` at SHA `6a6f53e` — and self-resolves when PR #4 merges to `main`.
- Seed-data invariants verified on staging (17 / 49 / 35 / 54 / 12 — all match baseline).

---

## Methodology

This audit ran on a Windows dev box during an active sprint-chain PR. Four methodology adjustments were required to make the spec's prescribed procedure work in this environment. Each is a process-discipline finding in its own right — future audits should expect these gotchas upfront.

### 1. Temporary Neon project instead of "empty branch"

The spec assumed a Neon branch could be created with an empty parentless schema. **Neon's copy-on-write branch model does not support this** — every branch inherits its parent's schema. Workaround: spin up a new Neon **project** instead of a branch. A new project starts with an empty default branch, which is what the audit needs ("does fresh migrate.js produce identical schema to staging?").

```bash
neonctl projects create --name dailyforge-fs261-audit-2026-05-21 \
                        --region-id aws-ap-southeast-1 \
                        --org-id org-crimson-shape-89505673
```

Cleanup at the end: `neonctl projects delete <project-id> --org-id <org-id> --confirm`.

### 2. Off-main audit branch needed a parse-fix cherry-pick from `s16-t1`

The spec says `Branch: off main, NOT sprint-chained`. But `main`'s `migrate.js` still has the unescaped backticks at line 363 that S16-T2c fixed on `s16-t1` (commit `6a6f53e`, May 20). `node --check src/db/migrate.js` failed on `main`.

Sprint-chained branches and off-main audit branches **collide** when the audit's premise depends on a fix that lives only on the sprint branch. Resolution: re-applied the parse fix as a fresh commit on the audit branch (chore `402041c`). Becomes a no-op duplicate after PR #4 merges to `main`.

### 3. Node-based `schema-diff.mjs` instead of `pg_dump`

The spec prescribed `pg_dump --schema-only --no-owner --no-acl` for both sides + `diff -u`. Neither `pg_dump` nor `docker` was installed on the Windows dev box. Installing either was a heavier dependency than the audit needed.

Built `server/scripts/schema-diff.mjs` as permanent infrastructure (no `_one-shot-` prefix per Prashob's call): Node script that introspects `information_schema`, `pg_indexes`, `pg_views`, `pg_proc`, `pg_constraint`, and `information_schema.triggers`, emits a canonical text representation per connection, and runs `git diff --no-index` to surface drift. Pure Node + the existing `pg` dep, no external binaries. Function bodies are SHA-256 hashed for compact comparison; `EXPLAIN_FUNCTIONS=1` env var swaps in full function text when a hash diff needs explanation.

**Forward-looking benefit:** FS #262 (the CI gate follow-up) will face the same "pg_dump not available on the runner" problem on GitHub Actions. `schema-diff.mjs` is already CI-shaped — exits 0 on match, 1 on drift, streams diff to stdout. Reusable as-is.

### 4. Audit-during-open-sprint-PR produces *categorized* drift, not empty drift

Running this audit while PR #4 (s16-t1, 11 commits ahead of main) is open as Draft means the diff includes drift attributable to in-flight PR commits. Classifying drift into PR-in-flight vs out-of-band vs spec-correction is how the audit's value emerges. **The deliverable isn't "diff is empty"; it's "every line in the diff has a category and a resolution."**

The classification scheme used here:

| Category | Meaning |
|---|---|
| **C1** PR-in-flight | Drift attributable to a specific commit on an open Draft PR. Self-resolves at sprint-close merge. **Expected.** |
| **C2a** Rename residue | Drift caused by an incomplete historical rename (table renamed, columns renamed, but PG didn't auto-rename constraints/sequences). |
| **C2b** Out-of-band | Drift NOT attributable to any commit. The bad case FS #261 was looking for. Backfilled into `migrate.js`. |
| **C3** migrate.js internal inconsistency | CREATE TABLE and ALTER ADD COLUMN paths produce different schemas for the same column. Converged. |
| **Spec correction** | Drift that reveals the audit spec (or `migrate.js` comments) had wrong info. Doc-only fix. |

---

## Schema diff (initial run, before backfill)

Pre-backfill diff between fresh-from-migrate.js audit project (`A`) and staging (`B`): **17 items**, classified below.

### C1 — PR-#4-in-flight (1 cluster, expected, no action)

- `+VIEW public.v_completed_sessions  SELECT ((s.id)::text || ':sessions'::text) AS row_id, ...` (and 9 view-column rows that `information_schema` exposes alongside the VIEW)

Attribution: `s16-t1` commit `6a6f53e` (S16-T2c — "feat(db): unified sessions VIEW + migrate 4 home endpoints"). Self-resolves when PR #4 merges.

### C2a — S14-T5 rename residue (7 items, 1 root cause)

The S14-T5 ticket renamed `cross_pillar_sessions` → `multi_phase_sessions`. `migrate.js` `RENAME TO` (table) and `RENAME COLUMN` blocks ran, plus `ALTER INDEX RENAME` for user-defined indexes. **But Postgres does not auto-rename the implicit names of PK/FK/CHECK constraints or the SERIAL-owned sequence.** Staging retained `cross_pillar_sessions_*` names for these; a fresh CREATE TABLE produces `multi_phase_sessions_*`.

| # | Object | Staging name (before) | Backfilled new name |
|---|---|---|---|
| 1 | PK constraint on `multi_phase_sessions` | `cross_pillar_sessions_pkey` | `multi_phase_sessions_pkey` |
| 2 | FK constraint on `multi_phase_sessions.user_id` | `cross_pillar_sessions_user_id_fkey` | `multi_phase_sessions_user_id_fkey` |
| 3 | CHECK constraint on `multi_phase_sessions.end_intent` | `cross_pillar_sessions_end_intent_check` | `multi_phase_sessions_end_intent_check` |
| 4 | FK constraint on `sessions.multi_phase_session_id` | `sessions_cross_pillar_session_id_fkey` | `sessions_multi_phase_session_id_fkey` |
| 5 | FK constraint on `breathwork_sessions.multi_phase_session_id` | `breathwork_sessions_cross_pillar_session_id_fkey` | `breathwork_sessions_multi_phase_session_id_fkey` |
| 6 | PK index name (does not auto-rename with constraint) | `cross_pillar_sessions_pkey` | `multi_phase_sessions_pkey` |
| 7 | SERIAL-owned sequence on `multi_phase_sessions.id` | `cross_pillar_sessions_id_seq` | `multi_phase_sessions_id_seq` |

Backfill: 7 idempotent DO blocks (or `ALTER ... IF EXISTS`) in `migrate.js` alterations const, named `$migrate_fs261_rename_*$`.

### C2b — Out-of-band schema changes (7 distinct items, separate causes)

The canonical FS #261 case. Each item hit staging without going through `migrate.js`.

| # | Item | Direction | Backfill |
|---|---|---|---|
| 8 | `breathwork_techniques_category_check` CHECK constraint | **DROPPED** from staging | `ALTER TABLE … DROP CONSTRAINT IF EXISTS …` |
| 9 | `breathwork_techniques_safety_level_check` CHECK constraint | **DROPPED** from staging | Same shape as #8 |
| 10 | `breathwork_techniques.settle_eligible_for` (TEXT[]) | **ADDED** to staging (S12-T3.5) | `ALTER TABLE … ADD COLUMN IF NOT EXISTS … DEFAULT '{}'` |
| 11 | INDEX `idx_breathwork_settle_eligible` (GIN on `settle_eligible_for`) | **ADDED** to staging | `CREATE INDEX IF NOT EXISTS` |
| 12 | INDEX `idx_exercises_sanskrit_unique` (UNIQUE partial on yoga `sanskrit_name`) | **ADDED** to staging | `CREATE UNIQUE INDEX IF NOT EXISTS` |
| 13 | INDEX `idx_sessions_user_focus_date` (composite partial `(user_id, focus_slug, date)` WHERE `completed = true`) | **ADDED** to staging | `CREATE INDEX IF NOT EXISTS` |
| 14 | `sessions.focus_slug` (VARCHAR(40)) | **ADDED** to staging (S12-T1) | `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_slug VARCHAR(40)` |

**Open question on items #8 and #9** (flagged for retroactive documentation): both CHECK constraints were dropped from staging during the parse-broken window. Original product justification is undocumented — was this a deliberate decision to loosen the `category` and `safety_level` enums (e.g. to allow new values without a schema change), or accidental cleanup during some unrelated debugging? Backfill matches staging's current state regardless; whoever made the drops should retroactively note why.

Item #14 is the most-cited example. The inline `migrate.js` comment at line 797 (now updated) said: "(sessions.focus_slug was added by S12-T1 directly to prod DB out-of-band; not duplicated here. T1 schema reconciliation tracked separately.)" That was a flag pointing exactly at what FS #261 audited. Confirmed by `grep "sessions.*ADD COLUMN.*focus_slug" migrate.js` returning only the `breathwork_sessions.focus_slug` line.

### C3 — migrate.js internal inconsistencies (2 items)

| # | Column | CREATE TABLE had | ALTER ADD COLUMN had | Resolution |
|---|---|---|---|---|
| 15 | `breathwork_techniques.category` | `NOT NULL` no default | `NOT NULL DEFAULT 'calming'` (S11-T1 ALTER) | Added `DEFAULT 'calming'` to CREATE TABLE |
| 16 | `breathwork_techniques.instructions` | `NOT NULL` no default | `NOT NULL DEFAULT ''` (S11-T1 ALTER) | Added `DEFAULT ''` to CREATE TABLE |

Fresh DB took the CREATE path → no defaults. Staging took the ALTER path → defaults present. The fix converges both paths.

### Spec corrections discovered (1 item, doc-only)

| # | Item | Spec said | Reality |
|---|---|---|---|
| Spec-1 | Seed-table name in spec's pre-flight (d) | `focus_compatibility_mappings` (54 rows) | Actual table is `focus_content_compatibility` (54 rows) |

To be fixed in the spec file `Trackers/FS261-schema-audit-spec.md` at sprint close per Prashob's note.

---

## Backfilled changes

All 16 changes landed in `server/src/db/migrate.js` on branch `audit-fs261-schema-vs-staging`, commit at Step 15.

**Schema const (CREATE TABLE) edits:**
- `breathwork_techniques.category` — added `DEFAULT 'calming'`.
- `breathwork_techniques.instructions` — added `DEFAULT ''`.

**Alterations const additions (new FS #261 backfill block):**
- 5 `DO $migrate_fs261_rename_*$` blocks for constraint renames (C2a 1-5).
- 1 `ALTER INDEX IF EXISTS cross_pillar_sessions_pkey RENAME TO multi_phase_sessions_pkey` (C2a 6).
- 1 `DO $migrate_fs261_rename_seq_*$` for sequence rename (C2a 7).
- 2 `ALTER TABLE breathwork_techniques DROP CONSTRAINT IF EXISTS …` (C2b 8-9).
- 1 `ALTER TABLE breathwork_techniques ADD COLUMN IF NOT EXISTS settle_eligible_for TEXT[] DEFAULT '{}'` (C2b 10).
- 1 `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_slug VARCHAR(40)` (C2b 14).

**Indexes const additions (new FS #261 backfill block):**
- 1 `CREATE INDEX IF NOT EXISTS idx_breathwork_settle_eligible` (C2b 11).
- 1 `CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_sanskrit_unique` (C2b 12).
- 1 `CREATE INDEX IF NOT EXISTS idx_sessions_user_focus_date` (C2b 13).

**Comment update:**
- The S12-T1 `sessions.focus_slug` historical note at line ~797 updated to reflect FS #261 backfill.

---

## Re-audit verification

After backfill landed in `migrate.js`:

1. Deleted the original audit project (`floral-butterfly-66437375`).
2. Created a fresh audit project (`hidden-silence-31274940` — name suffix `-rerun`).
3. Ran `node src/db/migrate.js` against the fresh audit project — completes cleanly.
4. Ran `node src/db/migrate.js` against staging — the rename DO blocks fire here (idempotent; previously the cross_pillar_sessions_* names existed, now renamed to multi_phase_sessions_*).
5. Ran `node scripts/schema-diff.mjs <audit-url> <staging-url>`.

**Final diff:**
```
B: 471 schema lines extracted
A: 461 schema lines extracted
[+10 lines of v_completed_sessions VIEW + 9 view-column rows]
=== SCHEMAS DIFFER (see unified diff above) ===
```

The only remaining drift is the C1 PR-#4-in-flight VIEW cluster. Confirms: every C2a + C2b + C3 item has been resolved.

---

## Seed-data invariants

| Table | Expected | Staging | Audit (fresh) | Notes |
|---|---|---|---|---|
| `focus_areas` | 17 | 17 ✓ | 0 | Seeds in `server/src/db/seeds/seed-focus-areas.js`, not in migrate.js |
| `breathwork_techniques` | 49 | 49 ✓ | 0 | Seeds in `seed-breathwork-techniques.js` |
| `focus_muscle_keywords` | 35 | 35 ✓ | 0 | Seeds in `seed-focus-areas.js` |
| `focus_content_compatibility` | 54 | 54 ✓ | 0 | Seeds in `seed-focus-areas.js` |
| `focus_overlaps` | 12 | 12 ✓ | 0 | Seeds in `seed-focus-areas.js` |

**Staging matches the expected baseline.** The audit project has 0 rows because `migrate.js` is DDL-only — seed inserts live in `server/src/db/seeds/*.js` and run via a separate `npm run db:seed` (or equivalent) pathway.

**Process observation:** any future environment provisioned via `npm run db:migrate` alone will have empty seed tables. A full new-environment workflow requires BOTH `db:migrate` AND the seed scripts. Not blocking; documented for the dev-process discipline doc.

---

## Process going forward

This audit establishes that as of 2026-05-21, `migrate.js` and `staging` are in sync (modulo the in-flight PR #4 VIEW addition, which self-resolves at merge). To maintain this:

1. **All schema changes go through `migrate.js`.** No raw `psql` for schema, no Neon Console SQL editor, no ALTER from a Node REPL.
2. **Future audits re-run this procedure** at sprint close, or when any new environment is provisioned.
3. **CI gate (FS #262)** — on every PR that touches `migrate.js`, run it against a fresh Neon project and verify schema-equal to staging using `server/scripts/schema-diff.mjs`. Filed as FS #262 below.

---

## What's now in the repo (deliverables)

- `server/scripts/schema-diff.mjs` — permanent introspection-based diff tool. Reusable by FS #262 CI gate.
- `server/src/db/migrate.js` — backfilled with 16 idempotent changes for FS #261, plus the S16-T2c parse-fix cherry-pick (will become a no-op duplicate after PR #4 merges).
- `Trackers/S16-FS261-schema-audit-2026-05-21.md` — this artifact.
- `Trackers/DEV_PROCESS.md` — new dev-process doc, "Schema discipline" section.
- `Trackers/FUTURE_SCOPE.md` — FS #261 closed, FS #262 added.
- migrate.js audit-point header at the top of the file.

---

## Audit branches and projects

Temporary Neon projects created and deleted during this audit:

| Step | Project ID | Created | Deleted |
|---|---|---|---|
| Initial | `floral-butterfly-66437375` | 2026-05-21T09:19 UTC | Yes (before re-audit) |
| Re-run | `hidden-silence-31274940` | 2026-05-21 (post-backfill) | Yes (at Step 13) |

No audit branches in use. Audit was conducted on temporary projects per Methodology #1.

Git branch `audit-fs261-schema-vs-staging` (off `main`) carries:
- Parse-fix re-application (`402041c`).
- migrate.js backfill (feat commit at Step 15).
- Audit artifact, dev-process doc, FUTURE_SCOPE update (chore commit at Step 15).

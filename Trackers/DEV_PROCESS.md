# DailyForge — Dev Process Discipline

Living document. Started during the FS #261 schema audit (2026-05-21) — the audit confirmed that for ~2 weeks `migrate.js` was parse-broken and schema changes hit staging via raw `psql`. This file is where we record the disciplines that prevent that class of drift going forward.

Each section names the discipline, the why (with a concrete past incident when possible), and how a developer can verify they're following it.

---

## Schema discipline

**All schema changes for DailyForge go through `server/src/db/migrate.js`.** No exceptions.

- ❌ No raw `psql` for schema changes against staging or production.
- ❌ No Neon Console SQL editor for schema changes.
- ❌ No `ALTER TABLE` statements run from a Node REPL.
- ✅ All schema changes added as idempotent `DO $migrate_<name>$ … END $migrate_<name>$;` blocks (or `ALTER … IF EXISTS` / `CREATE … IF NOT EXISTS` where the syntax allows).
- ✅ Run `npm run db:migrate` after pulling latest.
- ✅ After any schema change, re-run the audit procedure (FS #261 spec / `server/scripts/schema-diff.mjs`) before merging to `main`.

### Why this matters

Every new environment — beta, dev sandbox, CI ephemeral DB, future production replicas — is provisioned by running `migrate.js` against a fresh Neon project (per FS #261 audit's Path 3 methodology). If `migrate.js` is missing schema that staging has, **every new environment will silently be broken**. The app starts; specific queries against missing columns fail at runtime, often only on the first user action that touches that column.

### Concrete past incident (FS #261, 2026-05-21)

For approximately two weeks (S15-T1 era through S16-T2c), `migrate.js` was parse-broken because of unescaped backticks inside a SQL comment (`-- Engine reads ``WHERE content_type = 'strength'`` today.`). `node --check src/db/migrate.js` failed. Nobody noticed because nobody was provisioning fresh environments — but the team kept making schema changes via raw `psql` against staging. By the time S16-T2c shipped the parse fix, staging had **14 schema items** not in `migrate.js`:

- 7 items from an incomplete S14-T5 rename (constraints + sequence not auto-renamed when the table was).
- 7 items added or dropped out-of-band (S12-T1 `sessions.focus_slug`, S12-T3.5 `breathwork_techniques.settle_eligible_for`, three indexes, two dropped CHECK constraints).

The audit caught all of these and backfilled them into `migrate.js` as idempotent DO blocks. But the lesson is: had we needed a fresh environment during those two weeks (e.g. for a new contractor's sandbox, or for the upcoming beta DB), we would have shipped a silently broken environment.

### How to verify you're following the discipline

When making a schema change:

1. Add an idempotent block to `migrate.js`.
2. Run `node --check src/db/migrate.js` — must exit 0.
3. Run `npm run db:migrate` against staging — must complete.
4. Run `node server/scripts/schema-diff.mjs <staging-url> <staging-url>` — must report "SCHEMAS MATCH" (sanity check that the diff tool itself works).
5. Re-run the full FS #261 audit if the change is non-trivial (rename, drop, anything not strictly additive).

Last audited: **2026-05-21** — see `Trackers/S16-FS261-schema-audit-2026-05-21.md`. Outcome B (drift detected and backfilled).

### Seed-data discipline (related, separate)

`migrate.js` is DDL-only. Seed data lives in `server/src/db/seeds/*.js`. A fresh environment provisioned via `npm run db:migrate` alone will have empty seed tables (`focus_areas`, `breathwork_techniques`, `focus_muscle_keywords`, `focus_content_compatibility`, `focus_overlaps` — all 0 rows).

A full new-environment workflow needs BOTH `db:migrate` AND the seed scripts. Discipline:

- Seed scripts must be idempotent (`ON CONFLICT DO NOTHING` or equivalent).
- New seed tables get an entry in this section's invariant table:

| Table | Expected row count | Seeded by |
|---|---|---|
| `focus_areas` | 17 (12 body + 5 state) | `seed-focus-areas.js` |
| `breathwork_techniques` | 49 | `seed-breathwork-techniques.js` |
| `focus_muscle_keywords` | 35 | `seed-focus-areas.js` |
| `focus_content_compatibility` | 54 | `seed-focus-areas.js` |
| `focus_overlaps` | 12 | `seed-focus-areas.js` |

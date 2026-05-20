# S16-T2c — Unified Sessions VIEW (`v_completed_sessions`)

**Sprint:** 16 (Engine & API Hardening — Stabilization Part 2)
**Ticket type:** Database refactor (Postgres VIEW) + endpoint migration. Behavior-preserving on the wire; substantially faster underneath.
**Source:** FS #260 (Sentry N+1 alert, May 19, 2026) + FS #212 (unified sessions VIEW, surfaced S14-T6 May 12 + ChatGPT review May 15).
**Priority:** Inserted into S16 between T2 and T2b. Sentry's N+1 detector is the activation trigger FS #212 specified.
**Estimated time:** Half day.
**Touches:**
- `server/scripts/migrate.js` (idempotent CREATE OR REPLACE VIEW block)
- `server/src/routes/home.js` (4 endpoints migrate to VIEW)
- `server/src/services/home_service.js` (or wherever the query logic lives — pre-flight identifies)
- `Trackers/FUTURE_SCOPE.md` (close FS #212, close FS #260)
- `Trackers/CHATGPT_REVIEW_TRACEABILITY.md` (mark F7 Shipped)
- `docs/ARCHITECTURE.md` (document the VIEW + its usage)
- `docs/API.md` (no public surface change — but worth a note that 4 endpoints now share a VIEW underneath)
- `server/scripts/test-home-endpoints-s16-t2c.js` (new smoke harness)

**`.5`-suffix risk:** Medium. The four endpoints have distinct response shapes; getting one query family migrated cleanly while the others regress is the failure mode. Mitigated by per-endpoint response-shape diffing (pre-VIEW vs post-VIEW) and by row-count assertions against the live `staging` data.

---

## Source

`FUTURE_SCOPE.md` row 245 (FS #212):

> Three tables hold completed-session records: `sessions` (strength + yoga + 5phase), `breathwork_sessions`, `yoga_sessions` *[note: yoga is actually in `sessions`, not a separate `yoga_sessions` table — pre-flight (a) verifies the canonical truth]*. Cross-pillar sessions write to two of these per request via the FK linkage on `multi_phase_sessions`. Querying "all sessions for user X" requires three UNION ALLs with column-aliasing — boilerplate that's already duplicated in `home/stats`, `home/daily-counts`, `home/weekly-activity`, `analytics/calendar`. **Fix:** create a Postgres VIEW `v_completed_sessions` that UNIONs the three with normalized columns. Endpoints query the VIEW. **Trigger:** Sprint 15+ when next endpoint needs the union, OR when first noticeable drift between the three duplicated queries surfaces. Two independent reviewers reached this conclusion (S14-T6 `/review` + ChatGPT review).

Combined with FS #260 (added in S16-T2 chore commit):

> N+1 query on GET /api/home/stats (10 pg-pool.connect calls per request). Source: Sentry dailyforge-node N+1 detector, May 19, 2026. Investigation: review home_service.js or routes/home.js — likely inner loop calling per-row query.

**Interpretation:** Sentry's N+1 alert is the activation trigger FS #212 specified. The two FS entries close together when this ticket ships.

---

## Why a VIEW, not just a fix

Three options were considered:

**Option A: Local fix on `home/stats` only.** Find the loop in `home_service.js`, replace per-row queries with a single batched query. 30-60 min. Rejected because (a) it leaves the same N+1 pattern lurking on 3 other endpoints, (b) future endpoints repeat the boilerplate, (c) creates code that FS #212 will then rip out and replace.

**Option B: Refactor the query helper into a shared function in JS.** All endpoints call `getCompletedSessionsFor(userId, options)` which does the UNION ALL internally. ~2 hours. Better than A but the query is still constructed per-call; we don't get the VIEW's query-plan caching benefits and we don't simplify the SQL surface for future developers reading the code.

**Option C: Postgres VIEW `v_completed_sessions`.** The UNION ALL lives in the database. Endpoints query the VIEW as if it were a table. Postgres caches the query plan; the optimizer treats it as a single relation; new endpoints querying "all sessions for user X" write `SELECT * FROM v_completed_sessions WHERE user_id = $1 AND completed_at >= $2` — one query, one connection, optimal plan. Half day.

**Chosen: C.** Matches FS #212's prescription. Right tool for the job. Postgres VIEWs are stable, well-understood, and have zero ongoing operational cost. The migration is idempotent (CREATE OR REPLACE) and reversible (DROP VIEW).

---

## VIEW design

```sql
CREATE OR REPLACE VIEW v_completed_sessions AS
SELECT
  s.id::text || ':sessions' AS row_id,
  s.user_id,
  s.type AS pillar,                -- 'strength' | 'yoga' | 'breathwork' | 'stretching' | '5phase'
  s.completed_at,
  s.started_at,
  -- Duration: per-table source. `sessions` table uses (completed_at - started_at) or an explicit duration_seconds column; pre-flight (a) confirms.
  EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) / 60 AS duration_min,
  s.focus_slug,
  s.multi_phase_session_id
FROM sessions s
WHERE s.completed_at IS NOT NULL

UNION ALL

SELECT
  b.id::text || ':breathwork' AS row_id,
  b.user_id,
  'breathwork' AS pillar,
  b.completed_at,
  b.started_at,
  EXTRACT(EPOCH FROM (b.completed_at - b.started_at)) / 60 AS duration_min,
  b.focus_slug,
  b.multi_phase_session_id
FROM breathwork_sessions b
WHERE b.completed_at IS NOT NULL;
```

**Design decisions:**

1. **`row_id` is a composite string.** `(table_name, id)` is the natural key for the union. Composite text is human-debuggable (`'47:sessions'` vs `'47:breathwork'`) and Postgres handles it without index issues. Endpoints that need the integer ID drill back to the source table.

2. **`completed_at IS NOT NULL` filter.** Both tables have rows for in-progress sessions. The VIEW name is `v_completed_sessions` — incomplete rows do not appear. This is the most important semantic of the VIEW: it gives the consumer a clean "what did this user finish?" view without per-endpoint WHERE clauses.

3. **`duration_min` is computed once, in the VIEW.** Endpoints don't recompute. `EXTRACT(EPOCH FROM …) / 60` is the standard idiom; pre-flight (a) confirms whether either table has an explicit `duration_seconds` or similar that should be preferred.

4. **`pillar` is a stable enum.** Five values: `strength`, `yoga`, `breathwork`, `stretching`, `5phase`. Endpoints filter on this instead of the per-table `type` column.

5. **`multi_phase_session_id` is preserved.** Endpoints that need to dedupe (e.g. counting "unique sessions" where a multi-phase session writes 2-3 per-pillar rows) use this column. The VIEW does not auto-dedupe — that's a downstream concern because different endpoints want different definitions of "a session" (some count phases, some count parent multi-phase headers).

6. **No JOIN against `multi_phase_sessions`.** Including the header table's columns would double the query plan complexity. Endpoints that need header data join `multi_phase_sessions ON v_completed_sessions.multi_phase_session_id = multi_phase_sessions.id` themselves. Keeping the VIEW narrow keeps query plans fast.

**Index strategy:** No new indexes for v1. The VIEW is a derived relation; Postgres uses indexes on the underlying tables (`sessions.user_id`, `sessions.completed_at`, `breathwork_sessions.user_id`, `breathwork_sessions.completed_at`). If `EXPLAIN ANALYZE` shows poor plans on the VIEW after migration, FS-track the index addition (likely composite indexes on `(user_id, completed_at)` on both source tables).

---

## Endpoint migrations

Four endpoints to migrate. Each preserves its current response shape exactly.

### 1. `GET /api/home/stats`

**Current behavior (per `docs/API.md`):**
> `{ streakDays, minutesThisWeek, sessionsThisYear, pillarDurations: { strength, yoga, breath } }`. Pillar durations are median of the user's last 5 sessions per pillar, snapped to 5 minutes, with fallbacks 45/20/10 minutes when there's no history.

**Migration:**
- Replace the per-table queries with `SELECT pillar, completed_at, duration_min FROM v_completed_sessions WHERE user_id = $1 ORDER BY completed_at DESC LIMIT N`.
- Compute streak, minutes-this-week, sessions-this-year, and pillar-median-durations in JS over the result set.
- The number of DB round-trips per request should drop from 10+ (Sentry's count) to **1**.

**Response shape verification:** byte-identical to current. Pre-flight (e) takes a snapshot of the current response for the test user, post-migration compares JSON-equal.

### 2. `GET /api/home/weekly-activity`

**Current:** `{ weeks: [{ weekStart, strength: int, yoga: int, breath: int } × 4] }`

**Migration:** `SELECT pillar, completed_at FROM v_completed_sessions WHERE user_id = $1 AND completed_at >= now() - interval '28 days'`. Bucket into 4 Monday-anchored weeks in JS.

### 3. `GET /api/home/daily-load`

**Current:** `{ points: [{ date, load_minutes } × 30], delta_pct }`

**Migration:** `SELECT completed_at, duration_min FROM v_completed_sessions WHERE user_id = $1 AND completed_at >= now() - interval '30 days'`. Bucket by day. Compute delta_pct as today.

### 4. `GET /api/home/daily-counts`

**Current:** `{ points: [{ date, sessions: int } × 14] }`

**Migration:** `SELECT completed_at, multi_phase_session_id FROM v_completed_sessions WHERE user_id = $1 AND completed_at >= now() - interval '14 days'`. Bucket by day. **Dedupe by `multi_phase_session_id` when present** — a 5-phase session that writes 2-3 per-pillar rows counts as 1 session, not 3. Use a Set or `COUNT(DISTINCT COALESCE(multi_phase_session_id::text, row_id))` pattern.

### 5. `GET /api/analytics/calendar` — NOT IN SCOPE

FS #212 mentioned this endpoint, but pre-flight (b) shows it does not currently exist in `routes/`. If pre-flight surfaces that it was added in a later sprint, fold it into this ticket. Otherwise, document the omission and note that the endpoint should use the VIEW from day one when it's built.

---

## Pre-flight diagnostics (per PI #14)

Mandatory halt-on-drift before any code. Sub-steps:

### (a) Live schema verification

`view server/scripts/migrate.js` for the `sessions` and `breathwork_sessions` CREATE TABLE blocks. Report:
- Exact column list for each table.
- Whether `duration_seconds` (or similar) is a stored column or whether duration must be computed from `(completed_at - started_at)`.
- Whether `completed_at` is nullable (it should be — incomplete sessions exist).
- Whether `focus_slug` is on both tables.
- Whether `multi_phase_session_id` is on both tables.
- Any column names that differ between the two tables in subtle ways (e.g. `type` vs `pillar`, `user_id` vs `userId`).

The VIEW design above assumes specific column names. If live schema diverges, halt and reconcile before writing the migration.

### (b) Endpoint handler inventory

`view server/src/routes/home.js` end-to-end. For each of the 4 endpoints (`/stats`, `/weekly-activity`, `/daily-load`, `/daily-counts`), report:
- Exact handler line range.
- Every SQL query currently issued (with line numbers).
- How many round-trips per request (count `pool.query(...)` or `db.query(...)` calls).

If `home_service.js` exists separately, view that too and report the same data.

Also confirm `routes/analytics/calendar.js` does not exist (per FS #212's reference). If it does exist, surface it.

### (c) Sentry trace correlation

The Sentry N+1 alert showed `pg-pool.connect` called 10 times on a single `GET /api/home/stats`. Match pre-flight (b)'s query count for `/stats` against the Sentry count:
- If (b) shows ~10 queries per request → confirms Sentry, this ticket fixes the issue.
- If (b) shows 1-2 queries but Sentry says 10 connections → the issue is connection pooling, not query count. Different fix (still worth the VIEW for cleanup, but different priority). Halt and surface.

### (d) Test user data

Run against staging:
```sql
SELECT COUNT(*) FROM sessions WHERE user_id = $TEST_USER_ID AND completed_at IS NOT NULL;
SELECT COUNT(*) FROM breathwork_sessions WHERE user_id = $TEST_USER_ID AND completed_at IS NOT NULL;
```
Report both counts. We want enough data to make the smoke meaningful but not so much that the queries take seconds. If `$TEST_USER_ID` has fewer than ~20 total completed sessions, seed the smoke fixture with enough rows to exercise streak/median/bucket logic.

### (e) Response shape snapshot

Before any code change, capture the live response from each of the 4 endpoints against staging for the test user. Save to `Trackers/S16-T2c-pre-migration-snapshots.json`:

```json
{
  "endpoint": "/api/home/stats",
  "request_user_id": 77,
  "response": { ... },
  "captured_at": "2026-05-20T..."
}
```

These snapshots are the regression oracle. Post-migration responses must be byte-identical (modulo timing-dependent fields like the current week boundary — document any expected drift).

### (f) Existing VIEW conflict check

Run against staging:
```sql
SELECT viewname FROM pg_views WHERE viewname = 'v_completed_sessions';
```
Expected: zero rows. If a VIEW with that name already exists from prior work, halt and investigate.

### (g) Migrate.js idempotency check

`view server/scripts/migrate.js` and confirm:
- The script runs idempotently against an already-migrated DB without errors.
- It has a pattern for `CREATE OR REPLACE VIEW` or `DO $migrate_<name>$ … END $migrate_<name>$` blocks.
- Where to insert the new VIEW block (likely near the end, after all CREATE TABLE statements).

Report the insertion point.

### Pre-flight greenlight

One-paragraph summary:
- **Clean** → proceed to Step 1.
- **Drift** → list, propose, halt.

---

## Acceptance criteria

1. **VIEW exists and is correct.** `v_completed_sessions` in Postgres, queryable via `SELECT * FROM v_completed_sessions WHERE user_id = $1`. Returns rows from both source tables, normalized columns, `completed_at IS NOT NULL` filter applied. `\d v_completed_sessions` in psql shows the expected column list.

2. **Migration is idempotent.** Running `migrate.js` against a fresh DB creates the VIEW. Running it against a DB that already has the VIEW does not error. `CREATE OR REPLACE VIEW` is the right idiom.

3. **All 4 endpoints query the VIEW.** `grep -rn "FROM sessions" server/src/routes/home.js` returns zero matches in the migrated handler bodies (it may still appear in comments or other contexts). `grep -rn "FROM breathwork_sessions" server/src/routes/home.js` likewise zero.

4. **DB round-trips per request drop.** Pre-flight (b) baseline number → post-migration: 1 per endpoint. Verify by adding temporary `console.log` instrumentation in the route handler that counts `pool.query` calls per request, hitting each endpoint, removing instrumentation before commit. Alternatively, watch the Sentry transaction trace post-deploy.

5. **Response shapes byte-identical.** Pre-flight (e) snapshots vs post-migration responses for the same test user must JSON-equal. Any drift is a regression and blocks ship.

6. **Multi-phase dedupe correctness.** The `daily-counts` endpoint must count a 5-phase session as 1, not 2 or 3. The smoke harness asserts this specifically: seed a fixture multi-phase session that writes 2 per-pillar rows, hit `/daily-counts`, assert the count is 1 not 2.

7. **Smoke harness clean.** New file `server/scripts/test-home-endpoints-s16-t2c.js` exercises all 4 endpoints against staging, asserts response shapes, asserts round-trip count assertion (via timing or instrumentation), asserts the multi-phase dedupe. ~100 LOC, prod-guarded per S15-T1.

8. **FS #212 and FS #260 close.** Both rows in `FUTURE_SCOPE.md` marked `✅ CLOSED — shipped as S16-T2c, <date>, <feat-sha>`.

9. **`docs/ARCHITECTURE.md` documents the VIEW.** New subsection under §4.7 or similar (place where DB schema is discussed): "Unified sessions VIEW (`v_completed_sessions`)" — describes the VIEW's purpose, semantics (completed-only filter, dedupe responsibility on caller), and which endpoints consume it. Worth ~10 lines.

10. **`docs/API.md` is not changed.** No public surface change. The four endpoints have identical request/response shapes. The VIEW is an internal optimization. (If you find yourself updating API.md beyond a "internal: uses v_completed_sessions VIEW under the hood" footnote, the migration broke wire-compat and the ticket regressed.)

11. **Device verification on Android.** Per PI #6, no auto-commit. Prashob device-tests:
    - Open Home. The 4 sections (Training Load chart, weekly activity ring, daily counts, streak) all render correctly with no spinner stuck and no error toast.
    - Compare visual output side-by-side against a pre-T2c build if possible (likely overkill — the JSON snapshot diff in pre-flight (e) is the real regression oracle).
    - Sentry dashboard: confirm the N+1 alert on `/api/home/stats` does NOT re-fire after the next request. Sentry should classify the new pattern as resolved.

12. **Sentry alert resolution.** After ship, the Sentry N+1 issue (currently "New" status from May 19) should auto-resolve as the pattern no longer matches. If it doesn't auto-resolve, mark it as Resolved manually with a comment linking to the feat SHA.

---

## Build steps

1. **Pre-flight (a)–(g) complete.** Halt or proceed based on greenlight.

2. **Write the VIEW migration block** in `server/scripts/migrate.js` at the location identified in (g). Use `CREATE OR REPLACE VIEW`. Match the schema confirmed by (a) — if column names diverge from this spec, adjust the VIEW definition to match live, not the spec.

3. **Run migrate.js against staging.** Confirm VIEW exists via `\d v_completed_sessions`. Run twice to verify idempotency.

4. **Spot-check the VIEW.** Query it for the test user, compare against an ad-hoc UNION ALL on the source tables. Row counts must match within the completed-only filter.

5. **STOP and report.** Show the VIEW definition that was committed to staging, the spot-check query results, and pre-flight (e) snapshots for the 4 endpoints. Wait for Prashob to confirm before migrating endpoints.

6. **Migrate `/stats`.** Single biggest change — the endpoint Sentry caught. Rewrite the handler to query the VIEW. Verify response shape against (e) snapshot.

7. **Migrate `/weekly-activity`.** Same pattern.

8. **Migrate `/daily-load`.** Same pattern.

9. **Migrate `/daily-counts`.** Includes the multi-phase dedupe logic. Most likely to have subtle bugs — extra care.

10. **Write smoke harness.** Cover all 4 endpoints + the dedupe assertion.

11. **Run smoke against staging.** All pass.

12. **`flutter analyze` not needed** — this is server-only.

13. **STOP and report.** Show full diff of `routes/home.js`, smoke output, response-shape diff (or "byte-identical") per endpoint. Wait for device verification greenlight.

14. **Commit and push.**

---

## Commit messages

**Feat commit:**

```
feat(db): unified sessions VIEW + migrate 4 home endpoints

Creates v_completed_sessions Postgres VIEW that UNIONs sessions and
breathwork_sessions with normalized columns (user_id, pillar,
completed_at, started_at, duration_min, focus_slug,
multi_phase_session_id). Migrates 4 endpoints to query the VIEW
instead of per-table UNION ALLs.

Reduces /api/home/stats from ~10 DB round-trips per request to 1.
Resolves the N+1 query pattern Sentry caught on May 19, 2026.

Endpoints migrated:
- GET /api/home/stats
- GET /api/home/weekly-activity
- GET /api/home/daily-load
- GET /api/home/daily-counts

Response shapes byte-identical to pre-migration snapshots (captured
during pre-flight against the staging test user).

Closes FS #212 (unified sessions VIEW).
Closes FS #260 (N+1 on /api/home/stats).

Files changed:
- server/scripts/migrate.js (+VIEW block)
- server/src/routes/home.js (4 handlers rewritten)
- server/src/services/home_service.js (if applicable)
- server/scripts/test-home-endpoints-s16-t2c.js (new)
- docs/ARCHITECTURE.md (§4.7 VIEW documentation)

Smoke: 4 endpoints + multi-phase dedupe assertion, all pass on staging.
Device: home page sections render correctly on Android.
```

**Chore commit:**

```
chore: update trackers post S16-T2c

- SPRINT_TRACKER.md: S16-T2c row added, ✅ Shipped
- SPRINT_16_OUTLINE.md: T2c inserted between T2 and T2b
- FUTURE_SCOPE.md: FS #212 + FS #260 → CLOSED
- CHATGPT_REVIEW_TRACEABILITY.md: F7 (unified sessions VIEW) → Shipped
- S16-T2c-pre-migration-snapshots.json: archived for future reference
```

---

## Rollback plan

If something regresses post-deploy:

- **Server-only revert.** `git revert <feat-sha>` reverts the routes + migrate.js. The VIEW stays in Postgres (DROP VIEW is not in the revert) — this is fine, it's just unused. A follow-up `DROP VIEW v_completed_sessions` can be run manually if cleanup matters.
- **No data migration.** The VIEW is derived from existing tables. No data was moved. Reverting has zero data implications.
- **No client impact.** Response shapes are byte-identical. Flutter clients see no change before/after either ship or revert.

This is the safest kind of refactor: a database VIEW + handler queries. The risk surface is the response-shape match, which is exactly what the pre-flight snapshot + smoke harness verify.

---

## Definition of done

- [ ] Pre-flight (a)–(g) complete and clean.
- [ ] VIEW migration block in `migrate.js`, idempotent.
- [ ] `v_completed_sessions` exists in staging Postgres.
- [ ] All 4 home endpoints query the VIEW.
- [ ] Round-trip count per request: 1 each (verified or instrumented).
- [ ] Response-shape diff vs pre-migration snapshots: byte-identical.
- [ ] Multi-phase dedupe correct on `/daily-counts`.
- [ ] Smoke harness passes.
- [ ] `docs/ARCHITECTURE.md` updated.
- [ ] FS #212 and FS #260 closed in `FUTURE_SCOPE.md`.
- [ ] Device verification on Android: home loads cleanly.
- [ ] Sentry N+1 alert no longer fires post-deploy.
- [ ] feat + chore commits on `s16-t1`.
- [ ] PR #4 CI green on cumulative diff.

---

## File outputs

- **Spec (this file):** `Trackers/S16-T2c-unified-sessions-view-spec.md` — committed.
- **Pre-migration snapshots:** `Trackers/S16-T2c-pre-migration-snapshots.json` — committed via chore.
- **Claude Code prompt:** throwaway, delivered as markdown in chat. Not committed.

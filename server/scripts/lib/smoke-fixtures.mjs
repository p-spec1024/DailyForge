// server/scripts/lib/smoke-fixtures.mjs
//
// Smoke fixture helper. Centralizes the three sentinel/lifecycle patterns
// that grew up across the Sprint 12 sub-blocks of test-suggestion-engine-t2.js
// (S12-T5 recency, S12-T6 swap-exclusion, S12-T7 HTTP layer).
//
// Closes FUTURE_SCOPE #168.
//
// USAGE GUIDANCE
// --------------
// Use SENTINEL-TAGGED when:
//   - The target table has a column you can tag (notes, slug, label, etc.).
//   - The fixture rows are easily identifiable by a marker value.
//   - You're inserting NEW rows that didn't exist before the test.
//
// Use SNAPSHOT-RESTORE when:
//   - The target table has no sentinel-friendly column.
//   - The test mutates rows that already exist (rather than inserting new
//     ones with a known marker).
//   - You need to preserve pre-existing data exactly.
//
// Always wrap test blocks in withFixtureLifecycle() so cleanup runs even if
// the harness aborts (SIGINT, SIGTERM, or a thrown error). The wrapper uses
// process.prependOnceListener so cleanup runs BEFORE pool.js's own shutdown
// closes the connection pool.
//
// Sentinel value convention: `s<sprint>-t<ticket>-fixture`
// (e.g. `s13-t7-fixture`). Use sentinelFor('s13-t7') instead of hardcoding.

import { pool } from '../../src/db/pool.js';

// ── identifier safety ────────────────────────────────────────────────
//
// pg parameterized queries cannot bind table or column names. To avoid SQL
// injection via caller-supplied identifiers, every identifier is validated
// against a strict ASCII pattern before being interpolated into SQL. Any
// caller passing a non-conforming identifier gets a TypeError immediately.

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertIdent(value, kind) {
  if (typeof value !== 'string' || !IDENT_RE.test(value)) {
    throw new TypeError(
      `smoke-fixtures: invalid ${kind} identifier ${JSON.stringify(value)} ` +
      `(must match /^[a-zA-Z_][a-zA-Z0-9_]*$/)`
    );
  }
  return value;
}

function quoteIdent(value, kind) {
  // Validate, then double-quote — defends against future relaxations of the
  // regex and also handles reserved-word identifiers like "type" or "user".
  assertIdent(value, kind);
  return `"${value}"`;
}

// ── SENTINEL-TAGGED INSERT/DELETE ────────────────────────────────────

/**
 * Insert a sentinel-tagged row into a table.
 *
 * The row object must include the sentinel column with the sentinel value,
 * or this function will set it for you (and warn if there is a conflict).
 *
 * @param {string} table - Table name (e.g. 'sessions')
 * @param {object} row - Column values to insert
 * @param {string} sentinelColumn - The marker column (e.g. 'notes')
 * @param {string} sentinelValue - The marker value (e.g. 's13-t7-fixture')
 * @returns {Promise<object>} - The inserted row including auto-generated columns
 */
export async function insertSentinelRow(table, row, sentinelColumn, sentinelValue) {
  assertIdent(table, 'table');
  assertIdent(sentinelColumn, 'column');
  if (typeof sentinelValue !== 'string' || sentinelValue.length === 0) {
    throw new TypeError('sentinelValue must be a non-empty string');
  }
  if (!row || typeof row !== 'object') {
    throw new TypeError('row must be a non-null object');
  }

  // Force the sentinel column/value into the row so the caller can never
  // accidentally insert an "untagged" fixture.
  const finalRow = { ...row, [sentinelColumn]: sentinelValue };
  const cols = Object.keys(finalRow);
  if (cols.length === 0) throw new TypeError('row must have at least one column');
  cols.forEach((c) => assertIdent(c, 'column'));

  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const colList = cols.map((c) => quoteIdent(c, 'column')).join(', ');
  const values = cols.map((c) => finalRow[c]);

  const sql = `INSERT INTO ${quoteIdent(table, 'table')} (${colList}) VALUES (${placeholders}) RETURNING *`;
  const result = await pool.query(sql, values);
  return result.rows[0];
}

/**
 * Bulk-delete all sentinel-tagged rows from a table.
 *
 * Idempotent: safe to call multiple times. Returns the number of rows
 * actually deleted on this call (0 if nothing to clean up).
 *
 * @param {string} table - Table name
 * @param {string} sentinelColumn - The marker column
 * @param {string} sentinelValue - The marker value
 * @returns {Promise<number>} - Number of rows deleted
 */
export async function deleteBySentinel(table, sentinelColumn, sentinelValue) {
  assertIdent(table, 'table');
  assertIdent(sentinelColumn, 'column');
  if (typeof sentinelValue !== 'string' || sentinelValue.length === 0) {
    throw new TypeError('sentinelValue must be a non-empty string');
  }

  const sql = `DELETE FROM ${quoteIdent(table, 'table')} WHERE ${quoteIdent(sentinelColumn, 'column')} = $1`;
  const result = await pool.query(sql, [sentinelValue]);
  return result.rowCount ?? 0;
}

// ── SNAPSHOT / RESTORE ───────────────────────────────────────────────

/**
 * Snapshot all rows in a table matching a WHERE clause. Used for tables
 * without a sentinel-friendly column.
 *
 * The returned snapshot object captures the table name, the WHERE clause,
 * and an array of full row objects (all columns). restoreSnapshot consumes
 * this object directly.
 *
 * @param {string} table - Table name
 * @param {object} whereClause - { column: value } pairs that filter the snapshot scope
 * @returns {Promise<{table: string, where: object, rows: object[]}>}
 */
export async function snapshotRows(table, whereClause) {
  assertIdent(table, 'table');
  if (!whereClause || typeof whereClause !== 'object') {
    throw new TypeError('whereClause must be a non-null object');
  }
  const cols = Object.keys(whereClause);
  if (cols.length === 0) {
    throw new TypeError('whereClause must specify at least one column — refusing to snapshot a whole table');
  }
  cols.forEach((c) => assertIdent(c, 'column'));

  const conds = cols.map((c, i) => `${quoteIdent(c, 'column')} = $${i + 1}`).join(' AND ');
  const values = cols.map((c) => whereClause[c]);
  const sql = `SELECT * FROM ${quoteIdent(table, 'table')} WHERE ${conds}`;
  const result = await pool.query(sql, values);

  return { table, where: { ...whereClause }, rows: result.rows };
}

/**
 * Restore a snapshot. Within a single transaction:
 *   1. DELETE all rows currently matching the snapshot's WHERE clause
 *      (these are typically the test-mutated rows).
 *   2. INSERT each snapshotted row back, preserving every column including
 *      auto-generated ones (id, created_at, etc.) so referential integrity
 *      is unchanged after restore.
 *
 * Rolls back on any error.
 *
 * Atomicity scope: each restoreSnapshot call is its own transaction. Two
 * sequential calls (e.g. restoring two related tables) are NOT atomic with
 * respect to each other — if the second throws, the first stays committed,
 * leaving the DB in a partial-restore state. Callers that need cross-table
 * atomicity should wrap restores in their own client-managed transaction or
 * tolerate the partial-restore (via post-restore assertions).
 *
 * @param {{table: string, where: object, rows: object[]}} snapshot - From snapshotRows()
 * @returns {Promise<void>}
 */
export async function restoreSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('snapshot must be a non-null object from snapshotRows()');
  }
  const { table, where, rows } = snapshot;
  assertIdent(table, 'table');
  if (!where || typeof where !== 'object') {
    throw new TypeError('snapshot.where must be a non-null object');
  }
  if (!Array.isArray(rows)) {
    throw new TypeError('snapshot.rows must be an array');
  }

  const whereCols = Object.keys(where);
  whereCols.forEach((c) => assertIdent(c, 'column'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const conds = whereCols.map((c, i) => `${quoteIdent(c, 'column')} = $${i + 1}`).join(' AND ');
    const whereValues = whereCols.map((c) => where[c]);
    await client.query(
      `DELETE FROM ${quoteIdent(table, 'table')} WHERE ${conds}`,
      whereValues
    );

    for (const row of rows) {
      const cols = Object.keys(row);
      if (cols.length === 0) continue;
      cols.forEach((c) => assertIdent(c, 'column'));
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const colList = cols.map((c) => quoteIdent(c, 'column')).join(', ');
      const values = cols.map((c) => row[c]);
      await client.query(
        `INSERT INTO ${quoteIdent(table, 'table')} (${colList}) VALUES (${placeholders})`,
        values
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* swallow — original err is the real story */ }
    throw err;
  } finally {
    client.release();
  }
}

// ── LIFECYCLE ────────────────────────────────────────────────────────

/**
 * Wrap a smoke block in try/finally + SIGINT/SIGTERM handlers so cleanup
 * always runs.
 *
 * Signal handlers are registered with prependOnceListener so they fire
 * BEFORE pool.js's own shutdown handler closes the connection pool. After
 * cleanup runs on signal, the process exits with code 130 (the conventional
 * SIGINT exit code) so the harness terminates instead of resuming.
 *
 * On normal completion or thrown error the cleanupFn runs in finally and
 * the signal handlers are removed.
 *
 * @param {() => Promise<void>} blockFn - async function containing the assertions
 * @param {() => Promise<void>} cleanupFn - async function that tears down fixtures
 * @returns {Promise<void>}
 */
export async function withFixtureLifecycle(blockFn, cleanupFn) {
  if (typeof blockFn !== 'function') throw new TypeError('blockFn must be a function');
  if (typeof cleanupFn !== 'function') throw new TypeError('cleanupFn must be a function');

  let signalFired = false;
  const onSignal = async (signal) => {
    if (signalFired) return;
    signalFired = true;
    console.error(`\n[smoke-fixtures] caught ${signal} — running cleanup`);
    try {
      await cleanupFn();
      console.error('[smoke-fixtures] cleanup OK');
    } catch (err) {
      console.error('[smoke-fixtures] cleanup FAILED:', err?.message || err);
      process.exit(2);
    }
    process.exit(130);
  };
  const sigintHandler = () => { onSignal('SIGINT'); };
  const sigtermHandler = () => { onSignal('SIGTERM'); };

  // prependOnceListener so we fire before pool.js's shutdown handler closes
  // the pool out from under our cleanup queries.
  process.prependOnceListener('SIGINT', sigintHandler);
  process.prependOnceListener('SIGTERM', sigtermHandler);

  try {
    await blockFn();
  } finally {
    try {
      await cleanupFn();
    } finally {
      // Remove handlers regardless of cleanup outcome — once the block is
      // over they would do the wrong thing for the next block.
      process.removeListener('SIGINT', sigintHandler);
      process.removeListener('SIGTERM', sigtermHandler);
    }
  }
}

// ── CONVENIENCE ──────────────────────────────────────────────────────

/**
 * Standard sentinel value for smoke blocks: `<ticket>-fixture`.
 * Pass a ticket like 's13-t7' and get back 's13-t7-fixture'.
 *
 * @param {string} ticket
 * @returns {string}
 */
export function sentinelFor(ticket) {
  if (typeof ticket !== 'string' || ticket.length === 0) {
    throw new TypeError('ticket must be a non-empty string');
  }
  return `${ticket}-fixture`;
}

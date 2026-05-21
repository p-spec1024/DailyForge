// S16-T1 ApiService consolidation smoke — hits one endpoint per Flutter
// wrapper (`get`, `getList`, `post`, `put`, `delete`) against an in-process
// Express listener pointed at staging Neon (via DATABASE_URL in .env).
//
// Per S16-T1 spec §"Smoke verification": this is a server-side sanity check
// that the same endpoints still respond correctly; the Flutter wrappers
// themselves are exercised by device verification (Step 10).
//
// Run from server/: node --env-file=.env scripts/test-apiservice-smoke-s16-t1.js
//
// Creates a sentinel fixture user (s16-t1-smoke-fixture@test.local) so the
// run is fully idempotent — pre-deletes any leftover from a prior run and
// cleans up everything it created in `finally`. NODE_ENV=production is
// rejected unless ALLOW_PROD_MUTATION=true (see scripts/lib/prod-guard.mjs).

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';
import { createApp } from '../src/index.js';
import { assertSafeMutation } from './lib/prod-guard.mjs';

const FIXTURE_EMAIL = 's16-t1-smoke-fixture@test.local';
const FIXTURE_PASSWORD = 's16-t1-smoke-fixture-pw-DO-NOT-USE';
const FIXTURE_NAME = 'S16-T1 Smoke Fixture';

let pass = 0;
let fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else      { fail++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

function divider(label) {
  console.log(`\n────────────────────  ${label}  ────────────────────`);
}

async function cleanupFixture() {
  // Delete in dependency order — children before users.
  await pool.query(
    `DELETE FROM body_measurements
      WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
    [FIXTURE_EMAIL]
  );
  await pool.query(
    `DELETE FROM user_settings
      WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
    [FIXTURE_EMAIL]
  );
  await pool.query(
    `DELETE FROM user_pillar_levels
      WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
    [FIXTURE_EMAIL]
  );
  await pool.query(`DELETE FROM users WHERE email = $1`, [FIXTURE_EMAIL]);
}

async function main() {
  assertSafeMutation();

  // Pre-clean leftover fixture (idempotent).
  await cleanupFixture();

  // Create fixture user with bcrypt-hashed password so POST /auth/login works.
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  const ins = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3) RETURNING id, email`,
    [FIXTURE_EMAIL, passwordHash, FIXTURE_NAME]
  );
  const user = ins.rows[0];

  // Pick an active focus to drive POST /sessions/suggest. Prefer a `state`
  // focus (uses simple bracket enum) over a `body` focus (uses time_budget_min,
  // which the engine constrains beyond the route's 5-240 range based on
  // exercise-pool feasibility for the muscle group).
  const focusRow = (await pool.query(
    `SELECT slug, focus_type FROM focus_areas
      WHERE is_active = true
      ORDER BY CASE focus_type WHEN 'state' THEN 0 ELSE 1 END, slug ASC LIMIT 1`
  )).rows[0];
  if (!focusRow) throw new Error('No active focus_areas row available for /suggest smoke');

  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Fixture user: ${user.email} (#${user.id})`);
  console.log(`Focus for /suggest: ${focusRow.slug} (focus_type=${focusRow.focus_type})`);
  console.log(`In-process listener bound to ${BASE}\n`);

  let token = null;
  const createdMeasurementIds = [];

  try {
    // ── 1. POST /api/auth/login — covers `post` wrapper (withAuth: false) ──
    divider('1. POST /api/auth/login (covers `post` wrapper, withAuth: false)');
    {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD }),
      });
      check('login: status 200', r.status === 200, `got ${r.status}`);
      const body = await r.json();
      check('login: body is JSON object', body && typeof body === 'object');
      check('login: token present', typeof body.token === 'string' && body.token.length > 0);
      check('login: user.id matches fixture', body.user?.id === user.id);
      token = body.token;
    }

    if (!token) throw new Error('Login did not yield a token — aborting smoke');
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // ── 2. GET /api/users/me/pillar-levels — covers `get` wrapper ──────────
    divider('2. GET /api/users/me/pillar-levels (covers `get` wrapper)');
    {
      const r = await fetch(`${BASE}/api/users/me/pillar-levels`, {
        headers: authHeaders,
      });
      check('pillar-levels: status 200', r.status === 200, `got ${r.status}`);
      const body = await r.json();
      check('pillar-levels: body is JSON object', body && typeof body === 'object' && !Array.isArray(body));
      check('pillar-levels: has `levels` array', Array.isArray(body.levels));
    }

    // ── 3. GET /api/breathwork/techniques — covers `getList` wrapper ───────
    divider('3. GET /api/breathwork/techniques (covers `getList` wrapper)');
    {
      const r = await fetch(`${BASE}/api/breathwork/techniques`, {
        headers: authHeaders,
      });
      check('techniques: status 200', r.status === 200, `got ${r.status}`);
      const body = await r.json();
      check('techniques: body is JSON array', Array.isArray(body));
    }

    // ── 4. POST /api/sessions/suggest — covers `post` wrapper (engine path) ─
    divider('4. POST /api/sessions/suggest (covers `post` wrapper, withAuth: true, engine path)');
    {
      const payload = { focus_slug: focusRow.slug, entry_point: 'home' };
      if (focusRow.focus_type === 'body') {
        payload.time_budget_min = 45;
      } else if (focusRow.focus_type === 'state') {
        payload.bracket = '10-20';
      }
      const r = await fetch(`${BASE}/api/sessions/suggest`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      check('suggest: status 200', r.status === 200,
        `got ${r.status} — payload=${JSON.stringify(payload)}, body=${JSON.stringify(body)}`);
      check('suggest: body is JSON object', body && typeof body === 'object');
      // metadata.source is set by the engine wrapper. Don't deep-validate.
      check('suggest: has metadata', !!body.metadata);
    }

    // ── 5. PUT /api/settings — covers `put` wrapper (idempotent round-trip) ─
    divider('5. PUT /api/settings (covers `put` wrapper)');
    {
      // First GET to capture current shape, then PUT the same values back.
      const rGet = await fetch(`${BASE}/api/settings`, { headers: authHeaders });
      check('settings GET: status 200', rGet.status === 200, `got ${rGet.status}`);
      const current = await rGet.json();

      const rPut = await fetch(`${BASE}/api/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          rest_timer_duration: current.rest_timer_duration ?? 90,
          rest_timer_enabled: current.rest_timer_enabled ?? true,
          rest_timer_auto_start: current.rest_timer_auto_start ?? true,
        }),
      });
      check('settings PUT: status 200', rPut.status === 200, `got ${rPut.status}`);
      const body = await rPut.json();
      check('settings PUT: rest_timer_duration echoed',
        Number.isInteger(body.rest_timer_duration));
      check('settings PUT: rest_timer_enabled echoed',
        typeof body.rest_timer_enabled === 'boolean');
    }

    // ── 6. POST /api/body-measurements — setup for DELETE smoke ────────────
    divider('6. POST /api/body-measurements (setup for `delete` wrapper smoke)');
    let measurementId = null;
    {
      const r = await fetch(`${BASE}/api/body-measurements`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          weight_kg: 75.5,
          measured_at: '2026-05-19',
          notes: 'S16-T1 smoke fixture row',
        }),
      });
      check('body-measurements POST: status 201', r.status === 201, `got ${r.status}`);
      const body = await r.json();
      check('body-measurements POST: id returned',
        Number.isInteger(body.id) && body.id > 0);
      measurementId = body.id;
      if (measurementId) createdMeasurementIds.push(measurementId);
    }

    // ── 7. DELETE /api/body-measurements/:id — covers `delete` wrapper ─────
    divider('7. DELETE /api/body-measurements/:id (covers `delete` wrapper)');
    if (measurementId) {
      const r = await fetch(`${BASE}/api/body-measurements/${measurementId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      check('body-measurements DELETE: status 200', r.status === 200, `got ${r.status}`);
      const body = await r.json();
      check('body-measurements DELETE: { deleted: true }', body.deleted === true);
      // Row is gone — drop from the cleanup list so we don't try to delete twice.
      const i = createdMeasurementIds.indexOf(measurementId);
      if (i >= 0) createdMeasurementIds.splice(i, 1);
    } else {
      check('body-measurements DELETE: skipped — no row to delete', false,
        'POST setup failed; skipping wrapper exercise');
    }
  } finally {
    // Drop any rows we created but didn't manage to DELETE through the API.
    for (const id of createdMeasurementIds) {
      try {
        await pool.query(`DELETE FROM body_measurements WHERE id = $1`, [id]);
      } catch (e) {
        console.warn(`cleanup: failed to delete body_measurements row ${id}: ${e.message}`);
      }
    }
    await cleanupFixture();
    try { server.close(); } catch {}
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('S16-T1 smoke crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

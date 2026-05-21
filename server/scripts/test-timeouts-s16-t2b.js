// S16-T2b timeout-policy smoke — measures server-side latency for the two
// endpoint classes the new ApiConfig.timeoutFor policy distinguishes:
//   - /api/auth/login → default ApiConfig.defaultTimeout (20s)
//   - /api/sessions/suggest → ApiConfig._endpointTimeouts override (35s)
//
// Scope limit: this harness verifies the SERVER responds within the
// client-side timeout windows. It does NOT exercise the Dart-side timeout
// enforcement itself — that's a client behavior reachable only from Flutter,
// and the project has no Dart test infrastructure yet (S16-T3). Documented
// gap: ApiConfig.timeoutFor() correctness is verified by code review
// (api_config.dart is 18 LOC, deliberately small) + the Dart compiler (the
// const map keys reference the path constants directly, so any rename fails
// the build).
//
// Run from server/: node --env-file=.env scripts/test-timeouts-s16-t2b.js

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';
import { createApp } from '../src/index.js';
import { assertSafeMutation } from './lib/prod-guard.mjs';

const FIXTURE_EMAIL = 's16-t2b-timeouts-fixture@test.local';
const FIXTURE_PASSWORD = 's16-t2b-timeouts-fixture-pw-DO-NOT-USE';
const FIXTURE_NAME = 'S16-T2b Timeouts Fixture';

const DEFAULT_TIMEOUT_S = 20;
const ENGINE_TIMEOUT_S = 35;

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
  await pool.query(`DELETE FROM users WHERE email = $1`, [FIXTURE_EMAIL]);
}

async function timedFetch(url, init) {
  const t0 = Date.now();
  const r = await fetch(url, init);
  const elapsedMs = Date.now() - t0;
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body, elapsedMs };
}

async function main() {
  assertSafeMutation();
  await cleanupFixture();

  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  const ins = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3) RETURNING id, email`,
    [FIXTURE_EMAIL, passwordHash, FIXTURE_NAME]
  );
  const user = ins.rows[0];

  const focusRow = (await pool.query(
    `SELECT slug, focus_type FROM focus_areas
      WHERE is_active = true
        AND focus_type = 'body'
        AND slug != 'mobility'
      ORDER BY slug ASC LIMIT 1`
  )).rows[0];
  if (!focusRow) throw new Error('no active body focus available for smoke');

  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Fixture user: ${user.email} (#${user.id})`);
  console.log(`Body focus:   ${focusRow.slug}`);

  try {
    // ── Test 1: /api/auth/login completes within ApiConfig.defaultTimeout ──
    divider('Test 1: POST /api/auth/login completes within 20s default');
    {
      const r = await timedFetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD }),
      });
      console.log(`  elapsed=${r.elapsedMs}ms (budget=${DEFAULT_TIMEOUT_S * 1000}ms)`);
      check('status 200', r.status === 200, `got ${r.status}`);
      check(`elapsed < ${DEFAULT_TIMEOUT_S}s`,
        r.elapsedMs < DEFAULT_TIMEOUT_S * 1000,
        `got ${r.elapsedMs}ms`);
      // Token is needed for the suggest call below.
      var token = r.body.token;
    }

    // ── Test 2: /api/sessions/suggest completes within engine override ────
    divider('Test 2: POST /api/sessions/suggest completes within 35s engine override');
    {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const r = await timedFetch(`${BASE}/api/sessions/suggest`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          focus_slug: focusRow.slug,
          entry_point: 'home',
          time_budget_min: 30,
        }),
      });
      console.log(`  elapsed=${r.elapsedMs}ms (budget=${ENGINE_TIMEOUT_S * 1000}ms)`);
      check('status 200', r.status === 200,
        `got ${r.status}, body=${JSON.stringify(r.body).slice(0, 200)}`);
      check(`elapsed < ${ENGINE_TIMEOUT_S}s`,
        r.elapsedMs < ENGINE_TIMEOUT_S * 1000,
        `got ${r.elapsedMs}ms`);
      // Bonus check: confirm /sessions/suggest typically completes well below
      // even the default timeout. If it ever creeps above 20s on staging,
      // the engine override is doing real work; if it stays comfortably under
      // 20s, FS-track tightening the override down to ~25s later.
      check(`elapsed comfortably below default (${DEFAULT_TIMEOUT_S}s) — engine override not yet load-bearing`,
        r.elapsedMs < DEFAULT_TIMEOUT_S * 1000,
        `got ${r.elapsedMs}ms — engine override is now load-bearing; keep at 35s`);
    }
  } finally {
    try { server.close(); } catch {}
    await cleanupFixture();
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  console.log('');
  console.log('NOTE: this harness verifies server-side latency only. Client-side');
  console.log('timeout enforcement (ApiConfig.timeoutFor) requires Dart test infra,');
  console.log('which arrives in S16-T3. For now, the policy is verified by code');
  console.log('review (api_config.dart is 18 LOC) + compiler-checked path-constant');
  console.log('keys in the override map.');
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => { console.error('S16-T2b smoke crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());

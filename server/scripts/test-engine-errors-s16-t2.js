// S16-T2 engine-errors smoke — exercises every engine validation throw
// (10 throws → 4 wire codes per Trackers/S16-T2-error-mapping.md) against an
// in-process Express listener pointed at staging Neon.
//
// Coverage strategy:
//   - HTTP layer (4 throws):   throws #2, #3, #5, #6 are reachable through
//                              POST /api/sessions/suggest because no upstream
//                              route validator rejects the payload first.
//                              Assert HTTP 400 + {error, code, details}.
//   - Route-validator path (2 throws): throws #1 and #4 are blocked by route
//                              validators that return their own legacy
//                              {error: <lowercase_code>} 400 BEFORE the engine
//                              runs. Smoke asserts the route returns the
//                              legacy shape (no `code` field) — proving the
//                              defense-in-depth ordering is intact.
//   - Direct engine (5 throws): throws #1, #7, #8, #9, #10 are dispatch- or
//                              recipe-level defenses (per mapping table
//                              Defense-in-depth note). Smoke calls the engine
//                              and recipes directly with deliberately bad
//                              input and asserts the EngineContractError
//                              instance carries the expected code + details.
//
// Run from server/: node --env-file=.env scripts/test-engine-errors-s16-t2.js

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';
import { createApp } from '../src/index.js';
import { assertSafeMutation } from './lib/prod-guard.mjs';
import { generateSession } from '../src/services/suggestion-engine/index.js';
import { generateCrossPillar } from '../src/services/suggestion-engine/recipes/cross-pillar.js';
import { generateStrengthOnly } from '../src/services/suggestion-engine/recipes/strength-only.js';
import { generateYogaOnly } from '../src/services/suggestion-engine/recipes/yoga-only.js';
import { EngineContractError } from '../src/services/suggestion-engine/errors.js';

const FIXTURE_EMAIL = 's16-t2-engine-errors-fixture@test.local';
const FIXTURE_PASSWORD = 's16-t2-engine-errors-pw-DO-NOT-USE';
const FIXTURE_NAME = 'S16-T2 Engine Errors Fixture';

let pass = 0;
let fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else      { fail++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

function divider(label) {
  console.log(`\n────────────────────  ${label}  ────────────────────`);
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

async function cleanupFixture() {
  await pool.query(`DELETE FROM users WHERE email = $1`, [FIXTURE_EMAIL]);
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

  const stateFocusRow = (await pool.query(
    `SELECT slug FROM focus_areas WHERE focus_type = 'state' AND is_active = true LIMIT 1`
  )).rows[0];
  const bodyFocusRow = (await pool.query(
    `SELECT slug FROM focus_areas
       WHERE focus_type = 'body' AND is_active = true AND slug != 'mobility' LIMIT 1`
  )).rows[0];
  if (!stateFocusRow) throw new Error('No active state focus available for smoke');
  if (!bodyFocusRow)  throw new Error('No active non-mobility body focus available for smoke');

  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Fixture user: ${user.email} (#${user.id})`);
  console.log(`State focus:  ${stateFocusRow.slug}`);
  console.log(`Body focus:   ${bodyFocusRow.slug}`);
  console.log(`In-process listener bound to ${BASE}`);

  let token;

  try {
    // ── Login (one POST against /api/auth/login) ────────────────────────────
    {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD }),
      });
      if (r.status !== 200) {
        throw new Error(`fixture login failed: ${r.status} ${await r.text()}`);
      }
      const body = await r.json();
      token = body.token;
    }
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    async function postSuggest(payload) {
      const r = await fetch(`${BASE}/api/sessions/suggest`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      return { status: r.status, body };
    }

    function assertTypedErrorResponse(label, resp, expectedCode, expectedDetailsKeys) {
      check(`${label}: HTTP 400`, resp.status === 400,
        `got ${resp.status} — body=${JSON.stringify(resp.body)}`);
      check(`${label}: body is object`, isObject(resp.body));
      check(`${label}: error is string`, typeof resp.body.error === 'string');
      check(`${label}: code === ${expectedCode}`,
        resp.body.code === expectedCode, `got ${resp.body.code}`);
      check(`${label}: details is object`, isObject(resp.body.details));
      for (const key of expectedDetailsKeys) {
        check(`${label}: details.${key} present`,
          resp.body.details && key in resp.body.details);
      }
    }

    async function expectThrow(label, fn, expectedCode, expectedDetailsKeys) {
      let thrown = null;
      try { await fn(); }
      catch (err) { thrown = err; }
      check(`${label}: threw EngineContractError`,
        thrown instanceof EngineContractError,
        thrown ? `got ${thrown.constructor.name}: ${thrown.message}` : 'no exception');
      if (!(thrown instanceof EngineContractError)) return;
      check(`${label}: code === ${expectedCode}`,
        thrown.code === expectedCode, `got ${thrown.code}`);
      check(`${label}: details is object`, isObject(thrown.details));
      for (const key of expectedDetailsKeys) {
        check(`${label}: details.${key} present`,
          thrown.details && key in thrown.details);
      }
    }

    // ── HTTP: engine-reachable throws (#2, #3, #5, #6) ──────────────────────
    divider('HTTP: engine-reachable throws (typed {error, code, details})');

    {
      // Throw #2 — mobility focus from strength_tab entry.
      const r = await postSuggest({
        focus_slug: 'mobility', entry_point: 'strength_tab', time_budget_min: 30,
      });
      assertTypedErrorResponse(
        'throw #2 (mobility/strength_tab)', r,
        'INVALID_FOCUS_ENTRY_COMBO',
        ['focus_slug', 'entry_point', 'reason'],
      );
    }

    {
      // Throw #3 — state focus from yoga_tab (BODY_ONLY entry).
      const r = await postSuggest({
        focus_slug: stateFocusRow.slug, entry_point: 'yoga_tab', bracket: '10-20',
      });
      assertTypedErrorResponse(
        'throw #3 (state-focus/yoga_tab)', r,
        'INVALID_FOCUS_ENTRY_COMBO',
        ['focus_slug', 'focus_type', 'entry_point', 'reason'],
      );
    }

    {
      // Throw #5 — body focus from breathwork_tab.
      const r = await postSuggest({
        focus_slug: bodyFocusRow.slug, entry_point: 'breathwork_tab', time_budget_min: 30,
      });
      assertTypedErrorResponse(
        'throw #5 (body-focus/breathwork_tab)', r,
        'INVALID_FOCUS_ENTRY_COMBO',
        ['focus_slug', 'focus_type', 'entry_point', 'reason'],
      );
    }

    {
      // Throw #6 — top-level invalid time_budget (primary budget throw).
      const r = await postSuggest({
        focus_slug: bodyFocusRow.slug, entry_point: 'home', time_budget_min: 99,
      });
      assertTypedErrorResponse(
        'throw #6 (time_budget=99/home)', r,
        'INVALID_TIME_BUDGET',
        ['given', 'entry_point', 'valid'],
      );
    }

    // ── HTTP: route-validator path (#1, #4 blocked upstream) ────────────────
    divider('HTTP: route-validator path (legacy {error} shape, no code field)');

    {
      // Throw #1 equivalent — route's bracket enum check fires first.
      const r = await postSuggest({
        focus_slug: stateFocusRow.slug, entry_point: 'home', bracket: 'not_a_bracket',
      });
      check('route-#1: HTTP 400', r.status === 400,
        `got ${r.status} — body=${JSON.stringify(r.body)}`);
      check('route-#1: error === invalid_bracket',
        r.body.error === 'invalid_bracket', `got ${r.body.error}`);
      check('route-#1: code field absent', r.body.code === undefined);
      check('route-#1: details field absent', r.body.details === undefined);
    }

    {
      // Throw #4 equivalent — route's state-focus-requires-bracket fires first.
      const r = await postSuggest({
        focus_slug: stateFocusRow.slug, entry_point: 'home',
      });
      check('route-#4: HTTP 400', r.status === 400,
        `got ${r.status} — body=${JSON.stringify(r.body)}`);
      check('route-#4: error === state_focus_requires_bracket',
        r.body.error === 'state_focus_requires_bracket', `got ${r.body.error}`);
      check('route-#4: code field absent', r.body.code === undefined);
      check('route-#4: details field absent', r.body.details === undefined);
    }

    // ── Direct engine: defense-in-depth + recipe-level (#1, #7, #8, #9, #10) ─
    divider('Direct engine: defense-in-depth and recipe-level throws');

    // Throw #1 — dispatch bracket check (route validates first in HTTP path).
    await expectThrow(
      'throw #1 direct (dispatch invalid bracket)',
      () => generateSession({
        user_id: user.id, focus_slug: stateFocusRow.slug,
        entry_point: 'home', bracket: 'not_a_bracket',
      }),
      'INVALID_BRACKET',
      ['given', 'valid'],
    );

    // Throw #7 — cross-pillar recipe budget guard.
    await expectThrow(
      'throw #7 direct (cross-pillar budget=99)',
      () => generateCrossPillar({
        userId: user.id, focus: { slug: 'biceps' }, levels: {}, timeBudget: 99,
      }),
      'INVALID_TIME_BUDGET',
      ['given', 'entry_point', 'valid'],
    );

    // Throw #8 — strength-only recipe budget guard.
    await expectThrow(
      'throw #8 direct (strength-only budget=99)',
      () => generateStrengthOnly({
        userId: user.id, focus: { slug: 'biceps' }, levels: {}, timeBudget: 99,
      }),
      'INVALID_TIME_BUDGET',
      ['given', 'entry_point', 'valid'],
    );

    // Throw #9 — strength-only mobility mirror guard.
    await expectThrow(
      'throw #9 direct (strength-only mobility)',
      () => generateStrengthOnly({
        userId: user.id, focus: { slug: 'mobility' }, levels: {}, timeBudget: 30,
      }),
      'INVALID_FOCUS_ENTRY_COMBO',
      ['focus_slug', 'entry_point', 'reason'],
    );

    // Throw #10 — yoga-only recipe budget guard.
    await expectThrow(
      'throw #10 direct (yoga-only budget=99)',
      () => generateYogaOnly({
        userId: user.id, focus: { slug: 'biceps' }, levels: {}, timeBudget: 99,
      }),
      'INVALID_TIME_BUDGET',
      ['given', 'entry_point', 'valid'],
    );
  } finally {
    await cleanupFixture();
    try { server.close(); } catch {}
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('S16-T2 engine-errors smoke crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

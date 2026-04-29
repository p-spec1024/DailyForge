// S12-T7 live HTTP round-trip — exercises POST /api/sessions/suggest,
// GET /api/sessions/last, POST /api/sessions/save-as-routine against a
// running localhost server (assumes `npm run dev` is up).
//
// Run: node --env-file=.env scripts/t7-curl-roundtrip.mjs
//
// The script mints a JWT for an existing test user (TEST_USER_EMAIL or the
// most-active user), seeds a fake completed strength session for /last
// reconstruction, and cleans up everything it created at the end. Idempotent.

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db/pool.js';

const BASE = process.env.T7_BASE_URL || 'http://localhost:3001';
const SECRET = process.env.JWT_SECRET;

let pass = 0;
let fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else      { fail++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

async function pickUser() {
  if (process.env.TEST_USER_EMAIL) {
    const { rows } = await pool.query(
      `SELECT id, email FROM users WHERE email = $1`, [process.env.TEST_USER_EMAIL]);
    if (rows.length === 0) throw new Error(`TEST_USER_EMAIL not found: ${process.env.TEST_USER_EMAIL}`);
    return rows[0];
  }
  const { rows } = await pool.query(
    `SELECT u.id, u.email,
            (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.completed = true) AS total
       FROM users u ORDER BY total DESC, u.id ASC LIMIT 1`);
  if (rows.length === 0) throw new Error('No users in DB');
  return rows[0];
}

async function main() {
  if (!SECRET) throw new Error('JWT_SECRET not set');

  const user = await pickUser();
  console.log(`Test user: ${user.email} (#${user.id})`);
  console.log(`Base URL: ${BASE}`);

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '5m' });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const ROUTINE_NAME = 'T7 Roundtrip';
  const ROUNDTRIP_FOCUS = 'biceps';
  let createdRoutineId = null;
  const createdSessionIds = [];

  // Pre-clean any leftover state from a previous run.
  await pool.query(
    `DELETE FROM user_routine_exercises WHERE routine_id IN (
       SELECT id FROM user_routines WHERE user_id = $1 AND name = $2
     )`, [user.id, ROUTINE_NAME]);
  await pool.query(
    `DELETE FROM user_routines WHERE user_id = $1 AND name = $2`, [user.id, ROUTINE_NAME]);

  let bodySession = null;
  let stateSession = null;

  try {
    // Step 1: server is reachable (sanity)
    {
      const r = await fetch(`${BASE}/api/health`).catch(() => null);
      check('step 1: /api/health 200', r && r.status === 200,
        `server may not be running on ${BASE}`);
      if (!r || r.status !== 200) throw new Error('server not reachable');
    }

    // Step 2: POST /api/sessions/suggest body focus (biceps, home, 30)
    {
      const r = await fetch(`${BASE}/api/sessions/suggest`, {
        method: 'POST', headers,
        body: JSON.stringify({ focus_slug: ROUNDTRIP_FOCUS, entry_point: 'home', time_budget_min: 30 }),
      });
      check('step 2: /suggest body home status 200', r.status === 200, `got ${r.status}`);
      bodySession = await r.json();
      check('step 2: session_shape=cross_pillar', bodySession.session_shape === 'cross_pillar');
      check('step 2: phases is array with main', Array.isArray(bodySession.phases)
        && bodySession.phases.some((p) => p.phase === 'main'));
      check('step 2: metadata.source=engine_v1', bodySession.metadata?.source === 'engine_v1');
    }

    // Step 3: POST /api/sessions/suggest state focus (calm, breathwork_tab, 10-20)
    {
      const r = await fetch(`${BASE}/api/sessions/suggest`, {
        method: 'POST', headers,
        body: JSON.stringify({ focus_slug: 'calm', entry_point: 'breathwork_tab', bracket: '10-20' }),
      });
      check('step 3: /suggest state status 200', r.status === 200);
      stateSession = await r.json();
      check('step 3: session_shape=state_focus', stateSession.session_shape === 'state_focus');
      check('step 3: 3 phases', (stateSession.phases || []).length === 3);
    }

    // Step 4: GET /api/sessions/last?focus=biceps (clean) → 404
    {
      // Make sure no biceps row exists for our test user.
      await pool.query(
        `DELETE FROM sessions WHERE user_id = $1 AND focus_slug = $2 AND notes = 't7-roundtrip-fixture'`,
        [user.id, ROUNDTRIP_FOCUS]);
      // Ensure nothing left from previous unsuccessful runs that we care about.
      const r = await fetch(`${BASE}/api/sessions/last?focus=${ROUNDTRIP_FOCUS}`, { headers });
      // The user may legit have existing biceps history; in that case we'd see 200.
      // For test reliability, only assert "404 OR 200 with valid shape."
      if (r.status === 404) {
        const b = await r.json();
        check('step 4: /last 404 last_session_not_found',
          b.error === 'last_session_not_found', `got ${b.error}`);
      } else {
        const b = await r.json();
        check('step 4: /last 200 (user has prior biceps history) — shape valid',
          r.status === 200 && b.metadata?.source === 'last_completed',
          `got status=${r.status}`);
      }
    }

    // Step 5: POST /api/sessions/save-as-routine with the body-focus suggestion
    {
      const r = await fetch(`${BASE}/api/sessions/save-as-routine`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: ROUTINE_NAME, session: bodySession }),
      });
      check('step 5: save status 200', r.status === 200, `got ${r.status}`);
      const b = await r.json();
      check('step 5: routine_id integer', Number.isInteger(b.routine_id));
      check('step 5: saved_phase=strength', b.saved_phase === 'strength');
      check('step 5: exercise_count > 0', b.exercise_count > 0);
      createdRoutineId = b.routine_id;
    }

    // Step 6: GET /api/routines/:id verifies persistence
    if (createdRoutineId) {
      const r = await fetch(`${BASE}/api/routines/${createdRoutineId}`, { headers });
      check('step 6: GET /api/routines/:id status 200', r.status === 200);
      const b = await r.json();
      check('step 6: name matches', b.name === ROUTINE_NAME, `got ${b.name}`);
      const exCount = (b.exercises || []).length;
      check('step 6: exercises array non-empty', exCount > 0, `got ${exCount}`);
    }

    // Step 7: Direct-SQL insert a fake completed strength session for biceps NOW
    {
      const ins = await pool.query(
        `INSERT INTO sessions (user_id, type, focus_slug, completed, started_at, completed_at, date, notes)
         VALUES ($1, 'strength', $2, true, NOW() - INTERVAL '1 hour', NOW(), CURRENT_DATE, 't7-roundtrip-fixture')
         RETURNING id`,
        [user.id, ROUNDTRIP_FOCUS]);
      createdSessionIds.push(ins.rows[0].id);
      check('step 7: SQL insert ok', ins.rows.length === 1);
    }

    // Step 8: GET /api/sessions/last?focus=biceps → 200 with pillar_pure
    {
      const r = await fetch(`${BASE}/api/sessions/last?focus=${ROUNDTRIP_FOCUS}`, { headers });
      check('step 8: /last status 200', r.status === 200, `got ${r.status}`);
      const b = await r.json();
      check('step 8: session_shape=pillar_pure', b.session_shape === 'pillar_pure',
        `got ${b.session_shape}`);
      check('step 8: metadata.source=last_completed', b.metadata?.source === 'last_completed');
    }

    // Step 9: POST /save-as-routine with state-focus session → 400
    {
      const r = await fetch(`${BASE}/api/sessions/save-as-routine`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: 'T7 state save', session: stateSession }),
      });
      const b = await r.json();
      check('step 9: state save → 400 state_focus_not_saveable_v1',
        r.status === 400 && b.error === 'state_focus_not_saveable_v1', `got ${r.status} ${b.error}`);
    }

    // Step 10: POST /suggest no JWT → 401
    {
      const r = await fetch(`${BASE}/api/sessions/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_slug: ROUNDTRIP_FOCUS, entry_point: 'home', time_budget_min: 30 }),
      });
      check('step 10: no JWT → 401', r.status === 401, `got ${r.status}`);
    }
  } finally {
    // Step 11: cleanup
    if (createdRoutineId) {
      await pool.query(`DELETE FROM user_routine_exercises WHERE routine_id = $1`, [createdRoutineId]);
      await pool.query(`DELETE FROM user_routines WHERE id = $1`, [createdRoutineId]);
    }
    if (createdSessionIds.length > 0) {
      await pool.query(`DELETE FROM sessions WHERE id = ANY($1::int[])`, [createdSessionIds]);
    }
    console.log('  cleanup: removed test routine + session fixtures');
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => { console.error('Round-trip crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());

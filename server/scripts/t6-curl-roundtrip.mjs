// S12-T6 4-round-trip live HTTP test — mints a JWT for the test user and
// exercises PUT /workout/slot/:id/choose, POST /exercises/:id/exclude, and
// POST /exercises/:id/keep-suggesting against a running localhost:3001.
// Idempotent: snapshots & restores rows it touches.
//
// Run: node --env-file=.env scripts/t6-curl-roundtrip.mjs

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db/pool.js';

const BASE = process.env.T6_BASE_URL || 'http://localhost:3001';
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

async function pickPair(userId) {
  // Need TWO different strength exercises where one is a slot_alternative of the other.
  // Pick first slot_alternatives row with both ids untouched by this user.
  const { rows } = await pool.query(
    `SELECT sa.exercise_id AS slot_id, sa.alternative_exercise_id AS alt_id
       FROM slot_alternatives sa
      WHERE sa.exercise_id <> sa.alternative_exercise_id
        AND sa.exercise_id NOT IN (SELECT exercise_id FROM exercise_swap_counts WHERE user_id = $1)
        AND sa.alternative_exercise_id NOT IN (SELECT exercise_id FROM exercise_swap_counts WHERE user_id = $1)
      ORDER BY sa.exercise_id ASC LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) throw new Error('No clean slot/alternative pair available');
  return rows[0];
}

async function snapshot(userId, slotId) {
  const ec = await pool.query(
    `SELECT exercise_id, swap_count, prompt_state FROM exercise_swap_counts
      WHERE user_id = $1 AND exercise_id = $2`, [userId, slotId]);
  const ux = await pool.query(
    `SELECT 1 FROM user_excluded_exercises
      WHERE user_id = $1 AND content_type = 'strength' AND content_id = $2`, [userId, slotId]);
  const uep = await pool.query(
    `SELECT chosen_exercise_id FROM user_exercise_prefs
      WHERE user_id = $1 AND exercise_id = $2`, [userId, slotId]);
  return { swap_row: ec.rows[0] || null, excluded: ux.rows.length > 0, pref: uep.rows[0] || null };
}

async function cleanup(userId, slotId, snap) {
  await pool.query(
    `DELETE FROM exercise_swap_counts WHERE user_id = $1 AND exercise_id = $2`, [userId, slotId]);
  await pool.query(
    `DELETE FROM user_excluded_exercises
      WHERE user_id = $1 AND content_type = 'strength' AND content_id = $2`, [userId, slotId]);
  await pool.query(
    `DELETE FROM user_exercise_prefs WHERE user_id = $1 AND exercise_id = $2`, [userId, slotId]);

  // Restore prior state if the user had any.
  if (snap.swap_row) {
    await pool.query(
      `INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, prompt_state)
       VALUES ($1, $2, $3, $4)`,
      [userId, slotId, snap.swap_row.swap_count, snap.swap_row.prompt_state]);
  }
  if (snap.excluded) {
    await pool.query(
      `INSERT INTO user_excluded_exercises (user_id, content_type, content_id)
       VALUES ($1, 'strength', $2)`, [userId, slotId]);
  }
  if (snap.pref) {
    await pool.query(
      `INSERT INTO user_exercise_prefs (user_id, exercise_id, chosen_exercise_id)
       VALUES ($1, $2, $3)`, [userId, slotId, snap.pref.chosen_exercise_id]);
  }
}

async function main() {
  if (!SECRET) throw new Error('JWT_SECRET not set');

  const user = await pickUser();
  console.log(`Test user: ${user.email} (#${user.id})`);

  const pair = await pickPair(user.id);
  console.log(`Test pair: slot=${pair.slot_id} alt=${pair.alt_id}`);

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '5m' });
  const snap = await snapshot(user.id, pair.slot_id);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    // Round-trip 1: PUT /api/workout/slot/:id/choose with chosen_exercise_id=alt_id
    // → first swap. Expect: success=true, swap_count=1, should_prompt=false.
    {
      const r = await fetch(`${BASE}/api/workout/slot/${pair.slot_id}/choose`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ chosen_exercise_id: pair.alt_id }),
      });
      check('round-trip 1: status 200', r.status === 200, `got ${r.status}`);
      const body = await r.json();
      check('round-trip 1: success=true', body.success === true);
      check('round-trip 1: swap_count=1', body.swap_count === 1, `got ${body.swap_count}`);
      check('round-trip 1: should_prompt=false', body.should_prompt === false);
      check('round-trip 1: chosen_exercise_id=alt_id', body.chosen_exercise_id === pair.alt_id);
    }

    // Round-trip 2: same call, two more times → reach swap_count=3, expect should_prompt=true.
    {
      await fetch(`${BASE}/api/workout/slot/${pair.slot_id}/choose`, {
        method: 'PUT', headers, body: JSON.stringify({ chosen_exercise_id: pair.alt_id }) });
      const r = await fetch(`${BASE}/api/workout/slot/${pair.slot_id}/choose`, {
        method: 'PUT', headers, body: JSON.stringify({ chosen_exercise_id: pair.alt_id }) });
      const body = await r.json();
      check('round-trip 2: third swap → swap_count=3', body.swap_count === 3, `got ${body.swap_count}`);
      check('round-trip 2: third swap → should_prompt=true', body.should_prompt === true);
    }

    // Round-trip 3: POST /api/exercises/:id/exclude on slot_id.
    // Spec shape: {excluded: true, already: false, exercise_id: int}.
    {
      const r = await fetch(`${BASE}/api/exercises/${pair.slot_id}/exclude`, {
        method: 'POST', headers });
      check('round-trip 3: status 200', r.status === 200, `got ${r.status}`);
      const body = await r.json();
      check('round-trip 3: excluded=true', body.excluded === true);
      check('round-trip 3: exercise_id matches', body.exercise_id === pair.slot_id);
      check('round-trip 3: already=false (first time)', body.already === false);

      // Idempotent: second call → already=true.
      const r2 = await fetch(`${BASE}/api/exercises/${pair.slot_id}/exclude`, {
        method: 'POST', headers });
      const b2 = await r2.json();
      check('round-trip 3b: idempotent already=true', b2.already === true);

      // Verify both rows persisted.
      const ec = await pool.query(
        `SELECT prompt_state FROM exercise_swap_counts
          WHERE user_id = $1 AND exercise_id = $2`, [user.id, pair.slot_id]);
      check('round-trip 3: exercise_swap_counts.prompt_state=excluded',
        ec.rows[0]?.prompt_state === 'excluded', `got ${ec.rows[0]?.prompt_state}`);
      const ux = await pool.query(
        `SELECT 1 FROM user_excluded_exercises
          WHERE user_id = $1 AND content_type = 'strength' AND content_id = $2`,
        [user.id, pair.slot_id]);
      check('round-trip 3: user_excluded_exercises row inserted', ux.rows.length === 1);
    }

    // Round-trip 4: POST /api/exercises/:id/keep-suggesting on excluded row.
    // Spec criterion 14: 200 with {kept: true, already: true}, state stays excluded.
    {
      const r = await fetch(`${BASE}/api/exercises/${pair.slot_id}/keep-suggesting`, {
        method: 'POST', headers });
      check('round-trip 4: status 200', r.status === 200, `got ${r.status}`);
      const body = await r.json();
      check('round-trip 4: kept=true', body.kept === true);
      check('round-trip 4: already=true (blocked by terminal excluded)',
        body.already === true, `got already=${body.already}`);

      // Verify state was NOT downgraded.
      const ec = await pool.query(
        `SELECT prompt_state FROM exercise_swap_counts
          WHERE user_id = $1 AND exercise_id = $2`, [user.id, pair.slot_id]);
      check('round-trip 4: prompt_state still excluded after blocked keep-suggesting',
        ec.rows[0]?.prompt_state === 'excluded', `got ${ec.rows[0]?.prompt_state}`);
    }

    // Bonus: 404 on nonexistent exercise
    {
      const r = await fetch(`${BASE}/api/exercises/99999999/exclude`, {
        method: 'POST', headers });
      check('bonus: 404 on nonexistent exercise', r.status === 404, `got ${r.status}`);
    }
  } finally {
    await cleanup(user.id, pair.slot_id, snap);
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => { console.error('Round-trip crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());

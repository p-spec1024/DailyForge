// S16-T2c home-endpoints smoke — exercises the 4 home endpoints against
// staging Neon and verifies (a) response shape, (b) breathwork arm of the
// VIEW is reached when a fixture user has only breathwork rows, (c) the
// multi-phase dedupe in /daily-counts counts a multi-phase session as 1
// regardless of how many per-pillar rows it writes.
//
// Sentinel pattern: a fixture user (s16-t2c-smoke-fixture@test.local) owns
// all seeded rows. Cleanup deletes the user; FK ON DELETE CASCADE drops
// sessions/breathwork_sessions/multi_phase_sessions rows.
//
// Run from server/: node --env-file=.env scripts/test-home-endpoints-s16-t2c.js

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';
import { createApp } from '../src/index.js';
import { assertSafeMutation } from './lib/prod-guard.mjs';

const FIXTURE_EMAIL = 's16-t2c-smoke-fixture@test.local';
const FIXTURE_PASSWORD = 's16-t2c-smoke-fixture-pw-DO-NOT-USE';
const FIXTURE_NAME = 'S16-T2c Smoke Fixture';

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

function todayDateStr() {
  // Match the handlers' fmtDate behavior: YYYY-MM-DD in server-local TZ.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function cleanupFixture() {
  await pool.query(`DELETE FROM users WHERE email = $1`, [FIXTURE_EMAIL]);
}

async function main() {
  assertSafeMutation();
  await cleanupFixture();

  // Create fixture user + auth.
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  const ins = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3) RETURNING id, email`,
    [FIXTURE_EMAIL, passwordHash, FIXTURE_NAME]
  );
  const user = ins.rows[0];

  // Resolve a real breathwork technique id (NOT NULL FK on breathwork_sessions).
  const techRow = (await pool.query(
    `SELECT id FROM breathwork_techniques ORDER BY id LIMIT 1`
  )).rows[0];
  if (!techRow) throw new Error('no breathwork_techniques row available for smoke');

  // Seed fixture rows. All on today's date so /daily-counts sees them in
  // the 14-day window.
  const today = todayDateStr();
  console.log(`Fixture user: ${user.email} (#${user.id})`);
  console.log(`Today: ${today}`);

  // (a) Standalone strength session — no multi_phase_session_id.
  await pool.query(
    `INSERT INTO sessions (user_id, started_at, completed_at, date, duration, type, completed)
     VALUES ($1, NOW(), NOW(), $2::date, 1800, 'strength', true)`,
    [user.id, today]
  );

  // (b) Multi-phase session header.
  const mpsRow = (await pool.query(
    `INSERT INTO multi_phase_sessions
       (user_id, focus_slug, session_shape, started_at, completed_at,
        phases_completed, total_phases, end_intent)
     VALUES ($1, 'biceps', 'cross_pillar', NOW(), NOW(), 3, 3, 'completed')
     RETURNING id`,
    [user.id]
  )).rows[0];

  // (c) Sessions row linked to the header (per-pillar #1).
  await pool.query(
    `INSERT INTO sessions
       (user_id, started_at, completed_at, date, duration, type, completed,
        multi_phase_session_id)
     VALUES ($1, NOW(), NOW(), $2::date, 1200, 'strength', true, $3)`,
    [user.id, today, mpsRow.id]
  );

  // (d) Breathwork row linked to the same header (per-pillar #2). Exercises
  //     the breathwork half of the VIEW.
  await pool.query(
    `INSERT INTO breathwork_sessions
       (user_id, technique_id, duration_seconds, rounds_completed, completed,
        created_at, multi_phase_session_id, focus_slug)
     VALUES ($1, $2, 600, 5, true, NOW(), $3, 'biceps')`,
    [user.id, techRow.id, mpsRow.id]
  );

  // Standalone breathwork row to widen the breathwork arm coverage and the
  // /daily-counts assertion (this one is NOT part of the multi-phase, so it
  // counts as its own session).
  await pool.query(
    `INSERT INTO breathwork_sessions
       (user_id, technique_id, duration_seconds, rounds_completed, completed,
        created_at)
     VALUES ($1, $2, 300, 3, true, NOW())`,
    [user.id, techRow.id]
  );

  // App + login.
  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;

  let token;
  try {
    {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD }),
      });
      if (r.status !== 200) {
        throw new Error(`fixture login failed: ${r.status} ${await r.text()}`);
      }
      token = (await r.json()).token;
    }
    const authHeaders = { Authorization: `Bearer ${token}` };

    async function get(p) {
      const r = await fetch(`${BASE}${p}`, { method: 'GET', headers: authHeaders });
      return { status: r.status, body: await r.json() };
    }

    // ── Test 1: /stats ────────────────────────────────────────────────────
    divider('Test 1: GET /api/home/stats');
    {
      const r = await get('/api/home/stats');
      check('status 200', r.status === 200, `got ${r.status}`);
      check('body is object', isObject(r.body));
      check('has streakDays (number)', typeof r.body.streakDays === 'number');
      check('has minutesThisWeek (number)', typeof r.body.minutesThisWeek === 'number');
      check('has sessionsThisYear (number)', typeof r.body.sessionsThisYear === 'number');
      check('sessionsThisYear >= 4 (2 sessions + 2 breathwork seeded today)',
        r.body.sessionsThisYear >= 4, `got ${r.body.sessionsThisYear}`);
      check('has pillarDurations object', isObject(r.body.pillarDurations));
      for (const k of ['strength', 'yoga', 'breath']) {
        check(`pillarDurations.${k} is number`,
          typeof r.body.pillarDurations[k] === 'number');
      }
    }

    // ── Test 2: /weekly-activity ──────────────────────────────────────────
    divider('Test 2: GET /api/home/weekly-activity');
    {
      const r = await get('/api/home/weekly-activity');
      check('status 200', r.status === 200, `got ${r.status}`);
      check('body has weeks array of 4', Array.isArray(r.body.weeks) && r.body.weeks.length === 4);
      const thisWeek = r.body.weeks[3];
      check('this week has strength >= 2 (1 standalone + 1 mp-linked)',
        thisWeek.strength >= 2, `got ${thisWeek?.strength}`);
      check('this week has breath >= 2 (1 mp-linked + 1 standalone)',
        thisWeek.breath >= 2, `got ${thisWeek?.breath}`);
    }

    // ── Test 3: /daily-load ───────────────────────────────────────────────
    divider('Test 3: GET /api/home/daily-load');
    {
      const r = await get('/api/home/daily-load');
      check('status 200', r.status === 200, `got ${r.status}`);
      check('body has points array of 30',
        Array.isArray(r.body.points) && r.body.points.length === 30);
      const todayPoint = r.body.points.find((p) => p.date === today);
      check('today is in the 30-day window',
        todayPoint != null, `points last entry: ${r.body.points[r.body.points.length - 1]?.date}`);
      // Seeded durations sum: 1800 + 1200 + 600 + 300 = 3900 secs = 65 min.
      check('today.load_minutes >= 65 (4 seeded sessions)',
        todayPoint && todayPoint.load_minutes >= 65,
        `got ${todayPoint?.load_minutes}`);
    }

    // ── Test 4: /daily-counts + multi-phase dedupe ────────────────────────
    divider('Test 4: GET /api/home/daily-counts (multi-phase dedupe)');
    {
      const r = await get('/api/home/daily-counts');
      check('status 200', r.status === 200, `got ${r.status}`);
      check('body has points array of 14',
        Array.isArray(r.body.points) && r.body.points.length === 14);
      const todayPoint = r.body.points.find((p) => p.date === today);
      // Expected: 3 = (1 standalone strength) + (1 multi-phase deduped) + (1 standalone breathwork).
      // The multi-phase header has 2 per-pillar rows but counts as 1.
      check('today.sessions === 3 (multi-phase deduped to 1)',
        todayPoint && todayPoint.sessions === 3,
        `got ${todayPoint?.sessions} for ${today} — multi-phase dedupe broken?`);
    }

    // ── Test 5: VIEW breathwork arm directly ──────────────────────────────
    divider('Test 5: VIEW breathwork arm (direct query)');
    {
      const v = await pool.query(
        `SELECT row_id, pillar FROM v_completed_sessions
          WHERE user_id = $1 AND pillar = 'breathwork'`,
        [user.id]
      );
      check('VIEW returns breathwork rows for fixture user',
        v.rows.length === 2, `got ${v.rows.length} rows`);
      check('all VIEW breathwork rows tagged ":breathwork"',
        v.rows.every((r) => r.row_id.endsWith(':breathwork')));
    }
  } finally {
    try { server.close(); } catch {}
    await cleanupFixture();
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => { console.error('S16-T2c smoke crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());

// Smoke test for the body-map endpoints (S10-T5b).
// Usage: ensure the server is running on PORT (defaults to 3001), then:
//   node --env-file=.env scripts/test-body-map-endpoints.js
//
// Picks the user with the most completed sessions, signs a JWT using the
// server's JWT_SECRET, and shape-checks the responses against the Dart
// contract (lib/data/mock_body_map_data.dart).

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db/pool.js';
import {
  STRENGTH_GROUPS,
  FLEXIBILITY_REGIONS,
} from '../src/services/muscleMapping.js';

const PORT = process.env.PORT || 3001;
const BASE = `http://localhost:${PORT}/api/body-map`;

let pass = 0;
let fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else      { fail++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

async function pickTestUser() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.user_id = u.id AND s.completed = true) AS total
       FROM users u
      ORDER BY total DESC
      LIMIT 1`
  );
  if (!rows.length) throw new Error('No users in DB to test against');
  return rows[0];
}

async function pickEmptyUser() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email
       FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.completed = true
      )
      LIMIT 1`
  );
  return rows[0] || null;
}

function signTokenForUser(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
}

async function callEndpoint(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function main() {
  const user = await pickTestUser();
  console.log(`Test user: id=${user.id} email=${user.email} sessions=${user.total}\n`);
  const token = signTokenForUser(user);

  // ── 1) muscle-volumes ────────────────────────────────────────────────
  console.log('GET /muscle-volumes?range=30d');
  const mv = await callEndpoint('/muscle-volumes?range=30d', token);
  console.log('  status:', mv.status);
  console.log('  body  :', JSON.stringify(mv.body));
  check('status 200', mv.status === 200);
  check('object response', mv.body && typeof mv.body === 'object' && !Array.isArray(mv.body));
  // T5c-b shape: { volumes: {...}, details: {...} }
  check('has `volumes` map',
        mv.body && typeof mv.body.volumes === 'object' && !Array.isArray(mv.body.volumes));
  check('has `details` map',
        mv.body && typeof mv.body.details === 'object' && !Array.isArray(mv.body.details));
  if (mv.body && mv.body.volumes) {
    for (const g of STRENGTH_GROUPS) {
      check(`volumes["${g}"] present`,
            Object.prototype.hasOwnProperty.call(mv.body.volumes, g));
      const v = mv.body.volumes[g];
      check(`volumes["${g}"] int 0–100`,
            Number.isInteger(v) && v >= 0 && v <= 100,
            `got ${JSON.stringify(v)}`);
    }
  }
  if (mv.body && mv.body.details) {
    for (const g of STRENGTH_GROUPS) {
      const d = mv.body.details[g];
      check(`details["${g}"] present`, d && typeof d === 'object');
      if (d && typeof d === 'object') {
        check(`details["${g}"].lastTrained string`, typeof d.lastTrained === 'string');
        check(`details["${g}"].volumeLabel string`, typeof d.volumeLabel === 'string');
        check(`details["${g}"].topExercise string`, typeof d.topExercise === 'string');
        check(`details["${g}"].setsThisWeek int`, Number.isInteger(d.setsThisWeek),
              `got ${JSON.stringify(d.setsThisWeek)}`);
      }
    }
  }

  // ── 2) flexibility ───────────────────────────────────────────────────
  console.log('\nGET /flexibility?range=30d');
  const fx = await callEndpoint('/flexibility?range=30d', token);
  console.log('  status:', fx.status);
  console.log('  body  :', JSON.stringify(fx.body));
  check('status 200', fx.status === 200);
  check('object response', fx.body && typeof fx.body === 'object' && !Array.isArray(fx.body));
  if (fx.body && typeof fx.body === 'object') {
    for (const r of FLEXIBILITY_REGIONS) {
      check(`key "${r}" present`, Object.prototype.hasOwnProperty.call(fx.body, r));
      const v = fx.body[r];
      check(`value "${r}" int 0–100`, Number.isInteger(v) && v >= 0 && v <= 100,
            `got ${JSON.stringify(v)}`);
    }
  }

  // ── 3) recent-wins ───────────────────────────────────────────────────
  console.log('\nGET /recent-wins?limit=5');
  const rw = await callEndpoint('/recent-wins?limit=5', token);
  console.log('  status:', rw.status);
  console.log('  body  :', JSON.stringify(rw.body));
  check('status 200', rw.status === 200);
  check('array response', Array.isArray(rw.body));
  if (Array.isArray(rw.body)) {
    check('length <= 5', rw.body.length <= 5);
    rw.body.forEach((win, i) => {
      check(`win[${i}].icon string`, typeof win.icon === 'string');
      check(`win[${i}].title string`, typeof win.title === 'string');
      check(`win[${i}].subtitle string`, typeof win.subtitle === 'string');
      check(`win[${i}] no extra fields`,
            Object.keys(win).every((k) => ['icon', 'title', 'subtitle'].includes(k)),
            `keys=${Object.keys(win).join(',')}`);
    });
  }

  // ── 4) range param sanity (check 7d/90d/year don't 500) ──────────────
  console.log('\nRange variants on /muscle-volumes:');
  for (const range of ['7d', '90d', 'year']) {
    const r = await callEndpoint(`/muscle-volumes?range=${range}`, token);
    check(`range=${range} → 200`, r.status === 200);
  }

  // ── 5) auth required ─────────────────────────────────────────────────
  console.log('\nNo-auth call:');
  const noauth = await fetch(`${BASE}/muscle-volumes`);
  check('rejects without token', noauth.status === 401);

  // ── 6) invalid range param defaults to 30d (does not 400) ───────────
  console.log('\nInvalid range:');
  const bad = await callEndpoint('/muscle-volumes?range=garbage', token);
  check('invalid range → 200 (defaults to 30d)', bad.status === 200);
  check('invalid range still has all 11 volume keys',
        bad.body && bad.body.volumes &&
        STRENGTH_GROUPS.every((g) => Object.prototype.hasOwnProperty.call(bad.body.volumes, g)));

  // ── 7) zero-history user returns all-zeros + zero-state details ─────
  console.log('\nZero-history user:');
  const empty = await pickEmptyUser();
  if (empty) {
    const emptyToken = signTokenForUser(empty);
    const mvE = await callEndpoint('/muscle-volumes?range=30d', emptyToken);
    const fxE = await callEndpoint('/flexibility?range=30d', emptyToken);
    const rwE = await callEndpoint('/recent-wins?limit=5', emptyToken);
    console.log(`  user id=${empty.id} muscles:`, JSON.stringify(mvE.body));
    check('empty user muscles 200', mvE.status === 200);
    check('empty user volumes all zero',
          mvE.body && mvE.body.volumes &&
          STRENGTH_GROUPS.every((g) => mvE.body.volumes[g] === 0));
    check('empty user details zero-state well-formed',
          mvE.body && mvE.body.details &&
          STRENGTH_GROUPS.every((g) => {
            const d = mvE.body.details[g];
            return d &&
              d.lastTrained === 'Not yet' &&
              d.volumeLabel === '—' &&
              d.topExercise === '—' &&
              d.setsThisWeek === 0;
          }));
    check('empty user flexibility 200', fxE.status === 200);
    check('empty user flexibility all zero',
          FLEXIBILITY_REGIONS.every((r) => fxE.body[r] === 0));
    check('empty user wins 200', rwE.status === 200);
    check('empty user wins is empty array',
          Array.isArray(rwE.body) && rwE.body.length === 0);
  } else {
    console.log('  (skipped — no zero-history user exists)');
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('Smoke test crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

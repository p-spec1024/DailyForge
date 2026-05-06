// S13-T1 live HTTP round-trip — exercises POST /api/users/pillar-levels and
// GET /api/users/me/pillar-levels against an in-process Express listener
// (no external dev server needed). Prints request/response in curl-like form
// for paste-friendly review.
//
// Run from server/: node --env-file=.env scripts/t1-curl-roundtrip.mjs
//
// Uses a sentinel-tagged fixture user (t1-curl-fixture@test.local) and cleans
// it up at end. Idempotent — pre-deletes any leftover from a prior run.

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db/pool.js';
import { createApp } from '../src/index.js';

const SECRET = process.env.JWT_SECRET;
const FIXTURE_EMAIL = 't1-curl-fixture@test.local';

function divider(label) {
  console.log(`\n────────────────────  ${label}  ────────────────────`);
}

async function call(method, base, pathStr, { auth, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const url = `${base}${pathStr}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  // Render as curl invocation
  const curlParts = ['curl', '-sS', '-i', '-X', method];
  for (const [k, v] of Object.entries(headers)) {
    const printedV = k === 'Authorization' ? 'Bearer <JWT>' : v;
    curlParts.push('-H', `'${k}: ${printedV}'`);
  }
  if (body !== undefined) curlParts.push('-d', `'${JSON.stringify(body)}'`);
  curlParts.push(`'${url.replace(/^http:\/\/127\.0\.0\.1:\d+/, 'http://localhost:PORT')}'`);
  console.log('$', curlParts.join(' '));

  const r = await fetch(url, opts);
  const text = await r.text();
  console.log(`HTTP/1.1 ${r.status} ${r.statusText}`);
  for (const [k, v] of r.headers.entries()) {
    if (k === 'content-type' || k === 'content-length') console.log(`${k}: ${v}`);
  }
  console.log();
  // Pretty-print JSON if possible.
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  return { status: r.status, body: text };
}

async function main() {
  if (!SECRET) throw new Error('JWT_SECRET not set');

  // Pre-clean leftover fixture (idempotent).
  await pool.query(
    `DELETE FROM user_pillar_levels
      WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
    [FIXTURE_EMAIL]
  );
  await pool.query(`DELETE FROM users WHERE email = $1`, [FIXTURE_EMAIL]);

  const ins = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3) RETURNING id, email`,
    [FIXTURE_EMAIL, 'no-login-fixture', 'T1 Curl Fixture']
  );
  const user = ins.rows[0];

  const app = createApp();
  const server = await new Promise((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;
  const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '5m' });

  console.log(`Fixture user: ${user.email} (#${user.id})`);
  console.log(`In-process listener bound to ${BASE}`);
  console.log(`(curl URLs below show http://localhost:PORT for paste-friendliness)`);

  try {
    divider('1. GET /me/pillar-levels — no auth → 401');
    await call('GET', BASE, '/api/users/me/pillar-levels');

    divider('2. GET /me/pillar-levels — fresh user → 200 { levels: [] }');
    await call('GET', BASE, '/api/users/me/pillar-levels', { auth: token });

    divider('3. POST /pillar-levels — first declare → 200 + body shape');
    await call('POST', BASE, '/api/users/pillar-levels', {
      auth: token,
      body: { strength: 'beginner', yoga: 'intermediate', breathwork: 'advanced' },
    });

    divider('4. GET /me/pillar-levels — 3 rows, all source=declared');
    await call('GET', BASE, '/api/users/me/pillar-levels', { auth: token });

    divider('5. POST /pillar-levels — upsert with new levels → 200');
    await call('POST', BASE, '/api/users/pillar-levels', {
      auth: token,
      body: { strength: 'advanced', yoga: 'beginner', breathwork: 'intermediate' },
    });

    divider('6. GET /me/pillar-levels — still 3 rows, updated values');
    await call('GET', BASE, '/api/users/me/pillar-levels', { auth: token });

    divider('7. POST /pillar-levels — missing yoga key → 400 yoga_level_required');
    await call('POST', BASE, '/api/users/pillar-levels', {
      auth: token,
      body: { strength: 'beginner', breathwork: 'beginner' },
    });

    divider("8. POST /pillar-levels — invalid level 'expert' → 400 invalid_strength_level");
    await call('POST', BASE, '/api/users/pillar-levels', {
      auth: token,
      body: { strength: 'expert', yoga: 'beginner', breathwork: 'beginner' },
    });

    divider('9. POST /pillar-levels — no auth → 401');
    await call('POST', BASE, '/api/users/pillar-levels', {
      body: { strength: 'beginner', yoga: 'beginner', breathwork: 'beginner' },
    });
  } finally {
    await pool.query(`DELETE FROM user_pillar_levels WHERE user_id = $1`, [user.id]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    try { server.close(); } catch {}
  }

  console.log('\n────────────────────  done  ────────────────────');
}

main()
  .catch((err) => {
    console.error('curl roundtrip crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

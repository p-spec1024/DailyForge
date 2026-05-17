import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildTestApp } from './helpers/app-factory.js';
import { bearerHeader } from './helpers/jwt-mint.js';

test('GET /api/health returns ok', async () => {
  const { app } = buildTestApp();
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /api/users/profile without JWT returns 401', async () => {
  const { app } = buildTestApp();
  const res = await request(app).get('/api/users/profile');
  assert.equal(res.status, 401);
});

test('POST /api/auth/login with empty body returns 400', async () => {
  const { app } = buildTestApp();
  const res = await request(app).post('/api/auth/login').send({});
  assert.equal(res.status, 400);
});

// Exercises mintTestJwt + bearerHeader. /api/users/pillar-levels mounts
// authChain at the router level, then validates body before any DB query —
// so a valid JWT yields 400 (handler reached), an invalid JWT yields 401
// (auth blocked). Asserting 400 proves authenticate accepted the token.
test('POST /api/users/pillar-levels with valid JWT + empty body returns 400', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .post('/api/users/pillar-levels')
    .set('Authorization', bearerHeader())
    .send({});
  assert.equal(res.status, 400);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { buildTestApp } from './helpers/app-factory.js';
import { bearerHeader } from './helpers/jwt-mint.js';
import { config } from '../src/config/env.js';

// S15-T7: integer-id validation in authenticate middleware. The middleware
// rejects any JWT whose `id` claim is not a positive integer, returning
// 401 { error: 'invalid_token' }. Existing 401 wordings for missing/malformed
// header cases ('Missing token', 'Invalid token') stay untouched.
//
// All malformed-id cases target /api/users/profile because it is auth-gated
// and rejected at the middleware boundary before any DB query runs.

test('JWT with id as string of digits returns 401 invalid_token', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', bearerHeader({ id: '123' }));
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_token' });
});

test('JWT with id as non-numeric string returns 401 invalid_token', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', bearerHeader({ id: 'abc' }));
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_token' });
});

test('JWT with id as 0 returns 401 invalid_token', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', bearerHeader({ id: 0 }));
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_token' });
});

test('JWT with id as negative integer returns 401 invalid_token', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', bearerHeader({ id: -1 }));
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_token' });
});

test('JWT with id as non-integer number returns 401 invalid_token', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', bearerHeader({ id: 1.5 }));
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_token' });
});

test('JWT missing id claim returns 401 invalid_token', async () => {
  const { app } = buildTestApp();
  // Sign directly with no `id` in the payload. The mintTestJwt helper defaults
  // id to 1, and overriding with { id: undefined } would rely on jwt.sign's
  // JSON.stringify dropping undefined — brittle. Sign without the helper.
  const token = jwt.sign(
    { email: 'test@dailyforge.local' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_token' });
});

// Happy path: valid positive-integer id passes the middleware. Targets a
// route that auth-gates AND validates body before any DB query, so a 400
// proves auth was accepted and body validation ran. Mirrors the T6 smoke #4
// pattern (POST /api/users/pillar-levels with empty body → 400).
test('JWT with valid positive-integer id passes authenticate', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .post('/api/users/pillar-levels')
    .set('Authorization', bearerHeader())
    .send({});
  assert.equal(res.status, 400);
});

// Regression-guard for the existing 401 wording.
test('Missing Authorization header returns 401 Missing token', async () => {
  const { app } = buildTestApp();
  const res = await request(app).get('/api/users/profile');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'Missing token' });
});

// Regression-guard for the existing 401 wording.
test('Malformed JWT returns 401 Invalid token', async () => {
  const { app } = buildTestApp();
  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', 'Bearer garbage');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'Invalid token' });
});

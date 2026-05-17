import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env.js';

// Default to a sensible authenticated payload; override per test (e.g.
// S15-T7 doctors `id` to exercise the authenticate middleware's integer
// validation).
export function mintTestJwt(payload = {}) {
  const finalPayload = { id: 1, email: 'test@dailyforge.local', ...payload };
  return jwt.sign(finalPayload, config.jwt.secret, { expiresIn: '1h' });
}

export function bearerHeader(payload = {}) {
  return `Bearer ${mintTestJwt(payload)}`;
}

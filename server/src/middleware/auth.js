import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import sentryUser from './sentryUser.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret);
    // S15-T7: validate id at the boundary so route handlers can trust
    // req.user.id is a positive integer without re-coercing. Number.isInteger
    // is strict — rejects strings, decimals, and undefined — so no coercion
    // needed (coercing would silently accept string-digit ids like '123').
    if (!Number.isInteger(decoded.id) || decoded.id <= 0) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// S15-T3: standard auth bundle — verify JWT, then propagate user id to Sentry
// scope. Use authChain via `router.use(...authChain)` for whole-router gating,
// or `(...authChain, handler)` for per-route gating. sentryUser is a no-op when
// req.user is absent, but the design intent is auth-gated paths only.
export const authChain = [authenticate, sentryUser];

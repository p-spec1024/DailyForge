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
    req.user = jwt.verify(token, config.jwt.secret);
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

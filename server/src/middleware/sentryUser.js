// S15-T3: After authenticate, attach the JWT subject as Sentry user context.
// Only `id` is propagated — no email, no username. Mirrors S15-T2 client-side
// AuthProvider scope discipline.
//
// Per-request isolation: we set the user on the isolation scope (not via the
// shorthand Sentry.setUser, which targets the current scope). expressIntegration
// gives each request its own isolation scope via OTel AsyncLocalStorage, so
// pinning here means the user attribution survives any nested withScope() a
// route handler creates and never leaks across concurrent requests. Belt-and-
// braces against future code paths that bypass the OTel context (workers,
// queue consumers, manual scope nesting).

import * as Sentry from '@sentry/node';

export default function sentryUser(req, _res, next) {
  if (req.user?.id != null) {
    Sentry.getIsolationScope().setUser({ id: String(req.user.id) });
  }
  next();
}

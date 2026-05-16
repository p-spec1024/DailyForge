// S15-T3: Loaded via `node --import` so initSentry() runs before any other
// module import, including Express. Required for Sentry's auto-instrumentation
// (which patches http/express at module-load time) to take effect.
//
// Without --import, `import` statements at the top of src/index.js would be
// hoisted and Express would load before initSentry() ran — the auto-instrument
// would no-op.
//
// dotenv/config is loaded HERE (not just in config/env.js) because the
// --import chain runs before src/index.js, so process.env.SENTRY_DSN wouldn't
// otherwise be set in time for initSentry() to read it.
//
// config/env.js also imports dotenv/config — intentional duplication. Seed
// scripts (db:migrate, db:seed:*) bypass --import and need their own load.
// dotenv is idempotent (won't overwrite already-set vars), so double-loading
// is safe.

import 'dotenv/config';
import { initSentry } from './sentry.js';
initSentry();

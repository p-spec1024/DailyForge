import { createApp } from '../../src/index.js';

// Single-test app builder. Returns { app } today; later tickets may attach
// lifecycle hooks (Sentry test toggles, DB pool draining) without rewriting
// every test call site.
export function buildTestApp() {
  const app = createApp();
  return { app };
}

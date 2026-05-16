// S15-T3: Sentry Node integration. DSN-gated init.
//
// PII gate: sendDefaultPii: false is the SDK floor. The real geographic-PII
// gate is the org-level "Prevent Storing of IP Addresses" setting in the
// Sentry web console — confirmed ON during S15-T2. Both layers are required;
// the SDK flag alone is not enough (Sentry derives geography server-side from
// the request IP unless the org toggle is on). Documented in
// docs/ARCHITECTURE.md §8.2.

import * as Sentry from '@sentry/node';
import { readFileSync } from 'node:fs';

function readPkgVersion() {
  try {
    const pkgUrl = new URL('../../package.json', import.meta.url);
    return JSON.parse(readFileSync(pkgUrl, 'utf8')).version;
  } catch {
    return null;
  }
}

export function initSentry() {
  // Idempotency guard: a second init() call in v10 spawns a parallel client
  // (duplicate events, leaked transports). Guards against re-import via
  // --watch reload, in-process createApp() spawns, and test-harness re-entry.
  if (Sentry.getClient()) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const version = process.env.npm_package_version ?? readPkgVersion();
  if (!version) {
    console.warn('[sentry] release tag unavailable — release tracking disabled');
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: version ? `dailyforge-server@${version}` : undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    integrations: [Sentry.expressIntegration()],
  });
}

export function isSentryEnabled() {
  return Boolean(process.env.SENTRY_DSN);
}

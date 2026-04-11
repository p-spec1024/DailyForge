import pg from 'pg';
import { config } from '../config/env.js';

// Neon free tier allows a small number of concurrent connections per project.
// Cap the pool well below that ceiling and recycle idle clients fast so
// `node --watch` reloads and serverless cold starts don't pile up zombies.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
  max: Number(process.env.PG_POOL_MAX) || 5,
  idleTimeoutMillis: 10_000,         // release idle clients after 10s
  connectionTimeoutMillis: 5_000,    // fail fast instead of hanging the request
  allowExitOnIdle: true,             // let the process exit cleanly when idle
});

pool.on('error', (err) => {
  // Log and keep serving — exiting on a single dropped connection turns a
  // transient Neon hiccup into a full outage.
  console.error('Unexpected database pool error:', err);
});

// Drain the pool on shutdown so the next `node --watch` restart starts clean.
async function shutdown(signal) {
  console.log(`Received ${signal}, closing database pool…`);
  try {
    await pool.end();
  } catch (err) {
    console.error('Error closing pool:', err);
  } finally {
    process.exit(0);
  }
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

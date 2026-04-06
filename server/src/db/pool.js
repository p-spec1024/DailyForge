import pg from 'pg';
import { config } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  process.exit(1);
});

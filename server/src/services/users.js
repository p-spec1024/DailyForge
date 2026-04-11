import { pool } from '../db/pool.js';

export async function getUserUnitSystem(userId) {
  const { rows } = await pool.query('SELECT unit_system FROM users WHERE id = $1', [userId]);
  return rows[0]?.unit_system === 'imperial' ? 'imperial' : 'metric';
}

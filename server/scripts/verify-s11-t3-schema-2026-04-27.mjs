import 'dotenv/config';
import { pool } from '../src/db/pool.js';

async function main() {
  for (const t of ['focus_areas', 'focus_muscle_keywords', 'focus_content_compatibility']) {
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
      [t],
    );
    console.log(`\n=== ${t} ===`);
    for (const r of cols.rows) {
      console.log(`  ${r.column_name.padEnd(14)} ${r.data_type.padEnd(28)} null=${r.is_nullable} def=${r.column_default || ''}`);
    }
    const idx = await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1 ORDER BY indexname`,
      [t],
    );
    for (const r of idx.rows) console.log(`  idx: ${r.indexname}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());

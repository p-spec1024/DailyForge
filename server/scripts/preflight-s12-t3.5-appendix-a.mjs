// S12-T3.5 pre-flight: verify Appendix A matrix vs live DB.
// Computes (focus, level, bracket) → state for all 75 cells using the spec's
// eligibility rules, compares against the spec's Appendix A. Stops if any disagrees.
// Run: node --env-file=.env scripts/preflight-s12-t3.5-appendix-a.mjs

import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const STATE_FOCUSES = ['energize', 'calm', 'focus', 'sleep', 'recover'];
const LEVELS        = ['beginner', 'intermediate', 'advanced'];
const LEVEL_RANK    = { beginner: 1, intermediate: 2, advanced: 3 };

const BRACKET_TABLE = {
  '0-10':    { window_min: 1,  window_max: 10, centering: 1, reflection: 1, is_endless: false },
  '10-20':   { window_min: 10, window_max: 20, centering: 2, reflection: 2, is_endless: false },
  '21-30':   { window_min: 21, window_max: 30, centering: 2, reflection: 2, is_endless: false },
  '30-45':   { window_min: 31, window_max: 45, centering: 3, reflection: 3, is_endless: false },
  'endless': { window_min: null, window_max: null, centering: 2, reflection: 2, is_endless: true },
};

// Per Amendment 1 v1.1 (Apr 29, 2026, midday): Path A — spec eligibility formula
// stays; matrix updated to match live data. Two cells corrected from v1.0 of
// the amendment (focus/intermediate/30-45 and sleep/beginner/21-30 → locked).
// Cell totals: 39 available / 20 locked_by_level / 16 empty.
const APPENDIX_A = {
  energize: {
    beginner:     { '0-10': 'available', '10-20': 'available',       '21-30': 'empty',           '30-45': 'empty',           'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available',       '21-30': 'locked_by_level', '30-45': 'locked_by_level', 'endless': 'available' },
    advanced:     { '0-10': 'available', '10-20': 'available',       '21-30': 'available',       '30-45': 'available',       'endless': 'available' },
  },
  calm: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': 'locked_by_level', '30-45': 'locked_by_level', 'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available', '21-30': 'available',       '30-45': 'locked_by_level', 'endless': 'available' },
    advanced:     { '0-10': 'available', '10-20': 'available', '21-30': 'available',       '30-45': 'available',       'endless': 'available' },
  },
  focus: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': 'locked_by_level', '30-45': 'locked_by_level', 'endless': 'available' },
    intermediate: { '0-10': 'empty',     '10-20': 'available', '21-30': 'available',       '30-45': 'locked_by_level', 'endless': 'available' },
    advanced:     { '0-10': 'empty',     '10-20': 'available', '21-30': 'available',       '30-45': 'available',       'endless': 'available' },
  },
  sleep: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': 'locked_by_level', '30-45': 'empty', 'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available', '21-30': 'locked_by_level', '30-45': 'empty', 'endless': 'available' },
    advanced:     { '0-10': 'available', '10-20': 'available', '21-30': 'available',       '30-45': 'empty', 'endless': 'available' },
  },
  recover: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': 'locked_by_level', '30-45': 'locked_by_level', 'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available', '21-30': 'locked_by_level', '30-45': 'locked_by_level', 'endless': 'available' },
    advanced:     { '0-10': 'empty',     '10-20': 'available', '21-30': 'available',       '30-45': 'available',       'endless': 'available' },
  },
};

function durationsAt(row, level) {
  return {
    min: row[`${level}_duration_min`],
    max: row[`${level}_duration_max`],
  };
}

// Eligibility check per spec §getAvailableDurations.
// For a numbered bracket, the practice window is [window_min - centering - reflection,
// window_max - centering - reflection], floored at 1 since durations are positive.
// A technique fits if both level columns are non-NULL and the technique range
// overlaps the practice window.
function fitsBracket(row, level, bracketId) {
  const cfg = BRACKET_TABLE[bracketId];
  const { min, max } = durationsAt(row, level);
  if (min == null || max == null) return false;
  if (cfg.is_endless) return true;
  const practiceMin = Math.max(1, cfg.window_min - cfg.centering - cfg.reflection);
  const practiceMax = cfg.window_max - cfg.centering - cfg.reflection;
  return Math.max(min, practiceMin) <= Math.min(max, practiceMax);
}

async function loadFocusMainPool(focusSlug) {
  const { rows } = await pool.query(
    `SELECT bt.id, bt.name, bt.difficulty,
            bt.beginner_duration_min, bt.beginner_duration_max,
            bt.intermediate_duration_min, bt.intermediate_duration_max,
            bt.advanced_duration_min, bt.advanced_duration_max
       FROM focus_content_compatibility fcc
       JOIN focus_areas fa ON fa.id = fcc.focus_id
       JOIN breathwork_techniques bt ON bt.id = fcc.content_id
      WHERE fa.slug = $1
        AND fcc.role = 'main'
        AND fcc.content_type = 'breathwork'
        AND bt.standalone_compatible = true
      ORDER BY bt.difficulty, bt.name`,
    [focusSlug]
  );
  return rows;
}

function classifyCell(pool, userLevel, bracketId) {
  const userRank = LEVEL_RANK[userLevel];
  let availableCount = 0;
  let unlocksAt = null;

  for (const row of pool) {
    // Engine safety gate: skip if technique's difficulty > user level.
    // (All current main-eligible techniques are difficulty=beginner; gate is mostly trivial.)
    if (LEVEL_RANK[row.difficulty] > userRank) continue;

    // Check fit at user's level columns.
    if (fitsBracket(row, userLevel, bracketId)) {
      availableCount++;
      continue;
    }

    // Not fit at user level. Walk higher levels — the same technique's
    // `<higher-level>_duration_*` columns may fit. The lowest such level is
    // `unlocks_at` (UI hint: "Level up to unlock").
    for (const tryLevel of LEVELS) {
      if (LEVEL_RANK[tryLevel] <= userRank) continue;
      if (fitsBracket(row, tryLevel, bracketId)) {
        if (!unlocksAt || LEVEL_RANK[tryLevel] < LEVEL_RANK[unlocksAt]) {
          unlocksAt = tryLevel;
        }
        break;
      }
    }
  }

  if (availableCount > 0) return { state: 'available', sample_count: availableCount };
  if (unlocksAt) return { state: 'locked_by_level', sample_count: 0, unlocks_at: unlocksAt };
  return { state: 'empty', sample_count: 0 };
}

async function main() {
  console.log('S12-T3.5 Appendix A diagnostic\n');

  const liveMatrix = {};
  for (const focus of STATE_FOCUSES) {
    const pool_ = await loadFocusMainPool(focus);
    console.log(`Pool for ${focus}: ${pool_.length} technique(s)`);
    for (const r of pool_) {
      console.log(
        `  - ${r.name} (${r.difficulty})  ` +
        `B[${r.beginner_duration_min ?? '∅'}-${r.beginner_duration_max ?? '∅'}]  ` +
        `I[${r.intermediate_duration_min ?? '∅'}-${r.intermediate_duration_max ?? '∅'}]  ` +
        `A[${r.advanced_duration_min ?? '∅'}-${r.advanced_duration_max ?? '∅'}]`
      );
    }
    liveMatrix[focus] = {};
    for (const level of LEVELS) {
      liveMatrix[focus][level] = {};
      for (const bracketId of Object.keys(BRACKET_TABLE)) {
        liveMatrix[focus][level][bracketId] = classifyCell(pool_, level, bracketId);
      }
    }
  }

  console.log('\nLive matrix:\n');
  const ICON = { available: '✅', locked_by_level: '🔒', empty: '⬜' };
  for (const focus of STATE_FOCUSES) {
    console.log(`\n### ${focus}`);
    console.log('| Level         | 0-10 | 10-20 | 21-30 | 30-45 | endless |');
    console.log('|---------------|------|-------|-------|-------|---------|');
    for (const level of LEVELS) {
      const row = level.padEnd(13);
      const cells = Object.keys(BRACKET_TABLE)
        .map((b) => {
          const cell = liveMatrix[focus][level][b];
          return ICON[cell.state] + (cell.unlocks_at ? `(→${cell.unlocks_at[0]})` : '');
        });
      console.log(`| ${row} | ${cells[0].padEnd(4)} | ${cells[1].padEnd(5)} | ${cells[2].padEnd(5)} | ${cells[3].padEnd(5)} | ${cells[4].padEnd(7)} |`);
    }
  }

  console.log('\n\nDiff vs Appendix A:\n');
  let disagreements = 0;
  for (const focus of STATE_FOCUSES) {
    for (const level of LEVELS) {
      for (const bracketId of Object.keys(BRACKET_TABLE)) {
        const live = liveMatrix[focus][level][bracketId].state;
        const expected = APPENDIX_A[focus][level][bracketId];
        if (live !== expected) {
          disagreements++;
          console.log(`  DIFF  ${focus} / ${level} / ${bracketId}: live='${live}' vs spec='${expected}'`);
        }
      }
    }
  }

  if (disagreements === 0) {
    console.log('  All 75 cells match Appendix A. Safe to proceed.');
  } else {
    console.log(`\n==> STOP: ${disagreements} cell(s) disagree.`);
  }
  process.exitCode = disagreements === 0 ? 0 : 2;
}

main()
  .catch((err) => { console.error('Diagnostic crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());

// S12-T6: swap-counter + exclusion service.
// Spec: Trackers/S12-T6-swap-counter-exclusion-spec.md
//
// === The swap-counter rule (verbatim from spec §"The swap-counter rule — exact restatement") ===
//
// When a strength swap occurs (chosen_exercise_id <> current_exercise_id):
//   1. Increment. UPSERT (user_id, current_exercise_id) into exercise_swap_counts.
//      New row → swap_count=1. Existing row → swap_count++. Always last_swapped_at=NOW().
//   2. Read back. SELECT swap_count, prompt_state.
//   3. Decide prompt.
//      - swap_count = 3 AND prompt_state = 'never_prompted'  → should_prompt = true.
//        Server transitions prompt_state to 'prompted_keep' immediately
//        (Decision 5 — implicit-keep-on-dismissal).
//      - swap_count = 6 AND prompt_state = 'prompted_keep'   → should_prompt = true.
//        Server does NOT transition on this fire — final prompt.
//      - Otherwise → should_prompt = false.
//   4. Respond.
//
// When the user responds via /exclude or /keep-suggesting:
//   - /exclude → INSERT into user_excluded_exercises, UPDATE prompt_state='excluded'.
//   - /keep-suggesting → UPDATE prompt_state='prompted_keep' (idempotent; guarded
//     so it can't downgrade an already-'excluded' row).
//
// === Spec deviation from data layer (documented per T5 pattern) ===
//
// user_excluded_exercises shape: spec pseudo-SQL used (user_id, exercise_id) but
// live schema is (id, user_id, content_type, content_id, excluded_at) per S11-T1
// pillar-aware design. Engine reads via:
//     SELECT content_id FROM user_excluded_exercises
//     WHERE user_id = $1 AND content_type = $2;
// T6 endpoints write with content_type='strength' and content_id=<exercise id>.
// UNIQUE is on (user_id, content_type, content_id). Verified by pre-flight script.
//
// === Decision-block reminder ===
//
// Decision 5 (auto-transition to 'prompted_keep' on first prompt fire) is NOT a bug.
// It treats prompt-dismissal-without-response as implicit "keep suggesting." Without
// it, the prompt re-fires on every swap from count 3 onward, which is annoying. If a
// future maintainer sees this and thinks "we should wait for explicit response,"
// they should re-read spec Decision 5 first. The auto-transition is the answer.

import { pool } from '../db/pool.js';

/**
 * Increments the swap count for an exercise the user is swapping AWAY from.
 * Returns the read-back state for the caller to decide whether to prompt.
 *
 * Single transaction: UPSERT + read-back + conditional state-transition.
 * Caller passes a pg client `tx` if part of a larger transaction; otherwise
 * a fresh client is acquired internally and released on completion.
 *
 * INVARIANT: when `tx` is non-null, the caller MUST have already issued
 * BEGIN on it. This service does NOT start nor commit a passed transaction —
 * the caller owns transaction lifecycle. With a null `tx`, the service owns
 * BEGIN/COMMIT/ROLLBACK on a freshly-acquired client.
 *
 * @param {number} userId
 * @param {number} exerciseId           the exercise being swapped AWAY from
 * @param {pg.Client | null} tx         optional existing transaction client (must be in-transaction)
 * @returns {Promise<{swap_count: number, prompt_state: string, should_prompt: boolean}>}
 *   prompt_state is the AFTER-transition state (e.g. count=3 returns
 *   'prompted_keep' even though the row was 'never_prompted' going in).
 */
export async function incrementSwap(userId, exerciseId, tx = null) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError(`userId must be a positive integer; got ${userId}`);
  }
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
    throw new TypeError(`exerciseId must be a positive integer; got ${exerciseId}`);
  }

  const ownClient = tx == null;
  const client = tx ?? (await pool.connect());
  try {
    if (ownClient) await client.query('BEGIN');

    // Step 1+2: UPSERT and read-back via RETURNING.
    // NOTE: ON CONFLICT DO UPDATE acquires a row-level write lock that is
    // held until commit. Concurrent incrementSwap calls for the same
    // (user_id, exercise_id) serialize behind this lock — that is what makes
    // the auto-transition UPDATE below safe without an explicit FOR UPDATE.
    // Do NOT split the UPSERT and the auto-transition into separate
    // transactions; the lock guarantee evaporates the moment you do.
    const upsert = await client.query(
      `INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, last_swapped_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, exercise_id)
       DO UPDATE SET
         swap_count      = exercise_swap_counts.swap_count + 1,
         last_swapped_at = NOW()
       RETURNING swap_count, prompt_state`,
      [userId, exerciseId],
    );
    const { swap_count, prompt_state } = upsert.rows[0];

    // Step 3: decide should_prompt per Decision 4.
    const should_prompt =
      (swap_count === 3 && prompt_state === 'never_prompted') ||
      (swap_count === 6 && prompt_state === 'prompted_keep');

    // Step 4: auto-transition to 'prompted_keep' on the FIRST prompt only
    // (Decision 5). Guarded WHERE: never_prompted only — never rewrite excluded.
    let final_prompt_state = prompt_state;
    if (should_prompt && swap_count === 3) {
      const t = await client.query(
        `UPDATE exercise_swap_counts
            SET prompt_state = 'prompted_keep'
          WHERE user_id = $1 AND exercise_id = $2
            AND prompt_state = 'never_prompted'
          RETURNING prompt_state`,
        [userId, exerciseId],
      );
      if (t.rows.length > 0) final_prompt_state = t.rows[0].prompt_state;
    }

    if (ownClient) await client.query('COMMIT');

    return { swap_count, prompt_state: final_prompt_state, should_prompt };
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (ownClient) client.release();
  }
}

/**
 * Sets the prompt_state for a (user, exercise) row in exercise_swap_counts.
 * UPSERTs if no row exists (Decision 7 — non-swap-origin /exclude is allowed).
 * Guard: never downgrades an existing 'excluded' row (excluded is terminal,
 * Appendix A state diagram). Returns whether the row was already in the
 * target state.
 *
 * Used by /api/exercises/:id/exclude and /api/exercises/:id/keep-suggesting.
 *
 * INVARIANT: same as incrementSwap — when `tx` is non-null, the caller MUST
 * have already issued BEGIN. This service does not start/commit a passed tx.
 *
 * @param {number} userId
 * @param {number} exerciseId
 * @param {'excluded' | 'prompted_keep'} state  target prompt_state
 * @param {pg.Client | null} tx                 optional existing transaction client (must be in-transaction)
 * @returns {Promise<{prompt_state: string, was_inserted: boolean, was_blocked: boolean}>}
 *   prompt_state: the row's prompt_state AFTER this call
 *   was_inserted: true if a new row was created (no prior swap counter)
 *   was_blocked:  true if the UPDATE was guarded (e.g. tried to rewrite excluded)
 */
export async function setPromptState(userId, exerciseId, state, tx = null) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError(`userId must be a positive integer; got ${userId}`);
  }
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
    throw new TypeError(`exerciseId must be a positive integer; got ${exerciseId}`);
  }
  if (state !== 'excluded' && state !== 'prompted_keep') {
    throw new TypeError(`state must be 'excluded' or 'prompted_keep'; got ${state}`);
  }

  const ownClient = tx == null;
  const client = tx ?? (await pool.connect());
  try {
    if (ownClient) await client.query('BEGIN');

    // Snapshot prior state for `was_inserted` / `was_blocked` semantics.
    const prior = await client.query(
      `SELECT prompt_state FROM exercise_swap_counts
        WHERE user_id = $1 AND exercise_id = $2`,
      [userId, exerciseId],
    );
    const had_row = prior.rows.length > 0;
    const prior_state = had_row ? prior.rows[0].prompt_state : null;

    // 'excluded' is terminal: any /exclude write proceeds; any /keep-suggesting
    // write while currently 'excluded' is blocked.
    if (state === 'excluded') {
      // Always proceed. Excluded is the terminal state; this is the transition
      // INTO it from any prior state (including idempotent re-write).
      await client.query(
        `INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, prompt_state)
         VALUES ($1, $2, 0, 'excluded')
         ON CONFLICT (user_id, exercise_id)
         DO UPDATE SET prompt_state = 'excluded'`,
        [userId, exerciseId],
      );

      if (ownClient) await client.query('COMMIT');
      return {
        prompt_state: 'excluded',
        was_inserted: !had_row,
        was_blocked: false,
      };
    }

    // state === 'prompted_keep' — guarded UPSERT so a row already in 'excluded'
    // is NOT downgraded. The WHERE on the UPDATE branch enforces this.
    await client.query(
      `INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, prompt_state)
       VALUES ($1, $2, 0, 'prompted_keep')
       ON CONFLICT (user_id, exercise_id)
       DO UPDATE SET prompt_state = 'prompted_keep'
         WHERE exercise_swap_counts.prompt_state IN ('never_prompted', 'prompted_keep')`,
      [userId, exerciseId],
    );

    // Re-read to determine final state and whether the WHERE blocked us.
    const after = await client.query(
      `SELECT prompt_state FROM exercise_swap_counts
        WHERE user_id = $1 AND exercise_id = $2`,
      [userId, exerciseId],
    );
    const final_state = after.rows[0].prompt_state;
    const was_blocked = had_row && prior_state === 'excluded' && final_state === 'excluded';

    if (ownClient) await client.query('COMMIT');
    return {
      prompt_state: final_state,
      was_inserted: !had_row,
      was_blocked,
    };
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (ownClient) client.release();
  }
}

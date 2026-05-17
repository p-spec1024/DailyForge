// Suggestion engine — error classes.
//
// NotImplementedError: existing exported class, used by test harness.
// EngineContractError: shell-only class defined here per S15-T4 AC #6. The
//   migration of existing RangeError throw sites to EngineContractError is
//   deferred to S16-T2 — this class is wired without callers in S15-T4 on
//   purpose, to keep behavior byte-identical with the pre-extraction monolith.
//   The route-level mapRangeErrorToCode at routes/sessions.js:66-74 still
//   relies on RangeError message substrings; S16-T2 will rewire it to read
//   typed code from EngineContractError instead.

export class NotImplementedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * EngineContractError — shell only (S15-T4 AC #6).
 *
 * Carries a stable contract code (e.g. 'invalid_bracket', 'state_focus_requires_bracket')
 * so the HTTP layer can map directly to a 400-class error code without
 * matching on free-text message substrings.
 *
 * NOT YET USED. S16-T2 will:
 *   - Replace RangeError throws in the engine with EngineContractError throws
 *     carrying the matching code.
 *   - Replace routes/sessions.js's mapRangeErrorToCode substring switch with
 *     a typed read of error.code.
 *
 * Defined here so the class identity is stable across the S15-T4 → S16-T2
 * transition (importers can already reference it).
 */
export class EngineContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EngineContractError';
    this.code = code;
  }
}

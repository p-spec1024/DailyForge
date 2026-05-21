// Suggestion engine — error classes.
//
// NotImplementedError: used by test harnesses for unimplemented engine paths.
// EngineContractError: typed contract failure for engine validation errors.
//   The HTTP layer (routes/sessions.js) maps EngineContractError to a 400
//   response carrying { error: code, code, details }. See S16-T2 mapping at
//   Trackers/S16-T2-error-mapping.md for the full code enum.

export class NotImplementedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class EngineContractError extends Error {
  constructor({ code, message, details }) {
    super(message);
    this.name = 'EngineContractError';
    this.code = code;
    this.details = details;
  }
}

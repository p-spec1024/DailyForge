// Mutation guard for one-shot scripts that write to the database.
//
// Call `assertSafeMutation()` at the top of any script (after imports, before
// the script touches the pool). The guard throws unless one of these is true:
//
//   - NODE_ENV is anything other than 'production' (e.g. 'staging', 'development',
//     or undefined — the local-dev defaults after S15-T1)
//   - NODE_ENV === 'production' AND ALLOW_PROD_MUTATION === 'true' (explicit
//     opt-in for the rare intentional prod write)
//
// The two-variable override is deliberate: a single typo cannot rewrite
// production data. Server runtime (`server/src/index.js`, the pool, route
// handlers) does NOT use this — it's only for scripts under server/scripts/
// and server/src/db/migrate.js + seeds.

export function assertSafeMutation() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_MUTATION !== 'true') {
    throw new Error(
      'Refusing to run mutating script against production database. ' +
      'Set ALLOW_PROD_MUTATION=true to override.'
    );
  }
}

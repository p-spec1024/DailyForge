# Sprint 15 Plan — Foundation (Stabilization Part 1)

**Sprint goal:** Production-readiness foundation. Ship the infrastructure, observability, and engine refactor that gate broader invite beta.

**Theme:** Foundation. Not features.
**Ticket count:** 7
**Estimated duration:** 4–6 weeks
**Branch strategy:** Sprint-chained off `main`, single `--no-ff` merge + `sprint-15-close` annotated tag at sprint close (per PI #20).
**Predecessor:** Sprint 14 close.
**Successors:** Sprint 16 (Engine & API hardening), Sprint 17 (Security, safety, polish), Sprint 18 (UI redesign).

---

## Sprint context

This is the first of three stabilization sprints. ChatGPT's May 15, 2026 code review identified ~50 actionable items separating the current codebase from enterprise-grade production-readiness. The work has been split across Sprints 15-17 (non-UI) and Sprint 18 (UI redesign). See `Trackers/CHATGPT_REVIEW_TRACEABILITY.md` for the full mapping.

Sprint 15 specifically addresses **the foundation layer** — items that block every subsequent piece of work:
- Without environment separation, no smoke tests or migrations are safe (S15-T1).
- Without crash reporting, beta failures are invisible (S15-T2, S15-T3).
- Without engine extraction, future filter dimensions (equipment, injury) become very risky (S15-T4).
- Without CI, refactors during S15-S17 risk breaking the app silently (S15-T5).
- Without proper auth validation, security posture stays weak (S15-T6).
- Without verified media separation, ImageKit risk is unknown (S15-T7).

Sprint 15 is intentionally infrastructure-heavy. No product features land in this sprint. That is the trade.

---

## Ticket overview

| Ticket | Title | Risk | Touches both `app/` + `server/`? |
|---|---|---|---|
| S15-T1 | Environment separation (Neon staging + prod guards + API_BASE_URL dart-define) | High | Yes |
| S15-T2 | Sentry — Flutter integration | Medium | App only |
| S15-T3 | Sentry — Node integration | Medium | Server only |
| S15-T4 | Suggestion engine extraction (FS #160) — behavior-preserving | High | Server only |
| S15-T5 | CI pipeline (GitHub Actions) + root `package.json` cleanup | Low | Both |
| S15-T6 | Auth middleware integer-id validation + route handler simplification | Medium | Server only |
| S15-T7 | ImageKit prod/test separation audit + remediation | Low (probably) | Server only |

---

## S15-T1 — Environment separation

**Priority:** #1. Nothing else in S15-S17 is safe without this.
**Estimated time:** 1 week solo dev (multi-step coordination)
**Touches:** `server/`, `app/`, infrastructure (Neon, environment config)
**`.5`-suffix risk:** Medium. Pre-flight against live Neon may surface drift between expected and actual schema/data state.

### Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding #1, #5. Code review §3.1, §3.5, §6 P0.

### Problem

Three coupled problems treated as one ticket because they all relate to environment configuration:

1. **No staging DB.** Local Node points at production Neon. Every migration, seed, smoke test runs against real user data.
2. **No prod mutation guard.** Scripts can rewrite production rows with no environment gate.
3. **LAN IP fallback in `ApiConfig`.** `api_config.dart` falls back to `192.168.0.204` when no env is set. A production build could ship pointing at a private IP.

### Acceptance criteria

1. **Neon staging branch exists** with the same schema as production. Created via Neon console (branch from `production`). Named `staging`.
2. **`.env.staging` template** exists at `server/.env.staging.example` documenting all required env vars for staging.
3. **`DATABASE_URL`** in local dev points at staging branch by default. Switching to prod requires explicit `NODE_ENV=production` + a manual env-var change (not a one-character flip).
4. **Prod mutation guard** added to:
   - `server/scripts/test-suggestion-engine-t2.js` and any other smoke harness
   - `server/scripts/lib/smoke-fixtures.mjs`
   - `server/src/db/migrate.js`
   - All seed scripts under `server/scripts/`
   - Pattern: `if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_MUTATION !== 'true') { throw new Error('Refusing to run mutating script against production database') }`
5. **`ApiConfig.baseUrl` refactor.** Replace the `192.168.0.204` LAN fallback with:
   ```dart
   static const String baseUrl = String.fromEnvironment(
     'API_BASE_URL',
     defaultValue: 'http://localhost:3001/api',
   );
   ```
   Document the build command for production: `flutter build apk --dart-define=API_BASE_URL=https://api.dailyforge.app/api`.
6. **FS #196 retired.** The `/api` trailing convention (FS #196) becomes the documented standard, called out in `ARCHITECTURE.md` §4.6.
7. **Smoke harness re-run against staging** confirms zero behavior change.
8. **Documentation updated:** `ARCHITECTURE.md` §3 (repo layout) + §4.3 (database layer) updated to reflect the new prod/staging split.

### Pre-flight diagnostics (per PI #14)

Before writing any code, run pre-flight to verify:

- **(a) Live Neon shape:** Connect to production Neon and document the exact current schema (tables, columns, indexes, constraints, functions, triggers). Save to `Trackers/S15-T1-prod-schema-snapshot.md`. This becomes the contract that `staging` must replicate exactly.
- **(b) Script inventory:** `grep -r "DATABASE_URL\|pg.Pool\|new Pool" server/` to find every place that opens a DB connection. The mutation guard must wrap every one.
- **(c) Environment file inventory:** List every `.env*` file and document what's in each. There must be no secrets committed.
- **(d) `ApiConfig` usage audit:** `grep -r "ApiConfig.baseUrl\|192.168.0.204" app/` to find every consumer. Confirm none hardcode the LAN IP.

If any pre-flight check surfaces drift from what this spec assumes, halt and report. Do not proceed to coding.

### Build steps (after pre-flight greenlight)

1. Create Neon staging branch via console.
2. Confirm staging schema matches prod (run a diff via `pg_dump --schema-only` against both).
3. Add `.env.staging.example` with documented vars.
4. Update local dev to use staging by default.
5. Add mutation guards to every script identified in pre-flight.
6. Refactor `ApiConfig` to use `String.fromEnvironment`.
7. Update build documentation.
8. Run full smoke harness against staging. Verify zero behavior change.
9. Update `ARCHITECTURE.md` sections.
10. Stop. Report. Wait for greenlight before commit.

### Test plan

- Run smoke harness with `NODE_ENV=production` and no `ALLOW_PROD_MUTATION`: should throw before any DB write.
- Run smoke harness against staging: should complete normally.
- Build Flutter APK without `--dart-define=API_BASE_URL`: should use localhost fallback (not LAN IP).
- Build Flutter APK with `--dart-define`: should use the supplied URL.

### Rollback plan

If staging branch causes unexpected issues, revert local `.env` to prod URL and continue. The staging branch can persist with zero risk to prod. Mutation guards can be removed by reverting the commit if they're causing false positives.

### Out of scope

- Local Postgres setup (deferred per ChatGPT's own recommendation — "do not start with complex local Postgres mirror")
- Automated nightly staging backups (Sprint 16+)
- Staging URL routing for the Flutter app to hit a deployed staging API (Sprint 16+ if needed)

---

## S15-T2 — Sentry: Flutter integration

**Priority:** #2 — observability for the beta launch.
**Estimated time:** 3-4 days
**Touches:** `app/`
**`.5`-suffix risk:** Low. Sentry Flutter is a well-trodden integration path.

### Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding #37. Code review §6 P0, §7.

### Problem

No crash reporting. Beta users will hit bugs that you'll never see unless they manually report. For an enterprise app, this is unacceptable.

### Acceptance criteria

1. `sentry_flutter` package added to `pubspec.yaml`.
2. Sentry DSN configured via `--dart-define=SENTRY_DSN=...` (production DSN), with `SENTRY_DSN` empty by default (no-op in dev unless explicitly set).
3. `SentryFlutter.init` wired in `main.dart` before `runApp`, with:
   - Release name from `app_version + build_number` (Pubspec).
   - Environment tag from `--dart-define=APP_ENV=...` (default `dev`).
   - Sample rate: `tracesSampleRate: 0.2` for performance traces (adjust later based on volume).
4. User context populated after login: `SentryFlutter.configureScope` sets `user.id` from JWT (not `email` — PII minimization).
5. Source map upload script committed at `app/scripts/upload-sentry-symbols.sh` (called manually post-release).
6. One deliberate crash test confirms the integration works end-to-end (visible in Sentry dashboard).
7. Documentation: README updated with Sentry config notes.

### Pre-flight

- Confirm Sentry organization/project exists; create if not.
- Confirm DSN available.
- `grep -r "FlutterError.onError\|PlatformDispatcher.instance.onError" app/` — if either is already overridden, the Sentry init order must preserve those overrides.

### Build steps

1. Create Sentry project (web console).
2. Add package, configure init.
3. Configure user-context scope.
4. Write source-map upload script.
5. Crash test.
6. Stop. Report. Wait for greenlight.

### Test plan

- Trigger a deliberate `throw Exception('Sentry test')` and confirm it appears in Sentry within 60s.
- Confirm user context appears on crashes after login.
- Confirm PII (email) is NOT in the captured event.

---

## S15-T3 — Sentry: Node integration

**Priority:** #3 — paired with S15-T2.
**Estimated time:** 3-4 days
**Touches:** `server/`
**`.5`-suffix risk:** Low.

### Source

Same as S15-T2.

### Problem

Backend errors logged via `console.error` are lost. No way to see production server errors, no performance traces on engine routes, no alerting on error rate spikes.

### Acceptance criteria

1. `@sentry/node` added.
2. Sentry init at top of `server/index.js`, before app construction.
3. `Sentry.Handlers.requestHandler()` and `Sentry.Handlers.tracingHandler()` middleware mounted first.
4. `Sentry.Handlers.errorHandler()` mounted last.
5. Engine routes (`/api/sessions/suggest`, `/api/sessions/last`, `/api/sessions/save-as-routine`) have performance traces enabled.
6. DSN from `SENTRY_DSN` env var. Empty in dev unless explicitly set.
7. Environment tag from `NODE_ENV`.
8. Release from `npm_package_version`.
9. User context middleware populates `req.sentryUser = { id: req.user.id }` after `authenticate`.
10. One deliberate error confirms integration.
11. Documentation: `ARCHITECTURE.md` §8 (new section: Observability).

### Pre-flight

- Confirm `@sentry/node` and Express version compatibility.
- Audit existing error-handling middleware order in `index.js`.

### Build steps

1. Install package.
2. Wire Sentry middleware in correct order.
3. Configure performance tracing.
4. Add user context.
5. Error test.
6. Update `ARCHITECTURE.md`.
7. Stop. Report. Wait for greenlight.

### Test plan

- Hit a deliberately-broken endpoint, confirm Sentry receives it.
- Hit `/api/sessions/suggest`, confirm performance trace appears.
- Confirm `req.user.id` appears in event context, no email.

---

## S15-T4 — Suggestion engine extraction (FS #160)

**Priority:** #4 — highest risk ticket of the sprint.
**Estimated time:** 2 weeks
**Touches:** `server/`
**`.5`-suffix risk:** **High.** Pre-flight may surface that the extraction needs to be split into S15-T4 (constants + errors + helpers + formatters) and S15-T4.5 (recipes + pickers).

### Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding #2, #18, #51. Code review §3.2. FS #160.

### Problem

`server/src/services/suggestionEngine.js` is 1791 lines. Contains constants, validation, picker logic, recipe generation, fallback logic, error throwing, recency checks, item formatting, and public exports. Sprint 18+ work will add equipment, injury, and contraindication filters — adding more dimensions to an already-monolithic file is unsafe.

### Acceptance criteria

1. New directory `server/src/services/suggestion-engine/` with the structure from ChatGPT §3.2:
   ```
   server/src/services/suggestion-engine/
     index.js          // public API: generateSession, etc.
     constants.js      // BRACKET_TABLE, style sets, picks tables
     errors.js         // EngineContractError (typed; see S16-T2 for the rest)
     helpers.js        // compoundFilter, durationsForLevel, level rank
     pickers.js        // 5 picker functions
     item-formatters.js
     recipes/
       cross-pillar.js
       strength-only.js
       yoga-only.js
       state-focus.js
       available-durations.js
   ```
2. The original `server/src/services/suggestionEngine.js` becomes a thin re-export shim for backwards compatibility, or is deleted with its public surface preserved by `services/suggestion-engine/index.js`.
3. **Zero behavior change.** Smoke harness (`scripts/test-suggestion-engine-t2.js`) produces byte-identical output before and after the extraction.
4. Public API surface unchanged. `server/src/routes/sessions.js` imports without modification.
5. Each new file under 300 LOC.
6. `errors.js` introduces `EngineContractError` as a class but does NOT yet replace `RangeError` throws. That's S16-T2's job.
7. Tests pass: `npm test -w server` clean.
8. `/review` clean.

### Pre-flight (CRITICAL — most failure-prone step)

This ticket is exactly the kind that benefits most from pre-flight per PI #14. Before any extraction:

- **(a) Snapshot smoke output.** Run `scripts/test-suggestion-engine-t2.js` against staging, capture full output to `Trackers/S15-T4-baseline-smoke-output.txt`. This becomes the byte-identical reference.
- **(b) Throw inventory.** `grep -rn "throw new RangeError\|throw new Error" server/src/services/suggestionEngine.js`. Document every throw site, the message, and where it's caught. This map ensures errors aren't lost during extraction.
- **(c) Export inventory.** `grep -n "^export\|^module.exports" server/src/services/suggestionEngine.js`. Every export must be preserved by `index.js`.
- **(d) Internal function call graph.** Map which functions call which. Functions that are only called internally can move freely; functions called from outside the module must stay externally accessible.
- **(e) Test coverage map.** What currently exercises this engine? If smoke harness doesn't cover certain paths, those paths are at higher risk during extraction.

If any of (a)-(e) reveals unexpected structure, halt. Either patch the spec or split the ticket into T4 + T4.5.

### Build steps

1. Pre-flight complete and reviewed.
2. Create new directory + empty files.
3. Extract `constants.js` first (lowest risk).
4. Run smoke. Confirm byte-identical.
5. Extract `errors.js` (no throw-call changes yet).
6. Run smoke.
7. Extract `helpers.js`.
8. Run smoke.
9. Extract `item-formatters.js`.
10. Run smoke.
11. Extract `pickers.js`.
12. Run smoke.
13. Extract `recipes/` one file at a time, smoke after each.
14. Final `index.js` wires it all together.
15. Delete or shim original file.
16. Final smoke against baseline. Byte-identical or halt.
17. Stop. Report. Wait for greenlight.

### Test plan

- Smoke harness output byte-identical to baseline.
- `npm test -w server` clean.
- `/review` clean.
- Manual spot-check: `POST /api/sessions/suggest` from Flutter still works end-to-end.

### Rollback plan

If extraction surfaces a hidden bug, revert the commit cleanly (single commit per extraction step makes this surgical). Original file is preserved in git history; restoring is a one-line revert.

### Out of scope

- Replacing `RangeError` throws with `EngineContractError` instances (S16-T2)
- Adding new filter dimensions (equipment/injury/contraindication — Sprint 19+)
- Adding new tests beyond the existing smoke harness (S16-T3)
- Performance optimization (not blocking)

---

## S15-T5 — CI pipeline + root `package.json` cleanup

**Priority:** #5 — protects S15-S17 refactors from regressions.
**Estimated time:** 2-3 days
**Touches:** Root, `app/`, `server/`
**`.5`-suffix risk:** Low.

### Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding #4, #39, #40. Code review §3.4, §6 P1, §7.

### Problem

Two coupled problems:
1. Root `package.json` references a removed `client` workspace and stale React build scripts. Any CI workflow using these will fail immediately.
2. No CI pipeline exists. Refactors in S15-T4, S16, S17 will silently break the app without anyone noticing.

### Acceptance criteria

1. **Root `package.json` cleanup:**
   - Remove `client` from workspaces.
   - Replace `dev`, `dev:client`, `build`, and related scripts with the structure from ChatGPT §3.4:
     ```json
     {
       "scripts": {
         "dev:server": "npm run dev -w server",
         "start:server": "npm run start -w server",
         "db:migrate": "npm run db:migrate -w server",
         "db:seed": "npm run db:seed -w server",
         "app:analyze": "cd app && flutter analyze",
         "app:test": "cd app && flutter test",
         "app:run": "cd app && flutter run",
         "check": "npm run app:analyze && npm run app:test"
       },
       "workspaces": ["server"]
     }
     ```
2. **GitHub Actions workflow** at `.github/workflows/checks.yml` based on ChatGPT §7:
   - On every PR and push to `main`.
   - Flutter job: `flutter pub get` → `flutter analyze` → `flutter test`.
   - Node job: `npm install` → `node --check server/src/index.js`.
   - Both must pass for the workflow to succeed.
3. First green run merged to `main`.
4. README updated with CI badge.

### Pre-flight

- Confirm GitHub Actions is enabled on the repo.
- Confirm no pre-existing workflow file would conflict.
- Confirm `flutter analyze` currently passes on `main` (it should — but verify).
- Confirm `npm test -w server` exits 0 on `main`.

### Build steps

1. Pre-flight.
2. Update root `package.json`.
3. Confirm scripts work locally.
4. Add `.github/workflows/checks.yml`.
5. Push and verify first green run.
6. Add README badge.
7. Stop. Report. Wait for greenlight.

### Test plan

- `npm run dev:server` runs the server.
- `npm run check` runs Flutter analyze + test.
- A deliberately-broken commit (e.g., `flutter analyze` warning) is caught by CI.

### Out of scope

- Staging smoke tests via CI (Sprint 16+ once staging is stable).
- Release pipeline / APK builds (Sprint 17+).
- Test coverage thresholds (S16-T3 will set baselines).

---

## S15-T6 — Auth middleware integer-id validation

**Priority:** #6 — security hygiene.
**Estimated time:** 3-4 days
**Touches:** `server/`
**`.5`-suffix risk:** Medium. Removing defensive coercion across multiple routes may surface latent bugs.

### Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding #33, #41. Code review §5.4, §8.1.

### Problem

Current `authenticate` middleware assigns the decoded JWT payload to `req.user` without validating that `id` is a positive integer. Various route handlers defensively coerce IDs (`Number(req.user.id)`) which papers over the gap but inconsistently. A malformed JWT could trigger weird behavior downstream.

### Acceptance criteria

1. `authenticate` middleware in `server/src/middleware/auth.js` validates:
   ```js
   const decoded = jwt.verify(token, config.jwt.secret);
   const id = Number(decoded.id);
   if (!Number.isInteger(id) || id <= 0) {
     return res.status(401).json({ error: 'invalid_token' });
   }
   req.user = { ...decoded, id };
   ```
2. **Audit every route handler** that previously coerced `req.user.id`:
   - `grep -rn "Number(req.user" server/src/routes/`
   - `grep -rn "parseInt(req.user" server/src/routes/`
   - `grep -rn "req.user.id ||" server/src/routes/`
3. Remove every defensive coercion that's now redundant. `req.user.id` is guaranteed to be a positive integer.
4. New test: malformed JWT (string id, negative id, missing id) returns 401.
5. Existing tests still pass.
6. `/review` clean.

### Pre-flight

- **(a)** Document every route file that uses `req.user.id`. Count occurrences of each coercion pattern.
- **(b)** Confirm JWT payload structure — what does the auth route currently set as `id`? If it's already a number, the validation is paranoia. If it's a string (e.g., from a quirky signup flow), the validation will catch real bugs.
- **(c)** Confirm no test fixture uses a non-integer user_id (some legacy tests might).

### Build steps

1. Pre-flight.
2. Add validation to middleware + new tests.
3. Audit routes one file at a time. Remove defensive coercion.
4. Run full test suite + smoke harness after each route file.
5. Stop. Report. Wait for greenlight.

### Test plan

- Malformed JWT with non-integer id → 401.
- Valid JWT → routes work as before.
- No regression in existing route behavior.

### Out of scope

- Rate limiting (Sprint 17).
- Route validation helpers like `parsePositiveInt` (FUTURE_SCOPE F6).
- CORS hardening (Sprint 17).

---

## S15-T7 — ImageKit prod/test separation audit

**Priority:** #7 — investigation ticket, potentially small.
**Estimated time:** Investigation 1 day; remediation (if needed) up to 1 week.
**Touches:** `server/`, ImageKit configuration
**`.5`-suffix risk:** Depends on findings.

### Source

`CHATGPT_REVIEW_TRACEABILITY.md` finding #36. Code review §6 P0.

### Problem

User answer to Q5: "Don't know" whether ImageKit production keys/folders are separated from test uploads. This is a production blocker if test uploads pollute production media or if prod keys are reachable from dev.

### Acceptance criteria — investigation phase

1. Document current ImageKit configuration: which keys are in use, which folders exist, which environments use which.
2. Determine separation level. Three possible outcomes:
   - **Outcome A:** Fully separated (different ImageKit accounts or different key sets for prod vs dev). No action needed beyond documentation. Close ticket.
   - **Outcome B:** Folder-level separation only (one account, prefixed folders). Risk if dev writes to prod folders. Add upload-path guards based on `NODE_ENV`.
   - **Outcome C:** No separation. Same keys, same folders for everything. Real risk. Remediate (see below).
3. Document findings in `Trackers/S15-T7-imagekit-audit.md`.

### Acceptance criteria — remediation phase (if Outcome B or C)

1. If Outcome B: add `NODE_ENV`-based folder prefix to all uploads. Test uploads go to `test-uploads/...`, prod to `media/...`.
2. If Outcome C: create separate ImageKit project for dev/staging. Update env vars. Migrate any existing test uploads if they need preservation.
3. Update `ARCHITECTURE.md` to document the separation.
4. Add a test that confirms dev uploads land in the right folder.

### Pre-flight

- Read `server/src/services/` for ImageKit upload code.
- Check ImageKit dashboard for current account/folder/key state.
- Audit `.env` and `.env.example` for ImageKit-related vars.

### Build steps

Branched on outcome — keep investigation phase separate from remediation phase. Report after investigation, get greenlight before remediation.

### Out of scope

- CDN strategy beyond ImageKit (not in scope for stabilization).
- Migration of historical media (only if audit reveals it's needed).

---

## Sprint close criteria

Sprint 15 is complete when:

1. All 7 tickets shipped, `/review` clean, smoke harness green against staging.
2. Production-prod-mutation accidents are now impossible (S15-T1 guards prevent them).
3. Production crashes are visible in Sentry (S15-T2 + S15-T3).
4. Engine refactor preserves byte-identical behavior (S15-T4 baseline).
5. CI green on `main` (S15-T5).
6. Malformed JWT rejected at middleware (S15-T6).
7. ImageKit separation documented and remediated if needed (S15-T7).
8. `SPRINT_TRACKER.md` updated with all 7 ticket SHAs.
9. `FUTURE_SCOPE.md` updated with F1-F7 entries from `FUTURE_SCOPE-updates.md`.
10. `ARCHITECTURE.md` updated to reflect prod/staging split, Sentry integration, engine extraction.
11. `CHATGPT_REVIEW_TRACEABILITY.md` updated: all S15-T* rows marked `Shipped [date, commit SHA]`.
12. Sprint-close merge: `--no-ff` to `main` + annotated tag `sprint-15-close`.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| S15-T4 surfaces hidden engine bugs during extraction | Medium | High | Mandatory pre-flight, byte-identical smoke check after each step, willing to split into T4 + T4.5 |
| Neon staging branch costs unexpectedly more | Low | Low | Monitor Neon billing first week; can pause branch when not in use |
| Sentry source map upload fails on real builds | Medium | Medium | Test source map upload during S15-T2, don't defer to launch |
| ImageKit audit reveals significant remediation work (Outcome C) | Low | High | Investigation-first structure means we discover before committing time |
| CI pipeline catches latent bugs that block S15 merge | Medium | Low | Good — that's the point. Fix the bugs. |

---

## Notes on PI alignment

This sprint exercises several principles from your Project Instructions:

- **PI #14** — every ticket has a Pre-flight diagnostics section. S15-T4 in particular cannot proceed without pre-flight.
- **PI #15** — S15-T4 explicitly anticipates a `.5`-suffix follow-up if extraction needs splitting.
- **PI #18** — architect-side review of each prompt before dispatch to Claude Code. With 7 tickets, this matters.
- **PI #19** — repo convention (e.g., `ApiService`) takes precedence over prompt defaults. S15-T6 must respect `req.user.id` consumers across all routes; don't break the existing seam.
- **PI #20** — post-build flow: build, stop, device-test/smoke, greenlight, commit, chore commit. Sprint-chained branch, single `--no-ff` merge + tag at close.

---

## Communication with Claude Code

Each ticket dispatched as its own prompt (per PI #9 — "All prompts delivered as markdown files"). The prompt should:

1. Reference this sprint plan section as the spec.
2. Begin with pre-flight diagnostics.
3. Halt and report after pre-flight, before coding.
4. Build incrementally with mid-build smoke/test gates.
5. Halt and report at completion. Do NOT auto-commit.
6. Wait for device verification (where applicable) and greenlight.

Per PI #11, this spec doc is committed to `Trackers/SPRINT_15_PLAN.md`. The Claude Code prompts written from it are throwaway (live in chat sessions, never committed).

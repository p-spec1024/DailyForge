# DailyForge — System Architecture

> Last regenerated: 2026-05-15 (Sprint 14 closed). This document is generated from the live codebase, not from specs. When the code drifts from this document, the document is wrong.

---

## 1. Product in one paragraph

DailyForge is a Flutter mobile app that combines strength training, yoga, and breathwork on a single Node + PostgreSQL backend. Users plan by **focus area** — body focuses like *biceps* / *chest* / *full_body* / *mobility* and state focuses like *calm* / *energize* / *focus* / *sleep* / *recover* — rather than by pillar. The home page asks the user to pick a focus and a duration; the suggestion engine returns a session shape (cross-pillar 5-phase, pillar-pure strength/yoga, or state-focus 3-stage) that the user accepts, customizes, or saves as a routine. The 5-phase session (breath → yoga warmup → strength → yoga cooldown → breath) is one available session shape, not the home page identity — that's the post-Sprint-11 "Approach 5" pivot (see `Trackers/SPRINT_TRACKER.md` and `Trackers/PRE_SPRINT_11_PLANNING.md` for the strategic background).

---

## 2. Tech stack

| Layer | Stack |
|---|---|
| Mobile client | Flutter (Dart SDK `>=3.0.0 <4.0.0`) — `app/pubspec.yaml` |
| Navigation | `go_router ^14.0.0` |
| State | `provider ^6.1.0` (`ChangeNotifier`) |
| HTTP | `http ^1.2.0` |
| Local storage | `flutter_secure_storage ^9.0.0` (JWT) + `shared_preferences ^2.2.0` (everything else) |
| 3D body map | `interactive_3d ^2.0.3` — GLB at `app/assets/models/male_anatomy_split.glb` |
| Charts | `fl_chart ^0.68.0` |
| Icons | `lucide_icons ^0.257.0` |
| Misc | `wakelock_plus ^1.2.8` (hold screen during sessions, S14-T5 AMENDMENT-1 D12), `share_plus ^10.1.0` (post-session share card, S14-T6 §6.1.2), `path_provider ^2.1.0` (share PNG temp path), `cached_network_image ^3.3.0`, `shimmer ^3.0.0`, `intl ^0.19.0` |
| Server | Node `--watch` (v24.14.0 on dev machine) + Express 4.21 (`server/package.json`) |
| HTTP middleware | `helmet 8.1.0` (CSP off, cross-origin resources on — for ImageKit), `cors 2.8.5`, `express-rate-limit 8.3.2` |
| Auth | `bcrypt 5.1.1` + `jsonwebtoken 9.0.2` |
| Database driver | `pg 8.13.1` |
| Database | Neon PostgreSQL, `ap-southeast-1.aws.neon.tech` (Singapore region) — connection in `server/.env` |
| Media CDN | ImageKit (Node SDK `@imagekit/nodejs 7.4.0`) |
| Image/Video Gen | Vertex AI (server-side scripts) — see `server/scripts/generateExerciseMedia.js`, `testVeo31.js` |

The root `package.json` declares a `workspaces: ["server", "client"]` array, but the `client` directory no longer exists — that workspace was the original React PWA migrated to Flutter (decision Apr 13, 2026, see `Trackers/SPRINT_TRACKER.md` §"MAJOR PIVOT: Flutter Rebuild"). The root `npm run dev` script that depends on `-w client` therefore no longer works as-is; in practice the founder runs `npm run dev` inside `server/` and `flutter run` inside `app/` separately. This is technical debt worth cleaning up before broader signups.

---

## 3. Repository layout

```
dailyforge/
├── app/                          # Flutter app (Sprint 9+ rebuild)
│   ├── lib/
│   │   ├── adapters/             # Engine → player adapters (S14-T3 yoga)
│   │   ├── config/               # theme, routes, api_config
│   │   ├── constants/            # focus_categories.dart (S14-T6 / FS #226)
│   │   ├── data/                 # static reference data + mock data
│   │   ├── models/               # JSON parse + write models
│   │   ├── pages/                # screens, organized by feature
│   │   ├── players/              # embeddable pillar players (S14-T4)
│   │   ├── providers/            # ChangeNotifier providers
│   │   ├── services/             # HTTP service layer (all via ApiService)
│   │   ├── spike/                # dev-only spikes (body_map_spike.dart)
│   │   ├── utils/                # phase_label.dart, focus_display.dart, etc.
│   │   ├── widgets/              # feature-grouped widgets
│   │   └── main.dart             # app entry + provider wiring
│   ├── assets/                   # GLB models, fonts, images
│   ├── android/                  # Gradle / native Android
│   ├── linux/ | macos/ | windows/  # Desktop targets (not built; auto-generated)
│   └── pubspec.yaml
├── server/                       # Node + Express backend
│   ├── src/
│   │   ├── config/               # env.js, imagekit.js
│   │   ├── constants/            # breathwork-durations.js
│   │   ├── db/                   # pool.js, migrate.js, seeds/
│   │   ├── middleware/           # auth.js, errorHandler.js
│   │   ├── routes/               # 20 route files (see docs/API.md)
│   │   ├── services/             # business logic (suggestion-engine/ tree + 9 others)
│   │   ├── utils/                # media generation, upload helpers
│   │   └── index.js              # createApp() + listener
│   ├── scripts/                  # smoke / preflight / seed / media gen
│   ├── Trackers/                 # (empty placeholder — root Trackers is canonical)
│   ├── media/                    # ImageKit upload staging
│   └── package.json
├── Trackers/                     # specs, sprint plans, amendments, FUTURE_SCOPE
├── docs/                         # this directory
├── media/                        # repo-level media staging
├── CODEBASE_AUDIT.md
├── TECH_DEBT.md
└── package.json                  # workspace root (client workspace stale)
```

Two top-level directories (`media/`, `node_modules/`) are excluded from the tree.

The database lives on Neon (Singapore region) and has two branches: `production` (real user data — touched only by the running server in deployed environments and by mutating scripts run with the explicit `NODE_ENV=production` + `ALLOW_PROD_MUTATION=true` override) and `staging` (a copy-on-write branch off `production`, used by local dev and the smoke harness by default). The split landed in S15-T1; see §4.3 for the env-gating mechanics.

---

## 4. Backend architecture

### 4.1. Entry point and `createApp()` factory

`server/src/index.js` exports `createApp()` and conditionally calls `app.listen()`. The factory pattern was added in S12-T7 so the in-process smoke harness (`server/scripts/test-suggestion-engine-t2.js`) and the per-sprint curl roundtrip scripts can spawn the Express app via `supertest` without binding a real port:

```js
// server/src/index.js:31-66
export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false,
                   crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: true }));
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  // 20 route mounts under /api/...
  app.use(errorHandler);
  return app;
}

const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntryPoint) {
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => { ... });
}
```

Routes are mounted at `/api/<prefix>` per `server/src/index.js:42-61`. Helmet's CSP is disabled because the Flutter client receives JSON, not HTML, and `crossOriginResourcePolicy: 'cross-origin'` is needed for ImageKit-hosted media to load.

### 4.2. Middleware stack

In order, applied by `createApp()`:

1. **`helmet`** (`server/src/index.js:34`) — security headers.
2. **`cors({ origin: true })`** (`server/src/index.js:35`) — reflects the request origin. The `CLIENT_URL` env var is unused by the server today; it's a holdover from the React-PWA era.
3. **`express.json()`** (`server/src/index.js:36`) — body parser.
4. **`authenticate`** (`server/src/middleware/auth.js`) — JWT bearer-token verifier, attached per-router via `router.use(authenticate)` in each route file rather than globally. Public routes (`/api/health`, `/api/auth/*`, `GET /api/breathwork/techniques` and `/api/breathwork/techniques/:id`) deliberately don't mount it.
5. **Per-route rate limiting** — `auth.js` uses `express-rate-limit` at 10 attempts / 15 min for `/register` and `/login`.
6. **`requireUserId`** (defined inline in `server/src/routes/sessions.js:79-84`) — defense-in-depth on engine routes: a JWT without an `id` claim would slip past `authenticate` and crash the engine with a TypeError; this middleware short-circuits with a 401.
7. **`errorHandler`** (`server/src/middleware/errorHandler.js`) — terminal. Logs the full error, exposes message only for 4xx; 5xx collapse to `"Internal server error"`.

### 4.3. Database layer

`server/src/db/pool.js` constructs a single shared `pg.Pool`:

- `max: 5` (overridable via `PG_POOL_MAX` env) — Neon free tier caps connections per project.
- `idleTimeoutMillis: 10_000` — release idle clients fast so `node --watch` reloads don't pile up zombies.
- `connectionTimeoutMillis: 5_000` — fail fast.
- `allowExitOnIdle: true` — clean exit when idle.
- SSL enabled only when the connection string contains `sslmode=require`. There's a deprecation warning emitted on every run from pg-connection-string about the SSL alias semantics — known noise (see FUTURE_SCOPE for the SSL hygiene followup; the warning is informational).

`pool.on('error')` swallows transient drops so a single Neon hiccup doesn't take the server down. SIGTERM / SIGINT handlers call `pool.end()` for graceful shutdown.

**Two environment branches (S15-T1).** The database lives in two Neon branches: `production` (real user data) and `staging` (a copy-on-write clone of `production`, used by local dev and smoke harnesses). After S15-T1 the local `server/.env` defaults to staging — running `npm run dev`, `npm run db:seed`, or any smoke script under `server/scripts/` writes to staging, not prod.

Mutating scripts (every seed under `server/src/db/seeds/`, `server/src/db/migrate.js`, and every writing one-shot under `server/scripts/`) call `assertSafeMutation()` at module top from `server/scripts/lib/prod-guard.mjs`. The guard throws unless one of these holds:

- `NODE_ENV` is anything other than `'production'` (staging, development, undefined — the local-dev default), **or**
- `NODE_ENV === 'production'` **AND** `ALLOW_PROD_MUTATION === 'true'` (explicit two-variable opt-in).

The two-variable override is deliberate: a single typo cannot rewrite production data. Server runtime (`createApp()` and the pool itself) is **not** guarded — it reads whichever `DATABASE_URL` is set, no opt-in required. The guard is for one-shot scripts only.

The Flutter client points at the API via `--dart-define=API_BASE_URL=...` (full URL, must end in `/api`). Default when no flag is passed: `http://localhost:3001/api` — sized for an emulator pointed at the laptop. For a real device on the LAN, pass `--dart-define=API_BASE_URL=http://<laptop-ip>:3001/api`. The previous `API_HOST` host-only flag and the `192.168.0.204` LAN-IP fallback in `api_config.dart` were removed in the S15-T1 refactor.

The schema lives in **one file**: `server/src/db/migrate.js`. It runs four idempotent blocks in order — `schema` (CREATE TABLE IF NOT EXISTS), `alterations` (ADD COLUMN IF NOT EXISTS plus DO-blocks for the S14-T4→T5 cross_pillar→multi_phase rename), `indexes`, and `s11t4Functions` (CREATE OR REPLACE FUNCTION for `recompute_user_pillar_level` and `recompute_all_user_pillar_levels`). After the STEP 1 consolidation this session, the file is now the full source of truth — including `focus_overlaps`, `exercise_swap_counts`, and `user_excluded_exercises`, which previously existed in prod via out-of-band preflight scripts.

### 4.4. Suggestion engine

The engine is `server/src/services/suggestion-engine/` — a 12-file modular tree post-S15-T4 (extracted from the 1791-LOC monolith `suggestionEngine.js`; see §4.4.8). Entry point is `suggestion-engine/index.js`. The engine is plain async functions over the `pg` pool — no classes, no DI, no ORM.

#### 4.4.1. Public API

Exported symbols (`grep '^export'`):

```js
// server/src/services/suggestion-engine/index.js (post-S15-T4)
export { NotImplementedError } from './errors.js';
export { BRACKET_TABLE } from './constants.js';
export { checkRecencyOverlap } from './recency.js';
export { getAvailableDurations } from './recipes/available-durations.js';
export async function generateSession({...})  // defined in index.js
```

`generateSession` is the single entry point used by `POST /api/sessions/suggest` and the smoke harness. The other exports support `GET /api/focus-areas/:slug/available-durations` (S13-T5 picker support), the recency-overlap warning helper consumed inside body-focus recipes, and the shared bracket configuration table.

#### 4.4.2. `generateSession` flow

(`suggestion-engine/index.js:69-146` post-S15-T4)

1. **Identity validation** (`index.js:71-79`) — `user_id` must be a positive int, `focus_slug` non-empty, `entry_point` in `{home, strength_tab, yoga_tab, breathwork_tab}`. Throws `TypeError` on bad shape.
2. **Bracket value check** (`index.js:82`) — if `bracket` provided, validate against `BRACKET_TABLE` keys. Throws `RangeError` on garbage. This is the only path producing the `invalid bracket value` substring that the route's mapper picks up.
3. **Focus resolution** (`index.js:86`) — `resolveFocus(focus_slug)` reads `focus_areas` (`is_active = true` filter; throws on unknown slug).
4. **Strength-tab exclusion** for mobility (`index.js:90`) — mobility is hidden from strength_tab; engine asserts the contract as second line of defense and throws `RangeError`.
5. **State-focus path** (line 1742) — focus type `'state'` routes to `generateStateFocus({ userId, focus, bracket })`. Body-only tabs (`strength_tab` / `yoga_tab`) throw before reaching here. Missing `bracket` throws `state focus requires bracket parameter` (the substring the route maps to `state_focus_requires_bracket`).
6. **Body-focus path** (line 1766) — `time_budget_min` must be a positive int in the entry-point's allowed budget set (`VALID_BUDGETS_BY_ENTRY`). Engine reads `user_pillar_levels` via `resolveLevels(user_id)` and then dispatches by entry point.

#### 4.4.3. Recipe paths

The engine has **9 internal `generate*` functions** (`grep '^async function generate'`):

```
generateCrossPillar              — home + body focus (5-phase default)        L483
generateStrengthOnly             — strength_tab + body focus (pillar-pure)    L619
generateYogaOnly                 — yoga_tab + body focus (pillar-pure)        L678
generateCrossPillarMobility      — home + 'mobility' special case             L808
generateCrossPillarFullBody      — home + 'full_body' special case            L950
generateStrengthOnlyFullBody     — strength_tab + 'full_body' special case    L1075
generateYogaOnlyMobility         — yoga_tab + 'mobility' special case         L1112
generateYogaOnlyFullBody         — yoga_tab + 'full_body' special case        L1196
generateStateFocus               — state focus 3-stage chain                  L1396
```

Plus helper picks (`pickBookend`, `pickStrength`, `pickStrengthCompound`, `pickYogaCompound`, `pickYogaByStyles`, `pickYoga`, `pickSettleTechnique`, `loadStateMainPool`, `loadMuscleKeywords`, `loadExclusions`).

**Cross-pillar phase budget** (lines 96-99) — 5 phases, allocated by minutes:

```
30-min: bookend_open 3 / warmup 3 / main 18 / cooldown 3 / bookend_close 3
60-min: bookend_open 5 / warmup 5 / main 40 / cooldown 5 / bookend_close 5
```

**Pick counts** (lines 102-116) — 30/60 budgets have content-degradation thresholds when the muscle pool is too small to fill the spec. The smoke harness (§4.7) asserts pick-count drift.

**State-focus recipe** is bracket-driven (T3.5 refactor, see `Trackers/_archive/S12-T3.5-state-focus-refactor-spec.md`). Three legs: **centering → practice → reflection**. Window math comes from `BRACKET_TABLE`; centering and reflection are short bookends (1–3 min each), practice fills the bracket window. Endless mode runs the technique at its natural max with 2-min bookends.

#### 4.4.4. Compound predicates (S12-T4)

The engine remaps the master spec's movement-quality intent (mobility / flexibility / restorative) onto live style data — those movement-quality tokens don't exist in the DB. The remap is centralized at the top of the file:

```js
// server/src/services/suggestion-engine/constants.js:18-20 (post-S15-T4)
const WARMUP_PRACTICE_STYLES   = ['vinyasa', 'sun_salutation', 'hatha'];
const MOBILITY_MAIN_STYLES     = ['hatha', 'yin', 'vinyasa'];
const COOLDOWN_PRACTICE_STYLES = ['restorative', 'yin', 'hatha'];
```

Full-body picks use `ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3` via a `compoundFilter()` helper — the single source of truth if `target_muscles` ever migrates from `TEXT` to `TEXT[]`.

#### 4.4.5. Recency-overlap detection

`checkRecencyOverlap(userId, currentFocusSlug)` at line 1633 — body-focus paths only. SQL queries the user's last calendar day of completed sessions; if the focus matches or is in `focus_overlaps` (chest↔triceps, etc.), returns a warning object with `alternative_focus_slug: 'recover'`. The route appends this to the response's `warnings` array. DB errors are swallowed (recency is informational, not load-bearing).

State focuses don't call this — the 5 state slugs have no `focus_overlaps` edges anyway.

#### 4.4.6. Swap-state read side

Engine reads (but never writes) `user_excluded_exercises` for the user via `loadExclusions(userId, contentType)` at line 233. The write side lives in `services/swapCounter.js` (S12-T6) — invoked by `PUT /api/workout/slot/:exerciseId/choose` and the two `/api/exercises/:id/exclude` and `/keep-suggesting` endpoints (see `docs/API.md` § "Swap & Exclusion Endpoints").

#### 4.4.7. Error model

Engine throws **`TypeError`** for programmer bugs (bad shape; should never reach prod from a real route) and **`RangeError`** for contract violations the route should turn into 400s. The route handler at `server/src/routes/sessions.js:66-74` maps RangeError-message **substrings** to stable error codes (`invalid_bracket`, `state_focus_requires_bracket`, `invalid_focus_entry_combo`, `invalid_time_budget`, or the catchall `unmapped_engine_error`). String-matching is intentional v1; the typed-error refactor is tracked at FUTURE_SCOPE #166.

#### 4.4.8. Architecture-extraction debt (FS #160) — ✅ SHIPPED S15-T4

**Status:** Shipped May 17, 2026 in S15-T4 (feat `9aa95d6`). FS #160 closed. The 1791-LOC monolith was extracted byte-preservingly into the structure below. Smoke 3537/0 with no new failure categories vs the S15-T4 baseline.

**Actual structure** (matches the FS #160 proposal plus a separate `recency.js` for the body-focus T5 helper — 12 files total instead of the proposed 11):

```
server/src/services/suggestion-engine/
  index.js                       — generateSession dispatch + public re-exports
  constants.js                   — BRACKET_TABLE, style sets, picks tables
  errors.js                      — NotImplementedError + EngineContractError shell
  helpers.js                     — pure helpers + data loaders + bracket helpers
  pickers.js                     — 6 generic body-focus pickers
  item-formatters.js             — bookendItem, strengthItem, yogaItem
  recency.js                     — checkRecencyOverlap (T5 body-focus warning)
  recipes/
    cross-pillar.js              — standard + Mobility + FullBody (~467 LOC, documented exception)
    strength-only.js             — standard + FullBody
    yoga-only.js                 — standard + Mobility + FullBody (~310 LOC, documented exception)
    state-focus.js               — generateStateFocus + state-only pickers
    available-durations.js       — getAvailableDurations
```

**Layout decisions** (per the S15-T4 prompt's drift log):
- Two recipe files (`cross-pillar.js` 467 LOC, `yoga-only.js` 310 LOC) intentionally exceed the 300-LOC guideline. Both carry top-of-file justification comments. The three internal variants (standard / mobility / full-body) in each are cohesive — they share scaffolding, helpers, and tests; splitting by variant introduces layout asymmetry and breaks domain cohesion for a line-count win. Tracked at FS for revisit if either grows past ~500 LOC.
- `recency.js` lives at the top level rather than inside `recipes/` because `checkRecencyOverlap` is a body-focus-only public export with non-trivial DB query construction + defensive try/catch, not a recipe.
- `errors.js` ships `EngineContractError` as a class shell only. Its wiring to existing RangeError throw sites is S16-T2's job (typed-error refactor). The route-level `mapRangeErrorToCode` substring matching at `routes/sessions.js:66-74` remains intact until that lands.

**Net effect:** same logic; the public API surface (`generateSession`, `getAvailableDurations`, `checkRecencyOverlap`, `BRACKET_TABLE`, `NotImplementedError`) is preserved across the three call sites (`routes/sessions.js`, `routes/focus-areas.js`, smoke harness); per-recipe tests can target individual files when test coverage expands (S16-T3); the engine internals are now a clean import DAG (constants → helpers → {pickers, formatters} → recipes → index) with zero cycles. Pairs with FS #166 (typed-error refactor) — best done in the same engine touch.

### 4.5. Multi-phase sessions (S14)

`POST /api/multi-phase-sessions` is the **only** writer of the `multi_phase_sessions` table (`server/src/routes/multi-phase-sessions.js`). The row is written **at session completion**, not at session start — the per-pillar session rows (`sessions` for strength/yoga/5phase; `breathwork_sessions` for breath) are inserted by the embedded players during the session, and the orchestrator's POST fans an `UPDATE … SET multi_phase_session_id = $newId WHERE id = ANY(...) AND user_id = $userId` across both tables in one transaction.

Two `session_shape` values:

- `'cross_pillar'` — S14-T4. 5 phases: `bookend_open / warmup / main / cooldown / bookend_close`. Iterates `phases.length` (not a hardcoded 5) so 4-phase degraded sessions (e.g. biceps cooldown drop, S14-T2 AMENDMENT-1) run end-to-end.
- `'state_focus'` — S14-T5. 3 stages: `centering / practice / reflection`. The reflection stage writes no DB row (spec §16 — silent timer player only emits a `PhaseResult` for the orchestrator's bookkeeping).

The `multi_phase_sessions` table itself was renamed from `cross_pillar_sessions → multi_phase_sessions` in S14-T5; the rename is handled idempotently in migrate.js with a `DO $migrate_t5_rename$` block. The `session_shape` column was added in the same migration with a `DEFAULT 'cross_pillar'` for backfill, then `DROP DEFAULT` so new inserts must pass the discriminator explicitly. The dual-table FK columns (`sessions.multi_phase_session_id`, `breathwork_sessions.multi_phase_session_id`) were also renamed from `cross_pillar_session_id` in the same DO-block pattern.

### 4.6. HTTP surface

See `docs/API.md` for the full endpoint reference (74 endpoints across 20 route files + `/api/health`). This section does not duplicate that material.

A few cross-cutting notes:

- **JWT and `req.user.id`.** The middleware decodes the token and assigns the payload to `req.user`; it does not coerce `id` to int. Some routes coerce defensively (`workout.js` at the top of `slot/:exerciseId/choose`); others trust PG's implicit coercion. FUTURE_SCOPE #215 is the middleware-level cleanup.
- **Error mapping.** 4xx responses use short stable codes (`invalid_focus_slug`, `routine_name_required`). 5xx flow through `errorHandler.js` and collapse to `"Internal server error"`.
- **`/api/sessions/*` vs `/api/session/*`.** Both exist. `/api/session/*` (singular) is the legacy single-pillar session player surface; `/api/sessions/*` (plural) is the S12-T7 engine HTTP face plus the S14-T1 `start-from-list`. Don't conflate them.
- **`/api` suffix lives in `baseUrl`.** `ApiConfig.baseUrl` always ends in `/api` (post-S15-T1, retiring FS #196). Endpoint constants (`/sessions/suggest`, `/auth/login`, etc.) MUST NOT re-prefix `/api/` — `ApiConfig.url(path)` simply concatenates `baseUrl + path`. This is the documented standard going forward; new endpoints follow the same rule.

### 4.7. Smoke harness

`server/scripts/test-suggestion-engine-t2.js` is the rolling smoke harness (~3500 assertions at S14 close). It uses `createApp()` to spawn the Express app in-process, signs a JWT manually with `jsonwebtoken` for the test user (resolved via `TEST_USER_EMAIL` env or the user with the most sessions), and exercises:

- the 3 in-scope recipes × 10 body focuses × budgets {30, 60} via `generateSession`
- 5 `BRACKET_TABLE` brackets × 5 state focuses × levels {beginner, intermediate, advanced} via `getAvailableDurations`
- `checkRecencyOverlap` matrix
- swap-counter + exclusion writes via `incrementSwap` and `setPromptState`
- substitution-ladder rank via `rankAlternatives` (S14-T6 / FS #198)

After S15-T1 the harness runs against **staging** (Neon Singapore) by default — the same Neon project as production but on a separate branch, so smoke fixtures never collide with real user rows. The fixtures the harness creates are still tagged with a sentinel pattern (look for `assertSession` and the `__smoke_` prefixes inside the file) so cleanup queries can identify and drop them. Running against production is still possible via the explicit `NODE_ENV=production ALLOW_PROD_MUTATION=true` override, but should be rare — the staging branch exists precisely so this isn't a daily move.

The sentinel pattern is the project's standing rule on smoke cleanup (Project Instruction #17): never `DELETE WHERE user_id = ...` from a smoke harness — that works until a real user shares a slug or row identity with a fixture and the test silently destroys real data. Instead, tag every fixture row with a sentinel literal (e.g. `notes='t7-smoke-fixture'`, `slug='__t_state_test'`) and `DELETE WHERE sentinel matches`. The pattern surfaced during S12-T7 and was consolidated into the shared helper by S13-T7.

Pass-count drift between runs and fixture leak on mid-block exceptions are open items at FUTURE_SCOPE #217 and #218 respectively.

---

## 5. App architecture

### 5.1. Entry, routing, theme

**Entry.** `app/lib/main.dart` runs `WidgetsFlutterBinding.ensureInitialized()` then `runApp(const DailyForgeApp())`. The `DailyForgeApp` widget is stateful and constructs every provider + the `GoRouter` in `initState()`, then exposes them through a top-level `MultiProvider` with `ChangeNotifierProvider<T>.value(value: _xxx)`. `ApiService` and `StorageService` are provided as plain `Provider.value` (no listenable). The widget also wires `_authProvider.addListener(_handleAuthChanged)` so user-scoped caches (`SettingsProvider`, `ProfileProvider`, `ProgressProvider`, `BodyMeasurementsProvider`, `BodyMapProvider`, `HomeProvider`, `SuggestProvider`, `FocusDurationProvider`, `OnboardingProvider`) reset on logout.

**Routing.** `app/lib/config/routes.dart` configures `GoRouter` with an auth-aware redirect (line 36) and a `ShellRoute` (line 175) for the 5-tab bottom-nav scaffold. Top-level routes live outside the shell so session players can take over the full screen. The complete route table:

| Path | Page | Notes |
|---|---|---|
| `/login` | `LoginPage` | unauth |
| `/register` | `RegisterPage` | unauth |
| `/workout` | `WorkoutPage` | extra: `{workoutId, exercises}` |
| `/workout/empty` | `WorkoutPage` | query: `routineId` |
| `/workout/resume` | `WorkoutPage` | extra: `{resumeData}` |
| `/breathwork/:id` | `BreathworkTimerPage` | standalone breathwork |
| `/yoga/session` | `YogaSessionPage` | standalone yoga |
| `/yoga/complete` | `YogaCompletePage` |  |
| `/session/cross-pillar` | `MultiPhaseSessionPage(shape='cross_pillar')` | S14-T4 |
| `/session/state-focus` | `MultiPhaseSessionPage(shape='state_focus')` | S14-T5 |
| `/session/summary` | `SessionSummaryPage` | requires `SessionSummaryArgs` in `extra`; bounces to /home if absent |
| `/exercise-history` | `ExerciseHistoryPage` |  |
| `/body-measurements` | `BodyMeasurementsPage` |  |
| `/body-measurements/month` | `FullMonthPage` |  |
| `/spike/body-map` | `BodyMapSpikePage` | dev-only spike |
| `/onboarding/level-capture/strength` | `LevelCaptureStrengthPage` |  |
| `/onboarding/level-capture/yoga` | `LevelCaptureYogaPage` |  |
| `/onboarding/level-capture/breathwork` | `LevelCaptureBreathworkPage` |  |
| `/body` | `BodyPage` | 3D body map, S13-T4 |
| `/exercise-progress/:id` | `ExerciseProgressPage` |  |
| `/home` | `HomePage` | shell tab 0 |
| `/strength` | `StrengthPage` | shell tab 1 |
| `/yoga` | `YogaPage` | shell tab 2 |
| `/breathwork` | `BreathworkPage` | shell tab 3 |
| `/profile` | `ProfilePage` | shell tab 4 |

**Theme.** `app/lib/config/theme.dart` defines `AppTheme.darkTheme`. Dark mode is hardcoded — there's no theme switcher.

### 5.2. State management

Provider pattern with `ChangeNotifier` + `notifyListeners()`. All 21 providers are constructed in `main.dart:69-95` and disposed in reverse order. Grouped by domain:

| Domain | Providers |
|---|---|
| Auth | `AuthProvider` |
| Home + plan | `HomeProvider`, `DashboardProvider`, `SuggestProvider`, `FocusDurationProvider`, `OnboardingProvider` |
| Strength flow | `StrengthProvider`, `WorkoutSessionProvider` |
| Yoga flow | `YogaProvider`, `YogaSessionProvider` |
| Breathwork flow | `BreathworkProvider`, `BreathworkTimerProvider` |
| Multi-phase orchestration | `MultiPhaseSessionProvider` (abstract), `CrossPillarSessionProvider`, `StateFocusSessionProvider` |
| Calendar / progress | `CalendarProvider`, `ProgressProvider` |
| Profile / body | `ProfileProvider`, `BodyMeasurementsProvider`, `BodyMapProvider` |
| Settings | `SettingsProvider` |

`BreathworkTimerProvider` and `MultiPhaseSessionProvider` (the abstract base) are not registered in `MultiProvider` — they're owned by the player widgets and the two `CrossPillarSessionProvider` / `StateFocusSessionProvider` subclasses respectively.

### 5.3. Services

**`ApiService`** (`app/lib/services/api_service.dart`) is the only HTTP entry point. Responsibilities:

- Builds `Authorization: Bearer <token>` from `StorageService.getToken()` (`_getHeaders`, line 43).
- 15-second timeout via `_kRequestTimeout = Duration(seconds: 15)` (line 9). Too tight for Neon cold starts on the `/suggest` and `/start-from-list` endpoints — see FUTURE_SCOPE #209.
- Wraps every method in a try-catch that translates infrastructure errors into typed exceptions: `TimeoutApiException`, `NetworkException` (covers `SocketException`, `HttpException`, and `http.ClientException` — the Android-specific class must be caught explicitly or it propagates unwrapped, see the inline note referencing FUTURE_SCOPE #107).
- On `401`, calls `_storage.deleteToken()` + `_storage.deleteUser()` + `onUnauthorized?.call()` and throws `UnauthorizedException`. The `onUnauthorized` callback is set by `AuthProvider` to trigger logout.
- Non-2xx responses produce `ApiException(statusCode, message)` where `message` is the JSON `error` field if present.

**Methods.** `get(path)` (single map response), `getList(path)` (list response — a separate code path for list endpoints), `post(path, body, {withAuth})`, `put(path, body)`, `delete(path)`.

**`StorageService`** (`app/lib/services/storage_service.dart`) wraps `flutter_secure_storage` (JWT + user JSON) and `shared_preferences` (everything else). Exports two top-level constants — `kCrossPillarSessionKey` and `kStateFocusSessionKey` — used by the multi-phase orchestrator providers to persist their in-flight session snapshots. The `_v1` suffix on each key reserves room for a schema migration.

**Other services.** Every other service (`AuthService`, `HomeService`, `FocusAreasService`, `FocusDurationService`, `SuggestService`, `YogaService`, `BreathworkService`, `StreaksService`, `OnboardingService`, `BodyMapService`) routes its HTTP calls through `ApiService`. `WakelockService` (line ~1-15 of the file) is a thin wrapper around `wakelock_plus` so callers don't import the package directly — the only `wakelock_plus` import in `app/lib` is from this file.

### 5.4. Pages, by domain

The complete page list (29 page files) grouped by feature:

**Auth.** `pages/auth/login_page.dart` and `register_page.dart`. Read `AuthProvider` for the loading flag and error; write `AuthProvider.login` / `.register` on submit.

**Onboarding** (S13-T1). `pages/onboarding/level_capture_strength_page.dart`, `_yoga_page.dart`, `_breathwork_page.dart`. Three sequential pillar-level pickers; final page calls `OnboardingProvider.submit()` → `POST /api/users/pillar-levels`, then `context.go('/home')`. Triggered by an empty `GET /api/users/me/pillar-levels` response.

**Home + bottom nav** (S13-T4). `pages/home/home_page.dart` is the active home; `_legacy/` was removed in STEP 2 of this session. Composition (top → bottom): app bar with streak chip + body-map shortcut → today's session slot → focus orbit picker → training-load chart → streak / this-week stat tiles → 14-bar daily-counts chart. Data flow: `HomeProvider.load()` fans out to `/home/stats`, `/home/weekly-activity`, `/home/daily-load`, `/home/daily-counts`, `/focus-areas`, `/users/me/pillar-levels` in parallel. `SuggestProvider` holds the selected focus + current suggestion separately so a chip tap re-fires `/suggest` without disturbing the rest of the page. The orbit-picker → sheet → confirm flow replaces the original tap-and-instant-suggest model (S13-T5 redesign — see the home_page.dart class doc comment).

**Strength tab.** `pages/strength/strength_page.dart` (S14-T1 reroute). Two surfaces: routine browse (uses `StrengthProvider` for exercise + routine lists) and the today's-session card driven by `SuggestProvider.refreshForEntryPoint(entryPoint: 'strength_tab', focusSlug: ...)`. S14-T6 commit 2 added an empty-state widget that renders before the user has confirmed any focus (FS #224).

**Yoga tab.** `pages/yoga/yoga_page.dart` (S14-T3 + S14-T6). Mirror of Strength tab structurally: practice-type / level / duration / focus pickers plus a today's-session card. Cold-start fallback focus is `'hamstrings'` (dead code today — FS #202).

**Breathwork tab.** `pages/breathwork/breathwork_page.dart`. Public technique browse (filtered by category) plus saved preferences. `breathwork_timer_page.dart` is the standalone timer route at `/breathwork/:id`.

**Multi-phase session page** (S14-T4 → renamed in S14-T5). `pages/session/multi_phase_session_page.dart`. The orchestrator shell. Takes a `sessionShape` constructor argument (`'cross_pillar' | 'state_focus'`) that the route passes; uses it to pick the matching provider via `context.read<CrossPillarSessionProvider>()` / `<StateFocusSessionProvider>()`. Renders an AppBar with the phase indicator + a body that switches on the active phase's `contentType` to render the appropriate `EmbeddablePlayer` widget. Owns the auto-advance countdown overlay (cross-pillar only), the top-anchored undo banner, the back-press confirmation modal with the 3 quit intents (Save & quit / End early / Cancel), and the navigation guard `_navigatingToSummary` (S14-T6 Commit 1.5 race fix). Enables wakelock in `initState`, disables in `dispose`.

**Session summary.** `pages/session/session_summary_page.dart` + `widgets/session/share_card.dart` (S14-T6 §6.1.2). The post-session screen. Requires a `SessionSummaryArgs` payload in `state.extra`; deep-links / refreshes without args bounce to `/home`.

**Strength session player.** `pages/workout_page.dart` (legacy single-pillar route — pre-Approach-5 still in active use). Resumes active sessions, accepts initial exercises, drives `WorkoutSessionProvider` end-to-end. Coexists with the embedded `StrengthPlayer` used inside the multi-phase orchestrator.

**Yoga session player.** `pages/yoga/yoga_session_page.dart` and `yoga/yoga_complete_page.dart`. Standalone yoga player route.

**Progress.** `pages/progress/exercise_history_page.dart` + `exercise_progress_page.dart`. Chart-driven per-exercise history.

**Body measurements.** `pages/body_measurements/body_measurements_page.dart` + `full_month_page.dart`. Weight + body-fat + circumferences + BMI rolling-avg trend.

**Body map** (3D). `pages/body/body_page.dart` at `/body`. Discussed in §5.7.

**Profile.** `pages/profile/profile_page.dart`. Settings, logout, height + unit-system. No pillar-level display yet — FS #207.

### 5.5. The Player/Page split (S14-T4)

**Why it exists.** Before S14-T4, the strength, yoga, and breathwork player widgets were Scaffold-rooted pages — each owned its own AppBar, scaffold background, and navigation. Wrapping them inside an orchestrator page meant two Scaffolds, two AppBars, and Navigator pops that fought the orchestrator's `PopScope`. S14-T4 extracted the player bodies into widgets that take a constructor flag and reduce themselves to a body subtree when embedded.

**Contract.** `app/lib/players/embeddable_player.dart` defines a mixin with three members:

```dart
abstract mixin class EmbeddablePlayer {
  bool get isEmbedded;
  PhaseMetadata get phaseMetadata;
  void Function(PhaseResult) get onPhaseComplete;
}
```

Each player widget — `StrengthPlayer`, `YogaSessionPlayer`, `BreathworkPlayer`, `SilentTimerPlayer` — implements this. When `isEmbedded == false`, the player renders full chrome (Scaffold + AppBar + finish button) and is the entire screen. When `true`, it drops the chrome (the orchestrator owns the AppBar), seeds its own provider state from `phaseMetadata.items`, and on completion calls `onPhaseComplete(PhaseResult)` instead of `Navigator.pop`.

**Why a mixin and not an interface.** Each player keeps its `State<…>` class and the embedded path needs to inject behavior into existing widget plumbing; a mixin lets each player adopt the contract without rewriting its widget hierarchy.

**`PhaseMetadata` and `PhaseResult`** (`app/lib/players/phase_metadata.dart` and `phase_result.dart`) are the immutable payloads that move between the host and the player. `PhaseMetadata` carries focus_slug, phase token (engine slug), contentType, durationMinutes, items, userLevels, and the S14-T5 `isEndless` flag for state-focus practice/reflection modes. `PhaseResult` carries phase, contentType, completedAt, actualDuration, items, pillarSpecific data, wasSkipped, and the per-pillar `sessionId` FK (nullable for failure paths — the phase still counted but no DB row exists to FK).

**Auto-advance countdown.** Cross-pillar sessions show a 3-second countdown between phases. State-focus sessions skip it (spec §9 Decision — calm sessions don't want urgency). The choice is owned by the provider via `useAutoAdvanceCountdown` (`CrossPillarSessionProvider` returns true; `StateFocusSessionProvider` returns false).

**Quit intents.** Three categories per `MultiPhaseSessionProvider`:

- `null` — in-progress, no quit intent yet.
- `'pause'` — user tapped "Save and quit"; resume on next launch from the persisted snapshot.
- `'end_early'` — user tapped "End early"; completed phases logged, session closed via `_writeMultiPhaseSessionRow(api, endIntent: 'end_early')` and the snapshot dropped.

**`phase_label.dart`** (`app/lib/utils/phase_label.dart`) — central map from engine phase slugs (`bookend_open`, `warmup`, `main`, `cooldown`, `bookend_close`, `centering`, `practice`, `reflection`) to user-facing labels. The `main` slug picks "Strength"/"Yoga"/"Breathwork" by `contentType`. Unknown slugs fall back to a generic prettifier (`_` → space, title-case).

### 5.6. Cross-pillar session orchestration

**Abstract base.** `app/lib/providers/multi_phase_session_provider.dart:36` defines `abstract class MultiPhaseSessionProvider extends ChangeNotifier`. It owns the full state machine: session reference, current phase index, per-phase statuses (`PhaseStatus` enum: `pending / active / paused / completed / skipped`), paused flag, `_phaseResults` list, the `quitIntent`, and `_currentPhaseStartedAt` / `_accumulatedPauseOnPhase` for elapsed-time tracking (S14-T6 §6.3).

**Subclasses.**

```dart
// cross_pillar_session_provider.dart
class CrossPillarSessionProvider extends MultiPhaseSessionProvider {
  String get sessionShape => 'cross_pillar';
  String get storageKey   => kCrossPillarSessionKey;
  bool get useAutoAdvanceCountdown => true;
  String phasesNoun(int n) => n == 1 ? 'phase' : 'phases';
}

// state_focus_session_provider.dart
class StateFocusSessionProvider extends MultiPhaseSessionProvider {
  String get sessionShape => 'state_focus';
  String get storageKey   => kStateFocusSessionKey;
  bool get useAutoAdvanceCountdown => false;       // §9 Decision
  String phasesNoun(int n) => n == 1 ? 'stage' : 'stages';   // §21
}
```

Each subclass has its own SharedPreferences key so a paused cross-pillar session and a paused state-focus session don't trample each other. The base persists a JSON snapshot via `setPreference(storageKey, jsonEncode(snapshot.toJson()))` after every state transition, and exposes `peekFromStorage` for the launcher to ask "is there something to resume?" without mutating in-memory state.

**State transitions.** `startFresh` (new session) / `resumeFromStorage` / `completeCurrentPhase(PhaseResult)` / `skipCurrentPhase` / `undoLastSkip` (S14-T6 §6.2) / `pause` / `resume` / `pauseAndQuit` / `endEarly` / `discard` / `complete`. Both `endEarly` and `complete` POST to `/api/multi-phase-sessions` with the appropriate `end_intent`, then drop the snapshot. Errors on the POST are logged via `debugPrint` and swallowed — the orchestrator must not block the user's home-bound navigation on a server hiccup.

**Phase fanout.** `_writeMultiPhaseSessionRow` partitions `_phaseResults` into `strengthYogaIds` and `breathworkIds` (line 308-318 of `multi_phase_session_provider.dart`), then sends them in the POST body. The route handler runs the dual-table `UPDATE`s in one transaction.

**S14-T2 AMENDMENT-1 (biceps 4-phase drift).** Engine sometimes returns 4 phases instead of 5 (e.g. biceps at 30 / 60 min, cooldown drops because muscle-specific yoga pool is empty after exclusions). Provider iterates `_session.phases.length` (not a hardcoded 5) so degraded sessions still run end-to-end. The "1 of 4" / "2 of 4" phase indicator is exact, not "1 of 5 (4 expected)". The home page should arguably never show a 4-phase session under "5-phase mode" branding — FS #198 is the engine substitution ladder to keep cross-pillar always 5.

**S14-T5 state-focus chain.** 3 stages with explicit semantics:

- **Centering** — short breathwork bookend, picked by `pickSettleTechnique` from the curated `settle_eligible_for` pool.
- **Practice** — the main work, technique drawn from `focus_content_compatibility` filtered by `BRACKET_TABLE` window + difficulty.
- **Reflection** — silent timer player (`SilentTimerPlayer`), no DB row.

The `isEndless` flag flows from `SuggestedSession.metadata.isEndless` down through `PhaseMetadata` to the embedded breathwork player, switching it to stopwatch + "I'm done" mode for endless practice.

### 5.7. 3D body map

**Status: in progress, planned for Sprint 15+.** Current implementation uses `app/assets/models/male_anatomy_split.glb` (declared in `pubspec.yaml:58`) as a placeholder model and may be replaced. The detailed mesh count, selection-state architecture, and race-condition handling have not yet been finalized and are not documented here. Reviewers: please treat this section as a stub.

Files involved today:

- `app/lib/pages/body/body_page.dart` — the `/body` route.
- `app/lib/pages/home/widgets/body_map_3d.dart` — the 3D widget.
- `app/lib/providers/body_map_provider.dart` — fan-out load + range-switch + error state.
- `app/lib/services/body_map_service.dart` — HTTP client with mock fallback.

Backed by `GET /api/body-map/{muscle-volumes,flexibility,recent-wins}` (`server/src/services/bodyMapService.js`); response shapes are documented in `docs/API.md`.

---

## 6. Data model

29 tables in prod (Neon Singapore). All schema in `server/src/db/migrate.js` after the STEP 1 consolidation this session.

**Identity / auth**
- `users` (id, email, password_hash, name, created_at, height_cm, unit_system) — S0; height + unit added in S5-T3.
- *No separate auth-token table.* JWTs are stateless; bearer token verified against `JWT_SECRET`.

**Settings**
- `user_settings` (per-user rest timer prefs) — S1.

**Content**
- `exercises` (1161 rows) — strength + yoga + bodyweight. `type` discriminates pillar; `category` discriminates yoga phase eligibility; `tracking_type` is `'weight_reps' | 'duration' | 'reps_only'`. S5-T1, S6-T1, S6-T2.1, S11-T1, S12-T4 etc. extended.
- `breathwork_techniques` (49 rows) — incl. `safety_level` (green/yellow/red), per-difficulty duration ranges, `settle_eligible_for` ARRAY (S12-T3.5), pre/post/standalone compatibility flags. S5-T6 origin; S11-T1, S12-T3.5 extensions.

**Legacy workout slot model**
- `workouts` (35 rows), `workout_slots` (35), `user_slot_prefs` (0), `slot_alternatives` (68), `user_exercise_prefs` (3). S0-S6. Still wired through `routes/workout.js` and `GET /api/workout/today`.

**Routines**
- `user_routines` (6 rows), `user_routine_exercises` (19) — S6-T3 user-saved templates.

**Per-pillar sessions**
- `sessions` (194 rows) — strength + yoga + 5phase, `type IN ('strength','yoga','breathwork','stretching','5phase')`. Adds `focus_slug` (S12-T1), `multi_phase_session_id` (S14-T5 — renamed from `cross_pillar_session_id`), `phases_json`, `routine_id`. Note: strength + yoga share this table; breathwork has its own.
- `session_exercises` (1669 rows) — per-set rows for strength, per-pose for yoga. Has both `set_number` (strength) and `hold_duration_seconds` / `rounds_completed` / `technique_ratio` (yoga/breathwork).
- `breathwork_sessions` (38 rows) — separate because the per-set/per-round shape doesn't fit `session_exercises`. Adds `focus_slug` (S12-T5) and `multi_phase_session_id` (S14-T5 — renamed from `cross_pillar_session_id`).
- `breathwork_logs` (0 rows) — optional per-technique log; not used today.

**Multi-phase orchestrator (S14)**
- `multi_phase_sessions` (53 rows) — header for orchestrator sessions. Columns: id, user_id, focus_slug, **session_shape** ('cross_pillar' | 'state_focus'), started_at, completed_at, phases_completed, total_phases, end_intent. Renamed from `cross_pillar_sessions` in S14-T5 via the `DO $migrate_t5_rename$` block in migrate.js.

**Progress cache**
- `exercise_progress_cache` (118 rows) — multi-kind cache: strength (best_weight, best_volume, estimated_1rm via Brzycki), yoga (best_hold_seconds), breathwork (best_breath_hold_seconds, total_rounds). S5-T1.

**Body measurements + photos**
- `body_measurements` (6 rows), `progress_photos` (0 rows). S5-T3.

**Focus areas (S11+ Approach 5)**
- `focus_areas` (17 rows) — the 17 active focuses (12 body + 5 state). `slug`, `display_name`, `focus_type` ('body'|'state'), `sort_order`, `is_active`. S11-T3.
- `focus_muscle_keywords` (35) — keyword → focus mapping for muscle-text matching. S11-T3.
- `focus_content_compatibility` (54) — many-to-many (focus, content_type, content_id, role) where role is `'main' | 'warmup' | 'cooldown' | 'bookend_open' | 'bookend_close'`. Soft FK on `(content_type, content_id)`. S11-T3.
- `focus_overlaps` (12) — directed pairs of focuses that train overlapping muscle groups (chest↔triceps as 2 rows, etc.). S12-T5. *Now in migrate.js as of STEP 1 this session.*

**Pillar levels (S11-T4)**
- `user_pillar_levels` (15 rows) — one row per user per pillar. `level` ('beginner'|'intermediate'|'advanced'), `source` ('declared'|'inferred'|'manual_override'). Promotion-only inference via the `recompute_user_pillar_level(user_id, pillar)` PG function.

**Swap-counter / exclusion (S12-T6)**
- `exercise_swap_counts` (0 rows) — per-(user, strength exercise) swap counter + finite-state `prompt_state` ('never_prompted' → 'prompted_keep' → 'excluded'). *Now in migrate.js.*
- `user_excluded_exercises` (0 rows) — pillar-aware hard exclusions `(user_id, content_type, content_id)`. Soft FK on content_id. *Now in migrate.js.*

**Unused / future**
- `habits` (0 rows), `habit_entries` (0) — built early, never shipped to UI. Carried forward for an eventual habits feature.

**Postgres functions**
- `recompute_user_pillar_level(p_user_id, p_pillar)` — single-pillar promotion-only inference with research-grounded thresholds (see migrate.js:368-595).
- `recompute_all_user_pillar_levels(p_user_id)` — wrapper that fans across all three pillars.

Both functions live in the same `s11t4Functions` block of `migrate.js`. Neither is invoked from an HTTP endpoint today — they're written to be called by background jobs / future inference triggers. The `POST /api/users/pillar-levels` onboarding endpoint UPSERTs directly with `source = 'declared'`, deliberately bypassing the inference function so user-stated levels never get overwritten.

---

## 7. Round-trip flow — "user taps Start on home"

End-to-end narrative of one full request flow. Reviewers reading this section should be able to walk the codebase top-to-bottom without further pointers.

### Step 1. User taps a focus chip on home

`app/lib/pages/home/home_page.dart` → `_onChipTap(FocusArea)` (around line 79). After a 300 ms debounce, the page calls into the orbit picker sheet (`widgets/sheets/half_pie_picker_sheet.dart`) which lets the user confirm a focus + duration. On confirm, the sheet returns control to the page which calls:

```dart
await context.read<SuggestProvider>().selectBodyFocus(focusSlug, timeBudgetMin: budget);
```

(`app/lib/providers/suggest_provider.dart:93`)

### Step 2. SuggestProvider → SuggestService → ApiService.post

`SuggestProvider.selectBodyFocus` (line 93) reads the persisted time-budget if needed, then calls `_runRequest(focusSlug, request: () => _service.requestBodyFocusSession(...))`. The race tracker inside `_runRequest` records the current request slug; if the user picks a different focus before this one returns, the late response is discarded.

`SuggestService.requestBodyFocusSession` (`app/lib/services/suggest_service.dart`) calls `_api.post(ApiConfig.sessionsSuggest, body)` — the constant resolves to `/sessions/suggest`, and `ApiConfig.url()` prepends `baseUrl` which already ends in `/api`, yielding `http://localhost:3001/api/sessions/suggest` for a default emulator build, or whatever `--dart-define=API_BASE_URL=...` was passed at build time.

`ApiService._send` (`app/lib/services/api_service.dart:125`) wraps the HTTP call with a 15-second timeout, JWT-auth headers, and the typed exception ladder (`UnauthorizedException` / `TimeoutApiException` / `NetworkException` / `ApiException`).

### Step 3. Route handler validates → calls engine

`server/src/routes/sessions.js:91` is `POST /api/sessions/suggest`. The handler:

1. Validates `focus_slug` shape (regex `/^[a-z_]{1,40}$/`), `entry_point` (one of 4), `time_budget_min` (5–240), `bracket` (one of 5 if present). 400 with stable codes on failure.
2. Calls `getFocusBySlug(focus_slug, { requireActive: true })` (line 114) which queries `focus_areas WHERE is_active = true`. 400 `unknown_focus_slug` if missing.
3. Enforces the body/state contract: body focus requires `time_budget_min`; state focus requires `bracket`.
4. Calls `generateSession({ user_id, focus_slug, entry_point, time_budget_min, bracket })` (`server/src/services/suggestion-engine/index.js:69`, post-S15-T4).
5. Stamps `result.metadata.source = 'engine_v1'` and returns 200 JSON.
6. Catches `RangeError` — maps the message substring to a stable code via `mapRangeErrorToCode` (line 66) and returns 400. Catches any other error → 500 `engine_error`.

### Step 4. Engine reads from DB, builds the plan

Continuing in `suggestion-engine/index.js`:

- `resolveFocus(focus_slug)` (line 214) — confirms the focus exists and grabs `focus_type`.
- Body-focus path dispatches by `entry_point`. For `entry_point = 'home'`, calls `generateCrossPillar({ userId, focus, levels, timeBudget })` (line 483).
- `resolveLevels(user_id)` (line 200) reads `user_pillar_levels` for the user. Missing rows default to `'beginner'` per pillar.
- The recipe function reads `focus_muscle_keywords` (`loadMuscleKeywords`), `user_excluded_exercises` (`loadExclusions`), and the content pools (exercises + breathwork techniques + yoga poses) via per-phase pick helpers (`pickBookend`, `pickStrength`, `pickYoga`).
- For body focuses, the recipe calls `checkRecencyOverlap(userId, currentFocusSlug)` (line 1633) which queries `sessions` and `focus_overlaps` and pushes a `recency_overlap` warning into the response if the user trained the same or overlapping focus yesterday.
- Returns `{ session_shape, phases, warnings, metadata }`.

### Step 5. Provider hydrates plan

Back in `SuggestProvider._runRequest`: the JSON is parsed into a `SuggestedSession` model (`app/lib/models/suggested_session.dart`), stored as `_currentSession`, the focus slug is persisted to SharedPreferences (`last_viewed_focus_slug`), `_hasUserSelectedFocus = true` (S14-T6 / FS #224), and `notifyListeners()` fires. The home page re-renders the today's-session card with the new plan.

### Step 6. User taps Start on the today's-session card

The card calls into `app/lib/launchers/session_launcher.dart` (which I have not deep-read this session — it dispatches by `session_shape` and routes to the appropriate page). For a cross-pillar session, the launcher:

1. Calls `CrossPillarSessionProvider.startFresh(session, storage: storageService)` — initializes the state machine, persists the snapshot, sets `_currentPhaseStartedAt = DateTime.now()`.
2. Navigates: `context.go('/session/cross-pillar')`.

### Step 7. MultiPhaseSessionPage renders the embedded player

`app/lib/pages/session/multi_phase_session_page.dart` reads `CrossPillarSessionProvider` and its `currentPhaseIndex` + `session.phases`. Based on the active phase's `contentType`, it instantiates one of:

- `StrengthPlayer(isEmbedded: true, phaseMetadata: …, onPhaseComplete: …)`
- `YogaSessionPlayer(isEmbedded: true, …)`
- `BreathworkPlayer(isEmbedded: true, …)`
- `SilentTimerPlayer(…)` — state-focus reflection only

The player runs. Wakelock is held (S14-T5 AMENDMENT-1 D12). Set logs from `StrengthPlayer` flow to its scoped `WorkoutSessionProvider` and out to `PUT /api/session/:id/log-set` — every set is one atomic upsert into `session_exercises`.

### Step 8. Phase complete → orchestrator advances

The player calls `onPhaseComplete(PhaseResult)`. The host's callback resolves to `CrossPillarSessionProvider.completeCurrentPhase(result, storage: storage)`:

1. Appends to `_phaseResults`.
2. Sets the current phase's status to `completed` (or `skipped`).
3. `_advance()` increments `_currentPhaseIndex` and resets the per-phase elapsed anchors.
4. Persists the snapshot.
5. `notifyListeners()`.

The page re-renders with the next phase's player. The 3-second auto-advance countdown overlay shows in between (cross-pillar only, per `useAutoAdvanceCountdown`).

### Step 9. Last phase complete → write multi-phase row

When the orchestrator detects `allPhasesDone == true`, the page (with the navigation-guard set) calls:

```dart
await provider.complete(storage: storageService, api: apiService);
```

This calls `_writeMultiPhaseSessionRow(api, endIntent: 'completed')` (line 301), which POSTs to `/api/multi-phase-sessions` with:

```js
{
  focus_slug: 'biceps',
  session_shape: 'cross_pillar',
  started_at: '...',
  completed_at: '...',
  phases_completed: 5,
  total_phases: 5,
  end_intent: 'completed',
  strength_yoga_session_ids: [...],
  breathwork_session_ids: [...]
}
```

The route handler (`server/src/routes/multi-phase-sessions.js`) validates the payload (each field has its own stable 400 code), opens a transaction, INSERTs the `multi_phase_sessions` row, runs `UPDATE sessions SET multi_phase_session_id = $newId WHERE id = ANY($syIds) AND user_id = $userId`, runs the same against `breathwork_sessions`, and COMMITs. Returns 201 `{ id }`.

### Step 10. Pillar-level inference (deferred)

The `recompute_user_pillar_level` PG function is **not** triggered from the multi-phase-sessions POST today. It exists as a callable function (`migrate.js:368-595`) but grep across `server/src/` finds no HTTP route or backend script that calls it. The function could still be wired via a DB trigger or a cron job — that path hasn't been verified. Tracked at **FS #242** (Sprint 15 backend hygiene pass): query `pg_trigger` and `pg_proc` to confirm whether (a) trigger-wired, (b) cron-wired, or (c) genuinely orphaned. Until that's resolved, treat pillar-level promotion as "unverified" rather than "deferred."

### Step 11. Navigation to summary

`MultiPhaseSessionPage._navigatingToSummary = true` (suppresses the defensive null-session bail in `build()`), then `context.go('/session/summary', extra: SessionSummaryArgs(...))`. The summary page reads the args, fetches streaks from `GET /api/users/me/streaks` for the celebration overlay (S14-T6), and renders the share card.

---

## 8. Observability

Sentry is the single vendor across the stack. Flutter side shipped in S15-T2 (May 16, 2026); Node side in S15-T3 (May 16, 2026). Two separate Sentry projects under the same org (`dailyforge-3i`): `dailyforge-flutter` and `dailyforge-node`. Separate projects per runtime keeps quota, release tracking, and alert rules independent.

Both halves share the same discipline:

- **DSN-gated init.** Empty / unset DSN = full no-op, zero network calls, zero overhead. Dev builds skip Sentry by default.
- **PII off at the SDK level.** `sendDefaultPii: false` on both sides. The SDK never attaches email, request headers, or client IP.
- **Org-level IP storage off.** The Sentry web console toggle **"Prevent Storing of IP Addresses"** is ON for the whole org. This is the real geographic-PII gate — `sendDefaultPii: false` alone is not enough, because Sentry derives geography server-side from the request IP unless the org toggle is set. Both layers together = belt and braces. **Do not turn the org toggle off** without an explicit privacy review.
- **User scope is id-only.** Only `user.id` (as a string) is ever attached. No email, no username.
- **Performance traces at 20%.** `tracesSampleRate: 0.2` on both sides. Cheap calibration; revisit after first month of beta data.

### 8.1. Client (Flutter)

`SentryFlutter.init` is wired in `app/lib/main.dart` and runs **only** when `--dart-define=SENTRY_DSN=...` is passed at build time. `AuthProvider` sets / clears the Sentry scope on all five user-state transitions (`login`, `register`, `initialize` for app-restart-with-stored-token, `logout`, `_handleUnauthorized` for the 401 fallback) — only `user.id` is ever passed to `SentryUser`.

Build flags for a QA / production build:

```
flutter build apk \
  --dart-define=API_BASE_URL=https://api.dailyforge.app/api \
  --dart-define=SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project> \
  --dart-define=APP_ENV=production \
  --dart-define=SENTRY_RELEASE=dailyforge-flutter@1.0.0+1
```

Symbol / source-map upload is manual via `app/scripts/upload-sentry-symbols.sh` (requires `sentry-cli` + `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` env vars). CI integration is queued for S15-T5.

### 8.2. Server (Node)

`@sentry/node` (v10+) is wired via the Sentry v8+ Express API — `Sentry.expressIntegration()` declared in `init()` plus `Sentry.setupExpressErrorHandler(app)` mounted inside `createApp()`. The deprecated v7 `Sentry.Handlers.*` middleware is not used.

**Init runs via `node --import`,** not by a top-of-file call. The npm scripts in `server/package.json` reference `--import ./src/observability/instrument.js`, which loads `initSentry()` before any Express module imports. This is required: under ESM, `import` statements are hoisted, so an in-file call to `initSentry()` would run after Express had already loaded — too late for Sentry's auto-instrumentation to patch the `http` / `express` modules.

```
server/
├── package.json                          # dev/start scripts use --import
└── src/
    ├── observability/
    │   ├── instrument.js                 # node --import entry: calls initSentry()
    │   └── sentry.js                     # initSentry() + isSentryEnabled()
    └── middleware/
        ├── auth.js                       # exports authChain = [authenticate, sentryUser]
        └── sentryUser.js                 # Sentry.setUser({ id: String(req.user.id) })
```

**User scope is attached via the `authChain` bundle.** `server/src/middleware/auth.js` exports `authChain = [authenticate, sentryUser]`. Every auth-gated router uses `router.use(...authChain)` (or `(...authChain, handler)` for per-route gating). `sentryUser` is a no-op when `req.user` is absent, so the only paths that touch Sentry user scope are the auth-gated ones. The login / register endpoints in `routes/auth.js` are intentionally unauthenticated and do not run `sentryUser`.

**Error capture.** `Sentry.setupExpressErrorHandler(app)` mounts AFTER all route mounts and BEFORE the project `errorHandler`. Express convention: error handlers run in declaration order; Sentry's must see the error before the project handler responds. The mount is gated on `isSentryEnabled()` so dev (no DSN) skips it entirely.

**Performance tracing.** Sentry's Express integration auto-instruments routes — no per-handler wrapping needed. The three engine routes (`POST /api/sessions/suggest`, `GET /api/sessions/last`, `POST /api/sessions/save-as-routine`) are sampled at the same 20% rate as everything else; they're not specially boosted because route-level metric drilldown in the Sentry dashboard is per-route anyway.

**Run with Sentry locally.** Add `SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>` to `server/.env` (don't commit `.env`; `.env.example` carries the empty form). Then `npm run dev` from `server/` — the `--import ./src/observability/instrument.js` flag in the `dev` script will init Sentry before Express loads.

**Trap 1 — dotenv ordering.** `instrument.js` must call `import 'dotenv/config'` *before* `import { initSentry } from './sentry.js'`. The `--import` chain runs ahead of `src/index.js` (which is where `config/env.js` would normally load dotenv), so without an explicit dotenv import inside `instrument.js`, `process.env.SENTRY_DSN` is empty at init time and the SDK silently no-ops. Failure mode is silent — no error, no log. Verified during S15-T3 deliberate-error testing.

**Trap 2 — per-request user scope.** `sentryUser` middleware uses `Sentry.getIsolationScope().setUser({...})`, not the shorthand `Sentry.setUser({...})`. Both work under `expressIntegration()` today because Sentry's OTel-AsyncLocalStorage plumbing gives each request its own current scope. But pinning to the isolation scope makes the per-request boundary explicit at the call site — protects against future code paths that bypass the OTel context (workers, queue consumers, nested `Sentry.withScope()` calls in route handlers). Without this guard, user attribution could leak across concurrent requests — a real PII boundary, not a cosmetic one.

Release tracking reads `process.env.npm_package_version` when run via `npm`, falling back to a `package.json` read when invoked with bare `node`. Environment tag comes from `NODE_ENV`.

### 8.3. Known gaps

- **Sentry sampling calibration.** `tracesSampleRate: 0.2` is a starting guess. Revisit after first month of beta data — `FUTURE_SCOPE.md` candidate flagged in S15-T3 §9.
- **Structured logging.** `console.error` calls in route handlers remain as local-dev aids; Sentry captures uncaught errors but local-dev logs are still ad-hoc. Logger replacement (winston / pino) is out-of-scope for S15 — possibly S17.
- **Source maps for Node.** Not needed — Node does not ship minified bundles, so stack traces are already readable.
- **CI release upload.** Manual today via `sentry-cli`. CI integration for both client and server is queued for S15-T5.

---

## 9. Operating model

DailyForge is built by a solo founder operating with Claude.ai as PM/architect and Claude Code as senior engineer. Specs and architectural decisions are authored in Claude.ai conversations, then handed to Claude Code as downloadable markdown prompts (the prompt that produced this document is a representative example — multi-phase, halt-and-greenlight between phases, explicit drift-flag rules). Claude Code reads the live code, executes, and reports back **without auto-committing**. The founder runs device tests on a physical Android phone before greenlighting commits. The model has shipped 14 sprints (Sprints 1–6 React PWA + Sprints 7–14 Flutter rebuild).

The repository carries the artifacts of this model: sprint-tagged commits, `Trackers/SPRINT_TRACKER.md` with the strategic pivot points, `Trackers/FUTURE_SCOPE.md` (304 lines at S14 close) as the running debt + intent ledger, per-ticket spec files (`Trackers/S14-T*-spec.md`) plus their amendments (`Trackers/S14-T*-AMENDMENT-*.md`), and preflight scripts at `server/scripts/preflight-s*.mjs` that drift-check before each ticket starts.

---

## 10. Known debt and deferred work

Pulled from `Trackers/FUTURE_SCOPE.md` (304 lines, FS #1 through #241). Grouped by severity for reviewer triage. FS numbers cited inline.

### 10.1. High priority (blocks broader signups)

- **Infrastructure separation.** Single Neon prod DB serves both real use and smoke testing. No dev environment. Need separate dev/staging/prod databases before opening signups beyond the founder. (No specific FS number — described in this doc §4.3 and §4.7.)
- **FS #198** — Engine cross-pillar phase-substitution fallback. Cross-pillar sessions sometimes emit 4 phases instead of 5 when the muscle-specific pool empties (biceps cooldown drop, S14-T2 AMENDMENT-1). Home page is branded "5-phase" — a 4-phase session is a leaky abstraction. Engine substitution ladder (adjacent muscle → generic restorative → allow warmup duplicate). ~30–50 LOC + smoke assertion.
- **FS #209** — Neon DB cold-start timeout bump. `ApiService._kRequestTimeout = 15s` is too tight for Neon cold-starts (8–12s warmup is common). Client maps the timeout to `NetworkException → "Check your connection"` which misleads users. Either bump to 30s for engine endpoints or warm via `/api/health` at app boot.

### 10.2. Medium priority

- **FS #160** — ✅ Engine architecture extraction. **Shipped S15-T4** (May 17, 2026, feat `9aa95d6`). The 1791-LOC monolith now lives as a 12-file modular tree at `server/src/services/suggestion-engine/`. See §4.4.8 for the actual structure and the layout-decision rationale. Originally proposed alongside FS #166 (typed-error refactor); FS #166 remains open and will fold in the engine-touch follow-ups (#255 `fitMainCandidate` cleanup, #256 `MOBILITY_MAIN_STYLES` cleanup, #257 Sentry on recency catch).
- **FS #166** — Engine `RangeError`-by-string-match → typed errors. The route mapper at `server/src/routes/sessions.js:66-74` matches substrings of engine throw messages to stable codes. Brittle — silently breaks if the engine's throw text changes.
- **FS #199 / #200** — Engine should emit savasana for yoga sessions, and `metadata.yoga_style` for swap-style filtering.
- **FS #201** — Body-focus yoga library audit. `hips` is a meaningful yoga concept but is not a seeded body focus slug; engine throws `Unknown or inactive focus_slug: hips`. Likely 50+ yoga poses are invisible to `yoga_tab` queries.
- **FS #205** — Breathwork audio. Sprint 9 deliberately deferred audio; players are silent. Pre-recorded chimes via `audioplayers` recommended.
- **FS #207** — Profile screen with pillar levels + level-up progress. Users can't see their declared/inferred levels today.
- **FS #208** — Cross-pillar yoga style coherence. Warmup and cooldown phases may draw from different styles (vinyasa warmup, hatha cooldown) within one session.
- **FS #212** — Unified `v_completed_sessions` Postgres VIEW. `sessions`, `breathwork_sessions`, and the FK chain require 3-way UNIONs in 4+ endpoints today.
- **FS #215** — Coerce `req.user.id` to int at the auth-middleware boundary. Several routes coerce locally; should be one place.
- **FS #228** — `PillarSessionException` sealed parent for the launcher error ladder.

### 10.3. Low priority

- **FS #130** — `pg` / `pg-connection-string` SSL deprecation. Informational warning on every `node` run. SSL modes `prefer` / `require` / `verify-ca` will adopt standard libpq semantics in pg v3.0.0. Action when triggered: audit `.env` sslmode, then either pin pg or migrate the connection string to explicit `sslmode=verify-full` or `uselibpqcompat=true&sslmode=require`. Test against Neon Singapore before shipping.
- **FS #141 / FS #194 / FS #195** — `exercises` table soft-delete + `equipment` column. Engine + adapter currently work around by dropping `is_active` filters and `equipment` fields. Close after a content sprint.
- **FS #217 / #218 / #220** — Smoke harness determinism / transaction wrapping / fixture key stability.
- **FS #219** — Streak endpoint HTTP 400 → 500 audit. **[Flagged 2026-05-15]** I re-read the handler while writing `docs/API.md`; the 400 path the FS describes does not appear to exist in the current code. Needs investigation before being actioned — see the inline note appended to FS #219 itself.
- **FS #222** — Add explanatory comment for the `is_first: row.total <= 1` race boundary in the streaks endpoint.
- **FS #229** — Document the hot-reload-on-`ChangeNotifier` hazard in CONTRIBUTING.md (no CONTRIBUTING.md exists yet).
- **FS #233** — `developer.log` over `debugPrint` for release-build observability.
- **FS #239 / #240 / #241** — Yoga adapter test coverage gaps.

### 10.4. Convention drift / hygiene

- **FS #196** — `ApiConfig.baseUrl` ends in `/api`; endpoint constants must not re-prefix. Document the convention at the top of `app/lib/config/api_config.dart`.
- **FS #216 / #234** — Dart `catch (e)` → `on Exception catch` sweep.
- **FS #226** — *Shipped Commit 2.* State-focus slugs centralized in `app/lib/constants/focus_categories.dart` (single source of truth).
- **FS #224** — *Shipped Commit 2.* Yoga tab cold-start empty state.

**Plus the doc-debt items from STEP 1 of this session:**
- Root `package.json` declares a `client` workspace that no longer exists.
- Two preflight scripts (`preflight-s12-t5-overlaps.mjs`, `preflight-s12-t6-schema.mjs`) marked PARTIALLY SUPERSEDED on 2026-05-15.

---

## 11. What's intentionally NOT built yet

Product decisions, not omissions:

- **No ads.** Ever. The app is monetized via in-app purchases (planned post-launch), not advertising.
- **No social features.** No following, no leaderboards, no shared workouts, no friends. DailyForge is a personal-practice tool.
- **No AI coaching beyond the suggestion engine.** The engine picks content; it doesn't produce written coaching, voice cues, or generative form feedback.
- **Cardio is not a 4th pillar.** Walking, running, cycling don't get pillar-level integration today. The user can log "stretching" sessions but cardio rounds out via the body-measurements weight trend instead.
- **No iOS today.** Flutter is cross-platform but the founder is Android-first via Google Play.
- **No PWA fallback.** The original React PWA was migrated and decommissioned (Apr 13, 2026 decision).

---

## 12. Glossary

- **Approach 5** — Post-Sprint-11 strategic pivot (Apr 26, 2026) from "5-phase session as flagship daily experience" to "plan-first home with cross-pillar focus areas." Source: `Trackers/PRE_SPRINT_11_PLANNING.md`.
- **Body focus** — One of 12 muscle-targeted focuses (biceps, chest, hamstrings, full_body, mobility, etc.). Body focuses require a `time_budget_min` parameter. State focuses are hidden from body-only entry points.
- **State focus** — One of 5 affective focuses (calm, energize, focus, sleep, recover). State focuses require a `bracket` parameter and run via the 3-stage state-focus chain (centering → practice → reflection). Hidden from `strength_tab` / `yoga_tab` pickers.
- **5-phase session** — Cross-pillar session shape with phases `bookend_open → warmup → main → cooldown → bookend_close`. Default `session_shape: 'cross_pillar'`.
- **Multi-phase session** — Generalization (S14-T5) covering both 5-phase cross_pillar AND 3-stage state_focus. The renaming swept the orchestrator table (`cross_pillar_sessions → multi_phase_sessions`) and provider (`CrossPillarSessionProvider` → abstract `MultiPhaseSessionProvider` + 2 subclasses).
- **Pillar** — One of strength / yoga / breathwork. The three columns of the user's practice.
- **Cold start** — Either (a) Neon DB warming up after idle (8–12s real-world), or (b) Flutter app first launch with no persisted state.
- **Recency overlap** — Engine-detected condition where the user trained the same or muscle-overlapping focus yesterday. Surfaces as a `recency_overlap` warning with `alternative_focus_slug: 'recover'`.
- **Swap-state machine** — Per-strength-exercise finite-state machine (`never_prompted → prompted_keep → excluded`) driving the 3rd-swap exclusion prompt. Lives in `services/swapCounter.js` and `exercise_swap_counts` / `user_excluded_exercises`.
- **EmbeddablePlayer** — Mixin in `app/lib/players/embeddable_player.dart` that pillar players implement to render either as a standalone Scaffold or as a body subtree inside the multi-phase orchestrator.
- **MultiPhaseSessionProvider** — Abstract base provider in `app/lib/providers/multi_phase_session_provider.dart` owning the orchestrator state machine. Concrete subclasses are `CrossPillarSessionProvider` and `StateFocusSessionProvider`.
- **Phase result** — Immutable `PhaseResult` payload (`app/lib/players/phase_result.dart`) a player emits via `onPhaseComplete` when its completion condition fires. Carries pillar-specific structured data and the per-pillar `sessionId` FK for the eventual multi-phase write.

---

> Notes for future regenerations:
>
> - This document refers to `Trackers/PRE_SPRINT_11_PLANNING.md` and `Trackers/_archive/S12-suggestion-engine-spec.md` for strategic / contractual material. If either file moves, update the link.
> - Section 4.4 covers an engine of 1791 LOC. When that file is extracted (see §10.2), this section should be rewritten with the new module layout.
> - The `// review:` markers in this document are honest uncertainty flags — they appear where the original prompt referenced details I could not verify against the code. They should be resolved or rephrased on the next regeneration, not silently dropped.

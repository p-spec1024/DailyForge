# DailyForge — Architecture Diagrams

> Mermaid source. Renders inline on GitHub. PNG export of Diagram 2 is at `architecture-diagram.png`. Last regenerated 2026-05-15 (Sprint 14 closed).

---

## 1. System Context

```mermaid
graph TB
    User["User on Android phone"] -->|Flutter app| App["DailyForge Flutter App<br/>app/"]
    App -->|HTTPS REST<br/>JWT Bearer| API["DailyForge Backend<br/>Node + Express<br/>server/src/index.js"]
    API -->|SQL over TLS| DB[("Neon PostgreSQL<br/>ap-southeast-1<br/>(Singapore)")]
    API -->|REST| ImageKit["ImageKit CDN<br/>(media)"]
    App -->|GLB asset<br/>(bundled)| GLB["assets/models/<br/>male_anatomy_split.glb"]
    App -->|cached_network_image| ImageKit
```

**Narration.** One external actor (the founder on a physical Android phone today; future users post-launch), one mobile client, one backend, one database, one media CDN. There is no separate dev environment — the Flutter client points at the prod Neon instance via the founder's LAN IP (`app/lib/config/api_config.dart:13`). The 3D body-map asset is bundled into the app rather than fetched from ImageKit.

---

## 2. Component Diagram

```mermaid
graph TB
    subgraph Flutter["Flutter app (app/)"]
        direction TB
        Pages["Pages<br/>home_page.dart<br/>strength_page.dart<br/>yoga_page.dart<br/>breathwork_page.dart<br/>multi_phase_session_page.dart<br/>(29 page files)"]
        Players["Players<br/>strength_player.dart<br/>yoga_session_player.dart<br/>breathwork_player.dart<br/>silent_timer_player.dart<br/>(EmbeddablePlayer mixin)"]
        Orchestrator["MultiPhaseSessionProvider<br/>(abstract)<br/>+ CrossPillarSessionProvider<br/>+ StateFocusSessionProvider"]
        ContentProviders["Content providers<br/>SuggestProvider<br/>HomeProvider<br/>StrengthProvider<br/>YogaProvider<br/>BreathworkProvider<br/>BodyMapProvider<br/>(21 providers total)"]
        ApiService["ApiService<br/>15s timeout<br/>401 → logout<br/>typed exceptions"]
        StorageService["StorageService<br/>flutter_secure_storage (JWT)<br/>shared_preferences<br/>(snapshot keys)"]
    end

    subgraph Server["Node + Express (server/)"]
        direction TB
        Routes["Routes (20 files)<br/>auth.js, users.js, sessions.js,<br/>session.js, multi-phase-sessions.js,<br/>focus-areas.js, exercises.js, yoga.js,<br/>breathwork.js, workout.js, ..."]
        Auth["middleware/auth.js<br/>JWT verify → req.user"]
        ErrorHandler["middleware/errorHandler.js<br/>5xx → Internal server error"]
        Engine["services/suggestionEngine.js<br/>generateSession<br/>getAvailableDurations<br/>checkRecencyOverlap<br/>BRACKET_TABLE<br/>(1791 LOC)"]
        SwapCounter["services/swapCounter.js<br/>+ substitutionLadder.js<br/>(S12-T6 / FS #198)"]
        SessionFmt["services/sessionFormatter.js<br/>(S12-T7 last-session)"]
        OtherServices["services/<br/>progressService.js<br/>suggestions.js<br/>bodyMapService.js<br/>milestones.js<br/>muscleMapping.js<br/>users.js"]
        Pool["db/pool.js<br/>pg.Pool max=5"]
    end

    DB[("Neon PostgreSQL<br/>29 tables, 2 functions")]
    CDN["ImageKit"]

    Pages -->|context.read / watch| ContentProviders
    Pages -->|context.read| Orchestrator
    Pages -->|renders as host| Players
    Players -->|onPhaseComplete<br/>PhaseResult| Orchestrator
    Orchestrator -->|persist snapshot| StorageService
    ContentProviders -->|HTTP calls<br/>via service classes| ApiService
    Orchestrator -->|POST /multi-phase-sessions| ApiService
    ApiService -->|HTTPS + JWT| Routes
    ApiService -->|getToken / deleteToken| StorageService

    Routes --> Auth
    Routes -->|sessions.js| Engine
    Routes -->|workout.js, exercises.js| SwapCounter
    Routes -->|sessions.js /last| SessionFmt
    Routes -->|progress.js, suggestions.js,<br/>body-map.js, dashboard.js| OtherServices
    Routes --> ErrorHandler
    Engine --> Pool
    SwapCounter --> Pool
    SessionFmt --> Pool
    OtherServices --> Pool
    Pool -->|SQL over TLS| DB
    Routes -.->|media uploads| CDN

    style Engine fill:#fcebd5,stroke:#D85A30,stroke-width:2px,color:#000
    style Orchestrator fill:#d5e8fc,stroke:#5DCAA5,stroke-width:2px,color:#000
    style ApiService fill:#e0e0ff,stroke:#a78bfa,stroke-width:1.5px,color:#000
```

**Narration.** This is the load-bearing diagram for an outside reviewer. The Flutter app is built around 21 `ChangeNotifier` providers wired in `main.dart`; pages read providers and dispatch user actions; providers call into thin service classes that all route through `ApiService` (the single HTTP boundary with timeout, 401-handling, and typed exceptions). The `MultiPhaseSessionProvider` abstract base + 2 concrete subclasses (cross-pillar and state-focus, S14-T5) are isolated from the content providers because they own a different concern — the orchestrator state machine and the embedded-player handoff via `PhaseResult`. On the backend, the suggestion engine is the central service touched by `routes/sessions.js`; the swap-counter machinery (S12-T6) lives in `services/swapCounter.js` and is invoked from `workout.js` (slot/choose) and `exercises.js` (exclude / keep-suggesting). All DB access goes through `db/pool.js` — a single `pg.Pool` capped at 5 concurrent connections to fit Neon free-tier limits.

---

## 3. Sequence — "Start a session"

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant HP as HomePage
    participant SP as SuggestProvider
    participant SS as SuggestService
    participant API as ApiService
    participant R as routes/sessions.js
    participant E as suggestionEngine.js
    participant DB as Postgres
    participant Launcher as session_launcher.dart
    participant CP as CrossPillarSessionProvider
    participant MPS as MultiPhaseSessionPage
    participant Player as StrengthPlayer (embedded)

    U->>HP: Tap focus chip, pick duration in sheet
    HP->>SP: selectBodyFocus('biceps', timeBudgetMin: 30)
    SP->>SS: requestBodyFocusSession(...)
    SS->>API: post('/sessions/suggest', {focus_slug, entry_point: 'home', time_budget_min})
    API->>R: POST /api/sessions/suggest + Bearer JWT
    R->>R: validate shape, resolve focus, enforce body/state contract
    R->>E: generateSession({user_id, focus_slug, entry_point, time_budget_min})
    E->>DB: SELECT focus_areas WHERE slug=$1 AND is_active=true
    E->>DB: SELECT user_pillar_levels WHERE user_id=$1
    E->>DB: SELECT focus_muscle_keywords, user_excluded_exercises, ...
    E->>DB: checkRecencyOverlap → SELECT sessions JOIN focus_overlaps
    E-->>R: {session_shape: 'cross_pillar', phases: [...], warnings: [...], metadata}
    R-->>API: 200 + body (metadata.source='engine_v1')
    API-->>SS: Map<String, dynamic>
    SS-->>SP: SuggestedSession
    SP->>SP: persist focus_slug + time_budget_min to SharedPreferences
    SP-->>HP: notifyListeners (currentSession set)

    U->>HP: Tap Start on today's-session card
    HP->>Launcher: dispatch(session)
    Launcher->>CP: startFresh(session, storage: storageService)
    CP->>CP: init state machine, persist snapshot
    Launcher->>MPS: context.go('/session/cross-pillar')
    MPS->>Player: StrengthPlayer(isEmbedded: true, phaseMetadata, onPhaseComplete)
    Player->>Player: run session, log sets via PUT /api/session/:id/log-set
    Player->>CP: onPhaseComplete(PhaseResult)
    CP->>CP: advance, persist
    Note over MPS,Player: Loop until allPhasesDone == true

    MPS->>CP: complete(storage, api)
    CP->>API: post('/multi-phase-sessions', {focus_slug, session_shape, ids, end_intent: 'completed'})
    API->>R: POST /api/multi-phase-sessions
    R->>DB: BEGIN; INSERT multi_phase_sessions RETURNING id;<br/>UPDATE sessions/breathwork_sessions SET multi_phase_session_id=...; COMMIT
    R-->>API: 201 {id}
    CP->>CP: clear snapshot
    MPS->>MPS: navigate to /session/summary
```

**Narration.** This sequence covers the full round-trip from focus-chip tap to multi-phase row write. Key entry points: `home_page.dart` (`_onChipTap`, around line 79) → `SuggestProvider.selectBodyFocus` (`app/lib/providers/suggest_provider.dart:93`) → `SuggestService.requestBodyFocusSession` → `ApiService._send` (`app/lib/services/api_service.dart:125`) → `POST /api/sessions/suggest` handler at `server/src/routes/sessions.js:91` → `generateSession` at `server/src/services/suggestionEngine.js:1714`. The session-complete fanout is `MultiPhaseSessionProvider.complete` (`app/lib/providers/multi_phase_session_provider.dart:285`) → `_writeMultiPhaseSessionRow` (line 301) → `POST /api/multi-phase-sessions` handler at `server/src/routes/multi-phase-sessions.js:54`. State-focus sessions follow the same shape but route to `/session/state-focus` and use `StateFocusSessionProvider` (no 3s auto-advance countdown).

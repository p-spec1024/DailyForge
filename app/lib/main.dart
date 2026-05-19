import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'config/theme.dart';
import 'config/routes.dart';
import 'providers/auth_provider.dart';
import 'providers/body_map_provider.dart';
import 'providers/breathwork_provider.dart';
import 'providers/cross_pillar_session_provider.dart';
import 'providers/state_focus_session_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/home_provider.dart';
import 'providers/profile_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/strength_provider.dart';
import 'providers/focus_duration_provider.dart';
import 'providers/suggest_provider.dart';
import 'providers/workout_session_provider.dart';
import 'providers/yoga_provider.dart';
import 'providers/calendar_provider.dart';
import 'providers/progress_provider.dart';
import 'providers/yoga_session_provider.dart';
import 'providers/body_measurements_provider.dart';
import 'providers/onboarding_provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/onboarding_service.dart';
import 'services/storage_service.dart';

// S15-T2: Sentry build-time configuration. Empty DSN means no init,
// no network calls — dev builds behave identically to pre-S15-T2.
const String _sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');
const String _appEnv = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
const String _sentryRelease = String.fromEnvironment('SENTRY_RELEASE', defaultValue: '');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (_sentryDsn.isEmpty) {
    runApp(const DailyForgeApp());
    return;
  }

  await SentryFlutter.init(
    (options) {
      options.dsn = _sentryDsn;
      options.environment = _appEnv;
      // PII minimization: no request headers, no IP. user.id only,
      // set explicitly by AuthProvider on auth state transitions.
      options.sendDefaultPii = false;
      if (_sentryRelease.isNotEmpty) {
        options.release = _sentryRelease;
      }
      options.tracesSampleRate = 0.2;
      // S16-T2: enrich ApiException events with engine_code + http_status
      // tags so engine contract errors are filterable in the Sentry dashboard.
      options.beforeSend = (event, hint) {
        final throwable = event.throwable;
        if (throwable is ApiException) {
          event.tags = <String, String>{
            ...?event.tags,
            'http_status': throwable.statusCode.toString(),
            if (throwable.code != null) 'engine_code': throwable.code!,
          };
        }
        return event;
      };
    },
    appRunner: () => runApp(const DailyForgeApp()),
  );
}

class DailyForgeApp extends StatefulWidget {
  const DailyForgeApp({super.key});

  @override
  State<DailyForgeApp> createState() => _DailyForgeAppState();
}

class _DailyForgeAppState extends State<DailyForgeApp> {
  late final ApiService _apiService;
  late final StorageService _storageService;
  late final AuthProvider _authProvider;
  late final DashboardProvider _dashboardProvider;
  late final StrengthProvider _strengthProvider;
  late final WorkoutSessionProvider _workoutSessionProvider;
  late final ProfileProvider _profileProvider;
  late final SettingsProvider _settingsProvider;
  late final BreathworkProvider _breathworkProvider;
  late final YogaProvider _yogaProvider;
  late final YogaSessionProvider _yogaSessionProvider;
  late final CalendarProvider _calendarProvider;
  late final ProgressProvider _progressProvider;
  late final BodyMeasurementsProvider _bodyMeasurementsProvider;
  late final BodyMapProvider _bodyMapProvider;
  late final HomeProvider _homeProvider;
  late final SuggestProvider _suggestProvider;
  late final FocusDurationProvider _focusDurationProvider;
  late final OnboardingProvider _onboardingProvider;
  late final CrossPillarSessionProvider _crossPillarSessionProvider;
  late final StateFocusSessionProvider _stateFocusSessionProvider;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final storage = StorageService();
    final api = ApiService(storage);
    final authService = AuthService(api, storage);
    _apiService = api;
    _storageService = storage;

    _authProvider = AuthProvider(authService, api);
    _authProvider.initialize();

    _dashboardProvider = DashboardProvider(api);
    _strengthProvider = StrengthProvider(api);
    _workoutSessionProvider = WorkoutSessionProvider(api);
    _profileProvider = ProfileProvider(api);
    _settingsProvider = SettingsProvider(api);
    _breathworkProvider = BreathworkProvider(api);
    _yogaProvider = YogaProvider(api);
    _yogaSessionProvider = YogaSessionProvider(api);
    _calendarProvider = CalendarProvider(api);
    _progressProvider = ProgressProvider(api);
    _bodyMeasurementsProvider = BodyMeasurementsProvider(api);
    _bodyMapProvider = BodyMapProvider(api);
    _homeProvider = HomeProvider(api);
    _suggestProvider = SuggestProvider(api, storage);
    _focusDurationProvider = FocusDurationProvider(api);
    _onboardingProvider = OnboardingProvider(OnboardingService(api));
    _crossPillarSessionProvider = CrossPillarSessionProvider();
    _stateFocusSessionProvider = StateFocusSessionProvider();

    // Reset user-scoped caches when auth is invalidated.
    _authProvider.addListener(_handleAuthChanged);

    _router = createRouter(_authProvider);
  }

  bool _wasAuthenticated = false;
  void _handleAuthChanged() {
    final isAuth = _authProvider.isAuthenticated;
    if (_wasAuthenticated && !isAuth) {
      _settingsProvider.reset();
      _profileProvider.clear();
      _progressProvider.clear();
      _bodyMeasurementsProvider.clear();
      _bodyMapProvider.clear();
      _homeProvider.clear();
      _suggestProvider.clear();
      _focusDurationProvider.clear();
      _onboardingProvider.reset();
    }
    _wasAuthenticated = isAuth;
  }

  @override
  void dispose() {
    _authProvider.removeListener(_handleAuthChanged);
    _router.dispose();
    _authProvider.dispose();
    _dashboardProvider.dispose();
    _strengthProvider.dispose();
    _workoutSessionProvider.dispose();
    _profileProvider.dispose();
    _settingsProvider.dispose();
    _breathworkProvider.dispose();
    _yogaProvider.dispose();
    _yogaSessionProvider.dispose();
    _calendarProvider.dispose();
    _progressProvider.dispose();
    _bodyMeasurementsProvider.dispose();
    _bodyMapProvider.dispose();
    _homeProvider.dispose();
    _suggestProvider.dispose();
    _focusDurationProvider.dispose();
    _onboardingProvider.dispose();
    _crossPillarSessionProvider.dispose();
    _stateFocusSessionProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // ApiService has no disposable resources (no pool, no streams), so
        // Provider.value is safe here. Revisit if ApiService ever owns a
        // persistent http.Client or similar.
        Provider<ApiService>.value(value: _apiService),
        // StorageService exposed so the S13-T5 picker sheets can read/write
        // their per-focus last-picked SharedPreferences keys without
        // re-instantiating the wrapper.
        Provider<StorageService>.value(value: _storageService),
        ChangeNotifierProvider<AuthProvider>.value(value: _authProvider),
        ChangeNotifierProvider<DashboardProvider>.value(value: _dashboardProvider),
        ChangeNotifierProvider<StrengthProvider>.value(value: _strengthProvider),
        ChangeNotifierProvider<WorkoutSessionProvider>.value(value: _workoutSessionProvider),
        ChangeNotifierProvider<ProfileProvider>.value(value: _profileProvider),
        ChangeNotifierProvider<SettingsProvider>.value(value: _settingsProvider),
        ChangeNotifierProvider<BreathworkProvider>.value(value: _breathworkProvider),
        ChangeNotifierProvider<YogaProvider>.value(value: _yogaProvider),
        ChangeNotifierProvider<YogaSessionProvider>.value(value: _yogaSessionProvider),
        ChangeNotifierProvider<CalendarProvider>.value(value: _calendarProvider),
        ChangeNotifierProvider<ProgressProvider>.value(value: _progressProvider),
        ChangeNotifierProvider<BodyMeasurementsProvider>.value(value: _bodyMeasurementsProvider),
        ChangeNotifierProvider<BodyMapProvider>.value(value: _bodyMapProvider),
        ChangeNotifierProvider<HomeProvider>.value(value: _homeProvider),
        ChangeNotifierProvider<SuggestProvider>.value(value: _suggestProvider),
        ChangeNotifierProvider<FocusDurationProvider>.value(value: _focusDurationProvider),
        ChangeNotifierProvider<OnboardingProvider>.value(value: _onboardingProvider),
        ChangeNotifierProvider<CrossPillarSessionProvider>.value(value: _crossPillarSessionProvider),
        ChangeNotifierProvider<StateFocusSessionProvider>.value(value: _stateFocusSessionProvider),
      ],
      child: MaterialApp.router(
        title: 'DailyForge',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        routerConfig: _router,
      ),
    );
  }
}

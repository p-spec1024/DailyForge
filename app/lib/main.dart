import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'config/routes.dart';
import 'providers/auth_provider.dart';
import 'providers/body_map_provider.dart';
import 'providers/breathwork_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/home_provider.dart';
import 'providers/profile_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/strength_provider.dart';
import 'providers/workout_session_provider.dart';
import 'providers/yoga_provider.dart';
import 'providers/calendar_provider.dart';
import 'providers/progress_provider.dart';
import 'providers/yoga_session_provider.dart';
import 'providers/body_measurements_provider.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/storage_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DailyForgeApp());
}

class DailyForgeApp extends StatefulWidget {
  const DailyForgeApp({super.key});

  @override
  State<DailyForgeApp> createState() => _DailyForgeAppState();
}

class _DailyForgeAppState extends State<DailyForgeApp> {
  late final ApiService _apiService;
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
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final storage = StorageService();
    final api = ApiService(storage);
    final authService = AuthService(api, storage);
    _apiService = api;

    _authProvider = AuthProvider(authService, api);
    _authProvider.initialize();
    
    _dashboardProvider = DashboardProvider(api);
    _strengthProvider = StrengthProvider(api);
    _workoutSessionProvider = WorkoutSessionProvider(api);
    _profileProvider = ProfileProvider(api);
    _settingsProvider = SettingsProvider(api);
    _breathworkProvider = BreathworkProvider(api);
    _yogaProvider = YogaProvider(api);
    _yogaSessionProvider = YogaSessionProvider();
    _calendarProvider = CalendarProvider(api);
    _progressProvider = ProgressProvider(api);
    _bodyMeasurementsProvider = BodyMeasurementsProvider(api);
    _bodyMapProvider = BodyMapProvider(api);
    _homeProvider = HomeProvider(api);

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

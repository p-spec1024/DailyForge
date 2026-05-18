class ApiConfig {
  // Base URL for the API. Always ends in `/api` — endpoint constants below
  // MUST NOT re-prefix `/api/`. (Retires FS #196: the `/api` convention is now
  // the documented standard. See docs/ARCHITECTURE.md §4.3.)
  //
  // Default points at localhost so a build with no --dart-define just works
  // on an emulator pointed at the laptop. For a real device on the same
  // network, pass your laptop's LAN IP:
  //   flutter run --dart-define=API_BASE_URL=http://192.168.0.204:3001/api
  // For a release build pointed at the deployed API:
  //   flutter build apk --dart-define=API_BASE_URL=https://api.dailyforge.app/api
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001/api',
  );

  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String profile = '/auth/profile';

  // Onboarding (S13-T1) — pillar-level capture for new users.
  static const String pillarLevels = '/users/pillar-levels';
  static const String myPillarLevels = '/users/me/pillar-levels';

  // Focus areas (S13-T2) — orbit-picker reference list on the home page.
  static const String focusAreas = '/focus-areas';

  // Focus-area picker support (S13-T5). Both endpoints are JWT-authed
  // and live under /api/focus-areas/:slug/...
  static String focusAreaAvailableDurations(String slug) =>
      '/focus-areas/$slug/available-durations';
  static String focusAreaSuggestedDefault(String slug) =>
      '/focus-areas/$slug/suggested-default';

  // Home page extensions (S13-T4)
  static const String homeStats = '/home/stats';
  static const String homeWeeklyActivity = '/home/weekly-activity';
  static const String homeDailyLoad = '/home/daily-load';
  static const String homeDailyCounts = '/home/daily-counts';

  // Workouts
  static const String workouts = '/workouts';
  static const String activeWorkout = '/workouts/active';
  static const String startWorkout = '/workouts/start';
  static const String completeWorkout = '/workouts/complete';
  static const String logSet = '/workouts/log-set';
  static const String deleteSet = '/workouts/delete-set';

  // Exercises
  static const String exercises = '/exercises';
  static const String exercisesStrength = '/exercises/strength';
  static const String exerciseMuscleGroups = '/exercises/muscle-groups';
  static const String exerciseAlternatives = '/exercises/alternatives';
  static const String exerciseSwap = '/exercises/swap';

  // Routines
  static const String routines = '/routines';
  static String routine(int id) => '/routines/$id';

  // Exercise detail
  static String exercise(int id) => '/exercises/$id';

  // Yoga
  static const String yogaPoses = '/yoga/poses';
  static const String yogaSession = '/yoga/session';
  static const String yogaComplete = '/yoga/complete';

  // Breathwork
  static const String breathworkTechniques = '/breathwork/techniques';
  static const String breathworkLog = '/breathwork/log';
  static const String breathworkSessions = '/breathwork/sessions';

  // Dashboard
  static const String dashboard = '/dashboard';
  static const String workoutToday = '/workout/today';

  // Analytics
  static const String progressionData = '/analytics/progression';
  static const String suggestions = '/analytics/suggestions';
  static const String calendar = '/analytics/calendar';

  // Body Measurements
  static const String bodyMeasurements = '/body-measurements';
  static const String bodyMeasurementsStats = '/body-measurements/stats';
  static String bodyMeasurement(int id) => '/body-measurements/$id';

  // Settings
  static const String settings = '/settings';

  // Sessions
  static const String sessions = '/sessions';
  static const String sessionsSuggest = '/sessions/suggest';
  static const String sessionsStartFromList = '/sessions/start-from-list';
  static const String sessionStart = '/session/start';
  static const String sessionActive = '/session/active';
  static const String sessionPreviousPerformance = '/session/previous-performance';
  static String sessionLogSet(int id) => '/session/$id/log-set';
  static String sessionComplete(int id) => '/session/$id/complete';
  static String sessionDelete(int id) => '/session/$id';

  // Helper to build full URL
  static String url(String endpoint) => '$baseUrl$endpoint';
}

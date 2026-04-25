import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConfig {
  // Override with: flutter run --dart-define=API_HOST=192.168.1.42
  static const String _overrideHost =
      String.fromEnvironment('API_HOST', defaultValue: '');
  static const int _port = 3001;

  // Android emulator: 10.0.2.2 maps to host's localhost.
  // Everywhere else (web/Windows/iOS sim/physical device on same network): localhost.
  // For a real device, pass your machine's LAN IP via --dart-define=API_HOST=...
  static String get baseUrl {
    if (_overrideHost.isNotEmpty) {
      return 'http://$_overrideHost:$_port/api';
    }
    final host = '192.168.0.204';  // Your PC IP for physical device testing
    return 'http://$host:$_port/api';
  }

  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String profile = '/auth/profile';

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
  static const String sessionStart = '/session/start';
  static const String sessionActive = '/session/active';
  static const String sessionPreviousPerformance = '/session/previous-performance';
  static String sessionLogSet(int id) => '/session/$id/log-set';
  static String sessionComplete(int id) => '/session/$id/complete';
  static String sessionDelete(int id) => '/session/$id';

  // Helper to build full URL
  static String url(String endpoint) => '$baseUrl$endpoint';
}

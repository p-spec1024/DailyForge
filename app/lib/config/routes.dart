import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../pages/auth/login_page.dart';
import '../pages/auth/register_page.dart';
import '../pages/home/home_page.dart';
import '../pages/strength/strength_page.dart';
import '../pages/yoga/yoga_page.dart';
import '../pages/breathwork/breathwork_page.dart';
import '../pages/breathwork/breathwork_timer_page.dart';
import '../pages/profile/profile_page.dart';
import '../pages/progress/exercise_history_page.dart';
import '../pages/progress/exercise_progress_page.dart';
import '../pages/workout_page.dart';
import '../pages/yoga/yoga_session_page.dart';
import '../pages/yoga/yoga_complete_page.dart';
import '../pages/body_measurements/body_measurements_page.dart';
import '../pages/body_measurements/full_month_page.dart';
import '../spike/body_map_spike.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>();

GoRouter createRouter(AuthProvider authProvider) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home',
    refreshListenable: authProvider,
    redirect: (context, state) {
      final isAuth = authProvider.isAuthenticated;
      final isLoading = authProvider.isLoading;
      final isAuthRoute = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';

      // Still checking stored token — don't redirect yet
      if (isLoading) return null;

      // Not logged in, not on auth page → go to login
      if (!isAuth && !isAuthRoute) return '/login';

      // Logged in, on auth page → go to home
      if (isAuth && isAuthRoute) return '/home';

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: '/workout',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return WorkoutPage(
            workoutId: extra?['workoutId'] as int?,
            initialExercises:
                extra?['exercises'] as List<Map<String, dynamic>>?,
          );
        },
      ),
      GoRoute(
        path: '/workout/empty',
        builder: (context, state) {
          final routineId = int.tryParse(
              state.uri.queryParameters['routineId'] ?? '');
          return WorkoutPage(routineId: routineId);
        },
      ),
      GoRoute(
        path: '/breathwork/:id',
        builder: (context, state) {
          final id = int.parse(state.pathParameters['id']!);
          return BreathworkTimerPage(techniqueId: id);
        },
      ),
      GoRoute(
        path: '/yoga/session',
        builder: (context, state) => const YogaSessionPage(),
      ),
      GoRoute(
        path: '/yoga/complete',
        builder: (context, state) => const YogaCompletePage(),
      ),
      GoRoute(
        path: '/workout/resume',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return WorkoutPage(
            resumeData: extra?['resumeData'] as Map<String, dynamic>?,
          );
        },
      ),
      GoRoute(
        path: '/exercise-history',
        builder: (context, state) => const ExerciseHistoryPage(),
      ),
      GoRoute(
        path: '/body-measurements',
        builder: (context, state) => const BodyMeasurementsPage(),
      ),
      GoRoute(
        path: '/body-measurements/month',
        builder: (context, state) {
          final month = state.extra as DateTime? ?? DateTime.now();
          return FullMonthPage(month: month);
        },
      ),
      GoRoute(
        path: '/spike/body-map',
        builder: (context, state) => const BodyMapSpikePage(),
      ),
      GoRoute(
        path: '/exercise-progress/:id',
        builder: (context, state) {
          final id =
              int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
          final type =
              state.uri.queryParameters['type'] ?? 'strength';
          return ExerciseProgressPage(exerciseId: id, type: type);
        },
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => _ScaffoldWithNav(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const HomePage(),
          ),
          GoRoute(
            path: '/strength',
            builder: (context, state) => const StrengthPage(),
          ),
          GoRoute(
            path: '/yoga',
            builder: (context, state) => const YogaPage(),
          ),
          GoRoute(
            path: '/breathwork',
            builder: (context, state) => const BreathworkPage(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfilePage(),
          ),
        ],
      ),
    ],
  );
}

class _ScaffoldWithNav extends StatelessWidget {
  final Widget child;

  const _ScaffoldWithNav({required this.child});

  static const _tabs = [
    '/home',
    '/strength',
    '/yoga',
    '/breathwork',
    '/profile',
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _tabs.indexOf(location).clamp(0, _tabs.length - 1);

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: (index) => context.go(_tabs[index]),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.dumbbell),
            label: 'Strength',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.flower2),
            label: 'Yoga',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.wind),
            label: 'Breathwork',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.user),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

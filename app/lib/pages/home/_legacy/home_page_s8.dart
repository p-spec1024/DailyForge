// ignore_for_file: unused_element, unused_import
//
// Preserved copy of the Sprint 8 home page for reference during S10-T5a
// home rebuild. Not imported anywhere — kept only so logic (dashboard
// refresh, resume banner, phase dots, PR formatting) can be cribbed when
// real data wiring returns in T5c. Safe to delete once T5c ships.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../../config/theme.dart';
import '../../../providers/dashboard_provider.dart';
import '../../../providers/workout_session_provider.dart';
import '../../../widgets/glass_card.dart';
import '../../../widgets/workout/resume_banner.dart';

({int? workoutId, List<Map<String, dynamic>> exercises}) _extractWorkoutData(
    Map<String, dynamic> workout) {
  final phases = workout['phases'] as List<dynamic>? ?? [];
  final exercises = <Map<String, dynamic>>[];
  int? workoutId;
  for (final phase in phases) {
    workoutId ??= phase['workout_id'] as int?;
    final phaseKey = phase['phase'] as String? ?? '';
    if (phaseKey != 'main') continue;
    final phaseExercises = phase['exercises'] as List<dynamic>? ?? [];
    for (final ex in phaseExercises) {
      if (ex is Map<String, dynamic>) exercises.add(ex);
    }
  }
  return (workoutId: workoutId, exercises: exercises);
}

class HomePageS8 extends StatefulWidget {
  const HomePageS8({super.key});

  @override
  State<HomePageS8> createState() => _HomePageS8State();
}

class _HomePageS8State extends State<HomePageS8> {
  String? _lastShownError;
  Map<String, dynamic>? _activeSession;
  int _activeSessionRequestId = 0;
  bool _wasSessionActive = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<DashboardProvider>();
      provider.addListener(_maybeShowErrorSnack);
      if (provider.dashboardData == null) {
        provider.refresh();
      }
      final session = context.read<WorkoutSessionProvider>();
      _wasSessionActive = session.isActive;
      session.addListener(_onSessionChanged);
      _refreshActiveSession();
    });
  }

  @override
  void dispose() {
    context.read<DashboardProvider>().removeListener(_maybeShowErrorSnack);
    context.read<WorkoutSessionProvider>().removeListener(_onSessionChanged);
    super.dispose();
  }

  void _onSessionChanged() {
    final session = context.read<WorkoutSessionProvider>();
    if (session.isActive != _wasSessionActive) {
      _wasSessionActive = session.isActive;
      _refreshActiveSession();
    }
  }

  Future<void> _refreshActiveSession() async {
    final myId = ++_activeSessionRequestId;
    final session = context.read<WorkoutSessionProvider>();
    if (session.isActive) {
      if (!mounted || myId != _activeSessionRequestId) return;
      setState(() => _activeSession = null);
      return;
    }
    final data = await session.checkActiveSession();
    if (!mounted || myId != _activeSessionRequestId) return;
    setState(() => _activeSession = data);
  }

  void _handleResume() {
    final data = _activeSession;
    if (data == null) return;
    context.push('/workout/resume', extra: {'resumeData': data});
    setState(() => _activeSession = null);
  }

  Future<void> _handleDiscard() async {
    final data = _activeSession;
    if (data == null) return;
    final sessionJson = data['session'] as Map<String, dynamic>?;
    final rawId = sessionJson?['id'];
    final sessionId = rawId is num
        ? rawId.toInt()
        : (rawId is String ? int.tryParse(rawId) : null);
    if (sessionId == null) return;
    final ok = await context
        .read<WorkoutSessionProvider>()
        .discardActiveSession(sessionId);
    if (!mounted) return;
    if (ok) {
      setState(() => _activeSession = null);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not discard session. Try again.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _maybeShowErrorSnack() {
    if (!mounted) return;
    final provider = context.read<DashboardProvider>();
    final err = provider.error;
    if (err == null) {
      _lastShownError = null;
      return;
    }
    if (err == _lastShownError) return;
    _lastShownError = err;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(err),
          backgroundColor: AppColors.surface,
          action: SnackBarAction(
            label: 'Retry',
            textColor: AppColors.gold,
            onPressed: () => provider.refresh(),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<DashboardProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.dashboardData == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (provider.error != null && provider.dashboardData == null) {
            return Center(child: Text(provider.error ?? ''));
          }
          return RefreshIndicator(
            color: AppColors.gold,
            backgroundColor: AppColors.surface,
            onRefresh: () async {
              await Future.wait([
                provider.refresh(),
                _refreshActiveSession(),
              ]);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 56, 16, 24),
              children: [
                if (_activeSession != null) ...[
                  ResumeBanner(
                    startedAt: DateTime.tryParse(
                          _activeSession!['session']?['started_at']
                                  as String? ??
                              '',
                        ) ??
                        DateTime.now(),
                    onResume: _handleResume,
                    onDiscard: _handleDiscard,
                  ),
                  const SizedBox(height: 20),
                ],
                GlassCard(
                  child: Text(
                    provider.greeting,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

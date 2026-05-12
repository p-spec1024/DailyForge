import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../config/api_config.dart';
import '../config/theme.dart';
import '../models/suggested_session.dart';
import '../players/phase_metadata.dart';
import '../players/phase_result.dart';
import '../players/strength_player.dart';
import '../providers/workout_session_provider.dart';
import '../services/api_service.dart';
import '../services/wakelock_service.dart';
import 'workout/session_summary_page.dart';

/// Standalone strength session shell. Hosts the [StrengthPlayer] body and
/// owns route-driven session seeding (workoutId / routineId / resumeData /
/// engine-seeded via [SessionLauncher]).
///
/// Pre-T4 this widget owned both Scaffold chrome and the workout state
/// machine. T4 split it: the chrome stays here; the body extracted to
/// [StrengthPlayer]. [FivePhaseSessionPage] hosts the same player directly
/// for cross-pillar phase 3.
class WorkoutPage extends StatefulWidget {
  final int? workoutId;
  final List<Map<String, dynamic>>? initialExercises;

  /// Optional routine to pre-load when starting an empty session.
  final int? routineId;

  /// If provided, resume an unfinished session instead of starting a new one.
  /// Shape: `{session, logged_sets}` from `GET /session/active`.
  final Map<String, dynamic>? resumeData;

  const WorkoutPage({
    super.key,
    this.workoutId,
    this.initialExercises,
    this.routineId,
    this.resumeData,
  });

  @override
  State<WorkoutPage> createState() => _WorkoutPageState();
}

class _WorkoutPageState extends State<WorkoutPage> {
  @override
  void initState() {
    super.initState();
    WakelockService.enable();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initSession());
  }

  @override
  void dispose() {
    WakelockService.disable();
    super.dispose();
  }

  Future<void> _initSession() async {
    final provider = context.read<WorkoutSessionProvider>();
    if (provider.isActive) return; // Already in a session (e.g. launcher-seeded)

    if (widget.resumeData != null) {
      await provider.resumeActiveSession(widget.resumeData!);
      return;
    }

    if (widget.workoutId != null && widget.initialExercises != null) {
      await provider.startSession(widget.workoutId!, widget.initialExercises!);
      return;
    }

    await provider.startEmptySession();
    if (!mounted || widget.routineId == null) return;
    await _loadRoutine(widget.routineId!);
  }

  Future<void> _loadRoutine(int routineId) async {
    final api = context.read<ApiService>();
    final session = context.read<WorkoutSessionProvider>();
    final messenger = ScaffoldMessenger.of(context);
    try {
      final routine = await api.get(ApiConfig.routine(routineId));
      // Routine exercise rows expose the underlying exercise id as
      // `exercise_id`; session provider keys off `id`.
      final normalized = (routine['exercises'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map((ex) => <String, dynamic>{
                ...ex,
                'id': ex['exercise_id'] ?? ex['id'],
                'default_sets':
                    ex['target_sets'] ?? ex['default_sets'] ?? 3,
              })
          .toList();
      await session.addExercises(normalized);
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text('Could not load routine: ${e.message}'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  PhaseMetadata _metadataForStandalone(BuildContext context) {
    final session = context.read<WorkoutSessionProvider>();
    // For non-engine entries focusSlug may be null; standalone strength
    // doesn't need it for routing.
    return PhaseMetadata(
      focusSlug: session.focusSlug,
      phase: 'main',
      contentType: 'strength',
      durationMinutes: null,
      items: const <SessionItem>[],
      userLevels: const <String, String>{},
      isEmbedded: false,
    );
  }

  Future<void> _onStandaloneComplete(
      BuildContext context, PhaseResult result) async {
    if (result.wasSkipped) {
      // Discard path — player already called provider.discardSession.
      if (!context.mounted) return;
      context.go('/home');
      return;
    }
    final responseMap = result.pillarSpecific?['completion_response']
        as Map<String, dynamic>?;
    if (responseMap == null) {
      if (!context.mounted) return;
      context.go('/home');
      return;
    }
    final summary =
        (responseMap['summary'] as Map<String, dynamic>?) ?? const {};
    final prs = (responseMap['prs'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        <Map<String, dynamic>>[];

    final snapshotRaw = result.pillarSpecific?['exercises_snapshot'] as List?;
    final exercisesSnapshot = (snapshotRaw ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();

    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SessionSummaryPage(
          durationSeconds: result.actualDuration.inSeconds,
          totalVolume: (summary['total_volume'] as num?) ??
              (result.pillarSpecific?['total_volume_kg'] as num?) ??
              0,
          totalSets: (summary['total_sets'] as num?)?.toInt() ??
              (result.pillarSpecific?['sets_logged'] as int?) ??
              0,
          exercisesCompleted:
              (summary['exercises_completed'] as num?)?.toInt() ??
                  result.items.length,
          prs: prs,
          exercises: exercisesSnapshot,
          onDone: () {
            if (!mounted) return;
            context.go('/home');
          },
        ),
      ),
    );
  }

  Future<void> _confirmAndDiscard(BuildContext context) async {
    final session = context.read<WorkoutSessionProvider>();
    if (!session.isActive) {
      context.go('/home');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Discard Workout?'),
        content: const Text(
          'All logged sets will be lost. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.secondaryText)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await session.discardSession();
      if (!context.mounted) return;
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _confirmAndDiscard(context);
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: StrengthPlayer(
          isEmbedded: false,
          phaseMetadata: _metadataForStandalone(context),
          onPhaseComplete: (result) => _onStandaloneComplete(context, result),
        ),
      ),
    );
  }
}

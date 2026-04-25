import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../config/api_config.dart';
import '../config/theme.dart';
import '../providers/settings_provider.dart';
import '../providers/workout_session_provider.dart';
import '../services/api_service.dart';
import '../widgets/workout/add_exercise_sheet.dart';
import '../widgets/workout/exercise_session_card.dart';
import '../widgets/workout/exercise_swap_sheet.dart';
import '../widgets/workout/rest_timer.dart';
import '../widgets/workout/session_header.dart';
import '../widgets/workout/settings_modal.dart';
import 'workout/session_summary_page.dart';

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
  String? _lastShownError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initSession();
      context.read<SettingsProvider>().fetchSettings();
    });
  }

  Future<void> _initSession() async {
    final provider = context.read<WorkoutSessionProvider>();
    if (provider.isActive) return; // Already in a session

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

  Future<void> _handleLogSet(WorkoutSessionProvider session, int exerciseId,
      int setNumber, double weight, int reps) async {
    final response = await session.logSet(exerciseId, setNumber, weight, reps);
    if (response == null || !mounted) return;
    final settings = context.read<SettingsProvider>().settings;
    if (settings.restTimerEnabled && settings.restTimerAutoStart) {
      session.startRestTimer(settings.restTimerDuration);
    }
  }

  void _showErrorIfNeeded(WorkoutSessionProvider session) {
    final err = session.error;
    if (err != null && err != _lastShownError && session.isActive) {
      _lastShownError = err;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(err),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
        session.clearError();
      });
    }
  }

  Future<void> _handleFinish(WorkoutSessionProvider session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Finish Workout?'),
        content: Text(
          '${session.totalSets} sets logged  •  ${session.totalVolume.toStringAsFixed(0)} kg total volume',
          style: const TextStyle(color: AppColors.secondaryText),
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
              backgroundColor: AppColors.success,
              foregroundColor: Colors.white,
            ),
            child: const Text('Finish'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      // Capture totals before completeSession clears provider state.
      final elapsed = session.elapsedSeconds;
      final volume = session.totalVolume;
      final setsCount = session.totalSets;
      final exerciseCount = session.exercises.length;
      // Snapshot exercises for the "Save as Routine" flow on the summary page.
      final exercisesSnapshot = session.exercises
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

      final result = await session.completeSession();
      if (!mounted || result == null) return;

      final summary =
          (result['summary'] as Map<String, dynamic>?) ?? const {};
      final prs = (result['prs'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          <Map<String, dynamic>>[];

      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => SessionSummaryPage(
            durationSeconds:
                (summary['duration'] as num?)?.toInt() ?? elapsed,
            totalVolume:
                (summary['total_volume'] as num?) ?? volume,
            totalSets:
                (summary['total_sets'] as num?)?.toInt() ?? setsCount,
            exercisesCompleted:
                (summary['exercises_completed'] as num?)?.toInt() ??
                    exerciseCount,
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
  }

  void _handleSwap(
      WorkoutSessionProvider session, int exerciseId, String name) {
    ExerciseSwapSheet.show(
      context,
      exerciseId: exerciseId,
      currentExerciseName: name,
      onSwap: (newExercise) => session.swapExercise(exerciseId, newExercise),
    );
  }

  int _asId(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  void _handleAddExercise(WorkoutSessionProvider session) {
    final existing = session.exercises.map((e) => _asId(e['id'])).toSet();
    AddExerciseSheet.show(
      context,
      existingIds: existing,
      onAdd: (ex) => session.addExercise(ex),
    );
  }

  Future<void> _handleDiscard(WorkoutSessionProvider session) async {
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

    if (confirmed == true && mounted) {
      await session.discardSession();
      if (mounted) {
        context.go('/home');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<WorkoutSessionProvider>(
      builder: (context, session, _) {
        // Show SnackBar for errors during active session
        _showErrorIfNeeded(session);

        if (session.isLoading && !session.isActive) {
          return const Scaffold(
            backgroundColor: AppColors.background,
            body: Center(
              child: CircularProgressIndicator(color: AppColors.strength),
            ),
          );
        }

        if (session.error != null && !session.isActive) {
          return Scaffold(
            backgroundColor: AppColors.background,
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(LucideIcons.alertCircle,
                        size: 48, color: AppColors.error),
                    const SizedBox(height: 16),
                    Text(
                      session.error!,
                      style: Theme.of(context).textTheme.bodyLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => context.go('/home'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.strength,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Go Back'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (!session.isActive) {
          return Scaffold(
            backgroundColor: AppColors.background,
            body: Center(
              child: Text(
                'No active session',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          );
        }

        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) return;
            _handleDiscard(session);
          },
          child: Scaffold(
            backgroundColor: AppColors.background,
            body: SafeArea(
              child: Stack(
                children: [
                  Column(
                    children: [
                      SessionHeader(
                        elapsedNotifier: session.elapsedNotifier,
                        totalVolume: session.totalVolume,
                        totalSets: session.totalSets,
                        onFinish: () => _handleFinish(session),
                        onDiscard: () => _handleDiscard(session),
                        onSettings: () => SettingsBottomSheet.show(context),
                        formatTime: session.formatTime,
                      ),
                      Expanded(
                        child: session.exercises.isEmpty
                            ? _buildEmptyState(session)
                            : _buildExerciseList(session),
                      ),
                      _buildFinishButton(session),
                    ],
                  ),
                  if (session.isRestTimerActive)
                    RestTimer(
                      duration: session.restTimerDuration,
                      onSkip: session.skipRestTimer,
                      onFinish: session.onRestTimerComplete,
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildEmptyState(WorkoutSessionProvider session) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.plusCircle,
                size: 56, color: AppColors.strength.withValues(alpha: 0.8)),
            const SizedBox(height: 16),
            Text(
              'Add your first exercise',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 4),
            Text(
              'Build your workout on the fly',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => _handleAddExercise(session),
              icon: const Icon(LucideIcons.plus, size: 18),
              label: const Text('Add Exercise'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.strength,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                    horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExerciseList(WorkoutSessionProvider session) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: session.exercises.length + 1,
      itemBuilder: (context, index) {
        if (index == session.exercises.length) {
          return Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 16),
            child: OutlinedButton.icon(
              onPressed: () => _handleAddExercise(session),
              icon: const Icon(LucideIcons.plus, size: 18),
              label: const Text('Add Exercise'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.strength,
                side: const BorderSide(color: AppColors.strength),
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          );
        }
        final exercise = session.exercises[index];
        final exerciseId = (exercise['id'] as num).toInt();
        return ExerciseSessionCard(
          exercise: exercise,
          sets: session.exerciseSets[exerciseId] ?? const [],
          previousData: session.previousPerformance[exerciseId],
          prs: session.getExercisePrs(exerciseId),
          onLogSet: (setNumber, weight, reps) {
            _handleLogSet(session, exerciseId, setNumber, weight, reps);
          },
          onAddSet: () {
            session.addSet(exerciseId);
          },
          onSwap: session.workoutId == null
              ? null
              : () => _handleSwap(session, exerciseId,
                  exercise['name'] as String? ?? ''),
        );
      },
    );
  }

  Widget _buildFinishButton(WorkoutSessionProvider session) {
    final hasExercises = session.exercises.isNotEmpty;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: BoxDecoration(
        color: AppColors.background,
        border: Border(
          top: BorderSide(color: AppColors.cardBorder),
        ),
      ),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: (session.isLoading || !hasExercises)
              ? null
              : () => _handleFinish(session),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.success,
            foregroundColor: Colors.white,
            disabledBackgroundColor: AppColors.success.withValues(alpha: 0.5),
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.check, size: 20),
              SizedBox(width: 8),
              Text(
                'Finish Workout',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

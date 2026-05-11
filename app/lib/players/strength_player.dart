import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
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
import 'embeddable_player.dart';
import 'phase_metadata.dart';
import 'phase_result.dart';

/// S14-T4: extracted strength body widget. Renders inside [WorkoutPage]'s
/// Scaffold shell for standalone use, or directly inside
/// [FivePhaseSessionPage] for cross-pillar phase 3.
///
/// Standalone-mode contract (`isEmbedded == false`): reads the top-level
/// [WorkoutSessionProvider]. The hosting page seeds it (startSession /
/// startEmptySession / resumeActiveSession / startFromList) before this
/// widget mounts. Renders full chrome (SessionHeader + finish button).
///
/// Embedded-mode contract (`isEmbedded == true`): wraps its subtree in a
/// scoped [ChangeNotifierProvider<WorkoutSessionProvider>] (Decision #12 —
/// each embedded player owns its provider instance). Seeds via
/// `startFromList` in initState from [phaseMetadata.items]. Drops chrome —
/// orchestrator owns the AppBar / phase indicator. On all-sets-logged,
/// calls `completeSession`, builds a [PhaseResult], emits
/// `onPhaseComplete`.
///
/// Lesson #3 (sequential set activation): preserved by importing
/// [ExerciseSessionCard] + `SetRow` from `widgets/workout/` unchanged.
class StrengthPlayer extends StatefulWidget {
  final bool isEmbedded;
  final PhaseMetadata phaseMetadata;
  final void Function(PhaseResult) onPhaseComplete;

  const StrengthPlayer({
    super.key,
    required this.isEmbedded,
    required this.phaseMetadata,
    required this.onPhaseComplete,
  });

  @override
  State<StrengthPlayer> createState() => _StrengthPlayerState();
}

class _StrengthPlayerState extends State<StrengthPlayer>
    with EmbeddablePlayer {
  @override
  bool get isEmbedded => widget.isEmbedded;

  @override
  PhaseMetadata get phaseMetadata => widget.phaseMetadata;

  @override
  void Function(PhaseResult) get onPhaseComplete => widget.onPhaseComplete;

  @override
  Widget build(BuildContext context) {
    if (widget.isEmbedded) {
      // Scoped-provider subtree. The provider is created fresh on each phase
      // mount and disposed when this State unmounts (handled by
      // ChangeNotifierProvider's lifecycle).
      return ChangeNotifierProvider<WorkoutSessionProvider>(
        create: (ctx) => WorkoutSessionProvider(ctx.read<ApiService>()),
        child: _StrengthBody(
          isEmbedded: true,
          phaseMetadata: widget.phaseMetadata,
          onPhaseComplete: widget.onPhaseComplete,
        ),
      );
    }
    // Standalone: read the top-level provider. The hosting page has already
    // seeded it via one of the existing entry points (startSession,
    // startEmptySession, resumeActiveSession, startFromList).
    return _StrengthBody(
      isEmbedded: false,
      phaseMetadata: widget.phaseMetadata,
      onPhaseComplete: widget.onPhaseComplete,
    );
  }
}

class _StrengthBody extends StatefulWidget {
  final bool isEmbedded;
  final PhaseMetadata phaseMetadata;
  final void Function(PhaseResult) onPhaseComplete;

  const _StrengthBody({
    required this.isEmbedded,
    required this.phaseMetadata,
    required this.onPhaseComplete,
  });

  @override
  State<_StrengthBody> createState() => _StrengthBodyState();
}

class _StrengthBodyState extends State<_StrengthBody> {
  String? _lastShownError;
  bool _completionFired = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.isEmbedded) {
        _seedEmbeddedSession();
      }
      // Standalone seeding lives in the hosting WorkoutPage's initState;
      // this body just renders whatever the top-level provider already has.
      context.read<SettingsProvider>().fetchSettings();
    });
  }

  Future<void> _seedEmbeddedSession() async {
    final provider = context.read<WorkoutSessionProvider>();
    if (provider.isActive) return;
    final meta = widget.phaseMetadata;
    final focusSlug = meta.focusSlug;
    if (focusSlug == null || focusSlug.isEmpty) {
      // Engine-seeded sessions always carry focus_slug; this is a
      // defensive guard. Standalone mode never reaches this branch.
      return;
    }
    final exercisesPayload = meta.items.asMap().entries.map((entry) {
      final i = entry.key;
      final item = entry.value;
      return <String, dynamic>{
        'exercise_id': item.contentId,
        'sort_order': i,
        'default_sets': item.sets ?? 3,
        'default_reps': item.reps,
      };
    }).toList();
    try {
      await provider.startFromList(
        exercises: exercisesPayload,
        focusSlug: focusSlug,
      );
    } catch (e) {
      // Surface failure via the provider's error channel — _showErrorIfNeeded
      // will snackbar it.
      debugPrint('[StrengthPlayer] embedded seed failed: $e');
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
    if (widget.isEmbedded) _checkEmbeddedCompletion(session);
  }

  void _checkEmbeddedCompletion(WorkoutSessionProvider session) {
    if (_completionFired) return;
    if (session.exercises.isEmpty) return;
    final allLogged = session.exercises.every((ex) {
      final id = (ex['id'] as num).toInt();
      final sets = session.exerciseSets[id] ?? const [];
      return sets.isNotEmpty && sets.every((s) => s.completed);
    });
    if (!allLogged) return;
    _completionFired = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _completeEmbedded(session, wasSkipped: false);
    });
  }

  Future<void> _completeEmbedded(
    WorkoutSessionProvider session, {
    required bool wasSkipped,
  }) async {
    final sessionId = session.sessionId;
    final startedAt = session.startedAt ?? DateTime.now();
    final volume = session.totalVolume;
    final setsCount = session.totalSets;
    final result = await session.completeSession();
    final actualDuration = DateTime.now().difference(startedAt);
    final phaseResult = PhaseResult(
      phase: widget.phaseMetadata.phase,
      contentType: 'strength',
      completedAt: DateTime.now(),
      actualDuration: actualDuration,
      items: widget.phaseMetadata.items,
      pillarSpecific: <String, dynamic>{
        'sets_logged': setsCount,
        'total_volume_kg': volume,
        'completion_response_keys':
            result != null ? List<String>.from(result.keys) : <String>[],
      },
      wasSkipped: wasSkipped,
      sessionId: sessionId,
    );
    widget.onPhaseComplete(phaseResult);
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

  Future<void> _handleStandaloneFinish(
      WorkoutSessionProvider session) async {
    final elapsed = session.elapsedSeconds;
    final volume = session.totalVolume;
    final setsCount = session.totalSets;
    // Snapshot exercises BEFORE completeSession resets provider state — the
    // standalone page needs them for SessionSummaryPage's "Save as Routine"
    // flow and we'd otherwise lose them.
    final exercisesSnapshot = session.exercises
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final result = await session.completeSession();
    if (!mounted || result == null) return;
    final phaseResult = PhaseResult(
      phase: widget.phaseMetadata.phase,
      contentType: 'strength',
      completedAt: DateTime.now(),
      actualDuration: Duration(seconds: elapsed),
      items: widget.phaseMetadata.items,
      pillarSpecific: <String, dynamic>{
        'sets_logged': setsCount,
        'total_volume_kg': volume,
        // Pass through the server summary so the WorkoutPage's
        // SessionSummaryPage can render without an extra round trip.
        'completion_response': result,
        'exercises_snapshot': exercisesSnapshot,
      },
      wasSkipped: false,
      sessionId: session.sessionId,
    );
    widget.onPhaseComplete(phaseResult);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<WorkoutSessionProvider>(
      builder: (context, session, _) {
        _showErrorIfNeeded(session);

        if (session.isLoading && !session.isActive) {
          return const Center(
            child: CircularProgressIndicator(color: AppColors.strength),
          );
        }

        if (session.error != null && !session.isActive) {
          return Center(
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
                ],
              ),
            ),
          );
        }

        if (!session.isActive) {
          return Center(
            child: Text(
              'No active session',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          );
        }

        return SafeArea(
          top: !widget.isEmbedded,
          bottom: false,
          child: Stack(
            children: [
              Column(
                children: [
                  if (!widget.isEmbedded)
                    SessionHeader(
                      elapsedNotifier: session.elapsedNotifier,
                      totalVolume: session.totalVolume,
                      totalSets: session.totalSets,
                      onFinish: () => _handleStandaloneFinish(session),
                      onDiscard: () => _onDiscardStandalone(context, session),
                      onSettings: () => SettingsBottomSheet.show(context),
                      formatTime: session.formatTime,
                    ),
                  Expanded(
                    child: session.exercises.isEmpty
                        ? _buildEmptyState(session)
                        : _buildExerciseList(session),
                  ),
                  if (!widget.isEmbedded) _buildFinishButton(session),
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
        );
      },
    );
  }

  Future<void> _onDiscardStandalone(
      BuildContext context, WorkoutSessionProvider session) async {
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
      if (!mounted) return;
      // Signal discard via PhaseResult so the page handles routing home.
      final phaseResult = PhaseResult(
        phase: widget.phaseMetadata.phase,
        contentType: 'strength',
        completedAt: DateTime.now(),
        actualDuration: Duration.zero,
        items: widget.phaseMetadata.items,
        pillarSpecific: const <String, dynamic>{'discarded': true},
        wasSkipped: true,
        sessionId: null,
      );
      widget.onPhaseComplete(phaseResult);
    }
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
              widget.isEmbedded
                  ? 'Loading exercises...'
                  : 'Add your first exercise',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            if (!widget.isEmbedded) ...[
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
          ],
        ),
      ),
    );
  }

  Widget _buildExerciseList(WorkoutSessionProvider session) {
    final showAddButton = !widget.isEmbedded;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: session.exercises.length + (showAddButton ? 1 : 0),
      itemBuilder: (context, index) {
        if (showAddButton && index == session.exercises.length) {
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
          // Swap is only available against a workout-row-backed session. In
          // engine-seeded (embedded) sessions, workout_id is null so swap is
          // hidden — matches existing standalone behavior.
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
              : () => _confirmAndFinish(context, session),
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

  Future<void> _confirmAndFinish(
      BuildContext context, WorkoutSessionProvider session) async {
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
      await _handleStandaloneFinish(session);
    }
  }

  // Public helper for the standalone WorkoutPage's PopScope to trigger the
  // discard confirm dialog. Kept here (vs the page) so the dialog logic
  // stays adjacent to the player's other lifecycle handlers.
  Future<void> handleStandaloneDiscard(BuildContext ctx) async {
    final session = ctx.read<WorkoutSessionProvider>();
    if (!session.isActive) return;
    await _onDiscardStandalone(ctx, session);
  }
}

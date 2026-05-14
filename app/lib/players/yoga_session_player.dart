import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../models/yoga_models.dart';
import '../providers/yoga_session_provider.dart';
import '../services/api_service.dart';
import '../services/yoga_service.dart';
import '../widgets/yoga/yoga_pose_display.dart';
import '../widgets/yoga/yoga_progress_indicator.dart';
import '../widgets/yoga/yoga_swap_sheet.dart';
import '../widgets/yoga/yoga_timer_display.dart';
import 'embeddable_player.dart';
import 'phase_metadata.dart';
import 'phase_result.dart';

const _phaseColors = {
  'warmup': Color(0xFFF59E0B),
  'peak': Color(0xFFEF4444),
  'cooldown': Color(0xFF3B82F6),
  'savasana': Color(0xFFA78BFA),
};

const _phaseEmojis = {
  'warmup': '\u{1F305}',
  'peak': '\u{1F525}',
  'cooldown': '\u{1F319}',
  'savasana': '\u{1F9D8}',
};

const _phaseLabels = {
  'warmup': 'Warmup',
  'peak': 'Peak',
  'cooldown': 'Cooldown',
  'savasana': 'Savasana',
};

const _enginePhaseToYogaPhase = {
  'warmup': 'warmup',
  'main': 'peak',
  'cooldown': 'cooldown',
};

/// S14-T4: extracted yoga body widget. Renders inside [YogaSessionPage]'s
/// Scaffold shell for standalone use, or directly inside
/// [FivePhaseSessionPage] for cross-pillar phases 2 (warmup) and 4
/// (cooldown).
///
/// Standalone-mode contract: top-level [YogaSessionProvider] is seeded by
/// the launcher before navigation. Player renders the existing pose-flow
/// UI. On completion, navigates to `/yoga/complete`.
///
/// Embedded-mode contract: scoped [YogaSessionProvider]. Seeds in initState
/// by hydrating [phaseMetadata.items] via `/api/yoga/poses-by-ids` and
/// constructing a single-phase [YogaSession]. On completion, calls
/// `logSession` to write the `sessions` row (Decision #6) then emits
/// `onPhaseComplete`.
class YogaSessionPlayer extends StatefulWidget {
  final bool isEmbedded;
  final PhaseMetadata phaseMetadata;
  final void Function(PhaseResult) onPhaseComplete;

  const YogaSessionPlayer({
    super.key,
    required this.isEmbedded,
    required this.phaseMetadata,
    required this.onPhaseComplete,
  });

  @override
  State<YogaSessionPlayer> createState() => _YogaSessionPlayerState();
}

class _YogaSessionPlayerState extends State<YogaSessionPlayer>
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
      return ChangeNotifierProvider<YogaSessionProvider>(
        create: (ctx) => YogaSessionProvider(ctx.read<ApiService>()),
        child: _YogaBody(
          isEmbedded: true,
          phaseMetadata: widget.phaseMetadata,
          onPhaseComplete: widget.onPhaseComplete,
        ),
      );
    }
    return _YogaBody(
      isEmbedded: false,
      phaseMetadata: widget.phaseMetadata,
      onPhaseComplete: widget.onPhaseComplete,
    );
  }
}

class _YogaBody extends StatefulWidget {
  final bool isEmbedded;
  final PhaseMetadata phaseMetadata;
  final void Function(PhaseResult) onPhaseComplete;

  const _YogaBody({
    required this.isEmbedded,
    required this.phaseMetadata,
    required this.onPhaseComplete,
  });

  @override
  State<_YogaBody> createState() => _YogaBodyState();
}

class _YogaBodyState extends State<_YogaBody> {
  bool _completionFired = false;
  bool _seedError = false;
  DateTime? _startedAt;

  @override
  void initState() {
    super.initState();
    if (widget.isEmbedded) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _seedEmbedded());
    }
  }

  Future<void> _seedEmbedded() async {
    if (!mounted) return;
    _startedAt = DateTime.now();
    final api = context.read<ApiService>();
    final provider = context.read<YogaSessionProvider>();
    final meta = widget.phaseMetadata;
    try {
      final ids = <int>{};
      for (final item in meta.items) {
        if (item.contentType != 'yoga') {
          throw StateError(
            'YogaSessionPlayer received non-yoga item: ${item.contentType}',
          );
        }
        final id = item.contentId;
        if (id == null) throw StateError('yoga item missing content_id');
        ids.add(id);
      }
      if (ids.isEmpty) {
        throw StateError('yoga phase has no items');
      }
      final yogaService = YogaService(api);
      final details = await yogaService.fetchPosesByIds(ids.toList());
      if (details.length != ids.length) {
        throw StateError(
          'hydration incomplete: expected ${ids.length}, got ${details.length}',
        );
      }
      final byId = {for (final d in details) d.id: d};
      // Single-phase yoga session — map engine phase to player phase.
      final yogaPhase = _enginePhaseToYogaPhase[meta.phase] ?? 'peak';
      final poses = <YogaPose>[];
      var totalMin = 0;
      for (final item in meta.items) {
        final id = item.contentId!;
        final dur = item.durationMinutes;
        if (dur == null || dur <= 0) {
          throw StateError('yoga item has non-positive duration');
        }
        final d = byId[id];
        if (d == null) throw StateError('missing pose hydration for id $id');
        poses.add(YogaPose(
          id: id,
          name: d.name,
          sanskritName: d.sanskritName,
          description: d.description,
          phase: yogaPhase,
          targetMuscles: d.targetMuscles,
          holdSeconds: dur * 60,
          difficulty: d.difficulty,
        ));
        totalMin += dur;
      }
      final level = meta.userLevels['yoga'] ?? 'beginner';
      final yogaSession = YogaSession(
        type: 'vinyasa',
        level: level,
        duration: totalMin,
        focus: [meta.focusSlug ?? 'unknown'],
        poses: poses,
        totalMinutes: totalMin,
        poseCount: poses.length,
      );
      if (!mounted) return;
      provider.startSession(yogaSession);
    } catch (e) {
      debugPrint('[YogaSessionPlayer] embedded seed failed: $e');
      if (!mounted) return;
      setState(() => _seedError = true);
    }
  }

  void _confirmExitStandalone() {
    final provider = context.read<YogaSessionProvider>();
    final wasRunning = provider.isRunning;
    if (wasRunning) provider.pause();

    showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('End session early?'),
        content: const Text(
          'Your progress will not be saved.',
          style: TextStyle(color: AppColors.secondaryText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error.withValues(alpha: 0.15),
              foregroundColor: AppColors.error,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('End Session'),
          ),
        ],
      ),
    ).then((confirmed) {
      if (!mounted) return;
      if (confirmed == true) {
        provider.reset();
        widget.onPhaseComplete(_buildPhaseResult(
          provider: provider,
          wasSkipped: true,
          sessionId: null,
        ));
      } else if (wasRunning) {
        provider.resume();
      }
    });
  }

  void _showSwapSheet() {
    final provider = context.read<YogaSessionProvider>();
    final wasRunning = provider.isRunning;
    if (wasRunning) provider.pause();

    final api = context.read<ApiService>();
    provider.loadAlternatives(api);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) {
        return Consumer<YogaSessionProvider>(
          builder: (context, session, _) {
            if (session.currentPose == null) return const SizedBox();
            return YogaSwapSheet(
              currentPose: session.currentPose!,
              alternatives: session.alternatives ?? [],
              isLoading: session.isLoadingAlternatives,
              onSelect: (newPose) {
                session.swapPose(newPose);
                Navigator.of(context).pop();
                if (wasRunning) session.resume();
              },
              onClose: () {
                session.clearAlternatives();
                Navigator.of(context).pop();
                if (wasRunning) session.resume();
              },
            );
          },
        );
      },
    ).then((_) {
      if (mounted) {
        final p = context.read<YogaSessionProvider>();
        p.clearAlternatives();
        if (wasRunning && p.isPaused) p.resume();
      }
    });
  }

  String _formatElapsed(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  PhaseResult _buildPhaseResult({
    required YogaSessionProvider provider,
    required bool wasSkipped,
    required int? sessionId,
  }) {
    final start = _startedAt ?? DateTime.now();
    return PhaseResult(
      phase: widget.phaseMetadata.phase,
      contentType: 'yoga',
      completedAt: DateTime.now(),
      actualDuration: DateTime.now().difference(start),
      items: widget.phaseMetadata.items,
      pillarSpecific: <String, dynamic>{
        'poses_completed': provider.posesCompleted,
        'poses_skipped': provider.skippedPoseIds.length,
      },
      wasSkipped: wasSkipped,
      sessionId: sessionId,
    );
  }

  Future<void> _handleEmbeddedCompletion(YogaSessionProvider provider) async {
    if (_completionFired) return;
    _completionFired = true;
    final api = context.read<ApiService>();
    // Decision #6 + AMENDMENT-1 D2: write the yoga `sessions` row via
    // YogaSessionProvider.logSession (T4 widened to return the id) before
    // emitting onPhaseComplete. logSession is idempotent (_sessionLogged
    // flag).
    int? sessionId;
    try {
      sessionId = await provider.logSession(
        api,
        focusSlug: widget.phaseMetadata.focusSlug,
      );
    } catch (e) {
      debugPrint('[YogaSessionPlayer] logSession failed: $e');
    }
    if (!mounted) return;
    widget.onPhaseComplete(_buildPhaseResult(
      provider: provider,
      wasSkipped: false,
      sessionId: sessionId,
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_seedError) {
      return Center(
        child: Text(
          'Could not load yoga phase',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
      );
    }
    return Consumer<YogaSessionProvider>(
      builder: (context, session, _) {
        if (session.isComplete) {
          if (widget.isEmbedded) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _handleEmbeddedCompletion(session);
            });
            return const Center(child: CircularProgressIndicator());
          }
          // Standalone: emit the completion event to the page, which routes
          // to /yoga/complete.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || _completionFired) return;
            _completionFired = true;
            widget.onPhaseComplete(_buildPhaseResult(
              provider: session,
              wasSkipped: false,
              sessionId: null,
            ));
          });
          return const Center(child: CircularProgressIndicator());
        }

        final pose = session.currentPose;
        if (pose == null) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('No session data',
                    style: TextStyle(color: AppColors.secondaryText)),
                const SizedBox(height: 16),
                if (!widget.isEmbedded)
                  TextButton(
                    onPressed: _confirmExitStandalone,
                    child: const Text('Go Back'),
                  ),
              ],
            ),
          );
        }

        final phase = pose.phase;
        final phaseColor = _phaseColors[phase] ?? AppColors.yoga;

        return SafeArea(
          top: !widget.isEmbedded,
          bottom: false,
          child: Column(
            children: [
              // Header row — only render in standalone; orchestrator has its
              // own chrome.
              if (!widget.isEmbedded)
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 4, 16, 0),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back,
                            color: Colors.white),
                        onPressed: _confirmExitStandalone,
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: phaseColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: phaseColor.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          '${_phaseEmojis[phase] ?? ''} ${_phaseLabels[phase] ?? phase}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: phaseColor,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        _formatElapsed(session.elapsedSeconds),
                        style: const TextStyle(
                          fontFamily: 'RobotoMono',
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: AppColors.hintText,
                        ),
                      ),
                    ],
                  ),
                ),

              // Main content area
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      YogaPoseDisplay(pose: pose),
                      const SizedBox(height: 28),
                      YogaTimerDisplay(
                        remainingSeconds: session.remainingSeconds,
                        totalSeconds: session.totalHoldSeconds,
                      ),
                    ],
                  ),
                ),
              ),

              // Action buttons (Swap / Skip)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        label: 'Swap',
                        icon: Icons.swap_horiz,
                        onTap: _showSwapSheet,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _ActionButton(
                        label: 'Skip',
                        icon: Icons.skip_next,
                        onTap: () => session.skipPose(),
                      ),
                    ),
                  ],
                ),
              ),

              // Transport controls — standalone only. Orchestrator's pause
              // action lives in its action bar.
              if (!widget.isEmbedded)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Material(
                        color: Colors.transparent,
                        shape: CircleBorder(
                          side: BorderSide(
                            color: Colors.white.withValues(alpha: 0.3),
                            width: 2,
                          ),
                        ),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _confirmExitStandalone,
                          child: SizedBox(
                            width: 56,
                            height: 56,
                            child: Icon(
                              Icons.stop_rounded,
                              color: Colors.white.withValues(alpha: 0.8),
                              size: 28,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 32),
                      Material(
                        color: AppColors.yoga,
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () {
                            if (session.isPaused) {
                              session.resume();
                            } else {
                              session.pause();
                            }
                          },
                          child: SizedBox(
                            width: 72,
                            height: 72,
                            child: Icon(
                              session.isPaused
                                  ? Icons.play_arrow_rounded
                                  : Icons.pause_rounded,
                              color: Colors.white,
                              size: 40,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Progress indicator
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                child: YogaProgressIndicator(
                  currentIndex: session.currentIndex,
                  totalPoses: session.totalPoses,
                  completedPoses: session.posesCompleted,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: Colors.white.withValues(alpha: 0.7)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.white.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

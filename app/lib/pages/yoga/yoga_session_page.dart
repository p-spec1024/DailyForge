import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/yoga_session_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/yoga/yoga_pose_display.dart';
import '../../widgets/yoga/yoga_progress_indicator.dart';
import '../../widgets/yoga/yoga_swap_sheet.dart';
import '../../widgets/yoga/yoga_timer_display.dart';

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

class YogaSessionPage extends StatelessWidget {
  const YogaSessionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const _YogaSessionView();
  }
}

class _YogaSessionView extends StatefulWidget {
  const _YogaSessionView();

  @override
  State<_YogaSessionView> createState() => _YogaSessionViewState();
}

class _YogaSessionViewState extends State<_YogaSessionView> {
  bool _hasNavigatedToComplete = false;

  void _handleBack() {
    final provider = context.read<YogaSessionProvider>();
    if (provider.isRunning || provider.isPaused) {
      _confirmExit();
    } else {
      _exit();
    }
  }

  Future<void> _confirmExit() async {
    final provider = context.read<YogaSessionProvider>();
    final wasRunning = provider.isRunning;
    if (wasRunning) provider.pause();

    final confirmed = await showDialog<bool>(
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
    );

    if (!mounted) return;
    if (confirmed == true) {
      provider.reset();
      _exit();
    } else if (wasRunning) {
      provider.resume();
    }
  }

  void _exit() {
    if (mounted) context.go('/yoga');
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
      // If dismissed by tapping outside
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

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: Consumer<YogaSessionProvider>(
        builder: (context, session, _) {
          if (session.isComplete) {
            if (!_hasNavigatedToComplete) {
              _hasNavigatedToComplete = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) context.go('/yoga/complete');
              });
            }
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }

          final pose = session.currentPose;
          if (pose == null) {
            return Scaffold(
              body: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('No session data',
                        style: TextStyle(color: AppColors.secondaryText)),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: _exit,
                      child: const Text('Go Back'),
                    ),
                  ],
                ),
              ),
            );
          }

          final phase = pose.phase;
          final phaseColor = _phaseColors[phase] ?? AppColors.yoga;

          return Scaffold(
            body: SafeArea(
              child: Column(
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 4, 16, 0),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back,
                              color: Colors.white),
                          onPressed: _handleBack,
                        ),
                        // Phase badge
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
                        // Elapsed time
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
                          // Pose display
                          YogaPoseDisplay(pose: pose),

                          const SizedBox(height: 28),

                          // Timer
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
                    padding: const EdgeInsets.symmetric(
                        horizontal: 32, vertical: 8),
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

                  // Transport controls (Stop / Play-Pause)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Stop button
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
                            onTap: _confirmExit,
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
                        // Play/Pause button
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
            ),
          );
        },
      ),
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

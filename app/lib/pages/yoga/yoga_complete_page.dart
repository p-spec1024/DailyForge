import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/yoga_models.dart';
import '../../providers/yoga_provider.dart';
import '../../providers/yoga_session_provider.dart';
import '../../services/api_service.dart';

const _typeLabels = {
  'vinyasa': 'Vinyasa',
  'hatha': 'Hatha',
  'yin': 'Yin',
  'restorative': 'Restorative',
  'sun_salutation': 'Sun Salutation',
};

class YogaCompletePage extends StatefulWidget {
  const YogaCompletePage({super.key});

  @override
  State<YogaCompletePage> createState() => _YogaCompletePageState();
}

class _YogaCompletePageState extends State<YogaCompletePage> {
  bool _isLogging = false;

  Future<void> _handleDone() async {
    if (_isLogging) return;
    setState(() => _isLogging = true);

    final session = context.read<YogaSessionProvider>();
    final api = context.read<ApiService>();

    try {
      await session.logSession(api);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save session: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }

    if (!mounted) return;

    // Reload recent sessions so this one appears
    context.read<YogaProvider>().loadRecentSessions();
    // Clear generated session and session provider
    context.read<YogaProvider>().clearSession();
    session.reset();

    context.go('/yoga');
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleDone();
      },
      child: Consumer<YogaSessionProvider>(
        builder: (context, session, _) {
          final poses = session.poses;
          final skipped = session.skippedPoseIds;
          final elapsed = session.elapsedSeconds;
          final original = session.originalSession;
          final durationMin = elapsed ~/ 60;
          final kcal = durationMin * 3;
          final typeName =
              _typeLabels[original?.type ?? ''] ?? original?.type ?? '';

          return Scaffold(
            body: SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 40, 20, 20),
                      child: Column(
                        children: [
                          // Celebration header
                          const Text(
                            '\u{1F9D8}',
                            style: TextStyle(fontSize: 56),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'SESSION COMPLETE',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Great practice!',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.white.withValues(alpha: 0.5),
                            ),
                          ),

                          const SizedBox(height: 28),

                          // Stats grid 2x2
                          Row(
                            children: [
                              _StatCard(
                                value: '${session.posesCompleted}',
                                label: 'poses',
                                isTeal: true,
                              ),
                              const SizedBox(width: 10),
                              _StatCard(
                                value: _formatDuration(elapsed),
                                label: 'duration',
                                isTeal: false,
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              _StatCard(
                                value: '~$kcal',
                                label: 'kcal',
                                isTeal: false,
                              ),
                              const SizedBox(width: 10),
                              _StatCard(
                                value: typeName,
                                label: 'type',
                                isTeal: false,
                                isSmallValue: true,
                              ),
                            ],
                          ),

                          const SizedBox(height: 24),

                          // Pose list header
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'POSES COMPLETED',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.8,
                                color: Colors.white.withValues(alpha: 0.3),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),

                          // Pose list
                          ...List.generate(poses.length, (i) {
                            final pose = poses[i];
                            final wasSkipped = skipped.contains(pose.id);
                            return _CompletedPoseRow(
                              pose: pose,
                              wasSkipped: wasSkipped,
                            );
                          }),
                        ],
                      ),
                    ),
                  ),

                  // Done button
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                    child: SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _isLogging ? null : _handleDone,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.yoga.withValues(alpha: 0.15),
                          foregroundColor: AppColors.yoga,
                          disabledBackgroundColor:
                              AppColors.yoga.withValues(alpha: 0.08),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: AppColors.yoga.withValues(alpha: 0.3),
                            ),
                          ),
                        ),
                        child: _isLogging
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.yoga,
                                ),
                              )
                            : const Text(
                                'Done',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
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

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }
}

class _StatCard extends StatelessWidget {
  final String value;
  final String label;
  final bool isTeal;
  final bool isSmallValue;

  const _StatCard({
    required this.value,
    required this.label,
    required this.isTeal,
    this.isSmallValue = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: isTeal
              ? AppColors.yoga.withValues(alpha: 0.08)
              : Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isTeal
                ? AppColors.yoga.withValues(alpha: 0.2)
                : Colors.white.withValues(alpha: 0.06),
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: isSmallValue ? 16 : 22,
                fontFamily: isSmallValue ? null : 'RobotoMono',
                fontWeight: FontWeight.w600,
                color: isTeal ? AppColors.yoga : Colors.white,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: Colors.white.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompletedPoseRow extends StatelessWidget {
  final YogaPose pose;
  final bool wasSkipped;

  const _CompletedPoseRow({
    required this.pose,
    required this.wasSkipped,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Icon(
            wasSkipped ? Icons.block : Icons.check_circle,
            size: 18,
            color: wasSkipped
                ? Colors.white.withValues(alpha: 0.25)
                : AppColors.yoga,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              pose.name,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: wasSkipped
                    ? Colors.white.withValues(alpha: 0.3)
                    : Colors.white,
                decoration:
                    wasSkipped ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          if (wasSkipped)
            Text(
              'skipped',
              style: TextStyle(
                fontSize: 10,
                fontStyle: FontStyle.italic,
                color: Colors.white.withValues(alpha: 0.25),
              ),
            ),
        ],
      ),
    );
  }
}

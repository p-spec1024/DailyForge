import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/breathwork_technique.dart';

class BreathworkSessionSummary extends StatelessWidget {
  final BreathworkTechnique technique;
  final int durationSeconds;
  final int roundsCompleted;
  final int totalRounds;
  final bool fullyCompleted;
  final VoidCallback onDone;

  const BreathworkSessionSummary({
    super.key,
    required this.technique,
    required this.durationSeconds,
    required this.roundsCompleted,
    required this.totalRounds,
    required this.fullyCompleted,
    required this.onDone,
  });

  String _fmt(int total) {
    final m = total ~/ 60;
    final s = (total % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final accent = fullyCompleted ? AppColors.safetyGreen : AppColors.safetyYellow;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    fullyCompleted ? Icons.check_circle : Icons.stop_circle_outlined,
                    color: accent,
                    size: 56,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    fullyCompleted ? 'Session Complete' : 'Session Ended',
                    style: const TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.cardBackground,
                      border: Border.all(color: AppColors.cardBorder),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Text(
                          technique.name,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _Stat(label: 'Duration', value: _fmt(durationSeconds)),
                            _Stat(
                              label: 'Rounds',
                              value: '$roundsCompleted / $totalRounds',
                            ),
                          ],
                        ),
                        if (!fullyCompleted) ...[
                          const SizedBox(height: 12),
                          const Text(
                            'Stopped early',
                            style: TextStyle(
                              color: AppColors.hintText,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: onDone,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.purple.withValues(alpha: 0.15),
                        foregroundColor: AppColors.purple,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: AppColors.purple.withValues(alpha: 0.4),
                          ),
                        ),
                      ),
                      child: const Text(
                        'Done',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.hintText, fontSize: 12),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontSize: 22,
            fontWeight: FontWeight.w600,
            fontFamily: 'RobotoMono',
          ),
        ),
      ],
    );
  }
}

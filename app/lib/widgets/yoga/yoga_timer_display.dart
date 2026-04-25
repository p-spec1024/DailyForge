import 'package:flutter/material.dart';
import '../../config/theme.dart';

class YogaTimerDisplay extends StatelessWidget {
  final int remainingSeconds;
  final int totalSeconds;

  const YogaTimerDisplay({
    super.key,
    required this.remainingSeconds,
    required this.totalSeconds,
  });

  String _formatTime(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final progress = totalSeconds > 0
        ? ((totalSeconds - remainingSeconds) / totalSeconds).clamp(0.0, 1.0)
        : 0.0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Large countdown
        Text(
          _formatTime(remainingSeconds),
          style: const TextStyle(
            fontSize: 48,
            fontWeight: FontWeight.w700,
            fontFamily: 'RobotoMono',
            color: Colors.white,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 12),

        // Progress bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: Colors.white.withValues(alpha: 0.1),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.yoga),
            ),
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import '../../config/theme.dart';

class TimerControls extends StatelessWidget {
  final bool isRunning;
  final VoidCallback onPauseResume;
  final VoidCallback onStop;

  const TimerControls({
    super.key,
    required this.isRunning,
    required this.onPauseResume,
    required this.onStop,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: AppColors.purple.withValues(alpha: 0.12),
          shape: CircleBorder(
            side: BorderSide(color: AppColors.purple.withValues(alpha: 0.3)),
          ),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onPauseResume,
            child: SizedBox(
              width: 64,
              height: 64,
              child: Icon(
                isRunning ? Icons.pause : Icons.play_arrow,
                color: AppColors.purple,
                size: 28,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextButton.icon(
          onPressed: onStop,
          icon: const Icon(Icons.stop, size: 14),
          label: const Text('Stop'),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.hintText,
            textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }
}

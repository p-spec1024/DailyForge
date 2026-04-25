import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/yoga_models.dart';

class YogaPoseDisplay extends StatelessWidget {
  final YogaPose pose;

  const YogaPoseDisplay({
    super.key,
    required this.pose,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: Column(
        key: ValueKey(pose.id),
        mainAxisSize: MainAxisSize.min,
        children: [
          // Pose name
          Text(
            pose.name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              height: 1.2,
            ),
          ),

          // Sanskrit name
          if (pose.sanskritName != null && pose.sanskritName!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              pose.sanskritName!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontStyle: FontStyle.italic,
                color: Colors.white.withValues(alpha: 0.4),
              ),
            ),
          ],

          const SizedBox(height: 24),

          // Pose placeholder image
          Container(
            width: 140,
            height: 140,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              '\u{1F9D8}',
              style: const TextStyle(fontSize: 56),
            ),
          ),

          const SizedBox(height: 20),

          // Target muscles
          if (pose.targetMuscles != null && pose.targetMuscles!.isNotEmpty)
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 6,
              runSpacing: 4,
              children: pose.targetMuscles!.split(',').map((muscle) {
                return Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.yoga.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.yoga.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    muscle.trim(),
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.yoga.withValues(alpha: 0.8),
                    ),
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}

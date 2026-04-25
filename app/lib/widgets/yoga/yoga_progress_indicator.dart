import 'package:flutter/material.dart';
import '../../config/theme.dart';

class YogaProgressIndicator extends StatelessWidget {
  final int currentIndex;
  final int totalPoses;
  final int completedPoses;

  const YogaProgressIndicator({
    super.key,
    required this.currentIndex,
    required this.totalPoses,
    required this.completedPoses,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Progress dots — show a scrollable row if many poses
        SizedBox(
          height: 12,
          child: totalPoses <= 20
              ? Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(totalPoses, _buildDot),
                )
              : ListView.builder(
                  scrollDirection: Axis.horizontal,
                  shrinkWrap: true,
                  itemCount: totalPoses,
                  itemBuilder: (_, i) => _buildDot(i),
                ),
        ),
        const SizedBox(height: 6),
        Text(
          '${currentIndex + 1} of $totalPoses poses',
          style: TextStyle(
            fontSize: 13,
            color: Colors.white.withValues(alpha: 0.5),
          ),
        ),
      ],
    );
  }

  Widget _buildDot(int index) {
    final isCompleted = index < currentIndex;
    final isCurrent = index == currentIndex;

    Color color;
    if (isCompleted) {
      color = AppColors.yoga;
    } else if (isCurrent) {
      color = AppColors.yoga;
    } else {
      color = Colors.white.withValues(alpha: 0.15);
    }

    return Container(
      width: isCurrent ? 10 : 8,
      height: isCurrent ? 10 : 8,
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isCompleted || isCurrent ? color : Colors.transparent,
        border: Border.all(
          color: color,
          width: isCurrent ? 2 : 1,
        ),
      ),
    );
  }
}

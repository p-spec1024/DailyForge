import 'package:flutter/material.dart';
import '../../config/theme.dart';

class StreakCounter extends StatelessWidget {
  final int currentStreak;
  final int bestStreak;

  const StreakCounter({
    super.key,
    required this.currentStreak,
    required this.bestStreak,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStreakItem('\u{1F525}', 'Current', currentStreak),
          Container(
            width: 1,
            height: 32,
            color: AppColors.cardBorder,
          ),
          _buildStreakItem('\u2728', 'Best', bestStreak),
        ],
      ),
    );
  }

  Widget _buildStreakItem(String emoji, String label, int value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(emoji, style: const TextStyle(fontSize: 24)),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$value days',
              style: const TextStyle(
                color: AppColors.primaryText,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              '$label streak',
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

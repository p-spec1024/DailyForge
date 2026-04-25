import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../config/theme.dart';
import 'exercise_detail_sheet.dart';

class ExerciseBrowseCard extends StatelessWidget {
  final Map<String, dynamic> exercise;

  const ExerciseBrowseCard({super.key, required this.exercise});

  @override
  Widget build(BuildContext context) {
    final name = exercise['name'] as String? ?? '';
    final muscle = (exercise['target_muscles']?.toString() ?? '').split(',').first;
    final difficulty = exercise['difficulty'] as String? ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: InkWell(
        onTap: () {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (_) => ExerciseDetailSheet(exercise: exercise),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.cardBackground,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (muscle.isNotEmpty)
                          _TagChip(
                            label: capitalize(muscle),
                            color: AppColors.strength,
                          ),
                        if (muscle.isNotEmpty && difficulty.isNotEmpty)
                          const SizedBox(width: 8),
                        if (difficulty.isNotEmpty)
                          _TagChip(
                            label: capitalize(difficulty),
                            color: AppColors.difficultyColor(difficulty),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(
                LucideIcons.chevronRight,
                size: 20,
                color: AppColors.secondaryText,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  final String label;
  final Color color;

  const _TagChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

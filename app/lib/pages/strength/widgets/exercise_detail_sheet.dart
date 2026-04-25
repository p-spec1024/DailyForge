import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../../config/theme.dart';

class ExerciseDetailSheet extends StatelessWidget {
  final Map<String, dynamic> exercise;

  const ExerciseDetailSheet({super.key, required this.exercise});

  @override
  Widget build(BuildContext context) {
    final name = exercise['name'] as String? ?? '';
    final difficulty = exercise['difficulty'] as String? ?? '';
    final muscle = exercise['target_muscles'] as String? ?? '';
    final equipment = exercise['equipment'] as String? ?? '';
    final description = exercise['description'] as String? ?? '';

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.cardBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(24),
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                        ),
                        if (difficulty.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.difficultyColor(difficulty).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              difficulty.toUpperCase(),
                              style: TextStyle(
                                color: AppColors.difficultyColor(difficulty),
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (muscle.isNotEmpty)
                      _buildDetailRow(context, LucideIcons.dumbbell, 'Muscles', muscle),
                    if (muscle.isNotEmpty) const SizedBox(height: 12),
                    if (equipment.isNotEmpty)
                      _buildDetailRow(context, LucideIcons.box, 'Equipment', equipment),
                    if (equipment.isNotEmpty) const SizedBox(height: 24),
                    if (description.isNotEmpty) ...[
                      Text(
                        'Instructions',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        description,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: AppColors.secondaryText,
                              height: 1.5,
                            ),
                      ),
                    ],
                    const SizedBox(height: 40),
                    ElevatedButton(
                      onPressed: null, // Placeholder — wired in active session ticket
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.strength,
                        disabledBackgroundColor: AppColors.strength.withValues(alpha: 0.6),
                        disabledForegroundColor: Colors.white70,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Do This Exercise'),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(BuildContext context, IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.secondaryText),
        const SizedBox(width: 12),
        Text(
          '$label: ',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        Expanded(
          child: Text(
            capitalize(value),
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
          ),
        ),
      ],
    );
  }
}

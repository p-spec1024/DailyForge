import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/breathwork_technique.dart';
import '../glass_card.dart';

class TechniqueCard extends StatelessWidget {
  final BreathworkTechnique technique;
  final VoidCallback? onTap;

  const TechniqueCard({super.key, required this.technique, this.onTap});

  int _difficultyDots(String d) {
    switch (d.toLowerCase()) {
      case 'intermediate':
        return 2;
      case 'advanced':
        return 3;
      default:
        return 1;
    }
  }

  @override
  Widget build(BuildContext context) {
    final safetyColor = AppColors.safetyColor(technique.safetyLevel);
    final difficultyColor = AppColors.difficultyColor(technique.difficulty);
    final filled = _difficultyDots(technique.difficulty);

    return GlassCard(
      onTap: onTap,
      borderColor: safetyColor,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: safetyColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  technique.name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primaryText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text.rich(
            TextSpan(
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.secondaryText,
              ),
              children: [
                if (technique.sanskritName != null &&
                    technique.sanskritName!.isNotEmpty) ...[
                  TextSpan(
                    text: technique.sanskritName!,
                    style: const TextStyle(fontStyle: FontStyle.italic),
                  ),
                  const TextSpan(text: ' · '),
                ],
                TextSpan(text: technique.tradition),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              ...List.generate(3, (i) {
                final isFilled = i < filled;
                return Padding(
                  padding: const EdgeInsets.only(right: 3),
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isFilled
                          ? difficultyColor
                          : AppColors.secondaryText.withValues(alpha: 0.25),
                    ),
                  ),
                );
              }),
              const SizedBox(width: 6),
              Text(
                capitalize(technique.difficulty),
                style: TextStyle(fontSize: 12, color: difficultyColor),
              ),
              if (technique.estimatedDuration != null) ...[
                const SizedBox(width: 8),
                Text(
                  '·  ${(technique.estimatedDuration! / 60).ceil()} min',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.secondaryText,
                  ),
                ),
              ],
            ],
          ),
          if (technique.purposes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: technique.purposes.take(3).map((p) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.purple.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    capitalize(p),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.purple,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

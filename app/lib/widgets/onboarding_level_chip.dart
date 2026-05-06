import 'package:flutter/material.dart';
import '../config/theme.dart';
import 'glass_card.dart';

/// Selectable level option used by the three onboarding-stub screens.
/// Wraps GlassCard with a left-edge accent stripe + check icon when
/// [selected] is true. Accent color comes from the caller so each
/// pillar can match its brand color (strength orange / yoga teal /
/// breathwork blue).
class OnboardingLevelChip extends StatelessWidget {
  final String label;
  final String description;
  final bool selected;
  final VoidCallback onTap;
  final Color accentColor;

  const OnboardingLevelChip({
    super.key,
    required this.label,
    required this.description,
    required this.selected,
    required this.onTap,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      borderColor: selected ? accentColor : null,
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.secondaryText,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Icon(
            selected ? Icons.check_circle : Icons.radio_button_unchecked,
            color: selected ? accentColor : AppColors.secondaryText,
            size: 24,
          ),
        ],
      ),
    );
  }
}

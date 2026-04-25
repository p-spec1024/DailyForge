import 'package:flutter/material.dart';
import '../../config/theme.dart';

const _focusAreas = [
  'hips',
  'hamstrings',
  'back',
  'shoulders',
  'core',
  'neck',
  'chest',
  'balance',
  'twists',
  'strength',
];

const _labels = {
  'hips': 'Hips',
  'hamstrings': 'Hamstrings',
  'back': 'Back',
  'shoulders': 'Shoulders',
  'core': 'Core',
  'neck': 'Neck',
  'chest': 'Chest',
  'balance': 'Balance',
  'twists': 'Twists',
  'strength': 'Strength',
};

class FocusChips extends StatelessWidget {
  final List<String> selected;
  final ValueChanged<String> onToggle;

  const FocusChips({
    super.key,
    required this.selected,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              Text(
                'FOCUS ',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.35),
                  letterSpacing: 0.6,
                ),
              ),
              Text(
                'optional',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w400,
                  color: Colors.white.withValues(alpha: 0.2),
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
        ),
        Wrap(
          spacing: 5,
          runSpacing: 5,
          children: _focusAreas.map((area) {
            final active = selected.contains(area);
            return GestureDetector(
              onTap: () => onToggle(area),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: active
                      ? AppColors.yoga.withValues(alpha: 0.08)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: active
                        ? AppColors.yoga.withValues(alpha: 0.4)
                        : Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                child: Text(
                  _labels[area] ?? capitalize(area),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: active ? FontWeight.w500 : FontWeight.w400,
                    color: active
                        ? const Color(0xFF5EEAD4)
                        : Colors.white.withValues(alpha: 0.5),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

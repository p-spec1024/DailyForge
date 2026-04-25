import 'package:flutter/material.dart';
import '../../config/theme.dart';

class UnitToggle extends StatelessWidget {
  final String currentUnit; // 'metric' or 'imperial'
  final ValueChanged<String> onChanged;
  final bool isLoading;

  const UnitToggle({
    super.key,
    required this.currentUnit,
    required this.onChanged,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildOption('metric', 'Metric', 'kg, cm'),
          const SizedBox(width: 4),
          _buildOption('imperial', 'Imperial', 'lb, ft'),
        ],
      ),
    );
  }

  Widget _buildOption(String value, String label, String subtitle) {
    final isSelected = currentUnit == value;

    return GestureDetector(
      onTap: isLoading ? null : () => onChanged(value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.gold : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.secondaryText,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.7)
                    : AppColors.hintText,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

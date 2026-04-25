import 'package:flutter/material.dart';
import '../../config/theme.dart';

class CategoryFilterChips extends StatelessWidget {
  final List<String> categories;
  final String active;
  final ValueChanged<String> onSelect;

  const CategoryFilterChips({
    super.key,
    required this.categories,
    required this.active,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final cat = categories[i];
          final isActive = cat == active;
          return GestureDetector(
            onTap: () => onSelect(cat),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isActive
                    ? AppColors.purple.withValues(alpha: 0.15)
                    : Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isActive
                      ? AppColors.purple.withValues(alpha: 0.5)
                      : Colors.white.withValues(alpha: 0.08),
                  width: isActive ? 1 : 0.5,
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                capitalize(cat),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isActive ? AppColors.purple : AppColors.secondaryText,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

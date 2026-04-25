import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';

class PrBadge extends StatelessWidget {
  final String type; // 'weight', 'volume', 'reps'

  const PrBadge({super.key, required this.type});

  String get _label {
    switch (type) {
      case 'weight':
        return 'Weight PR';
      case 'volume':
        return 'Volume PR';
      case 'reps':
        return 'Reps PR';
      default:
        return 'PR';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.gold, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.trophy, size: 11, color: AppColors.gold),
          const SizedBox(width: 4),
          Text(
            _label,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.gold,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

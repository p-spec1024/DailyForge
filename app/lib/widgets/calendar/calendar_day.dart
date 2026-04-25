import 'package:flutter/material.dart';
import '../../config/theme.dart';

class CalendarDay extends StatelessWidget {
  final int day;
  final bool isCurrentMonth;
  final bool isToday;
  final bool hasStreak;
  final List<String> sessionTypes;
  final VoidCallback? onTap;

  const CalendarDay({
    super.key,
    required this.day,
    required this.isCurrentMonth,
    this.isToday = false,
    this.hasStreak = false,
    this.sessionTypes = const [],
    this.onTap,
  });

  static const _dotColors = {
    'strength': Color(0xFFF59E0B),
    'yoga': Color(0xFF14B8A6),
    'breathwork': Color(0xFF3B82F6),
  };

  @override
  Widget build(BuildContext context) {
    final dots = <Color>[];
    for (final type in sessionTypes) {
      if (type == '5phase') {
        dots
          ..clear()
          ..addAll([
            const Color(0xFFF59E0B),
            const Color(0xFF14B8A6),
            const Color(0xFF3B82F6),
          ]);
        break;
      } else if (_dotColors.containsKey(type)) {
        final color = _dotColors[type]!;
        if (!dots.contains(color)) dots.add(color);
      }
    }
    final displayDots = dots.take(3).toList();

    return GestureDetector(
      onTap: sessionTypes.isNotEmpty ? onTap : null,
      child: Container(
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: hasStreak
              ? AppColors.gold.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: isToday
              ? Border.all(color: AppColors.gold, width: 2)
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              day.toString(),
              style: TextStyle(
                color: isCurrentMonth
                    ? AppColors.primaryText
                    : AppColors.secondaryText.withValues(alpha: 0.4),
                fontSize: 14,
                fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            const SizedBox(height: 4),
            if (displayDots.isNotEmpty)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: displayDots
                    .map((color) => Container(
                          width: 6,
                          height: 6,
                          margin: const EdgeInsets.symmetric(horizontal: 1),
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ))
                    .toList(),
              )
            else
              const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }
}

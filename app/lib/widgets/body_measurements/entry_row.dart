import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../utils/unit_conversion.dart';

/// A single measurement row used in List View and Full Month Page.
class EntryRow extends StatelessWidget {
  final BodyMeasurement entry;
  final BodyMeasurement? previous;
  final String unitSystem;
  final bool showDayOfWeek;
  final bool showChevron;
  final VoidCallback? onTap;

  const EntryRow({
    super.key,
    required this.entry,
    required this.previous,
    required this.unitSystem,
    this.showDayOfWeek = false,
    this.showChevron = false,
    this.onTap,
  });

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  static const _weekdays = [
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
  ];

  String _formatDate(DateTime d) {
    final base = '${_months[d.month - 1]} ${d.day}';
    if (!showDayOfWeek) return base;
    return '$base ${_weekdays[d.weekday - 1]}';
  }

  String _buildSummary() {
    final parts = <String>[];
    if (entry.weightKg != null) parts.add('Weight');
    if (entry.bodyFatPercent != null) parts.add('Body fat');

    int circCount = 0;
    if (entry.waistCm != null) circCount++;
    if (entry.hipsCm != null) circCount++;
    if (entry.chestCm != null) circCount++;
    if (entry.bicepLeftCm != null) circCount++;
    if (entry.bicepRightCm != null) circCount++;

    if (circCount > 0) {
      parts.add(circCount == 1 ? '1 circ' : '$circCount circ');
    }
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final weight = entry.weightKg;
    double? delta;
    if (weight != null && previous?.weightKg != null) {
      delta = weight - previous!.weightKg!;
    }

    Widget? deltaWidget;
    if (delta != null && delta.abs() > 0.01) {
      final displayDelta = kgToDisplay(delta.abs(), unitSystem);
      final color = delta < 0 ? AppColors.positive : AppColors.error;
      final arrow = delta < 0 ? '↓' : '↑';
      deltaWidget = Text(
        '$arrow${displayDelta.toStringAsFixed(1)}',
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      );
    } else if (weight != null) {
      deltaWidget = Text(
        '—',
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.3),
          fontSize: 11,
        ),
      );
    }

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: Colors.white.withValues(alpha: 0.04),
              width: 1,
            ),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _formatDate(entry.measuredAt),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _buildSummary(),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.35),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  weight != null
                      ? '${kgToDisplay(weight, unitSystem).toStringAsFixed(1)} ${weightUnit(unitSystem)}'
                      : '—',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                  ),
                ),
                if (deltaWidget != null) ...[
                  const SizedBox(height: 3),
                  deltaWidget,
                ],
              ],
            ),
            if (showChevron) ...[
              const SizedBox(width: 8),
              Icon(
                LucideIcons.chevronRight,
                size: 16,
                color: Colors.white.withValues(alpha: 0.25),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

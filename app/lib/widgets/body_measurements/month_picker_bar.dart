import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../providers/body_measurements_provider.dart';
import '../../utils/unit_conversion.dart';

/// ← [ April 2026 ▼ ] →  with "N entries · ±Y kg this month" underneath.
class MonthPickerBar extends StatelessWidget {
  final BodyMeasurementsProvider provider;
  final String unitSystem;
  final VoidCallback onTapMonth;

  const MonthPickerBar({
    super.key,
    required this.provider,
    required this.unitSystem,
    required this.onTapMonth,
  });

  static const _months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  Widget build(BuildContext context) {
    final sel = provider.selectedMonth;
    final stats = provider.monthStats;
    final canPrev = provider.canGoPreviousMonth();
    final canNext = provider.canGoNextMonth();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _ArrowButton(
                icon: LucideIcons.chevronLeft,
                enabled: canPrev,
                onTap: provider.goToPreviousMonth,
              ),
              const Spacer(),
              GestureDetector(
                onTap: onTapMonth,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${_months[sel.month - 1]} ${sel.year}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        LucideIcons.chevronDown,
                        size: 12,
                        color: Colors.white.withValues(alpha: 0.4),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              _ArrowButton(
                icon: LucideIcons.chevronRight,
                enabled: canNext,
                onTap: provider.goToNextMonth,
              ),
            ],
          ),
          if (stats.entryCount > 0) ...[
            const SizedBox(height: 8),
            _buildStatsRow(stats),
          ],
        ],
      ),
    );
  }

  Widget _buildStatsRow(MonthStats stats) {
    final bullets = <Widget>[];
    bullets.add(Text(
      '${stats.entryCount} ${stats.entryCount == 1 ? 'entry' : 'entries'}',
      style: TextStyle(
        color: Colors.white.withValues(alpha: 0.4),
        fontSize: 10,
      ),
    ));

    if (stats.change != null && stats.change!.abs() > 0.01) {
      final display = kgToDisplay(stats.change!.abs(), unitSystem);
      final down = stats.change! < 0;
      final sign = down ? '-' : '+';
      final color = down ? AppColors.positive : AppColors.error;
      bullets.add(Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Text(
          '•',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.2),
            fontSize: 10,
          ),
        ),
      ));
      bullets.add(Text(
        '$sign${display.toStringAsFixed(1)} ${weightUnit(unitSystem)} this month',
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w500,
        ),
      ));
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: bullets,
    );
  }
}

class _ArrowButton extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  const _ArrowButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: enabled ? 0.08 : 0.03),
          borderRadius: BorderRadius.circular(7),
        ),
        child: Icon(
          icon,
          size: 16,
          color: Colors.white.withValues(alpha: enabled ? 0.7 : 0.2),
        ),
      ),
    );
  }
}

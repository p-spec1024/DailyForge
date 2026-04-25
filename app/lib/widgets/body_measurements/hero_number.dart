import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../utils/unit_conversion.dart';

/// Big current-weight display with since-start delta.
/// Label ("Current weight"), value ("75.2"), unit ("kg"), then
/// "↓ 4.8 kg since <earliest date>".
class HeroNumber extends StatelessWidget {
  final List<BodyMeasurement> measurements;
  final String unitSystem;

  const HeroNumber({
    super.key,
    required this.measurements,
    required this.unitSystem,
  });

  @override
  Widget build(BuildContext context) {
    // Find latest weight and earliest weight.
    BodyMeasurement? latest;
    BodyMeasurement? earliest;
    for (final m in measurements.reversed) {
      if (m.weightKg != null) {
        latest = m;
        break;
      }
    }
    for (final m in measurements) {
      if (m.weightKg != null) {
        earliest = m;
        break;
      }
    }

    if (latest == null) {
      return const _EmptyHero();
    }

    final displayWeight = kgToDisplay(latest.weightKg!, unitSystem);
    final unit = weightUnit(unitSystem);

    Widget? delta;
    if (earliest != null && earliest.id != latest.id) {
      final diff = latest.weightKg! - earliest.weightKg!;
      if (diff.abs() > 0.01) {
        final diffDisplay = kgToDisplay(diff.abs(), unitSystem);
        final down = diff < 0;
        final color = down ? AppColors.positive : AppColors.error;
        final arrow = down ? '↓' : '↑';
        final sinceStr = _formatShortDate(earliest.measuredAt);

        delta = Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$arrow ${diffDisplay.toStringAsFixed(1)} $unit',
                style: TextStyle(
                  color: color,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                'since $sinceStr',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.3),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        );
      }
    }

    return Column(
      children: [
        Text(
          'Current weight',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.5),
            fontSize: 12,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              displayWeight.toStringAsFixed(1),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 48,
                fontWeight: FontWeight.w500,
                letterSpacing: -2,
                height: 1,
              ),
            ),
            const SizedBox(width: 6),
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                unit,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.5),
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        if (delta != null) delta,
      ],
    );
  }

  static String _formatShortDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[d.month - 1]} ${d.day}';
  }
}

class _EmptyHero extends StatelessWidget {
  const _EmptyHero();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          'Current weight',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.5),
            fontSize: 12,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '—',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.3),
            fontSize: 48,
            fontWeight: FontWeight.w500,
            height: 1,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'No measurements yet',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.4),
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}

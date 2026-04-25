import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../utils/unit_conversion.dart';

/// Compact 3-up mini cards (Waist / Chest / Hips) shown under the chart.
class CircumferencesRow extends StatelessWidget {
  final List<BodyMeasurement> measurements;
  final String unitSystem;
  final VoidCallback? onSeeAll;

  const CircumferencesRow({
    super.key,
    required this.measurements,
    required this.unitSystem,
    this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    if (measurements.isEmpty) return const SizedBox.shrink();

    final waist = _latestAndPrevious(measurements, (m) => m.waistCm);
    final chest = _latestAndPrevious(measurements, (m) => m.chestCm);
    final hips = _latestAndPrevious(measurements, (m) => m.hipsCm);

    final hasAny =
        waist.latest != null || chest.latest != null || hips.latest != null;
    if (!hasAny) return const SizedBox.shrink();

    final waistDelta = (waist.latest != null && waist.previous != null)
        ? waist.latest! - waist.previous!
        : null;
    final chestDelta = (chest.latest != null && chest.previous != null)
        ? chest.latest! - chest.previous!
        : null;
    final hipsDelta = (hips.latest != null && hips.previous != null)
        ? hips.latest! - hips.previous!
        : null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'CIRCUMFERENCES',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.5),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.5,
                ),
              ),
              if (onSeeAll != null)
                GestureDetector(
                  onTap: onSeeAll,
                  child: const Text(
                    'See all →',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _MiniCard(
                  label: 'Waist',
                  valueCm: waist.latest,
                  delta: waistDelta,
                  unitSystem: unitSystem,
                  smallerIsBetter: true,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _MiniCard(
                  label: 'Chest',
                  valueCm: chest.latest,
                  delta: chestDelta,
                  unitSystem: unitSystem,
                  smallerIsBetter: false,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _MiniCard(
                  label: 'Hips',
                  valueCm: hips.latest,
                  delta: hipsDelta,
                  unitSystem: unitSystem,
                  smallerIsBetter: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Walk [measurements] (sorted ascending) newest-first and return the
/// first two non-null accessor values we encounter. The first becomes
/// [latest], the second [previous]. Time gap doesn't matter — two
/// readings taken minutes apart still yield a delta.
({double? latest, double? previous}) _latestAndPrevious(
  List<BodyMeasurement> measurements,
  double? Function(BodyMeasurement) accessor,
) {
  double? latest;
  double? previous;
  for (final m in measurements.reversed) {
    final v = accessor(m);
    if (v == null) continue;
    if (latest == null) {
      latest = v;
    } else {
      previous = v;
      break;
    }
  }
  return (latest: latest, previous: previous);
}

class _MiniCard extends StatelessWidget {
  final String label;
  final double? valueCm;
  final double? delta;
  final String unitSystem;
  final bool smallerIsBetter;

  const _MiniCard({
    required this.label,
    required this.valueCm,
    required this.delta,
    required this.unitSystem,
    required this.smallerIsBetter,
  });

  @override
  Widget build(BuildContext context) {
    Widget deltaWidget;
    if (delta != null && delta!.abs() > 0.01) {
      final isPositive = delta! > 0;
      final isGood = smallerIsBetter ? !isPositive : isPositive;
      final color = isGood ? AppColors.positive : AppColors.error;
      final arrow = isPositive ? '↑' : '↓';
      final displayDelta =
          unitSystem == 'imperial' ? cmToInches(delta!.abs()) : delta!.abs();
      deltaWidget = Text(
        '$arrow${displayDelta.toStringAsFixed(1)}',
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w500,
        ),
      );
    } else {
      deltaWidget = Text(
        '—',
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.25),
          fontSize: 10,
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.4),
              fontSize: 10,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            valueCm != null
                ? cmToDisplay(valueCm!, unitSystem).toStringAsFixed(1)
                : '—',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 2),
          SizedBox(height: 14, child: deltaWidget),
        ],
      ),
    );
  }
}

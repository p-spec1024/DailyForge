import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../utils/unit_conversion.dart';

/// Compact mini-stats row for the Chart View: BMI / Body fat / 7d avg.
/// Values are centered, with thin horizontal dividers above/below.
class MiniStatsRow extends StatelessWidget {
  final BodyMeasurementStats? stats;
  final String unitSystem;

  const MiniStatsRow({
    super.key,
    required this.stats,
    required this.unitSystem,
  });

  @override
  Widget build(BuildContext context) {
    final latest = stats?.latest;
    final bmi = stats?.bmi;
    final bodyFat = latest?.bodyFatPercent;
    final avg = stats?.rollingAvg7d;

    final bmiColor =
        bmi != null ? getBMICategoryColor(bmi) : Colors.white;

    final divider = Colors.white.withValues(alpha: 0.06);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: divider, width: 1),
          bottom: BorderSide(color: divider, width: 1),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildCell(
              value: bmi != null ? bmi.toStringAsFixed(1) : '—',
              label: 'BMI',
              color: bmi != null ? bmiColor : Colors.white,
            ),
          ),
          Expanded(
            child: _buildCell(
              value: bodyFat != null
                  ? '${bodyFat.toStringAsFixed(1)}%'
                  : '—',
              label: 'Body fat',
            ),
          ),
          Expanded(
            child: _buildCell(
              value: avg != null
                  ? kgToDisplay(avg, unitSystem).toStringAsFixed(1)
                  : '—',
              label: '7d avg',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCell({
    required String value,
    required String label,
    Color color = Colors.white,
  }) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.4),
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}

/// Compact 3-up summary cards (Weight / BMI / Body fat) for the List View.
class SummaryCards extends StatelessWidget {
  final BodyMeasurementStats? stats;
  final List<BodyMeasurement> measurements;
  final String unitSystem;

  const SummaryCards({
    super.key,
    required this.stats,
    required this.measurements,
    required this.unitSystem,
  });

  @override
  Widget build(BuildContext context) {
    final latest = stats?.latest;

    final weightDeltaRaw = stats?.weightDeltaTotal;
    final bfDelta = weeklyDelta(measurements, (m) => m.bodyFatPercent);

    return Row(
      children: [
        Expanded(
          child: _Card(
            label: 'Weight',
            value: latest?.weightKg != null
                ? kgToDisplay(latest!.weightKg!, unitSystem)
                    .toStringAsFixed(1)
                : '—',
            unit: latest?.weightKg != null ? weightUnit(unitSystem) : null,
            delta: weightDeltaRaw != null
                ? kgToDisplay(weightDeltaRaw.abs(), unitSystem) *
                    (weightDeltaRaw.isNegative ? -1 : 1)
                : null,
            deltaSuffix: weightUnit(unitSystem),
            weightMode: true,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _Card(
            label: 'BMI',
            value: stats?.bmi != null
                ? stats!.bmi!.toStringAsFixed(1)
                : '—',
            categoryText: stats?.bmi != null
                ? getBMICategory(stats!.bmi!)
                : null,
            categoryColor: stats?.bmi != null
                ? getBMICategoryColor(stats!.bmi!)
                : null,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _Card(
            label: 'Body fat',
            value: latest?.bodyFatPercent != null
                ? latest!.bodyFatPercent!.toStringAsFixed(1)
                : '—',
            unit: latest?.bodyFatPercent != null ? '%' : null,
            delta: bfDelta,
            deltaSuffix: '%',
            smallerIsBetter: true,
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  final String label;
  final String value;
  final String? unit;
  final double? delta;
  final String? deltaSuffix;
  final bool smallerIsBetter;
  final bool weightMode;
  final String? categoryText;
  final Color? categoryColor;

  const _Card({
    required this.label,
    required this.value,
    this.unit,
    this.delta,
    this.deltaSuffix,
    this.smallerIsBetter = false,
    this.weightMode = false,
    this.categoryText,
    this.categoryColor,
  });

  @override
  Widget build(BuildContext context) {
    Widget? sub;
    if (categoryText != null) {
      sub = Text(
        categoryText!,
        style: TextStyle(
          color: categoryColor ?? Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w500,
        ),
      );
    } else if (delta != null && delta!.abs() > 0.01) {
      final isPositive = delta! > 0;
      final isGood = weightMode
          ? !isPositive
          : (smallerIsBetter ? !isPositive : isPositive);
      final color = isGood ? AppColors.positive : AppColors.error;
      final arrow = isPositive ? '↑' : '↓';
      sub = Text(
        '$arrow ${delta!.abs().toStringAsFixed(1)}${deltaSuffix != null ? ' ${deltaSuffix!}' : ''}',
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w500,
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                  height: 1,
                ),
              ),
              if (unit != null) ...[
                const SizedBox(width: 3),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    unit!,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.4),
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
          if (sub != null) sub,
        ],
      ),
    );
  }
}

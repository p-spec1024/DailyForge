import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../utils/unit_conversion.dart';

/// Stateless interactive line chart for body measurements. The parent
/// controls selected metric and time range, so state lives in the
/// provider and is shared across view toggles.
class MeasurementsChart extends StatelessWidget {
  final List<BodyMeasurement> measurements;
  final String unitSystem;
  final String metric;
  final String range;

  const MeasurementsChart({
    super.key,
    required this.measurements,
    required this.unitSystem,
    required this.metric,
    required this.range,
  });

  static const _amber = AppColors.gold;

  double? _accessKg(BodyMeasurement m) {
    switch (metric) {
      case 'weight':
        return m.weightKg;
      case 'body_fat':
        return m.bodyFatPercent;
      case 'waist':
        return m.waistCm;
      case 'hips':
        return m.hipsCm;
      case 'chest':
        return m.chestCm;
      case 'bicep_left':
        return m.bicepLeftCm;
      case 'bicep_right':
        return m.bicepRightCm;
    }
    return null;
  }

  double _toDisplay(double raw) {
    if (metric == 'body_fat') return raw;
    if (metric == 'weight') return kgToDisplay(raw, unitSystem);
    return cmToDisplay(raw, unitSystem);
  }

  String get _unit {
    if (metric == 'body_fat') return '%';
    if (metric == 'weight') return weightUnit(unitSystem);
    return lengthUnit(unitSystem);
  }

  List<BodyMeasurement> _filtered() {
    if (range == 'All') return measurements;
    final now = DateTime.now();
    final cutoff = switch (range) {
      '1M' => now.subtract(const Duration(days: 30)),
      '3M' => now.subtract(const Duration(days: 90)),
      '6M' => now.subtract(const Duration(days: 180)),
      '1Y' => now.subtract(const Duration(days: 365)),
      _ => DateTime(2000),
    };
    return measurements.where((m) => m.measuredAt.isAfter(cutoff)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered();
    final points = <({DateTime date, double value})>[];
    for (final m in filtered) {
      final raw = _accessKg(m);
      if (raw != null) {
        points.add((date: m.measuredAt, value: _toDisplay(raw)));
      }
    }

    if (points.length < 2) {
      return Center(
        child: Text(
          points.isEmpty ? 'No data yet' : 'Need at least 2 points',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.3),
            fontSize: 13,
          ),
        ),
      );
    }

    final spots =
        List.generate(points.length, (i) => FlSpot(i.toDouble(), points[i].value));

    double minY = spots.map((s) => s.y).reduce((a, b) => a < b ? a : b);
    double maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    if (minY == maxY) {
      minY -= 2;
      maxY += 2;
    } else {
      final pad = (maxY - minY) * 0.2;
      minY -= pad;
      maxY += pad;
    }
    if (minY < 0) minY = 0;

    // PR indices: lowest-value points stand out (for weight, waist, hips, body fat)
    // or highest-value (for chest, biceps).
    final prIndices = _findPRIndices(points);

    // 7-day rolling average.
    final avgSpots = <FlSpot>[];
    if (points.length >= 3) {
      for (int i = 0; i < points.length; i++) {
        final cutoff =
            points[i].date.subtract(const Duration(days: 7));
        final window = <double>[];
        for (int j = 0; j <= i; j++) {
          if (points[j].date.isAfter(cutoff)) {
            window.add(points[j].value);
          }
        }
        // Always non-empty in practice: points[i] itself matches the
        // window because isAfter(date - 7d) is true for date. Guard
        // regardless so a future change can't crash the chart.
        if (window.isEmpty) continue;
        final avg = window.reduce((a, b) => a + b) / window.length;
        avgSpots.add(FlSpot(i.toDouble(), avg));
      }
    }

    final xInterval = ((points.length - 1) / 4)
        .ceilToDouble()
        .clamp(1.0, double.infinity);

    final maxX = (points.length - 1).toDouble();
    final dateFmt = DateFormat('d/M');

    return LineChart(
      LineChartData(
        minX: 0,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval:
              ((maxY - minY) / 4).clamp(1.0, double.infinity),
          getDrawingHorizontalLine: (_) => FlLine(
            color: Colors.white.withValues(alpha: 0.05),
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 32,
              getTitlesWidget: (value, meta) => Text(
                value.toStringAsFixed(0),
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.25),
                  fontSize: 9,
                ),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 22,
              interval: xInterval,
              getTitlesWidget: (value, meta) {
                // fl_chart may call this at fractional positions near
                // the chart edges; skip anything that isn't a real
                // integer data index so every tick maps to a unique
                // date.
                final idx = value.round();
                if ((value - idx).abs() > 0.01) {
                  return const SizedBox.shrink();
                }
                if (idx < 0 || idx >= points.length) {
                  return const SizedBox.shrink();
                }
                return SideTitleWidget(
                  axisSide: meta.axisSide,
                  space: 4,
                  child: Text(
                    dateFmt.format(points[idx].date),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.3),
                      fontSize: 10,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        borderData: FlBorderData(show: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: false,
            color: _amber,
            barWidth: 2.5,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, bar, index) {
                final isPR = prIndices.contains(index);
                if (isPR) {
                  return FlDotCirclePainter(
                    radius: 5,
                    color: _amber,
                    strokeWidth: 2,
                    strokeColor: _amber.withValues(alpha: 0.4),
                  );
                }
                return FlDotCirclePainter(
                  radius: 4,
                  color: _amber,
                  strokeWidth: 0,
                  strokeColor: Colors.transparent,
                );
              },
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  _amber.withValues(alpha: 0.3),
                  _amber.withValues(alpha: 0),
                ],
              ),
            ),
          ),
          if (avgSpots.isNotEmpty)
            LineChartBarData(
              spots: avgSpots,
              isCurved: true,
              curveSmoothness: 0.3,
              color: _amber.withValues(alpha: 0.3),
              barWidth: 1.5,
              isStrokeCapRound: true,
              dotData: const FlDotData(show: false),
              dashArray: const [4, 4],
            ),
        ],
        lineTouchData: LineTouchData(
          enabled: true,
          handleBuiltInTouches: true,
          touchTooltipData: LineTouchTooltipData(
            tooltipRoundedRadius: 8,
            tooltipPadding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            getTooltipColor: (_) => const Color(0xFF1a2332),
            tooltipBorder: BorderSide(
              color: Colors.white.withValues(alpha: 0.08),
              width: 1,
            ),
            getTooltipItems: (touchedSpots) {
              final tooltipFmt = DateFormat('d/M/yyyy');
              return touchedSpots.map((spot) {
                if (spot.barIndex != 0) return null;
                final idx = spot.spotIndex;
                if (idx < 0 || idx >= points.length) return null;
                final d = points[idx].date;
                return LineTooltipItem(
                  '${spot.y.toStringAsFixed(1)} $_unit\n${tooltipFmt.format(d)}',
                  const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                );
              }).toList();
            },
          ),
        ),
      ),
    );
  }

  Set<int> _findPRIndices(List<({DateTime date, double value})> pts) {
    if (pts.isEmpty) return {};
    // For weight / waist / hips / body fat: lower is "PR".
    // For chest / biceps: higher is "PR".
    final smallerBetter = metric == 'weight' ||
        metric == 'waist' ||
        metric == 'hips' ||
        metric == 'body_fat';

    double extreme = pts.first.value;
    final result = <int>{};
    for (int i = 0; i < pts.length; i++) {
      final v = pts[i].value;
      if (i == 0) continue;
      if (smallerBetter ? v < extreme : v > extreme) {
        extreme = v;
        result.add(i);
      }
    }
    return result;
  }
}

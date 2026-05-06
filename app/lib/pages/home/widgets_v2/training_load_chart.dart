import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../models/home.dart';
import '_tokens_v2.dart';

/// Strava-red flow chart of last 30 days of training load (session minutes
/// per day, from `/api/home/daily-load`). Smooth curve with gradient fill,
/// trailing dot, +/- delta vs prior 14 days in the header.
///
/// Empty state: when there's < 7 days of any non-zero load, renders the
/// chart frame with a flat line and the prompt copy from design doc §4.4.
class TrainingLoadChart extends StatelessWidget {
  final DailyLoad? data;

  const TrainingLoadChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final d = data;
    final hasData =
        d != null && d.points.any((p) => p.loadMinutes > 0);
    final hasEnough =
        hasData && d.points.where((p) => p.loadMinutes > 0).length >= 7;

    return Container(
      decoration: kHomeCardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(deltaPct: hasEnough ? d.deltaPct : null),
          const SizedBox(height: 12),
          SizedBox(
            height: 80,
            child: hasEnough
                ? _Chart(points: d.points)
                : const _EmptyChart(),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final double? deltaPct;
  const _Header({required this.deltaPct});

  @override
  Widget build(BuildContext context) {
    final hasDelta = deltaPct != null;
    final positive = (deltaPct ?? 0) >= 0;
    final deltaStr = hasDelta
        ? '${positive ? '+' : ''}${deltaPct!.toStringAsFixed(deltaPct!.abs() >= 10 ? 0 : 1)}%'
        : '—';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'TRAINING LOAD',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: kHomeTextTertiary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              deltaStr,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: kHomeTextPrimary,
                letterSpacing: -0.4,
              ),
            ),
            if (hasDelta)
              Text(
                '${positive ? '↗' : '↘'} vs last 14 days',
                style: const TextStyle(
                  fontSize: 11,
                  color: kHomeTextSecondary,
                ),
              ),
          ],
        ),
        const Text(
          'Last 30 days',
          style: TextStyle(
            fontSize: 11,
            color: kHomeTextTertiary,
          ),
        ),
      ],
    );
  }
}

class _Chart extends StatelessWidget {
  final List<DailyLoadPoint> points;
  const _Chart({required this.points});

  @override
  Widget build(BuildContext context) {
    // 3-day moving average smooths the spikes; original points still drive
    // the y-domain so a real spike shows up as a true peak.
    final spots = <FlSpot>[];
    for (var i = 0; i < points.length; i++) {
      final lo = (i - 1).clamp(0, points.length - 1);
      final hi = (i + 1).clamp(0, points.length - 1);
      final smoothed =
          (points[lo].loadMinutes + points[i].loadMinutes + points[hi].loadMinutes) / 3.0;
      spots.add(FlSpot(i.toDouble(), smoothed));
    }
    final maxY = spots.fold<double>(0, (a, s) => s.y > a ? s.y : a);
    return LineChart(
      LineChartData(
        minX: 0,
        maxX: (points.length - 1).toDouble(),
        minY: 0,
        maxY: maxY <= 0 ? 1 : maxY * 1.15,
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: const FlTitlesData(show: false),
        lineTouchData: const LineTouchData(enabled: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.35,
            preventCurveOverShooting: true,
            color: kStravaRed,
            barWidth: 2,
            dotData: FlDotData(
              show: true,
              checkToShowDot: (spot, _) => spot.x == spots.last.x,
              getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                radius: 3.5,
                color: kStravaRed,
                strokeWidth: 6,
                strokeColor: kStravaRed.withValues(alpha: 0.2),
              ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  kStravaRed.withValues(alpha: 0.18),
                  kStravaRed.withValues(alpha: 0),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyChart extends StatelessWidget {
  const _EmptyChart();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Faint baseline so the frame doesn't look broken.
        Positioned.fill(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              height: 1,
              color: kHomeDivider,
            ),
          ),
        ),
        const Text(
          'Build your first 7 days to see trends',
          style: TextStyle(
            fontSize: 12,
            color: kHomeTextTertiary,
          ),
        ),
      ],
    );
  }
}

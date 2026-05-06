import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../models/home.dart';
import '_tokens_v2.dart';

/// 14-bar daily session count chart (label "Last 4 weeks" matches the
/// approved mockup; design doc §4.6 keeps 14 daily bars for v1).
class RecentBarChart extends StatelessWidget {
  final List<DailyCount>? data;
  const RecentBarChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final pts = data ?? const <DailyCount>[];
    final maxCount =
        pts.fold<int>(0, (a, p) => p.sessions > a ? p.sessions : a);
    final maxY = (maxCount <= 0) ? 1.0 : (maxCount + 1).toDouble();

    return Container(
      decoration: kHomeCardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'LAST 4 WEEKS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: kHomeTextTertiary,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 60,
            child: pts.isEmpty
                ? const _EmptyBars()
                : BarChart(
                    BarChartData(
                      alignment: BarChartAlignment.spaceAround,
                      maxY: maxY,
                      gridData: const FlGridData(show: false),
                      borderData: FlBorderData(show: false),
                      titlesData: const FlTitlesData(show: false),
                      barTouchData: BarTouchData(enabled: false),
                      barGroups: [
                        for (var i = 0; i < pts.length; i++)
                          BarChartGroupData(
                            x: i,
                            barRods: [
                              BarChartRodData(
                                toY: pts[i].sessions.toDouble(),
                                color: kBarChart,
                                width: 8,
                                borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(3),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBars extends StatelessWidget {
  const _EmptyBars();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text(
        'No sessions in the last 14 days',
        style: TextStyle(fontSize: 12, color: kHomeTextTertiary),
      ),
    );
  }
}

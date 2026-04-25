import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../../models/home.dart';
import '../../../providers/home_provider.dart';
import '_tokens.dart';

/// Last-4-weeks stacked bar chart — strength (gold), yoga (teal), breath
/// (purple). Reads `HomeProvider.weeks`.
class WeeklyActivityChart extends StatelessWidget {
  const WeeklyActivityChart({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();
    final weeks = provider.weeks;
    final loading = weeks == null && provider.loading;
    final error = provider.weeksError;

    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('LAST 4 WEEKS', style: kSectionLabel),
          const SizedBox(height: 12),
          const Row(
            children: [
              _LegendDot(color: kPillarStrength, label: 'Strength'),
              SizedBox(width: 12),
              _LegendDot(color: kPillarYoga, label: 'Yoga'),
              SizedBox(width: 12),
              _LegendDot(color: kPillarBreath, label: 'Breath'),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 180,
            child: _buildBody(
              weeks: weeks,
              loading: loading,
              error: error,
              onRetry: () => provider.refresh(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody({
    required List<WeeklyActivity>? weeks,
    required bool loading,
    required String? error,
    required VoidCallback onRetry,
  }) {
    if (loading) {
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF2F2EE),
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }
    if (weeks == null && error != null) {
      return _ChartError(message: error, onRetry: onRetry);
    }
    final data = weeks ?? const <WeeklyActivity>[];
    if (data.isEmpty || data.every((w) => w.total == 0)) {
      return const _ChartEmpty();
    }
    return _StackedBars(weeks: data);
  }
}

class _StackedBars extends StatelessWidget {
  final List<WeeklyActivity> weeks;
  const _StackedBars({required this.weeks});

  @override
  Widget build(BuildContext context) {
    final maxTotal = weeks
        .map((w) => w.total)
        .fold<int>(0, (a, b) => a > b ? a : b)
        .toDouble();
    final maxY = maxTotal <= 0 ? 4.0 : maxTotal * 1.15;

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: maxY,
        borderData: FlBorderData(show: false),
        gridData: const FlGridData(show: false),
        titlesData: FlTitlesData(
          leftTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 22,
              getTitlesWidget: (value, meta) {
                final idx = value.toInt();
                if (idx < 0 || idx >= weeks.length) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    _shortLabel(weeks[idx].weekStart),
                    style: const TextStyle(
                      fontSize: 11,
                      color: kSecondaryText,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        barGroups: List.generate(weeks.length, (i) {
          final w = weeks[i];
          final s = w.strength.toDouble();
          final y = w.yoga.toDouble();
          final b = w.breath.toDouble();
          return BarChartGroupData(
            x: i,
            barRods: [
              BarChartRodData(
                toY: s + y + b,
                width: 28,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(6),
                  topRight: Radius.circular(6),
                ),
                rodStackItems: [
                  BarChartRodStackItem(0, s, kPillarStrength),
                  BarChartRodStackItem(s, s + y, kPillarYoga),
                  BarChartRodStackItem(s + y, s + y + b, kPillarBreath),
                ],
              ),
            ],
          );
        }),
        barTouchData: BarTouchData(
          enabled: true,
          touchTooltipData: BarTouchTooltipData(
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              final w = weeks[groupIndex];
              return BarTooltipItem(
                'Week of ${_shortLabel(w.weekStart)}\n'
                '${w.strength} strength · ${w.yoga} yoga · ${w.breath} breath',
                const TextStyle(
                  fontSize: 11,
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  String _shortLabel(String iso) {
    // iso looks like "2026-04-06"; render as "Apr 6".
    final parts = iso.split('-');
    if (parts.length != 3) return iso;
    final monthIdx = int.tryParse(parts[1]);
    final day = int.tryParse(parts[2]);
    if (monthIdx == null || day == null || monthIdx < 1 || monthIdx > 12) {
      return iso;
    }
    return '${_months[monthIdx - 1]} $day';
  }
}

class _ChartError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ChartError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(LucideIcons.alertTriangle,
            size: 18, color: kSecondaryText),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 12, color: kSecondaryText),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: onRetry,
          style: TextButton.styleFrom(foregroundColor: kCoral),
          child: const Text('Retry'),
        ),
      ],
    );
  }
}

class _ChartEmpty extends StatelessWidget {
  const _ChartEmpty();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text(
        'No activity yet — start your first session',
        style: TextStyle(fontSize: 13, color: kSecondaryText),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: kSecondaryText),
        ),
      ],
    );
  }
}

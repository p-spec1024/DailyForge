import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/body_measurements_provider.dart';
import '../../providers/profile_provider.dart';
import 'circumferences_row.dart';
import 'hero_number.dart';
import 'measurements_chart.dart';
import 'summary_cards.dart';

class ChartView extends StatelessWidget {
  const ChartView({super.key});

  static const _metrics = [
    ('weight', 'Weight'),
    ('body_fat', 'Body fat'),
    ('waist', 'Waist'),
    ('hips', 'Hips'),
    ('chest', 'Chest'),
    ('bicep_left', 'L Bicep'),
    ('bicep_right', 'R Bicep'),
  ];

  static const _ranges = ['1M', '3M', '6M', '1Y', 'All'];

  @override
  Widget build(BuildContext context) {
    return Consumer2<BodyMeasurementsProvider, ProfileProvider>(
      builder: (context, provider, profile, _) {
        final unitSystem = profile.unitSystem;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            HeroNumber(
              measurements: provider.measurements,
              unitSystem: unitSystem,
            ),
            const SizedBox(height: 20),
            MiniStatsRow(
              stats: provider.stats,
              unitSystem: unitSystem,
            ),
            const SizedBox(height: 16),
            _buildChartCard(context, provider, unitSystem),
            const SizedBox(height: 12),
            CircumferencesRow(
              measurements: provider.measurements,
              unitSystem: unitSystem,
            ),
          ],
        );
      },
    );
  }

  Widget _buildChartCard(
      BuildContext context, BodyMeasurementsProvider provider, String unit) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          _buildMetricPills(provider),
          const SizedBox(height: 12),
          SizedBox(
            height: 150,
            child: MeasurementsChart(
              measurements: provider.measurements,
              unitSystem: unit,
              metric: provider.selectedMetric,
              range: provider.selectedRange,
            ),
          ),
          const SizedBox(height: 10),
          _buildRangeSelector(provider),
          const SizedBox(height: 10),
          _buildLegend(),
        ],
      ),
    );
  }

  Widget _buildMetricPills(BodyMeasurementsProvider provider) {
    return SizedBox(
      height: 28,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _metrics.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final key = _metrics[i].$1;
          final label = _metrics[i].$2;
          final active = provider.selectedMetric == key;
          return GestureDetector(
            onTap: () => provider.setSelectedMetric(key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: active
                    ? AppColors.gold
                    : Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                label,
                style: TextStyle(
                  color: active
                      ? Colors.black
                      : Colors.white.withValues(alpha: 0.6),
                  fontSize: 11,
                  fontWeight: active ? FontWeight.w500 : FontWeight.w400,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildRangeSelector(BodyMeasurementsProvider provider) {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: _ranges.map((r) {
            final active = provider.selectedRange == r;
            return GestureDetector(
              onTap: () => provider.setSelectedRange(r),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: active
                      ? Colors.white.withValues(alpha: 0.1)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  r,
                  style: TextStyle(
                    color: active
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.4),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildLegend() {
    const amber = AppColors.gold;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(width: 16, height: 2, color: amber),
        const SizedBox(width: 4),
        Text('Actual',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 11,
            )),
        const SizedBox(width: 14),
        _DashSample(color: amber.withValues(alpha: 0.5)),
        const SizedBox(width: 4),
        Text('7d avg',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 11,
            )),
        const SizedBox(width: 14),
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: amber,
            border: Border.all(
              color: amber.withValues(alpha: 0.4),
              width: 2,
            ),
          ),
        ),
        const SizedBox(width: 4),
        Text('PR',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 11,
            )),
      ],
    );
  }
}

class _DashSample extends StatelessWidget {
  final Color color;
  const _DashSample({required this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 16,
      height: 2,
      child: Row(
        children: List.generate(
          3,
          (i) => Expanded(
            child: Container(
              margin: EdgeInsets.only(right: i == 2 ? 0 : 2),
              color: color,
            ),
          ),
        ),
      ),
    );
  }
}

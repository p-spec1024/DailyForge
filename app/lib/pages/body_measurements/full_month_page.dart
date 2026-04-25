import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../providers/body_measurements_provider.dart';
import '../../providers/profile_provider.dart';
import '../../utils/unit_conversion.dart';
import '../../widgets/body_measurements/entry_detail_sheet.dart';
import '../../widgets/body_measurements/entry_row.dart';

class FullMonthPage extends StatelessWidget {
  final DateTime month;

  const FullMonthPage({super.key, required this.month});

  static const _monthFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Consumer2<BodyMeasurementsProvider, ProfileProvider>(
          builder: (context, provider, profile, _) {
            final unitSystem = profile.unitSystem;

            // Compute stats and entries for the passed-in month directly,
            // independently of the provider's selectedMonth.
            final entries = provider.measurements
                .where((m) =>
                    m.measuredAt.year == month.year &&
                    m.measuredAt.month == month.month)
                .toList()
              ..sort((a, b) => b.measuredAt.compareTo(a.measuredAt));

            final weights = entries
                .map((m) => m.weightKg)
                .whereType<double>()
                .toList();

            final latest = weights.isNotEmpty ? weights.first : null;
            final oldest = weights.isNotEmpty ? weights.last : null;
            final avg = weights.isNotEmpty
                ? weights.reduce((a, b) => a + b) / weights.length
                : null;
            final low = weights.isNotEmpty
                ? weights.reduce((a, b) => a < b ? a : b)
                : null;
            final high = weights.isNotEmpty
                ? weights.reduce((a, b) => a > b ? a : b)
                : null;
            final change = (latest != null && oldest != null)
                ? latest - oldest
                : null;

            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _buildHeader(context, entries.length, change,
                      unitSystem),
                ),
                if (weights.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: _buildStatsBar(
                        unitSystem: unitSystem,
                        latest: latest,
                        avg: avg,
                        low: low,
                        high: high,
                      ),
                    ),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
                  sliver: SliverList.builder(
                    itemCount: entries.length,
                    itemBuilder: (context, i) {
                      return EntryRow(
                        entry: entries[i],
                        // Fall back to the most recent entry in a
                        // previous month for the oldest row in view.
                        previous: i + 1 < entries.length
                            ? entries[i + 1]
                            : provider.getPreviousEntry(entries[i]),
                        unitSystem: unitSystem,
                        showDayOfWeek: true,
                        showChevron: true,
                        onTap: () => _openDetail(context, entries[i]),
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, int count, double? change,
      String unitSystem) {
    final title = '${_monthFull[month.month - 1]} ${month.year}';
    String subtitle = '$count ${count == 1 ? 'entry' : 'entries'}';
    if (change != null && change.abs() > 0.01) {
      final displayChange = kgToDisplay(change.abs(), unitSystem);
      final sign = change < 0 ? '-' : '+';
      subtitle +=
          ' · $sign${displayChange.toStringAsFixed(1)} ${weightUnit(unitSystem)}';
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 16, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconButton(
            icon: Icon(LucideIcons.arrowLeft,
                color: Colors.white.withValues(alpha: 0.6), size: 18),
            onPressed: () => context.pop(),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.4),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsBar({
    required String unitSystem,
    required double? latest,
    required double? avg,
    required double? low,
    required double? high,
  }) {
    String fmt(double? v) =>
        v != null ? kgToDisplay(v, unitSystem).toStringAsFixed(1) : '—';

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(child: _statCell(fmt(latest), 'Latest', Colors.white)),
          Expanded(child: _statCell(fmt(avg), 'Avg', Colors.white)),
          Expanded(
              child: _statCell(fmt(low), 'Lowest', AppColors.positive)),
          Expanded(
              child: _statCell(fmt(high), 'Highest', AppColors.error)),
        ],
      ),
    );
  }

  Widget _statCell(String value, String label, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.4),
            fontSize: 10,
          ),
        ),
      ],
    );
  }

  void _openDetail(BuildContext context, BodyMeasurement entry) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => EntryDetailSheet(entry: entry),
    );
  }
}

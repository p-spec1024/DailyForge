import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../providers/body_measurements_provider.dart';
import '../../providers/profile_provider.dart';
import 'entry_detail_sheet.dart';
import 'entry_row.dart';
import 'month_picker_bar.dart';
import 'month_year_picker_sheet.dart';
import 'summary_cards.dart';

class MeasurementsListView extends StatelessWidget {
  const MeasurementsListView({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer2<BodyMeasurementsProvider, ProfileProvider>(
      builder: (context, provider, profile, _) {
        final unitSystem = profile.unitSystem;
        final entries = provider.previewEntries;
        final hasMore = provider.hasMoreEntries;
        final count = provider.measurementsForSelectedMonth.length;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            SummaryCards(
              stats: provider.stats,
              measurements: provider.measurements,
              unitSystem: unitSystem,
            ),
            const SizedBox(height: 12),
            MonthPickerBar(
              provider: provider,
              unitSystem: unitSystem,
              onTapMonth: () => _openMonthPicker(context, provider),
            ),
            const SizedBox(height: 12),
            if (entries.isEmpty)
              _buildEmpty()
            else ...[
              for (int i = 0; i < entries.length; i++)
                EntryRow(
                  entry: entries[i],
                  // Within-month neighbor first; fall back to the
                  // most recent entry in a prior month so the last
                  // visible row still shows a delta.
                  previous: i + 1 < entries.length
                      ? entries[i + 1]
                      : provider.getPreviousEntry(entries[i]),
                  unitSystem: unitSystem,
                  onTap: () => _openDetail(context, entries[i]),
                ),
              if (hasMore) ...[
                const SizedBox(height: 12),
                _buildSeeAllButton(context, count, provider.selectedMonth),
              ],
            ],
          ],
        );
      },
    );
  }

  Widget _buildEmpty() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 36),
      alignment: Alignment.center,
      child: Text(
        'No entries this month',
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.4),
          fontSize: 13,
        ),
      ),
    );
  }

  Widget _buildSeeAllButton(
      BuildContext context, int count, DateTime month) {
    return GestureDetector(
      onTap: () => context.push(
        '/body-measurements/month',
        extra: month,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'See all $count entries',
              style: const TextStyle(
                color: AppColors.accent,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 6),
            const Text(
              '→',
              style: TextStyle(
                color: AppColors.accent,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openMonthPicker(
      BuildContext context, BodyMeasurementsProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MonthYearPickerSheet(provider: provider),
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

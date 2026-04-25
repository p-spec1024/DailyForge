import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../providers/body_measurements_provider.dart';
import '../../providers/profile_provider.dart';
import '../../utils/unit_conversion.dart';
import 'add_measurement_sheet.dart';

class EntryDetailSheet extends StatelessWidget {
  final BodyMeasurement entry;

  const EntryDetailSheet({super.key, required this.entry});

  static const _months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  static const _weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday',
  ];

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<ProfileProvider>();
    final provider = context.watch<BodyMeasurementsProvider>();
    final unitSystem = profile.unitSystem;

    // Delta lookup is per-metric: the immediate predecessor may not have
    // a reading for every field, so scan backward from this entry and
    // pick the most recent non-null value for each.
    final all = provider.measurements;
    final prevWeight = _previousValue(all, entry, (m) => m.weightKg);
    final prevBodyFat =
        _previousValue(all, entry, (m) => m.bodyFatPercent);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 14,
        bottom: MediaQuery.of(context).padding.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            _buildHeader(context, provider, profile),
            const SizedBox(height: 16),
            _buildStatRow(prevWeight, prevBodyFat, unitSystem),
            const SizedBox(height: 12),
            if (_hasCircumferences(entry)) ...[
              _buildCircumferences(unitSystem),
              const SizedBox(height: 12),
            ],
            if (entry.notes != null && entry.notes!.trim().isNotEmpty)
              _buildNotes(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    BodyMeasurementsProvider provider,
    ProfileProvider profile,
  ) {
    final d = entry.measuredAt;
    final dateStr = '${_months[d.month - 1]} ${d.day}, ${d.year}';
    final weekday = _weekdays[d.weekday - 1];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                dateStr,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                weekday,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.5),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: () => _edit(context, provider, profile),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.accent,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            minimumSize: const Size(40, 30),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('Edit',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        ),
        TextButton(
          onPressed: () => _confirmDelete(context, provider),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.error,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            minimumSize: const Size(40, 30),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('Delete',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        ),
      ],
    );
  }

  Widget _buildStatRow(
      double? prevWeight, double? prevBodyFat, String unitSystem) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _StatCard(
            label: 'Weight',
            value: entry.weightKg != null
                ? kgToDisplay(entry.weightKg!, unitSystem).toStringAsFixed(1)
                : null,
            unit: weightUnit(unitSystem),
            delta: _computeDelta(
              current: entry.weightKg,
              previous: prevWeight,
              unitSystem: unitSystem,
              mode: _DeltaMode.weight,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            label: 'Body fat',
            value: entry.bodyFatPercent?.toStringAsFixed(1),
            unit: '%',
            delta: _computeDelta(
              current: entry.bodyFatPercent,
              previous: prevBodyFat,
              unitSystem: unitSystem,
              mode: _DeltaMode.bodyFat,
            ),
          ),
        ),
      ],
    );
  }

  /// Most recent non-null [accessor] value from a measurement logged
  /// strictly before [current]. [all] is sorted ascending by date, so
  /// we iterate in reverse and stop at the first hit.
  double? _previousValue(
    List<BodyMeasurement> all,
    BodyMeasurement current,
    double? Function(BodyMeasurement) accessor,
  ) {
    for (final m in all.reversed) {
      if (!m.measuredAt.isBefore(current.measuredAt)) continue;
      final v = accessor(m);
      if (v != null) return v;
    }
    return null;
  }

  bool _hasCircumferences(BodyMeasurement m) {
    return m.waistCm != null ||
        m.hipsCm != null ||
        m.chestCm != null ||
        m.bicepLeftCm != null ||
        m.bicepRightCm != null;
  }

  Widget _buildCircumferences(String unitSystem) {
    final rows = <List<({String label, double? cm})>>[];
    final flat = <({String label, double? cm})>[
      (label: 'Waist', cm: entry.waistCm),
      (label: 'Hips', cm: entry.hipsCm),
      (label: 'Chest', cm: entry.chestCm),
      (label: 'L Bicep', cm: entry.bicepLeftCm),
      (label: 'R Bicep', cm: entry.bicepRightCm),
    ].where((e) => e.cm != null).toList();

    for (int i = 0; i < flat.length; i += 2) {
      rows.add([flat[i], if (i + 1 < flat.length) flat[i + 1]]);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
          const SizedBox(height: 10),
          ...rows.map((pair) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(child: _buildCircRow(pair[0], unitSystem)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: pair.length > 1
                        ? _buildCircRow(pair[1], unitSystem)
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildCircRow(
      ({String label, double? cm}) item, String unitSystem) {
    return Row(
      children: [
        Expanded(
          child: Text(
            item.label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 13,
            ),
          ),
        ),
        Text(
          item.cm != null ? formatLength(item.cm!, unitSystem) : '—',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildNotes() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'NOTES',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 11,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            entry.notes!,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  _DeltaInfo? _computeDelta({
    required double? current,
    required double? previous,
    required String unitSystem,
    required _DeltaMode mode,
  }) {
    if (current == null || previous == null) return null;
    final diff = current - previous;
    if (diff.abs() < 0.01) return null;

    double display;
    String unit;
    switch (mode) {
      case _DeltaMode.weight:
        display = kgToDisplay(diff.abs(), unitSystem);
        unit = weightUnit(unitSystem);
      case _DeltaMode.bodyFat:
        display = diff.abs();
        unit = '%';
    }

    final down = diff < 0;
    final color = down ? AppColors.positive : AppColors.error;
    final arrow = down ? '↓' : '↑';

    return _DeltaInfo(
      text: '$arrow${display.toStringAsFixed(1)} $unit from last',
      color: color,
    );
  }

  void _edit(
    BuildContext context,
    BodyMeasurementsProvider provider,
    ProfileProvider profile,
  ) {
    Navigator.pop(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddMeasurementSheet(
        unitSystem: profile.unitSystem,
        existing: entry,
        onSave: (data) => provider.updateMeasurement(entry.id, data),
      ),
    );
  }

  void _confirmDelete(
      BuildContext context, BodyMeasurementsProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete measurement?',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'This cannot be undone.',
          style: TextStyle(color: AppColors.secondaryText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final ok = await provider.deleteMeasurement(entry.id);
              if (ok && context.mounted) Navigator.pop(context);
            },
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

enum _DeltaMode { weight, bodyFat }

class _DeltaInfo {
  final String text;
  final Color color;
  _DeltaInfo({required this.text, required this.color});
}

class _StatCard extends StatelessWidget {
  final String label;
  final String? value;
  final String unit;
  final _DeltaInfo? delta;

  const _StatCard({
    required this.label,
    required this.value,
    required this.unit,
    this.delta,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value ?? '—',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w500,
                  height: 1,
                ),
              ),
              if (value != null) ...[
                const SizedBox(width: 4),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    unit,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.4),
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          if (delta != null)
            Text(
              delta!.text,
              style: TextStyle(
                color: delta!.color,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            )
          else if (value != null)
            Text(
              'First entry',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.35),
                fontSize: 12,
              ),
            )
          else
            const SizedBox(height: 14),
        ],
      ),
    );
  }
}

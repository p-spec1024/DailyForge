import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../providers/body_measurements_provider.dart';

/// Bottom sheet to jump to any month between the earliest-recorded month
/// and the current month.
class MonthYearPickerSheet extends StatefulWidget {
  final BodyMeasurementsProvider provider;

  const MonthYearPickerSheet({super.key, required this.provider});

  @override
  State<MonthYearPickerSheet> createState() => _MonthYearPickerSheetState();
}

class _MonthYearPickerSheetState extends State<MonthYearPickerSheet> {
  late int _year;
  late int _month;

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  static const _monthFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  void initState() {
    super.initState();
    _year = widget.provider.selectedMonth.year;
    _month = widget.provider.selectedMonth.month;
  }

  /// Always expose at least the last 3 years so the user can browse
  /// past months even before any entries exist for them.
  int get _minYear {
    final now = DateTime.now();
    final earliest = widget.provider.earliestMonth.year;
    final fallback = now.year - 2;
    return earliest < fallback ? earliest : fallback;
  }

  int get _maxYear => DateTime.now().year;

  /// Only future months are disabled. Past months without data are
  /// still tappable — the user sees "0 entries" and can navigate.
  bool _isMonthAvailable(int year, int month) {
    final d = DateTime(year, month);
    final now = DateTime.now();
    final currentMonth = DateTime(now.year, now.month);
    return !d.isAfter(currentMonth);
  }

  @override
  Widget build(BuildContext context) {
    final previewCount =
        widget.provider.entryCountForMonth(DateTime(_year, _month));

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
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
          const SizedBox(height: 14),
          const Text(
            'Jump to month',
            style: TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 18),
          _buildYearSelector(),
          const SizedBox(height: 16),
          _buildMonthGrid(),
          const SizedBox(height: 14),
          Text(
            '$previewCount ${previewCount == 1 ? 'entry' : 'entries'} in ${_monthFull[_month - 1]} $_year',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.4),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _buildCancelButton(),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildConfirmButton(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildYearSelector() {
    final years = <int>[];
    for (int y = _minYear; y <= _maxYear; y++) {
      years.add(y);
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          icon: Icon(LucideIcons.chevronLeft,
              size: 16,
              color: Colors.white.withValues(alpha: 0.5)),
          onPressed: _year > _minYear
              ? () => setState(() => _year--)
              : null,
        ),
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: years.map((y) {
                final active = y == _year;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: GestureDetector(
                    onTap: () => setState(() => _year = y),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: active
                            ? AppColors.accent
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$y',
                        style: TextStyle(
                          color: active
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.4),
                          fontSize: 16,
                          fontWeight: active
                              ? FontWeight.w500
                              : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        IconButton(
          icon: Icon(LucideIcons.chevronRight,
              size: 16,
              color: Colors.white.withValues(alpha: 0.5)),
          onPressed: _year < _maxYear
              ? () => setState(() => _year++)
              : null,
        ),
      ],
    );
  }

  Widget _buildMonthGrid() {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 4,
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 2.2,
      children: List.generate(12, (i) {
        final m = i + 1;
        final available = _isMonthAvailable(_year, m);
        final selected = m == _month;

        Color bg;
        Color fg;
        if (selected) {
          bg = AppColors.accent;
          fg = Colors.white;
        } else if (available) {
          bg = Colors.white.withValues(alpha: 0.06);
          fg = Colors.white.withValues(alpha: 0.6);
        } else {
          bg = Colors.white.withValues(alpha: 0.03);
          fg = Colors.white.withValues(alpha: 0.25);
        }

        return GestureDetector(
          onTap: available ? () => setState(() => _month = m) : null,
          behavior: HitTestBehavior.opaque,
          child: Container(
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: Text(
              _months[i],
              style: TextStyle(
                color: fg,
                fontSize: 13,
                fontWeight: selected ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildCancelButton() {
    return GestureDetector(
      onTap: () => Navigator.pop(context),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Text(
          'Cancel',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.7),
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildConfirmButton() {
    final canConfirm = _isMonthAvailable(_year, _month);
    return GestureDetector(
      onTap: canConfirm
          ? () {
              widget.provider
                  .setSelectedMonth(DateTime(_year, _month));
              Navigator.pop(context);
            }
          : null,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: canConfirm
              ? AppColors.accent
              : AppColors.accent.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Text(
          'Go to ${_monthFull[_month - 1]}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

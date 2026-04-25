import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../providers/calendar_provider.dart';
import 'streak_counter.dart';
import 'calendar_day.dart';
import 'session_detail_sheet.dart';

class WorkoutCalendar extends StatefulWidget {
  const WorkoutCalendar({super.key});

  @override
  State<WorkoutCalendar> createState() => _WorkoutCalendarState();
}

class _WorkoutCalendarState extends State<WorkoutCalendar> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CalendarProvider>().fetchMonth();
    });
  }

  void _showSessionDetail(
      DateTime date, List<Map<String, dynamic>> sessions) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => SessionDetailSheet(date: date, sessions: sessions),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<CalendarProvider>(
      builder: (context, provider, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Streak counter
            StreakCounter(
              currentStreak: provider.currentStreak,
              bestStreak: provider.bestStreak,
            ),
            const SizedBox(height: 16),

            // Calendar card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.cardBackground,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: Column(
                children: [
                  _buildMonthHeader(provider),
                  const SizedBox(height: 16),
                  _buildWeekHeaders(),
                  const SizedBox(height: 8),
                  if (provider.isLoading)
                    const Padding(
                      padding: EdgeInsets.all(40),
                      child:
                          CircularProgressIndicator(color: AppColors.gold),
                    )
                  else
                    _buildCalendarGrid(provider),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildMonthHeader(CalendarProvider provider) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    final month = provider.currentMonth;
    final monthName = '${months[month.month - 1]} ${month.year}';

    final now = DateTime.now();
    final canGoNext = month.year < now.year ||
        (month.year == now.year && month.month < now.month);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          onPressed: provider.previousMonth,
          icon: const Icon(LucideIcons.chevronLeft,
              color: AppColors.primaryText),
          padding: EdgeInsets.zero,
          constraints:
              const BoxConstraints(minWidth: 40, minHeight: 40),
        ),
        Text(
          monthName,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        IconButton(
          onPressed: canGoNext ? provider.nextMonth : null,
          icon: Icon(
            LucideIcons.chevronRight,
            color: canGoNext
                ? AppColors.primaryText
                : AppColors.secondaryText.withValues(alpha: 0.3),
          ),
          padding: EdgeInsets.zero,
          constraints:
              const BoxConstraints(minWidth: 40, minHeight: 40),
        ),
      ],
    );
  }

  Widget _buildWeekHeaders() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return Row(
      children: days
          .map((day) => Expanded(
                child: Center(
                  child: Text(
                    day,
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ))
          .toList(),
    );
  }

  Widget _buildCalendarGrid(CalendarProvider provider) {
    final month = provider.currentMonth;
    final firstDayOfMonth = DateTime(month.year, month.month, 1);
    final lastDayOfMonth = DateTime(month.year, month.month + 1, 0);
    final daysInMonth = lastDayOfMonth.day;

    // Monday = 1 in Dart; we want Monday as first column
    final leadingDays = firstDayOfMonth.weekday - 1;

    final today = DateTime.now();
    final streakDates = _calculateStreakDates(provider);

    final totalCells = ((leadingDays + daysInMonth + 6) ~/ 7) * 7;

    final rows = <Widget>[];
    for (int i = 0; i < totalCells; i += 7) {
      final rowChildren = <Widget>[];
      for (int j = 0; j < 7; j++) {
        final cellIndex = i + j;
        final dayOffset = cellIndex - leadingDays;

        if (dayOffset < 0) {
          // Previous month
          final prevMonthEnd = DateTime(month.year, month.month, 0);
          final day = prevMonthEnd.day + dayOffset + 1;
          rowChildren.add(Expanded(
            child: CalendarDay(day: day, isCurrentMonth: false),
          ));
        } else if (dayOffset >= daysInMonth) {
          // Next month
          final day = dayOffset - daysInMonth + 1;
          if (day <= 14) {
            rowChildren.add(Expanded(
              child: CalendarDay(day: day, isCurrentMonth: false),
            ));
          } else {
            rowChildren.add(const Expanded(child: SizedBox()));
          }
        } else {
          // Current month
          final day = dayOffset + 1;
          final date = DateTime(month.year, month.month, day);
          final sessions = provider.getSessionsForDate(date);
          final sessionTypes = sessions
              .map((s) => s['type'] as String? ?? 'strength')
              .toList();

          final isToday = date.year == today.year &&
              date.month == today.month &&
              date.day == today.day;

          final dateStr =
              '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
          final hasStreak = streakDates.contains(dateStr);

          rowChildren.add(Expanded(
            child: CalendarDay(
              day: day,
              isCurrentMonth: true,
              isToday: isToday,
              hasStreak: hasStreak,
              sessionTypes: sessionTypes,
              onTap: sessions.isNotEmpty
                  ? () => _showSessionDetail(date, sessions)
                  : null,
            ),
          ));
        }
      }
      rows.add(SizedBox(height: 48, child: Row(children: rowChildren)));
    }

    return Column(children: rows);
  }

  Set<String> _calculateStreakDates(CalendarProvider provider) {
    final dates = provider.sessionsByDate.keys.toList()..sort();
    final streakDates = <String>{};

    if (dates.isEmpty) return streakDates;

    String fmt(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

    final today = DateTime.now();
    final todayStr = fmt(today);
    final yesterdayStr = fmt(today.subtract(const Duration(days: 1)));

    // Start from today or yesterday (whichever has a session)
    String? currentDate;
    if (dates.contains(todayStr)) {
      currentDate = todayStr;
    } else if (dates.contains(yesterdayStr)) {
      currentDate = yesterdayStr;
    }

    if (currentDate == null) return streakDates;

    // Walk backwards to find consecutive streak days
    while (dates.contains(currentDate)) {
      streakDates.add(currentDate!);
      final parts = currentDate.split('-');
      final prev = DateTime(
        int.parse(parts[0]),
        int.parse(parts[1]),
        int.parse(parts[2]),
      ).subtract(const Duration(days: 1));
      currentDate = fmt(prev);
    }

    return streakDates;
  }
}

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../config/theme.dart';

/// S14-T6 §6.1.2 share card. Renders 1080×1080 (Instagram square) and is
/// rasterized via [RepaintBoundary.toImage] for the native share sheet.
///
/// Contract: no identifying user data (no name / email / avatar). Brand
/// + session stats only.
class ShareCard extends StatelessWidget {
  final String focusDisplayName;
  final int totalSeconds;
  final int phasesCount;
  final int dailyStreakDays;
  final int weeklyCount;

  const ShareCard({
    super.key,
    required this.focusDisplayName,
    required this.totalSeconds,
    required this.phasesCount,
    required this.dailyStreakDays,
    required this.weeklyCount,
  });

  String _fmtMinSec(int s) {
    final m = s ~/ 60;
    final sec = s % 60;
    if (m == 0) return '${sec}s';
    if (sec == 0) return '${m}m';
    return '${m}m ${sec}s';
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 1080,
      height: 1080,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0A1628), Color(0xFF1B3556)],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(72, 72, 72, 72),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Brand strip.
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.gold.withValues(alpha: 0.22),
                      border: Border.all(
                          color: AppColors.gold.withValues(alpha: 0.5),
                          width: 2),
                    ),
                    child: const Icon(LucideIcons.flame,
                        size: 24, color: AppColors.gold),
                  ),
                  const SizedBox(width: 16),
                  const Text(
                    'DailyForge',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              const Text(
                'SESSION COMPLETE',
                style: TextStyle(
                  color: AppColors.hintText,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 4,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                focusDisplayName,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 112,
                  fontWeight: FontWeight.w800,
                  height: 1.05,
                  letterSpacing: -1.5,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                _fmtMinSec(totalSeconds),
                style: const TextStyle(
                  color: AppColors.gold,
                  fontSize: 64,
                  fontWeight: FontWeight.w300,
                  fontFamily: 'RobotoMono',
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              // Stat strip.
              Row(
                children: [
                  _stat(
                    LucideIcons.flame,
                    dailyStreakDays > 0 ? '$dailyStreakDays day' : '—',
                    'streak',
                  ),
                  const SizedBox(width: 32),
                  _stat(
                    LucideIcons.layers,
                    '$phasesCount',
                    phasesCount == 1 ? 'phase' : 'phases',
                  ),
                  const SizedBox(width: 32),
                  _stat(
                    LucideIcons.calendar,
                    '$weeklyCount',
                    weeklyCount == 1 ? 'this week' : 'this week',
                  ),
                  const Spacer(),
                  const Text(
                    'via DailyForge',
                    style: TextStyle(
                      color: AppColors.hintText,
                      fontSize: 18,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stat(IconData icon, String value, String label) {
    return Row(
      children: [
        Icon(icon, color: AppColors.gold, size: 28),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

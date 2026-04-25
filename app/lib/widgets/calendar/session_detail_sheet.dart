import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';

class SessionDetailSheet extends StatelessWidget {
  final DateTime date;
  final List<Map<String, dynamic>> sessions;

  const SessionDetailSheet({
    super.key,
    required this.date,
    required this.sessions,
  });

  static const _typeConfig = {
    'strength': {
      'icon': LucideIcons.dumbbell,
      'color': Color(0xFFF59E0B),
      'label': 'Strength',
    },
    'yoga': {
      'icon': LucideIcons.flower2,
      'color': Color(0xFF14B8A6),
      'label': 'Yoga',
    },
    'breathwork': {
      'icon': LucideIcons.wind,
      'color': Color(0xFF3B82F6),
      'label': 'Breathwork',
    },
    '5phase': {
      'icon': LucideIcons.layers,
      'color': Color(0xFFD85A30),
      'label': 'Full Session',
    },
  };

  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    if (minutes < 60) return '${minutes}m';
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    return mins > 0 ? '${hours}h ${mins}m' : '${hours}h';
  }

  String _formatDate(DateTime date) {
    const weekdays = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday',
      'Friday', 'Saturday', 'Sunday',
    ];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${weekdays[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}';
  }

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.of(context).size.height * 0.7;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      padding: const EdgeInsets.only(top: 20, left: 20, right: 20),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius:
            const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.secondaryText.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Date header
          Text(
            _formatDate(date),
            style: const TextStyle(
              color: AppColors.primaryText,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${sessions.length} ${sessions.length == 1 ? 'session' : 'sessions'}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 16),

          // Scrollable session cards
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              padding: const EdgeInsets.only(bottom: 20),
              itemCount: sessions.length,
              itemBuilder: (context, index) =>
                  _buildSessionCard(sessions[index]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionCard(Map<String, dynamic> session) {
    final type = session['type'] as String? ?? 'strength';
    final config = _typeConfig[type] ?? _typeConfig['strength']!;
    final duration = session['duration'] as int? ?? 0;
    final exerciseCount = session['exercise_count'] as int? ?? 0;
    final prCount = session['pr_count'] as int? ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          // Type icon
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: (config['color'] as Color).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              config['icon'] as IconData,
              color: config['color'] as Color,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),

          // Session info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  config['label'] as String,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(LucideIcons.clock,
                        size: 12, color: AppColors.secondaryText),
                    const SizedBox(width: 4),
                    Text(
                      _formatDuration(duration),
                      style: const TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 13,
                      ),
                    ),
                    if (exerciseCount > 0) ...[
                      const SizedBox(width: 12),
                      const Icon(LucideIcons.list,
                          size: 12, color: AppColors.secondaryText),
                      const SizedBox(width: 4),
                      Text(
                        '$exerciseCount exercises',
                        style: const TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // PR badge
          if (prCount > 0)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('\u{1F3C6}',
                      style: TextStyle(fontSize: 12)),
                  const SizedBox(width: 4),
                  Text(
                    '$prCount PR${prCount > 1 ? 's' : ''}',
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

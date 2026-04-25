import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/yoga_models.dart';

const _typeLabels = {
  'vinyasa': 'Vinyasa',
  'hatha': 'Hatha',
  'yin': 'Yin',
  'restorative': 'Restore',
  'sun_salutation': 'Sun',
};

class RecentSessions extends StatelessWidget {
  final List<RecentYogaSession> sessions;
  final ValueChanged<RecentYogaSession> onLoad;

  const RecentSessions({
    super.key,
    required this.sessions,
    required this.onLoad,
  });

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    if (diff < 7) return '${diff}d ago';
    return '${date.month}/${date.day}';
  }

  @override
  Widget build(BuildContext context) {
    if (sessions.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            'RECENT',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.35),
              letterSpacing: 0.6,
            ),
          ),
        ),
        Row(
          children: sessions.map((sess) {
            final focusLabel = sess.focus.isNotEmpty
                ? ' \u00B7 ${sess.focus.map((f) => capitalize(f)).join(', ')}'
                : '';
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  right: sess == sessions.last ? 0 : 8,
                ),
                child: GestureDetector(
                  onTap: () => onLoad(sess),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.02),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.06),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${sess.duration}m ${_typeLabels[sess.type] ?? sess.type}$focusLabel',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.7),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _formatDate(sess.createdAt),
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.white.withValues(alpha: 0.35),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../../config/theme.dart';
import '../../../providers/strength_provider.dart';
import '../../../widgets/glass_card.dart';

class RoutineCard extends StatelessWidget {
  final Map<String, dynamic> routine;

  const RoutineCard({super.key, required this.routine});

  String _timeAgo(String dateString) {
    final date = DateTime.tryParse(dateString);
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inDays > 30) return '${(diff.inDays / 30).floor()}mo ago';
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    return 'just now';
  }

  @override
  Widget build(BuildContext context) {
    final id = routine['id'];
    final name = routine['name'] as String? ?? '';
    final exerciseCount = routine['exercise_count'] ?? 0;
    final dateString = routine['updated_at'] as String? ?? DateTime.now().toIso8601String();

    return Container(
      width: 240,
      margin: const EdgeInsets.only(right: 12),
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        onTap: () => context.push('/workout/empty?routineId=$id'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  '$exerciseCount exercises • ${_timeAgo(dateString)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  icon: const Icon(LucideIcons.trash2, size: 20, color: AppColors.error),
                  onPressed: () => _showDeleteDialog(context, id, name),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.play, size: 16, color: Colors.white),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteDialog(BuildContext context, int id, String name) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(
          'Delete Routine?',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        content: Text(
          'Delete "$name"? This cannot be undone.',
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: AppColors.secondaryText,
              ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.secondaryText,
                  ),
            ),
          ),
          TextButton(
            onPressed: () {
              ctx.read<StrengthProvider>().deleteRoutine(id);
              Navigator.pop(ctx);
            },
            child: Text(
              'Delete',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.error,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

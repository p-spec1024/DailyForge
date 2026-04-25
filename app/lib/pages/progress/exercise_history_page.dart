import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../providers/progress_provider.dart';

class ExerciseHistoryPage extends StatefulWidget {
  const ExerciseHistoryPage({super.key});

  @override
  State<ExerciseHistoryPage> createState() => _ExerciseHistoryPageState();
}

class _ExerciseHistoryPageState extends State<ExerciseHistoryPage> {
  final Map<String, bool> _expanded = {
    'strength': false,
    'yoga': false,
    'breathwork': false,
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProgressProvider>().fetchExercises();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: AppColors.primaryText),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Exercise History',
          style: TextStyle(
            color: AppColors.primaryText,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Consumer<ProgressProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            );
          }

          if (provider.exercisesError != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.alertCircle,
                      color: Colors.red.shade400, size: 48),
                  const SizedBox(height: 16),
                  Text(
                    'Failed to load exercises',
                    style: TextStyle(color: Colors.red.shade400),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchExercises(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final hasAny = provider.strengthExercises.isNotEmpty ||
              provider.yogaExercises.isNotEmpty ||
              provider.breathworkExercises.isNotEmpty;

          if (!hasAny) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.barChart3,
                      color: AppColors.hintText, size: 64),
                  const SizedBox(height: 16),
                  const Text(
                    'No exercise history yet',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Complete some workouts to see your progress',
                    style: TextStyle(color: AppColors.hintText),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchExercises(),
            color: AppColors.gold,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildPillarSection(
                  'Strength',
                  LucideIcons.dumbbell,
                  provider.strengthExercises,
                  'strength',
                  AppColors.strength,
                ),
                const SizedBox(height: 12),
                _buildPillarSection(
                  'Yoga',
                  LucideIcons.flower2,
                  provider.yogaExercises,
                  'yoga',
                  AppColors.yoga,
                ),
                const SizedBox(height: 12),
                _buildPillarSection(
                  'Breathwork',
                  LucideIcons.wind,
                  provider.breathworkExercises,
                  'breathwork',
                  AppColors.breathwork,
                ),
                const SizedBox(height: 100),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildPillarSection(
    String title,
    IconData icon,
    List<Map<String, dynamic>> exercises,
    String type,
    Color color,
  ) {
    final isExpanded = _expanded[type] ?? false;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              setState(() {
                _expanded[type] = !isExpanded;
              });
            },
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: color, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${exercises.length} exercise${exercises.length == 1 ? '' : 's'}',
                          style: const TextStyle(
                            color: AppColors.hintText,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      isExpanded
                          ? LucideIcons.chevronUp
                          : LucideIcons.chevronDown,
                      color: color,
                      size: 18,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded && exercises.isNotEmpty)
            Column(
              children: [
                Divider(height: 1, color: AppColors.cardBorder),
                ...exercises
                    .map((exercise) => _buildExerciseRow(exercise, type, color)),
              ],
            ),
          if (isExpanded && exercises.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'No $title exercises logged yet',
                style: const TextStyle(color: AppColors.hintText),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildExerciseRow(
      Map<String, dynamic> exercise, String type, Color color) {
    final name = exercise['name'] as String? ?? 'Unknown';
    final totalSessions = exercise['total_sessions'] as int? ?? 0;
    final hasPr = exercise['has_pr'] == true;

    String bestMetric = '';
    if (type == 'strength') {
      final bestWeight = exercise['best_weight'];
      if (bestWeight != null) bestMetric = '${bestWeight}kg';
    } else {
      final bestHold = exercise['best_hold_seconds'];
      if (bestHold != null) bestMetric = '${bestHold}s';
    }

    String lastSession = '';
    final lastDate = exercise['last_session'] as String?;
    if (lastDate != null) lastSession = _formatDate(lastDate);

    return InkWell(
      onTap: () {
        final exerciseId = exercise['exercise_id'];
        if (exerciseId != null) {
          context.push('/exercise-progress/$exerciseId?type=$type');
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          name,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (hasPr) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.gold.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'PR',
                            style: TextStyle(
                              color: AppColors.gold,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (bestMetric.isNotEmpty) ...[
                        Text(
                          bestMetric,
                          style: TextStyle(
                            color: color,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Text(
                        '$totalSessions session${totalSessions == 1 ? '' : 's'}',
                        style: const TextStyle(
                          color: AppColors.hintText,
                          fontSize: 13,
                        ),
                      ),
                      if (lastSession.isNotEmpty) ...[
                        const Text(' · ',
                            style: TextStyle(color: AppColors.hintText)),
                        Text(
                          lastSession,
                          style: const TextStyle(
                            color: AppColors.hintText,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight,
                color: AppColors.hintText, size: 18),
          ],
        ),
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final diff = now.difference(date).inDays;

      if (diff < 0) return 'Upcoming';
      if (diff == 0) return 'Today';
      if (diff == 1) return 'Yesterday';
      if (diff < 7) return '${diff}d ago';
      if (diff < 30) return '${(diff / 7).floor()}w ago';
      return '${(diff / 30).floor()}mo ago';
    } catch (_) {
      return '';
    }
  }
}

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/workout/save_routine_sheet.dart';

class SessionSummaryPage extends StatefulWidget {
  final int durationSeconds;
  final num totalVolume;
  final int totalSets;
  final int exercisesCompleted;
  final List<Map<String, dynamic>> prs;
  final List<Map<String, dynamic>> exercises;
  final VoidCallback onDone;

  const SessionSummaryPage({
    super.key,
    required this.durationSeconds,
    required this.totalVolume,
    required this.totalSets,
    required this.exercisesCompleted,
    required this.prs,
    required this.onDone,
    this.exercises = const [],
  });

  @override
  State<SessionSummaryPage> createState() => _SessionSummaryPageState();
}

class _SessionSummaryPageState extends State<SessionSummaryPage> {
  bool _routineSaved = false;
  bool _savePending = false;

  Future<void> _handleSaveRoutine() async {
    if (_savePending || _routineSaved) return;
    setState(() => _savePending = true);
    await SaveRoutineSheet.show(
      context,
      exercises: widget.exercises,
      onSaved: (_) {
        if (!mounted) return;
        setState(() => _routineSaved = true);
      },
    );
    if (!mounted) return;
    setState(() => _savePending = false);
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    final mm = m.toString().padLeft(2, '0');
    final ss = s.toString().padLeft(2, '0');
    return h > 0 ? '$h:$mm:$ss' : '$mm:$ss';
  }

  String _prLabel(String type) {
    switch (type) {
      case 'weight':
        return 'Weight PR';
      case 'volume':
        return 'Volume PR';
      case 'reps':
        return 'Reps PR';
      default:
        return 'PR';
    }
  }

  String _formatPrValue(Map<String, dynamic> pr) {
    final type = pr['type'] as String? ?? '';
    final value = pr['value'];
    if (value == null) return '';
    if (type == 'weight') {
      final n = (value as num);
      return '${n % 1 == 0 ? n.toInt() : n}kg';
    }
    if (type == 'reps') return '${(value as num).toInt()} reps';
    if (type == 'volume') return '${(value as num).toInt()}kg total';
    return value.toString();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onDone();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 16),
                      const Center(
                        child: Text('🎉', style: TextStyle(fontSize: 56)),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'WORKOUT COMPLETE',
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              fontSize: 22,
                              letterSpacing: 2,
                              color: AppColors.gold,
                            ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: _StatCard(
                              value: _formatDuration(widget.durationSeconds),
                              label: 'Duration',
                              icon: LucideIcons.clock,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _StatCard(
                              value:
                                  '${widget.totalVolume.toStringAsFixed(0)}kg',
                              label: 'Volume',
                              icon: LucideIcons.dumbbell,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _StatCard(
                              value: '${widget.totalSets}',
                              label: 'Sets',
                              icon: LucideIcons.checkCircle,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _StatCard(
                              value: '${widget.exercisesCompleted}',
                              label: 'Exercises',
                              icon: LucideIcons.list,
                            ),
                          ),
                        ],
                      ),
                      if (widget.prs.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        GlassCard(
                          borderColor: AppColors.gold,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Text('🏆',
                                      style: TextStyle(fontSize: 22)),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Personal Records',
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelLarge
                                        ?.copyWith(
                                          fontSize: 16,
                                          color: AppColors.gold,
                                        ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              ...widget.prs.map((pr) => Padding(
                                    padding:
                                        const EdgeInsets.only(bottom: 6),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            pr['exercise_name']
                                                    as String? ??
                                                'Exercise',
                                            style: const TextStyle(
                                              color: AppColors.primaryText,
                                              fontSize: 14,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          '${_prLabel(pr['type'] as String? ?? '')} • ${_formatPrValue(pr)}',
                                          style: const TextStyle(
                                            color: AppColors.gold,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  )),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: widget.onDone,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.strength,
                      foregroundColor: Colors.white,
                      padding:
                          const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Done',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
              if (widget.exercises.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: (_routineSaved || _savePending)
                          ? null
                          : _handleSaveRoutine,
                      icon: Icon(
                        _routineSaved
                            ? LucideIcons.check
                            : LucideIcons.clipboardList,
                        size: 18,
                      ),
                      label: Text(
                        _routineSaved ? 'Routine Saved' : 'Save as Routine',
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _routineSaved
                            ? AppColors.success
                            : AppColors.gold,
                        side: BorderSide(
                          color: _routineSaved
                              ? AppColors.success
                              : AppColors.gold,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;

  const _StatCard({
    required this.value,
    required this.label,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
      child: Column(
        children: [
          Icon(icon, size: 18, color: AppColors.secondaryText),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontSize: 20,
                  fontFamily: 'RobotoMono',
                ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

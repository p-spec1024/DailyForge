import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/workout_session_provider.dart';

class ExerciseSwapSheet extends StatefulWidget {
  final int exerciseId;
  final String currentExerciseName;
  final void Function(Map<String, dynamic> newExercise) onSwap;

  const ExerciseSwapSheet({
    super.key,
    required this.exerciseId,
    required this.currentExerciseName,
    required this.onSwap,
  });

  static Future<void> show(
    BuildContext context, {
    required int exerciseId,
    required String currentExerciseName,
    required void Function(Map<String, dynamic> newExercise) onSwap,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ExerciseSwapSheet(
        exerciseId: exerciseId,
        currentExerciseName: currentExerciseName,
        onSwap: onSwap,
      ),
    );
  }

  @override
  State<ExerciseSwapSheet> createState() => _ExerciseSwapSheetState();
}

class _ExerciseSwapSheetState extends State<ExerciseSwapSheet> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _defaultExercise;
  List<Map<String, dynamic>> _alternatives = const [];
  int? _userPreferenceId;
  bool _saveAsPreference = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final session = context.read<WorkoutSessionProvider>();
    final response = await session.fetchAlternatives(widget.exerciseId);
    if (!mounted) return;
    if (response == null) {
      setState(() {
        _loading = false;
        _error = 'Could not load alternatives.';
      });
      return;
    }
    final alts = (response['alternatives'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        const <Map<String, dynamic>>[];
    final pref = response['user_preference'];
    setState(() {
      _loading = false;
      _defaultExercise = response['default_exercise'] as Map<String, dynamic>?;
      _alternatives = alts;
      _userPreferenceId = pref is Map
          ? (pref['id'] as num?)?.toInt()
          : (pref as num?)?.toInt();
    });
  }

  Future<void> _handleSelect(Map<String, dynamic> alt) async {
    final session = context.read<WorkoutSessionProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final chosenId = (alt['id'] as num).toInt();
    bool prefSaveFailed = false;
    if (_saveAsPreference) {
      final ok =
          await session.saveExercisePreference(widget.exerciseId, chosenId);
      prefSaveFailed = !ok;
    }
    if (!mounted) return;
    widget.onSwap(alt);
    Navigator.of(context).pop();
    if (prefSaveFailed) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Could not save preference. Exercise swapped.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.only(bottom: bottomInset),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.cardBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    const Icon(LucideIcons.repeat,
                        size: 18, color: AppColors.strength),
                    const SizedBox(width: 8),
                    Text(
                      'Swap Exercise',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontSize: 18,
                              ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(child: _buildBody(scrollController)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBody(ScrollController controller) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.strength),
      );
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _error!,
            style: const TextStyle(color: AppColors.secondaryText),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        _CurrentExerciseCard(
          name: (_defaultExercise?['name'] as String?) ??
              widget.currentExerciseName,
          muscles: _defaultExercise?['target_muscles'] as String?,
          difficulty: _defaultExercise?['difficulty'] as String?,
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Alternatives',
                style: Theme.of(context).textTheme.labelLarge,
              ),
            ),
            Checkbox(
              value: _saveAsPreference,
              onChanged: (v) =>
                  setState(() => _saveAsPreference = v ?? false),
              side: const BorderSide(color: AppColors.secondaryText),
              activeColor: AppColors.strength,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
            ),
            const Text(
              'Save as preference',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.secondaryText,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_alternatives.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'No alternatives available for this exercise.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ..._alternatives.map((alt) => _AlternativeTile(
                exercise: alt,
                isPreferred: _userPreferenceId != null &&
                    (alt['id'] as num).toInt() == _userPreferenceId,
                onTap: () => _handleSelect(alt),
              )),
      ],
    );
  }
}

class _CurrentExerciseCard extends StatelessWidget {
  final String name;
  final String? muscles;
  final String? difficulty;

  const _CurrentExerciseCard({
    required this.name,
    this.muscles,
    this.difficulty,
  });

  @override
  Widget build(BuildContext context) {
    final muscleList = (muscles ?? '')
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    final diff = difficulty ?? '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.strength.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.strength.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CURRENT',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.strength,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              if (diff.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.difficultyColor(diff)
                        .withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    capitalize(diff),
                    style: TextStyle(
                      color: AppColors.difficultyColor(diff),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
          if (muscleList.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: muscleList
                  .map((m) => _MuscleChip(label: capitalize(m)))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _AlternativeTile extends StatelessWidget {
  final Map<String, dynamic> exercise;
  final bool isPreferred;
  final VoidCallback onTap;

  const _AlternativeTile({
    required this.exercise,
    required this.isPreferred,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = exercise['name'] as String? ?? '';
    final difficulty = exercise['difficulty'] as String? ?? '';
    final muscles = (exercise['target_muscles']?.toString() ?? '')
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.cardBackground,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isPreferred
                  ? AppColors.gold.withValues(alpha: 0.6)
                  : AppColors.cardBorder,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style:
                          Theme.of(context).textTheme.bodyLarge?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                    ),
                  ),
                  if (difficulty.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.difficultyColor(difficulty)
                            .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        capitalize(difficulty),
                        style: TextStyle(
                          color: AppColors.difficultyColor(difficulty),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
              if (isPreferred) ...[
                const SizedBox(height: 4),
                const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.star, size: 11, color: AppColors.gold),
                    SizedBox(width: 4),
                    Text(
                      'Currently saved preference',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.gold,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
              if (muscles.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: muscles
                      .map((m) => _MuscleChip(label: capitalize(m)))
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MuscleChip extends StatelessWidget {
  final String label;
  const _MuscleChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.strength.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          color: AppColors.strength,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../providers/workout_session_provider.dart';
import '../glass_card.dart';
import 'pr_badge.dart';
import 'set_row.dart';

class ExerciseSessionCard extends StatelessWidget {
  final Map<String, dynamic> exercise;
  final List<SetData> sets;
  final PreviousData? previousData;
  final Map<String, bool>? prs;
  final void Function(int setNumber, double weight, int reps) onLogSet;
  final VoidCallback onAddSet;
  final VoidCallback? onSwap;

  const ExerciseSessionCard({
    super.key,
    required this.exercise,
    required this.sets,
    this.previousData,
    this.prs,
    required this.onLogSet,
    required this.onAddSet,
    this.onSwap,
  });

  @override
  Widget build(BuildContext context) {
    final name = exercise['name'] as String? ?? '';
    final muscles = exercise['target_muscles'] as String? ?? '';
    final muscleList =
        muscles.isNotEmpty ? muscles.split(',').map((s) => s.trim()).toList() : <String>[];

    final hasPr = prs != null &&
        (prs!['weight'] == true ||
            prs!['volume'] == true ||
            prs!['reps'] == true);
    // ignore: avoid_print
    print('Exercise ${exercise['id']} hasPr: $hasPr prs: $prs');

    final card = GlassCard(
      borderColor: hasPr ? AppColors.gold : AppColors.strength,
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Exercise name + swap icon
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontSize: 16,
                      ),
                ),
              ),
              if (onSwap != null)
                InkWell(
                  onTap: onSwap,
                  borderRadius: BorderRadius.circular(6),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(
                      LucideIcons.repeat,
                      size: 16,
                      color: AppColors.secondaryText,
                    ),
                  ),
                ),
            ],
          ),
          if (hasPr) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                if (prs!['weight'] == true)
                  const PrBadge(type: 'weight'),
                if (prs!['volume'] == true)
                  const PrBadge(type: 'volume'),
                if (prs!['reps'] == true) const PrBadge(type: 'reps'),
              ],
            ),
          ],
          if (muscleList.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: muscleList
                  .map((m) => Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.strength.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          capitalize(m),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.strength,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          // Column headers
          const Padding(
            padding: EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                SizedBox(
                  width: 32,
                  child: Text('SET',
                      textAlign: TextAlign.center,
                      style: _headerStyle),
                ),
                SizedBox(
                  width: 72,
                  child: Text('PREVIOUS',
                      textAlign: TextAlign.center,
                      style: _headerStyle),
                ),
                SizedBox(width: 4),
                SizedBox(
                  width: 64,
                  child: Text('KG',
                      textAlign: TextAlign.center,
                      style: _headerStyle),
                ),
                SizedBox(width: 8),
                SizedBox(
                  width: 52,
                  child: Text('REPS',
                      textAlign: TextAlign.center,
                      style: _headerStyle),
                ),
                SizedBox(width: 8),
                SizedBox(width: 36), // checkmark column
              ],
            ),
          ),
          // Set rows
          ...sets.asMap().entries.map((entry) {
            final i = entry.key;
            final setData = entry.value;
            // A set is locked if any previous set is not completed
            final locked = i > 0 &&
                sets.sublist(0, i).any((s) => !s.completed);
            return SetRow(
              setNumber: setData.setNumber,
              setData: setData,
              previousData: previousData,
              locked: locked,
              onComplete: (weight, reps) {
                onLogSet(setData.setNumber, weight, reps);
              },
            );
          }),
          const SizedBox(height: 8),
          // Add Set button
          GestureDetector(
            onTap: onAddSet,
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.plus,
                    size: 16, color: AppColors.secondaryText),
                SizedBox(width: 4),
                Text(
                  'Add Set',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.secondaryText,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (!hasPr) return card;

    // Gold glow wrapper when a PR is detected on this exercise.
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.gold.withValues(alpha: 0.25),
            blurRadius: 16,
            spreadRadius: 1,
          ),
        ],
      ),
      child: card,
    );
  }

  static const TextStyle _headerStyle = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w600,
    color: AppColors.hintText,
    letterSpacing: 1,
  );
}

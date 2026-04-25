import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../models/body_map.dart';
import '_tokens.dart';
import 'body_map_3d.dart' show BodyMapMode;

class SelectedMuscleCard extends StatelessWidget {
  final BodyMapMode mode;
  final String? selectedGroup;
  final Map<String, int> flexibilityScores;
  final Map<String, MuscleDetail> muscleDetails;

  const SelectedMuscleCard({
    super.key,
    required this.mode,
    required this.selectedGroup,
    required this.flexibilityScores,
    required this.muscleDetails,
  });

  @override
  Widget build(BuildContext context) {
    if (selectedGroup == null) return _placeholder();
    return mode == BodyMapMode.muscles ? _muscleBody() : _flexBody();
  }

  Widget _placeholder() {
    return Container(
      height: 80,
      decoration: kCardDecoration(),
      alignment: Alignment.center,
      child: const Text(
        'Tap a muscle to see details',
        style: TextStyle(fontSize: 14, color: kSecondaryText),
      ),
    );
  }

  Widget _muscleBody() {
    // Backend always emits all 11 keys; fall back to zero-state defensively
    // for a stale/legacy response where details is empty.
    final detail = muscleDetails[selectedGroup] ?? MuscleDetail.zero;

    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            selectedGroup!,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w600,
              color: kDeepCoral,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(LucideIcons.clock, size: 14, color: kSecondaryText),
              const SizedBox(width: 6),
              Text(
                'Last trained · ${detail.lastTrained}',
                style: const TextStyle(fontSize: 14, color: kSecondaryText),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _pill('Volume', detail.volumeLabel),
              _pill('Sets this week', '${detail.setsThisWeek}'),
              _pill('Top exercise', detail.topExercise),
            ],
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: null,
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              foregroundColor: kCoral,
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'View history',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: kCoral,
                  ),
                ),
                SizedBox(width: 4),
                Icon(LucideIcons.chevronRight, size: 16, color: kCoral),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _flexBody() {
    final score = flexibilityScores[selectedGroup] ?? 0;
    final label =
        score < 50 ? 'Needs work' : (score < 75 ? 'Moderate' : 'Good');

    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            selectedGroup!,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w600,
              color: kDeepCoral,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Mobility: $score%',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: kPrimaryText,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 14, color: kSecondaryText),
          ),
        ],
      ),
    );
  }

  Widget _pill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kCardBorder),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: kSecondaryText),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: kPrimaryText,
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/onboarding_provider.dart';
import '../../widgets/onboarding_level_chip.dart';

/// Step 2 of 3 — capture the user's self-declared yoga level.
///
/// Reachable only via context.push from the strength page (back navigation
/// returns to step 1, retaining the strength selection). Copy is yoga-
/// specific — practice durations and pose familiarity, not lifting cues.
class LevelCaptureYogaPage extends StatelessWidget {
  const LevelCaptureYogaPage({super.key});

  static const _options = [
    (
      level: 'beginner',
      label: 'Beginner',
      description: 'New to yoga, learning the basic poses and breath.',
    ),
    (
      level: 'intermediate',
      label: 'Intermediate',
      description: 'Months of regular practice, comfortable in flow sequences.',
    ),
    (
      level: 'advanced',
      label: 'Advanced',
      description: 'Years of practice, exploring deeper postures and pranayama.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final onboarding = context.watch<OnboardingProvider>();
    final selected = onboarding.yogaLevel;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Step 2 of 3'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'How would you describe your yoga experience?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Picks pose difficulty and flow length.',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.secondaryText,
                ),
              ),
              const SizedBox(height: 32),
              for (final opt in _options) ...[
                OnboardingLevelChip(
                  label: opt.label,
                  description: opt.description,
                  selected: selected == opt.level,
                  onTap: () => context
                      .read<OnboardingProvider>()
                      .setYogaLevel(opt.level),
                  accentColor: AppColors.yoga,
                ),
                const SizedBox(height: 12),
              ],
              const Spacer(),
              ElevatedButton(
                onPressed: selected == null
                    ? null
                    : () => context.push('/onboarding/level-capture/breathwork'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.black,
                  disabledBackgroundColor: AppColors.surface,
                  disabledForegroundColor: AppColors.hintText,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Continue',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

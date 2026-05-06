import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/onboarding_provider.dart';
import '../../widgets/onboarding_level_chip.dart';

/// Step 1 of 3 — capture the user's self-declared strength level.
///
/// First screen of the onboarding stub (S13-T1). No back button — the user
/// arrives here from the home-page gate (S13-T4) when their pillar_levels
/// row count is zero. Selections live in OnboardingProvider so back-navigation
/// from screen 2 retains the choice.
class LevelCaptureStrengthPage extends StatelessWidget {
  const LevelCaptureStrengthPage({super.key});

  static const _options = [
    (
      level: 'beginner',
      label: 'Beginner',
      description: 'New to lifting or returning after a long break.',
    ),
    (
      level: 'intermediate',
      label: 'Intermediate',
      description: 'Consistent training for 6+ months, comfortable with main lifts.',
    ),
    (
      level: 'advanced',
      label: 'Advanced',
      description: 'Years of consistent training, good understanding of programming.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final onboarding = context.watch<OnboardingProvider>();
    final selected = onboarding.strengthLevel;

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Step 1 of 3'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'How would you describe your strength training experience?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                "We'll size your sessions to match.",
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
                      .setStrengthLevel(opt.level),
                  accentColor: AppColors.strength,
                ),
                const SizedBox(height: 12),
              ],
              const Spacer(),
              ElevatedButton(
                onPressed: selected == null
                    ? null
                    : () => context.push('/onboarding/level-capture/yoga'),
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

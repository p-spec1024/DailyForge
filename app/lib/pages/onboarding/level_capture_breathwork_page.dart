import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/onboarding_provider.dart';
import '../../widgets/onboarding_level_chip.dart';

/// Step 3 of 3 — capture the user's self-declared breathwork level, then
/// POST all three levels in one transaction and navigate to home.
///
/// On POST failure: surface a snackbar with a Retry action and stay on this
/// page so the user's three selections aren't lost (Decision 4 in the spec).
class LevelCaptureBreathworkPage extends StatelessWidget {
  const LevelCaptureBreathworkPage({super.key});

  static const _options = [
    (
      level: 'beginner',
      label: 'Beginner',
      description: 'New to pranayama and breath techniques.',
    ),
    (
      level: 'intermediate',
      label: 'Intermediate',
      description: 'Comfortable with basic patterns like box breathing and bhramari.',
    ),
    (
      level: 'advanced',
      label: 'Advanced',
      description: 'Familiar with advanced techniques and longer sessions.',
    ),
  ];

  Future<void> _handleSubmit(BuildContext context) async {
    // Snackbar Retry can fire after the page is unmounted (snackbar lives on
    // the root ScaffoldMessenger and survives back-navigation). Guard before
    // any context.read so we don't crash on a deactivated Element.
    if (!context.mounted) return;

    final onboarding = context.read<OnboardingProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    final success = await onboarding.submit();
    if (!context.mounted) return;

    if (success) {
      onboarding.reset();
      router.go('/home');
    } else {
      messenger.hideCurrentSnackBar();
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            onboarding.error ?? "Couldn't save your levels. Try again?",
          ),
          backgroundColor: AppColors.error,
          duration: const Duration(seconds: 6),
          action: SnackBarAction(
            label: 'Retry',
            textColor: Colors.white,
            onPressed: () => _handleSubmit(context),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final onboarding = context.watch<OnboardingProvider>();
    final selected = onboarding.breathworkLevel;
    final canSubmit = selected != null && !onboarding.isSubmitting;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Step 3 of 3'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'How would you describe your breathwork experience?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Sets technique difficulty and session pace.',
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
                      .setBreathworkLevel(opt.level),
                  accentColor: AppColors.breathwork,
                ),
                const SizedBox(height: 12),
              ],
              const Spacer(),
              ElevatedButton(
                onPressed: canSubmit ? () => _handleSubmit(context) : null,
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
                child: onboarding.isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.black,
                        ),
                      )
                    : const Text(
                        'Finish setup',
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

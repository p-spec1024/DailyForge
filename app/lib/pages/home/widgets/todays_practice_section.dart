import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../../providers/home_provider.dart';
import '_tokens.dart';

/// "Today's Practice" — three equal pillar cards (Strength / Yoga / Breath)
/// plus a disabled Full Session placeholder. Replaces the single
/// today_session_card that was on the home page through T5c-a.
///
/// Durations come from `HomeProvider.pillarDurations` (median-of-last-5 with
/// static fallbacks). Tap anywhere on a pillar card to route; the Start
/// button is purely visual — the whole card is the tap target.
class TodaysPracticeSection extends StatelessWidget {
  const TodaysPracticeSection({super.key});

  @override
  Widget build(BuildContext context) {
    final durations = context.select<HomeProvider, _PillarMinutes>(
      (p) => _PillarMinutes(
        strength: p.pillarDurations.strength,
        yoga: p.pillarDurations.yoga,
        breath: p.pillarDurations.breath,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Today's Practice", style: kSectionLabel),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _PillarCard(
                icon: LucideIcons.dumbbell,
                accent: kPillarStrength,
                name: 'Strength',
                minutes: durations.strength,
                onTap: () => context.go('/strength'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PillarCard(
                icon: LucideIcons.flower2,
                accent: kPillarYoga,
                name: 'Yoga',
                minutes: durations.yoga,
                onTap: () => context.go('/yoga'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PillarCard(
                icon: LucideIcons.wind,
                accent: kPillarBreath,
                name: 'Breathwork',
                minutes: durations.breath,
                onTap: () => context.go('/breathwork'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const _OrDivider(),
        const SizedBox(height: 16),
        _FullSessionCard(totalMinutes: durations.total),
      ],
    );
  }
}

class _PillarMinutes {
  final int strength;
  final int yoga;
  final int breath;
  const _PillarMinutes({
    required this.strength,
    required this.yoga,
    required this.breath,
  });
  int get total => strength + yoga + breath;

  @override
  bool operator ==(Object other) =>
      other is _PillarMinutes &&
      other.strength == strength &&
      other.yoga == yoga &&
      other.breath == breath;

  @override
  int get hashCode => Object.hash(strength, yoga, breath);
}

class _PillarCard extends StatelessWidget {
  final IconData icon;
  final Color accent;
  final String name;
  final int minutes;
  final VoidCallback onTap;

  const _PillarCard({
    required this.icon,
    required this.accent,
    required this.name,
    required this.minutes,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(kCardRadius),
      child: Container(
        decoration: kCardDecoration(),
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: accent, size: 22),
            ),
            const SizedBox(height: 12),
            Text(
              name,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: kPrimaryText,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              '$minutes min',
              style: const TextStyle(fontSize: 12, color: kSecondaryText),
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              height: 32,
              decoration: BoxDecoration(
                color: kCoral,
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: const Text(
                'Start',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: kCardBorder, height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'or',
            style: TextStyle(
              fontSize: 12,
              color: kSecondaryText.withValues(alpha: 0.8),
              fontStyle: FontStyle.italic,
            ),
          ),
        ),
        const Expanded(child: Divider(color: kCardBorder, height: 1)),
      ],
    );
  }
}

class _FullSessionCard extends StatelessWidget {
  final int totalMinutes;
  const _FullSessionCard({required this.totalMinutes});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: kCoral.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.zap, color: kCoral, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Full Session',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: kPrimaryText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'All three combined · $totalMinutes min',
                  style: const TextStyle(
                    fontSize: 12,
                    color: kSecondaryText,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFEAEAEA),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              'Available in Sprint 11',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: kSecondaryText,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

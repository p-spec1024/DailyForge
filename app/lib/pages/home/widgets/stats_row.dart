import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../../providers/home_provider.dart';
import '_tokens.dart';

/// Streak / minutes / year-count mini-cards. Reads directly from
/// [HomeProvider] with three separate `context.select` calls so that a
/// change in one field doesn't rebuild the other two.
class StatsRow extends StatelessWidget {
  const StatsRow({super.key});

  @override
  Widget build(BuildContext context) {
    final stats = context.select<HomeProvider, HomeProvider>((p) => p);
    final error = stats.statsError;
    final loading = stats.stats == null && stats.loading;

    if (loading) return const _StatsSkeleton();

    if (stats.stats == null && error != null) {
      return _StatsErrorRow(onRetry: () => stats.refresh());
    }

    final s = stats.stats;
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            icon: LucideIcons.flame,
            value: '${s?.streakDays ?? 0}',
            label: 'day streak',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatCard(
            icon: LucideIcons.clock,
            value: '${s?.minutesThisWeek ?? 0}',
            label: 'min this week',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatCard(
            icon: LucideIcons.calendar,
            value: '${s?.sessionsThisYear ?? 0}',
            label: 'sessions in 2026',
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
      child: Column(
        children: [
          Icon(icon, size: 18, color: kCoral),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w600,
              color: kPrimaryText,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: kSecondaryText),
          ),
        ],
      ),
    );
  }
}

class _StatsSkeleton extends StatelessWidget {
  const _StatsSkeleton();

  Widget _box() => Container(
        height: 96,
        decoration: kCardDecoration(),
      );

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _box()),
        const SizedBox(width: 10),
        Expanded(child: _box()),
        const SizedBox(width: 10),
        Expanded(child: _box()),
      ],
    );
  }
}

class _StatsErrorRow extends StatelessWidget {
  final VoidCallback onRetry;
  const _StatsErrorRow({required this.onRetry});

  Widget _placeholder() => Container(
        decoration: kCardDecoration(),
        padding: const EdgeInsets.symmetric(vertical: 24),
        alignment: Alignment.center,
        child: const Text(
          '—',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w600,
            color: kSecondaryText,
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _placeholder()),
        const SizedBox(width: 10),
        Expanded(child: _placeholder()),
        const SizedBox(width: 10),
        Expanded(
          child: Stack(
            children: [
              _placeholder(),
              Positioned(
                top: 4,
                right: 4,
                child: IconButton(
                  tooltip: 'Retry',
                  icon: const Icon(LucideIcons.refreshCw,
                      size: 14, color: kSecondaryText),
                  onPressed: onRetry,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 24,
                    minHeight: 24,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/suggested_session.dart';
import '../../providers/cross_pillar_session_provider.dart';
import '../../services/storage_service.dart';
import 'widgets/phase_indicator.dart';
import 'widgets/phase_preview_sheet.dart';
import 'widgets/phase_stub_view.dart';

/// Cross_pillar 5-phase orchestrator screen (S14-T2).
///
/// Reads phase state from [CrossPillarSessionProvider] (pre-seeded by
/// [SessionLauncher._launchCrossPillar]); never starts a session itself.
/// Iterates by `phases.length` so the page works for any phase count the
/// engine emits (mobility's Shape A 5-phase, biceps's degraded 4-phase, or
/// the standard 5-phase shape). T4 will swap [PhaseStubView] for real
/// embedded players without changing this page.
class FivePhaseSessionPage extends StatelessWidget {
  const FivePhaseSessionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<CrossPillarSessionProvider>(
      builder: (context, provider, _) {
        final session = provider.session;
        if (session == null) {
          // Defensive: launcher pre-seeds, so this shouldn't fire on a
          // normal entry. Bail home rather than crash if it does.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) context.go('/home');
          });
          return const SizedBox.shrink();
        }

        final currentPhase = session.phases[provider.currentPhaseIndex];

        return Scaffold(
          appBar: AppBar(
            title: Text(
              _focusTitle(session.metadata.focusSlug),
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            leading: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => _confirmDiscard(context, provider),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.format_list_numbered),
                tooltip: 'All phases',
                onPressed: () => _showPreview(context, session, provider),
              ),
            ],
          ),
          body: Column(
            children: [
              PhaseIndicator(
                phaseCount: session.phases.length,
                currentIndex: provider.currentPhaseIndex,
                statuses: provider.statuses,
              ),
              Expanded(
                child: PhaseStubView(
                  phase: currentPhase,
                  paused: provider.paused,
                ),
              ),
              _PhaseActionBar(provider: provider),
            ],
          ),
        );
      },
    );
  }

  String _focusTitle(String? slug) {
    if (slug == null || slug.isEmpty) return 'Session';
    return slug
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  Future<void> _confirmDiscard(
    BuildContext context,
    CrossPillarSessionProvider provider,
  ) async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave session?'),
        content: const Text('Your progress will be lost.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (discard != true) return;
    if (!context.mounted) return;
    final storage = context.read<StorageService>();
    await provider.discard(storage);
    if (!context.mounted) return;
    context.go('/home');
  }

  void _showPreview(
    BuildContext context,
    SuggestedSession session,
    CrossPillarSessionProvider provider,
  ) {
    showModalBottomSheet(
      context: context,
      builder: (_) => PhasePreviewSheet(
        phases: session.phases,
        currentIndex: provider.currentPhaseIndex,
        statuses: provider.statuses,
      ),
    );
  }
}

class _PhaseActionBar extends StatelessWidget {
  final CrossPillarSessionProvider provider;

  const _PhaseActionBar({required this.provider});

  @override
  Widget build(BuildContext context) {
    final storage = context.read<StorageService>();
    final isLastPhase =
        provider.currentPhaseIndex >= (provider.session!.phases.length - 1);

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            TextButton(
              onPressed: () async {
                await provider.skipCurrentPhase(storage: storage);
                if (!context.mounted) return;
                if (provider.allPhasesDone) {
                  await provider.complete(storage: storage);
                  if (!context.mounted) return;
                  _onCompletion(context);
                }
              },
              child: const Text('Skip'),
            ),
            const Spacer(),
            IconButton(
              icon: Icon(provider.paused ? Icons.play_arrow : Icons.pause),
              tooltip: provider.paused ? 'Resume' : 'Pause',
              onPressed: () async {
                if (provider.paused) {
                  await provider.resume(storage: storage);
                } else {
                  await provider.pause(storage: storage);
                }
              },
            ),
            const SizedBox(width: 12),
            ElevatedButton(
              onPressed: provider.paused
                  ? null
                  : () async {
                      await provider.completeCurrentPhase(storage: storage);
                      if (!context.mounted) return;
                      if (provider.allPhasesDone) {
                        await provider.complete(storage: storage);
                        if (!context.mounted) return;
                        _onCompletion(context);
                      }
                    },
              child: Text(isLastPhase ? 'Finish' : 'Next phase'),
            ),
          ],
        ),
      ),
    );
  }

  void _onCompletion(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Cross-pillar session completed.')),
    );
    context.go('/home');
  }
}

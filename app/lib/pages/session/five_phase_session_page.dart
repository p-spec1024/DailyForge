import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/suggested_session.dart';
import '../../players/breathwork_player.dart';
import '../../players/phase_metadata.dart';
import '../../players/phase_result.dart';
import '../../players/strength_player.dart';
import '../../players/yoga_session_player.dart';
import '../../providers/cross_pillar_session_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../utils/phase_label.dart';
import 'widgets/auto_advance_overlay.dart';
import 'widgets/phase_indicator.dart';
import 'widgets/phase_preview_sheet.dart';

/// Cross_pillar 5-phase orchestrator screen (S14-T4).
///
/// T2 shipped the orchestrator with PhaseStubView; T4 replaces that with a
/// switch on the engine's `content_type` to real embedded players, plus a
/// 3s auto-advance overlay between phases, plus the bottom-sheet close
/// confirm with three options (Save & quit / End early / Cancel).
class FivePhaseSessionPage extends StatefulWidget {
  const FivePhaseSessionPage({super.key});

  @override
  State<FivePhaseSessionPage> createState() => _FivePhaseSessionPageState();
}

class _FivePhaseSessionPageState extends State<FivePhaseSessionPage> {
  bool _showCountdown = false;
  String _nextPhaseLabel = '';

  @override
  Widget build(BuildContext context) {
    return Consumer<CrossPillarSessionProvider>(
      builder: (context, provider, _) {
        final session = provider.session;
        if (session == null) {
          // Defensive: launcher pre-seeds, so this shouldn't fire on a
          // normal entry. Bail home rather than crash.
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
              onPressed: () => _showCloseSheet(context, provider),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.format_list_numbered),
                tooltip: 'All phases',
                onPressed: () => _showPreview(context, session, provider),
              ),
            ],
          ),
          body: Stack(
            children: [
              Column(
                children: [
                  PhaseIndicator(
                    phaseCount: session.phases.length,
                    currentIndex: provider.currentPhaseIndex,
                    statuses: provider.statuses,
                  ),
                  Expanded(
                    child: _buildPhaseBody(context, currentPhase, provider),
                  ),
                  _PhaseActionBar(
                    provider: provider,
                    onSkip: () => _handleSkip(context, provider),
                  ),
                ],
              ),
              if (_showCountdown)
                AutoAdvanceOverlay(
                  nextPhaseLabel: _nextPhaseLabel,
                  onAdvance: () => _dismissCountdown(provider),
                  onPause: () => _onCountdownPause(provider),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPhaseBody(
    BuildContext context,
    SessionPhase phase,
    CrossPillarSessionProvider provider,
  ) {
    final session = provider.session!;
    final levels = session.metadata.userLevels;
    final metadata = PhaseMetadata.fromSessionPhase(
      phase,
      focusSlug: session.metadata.focusSlug,
      userLevels: levels,
      isEmbedded: true,
    );
    final phaseKey =
        ValueKey('phase-${provider.currentPhaseIndex}-${phase.phase}');
    switch (metadata.contentType) {
      case 'strength':
        return StrengthPlayer(
          key: phaseKey,
          isEmbedded: true,
          phaseMetadata: metadata,
          onPhaseComplete: (r) => _handlePhaseComplete(context, r),
        );
      case 'yoga':
        return YogaSessionPlayer(
          key: phaseKey,
          isEmbedded: true,
          phaseMetadata: metadata,
          onPhaseComplete: (r) => _handlePhaseComplete(context, r),
        );
      case 'breathwork':
        return BreathworkPlayer(
          key: phaseKey,
          isEmbedded: true,
          phaseMetadata: metadata,
          onPhaseComplete: (r) => _handlePhaseComplete(context, r),
        );
      default:
        throw StateError(
          'unknown content_type for orchestrator phase: ${metadata.contentType}',
        );
    }
  }

  Future<void> _handlePhaseComplete(
      BuildContext context, PhaseResult result) async {
    final provider = context.read<CrossPillarSessionProvider>();
    final storage = context.read<StorageService>();
    final api = context.read<ApiService>();
    await provider.completeCurrentPhase(result, storage: storage);
    if (!context.mounted) return;
    if (provider.allPhasesDone) {
      // Snapshot the count before complete() resets in-memory state.
      final completedCount = provider.phasesCompletedCount;
      await provider.complete(storage: storage, api: api);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Session complete — $completedCount phases logged.',
          ),
        ),
      );
      context.go('/home');
      return;
    }
    // Show countdown overlay for non-final phases.
    final next = provider.session!.phases[provider.currentPhaseIndex];
    setState(() {
      _showCountdown = true;
      _nextPhaseLabel = _phaseLabel(next);
    });
  }

  Future<void> _dismissCountdown(CrossPillarSessionProvider provider) async {
    setState(() {
      _showCountdown = false;
    });
  }

  Future<void> _onCountdownPause(CrossPillarSessionProvider provider) async {
    // Pause flips the orchestrator paused flag; the countdown overlay
    // already self-paused via its onPause callback. Resume happens when
    // the user dismisses the overlay via Skip wait.
    final storage = context.read<StorageService>();
    await provider.pause(storage: storage);
  }

  Future<void> _handleSkip(
    BuildContext context,
    CrossPillarSessionProvider provider,
  ) async {
    final storage = context.read<StorageService>();
    final api = context.read<ApiService>();
    await provider.skipCurrentPhase(storage: storage);
    if (!context.mounted) return;
    if (provider.allPhasesDone) {
      final completedCount = provider.phasesCompletedCount;
      await provider.complete(storage: storage, api: api);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Session complete — $completedCount phases logged.',
          ),
        ),
      );
      context.go('/home');
    }
    // Spec §8: skip suppresses the countdown — phase advances immediately,
    // the orchestrator just rebuilds with the new phase index.
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

  Future<void> _showCloseSheet(
    BuildContext context,
    CrossPillarSessionProvider provider,
  ) async {
    final storage = context.read<StorageService>();
    final api = context.read<ApiService>();
    final choice = await showModalBottomSheet<_CloseChoice>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('End session?',
                  style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => Navigator.of(ctx).pop(_CloseChoice.saveQuit),
                icon: const Icon(Icons.bookmark_outline),
                label: const Text('Save and quit (resume later)'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(ctx).pop(_CloseChoice.endEarly),
                icon: const Icon(Icons.stop_circle_outlined),
                label: const Text('End early (log progress)'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(_CloseChoice.cancel),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ),
      ),
    );
    if (!context.mounted) return;
    switch (choice) {
      case _CloseChoice.saveQuit:
        await provider.pauseAndQuit(storage: storage);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Session paused — resume from home next time.'),
          ),
        );
        context.go('/home');
        break;
      case _CloseChoice.endEarly:
        final count = provider.phasesCompletedCount;
        await provider.endEarly(storage: storage, api: api);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Session ended — $count phases logged.')),
        );
        context.go('/home');
        break;
      case _CloseChoice.cancel:
      case null:
        // Return to session as-is.
        break;
    }
  }

  String _focusTitle(String? slug) {
    if (slug == null || slug.isEmpty) return 'Session';
    return slug
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  String _phaseLabel(SessionPhase phase) => phaseDisplayLabel(
        phase.phase,
        contentType:
            phase.items.isNotEmpty ? phase.items.first.contentType : null,
      );
}

enum _CloseChoice { saveQuit, endEarly, cancel }

class _PhaseActionBar extends StatelessWidget {
  final CrossPillarSessionProvider provider;
  final VoidCallback onSkip;

  const _PhaseActionBar({required this.provider, required this.onSkip});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            TextButton(
              onPressed: onSkip,
              child: const Text('Skip phase'),
            ),
            const Spacer(),
            IconButton(
              icon: Icon(provider.paused ? Icons.play_arrow : Icons.pause),
              tooltip: provider.paused ? 'Resume' : 'Pause',
              onPressed: () async {
                final storage = context.read<StorageService>();
                if (provider.paused) {
                  await provider.resume(storage: storage);
                } else {
                  await provider.pause(storage: storage);
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

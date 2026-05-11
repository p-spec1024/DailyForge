import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../models/suggested_session.dart';
import '../../players/phase_metadata.dart';
import '../../players/phase_result.dart';
import '../../players/yoga_session_player.dart';
import '../../providers/yoga_session_provider.dart';

/// Standalone yoga session shell. Hosts [YogaSessionPlayer] for the
/// pre-seeded provider state. T4 split: chrome here, body in the player.
class YogaSessionPage extends StatelessWidget {
  const YogaSessionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack(context);
      },
      child: Scaffold(
        body: YogaSessionPlayer(
          isEmbedded: false,
          phaseMetadata: _metadataFromProvider(context),
          onPhaseComplete: (result) => _onComplete(context, result),
        ),
      ),
    );
  }

  PhaseMetadata _metadataFromProvider(BuildContext context) {
    final provider = context.read<YogaSessionProvider>();
    final original = provider.originalSession;
    return PhaseMetadata(
      focusSlug: original?.focus.isNotEmpty == true ? original!.focus.first : null,
      phase: 'main',
      contentType: 'yoga',
      durationMinutes: original?.duration,
      items: const <SessionItem>[],
      userLevels: const <String, String>{},
      isEmbedded: false,
    );
  }

  void _handleBack(BuildContext context) {
    final provider = context.read<YogaSessionProvider>();
    if (provider.isRunning || provider.isPaused) {
      // Delegate to the player's confirm-exit flow by reading current
      // running state and showing a dialog here. Mirrors pre-T4 behavior.
      _confirmExit(context, provider);
    } else {
      context.go('/yoga');
    }
  }

  Future<void> _confirmExit(
      BuildContext context, YogaSessionProvider provider) async {
    final wasRunning = provider.isRunning;
    if (wasRunning) provider.pause();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End session early?'),
        content: const Text('Your progress will not be saved.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('End Session'),
          ),
        ],
      ),
    );
    if (!context.mounted) return;
    if (confirmed == true) {
      provider.reset();
      context.go('/yoga');
    } else if (wasRunning) {
      provider.resume();
    }
  }

  void _onComplete(BuildContext context, PhaseResult result) {
    if (result.wasSkipped) {
      // User-end-early — already reset; the player won't have routed.
      context.go('/yoga');
      return;
    }
    // Natural completion — route to /yoga/complete which lets the user
    // see stats and writes the sessions row via logSession.
    context.go('/yoga/complete');
  }
}

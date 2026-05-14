import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/suggested_session.dart';
import '../../players/breathwork_player.dart';
import '../../players/phase_metadata.dart';
import '../../players/phase_result.dart';
import '../../services/wakelock_service.dart';

/// Standalone breathwork timer shell. Hosts [BreathworkPlayer] which owns
/// the technique-load, pre-start, active timer, and completion summary
/// states. T4 split: chrome stays here, body in the player.
///
/// S14-T5 AMENDMENT-1 D12: converted to StatefulWidget to acquire a
/// wakelock for the lifetime of the page (release on dispose).
class BreathworkTimerPage extends StatefulWidget {
  final int techniqueId;
  const BreathworkTimerPage({super.key, required this.techniqueId});

  @override
  State<BreathworkTimerPage> createState() => _BreathworkTimerPageState();
}

class _BreathworkTimerPageState extends State<BreathworkTimerPage> {
  @override
  void initState() {
    super.initState();
    WakelockService.enable();
  }

  @override
  void dispose() {
    WakelockService.disable();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        // Player handles its own confirm-stop dialog via the AppBar back
        // button; the system back gesture here just no-ops to keep the
        // user inside the session. T4 surfaces explicit close via the
        // player chrome rather than racing PopScope against the timer.
      },
      child: Scaffold(
        body: BreathworkPlayer(
          isEmbedded: false,
          techniqueId: widget.techniqueId,
          phaseMetadata: const PhaseMetadata(
            focusSlug: null,
            phase: 'main',
            contentType: 'breathwork',
            durationMinutes: null,
            items: <SessionItem>[],
            userLevels: <String, String>{},
            isEmbedded: false,
          ),
          onPhaseComplete: (PhaseResult _) {
            if (context.mounted) context.pop();
          },
        ),
      ),
    );
  }
}

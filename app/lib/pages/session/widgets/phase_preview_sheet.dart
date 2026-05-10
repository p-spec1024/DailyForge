import 'package:flutter/material.dart';

import '../../../models/suggested_session.dart';
import '../../../providers/cross_pillar_session_provider.dart';

/// Bottom sheet listing every phase with its status; reachable from the
/// app-bar overflow on [FivePhaseSessionPage]. Read-only — tapping a row
/// does NOT navigate (skip-back is T6 polish per spec §2.2).
class PhasePreviewSheet extends StatelessWidget {
  final List<SessionPhase> phases;
  final int currentIndex;
  final Map<int, PhaseStatus> statuses;

  const PhasePreviewSheet({
    super.key,
    required this.phases,
    required this.currentIndex,
    required this.statuses,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'All phases',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: phases.asMap().entries.map((entry) {
                    final i = entry.key;
                    final phase = entry.value;
                    final status = statuses[i] ?? PhaseStatus.pending;
                    final isCurrent = i == currentIndex;
                    return ListTile(
                      leading: _leadingIcon(status, isCurrent: isCurrent),
                      title: Text(_phaseLabel(phase.phase)),
                      subtitle: Text('${phase.items.length} item(s)'),
                      trailing: isCurrent
                          ? Text(
                              'now',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            )
                          : null,
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _leadingIcon(PhaseStatus s, {required bool isCurrent}) {
    switch (s) {
      case PhaseStatus.completed:
        return const Icon(Icons.check_circle, color: Colors.green);
      case PhaseStatus.skipped:
        return Icon(Icons.skip_next, color: Colors.orange.shade300);
      case PhaseStatus.active:
      case PhaseStatus.paused:
        return const Icon(Icons.play_circle_fill, color: Colors.blueAccent);
      case PhaseStatus.pending:
        return Icon(
          Icons.radio_button_unchecked,
          color: Colors.grey.shade400,
        );
    }
  }

  String _phaseLabel(String phase) {
    switch (phase) {
      case 'bookend_open':
        return 'Opening Breath';
      case 'warmup':
        return 'Warm-up';
      case 'main':
        return 'Main Work';
      case 'cooldown':
        return 'Cool-down';
      case 'bookend_close':
        return 'Closing Breath';
      default:
        return phase;
    }
  }
}

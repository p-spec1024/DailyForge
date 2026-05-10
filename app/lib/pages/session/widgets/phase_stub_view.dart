import 'package:flutter/material.dart';

import '../../../models/suggested_session.dart';

/// T2 stub renderer — phase label + content-type tag + item list + an
/// explicit "T4 swap point" banner. T4 will replace this widget (or wrap its
/// body) with real embedded strength/yoga/breathwork players. The class name
/// is the seam — the orchestrator imports `PhaseStubView` directly.
class PhaseStubView extends StatelessWidget {
  final SessionPhase phase;
  final bool paused;

  const PhaseStubView({
    super.key,
    required this.phase,
    required this.paused,
  });

  @override
  Widget build(BuildContext context) {
    final phaseLabel = _phaseLabel(phase.phase);
    final contentTypeLabel =
        phase.items.isEmpty ? '—' : phase.items.first.contentType;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(phaseLabel, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          'Content type: $contentTypeLabel',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        if (paused) ...[
          const Text(
            'Paused',
            style: TextStyle(fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 16),
        ],
        const Text('Items in this phase:'),
        const SizedBox(height: 8),
        ...phase.items.map(
          (item) => Card(
            child: ListTile(
              title: Text(item.name),
              subtitle: _itemSubtitle(item),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Card(
          color: Colors.amber.shade50,
          child: const Padding(
            padding: EdgeInsets.all(12),
            child: Text(
              'T2 stub: real player lands in S14-T4. '
              'Tap "Next phase" to advance.',
              style: TextStyle(fontStyle: FontStyle.italic),
            ),
          ),
        ),
      ],
    );
  }

  Widget? _itemSubtitle(SessionItem item) {
    final parts = <String>[];
    if (item.durationMinutes != null) parts.add('${item.durationMinutes} min');
    if (item.sets != null) parts.add('${item.sets} sets');
    if (item.reps != null) parts.add('${item.reps} reps');
    return parts.isEmpty ? null : Text(parts.join(' · '));
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

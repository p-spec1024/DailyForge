import 'package:flutter/material.dart';

import '../../../providers/cross_pillar_session_provider.dart';

/// Horizontal segment strip — one segment per phase. Color encodes phase
/// status; the active phase is rendered in the same accent regardless of
/// `paused` (we surface paused-ness in the body, not the indicator strip).
///
/// T2 ships minimal styling. T6 polishes color + spacing per device test.
class PhaseIndicator extends StatelessWidget {
  final int phaseCount;
  final int currentIndex;
  final Map<int, PhaseStatus> statuses;

  const PhaseIndicator({
    super.key,
    required this.phaseCount,
    required this.currentIndex,
    required this.statuses,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: List.generate(phaseCount, (i) {
          final status = statuses[i] ?? PhaseStatus.pending;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: _colorFor(status),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Color _colorFor(PhaseStatus s) {
    switch (s) {
      case PhaseStatus.completed:
        return Colors.green;
      case PhaseStatus.skipped:
        return Colors.orange.shade300;
      case PhaseStatus.active:
      case PhaseStatus.paused:
        return Colors.blueAccent;
      case PhaseStatus.pending:
        return Colors.grey.shade400;
    }
  }
}

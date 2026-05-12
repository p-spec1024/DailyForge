import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../config/theme.dart';
import '../../../models/suggested_session.dart';
import '../../../providers/cross_pillar_session_provider.dart';
import '../../../utils/phase_label.dart';

/// Bottom sheet listing every phase with status + progress affordance.
/// S14-T6 §6.3 polish: vertical progress rail on the left, current phase
/// shows "Now • {time remaining}", skipped rows muted with badge.
class PhasePreviewSheet extends StatelessWidget {
  final List<SessionPhase> phases;
  final int currentIndex;
  final Map<int, PhaseStatus> statuses;
  final int currentPhaseElapsedSeconds;

  const PhasePreviewSheet({
    super.key,
    required this.phases,
    required this.currentIndex,
    required this.statuses,
    this.currentPhaseElapsedSeconds = 0,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Session overview',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 14),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(
                    phases.length,
                    (i) => _phaseRow(context, i),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _phaseRow(BuildContext context, int i) {
    final phase = phases[i];
    final status = statuses[i] ?? PhaseStatus.pending;
    final isCurrent = i == currentIndex;
    final isLast = i == phases.length - 1;
    final label = phaseDisplayLabel(
      phase.phase,
      contentType:
          phase.items.isNotEmpty ? phase.items.first.contentType : null,
    );
    final contentName =
        phase.items.isNotEmpty ? phase.items.first.name : null;
    final estimatedMin = phase.items.fold<int>(
      0,
      (sum, it) => sum + (it.durationMinutes ?? 0),
    );

    final muted = status == PhaseStatus.skipped;
    final textColor = muted
        ? AppColors.hintText
        : (isCurrent ? AppColors.gold : AppColors.primaryText);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Progress rail.
          SizedBox(
            width: 28,
            child: Column(
              children: [
                _railNode(status, isCurrent: isCurrent),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: _railColor(status, after: true),
                    ),
                  ),
              ],
            ),
          ),
          // Row body.
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 18),
              child: Row(
                children: [
                  Icon(_iconForPhase(phase.phase), size: 18, color: textColor),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                label,
                                style: TextStyle(
                                  color: textColor,
                                  fontSize: 14.5,
                                  fontWeight: isCurrent
                                      ? FontWeight.w700
                                      : FontWeight.w600,
                                  decoration: muted
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                            _trailing(
                              isCurrent: isCurrent,
                              status: status,
                              estimatedMin: estimatedMin,
                            ),
                          ],
                        ),
                        if (contentName != null && contentName.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              contentName,
                              style: TextStyle(
                                color: muted
                                    ? AppColors.hintText
                                    : AppColors.secondaryText,
                                fontSize: 12.5,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _railNode(PhaseStatus s, {required bool isCurrent}) {
    if (isCurrent) {
      return const _PulseDot(color: AppColors.gold);
    }
    switch (s) {
      case PhaseStatus.completed:
        return const Icon(LucideIcons.checkCircle2,
            size: 18, color: Colors.green);
      case PhaseStatus.skipped:
        return const Icon(LucideIcons.skipForward,
            size: 18, color: AppColors.warning);
      case PhaseStatus.active:
      case PhaseStatus.paused:
        return const _PulseDot(color: AppColors.gold);
      case PhaseStatus.pending:
        return const Icon(LucideIcons.circle,
            size: 18, color: AppColors.hintText);
    }
  }

  Color _railColor(PhaseStatus s, {required bool after}) {
    switch (s) {
      case PhaseStatus.completed:
        return Colors.green.withValues(alpha: 0.6);
      case PhaseStatus.skipped:
        return AppColors.warning.withValues(alpha: 0.4);
      case PhaseStatus.active:
      case PhaseStatus.paused:
        return AppColors.cardBorder;
      case PhaseStatus.pending:
        return AppColors.cardBorder;
    }
  }

  Widget _trailing({
    required bool isCurrent,
    required PhaseStatus status,
    required int estimatedMin,
  }) {
    if (status == PhaseStatus.skipped) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.warning.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Text(
          'SKIPPED',
          style: TextStyle(
            color: AppColors.warning,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      );
    }
    if (isCurrent) {
      final estSec = estimatedMin * 60;
      final remaining = (estSec - currentPhaseElapsedSeconds).clamp(0, 99999);
      return Text(
        'Now · ${_fmtRemaining(remaining)}',
        style: const TextStyle(
          color: AppColors.gold,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      );
    }
    if (status == PhaseStatus.completed) {
      return Text(
        '$estimatedMin min',
        style: const TextStyle(
          color: AppColors.hintText,
          fontSize: 12,
          decoration: TextDecoration.lineThrough,
        ),
      );
    }
    return Text(
      '$estimatedMin min',
      style: const TextStyle(
        color: AppColors.secondaryText,
        fontSize: 12,
      ),
    );
  }

  String _fmtRemaining(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    if (m == 0) return '${s}s left';
    if (s == 0) return '${m}m left';
    return '${m}m ${s}s left';
  }

  IconData _iconForPhase(String slug) {
    switch (slug) {
      case 'bookend_open':
      case 'bookend_close':
        return LucideIcons.wind;
      case 'warmup':
        return LucideIcons.sunrise;
      case 'main':
        return LucideIcons.dumbbell;
      case 'cooldown':
        return LucideIcons.sunset;
      case 'centering':
        return LucideIcons.circle;
      case 'practice':
        return LucideIcons.activity;
      case 'reflection':
        return LucideIcons.moon;
      default:
        return LucideIcons.checkCircle;
    }
  }
}

class _PulseDot extends StatefulWidget {
  final Color color;
  const _PulseDot({required this.color});
  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final t = _ctrl.value;
        return Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.color.withValues(alpha: 0.4 + 0.45 * t),
            border: Border.all(
              color: widget.color.withValues(alpha: 0.8),
              width: 2,
            ),
          ),
        );
      },
    );
  }
}

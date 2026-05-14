import 'dart:async';
import 'package:flutter/material.dart';

import '../config/theme.dart';
import 'embeddable_player.dart';
import 'phase_metadata.dart';
import 'phase_result.dart';

/// S14-T5: generic silent-timer surface. Used today for the reflection
/// stage of state-focus sessions; S14-T6 will reuse it for the cross-pillar
/// "1-min silent sit" at the end of phase 5 (Blueprint v5 §6).
///
/// Two visual modes, gated by [PhaseMetadata.isEndless]:
///
/// * **timed (isEndless=false)** — soft progress circle drains as a
///   countdown timer ticks `duration_minutes * 60` seconds down to 0. At 0,
///   [onPhaseComplete] fires automatically. An "I'm done" button is
///   available throughout for users who want to advance early (early-exit
///   ≠ skip; counts as completed per spec §5.2).
///
/// * **user_triggered (isEndless=true)** — no countdown is shown; the
///   circle stays static. The only way to advance is the "I'm done" button.
///   Calm / Insight Timer pattern: reflection should feel timeless.
class SilentTimerPlayer extends StatefulWidget {
  final bool isEmbedded;
  final PhaseMetadata phaseMetadata;
  final void Function(PhaseResult) onPhaseComplete;

  const SilentTimerPlayer({
    super.key,
    required this.isEmbedded,
    required this.phaseMetadata,
    required this.onPhaseComplete,
  });

  @override
  State<SilentTimerPlayer> createState() => _SilentTimerPlayerState();
}

class _SilentTimerPlayerState extends State<SilentTimerPlayer>
    with EmbeddablePlayer {
  Timer? _ticker;
  int _elapsedSeconds = 0;
  bool _completionFired = false;

  late final bool _isUserTriggered;
  late final int _totalSeconds;

  @override
  bool get isEmbedded => widget.isEmbedded;

  @override
  PhaseMetadata get phaseMetadata => widget.phaseMetadata;

  @override
  void Function(PhaseResult) get onPhaseComplete => widget.onPhaseComplete;

  @override
  void initState() {
    super.initState();
    // Mode is synthesized from phase + isEndless (D2 in T5 AMENDMENT-1).
    // Reflection in an endless bracket → user_triggered (no timer rendered).
    // Anything else (timed reflection, cross-pillar future silent sit) →
    // a real countdown.
    _isUserTriggered =
        widget.phaseMetadata.isEndless && widget.phaseMetadata.phase == 'reflection';

    final mins = widget.phaseMetadata.durationMinutes ?? 0;
    _totalSeconds = _isUserTriggered ? 0 : mins * 60;

    // Both modes run a 1Hz ticker so we can record wall-clock elapsed for
    // the PhaseResult. Only the timed mode auto-completes at zero.
    _ticker = Timer.periodic(const Duration(seconds: 1), _tick);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _tick(Timer _) {
    if (!mounted) return;
    setState(() => _elapsedSeconds += 1);
    if (!_isUserTriggered && _totalSeconds > 0 && _elapsedSeconds >= _totalSeconds) {
      _complete(early: false);
    }
  }

  void _complete({required bool early}) {
    if (_completionFired) return;
    _completionFired = true;
    _ticker?.cancel();
    widget.onPhaseComplete(PhaseResult(
      phase: widget.phaseMetadata.phase,
      contentType: 'breathwork',
      completedAt: DateTime.now(),
      actualDuration: Duration(seconds: _elapsedSeconds),
      items: widget.phaseMetadata.items,
      pillarSpecific: <String, dynamic>{
        'actualDurationSeconds': _elapsedSeconds,
        'wasEarlyExit': early,
        'isEndless': widget.phaseMetadata.isEndless,
      },
      wasSkipped: false,
      // Reflection writes no breathwork_sessions row (spec §16 D16) — the
      // multi_phase_sessions parent row carries the "user did reflection"
      // fact via phases_completed count.
      sessionId: null,
    ));
  }

  String _fmtCountdown(int remaining) {
    if (remaining < 0) remaining = 0;
    final m = (remaining ~/ 60).toString().padLeft(2, '0');
    final s = (remaining % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final remaining = _isUserTriggered
        ? 0
        : (_totalSeconds - _elapsedSeconds).clamp(0, _totalSeconds);
    final progress = _isUserTriggered || _totalSeconds == 0
        ? 0.0
        : (1.0 - remaining / _totalSeconds).clamp(0.0, 1.0).toDouble();

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Column(
          children: [
            const SizedBox(height: 24),
            const Text(
              'Breathe naturally',
              style: TextStyle(
                color: AppColors.secondaryText,
                fontSize: 18,
                fontWeight: FontWeight.w400,
              ),
            ),
            const SizedBox(height: 48),
            Expanded(
              child: Center(
                child: AspectRatio(
                  aspectRatio: 1,
                  child: _SoftCircle(progress: progress, hidden: _isUserTriggered),
                ),
              ),
            ),
            const SizedBox(height: 24),
            if (!_isUserTriggered)
              Text(
                _fmtCountdown(remaining),
                style: const TextStyle(
                  fontFamily: 'RobotoMono',
                  color: AppColors.primaryText,
                  fontSize: 32,
                  fontWeight: FontWeight.w300,
                  letterSpacing: 2,
                ),
              )
            else
              const SizedBox(height: 38),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => _complete(early: true),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.purple.withValues(alpha: 0.15),
                  foregroundColor: AppColors.purple,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                      color: AppColors.purple.withValues(alpha: 0.4),
                    ),
                  ),
                ),
                child: const Text(
                  "I'm done",
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

/// Soft, low-contrast circular visual. In timed mode the inner fill follows
/// [progress] (0.0 → 1.0 over the countdown). In user_triggered mode
/// ([hidden]==true), no progress is shown — a static muted ring.
class _SoftCircle extends StatelessWidget {
  final double progress;
  final bool hidden;

  const _SoftCircle({required this.progress, required this.hidden});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _SoftCirclePainter(
        progress: hidden ? 0.0 : progress,
        showProgress: !hidden,
      ),
    );
  }
}

class _SoftCirclePainter extends CustomPainter {
  final double progress;
  final bool showProgress;

  _SoftCirclePainter({required this.progress, required this.showProgress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.shortestSide / 2) - 8;

    final basePaint = Paint()
      ..color = AppColors.cardBorder
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawCircle(center, radius, basePaint);

    if (!showProgress) return;

    final arcPaint = Paint()
      ..color = AppColors.purple.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    final sweep = 2 * 3.141592653589793 * progress;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -3.141592653589793 / 2,
      sweep,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _SoftCirclePainter old) =>
      old.progress != progress || old.showProgress != showProgress;
}

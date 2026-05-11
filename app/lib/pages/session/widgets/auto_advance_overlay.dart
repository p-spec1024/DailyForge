import 'dart:async';
import 'package:flutter/material.dart';
import '../../../config/theme.dart';

/// S14-T4: 3-second auto-advance overlay shown between phases.
///
/// Renders a semi-transparent backdrop with "Phase complete ✓" + the next
/// phase's name + a 3-2-1 countdown. The user can tap "Skip wait →" to
/// advance immediately, or "Pause" to hold the countdown.
///
/// First phase (cold start) does NOT show this overlay — spec Decision #19.
/// User-skip phases also bypass the countdown — spec §8 last paragraph.
class AutoAdvanceOverlay extends StatefulWidget {
  final String nextPhaseLabel;
  final Future<void> Function() onAdvance;
  final Future<void> Function() onPause;

  const AutoAdvanceOverlay({
    super.key,
    required this.nextPhaseLabel,
    required this.onAdvance,
    required this.onPause,
  });

  @override
  State<AutoAdvanceOverlay> createState() => _AutoAdvanceOverlayState();
}

class _AutoAdvanceOverlayState extends State<AutoAdvanceOverlay> {
  static const int _countdownSeconds = 3;
  int _remaining = _countdownSeconds;
  Timer? _ticker;
  bool _paused = false;
  bool _advanced = false;

  @override
  void initState() {
    super.initState();
    _startTicker();
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _paused || _advanced) return;
      setState(() => _remaining -= 1);
      if (_remaining <= 0) _fireAdvance();
    });
  }

  Future<void> _fireAdvance() async {
    if (_advanced) return;
    _advanced = true;
    _ticker?.cancel();
    await widget.onAdvance();
  }

  Future<void> _firePause() async {
    setState(() => _paused = true);
    _ticker?.cancel();
    await widget.onPause();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.75),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle,
                      color: AppColors.success, size: 56),
                  const SizedBox(height: 16),
                  Text(
                    'Phase complete',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Next: ${widget.nextPhaseLabel}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    _paused
                        ? 'Paused'
                        : 'Starting in ${_remaining.clamp(0, _countdownSeconds)}...',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontFamily: 'RobotoMono',
                    ),
                  ),
                  const SizedBox(height: 32),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      OutlinedButton.icon(
                        onPressed: _paused ? null : _firePause,
                        icon: const Icon(Icons.pause, size: 18),
                        label: const Text('Pause'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.4)),
                        ),
                      ),
                      const SizedBox(width: 16),
                      FilledButton.icon(
                        onPressed: _advanced ? null : _fireAdvance,
                        icon: const Icon(Icons.skip_next, size: 18),
                        label: const Text('Skip wait'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

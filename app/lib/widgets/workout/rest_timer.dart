import 'dart:async';
import 'dart:math';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';

class RestTimer extends StatefulWidget {
  final int duration;
  final VoidCallback onSkip;
  final VoidCallback onFinish;

  const RestTimer({
    super.key,
    required this.duration,
    required this.onSkip,
    required this.onFinish,
  });

  @override
  State<RestTimer> createState() => _RestTimerState();
}

class _RestTimerState extends State<RestTimer>
    with SingleTickerProviderStateMixin {
  late int _remaining;
  Timer? _ticker;
  Timer? _dismissTimer;
  late final AnimationController _slideController;
  late final Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _remaining = widget.duration;
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 1.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));
    _slideController.forward();
    _startTicker();
  }

  @override
  void didUpdateWidget(covariant RestTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.duration != widget.duration) {
      _remaining = widget.duration;
      _dismissTimer?.cancel();
      _startTicker();
    }
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_remaining <= 0) return;
      setState(() {
        _remaining -= 1;
      });
      if (_remaining <= 0) {
        _ticker?.cancel();
        _dismissTimer = Timer(const Duration(milliseconds: 2000), () {
          if (mounted) widget.onFinish();
        });
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _dismissTimer?.cancel();
    _slideController.dispose();
    super.dispose();
  }

  String _formatTime(int seconds) {
    final s = seconds < 0 ? 0 : seconds;
    final m = s ~/ 60;
    final ss = (s % 60).toString().padLeft(2, '0');
    return '$m:$ss';
  }

  Color _colorForProgress(double progress) {
    if (progress > 0.5) return AppColors.beginner; // green
    if (progress > 0.2) return AppColors.gold; // amber
    return const Color(0xFFE53E3E); // red
  }

  @override
  Widget build(BuildContext context) {
    final progress = widget.duration <= 0
        ? 0.0
        : (_remaining / widget.duration).clamp(0.0, 1.0);
    final ringColor = _colorForProgress(progress);
    final safeBottom = MediaQuery.of(context).padding.bottom;

    return Positioned(
      left: 16,
      right: 16,
      bottom: 70 + safeBottom,
      child: SlideTransition(
        position: _slideAnimation,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              decoration: BoxDecoration(
                color: AppColors.surface.withValues(alpha: 0.88),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.cardBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.4),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 80,
                    height: 80,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CustomPaint(
                          size: const Size(80, 80),
                          painter: RestTimerPainter(
                            progress: progress,
                            color: ringColor,
                          ),
                        ),
                        Text(
                          _formatTime(_remaining),
                          style: monoStyle.copyWith(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: widget.onSkip,
                    icon: const Icon(LucideIcons.skipForward, size: 16),
                    label: const Text('Skip Rest'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.25),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
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

class RestTimerPainter extends CustomPainter {
  final double progress;
  final Color color;

  RestTimerPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 3;

    final bgPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6;
    canvas.drawCircle(center, radius, bgPaint);

    final progressPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;

    final sweepAngle = 2 * pi * progress;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -pi / 2,
      sweepAngle,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(RestTimerPainter old) =>
      old.progress != progress || old.color != color;
}

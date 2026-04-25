import 'dart:math' as math;
import 'package:flutter/material.dart';

class BreathCircle extends StatelessWidget {
  final String phaseKey;
  final String phaseLabel;
  final int secondsRemaining;
  final int phaseDuration;

  const BreathCircle({
    super.key,
    required this.phaseKey,
    required this.phaseLabel,
    required this.secondsRemaining,
    required this.phaseDuration,
  });

  static const Color _inhale = Color(0xFF3B82F6);
  static const Color _exhale = Color(0xFFF59E0B);
  static const Color _hold = Color(0xFF10B981);
  static const double _minScale = 0.6;
  static const double _maxScale = 1.0;

  Color get _color {
    switch (phaseKey) {
      case 'inhale':
        return _inhale;
      case 'exhale':
        return _exhale;
      default:
        return _hold;
    }
  }

  double _calcScale() {
    if (phaseDuration <= 0) return _maxScale;
    final progress =
        ((phaseDuration - secondsRemaining) / phaseDuration).clamp(0.0, 1.0);
    switch (phaseKey) {
      case 'inhale':
        return _minScale + (_maxScale - _minScale) * progress;
      case 'exhale':
        return _maxScale - (_maxScale - _minScale) * progress;
      default:
        return _maxScale + 0.02 * math.sin(progress * math.pi * 2);
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
    final targetScale = _calcScale();
    final width = MediaQuery.of(context).size.width * 0.65;
    final diameter = width.clamp(180.0, 280.0);

    return Center(
      child: SizedBox(
        width: 280,
        height: 280,
        child: Center(
          child: AnimatedScale(
            scale: targetScale,
            duration: const Duration(milliseconds: 950),
            curve: Curves.easeInOut,
            child: Container(
              width: diameter,
              height: diameter,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    color.withValues(alpha: 0.30),
                    color.withValues(alpha: 0.12),
                  ],
                ),
                border: Border.all(color: color, width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.35),
                    blurRadius: 40,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    phaseLabel,
                    style: TextStyle(
                      color: color,
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${secondsRemaining.clamp(0, 999)}',
                    style: const TextStyle(
                      fontFamily: 'RobotoMono',
                      color: Colors.white,
                      fontSize: 48,
                      fontWeight: FontWeight.w700,
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

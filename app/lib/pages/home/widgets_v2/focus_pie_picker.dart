import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../models/focus_area.dart';
import '_tokens_v2.dart';

/// Pie-segment focus picker — replaces the orbit picker per S13-T4
/// AMENDMENT-1 (May 3 2026). Two concentric rings of pie wedges with a
/// progress disc at the centre.
///
/// - Outer ring: 12 body-focus segments (30° each), filled wedges between
///   inner radius 62 and outer radius 115.
/// - Inner ring: 5 state-focus segments (72° each), filled wedges between
///   inner radius 24 and outer radius 58.
/// - Centre: white 22 px disc + 3 px green progress arc on the inner edge,
///   shows weekly-progress percent.
///
/// Tap detection uses `Path.contains()` per segment so the whole wedge is
/// hit (not just the emoji glyph). Segment ordering follows the API's
/// `display_order` clockwise — Option A "DB wins" from the pre-flight.
class FocusPiePicker extends StatelessWidget {
  final List<FocusArea> focusAreas;
  final String selectedSlug;
  final int weeklyProgressPercent;
  final bool isSuggestionLoading;
  final void Function(FocusArea focus) onTap;

  const FocusPiePicker({
    super.key,
    required this.focusAreas,
    required this.selectedSlug,
    required this.weeklyProgressPercent,
    required this.isSuggestionLoading,
    required this.onTap,
  });

  // Picker box. 380 is the design target; on narrower devices the
  // `FittedBox(scaleDown)` wraps the whole thing so it stays inside the
  // home-page card without horizontal clip. (Card width on a 360-dp
  // Android ≈ 336 px → picker scales to ~88 %; on 411-dp Pixel ≈ 387 px
  // → ~98 %.)
  static const double _diameter = 380;

  // Ring radii (px from centre). Scaled ~1.12× from the 340-px cut.
  static const double _bodyInnerR = 84;
  static const double _bodyOuterR = 156;
  static const double _stateInnerR = 34;
  static const double _stateOuterR = 78;
  static const double _centreDiscR = 29;
  static const double _progressStrokeW = 3;

  @override
  Widget build(BuildContext context) {
    final body = focusAreas.where((f) => f.isBody).toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    final state = focusAreas.where((f) => f.isState).toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    // Pre-compute segment paths once per build, in local coordinates of a
    // _diameter × _diameter canvas. Same paths drive both the painter
    // (drawing) and the gesture detector (hit-testing) — no risk of paint
    // and tap geometry drifting apart.
    final segments = <_Segment>[];
    if (body.isNotEmpty) {
      _appendRingSegments(
        segments,
        focuses: body,
        innerR: _bodyInnerR,
        outerR: _bodyOuterR,
      );
    }
    if (state.isNotEmpty) {
      _appendRingSegments(
        segments,
        focuses: state,
        innerR: _stateInnerR,
        outerR: _stateOuterR,
      );
    }

    // FittedBox(scaleDown) keeps the picker visually correct on narrow
    // phones (e.g. 360-dp Androids where card width ≈ 336 px) without
    // scaling up beyond _diameter on wider screens. The GestureDetector
    // is INSIDE the FittedBox so its localPosition stays in the unscaled
    // 340-px coordinate space the segment paths were built in.
    return Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: SizedBox(
          width: _diameter,
          height: _diameter,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (details) {
              for (final s in segments) {
                if (s.path.contains(details.localPosition)) {
                  onTap(s.focus);
                  return;
                }
              }
            },
            child: Stack(
              alignment: Alignment.center,
              children: [
                CustomPaint(
                  size: const Size(_diameter, _diameter),
                  painter: _PiePainter(
                    segments: segments,
                    selectedSlug: selectedSlug,
                    weeklyProgressPercent: weeklyProgressPercent,
                  ),
                ),
                if (isSuggestionLoading)
                  const SizedBox(
                    width: 32,
                    height: 32,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(kStateAccent),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _appendRingSegments(
    List<_Segment> out, {
    required List<FocusArea> focuses,
    required double innerR,
    required double outerR,
  }) {
    final n = focuses.length;
    if (n == 0) return;
    const centre = Offset(_diameter / 2, _diameter / 2);
    final outerRect = Rect.fromCircle(center: centre, radius: outerR);
    final innerRect = Rect.fromCircle(center: centre, radius: innerR);
    final sweep = 2 * math.pi / n;
    const startBase = -math.pi / 2; // 12 o'clock

    for (var i = 0; i < n; i++) {
      final start = startBase + i * sweep;
      final end = start + sweep;

      final path = Path();
      final outerStart = Offset(
        centre.dx + outerR * math.cos(start),
        centre.dy + outerR * math.sin(start),
      );
      path.moveTo(outerStart.dx, outerStart.dy);
      path.arcTo(outerRect, start, sweep, false);
      // arcTo leaves the pen at the end of the outer arc; line in to inner.
      final innerEnd = Offset(
        centre.dx + innerR * math.cos(end),
        centre.dy + innerR * math.sin(end),
      );
      path.lineTo(innerEnd.dx, innerEnd.dy);
      path.arcTo(innerRect, end, -sweep, false);
      path.close();

      out.add(_Segment(
        focus: focuses[i],
        path: path,
        innerR: innerR,
        outerR: outerR,
        startAngle: start,
        sweepAngle: sweep,
      ));
    }
  }
}

class _Segment {
  final FocusArea focus;
  final Path path;
  final double innerR;
  final double outerR;
  final double startAngle;
  final double sweepAngle;

  _Segment({
    required this.focus,
    required this.path,
    required this.innerR,
    required this.outerR,
    required this.startAngle,
    required this.sweepAngle,
  });

  Offset midpoint(Offset centre) {
    final midR = (innerR + outerR) / 2;
    final midA = startAngle + sweepAngle / 2;
    return Offset(
      centre.dx + midR * math.cos(midA),
      centre.dy + midR * math.sin(midA),
    );
  }

  bool get isOuterRing => outerR > 100;
}

class _PiePainter extends CustomPainter {
  final List<_Segment> segments;
  final String selectedSlug;
  final int weeklyProgressPercent;

  _PiePainter({
    required this.segments,
    required this.selectedSlug,
    required this.weeklyProgressPercent,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final centre = Offset(size.width / 2, size.height / 2);

    final dividerPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    // Pass 1 — fills (so dividers + labels paint over the top).
    for (final s in segments) {
      final isSel = s.focus.slug == selectedSlug;
      final fill = _fillFor(s.focus, isSel);
      canvas.drawPath(
        s.path,
        Paint()
          ..color = fill
          ..style = PaintingStyle.fill,
      );
    }

    // Pass 2 — radial dividers between segments. Drawn as straight lines
    // so they hit the precise wedge boundary even though the wedge fills
    // are arc-bound; using path-stroke would also stroke the inner/outer
    // arcs which we don't want.
    for (final s in segments) {
      final inner = Offset(
        centre.dx + s.innerR * math.cos(s.startAngle),
        centre.dy + s.innerR * math.sin(s.startAngle),
      );
      final outer = Offset(
        centre.dx + s.outerR * math.cos(s.startAngle),
        centre.dy + s.outerR * math.sin(s.startAngle),
      );
      canvas.drawLine(inner, outer, dividerPaint);
    }

    // Pass 3 — emoji + (selected) label inside each segment.
    for (final s in segments) {
      final isSel = s.focus.slug == selectedSlug;
      _paintSegmentLabel(canvas, s, isSel, centre);
    }

    // Pass 4 — centre disc + progress arc.
    _paintCentre(canvas, centre);
  }

  Color _fillFor(FocusArea focus, bool selected) {
    if (focus.isBody) {
      return selected ? kBodyAccent : kHomeBg;
    }
    return selected ? kStateAccent : kStateChipBg;
  }

  void _paintSegmentLabel(
    Canvas canvas,
    _Segment s,
    bool selected,
    Offset centre,
  ) {
    final mid = s.midpoint(centre);
    final emoji = emojiFor(s.focus.slug);
    final emojiSize = s.isOuterRing ? 18.0 : 14.0;

    if (!selected) {
      final tp = TextPainter(
        text: TextSpan(text: emoji, style: TextStyle(fontSize: emojiSize)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(
        canvas,
        Offset(mid.dx - tp.width / 2, mid.dy - tp.height / 2),
      );
      return;
    }

    // Selected: emoji stacked above the focus name, both centred on the
    // segment midpoint. Fixed font sizes — 11 pt for every body slice,
    // 9 pt for every state slice. Regular weight, white. Long names
    // ("Hamstrings", "Shoulders") may visibly approach the wedge edges
    // at the bigger 380-px pie; if they overflow on device test we'll
    // step body globally to 10 pt.
    final nameSize = s.isOuterRing ? 11.0 : 9.0;

    final emojiTp = TextPainter(
      text: TextSpan(text: emoji, style: TextStyle(fontSize: emojiSize)),
      textDirection: TextDirection.ltr,
    )..layout();
    final nameTp = TextPainter(
      text: TextSpan(
        text: s.focus.displayName,
        style: TextStyle(
          fontSize: nameSize,
          fontWeight: FontWeight.w400,
          color: Colors.white,
          height: 1.0,
        ),
      ),
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
      maxLines: 1,
    )..layout();

    const spacing = 1.0;
    final totalH = emojiTp.height + spacing + nameTp.height;
    final emojiOffset = Offset(
      mid.dx - emojiTp.width / 2,
      mid.dy - totalH / 2,
    );
    final nameOffset = Offset(
      mid.dx - nameTp.width / 2,
      emojiOffset.dy + emojiTp.height + spacing,
    );
    emojiTp.paint(canvas, emojiOffset);
    nameTp.paint(canvas, nameOffset);
  }

  void _paintCentre(Canvas canvas, Offset centre) {
    // Background ring (full circle, divider grey) sits on the inner edge
    // of the state ring — visible 2 px of stroke between the disc fill
    // and the state segments.
    const ringR = FocusPiePicker._centreDiscR;
    canvas.drawCircle(
      centre,
      ringR,
      Paint()
        ..color = kHomeDivider
        ..style = PaintingStyle.stroke
        ..strokeWidth = FocusPiePicker._progressStrokeW,
    );

    // Progress arc — green, partial, starts at top, clockwise.
    if (weeklyProgressPercent > 0) {
      final pct = (weeklyProgressPercent / 100).clamp(0.0, 1.0);
      final arcRect = Rect.fromCircle(center: centre, radius: ringR);
      canvas.drawArc(
        arcRect,
        -math.pi / 2,
        2 * math.pi * pct,
        false,
        Paint()
          ..color = kStateAccent
          ..style = PaintingStyle.stroke
          ..strokeWidth = FocusPiePicker._progressStrokeW
          ..strokeCap = StrokeCap.round,
      );
    }

    // Inner white disc.
    canvas.drawCircle(
      centre,
      ringR - FocusPiePicker._progressStrokeW / 2,
      Paint()
        ..color = kHomeCard
        ..style = PaintingStyle.fill,
    );

    // Percent label centred in the disc. Sizes nudged up a hair from the
    // 280-px first cut now that the disc is 26-px radius (was 22).
    final percentTp = TextPainter(
      text: TextSpan(
        text: '$weeklyProgressPercent%',
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: kHomeTextPrimary,
          height: 1.0,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final weeklyTp = TextPainter(
      text: const TextSpan(
        text: 'WEEKLY',
        style: TextStyle(
          fontSize: 7,
          fontWeight: FontWeight.w700,
          color: kHomeTextTertiary,
          letterSpacing: 0.6,
          height: 1.0,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    const labelGap = 2.0;
    final stackH = percentTp.height + labelGap + weeklyTp.height;
    final percentOffset = Offset(
      centre.dx - percentTp.width / 2,
      centre.dy - stackH / 2,
    );
    final weeklyOffset = Offset(
      centre.dx - weeklyTp.width / 2,
      percentOffset.dy + percentTp.height + labelGap,
    );
    percentTp.paint(canvas, percentOffset);
    weeklyTp.paint(canvas, weeklyOffset);
  }

  @override
  bool shouldRepaint(covariant _PiePainter old) =>
      old.selectedSlug != selectedSlug ||
      old.weeklyProgressPercent != weeklyProgressPercent ||
      !identical(old.segments, segments);
}

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../models/available_durations.dart';
import '../../providers/focus_duration_provider.dart';
import '../../services/focus_duration_service.dart';
import '../../services/storage_service.dart';

/// Body and state pickers share one widget; segment count adapts to data
/// shape (body: 3 wedges, state: 5). The home page tap handler maps
/// `focus.isState` → `FocusType.state`. Local enum so this widget owns its
/// own surface vocabulary without polluting the FocusArea/string convention
/// the rest of the codebase uses.
enum FocusType { body, state }

// ── Color tokens (S13-T5 AMENDMENT-2: unified terracotta accent) ─────────
const Color _kSheetBg = Colors.white;
const Color _kHandle = Color(0xFFD3D1C7);
const Color _kPageBg = Color(0xFFFAF8F2);
const Color _kDivider = Color(0xFFFFFFFF);
const Color _kTextPrimary = Color(0xFF2C2C2A);
const Color _kTextSecondary = Color(0xFF5F5E5A);
const Color _kTextTertiary = Color(0xFF888780);

/// Single accent for both pickers (AMENDMENT-2). Replaces the AMENDMENT-1
/// per-focus-type purple/green split. Used for selected wedge fill, the
/// Start button, and the error/empty block buttons.
const Color _kAccent = Color(0xFFC97B5E);
const Color _kAccentText = Color(0xFFFFFFFF);

// Hyphenated bracket form — matches engine BRACKET_TABLE keys, T5 backend
// route layer, AvailableDurations.label, and any t5.lastPicked.<slug> values
// already persisted to SharedPreferences from the T5 base build.
const List<String> _kStateBracketsOrdered = [
  '0-10', '10-20', '21-30', '30-45', 'endless',
];

const List<int> _kBodyMinutesOrdered = [30, 45, 60];

String _lastPickedKey(String focusSlug) => 't5.lastPicked.$focusSlug';

/// Open the half-pie picker. Resolves to the picked value (int minutes for
/// body, String bracket label for state) or null on dismiss. Return type is
/// `dynamic` to match the existing T5 base contract — the home page tap
/// handler casts to `int` or `String` based on focus type.
Future<dynamic> showHalfPiePicker(
  BuildContext context, {
  required String focusSlug,
  required String focusName,
  required FocusType focusType,
}) {
  final storage = context.read<StorageService>();
  return showModalBottomSheet<dynamic>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.only(
        topLeft: Radius.circular(16),
        topRight: Radius.circular(16),
        bottomLeft: Radius.circular(8),
        bottomRight: Radius.circular(8),
      ),
    ),
    builder: (sheetContext) => _HalfPiePickerSheet(
      focusSlug: focusSlug,
      focusName: focusName,
      focusType: focusType,
      storage: storage,
    ),
  );
}

class _HalfPiePickerSheet extends StatefulWidget {
  final String focusSlug;
  final String focusName;
  final FocusType focusType;
  final StorageService storage;

  const _HalfPiePickerSheet({
    required this.focusSlug,
    required this.focusName,
    required this.focusType,
    required this.storage,
  });

  @override
  State<_HalfPiePickerSheet> createState() => _HalfPiePickerSheetState();
}

class _HalfPiePickerSheetState extends State<_HalfPiePickerSheet> {
  /// `int` for body, `String` for state, null while resolving the default.
  /// The confirm button enables once this is non-null, so picker readiness
  /// is observable via `_selectedValue != null` — no separate flag needed.
  dynamic _selectedValue;
  int? _pressedIndex;

  // Cached after _resolveDefault completes for the state picker — null while
  // loading or if the response failed.
  AvailableDurations? _availableData;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _resolveDefault();
    });
  }

  Future<void> _resolveDefault() async {
    final storedRaw = await widget.storage.getPreference(_lastPickedKey(widget.focusSlug));
    if (!mounted) return;

    if (widget.focusType == FocusType.body) {
      // Body picker has no backend dependency — defaults resolved purely
      // from storage + (optional) suggested-default fetch. All 3 wedges are
      // always available.
      int? candidate;
      if (storedRaw is int && _kBodyMinutesOrdered.contains(storedRaw)) {
        candidate = storedRaw;
      }
      if (candidate == null) {
        await context
            .read<FocusDurationProvider>()
            .fetchSuggestedDefault(widget.focusSlug);
        if (!mounted) return;
        final result = context.read<FocusDurationProvider>().suggestedDefault;
        if (result != null &&
            result.focusSlug == widget.focusSlug &&
            result.bodyMinutes != null) {
          candidate = _snapToBodyMinutes(result.bodyMinutes!);
        }
      }
      candidate ??= 30;
      setState(() {
        _selectedValue = candidate;
      });
      return;
    }

    // State picker: needs available-durations response to know which wedges
    // are tappable. Default selection chooses from the available set only.
    await context
        .read<FocusDurationProvider>()
        .fetchAvailableDurations(widget.focusSlug);
    if (!mounted) return;
    final provider = context.read<FocusDurationProvider>();
    final data = provider.availableDurations;
    if (data == null || data.focusSlug != widget.focusSlug) {
      // No data; leave _selectedValue null. The error block (if any) will
      // render via _stateError; otherwise the confirm button stays disabled.
      return;
    }
    final availableLabels =
        data.ranges.map((r) => r.label).toSet();
    String? candidate;
    if (storedRaw is String && availableLabels.contains(storedRaw)) {
      candidate = storedRaw;
    } else if (data.suggestedDefault != null &&
        availableLabels.contains(data.suggestedDefault)) {
      candidate = data.suggestedDefault;
    } else {
      for (final label in _kStateBracketsOrdered) {
        if (availableLabels.contains(label)) {
          candidate = label;
          break;
        }
      }
    }
    setState(() {
      _availableData = data;
      _selectedValue = candidate;
    });
  }

  int _snapToBodyMinutes(int suggested) {
    return _kBodyMinutesOrdered.reduce((a, b) =>
        (suggested - a).abs() < (suggested - b).abs() ? a : b);
  }

  Future<void> _onConfirm() async {
    final picked = _selectedValue;
    if (picked == null) return;
    HapticFeedback.mediumImpact();
    await widget.storage.setPreference(_lastPickedKey(widget.focusSlug), picked);
    if (!mounted) return;
    Navigator.of(context).pop(picked);
  }

  Future<void> _onRetryStateAvailability() async {
    setState(() {
      _availableData = null;
      _selectedValue = null;
    });
    await _resolveDefault();
  }

  bool get _isStateLoading {
    if (widget.focusType != FocusType.state) return false;
    final provider = context.watch<FocusDurationProvider>();
    return provider.isAvailableLoading || _availableData == null;
  }

  FocusDurationServiceException? get _stateError {
    if (widget.focusType != FocusType.state) return null;
    final provider = context.watch<FocusDurationProvider>();
    return provider.availableError;
  }

  @override
  Widget build(BuildContext context) {
    final mediaHeight = MediaQuery.of(context).size.height;
    final maxHeight = mediaHeight * 0.6;
    final hasError = _stateError != null && _availableData == null;
    final stateEmpty = widget.focusType == FocusType.state &&
        _availableData != null &&
        _availableData!.ranges.isEmpty;
    final config = _buildConfig();

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Container(
          decoration: const BoxDecoration(
            color: _kSheetBg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildHandle(),
              const SizedBox(height: 14),
              _buildTitle(),
              if (config.subtitle != null) ...[
                const SizedBox(height: 4),
                _buildSubtitle(config.subtitle!),
              ],
              const SizedBox(height: 8),
              if (hasError)
                _ErrorBlock(
                  error: _stateError!,
                  onRetry: _onRetryStateAvailability,
                  onBack: () => Navigator.of(context).pop(),
                )
              else if (stateEmpty)
                _NoBracketsBlock(
                  focusName: widget.focusName,
                  onBack: () => Navigator.of(context).pop(),
                )
              else
                _buildPie(config),
              if (!hasError && !stateEmpty) ...[
                const SizedBox(height: 16),
                _buildConfirmButton(config),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHandle() {
    return Container(
      width: 36,
      height: 4,
      decoration: BoxDecoration(
        color: _kHandle,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }

  Widget _buildTitle() {
    return Text(
      'How long for ${widget.focusName}?',
      style: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w500,
        color: _kTextPrimary,
      ),
      textAlign: TextAlign.center,
    );
  }

  Widget _buildSubtitle(String defaultText) {
    final loading = _isStateLoading;
    return Text(
      loading ? 'Loading…' : defaultText,
      style: const TextStyle(
        fontSize: 13,
        color: _kTextTertiary,
      ),
      textAlign: TextAlign.center,
    );
  }

  Widget _buildPie(_HalfPieConfig config) {
    final loading = _isStateLoading;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      // AMENDMENT-2: cap pie width at 280 px so the half-pie sits centered
      // and doesn't dominate the sheet on standard-width phones. Below 280
      // (rare narrow phones) the pie scales naturally with the sheet.
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 280),
          child: AspectRatio(
            aspectRatio: 360.0 / 220.0,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final w = constraints.maxWidth;
                final h = constraints.maxHeight;
                final cx = w / 2.0;
                final cy = h * (180.0 / 220.0);
                final radius = w * (160.0 / 360.0);
                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTapDown: loading
                      ? null
                      : (details) => _handleTapDown(
                            details.localPosition, config, cx, cy, radius),
                  onTapUp: loading ? null : (_) => _clearPress(),
                  onTapCancel: loading ? null : _clearPress,
                  child: Opacity(
                    opacity: loading ? 0.4 : 1.0,
                    child: CustomPaint(
                      size: Size(w, h),
                      painter: _HalfPiePainter(
                        config: config,
                        selectedValue: _selectedValue,
                        pressedIndex: _pressedIndex,
                        center: Offset(cx, cy),
                        radius: radius,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildConfirmButton(_HalfPieConfig config) {
    final loading = _isStateLoading;
    final enabled = !loading && _selectedValue != null;
    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: SizedBox(
        width: double.infinity,
        height: 42,
        child: FilledButton(
          onPressed: enabled ? _onConfirm : null,
          style: FilledButton.styleFrom(
            backgroundColor: config.buttonColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
            textStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          child: const Text('Start session'),
        ),
      ),
    );
  }

  void _handleTapDown(
      Offset local, _HalfPieConfig config, double cx, double cy, double radius) {
    final dx = local.dx - cx;
    final dy = local.dy - cy;
    if (dy > 0) return; // below center — outside half-pie
    final dist = math.sqrt(dx * dx + dy * dy);
    if (dist > radius) return;
    if (dist < radius * 0.08) return; // dead zone right at center
    // Flutter's atan2 returns angle CW from +x axis (since +y is down).
    // For upper-half taps (dy < 0), atan2 returns a value in [-π, 0].
    // Normalize to [π, 2π] so it matches the wedge start/sweep convention
    // used in _buildConfig (start=π for leftmost, increasing CW).
    double angle = math.atan2(dy, dx);
    if (angle < 0) angle += 2 * math.pi;
    for (var i = 0; i < config.wedges.length; i++) {
      final w = config.wedges[i];
      if (angle >= w.startAngle &&
          angle < w.startAngle + w.sweepAngle) {
        if (!w.available) return;
        HapticFeedback.lightImpact();
        setState(() {
          _pressedIndex = i;
          _selectedValue = w.value;
        });
        return;
      }
    }
  }

  void _clearPress() {
    if (_pressedIndex == null) return;
    setState(() => _pressedIndex = null);
  }

  _HalfPieConfig _buildConfig() {
    if (widget.focusType == FocusType.body) {
      return _buildBodyConfig();
    }
    return _buildStateConfig();
  }

  _HalfPieConfig _buildBodyConfig() {
    const sweepRad = math.pi / 3; // 60°
    final wedges = <_WedgeData>[];
    for (var i = 0; i < _kBodyMinutesOrdered.length; i++) {
      final value = _kBodyMinutesOrdered[i];
      wedges.add(_WedgeData(
        value: value,
        label: '$value',
        // AMENDMENT-2: drop 'min' suffix from body wedges (single-line label).
        unit: null,
        available: true,
        startAngle: math.pi + i * sweepRad,
        sweepAngle: sweepRad,
        selectedFill: _kAccent,
        selectedTextColor: _kAccentText,
        selectedUnitColor: _kAccentText,
        unselectedTextColor: _kTextSecondary,
        unselectedUnitColor: _kTextTertiary,
        labelFontSize: 22,
        unitFontSize: 11,
      ));
    }
    return _HalfPieConfig(
      wedges: wedges,
      buttonColor: _kAccent,
      subtitle: 'Pick a duration that feels right.',
    );
  }

  _HalfPieConfig _buildStateConfig() {
    const sweepRad = math.pi / 5; // 36°
    final availableLabels = _availableData?.ranges
            .map((r) => r.label)
            .toSet() ??
        <String>{};
    final wedges = <_WedgeData>[];
    for (var i = 0; i < _kStateBracketsOrdered.length; i++) {
      final label = _kStateBracketsOrdered[i];
      final isEndless = label == 'endless';
      wedges.add(_WedgeData(
        value: label,
        label: isEndless ? '∞' : _displayForBracket(label),
        unit: null,
        available: availableLabels.contains(label),
        startAngle: math.pi + i * sweepRad,
        sweepAngle: sweepRad,
        selectedFill: _kAccent,
        selectedTextColor: _kAccentText,
        selectedUnitColor: _kAccentText,
        unselectedTextColor: _kTextSecondary,
        unselectedUnitColor: _kTextTertiary,
        labelFontSize: isEndless ? 18 : 13,
        unitFontSize: 10,
      ));
    }
    return _HalfPieConfig(
      wedges: wedges,
      buttonColor: _kAccent,
      subtitle: 'Pick a duration that feels right.',
    );
  }

  String _displayForBracket(String label) {
    switch (label) {
      case '0-10':
        return '0–10';
      case '10-20':
        return '10–20';
      case '21-30':
        return '21–30';
      case '30-45':
        return '30–45';
      default:
        return label;
    }
  }
}

class _HalfPieConfig {
  final List<_WedgeData> wedges;
  final Color buttonColor;

  /// Subtitle copy below the title, or null to omit. AMENDMENT-2 sets this
  /// for both pickers — was state-only in AMENDMENT-1.
  final String? subtitle;

  const _HalfPieConfig({
    required this.wedges,
    required this.buttonColor,
    this.subtitle,
  });
}

class _WedgeData {
  /// Hit-tested via dynamic equality with [_HalfPiePickerSheetState._selectedValue].
  /// int (30/45/60) for body, String ('0-10'…'endless') for state.
  final dynamic value;
  final String label;
  final String? unit;
  final bool available;
  final double startAngle;
  final double sweepAngle;
  final Color selectedFill;
  final Color selectedTextColor;
  final Color selectedUnitColor;
  final Color unselectedTextColor;
  final Color unselectedUnitColor;
  final double labelFontSize;
  final double unitFontSize;

  const _WedgeData({
    required this.value,
    required this.label,
    required this.unit,
    required this.available,
    required this.startAngle,
    required this.sweepAngle,
    required this.selectedFill,
    required this.selectedTextColor,
    required this.selectedUnitColor,
    required this.unselectedTextColor,
    required this.unselectedUnitColor,
    required this.labelFontSize,
    required this.unitFontSize,
  });
}

class _HalfPiePainter extends CustomPainter {
  final _HalfPieConfig config;
  final dynamic selectedValue;
  final int? pressedIndex;
  final Offset center;
  final double radius;

  _HalfPiePainter({
    required this.config,
    required this.selectedValue,
    required this.pressedIndex,
    required this.center,
    required this.radius,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    final dividerPaint = Paint()
      ..color = _kDivider
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.butt;

    for (var i = 0; i < config.wedges.length; i++) {
      final w = config.wedges[i];
      final isSelected = w.value == selectedValue;
      final isPressed = pressedIndex == i;

      final wedgePath = Path()
        ..moveTo(center.dx, center.dy)
        ..arcTo(rect, w.startAngle, w.sweepAngle, false)
        ..close();

      final fillColor = isSelected ? w.selectedFill : _kPageBg;
      final fillPaint = Paint()
        ..color = w.available
            ? (isPressed ? fillColor.withValues(alpha: 0.92) : fillColor)
            : fillColor.withValues(alpha: 0.4)
        ..style = PaintingStyle.fill;

      canvas.drawPath(wedgePath, fillPaint);
      canvas.drawPath(wedgePath, dividerPaint);

      _drawWedgeLabel(canvas, w, isSelected);
    }

    // Outer arc to close off the curved edge crisply.
    final outerArcPaint = Paint()
      ..color = _kDivider
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    final outerPath = Path()
      ..moveTo(center.dx - radius, center.dy)
      ..arcTo(rect, math.pi, math.pi, false);
    canvas.drawPath(outerPath, outerArcPaint);
  }

  void _drawWedgeLabel(Canvas canvas, _WedgeData w, bool isSelected) {
    final midAngle = w.startAngle + w.sweepAngle / 2;
    final labelRadius = radius * 0.62;
    final labelCx = center.dx + labelRadius * math.cos(midAngle);
    final labelCy = center.dy + labelRadius * math.sin(midAngle);

    final labelColor = w.available
        ? (isSelected ? w.selectedTextColor : w.unselectedTextColor)
        : w.unselectedTextColor.withValues(alpha: 0.6);

    // AMENDMENT-2: heavier weight on the selected wedge to make selection
    // more legible, especially on the small state-numbered labels.
    final labelPainter = TextPainter(
      text: TextSpan(
        text: w.label,
        style: TextStyle(
          color: labelColor,
          fontSize: w.labelFontSize,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        ),
      ),
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
    )..layout();

    if (w.unit != null) {
      final unitColor = w.available
          ? (isSelected ? w.selectedUnitColor : w.unselectedUnitColor)
          : w.unselectedUnitColor.withValues(alpha: 0.6);
      final unitPainter = TextPainter(
        text: TextSpan(
          text: w.unit,
          style: TextStyle(
            color: unitColor,
            fontSize: w.unitFontSize,
            fontWeight: FontWeight.w400,
          ),
        ),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
      )..layout();

      const gap = 1.0;
      final totalH = labelPainter.height + gap + unitPainter.height;
      final topY = labelCy - totalH / 2;
      labelPainter.paint(
        canvas,
        Offset(labelCx - labelPainter.width / 2, topY),
      );
      unitPainter.paint(
        canvas,
        Offset(labelCx - unitPainter.width / 2,
            topY + labelPainter.height + gap),
      );
    } else {
      labelPainter.paint(
        canvas,
        Offset(labelCx - labelPainter.width / 2,
            labelCy - labelPainter.height / 2),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _HalfPiePainter old) {
    return old.selectedValue != selectedValue ||
        old.pressedIndex != pressedIndex ||
        old.center != center ||
        old.radius != radius ||
        old.config != config;
  }
}

class _ErrorBlock extends StatelessWidget {
  final FocusDurationServiceException error;
  final VoidCallback onRetry;
  final VoidCallback onBack;
  const _ErrorBlock(
      {required this.error, required this.onRetry, required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          const Text(
            "Couldn't load duration options.",
            style: TextStyle(fontSize: 14, color: _kTextPrimary),
          ),
          const SizedBox(height: 4),
          Text(
            error.userFacingMessage,
            style: const TextStyle(fontSize: 12, color: _kTextSecondary),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: onRetry,
                style: TextButton.styleFrom(foregroundColor: _kAccent),
                child: const Text('Retry'),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: onBack,
                style: TextButton.styleFrom(foregroundColor: _kTextSecondary),
                child: const Text('Back'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NoBracketsBlock extends StatelessWidget {
  final String focusName;
  final VoidCallback onBack;
  const _NoBracketsBlock({required this.focusName, required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Text(
            'No durations available for $focusName at your level yet.',
            style: const TextStyle(fontSize: 14, color: _kTextPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: onBack,
            style: TextButton.styleFrom(foregroundColor: _kAccent),
            child: const Text('Back'),
          ),
        ],
      ),
    );
  }
}

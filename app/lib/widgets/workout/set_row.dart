import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../providers/workout_session_provider.dart';

class SetRow extends StatefulWidget {
  final int setNumber;
  final SetData setData;
  final PreviousData? previousData;
  final void Function(double weight, int reps) onComplete;

  /// S14-T1 fix-up #2: this row is the next un-logged set. Only the active
  /// row gets the engine's default-reps pre-fill, accepts input, and has an
  /// interactive ✓ button. Logged sets are identified via [setData.completed]
  /// (orthogonal to this flag — a logged row is never active). Future
  /// un-logged sets are `!isActive && !setData.completed`.
  final bool isActive;

  const SetRow({
    super.key,
    required this.setNumber,
    required this.setData,
    this.previousData,
    required this.onComplete,
    this.isActive = false,
  });

  @override
  State<SetRow> createState() => _SetRowState();
}

class _SetRowState extends State<SetRow> {
  late final TextEditingController _weightController;
  late final TextEditingController _repsController;

  @override
  void initState() {
    super.initState();
    _weightController = TextEditingController(text: _formatWeight());
    _repsController = TextEditingController(text: _formatReps());
  }

  @override
  void didUpdateWidget(covariant SetRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Back-fill from previous performance if controllers are still empty
    // (e.g. previous performance arrived after initial render)
    if (!widget.setData.completed) {
      if (_weightController.text.isEmpty) {
        final w = _formatWeight();
        if (w.isNotEmpty) _weightController.text = w;
      }
      if (_repsController.text.isEmpty) {
        final r = _formatReps();
        if (r.isNotEmpty) _repsController.text = r;
      }
    }
  }

  String _formatWeight() {
    // Logged sets always show the user's saved value.
    if (widget.setData.completed && widget.setData.weight > 0) {
      final w = widget.setData.weight;
      return w == w.truncateToDouble() ? w.toInt().toString() : w.toString();
    }
    // Inactive un-logged sets stay empty (placeholder only).
    if (!widget.isActive) return '';
    // Active set: previous-performance pre-fill if available.
    if (widget.previousData?.weight != null) {
      final w = widget.previousData!.weight!;
      return w == w.truncateToDouble() ? w.toInt().toString() : w.toString();
    }
    return '';
  }

  String _formatReps() {
    // Logged sets always show the user's saved value.
    if (widget.setData.completed && widget.setData.reps > 0) {
      return widget.setData.reps.toString();
    }
    // Inactive un-logged sets stay empty (placeholder only).
    if (!widget.isActive) return '';
    // Active set: provider-seeded engine default (SetData.reps from
    // _initializeDefaultSets), then previous-performance fallback.
    if (widget.setData.reps > 0) return widget.setData.reps.toString();
    if (widget.previousData?.reps != null) {
      return widget.previousData!.reps.toString();
    }
    return '';
  }

  @override
  void dispose() {
    _weightController.dispose();
    _repsController.dispose();
    super.dispose();
  }

  void _showWarning(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(LucideIcons.alertTriangle,
                  color: Colors.white, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ],
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 100),
          backgroundColor: AppColors.error.withValues(alpha: 0.95),
          elevation: 6,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      );
  }

  void _handleComplete() {
    // Defensive: the InkWell is non-interactive on inactive rows, so this
    // shouldn't be reachable. Keep the guard so a bug elsewhere (e.g. tap
    // through a transparent overlay) can't log out-of-order.
    if (!widget.isActive) return;
    final weight = double.tryParse(_weightController.text) ?? 0;
    final reps = int.tryParse(_repsController.text) ?? 0;
    if (weight <= 0 || reps <= 0) {
      _showWarning('Enter weight and reps before logging');
      return;
    }
    widget.onComplete(weight, reps);
  }

  String get _setLabel {
    switch (widget.setData.setType) {
      case 'warmup':
        return 'W';
      case 'dropset':
        return 'D';
      case 'failure':
        return 'F';
      default:
        return widget.setNumber.toString();
    }
  }

  Color get _setLabelColor {
    switch (widget.setData.setType) {
      case 'warmup':
        return AppColors.yoga;
      case 'dropset':
        return AppColors.purple;
      case 'failure':
        return AppColors.error;
      default:
        return AppColors.secondaryText;
    }
  }

  @override
  Widget build(BuildContext context) {
    final completed = widget.setData.completed;
    // Inactive un-logged rows render greyed; active and logged stay full.
    final dimmed = !completed && !widget.isActive;

    return Opacity(
      opacity: dimmed ? 0.4 : 1.0,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            // Set number
            SizedBox(
              width: 32,
              child: Text(
                _setLabel,
                textAlign: TextAlign.center,
                style: monoStyle.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: completed ? AppColors.success : _setLabelColor,
                ),
              ),
            ),
            // Previous
            SizedBox(
              width: 72,
              child: Text(
                widget.previousData?.display ?? '—',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 12,
                    ),
              ),
            ),
            const SizedBox(width: 4),
            // Weight input
            SizedBox(
              width: 64,
              height: 36,
              child: TextField(
                controller: _weightController,
                enabled: widget.isActive,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                textAlign: TextAlign.center,
                style: monoStyle.copyWith(
                  fontSize: 14,
                  color: completed ? AppColors.success : Colors.white,
                ),
                decoration: InputDecoration(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  filled: true,
                  fillColor: completed
                      ? AppColors.success.withValues(alpha: 0.08)
                      : AppColors.surface,
                  hintText: 'kg',
                  hintStyle: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 13,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: AppColors.cardBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.strength),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Reps input
            SizedBox(
              width: 52,
              height: 36,
              child: TextField(
                controller: _repsController,
                enabled: widget.isActive,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: monoStyle.copyWith(
                  fontSize: 14,
                  color: completed ? AppColors.success : Colors.white,
                ),
                decoration: InputDecoration(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  filled: true,
                  fillColor: completed
                      ? AppColors.success.withValues(alpha: 0.08)
                      : AppColors.surface,
                  hintText: 'reps',
                  hintStyle: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 13,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: AppColors.cardBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.strength),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Checkmark button
            SizedBox(
              width: 36,
              height: 36,
              child: Material(
                color: completed ? AppColors.success : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                child: InkWell(
                  // Active is the only interactive state; logged + inactive
                  // both pass null. Lock icon retired — visual gating is the
                  // row's Opacity wrapper.
                  onTap: widget.isActive ? _handleComplete : null,
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: completed
                          ? null
                          : Border.all(color: AppColors.cardBorder),
                    ),
                    child: Icon(
                      LucideIcons.check,
                      size: 18,
                      color: completed ? Colors.white : AppColors.secondaryText,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

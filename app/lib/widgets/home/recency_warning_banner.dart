import 'package:flutter/material.dart';

import '../../config/theme.dart';

/// S14-T6 §6.4: inline non-blocking banner consuming the engine's
/// `recency_overlap` warning. Renders above the Start button on the
/// home/yoga/strength entry-point cards (via [EntryPointWarningSlot]).
///
/// Non-blocking: the Start button below the banner stays enabled. The two
/// actions are sugar — "Switch to Recover" swaps the focus via the supplied
/// callback; "Proceed anyway" dismisses the banner in-memory for the
/// current session (a new warning will re-show on the next focus change).
class RecencyWarningBanner extends StatelessWidget {
  final String message;
  final String alternativeFocusDisplayName;
  final VoidCallback onSwitchToAlternative;
  final VoidCallback onDismiss;

  const RecencyWarningBanner({
    super.key,
    required this.message,
    required this.alternativeFocusDisplayName,
    required this.onSwitchToAlternative,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    const warning = AppColors.warning;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
      decoration: BoxDecoration(
        color: warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: warning.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.warning_amber_rounded, size: 20, color: warning),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontSize: 13.5,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: onDismiss,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.secondaryText,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Proceed anyway'),
              ),
              const SizedBox(width: 4),
              FilledButton(
                onPressed: onSwitchToAlternative,
                style: FilledButton.styleFrom(
                  backgroundColor: warning.withValues(alpha: 0.18),
                  foregroundColor: warning,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: Text('Switch to $alternativeFocusDisplayName'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

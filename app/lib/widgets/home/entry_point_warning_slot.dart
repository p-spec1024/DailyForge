import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../constants/focus_categories.dart';
import '../../providers/suggest_provider.dart';
import 'recency_warning_banner.dart';

/// Default bracket when switching to a state-focus alternative. The engine
/// returns `recover` today; '10-20' is a gentle middle ground that suits a
/// recovery session without committing to a long sit. User can adjust via
/// the picker after the switch.
const String _kStateFocusDefaultBracket = '10-20';

/// S14-T6 §6.4: tab-card-agnostic wrapper that decides whether to surface
/// a [RecencyWarningBanner] above the Start button. Each entry point
/// (home / yoga_tab / strength_tab) drops this widget in once and the
/// dismissal state is scoped to that mount.
///
/// Dismissal is in-memory only — the next focus change that surfaces a new
/// warning re-shows the banner (spec §6.4 explicitly forbids persisting
/// dismissals).
class EntryPointWarningSlot extends StatefulWidget {
  /// 'home' | 'yoga_tab' | 'strength_tab'. Drives which refresh method
  /// fires when the user taps "Switch to <alternative>".
  final String entryPoint;

  /// Optional time-budget for tabs that show a budget selector. Forwarded
  /// to `refreshForEntryPoint` so the swap stays on the user's current
  /// budget. Home uses the persisted budget — pass null.
  final int? timeBudgetMin;

  const EntryPointWarningSlot({
    super.key,
    required this.entryPoint,
    this.timeBudgetMin,
  });

  @override
  State<EntryPointWarningSlot> createState() => _EntryPointWarningSlotState();
}

class _EntryPointWarningSlotState extends State<EntryPointWarningSlot> {
  /// Sentinel key identifying which warning the user dismissed. Composed
  /// from the warning's `yesterday_focus + current_focus` so a different
  /// overlap (e.g. user changed focus) re-surfaces the banner.
  String? _dismissedKey;

  @override
  Widget build(BuildContext context) {
    final suggest = context.watch<SuggestProvider>();
    final session = suggest.currentSession;
    if (session == null || session.warnings.isEmpty) {
      return const SizedBox.shrink();
    }
    final w = session.warnings.firstWhere(
      (x) => x['type'] == 'recency_overlap',
      orElse: () => const <String, dynamic>{},
    );
    if (w.isEmpty) return const SizedBox.shrink();

    final yesterday = w['yesterday_focus'] as String? ?? '';
    final current   = w['current_focus']   as String? ?? '';
    final message   = w['message']         as String? ?? '';
    final altSlug   = w['alternative_focus_slug'] as String? ?? 'recover';
    final key = '$yesterday::$current::$altSlug';
    if (_dismissedKey == key) return const SizedBox.shrink();

    return RecencyWarningBanner(
      message: message,
      alternativeFocusDisplayName: _displayName(altSlug),
      onSwitchToAlternative: () async {
        // S14-T6 Commit 1.5 (retest #1): the engine emits state-focus slugs
        // (today only 'recover') as the recency-overlap alternative. State
        // focuses route through selectStateFocus(bracket), not the body-
        // focus path — the engine rejects body-focus requests for state
        // slugs and the user sees "Something went wrong" on first tap.
        if (kStateFocusSlugs.contains(altSlug)) {
          await suggest.selectStateFocus(altSlug, _kStateFocusDefaultBracket);
          return;
        }
        if (widget.entryPoint == 'home') {
          await suggest.selectBodyFocus(altSlug,
              timeBudgetMin: widget.timeBudgetMin);
        } else {
          await suggest.refreshForEntryPoint(
            entryPoint: widget.entryPoint,
            focusSlug: altSlug,
            timeBudgetMin: widget.timeBudgetMin,
          );
        }
      },
      onDismiss: () => setState(() => _dismissedKey = key),
    );
  }

  String _displayName(String slug) {
    if (slug.isEmpty) return 'alternative';
    return slug
        .split('_')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }
}

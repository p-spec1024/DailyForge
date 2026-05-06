import 'package:flutter/material.dart';

import '../../models/focus_area.dart';
import '../../models/suggested_session.dart';
import '../../pages/home/widgets_v2/_tokens_v2.dart';

/// Renders the engine's `session_shape: 'state_focus'` payload using the
/// same outer chrome as the body-focus card (TODAY label, focus pill, title,
/// subtitle, recency-warning slot, Start button) but with state-focus colors
/// and the centering/practice/reflection phase summary.
///
/// Endless mode is detected via `metadata.isEndless` — the engine's canonical
/// signal. When true, the title shows "Open" instead of total minutes and
/// the subtitle appends `· ∞`.
class StateFocusSessionCard extends StatelessWidget {
  final FocusArea? focus;
  final SuggestedSession session;
  final bool isLoading;
  final VoidCallback onStart;

  const StateFocusSessionCard({
    super.key,
    required this.focus,
    required this.session,
    required this.isLoading,
    required this.onStart,
  });

  @override
  Widget build(BuildContext context) {
    final isEndless = session.metadata.isEndless == true;
    final totalMin = session.metadata.estimatedTotalMin;
    final focusName = focus?.displayName ?? 'State session';
    final title = isEndless
        ? '$focusName · Open'
        : '$focusName · $totalMin min';
    final subtitle = isEndless
        ? 'Centering · Practice · Reflection · ∞'
        : 'Centering · Practice · Reflection';
    final recencyMessage = _findRecencyMessage(session);

    final card = Container(
      decoration: kHomeCardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'TODAY',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: kHomeTextTertiary,
                ),
              ),
              _StatePill(),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: kHomeTextPrimary,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 13,
              color: kHomeTextSecondary,
            ),
          ),
          if (recencyMessage != null) ...[
            const SizedBox(height: 4),
            Text(
              recencyMessage,
              style: const TextStyle(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: kRecencyText,
              ),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: FilledButton(
              onPressed: onStart,
              style: FilledButton.styleFrom(
                backgroundColor: kStateAccent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                textStyle: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: const Text('Start'),
            ),
          ),
        ],
      ),
    );

    if (!isLoading) return card;
    return AnimatedOpacity(
      opacity: 0.6,
      duration: const Duration(milliseconds: 180),
      child: card,
    );
  }

  String? _findRecencyMessage(SuggestedSession s) {
    for (final w in s.warnings) {
      if (w['type'] == 'recency_overlap') {
        final m = w['message'];
        if (m is String && m.isNotEmpty) return m;
      }
    }
    return null;
  }
}

class _StatePill extends StatelessWidget {
  const _StatePill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: const ShapeDecoration(
        color: kStateChipBg,
        shape: StadiumBorder(),
      ),
      child: const Text(
        'State',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: kStateChipText,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

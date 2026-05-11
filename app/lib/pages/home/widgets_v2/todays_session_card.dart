import 'package:flutter/material.dart';

import '../../../models/focus_area.dart';
import '../../../models/suggested_session.dart';
import '../../../services/suggest_service.dart';
import '../../../utils/phase_label.dart';
import '_tokens_v2.dart';

/// Hero card on the home page. Renders the engine's pick for the currently
/// selected focus, a focus-type pill, the phase summary, an optional
/// recency-warning subtitle, and a primary "Start" button.
///
/// Loading state: shimmer-skeleton variant (subtle pulse) so the orbit
/// stays interactive while a new suggest is in-flight.
class TodaysSessionCard extends StatelessWidget {
  final FocusArea? focus;
  final SuggestedSession? session;
  final bool isLoading;
  final SuggestServiceException? error;
  final VoidCallback onStart;
  final VoidCallback onRetry;

  const TodaysSessionCard({
    super.key,
    required this.focus,
    required this.session,
    required this.isLoading,
    required this.error,
    required this.onStart,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    if (error != null && session == null) {
      return _ErrorState(message: error!.userFacingMessage, onRetry: onRetry);
    }
    if (session == null) {
      return const _SkeletonCard();
    }
    return _LoadedCard(
      focus: focus,
      session: session!,
      pulse: isLoading,
      onStart: onStart,
    );
  }
}

class _LoadedCard extends StatelessWidget {
  final FocusArea? focus;
  final SuggestedSession session;
  final bool pulse;
  final VoidCallback onStart;

  const _LoadedCard({
    required this.focus,
    required this.session,
    required this.pulse,
    required this.onStart,
  });

  @override
  Widget build(BuildContext context) {
    final phaseSummary = session.phases
        .map((p) => phaseDisplayLabel(
              p.phase,
              contentType: p.items.isNotEmpty ? p.items.first.contentType : null,
            ))
        .join(' → ');
    final mins = session.metadata.estimatedTotalMin;
    final title = focus == null
        ? '$mins min session'
        : '${focus!.displayName} · $mins min';
    final recencyMessage = _findRecencyMessage(session);

    final card = Container(
      decoration: kHomeCardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'TODAY',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: kHomeTextTertiary,
                ),
              ),
              if (focus != null) _FocusTypePill(focus: focus!),
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
            phaseSummary,
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

    if (!pulse) return card;
    return AnimatedOpacity(
      opacity: 0.6,
      duration: const Duration(milliseconds: 180),
      child: card,
    );
  }

  /// Engine emits warnings as `[{type, ...}, ...]`. The home page surfaces
  /// `recency_overlap` only — other warning types stay in the response for
  /// future renderers without leaking into the UI.
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

class _FocusTypePill extends StatelessWidget {
  final FocusArea focus;
  const _FocusTypePill({required this.focus});

  @override
  Widget build(BuildContext context) {
    final isBody = focus.isBody;
    final bg = isBody ? kBodyChipBg : kStateChipBg;
    final fg = isBody ? kBodyChipText : kStateChipText;
    final label = isBody ? 'Body' : 'State';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: ShapeDecoration(
        color: bg,
        shape: const StadiumBorder(),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: fg,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    Widget bar({double w = 140, double h = 14}) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(
            color: kHomeDivider,
            borderRadius: BorderRadius.circular(4),
          ),
        );
    return Container(
      decoration: kHomeCardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          bar(w: 50, h: 10),
          const SizedBox(height: 12),
          bar(w: 200, h: 22),
          const SizedBox(height: 8),
          bar(w: 180, h: 12),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            height: 44,
            decoration: BoxDecoration(
              color: kHomeDivider,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: kHomeCardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message,
            style: const TextStyle(
              fontSize: 14,
              color: kHomeTextPrimary,
            ),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(foregroundColor: kStateAccent),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

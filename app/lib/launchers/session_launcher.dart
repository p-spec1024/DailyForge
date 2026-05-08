import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../models/suggested_session.dart';
import '../providers/workout_session_provider.dart';
import '../services/api_service.dart';

/// Dispatches a [SuggestedSession] to the correct pillar player.
///
/// S14-T1 supports `pillar_pure` strength only. Other shapes throw
/// [UnimplementedError] with an explicit sprint hand-off message so the gap
/// surfaces loudly instead of silently no-op'ing.
///
/// Convention: pre-seed pattern. The launcher hydrates the relevant provider
/// before calling [GoRouter.go], relying on the player page's
/// `provider.isActive` re-entry guard (`workout_page.dart:55`) to render
/// without re-firing `_initSession`.
class SessionLauncher {
  SessionLauncher._();

  static Future<void> launch(
    BuildContext context,
    SuggestedSession session,
  ) async {
    switch (session.sessionShape) {
      case 'pillar_pure':
        return _launchPillarPure(context, session);
      case 'cross_pillar':
        throw UnimplementedError(
          'cross_pillar shape lands in S14-T2 (5-phase orchestrator).',
        );
      case 'state_focus':
        throw UnimplementedError(
          'state_focus shape lands in S14-T5 (3-leg chain).',
        );
      default:
        throw UnimplementedError(
          'unknown session_shape: ${session.sessionShape}',
        );
    }
  }

  static Future<void> _launchPillarPure(
    BuildContext context,
    SuggestedSession session,
  ) async {
    if (session.phases.length != 1) {
      throw StateError(
        'pillar_pure expected 1 phase, got ${session.phases.length}',
      );
    }
    final phase = session.phases.first;
    final allStrength = phase.items.every((i) => i.contentType == 'strength');
    if (!allStrength) {
      throw UnimplementedError(
        'pillar_pure non-strength (yoga/breathwork) lands in S14-T3.',
      );
    }

    final focusSlug = session.metadata.focusSlug;
    if (focusSlug == null || focusSlug.isEmpty) {
      throw StateError(
        'session metadata.focus_slug is required for start-from-list',
      );
    }

    // Map engine items → start-from-list payload shape.
    final payloadExercises = phase.items.asMap().entries.map((entry) {
      final i = entry.key;
      final item = entry.value;
      return <String, dynamic>{
        'exercise_id': item.contentId,
        'sort_order': i,
        'default_sets': item.sets ?? 3,
        // Engine emits int for strength items, but the model is tolerant.
        // Leave null when absent rather than fabricating a value.
        'default_reps': item.reps,
      };
    }).toList();

    final provider = context.read<WorkoutSessionProvider>();

    try {
      await provider.startFromList(
        exercises: payloadExercises,
        focusSlug: focusSlug,
      );
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyError(e))),
      );
      return;
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start session.')),
      );
      return;
    }

    if (!context.mounted) return;
    context.go('/workout');
  }

  /// Maps server error codes (carried in [ApiException.message]) to
  /// human-friendly snackbar copy per spec §7.
  static String _friendlyError(ApiException e) {
    switch (e.message) {
      case 'unsupported_session_type':
        return "This session type isn't supported yet.";
      case 'invalid_focus_slug':
        return 'Could not start session — try picking a focus again.';
      case 'invalid_exercises':
        return 'Engine returned no exercises. Try a different focus.';
      case 'too_many_exercises':
        return 'Session too long — try a shorter duration.';
      case 'unknown_exercise_id':
        return 'Some exercises in this session are unavailable.';
      case 'wrong_pillar_exercise':
        return 'Engine returned mismatched data — please report this.';
      default:
        return 'Could not start session.';
    }
  }
}

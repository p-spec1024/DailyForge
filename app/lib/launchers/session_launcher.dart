import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../adapters/yoga_session_errors.dart';
import '../models/suggested_session.dart';
import '../providers/cross_pillar_session_provider.dart';
import '../providers/state_focus_session_provider.dart';
import '../providers/workout_session_provider.dart';
import '../providers/yoga_session_provider.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

/// Dispatches a [SuggestedSession] to the correct pillar player.
///
/// S14-T1 supports `pillar_pure` strength end-to-end.
/// S14-T2 wires `cross_pillar` to the 5-phase orchestrator.
/// S14-T3 wires `pillar_pure` yoga via the engine→player adapter.
/// State-focus still throws [UnimplementedError] with an explicit sprint
/// hand-off message; the dispatch-level catch surfaces it as a user-facing
/// snackbar so the gap shows up loudly instead of silently no-op'ing or
/// crashing the call site.
///
/// Convention: pre-seed pattern. The launcher hydrates the relevant provider
/// before calling [GoRouter.go], relying on the player page's `isActive` /
/// `session != null` guard to render without re-firing init logic.
class SessionLauncher {
  SessionLauncher._();

  static Future<void> launch(
    BuildContext context,
    SuggestedSession session,
  ) async {
    try {
      switch (session.sessionShape) {
        case 'pillar_pure':
          return await _launchPillarPure(context, session);
        case 'cross_pillar':
          return await _launchCrossPillar(context, session);
        case 'state_focus':
          return await _launchStateFocus(context, session);
        default:
          throw UnimplementedError(
            'unknown session_shape: ${session.sessionShape}',
          );
      }
    } on UnimplementedError catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.message?.toString() ?? "This session type isn't supported yet.",
          ),
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start session.')),
      );
    }
  }

  /// S14-T3: dispatch by `content_type` of the main phase's first item.
  /// Yoga sessions carry 3 phases (warmup/main/cooldown); strength sessions
  /// carry 1 (main). Per-pillar branches assert their own phase invariants.
  static Future<void> _launchPillarPure(
    BuildContext context,
    SuggestedSession session,
  ) async {
    if (session.phases.isEmpty) {
      throw StateError('pillar_pure session has no phases');
    }
    final mainPhase = session.phases.firstWhere(
      (p) => p.phase == 'main',
      orElse: () => session.phases.first,
    );
    if (mainPhase.items.isEmpty) {
      throw StateError('pillar_pure session has empty main phase');
    }
    final pillar = mainPhase.items.first.contentType;
    switch (pillar) {
      case 'strength':
        return _launchPillarPureStrength(context, session);
      case 'yoga':
        return _launchPillarPureYoga(context, session);
      case 'breathwork':
        throw UnimplementedError(
          'pillar_pure breathwork shape — unexpected from engine; report.',
        );
      default:
        throw StateError(
          'unknown content_type in pillar_pure session: $pillar',
        );
    }
  }

  static Future<void> _launchPillarPureStrength(
    BuildContext context,
    SuggestedSession session,
  ) async {
    if (session.phases.length != 1) {
      throw StateError(
        'pillar_pure strength expected 1 phase, got ${session.phases.length}',
      );
    }
    final phase = session.phases.first;
    final allStrength = phase.items.every((i) => i.contentType == 'strength');
    if (!allStrength) {
      throw StateError(
        'pillar_pure strength session has non-strength items',
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

  /// S14-T3: hydrate yoga poses, run engine→YogaSession adapter, navigate.
  /// Strict-mode (Q3 lock): any [YogaSessionException] from hydration/adapter
  /// blocks navigation and surfaces a friendly snackbar — the player never
  /// opens with placeholder names.
  ///
  /// FS #203 W1: if the page unmounts between `loadFromEngineSession`
  /// resolving and the navigation, reset the provider before bailing.
  /// Otherwise the provider sits populated with stale data and the next
  /// session attempt may pick up the wrong state.
  ///
  /// FS #203 W2: typed [YogaContractException] / [YogaHydrationException]
  /// replace the prior [StateError] substring-matching. Each subtype owns
  /// its own user-facing copy via `userMessage`.
  static Future<void> _launchPillarPureYoga(
    BuildContext context,
    SuggestedSession session,
  ) async {
    final provider = context.read<YogaSessionProvider>();
    try {
      await provider.loadFromEngineSession(session);
    } on YogaSessionException catch (e) {
      if (!context.mounted) {
        provider.reset();
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.userMessage)),
      );
      return;
    } catch (_) {
      if (!context.mounted) {
        provider.reset();
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't load today's yoga.")),
      );
      return;
    }
    if (!context.mounted) {
      provider.reset();
      return;
    }
    context.go('/yoga/session');
  }

  /// S14-T5: state-focus 3-stage chain. Mirrors the cross-pillar flow —
  /// validates the session shape, checks for a resumable snapshot, and
  /// either resumes or starts fresh before navigating to the renamed
  /// [MultiPhaseSessionPage] under route `/session/state-focus`.
  static Future<void> _launchStateFocus(
    BuildContext context,
    SuggestedSession session,
  ) async {
    _validateStateFocusShape(session);

    final provider = context.read<StateFocusSessionProvider>();
    final storage = context.read<StorageService>();

    final existing = await provider.peekFromStorage(storage);
    if (!context.mounted) return;
    if (existing != null && _isFresh(existing.startedAt)) {
      switch (existing.quitIntent) {
        case 'pause':
          final choice = await _showResumeDialog(context, existing);
          if (!context.mounted) return;
          if (choice == _ResumeChoice.resume) {
            await provider.resumeFromStorage(storage);
            if (!context.mounted) return;
            context.go('/session/state-focus');
            return;
          } else if (choice == _ResumeChoice.discard) {
            await provider.discard(storage);
            if (!context.mounted) return;
          } else {
            return;
          }
          break;
        case 'end_early':
          await provider.discard(storage);
          if (!context.mounted) return;
          break;
        case null:
          await provider.resumeFromStorage(storage);
          if (!context.mounted) return;
          context.go('/session/state-focus');
          return;
      }
    }

    await provider.startFresh(session, storage: storage);
    if (!context.mounted) return;
    context.go('/session/state-focus');
  }

  /// Engine contract for state_focus (per S14-T5 pre-flight Gate 1):
  ///   - session_shape == 'state_focus'
  ///   - exactly 3 phases: ['centering', 'practice', 'reflection']
  ///   - all items content_type == 'breathwork'
  ///   - centering + practice: content_id != null
  ///   - reflection: content_id == null (the silent-timer signal)
  static void _validateStateFocusShape(SuggestedSession s) {
    if (s.sessionShape != 'state_focus') {
      throw StateError(
        'expected state_focus, got ${s.sessionShape}',
      );
    }
    if (s.phases.length != 3) {
      throw StateError(
        'state_focus must have 3 phases, got ${s.phases.length}',
      );
    }
    const expectedPhases = ['centering', 'practice', 'reflection'];
    for (int i = 0; i < 3; i++) {
      final phase = s.phases[i];
      if (phase.phase != expectedPhases[i]) {
        throw StateError(
          'phase $i expected ${expectedPhases[i]}, got ${phase.phase}',
        );
      }
      if (phase.items.isEmpty) {
        throw StateError('phase ${phase.phase} has no items');
      }
      final item = phase.items.first;
      if (item.contentType != 'breathwork') {
        throw StateError(
          'state_focus item content_type must be breathwork, '
          'got ${item.contentType} on ${phase.phase}',
        );
      }
      if (i < 2 && item.contentId == null) {
        throw StateError(
          '${phase.phase} must have non-null content_id',
        );
      }
      if (i == 2 && item.contentId != null) {
        throw StateError(
          'reflection must have null content_id; got ${item.contentId}',
        );
      }
    }
  }

  static Future<void> _launchCrossPillar(
    BuildContext context,
    SuggestedSession session,
  ) async {
    // The orchestrator iterates by phases.length; we only assert the array
    // is non-empty. Mobility (Shape A) is 5-phase; biceps (per AMENDMENT-1)
    // is 4-phase; everything else is 5-phase. All shapes are valid.
    if (session.phases.isEmpty) {
      throw StateError('cross_pillar session has no phases');
    }
    final focusSlug = session.metadata.focusSlug;
    if (focusSlug == null || focusSlug.isEmpty) {
      throw StateError(
        'cross_pillar session metadata.focus_slug is required',
      );
    }

    final provider = context.read<CrossPillarSessionProvider>();
    final storage = context.read<StorageService>();

    final existing = await provider.peekFromStorage(storage);
    if (!context.mounted) return;
    if (existing != null && _isFresh(existing.startedAt)) {
      // S14-T4 quit-intent semantics (spec §6):
      //   null      — intent (a) app killed; auto-resume silently
      //   'pause'   — intent (b) explicit save-and-quit; prompt to resume
      //   'end_early' — defensive: blob shouldn't exist after end_early
      //                 cleared storage; treat as discard.
      switch (existing.quitIntent) {
        case 'pause':
          final choice = await _showResumeDialog(context, existing);
          if (!context.mounted) return;
          if (choice == _ResumeChoice.resume) {
            await provider.resumeFromStorage(storage);
            if (!context.mounted) return;
            context.go('/session/cross-pillar');
            return;
          } else if (choice == _ResumeChoice.discard) {
            await provider.discard(storage);
            if (!context.mounted) return;
            // Fall through to fresh-start path below.
          } else {
            return; // User dismissed — leave the saved session intact.
          }
          break;
        case 'end_early':
          await provider.discard(storage);
          if (!context.mounted) return;
          // Fall through to fresh-start path below.
          break;
        case null:
          // App-killed path — auto-resume silently, no prompt.
          await provider.resumeFromStorage(storage);
          if (!context.mounted) return;
          context.go('/session/cross-pillar');
          return;
      }
    }

    await provider.startFresh(session, storage: storage);
    if (!context.mounted) return;
    context.go('/session/cross-pillar');
  }

  /// 24h freshness window for the in-progress orchestrator snapshot. Locked
  /// in spec §9 drift log.
  static bool _isFresh(DateTime startedAt) {
    return DateTime.now().difference(startedAt) < const Duration(hours: 24);
  }

  static Future<_ResumeChoice?> _showResumeDialog(
    BuildContext context,
    MultiPhaseSessionSnapshot snapshot,
  ) async {
    final focusSlug = snapshot.session.metadata.focusSlug ?? 'session';
    return showDialog<_ResumeChoice>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Resume in-progress session?'),
        content: Text(
          'You have an in-progress $focusSlug session. '
          'Resume where you left off, or start fresh?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _ResumeChoice.discard),
            child: const Text('Start fresh'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, _ResumeChoice.resume),
            child: const Text('Resume'),
          ),
        ],
      ),
    );
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

enum _ResumeChoice { resume, discard }

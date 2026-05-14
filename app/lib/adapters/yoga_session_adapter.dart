// FS #203 A2: relocated from launchers/ to adapters/ as part of the yoga
// adapter polish bundle. `YogaPoseDetails` moved to models/.
//
// FS #203 W2: typed exception hierarchy (YogaContractException +
// YogaHydrationException). Pre-fix, the adapter threw StateError with
// freeform messages and the launcher substring-matched them for friendly
// copy. Post-fix, the launcher switches on exception type.

import '../models/suggested_session.dart';
import '../models/yoga_models.dart';
import '../models/yoga_pose_details.dart';
import 'yoga_session_errors.dart';

const _enginePhaseToYogaPhase = {
  'warmup': 'warmup',
  'main': 'peak',
  'cooldown': 'cooldown',
};

/// Pure function: convert an engine `pillar_pure` yoga session + a hydration
/// map to a [YogaSession] the player can consume.
///
/// Throws [YogaContractException] on engine-shape violations and
/// [YogaHydrationException] on missing pose-lookup entries. Strict-mode is
/// locked (S14-T3 spec §4.5) — every violation is surfaced; the launcher's
/// friendly snackbar wrapper translates user-facing copy.
YogaSession yogaSessionFromEngine({
  required SuggestedSession session,
  required Map<int, YogaPoseDetails> hydratedById,
}) {
  if (session.sessionShape != 'pillar_pure') {
    throw YogaContractException(
      'yoga adapter requires pillar_pure shape, got ${session.sessionShape}',
    );
  }
  if (session.phases.isEmpty) {
    throw YogaContractException('yoga session has no phases');
  }
  final focusSlug = session.metadata.focusSlug;
  if (focusSlug == null || focusSlug.isEmpty) {
    throw YogaContractException('yoga session metadata.focus_slug is required');
  }

  final poses = <YogaPose>[];
  var totalMinutes = 0;

  for (final phase in session.phases) {
    final mappedPhase = _enginePhaseToYogaPhase[phase.phase];
    if (mappedPhase == null) {
      throw YogaContractException('unknown yoga phase token: ${phase.phase}');
    }
    if (phase.items.isEmpty) {
      // Skip silently per spec §4.5 — surface as engine bug elsewhere if needed.
      continue;
    }
    for (final item in phase.items) {
      if (item.contentType != 'yoga') {
        throw YogaContractException(
          'yoga adapter received non-yoga item: ${item.contentType}#${item.contentId}',
        );
      }
      final id = item.contentId;
      if (id == null) {
        throw YogaContractException('yoga item missing content_id');
      }
      final durationMin = item.durationMinutes;
      if (durationMin == null || durationMin <= 0) {
        throw YogaContractException('yoga item has non-positive duration');
      }
      final details = hydratedById[id];
      if (details == null) {
        throw YogaHydrationException('hydration incomplete: missing pose id $id');
      }
      poses.add(YogaPose(
        id: id,
        name: details.name,
        sanskritName: details.sanskritName,
        description: details.description,
        phase: mappedPhase,
        targetMuscles: details.targetMuscles,
        holdSeconds: durationMin * 60,
        difficulty: details.difficulty,
      ));
      totalMinutes += durationMin;
    }
  }

  if (poses.isEmpty) {
    throw YogaContractException('yoga session has no poses');
  }

  final yogaLevel = session.metadata.userLevels['yoga'];
  final level = (yogaLevel != null && yogaLevel.isNotEmpty)
      ? yogaLevel
      : 'beginner';

  return YogaSession(
    // S14-T6 §6.6 / AMENDMENT-1 Decision B: 3-tier yoga style fallback.
    // Engine-emitted `metadata.source` wins (Decision A); 'vinyasa' is the
    // final hard fallback. The middle tier ("stored yoga_style on session
    // object") collapses to the same field — engine output is the only
    // store the client has access to at session-start time.
    type: resolveSessionStyle(session),
    level: level,
    duration: totalMinutes,
    focus: [focusSlug],
    poses: poses,
    totalMinutes: totalMinutes,
    poseCount: poses.length,
  );
}

/// S14-T6 §6.6 / AMENDMENT-1 Decision B: 3-tier client-side yoga style
/// fallback. Used by the adapter at session-construct time and (if needed)
/// by the swap layer when re-resolving for a mid-session alternative.
///
/// Order:
///   1. `session.metadata.source`     (engine-emitted; Decision A)
///   2. session.metadata.* yoga style equivalents (none today — slot
///      kept for forward-compat if the engine ever splits style out)
///   3. `'vinyasa'`                   (hard fallback)
String resolveSessionStyle(SuggestedSession session) {
  final emitted = session.metadata.source;
  if (emitted != null && emitted.isNotEmpty) return emitted;
  return 'vinyasa';
}

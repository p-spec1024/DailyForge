// FS #204: yoga adapter unit tests (S14-T6 AMENDMENT-1 §3, 15 cases).
//
// Twelve cases lock the engine→player adapter contract (`yogaSessionFromEngine`)
// per spec §6.9; three lock `resolveSessionStyle`'s fallback chain per
// AMENDMENT-1 §3 (Decision B). A trailing W-2.1.1 regression test pins the
// post-Commit-3 userMessage copy.

import 'package:dailyforge/adapters/yoga_session_adapter.dart';
import 'package:dailyforge/adapters/yoga_session_errors.dart';
import 'package:dailyforge/models/suggested_session.dart';
import 'package:dailyforge/models/yoga_pose_details.dart';
import 'package:flutter_test/flutter_test.dart';

// ---------------------------------------------------------------------------
// Fixture helpers — keep each test's setup short and intention-focused.
// ---------------------------------------------------------------------------

SessionItem _yogaItem({
  int? contentId = 1,
  int? durationMinutes = 5,
  String name = 'Mountain Pose',
  String contentType = 'yoga',
}) {
  return SessionItem(
    contentType: contentType,
    contentId: contentId,
    name: name,
    durationMinutes: durationMinutes,
    tierBadge: null,
    sets: null,
    reps: null,
  );
}

SessionPhase _phase(String phase, List<SessionItem> items) {
  return SessionPhase(phase: phase, items: items);
}

SessionMetadata _meta({
  String? focusSlug = 'hamstrings',
  String? source,
  Map<String, String> userLevels = const {'yoga': 'intermediate'},
  int estimatedTotalMin = 30,
}) {
  return SessionMetadata(
    estimatedTotalMin: estimatedTotalMin,
    userLevels: userLevels,
    isEndless: null,
    bracket: null,
    focusSlug: focusSlug,
    source: source,
  );
}

SuggestedSession _session({
  String sessionShape = 'pillar_pure',
  required List<SessionPhase> phases,
  SessionMetadata? metadata,
}) {
  return SuggestedSession(
    sessionShape: sessionShape,
    phases: phases,
    warnings: const [],
    metadata: metadata ?? _meta(),
  );
}

YogaPoseDetails _poseDetails(int id, {String name = 'Pose'}) {
  return YogaPoseDetails(
    id: id,
    name: '$name #$id',
    sanskritName: null,
    description: null,
    targetMuscles: null,
    difficulty: 'beginner',
  );
}

Map<int, YogaPoseDetails> _hydrated(List<int> ids) {
  return {for (final id in ids) id: _poseDetails(id)};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('yogaSessionFromEngine — engine→player contract (spec §6.9)', () {
    test('case 1: phase remap main → peak', () {
      final session = _session(phases: [
        _phase('main', [_yogaItem()]),
      ]);

      final result = yogaSessionFromEngine(
        session: session,
        hydratedById: _hydrated([1]),
      );

      expect(result.poses, hasLength(1));
      expect(result.poses.first.phase, 'peak');
    });

    test('case 2: throws YogaContractException on non-pillar_pure shape', () {
      final session = _session(
        sessionShape: 'cross_pillar',
        phases: [_phase('main', [_yogaItem()])],
      );

      expect(
        () => yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1]),
        ),
        throwsA(isA<YogaContractException>()),
      );
    });

    test('case 3: throws YogaContractException on missing focus_slug', () {
      final session = _session(
        phases: [_phase('main', [_yogaItem()])],
        metadata: _meta(focusSlug: null),
      );

      expect(
        () => yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1]),
        ),
        throwsA(isA<YogaContractException>()),
      );
    });

    test('case 4: throws YogaContractException on unknown phase token', () {
      final session = _session(phases: [
        _phase('nonsense', [_yogaItem()]),
      ]);

      expect(
        () => yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1]),
        ),
        throwsA(isA<YogaContractException>()),
      );
    });

    test(
      'case 5: throws YogaContractException on null content_id '
      '(contract violation, not hydration miss)',
      () {
        // Divergence from directive: code throws YogaContractException, not
        // YogaHydrationException, because a yoga item with no id is engine
        // misbehavior (e.g. reflection phase leaked through), not a
        // lookup miss. Pinning the actual contract.
        final session = _session(phases: [
          _phase('main', [_yogaItem(contentId: null)]),
        ]);

        expect(
          () => yogaSessionFromEngine(
            session: session,
            hydratedById: const {},
          ),
          throwsA(isA<YogaContractException>()),
        );
      },
    );

    test('case 6: throws YogaContractException on non-positive duration', () {
      final session = _session(phases: [
        _phase('main', [_yogaItem(durationMinutes: 0)]),
      ]);

      expect(
        () => yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1]),
        ),
        throwsA(isA<YogaContractException>()),
      );
    });

    test(
      'case 7: throws YogaHydrationException on missing hydration entry '
      'AND surfaces honest user copy (W-2.1.1 regression guard)',
      () {
        // Engine emits id=99 but hydration map doesn't contain it. The
        // adapter throws YogaHydrationException — the launcher uses its
        // userMessage to drive the snackbar copy. Asserting the typed
        // exception AND the post-W-2.1.1 copy locks down both contracts.
        final session = _session(phases: [
          _phase('main', [_yogaItem(contentId: 99)]),
        ]);

        Object? caught;
        try {
          yogaSessionFromEngine(
            session: session,
            hydratedById: _hydrated([1]), // 99 deliberately absent
          );
        } catch (e) {
          caught = e;
        }

        expect(caught, isA<YogaHydrationException>());
        final e = caught as YogaHydrationException;
        expect(e.userMessage, isNotEmpty);
        expect(e.userMessage.toLowerCase(),
            isNot(contains('tap to retry')));
      },
    );

    test('case 8: holdSeconds == durationMinutes × 60', () {
      final session = _session(phases: [
        _phase('main', [_yogaItem(durationMinutes: 5)]),
      ]);

      final result = yogaSessionFromEngine(
        session: session,
        hydratedById: _hydrated([1]),
      );

      expect(result.poses.first.holdSeconds, 5 * 60);
      // Sanity: totalMinutes mirrors the sum of durationMinutes.
      expect(result.totalMinutes, 5);
    });

    test(
      'case 9: level falls back to "beginner" when userLevels.yoga absent',
      () {
        final session = _session(
          phases: [_phase('main', [_yogaItem()])],
          metadata: _meta(userLevels: const {}), // no 'yoga' key
        );

        final result = yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1]),
        );

        expect(result.level, 'beginner');
      },
    );

    test(
      'case 10: type hard-defaults to "vinyasa" when metadata.source null',
      () {
        final session = _session(
          phases: [_phase('main', [_yogaItem()])],
          metadata: _meta(source: null),
        );

        final result = yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1]),
        );

        expect(result.type, 'vinyasa');
      },
    );

    test(
      'case 11: empty phases skipped silently (does not throw)',
      () {
        // Spec §4.5: empty phases are tolerated as a soft contract dip.
        // Adapter must NOT throw when warmup/cooldown are emitted with
        // empty items lists, as long as at least one phase has items.
        final session = _session(phases: [
          _phase('warmup', const []),
          _phase('main', [_yogaItem(contentId: 1)]),
          _phase('cooldown', const []),
        ]);

        final result = yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1]),
        );

        expect(result.poses, hasLength(1));
        expect(result.poses.first.phase, 'peak');
      },
    );

    test(
      'case 12: multi-phase ordering preserved (warmup → main → cooldown)',
      () {
        final session = _session(phases: [
          _phase('warmup', [_yogaItem(contentId: 1)]),
          _phase('main', [_yogaItem(contentId: 2)]),
          _phase('cooldown', [_yogaItem(contentId: 3)]),
        ]);

        final result = yogaSessionFromEngine(
          session: session,
          hydratedById: _hydrated([1, 2, 3]),
        );

        expect(result.poses.map((p) => p.id).toList(), [1, 2, 3]);
        expect(
          result.poses.map((p) => p.phase).toList(),
          ['warmup', 'peak', 'cooldown'],
        );
      },
    );
  });

  group('resolveSessionStyle — fallback chain (AMENDMENT-1 §3)', () {
    test(
      'case 13: returns engine-emitted source when it is a known style',
      () {
        final session = _session(
          phases: [_phase('main', [_yogaItem()])],
          metadata: _meta(source: 'hatha'),
        );

        expect(resolveSessionStyle(session), 'hatha');
      },
    );

    test(
      'case 14: falls back to "vinyasa" when source is an unknown style '
      '(Commit 2.1 S-2 allowlist gate)',
      () {
        // Note: directive's original §B case 14 referenced session.yogaStyle
        // which does not exist on SuggestedSession (the 3-tier doc's tier 2
        // is forward-compat-only). Re-targeted to lock S-2's allowlist
        // gate, which is the 2nd of resolveSessionStyle's three real
        // branches.
        final session = _session(
          phases: [_phase('main', [_yogaItem()])],
          metadata: _meta(source: 'power_hatha'), // not in _kKnownYogaStyles
        );

        expect(resolveSessionStyle(session), 'vinyasa');
      },
    );

    test(
      'case 15: falls back to "vinyasa" when source is null (hard fallback)',
      () {
        final session = _session(
          phases: [_phase('main', [_yogaItem()])],
          metadata: _meta(source: null),
        );

        expect(resolveSessionStyle(session), 'vinyasa');
      },
    );
  });

  group('W-2.1.1 — YogaHydrationException copy honesty', () {
    test(
      'userMessage does not promise tap-to-retry '
      '(launcher snackbar has no Retry action)',
      () {
        // Direct construction test: locks the post-Commit-3 copy. If a
        // future change re-introduces "tap to retry" without also adding a
        // SnackBarAction in session_launcher.dart, this test fails loudly
        // before the dishonest copy reaches users.
        final e = YogaHydrationException('test message');
        expect(e.userMessage, isNotEmpty);
        expect(e.userMessage.toLowerCase(),
            isNot(contains('tap to retry')));
      },
    );
  });
}

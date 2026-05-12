import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../models/completed_phase_snapshot.dart';
import '../../models/suggested_session.dart';
import '../../players/breathwork_player.dart';
import '../../players/phase_metadata.dart';
import '../../players/phase_result.dart';
import '../../players/silent_timer_player.dart';
import '../../players/strength_player.dart';
import '../../players/yoga_session_player.dart';
import '../../providers/cross_pillar_session_provider.dart';
import '../../providers/multi_phase_session_provider.dart';
import '../../providers/state_focus_session_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../services/wakelock_service.dart';
import '../../utils/phase_label.dart';
import 'session_summary_page.dart';
import 'widgets/auto_advance_overlay.dart';
import 'widgets/phase_indicator.dart';
import 'widgets/phase_preview_sheet.dart';

/// Multi-phase orchestrator screen. Hosts:
///
/// * **5-phase cross_pillar** sessions (T4 — bookend_open / warmup / main /
///   cooldown / bookend_close), with the T4 3s auto-advance countdown
///   between phases.
/// * **3-stage state_focus** sessions (T5 — centering / practice /
///   reflection), with a smooth 300ms fade between stages (no countdown).
///
/// The page is provider-shape-aware via the `sessionShape` constructor arg
/// passed from the route. The route resolves the matching concrete
/// provider (`CrossPillarSessionProvider` or `StateFocusSessionProvider`),
/// both of which implement [MultiPhaseSessionProvider].
class MultiPhaseSessionPage extends StatefulWidget {
  /// 'cross_pillar' | 'state_focus'. Drives provider resolution.
  final String sessionShape;

  const MultiPhaseSessionPage({super.key, required this.sessionShape});

  @override
  State<MultiPhaseSessionPage> createState() => _MultiPhaseSessionPageState();
}

class _MultiPhaseSessionPageState extends State<MultiPhaseSessionPage> {
  bool _showCountdown = false;
  String _nextPhaseLabel = '';

  // S14-T6 Commit 1.5 (retest #1 follow-up) — once we've scheduled the
  // navigation to /session/summary, suppress the defensive null-session
  // bail in build() unconditionally. go_router keeps this page mounted
  // during the route-transition animation; the provider's deferred
  // complete() clears session state during that window, and the bail
  // would otherwise fire `context.go('/home')` and pre-empt the summary.
  // The Router will dispose this page when the transition finishes; the
  // flag just keeps build() from racing it.
  bool _navigatingToSummary = false;

  // S14-T6 Commit 1.5 — top-anchored undo banner state. Held on the page
  // so dispose() can clean up before the OverlayEntry leaks.
  OverlayEntry? _undoEntry;
  Timer? _undoTimer;

  @override
  void initState() {
    super.initState();
    WakelockService.enable();
  }

  @override
  void dispose() {
    _dismissUndoBanner();
    WakelockService.disable();
    super.dispose();
  }

  /// S14-T6 Commit 1.5 — top-anchored, auto-dismissing undo banner.
  ///
  /// Replaces ScaffoldMessenger.showSnackBar (bottom-anchored, sometimes
  /// failed to auto-dismiss because surrounding rebuilds re-emitted it).
  /// Manual OverlayEntry + Timer gives us deterministic 3s dismissal and
  /// the top placement spec §6.2 called for.
  ///
  /// Double-trigger safe: a second call dismisses the first banner before
  /// showing the new one. Disposed cleanly via [_dismissUndoBanner] from
  /// the page's dispose().
  void _showUndoBanner({
    required String phaseLabel,
    required Future<void> Function() onUndo,
  }) {
    _dismissUndoBanner();
    final overlay = Overlay.of(context, rootOverlay: true);
    final entry = OverlayEntry(
      builder: (ctx) {
        return Positioned(
          top: MediaQuery.of(ctx).padding.top + 8,
          left: 16,
          right: 16,
          child: SafeArea(
            bottom: false,
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cardBorder),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '$phaseLabel skipped',
                        style: const TextStyle(
                          color: AppColors.primaryText,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () async {
                        _dismissUndoBanner();
                        await onUndo();
                      },
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.gold,
                        padding:
                            const EdgeInsets.symmetric(horizontal: 14),
                        minimumSize: const Size(0, 32),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'UNDO',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
    overlay.insert(entry);
    _undoEntry = entry;
    _undoTimer = Timer(const Duration(seconds: 3), _dismissUndoBanner);
  }

  void _dismissUndoBanner() {
    _undoTimer?.cancel();
    _undoTimer = null;
    final entry = _undoEntry;
    _undoEntry = null;
    if (entry != null && entry.mounted) {
      entry.remove();
    }
  }

  /// Reads the concrete subclass provider for the active session shape,
  /// upcast to the base type so the page only depends on shared API.
  MultiPhaseSessionProvider _provider(BuildContext context, {bool listen = true}) {
    if (widget.sessionShape == 'state_focus') {
      return listen
          ? context.watch<StateFocusSessionProvider>()
          : context.read<StateFocusSessionProvider>();
    }
    return listen
        ? context.watch<CrossPillarSessionProvider>()
        : context.read<CrossPillarSessionProvider>();
  }

  @override
  Widget build(BuildContext context) {
    final provider = _provider(context);
    final session = provider.session;
    if (session == null) {
      // S14-T6 Commit 1.5: if we already scheduled a navigation to summary,
      // do NOT bail home — the Router is mid-transition and the page is
      // about to be disposed. Bailing here would race + pre-empt the
      // summary nav (the original Bug 1 mechanism). Just render an empty
      // frame while the Router finishes the transition.
      if (_navigatingToSummary) {
        return const SizedBox.shrink();
      }
      // Defensive: launcher pre-seeds, so this shouldn't fire on a
      // normal entry. Bail home rather than crash.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/home');
      });
      return const SizedBox.shrink();
    }

    final currentPhase = session.phases[provider.currentPhaseIndex];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _focusTitle(session.metadata.focusSlug),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => _showCloseSheet(context, provider),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.format_list_numbered),
            tooltip: 'All phases',
            onPressed: () => _showPreview(context, session, provider),
          ),
        ],
        // AMENDMENT-1 D7: stage-name subtitle. State-focus needs this — all
        // three stages are breathwork, so the focus name alone ("Calm")
        // doesn't tell the user which stage they're in. Cross-pillar also
        // benefits (clearer phase context).
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(24),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Text(
              _phaseLabel(currentPhase),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          Column(
            children: [
              PhaseIndicator(
                phaseCount: session.phases.length,
                currentIndex: provider.currentPhaseIndex,
                statuses: provider.statuses,
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  switchInCurve: Curves.easeOut,
                  switchOutCurve: Curves.easeIn,
                  child: _buildPhaseBody(context, currentPhase, session, provider),
                ),
              ),
              _PhaseActionBar(
                provider: provider,
                isStateFocus: widget.sessionShape == 'state_focus',
                onSkip: () => _handleSkip(context, provider),
              ),
            ],
          ),
          if (_showCountdown && provider.useAutoAdvanceCountdown)
            AutoAdvanceOverlay(
              nextPhaseLabel: _nextPhaseLabel,
              onAdvance: () => _dismissCountdown(provider),
              onPause: () => _onCountdownPause(provider),
            ),
        ],
      ),
    );
  }

  Widget _buildPhaseBody(
    BuildContext context,
    SessionPhase phase,
    SuggestedSession session,
    MultiPhaseSessionProvider provider,
  ) {
    final levels = session.metadata.userLevels;
    final isEndless = session.metadata.isEndless ?? false;
    final metadata = PhaseMetadata.fromSessionPhase(
      phase,
      focusSlug: session.metadata.focusSlug,
      userLevels: levels,
      isEmbedded: true,
      isEndless: isEndless,
    );
    final phaseKey =
        ValueKey('phase-${provider.currentPhaseIndex}-${phase.phase}');
    final firstItem = phase.items.isNotEmpty ? phase.items.first : null;

    // S14-T5 reflection guard: state-focus reflection emits
    // contentType: 'breathwork', contentId: null — route to silent timer
    // BEFORE the content_type switch so BreathworkPlayer never receives a
    // null technique id.
    if (firstItem != null &&
        firstItem.contentType == 'breathwork' &&
        firstItem.contentId == null) {
      return SilentTimerPlayer(
        key: phaseKey,
        isEmbedded: true,
        phaseMetadata: metadata,
        onPhaseComplete: (r) => _handlePhaseComplete(context, r),
      );
    }

    switch (metadata.contentType) {
      case 'strength':
        return StrengthPlayer(
          key: phaseKey,
          isEmbedded: true,
          phaseMetadata: metadata,
          onPhaseComplete: (r) => _handlePhaseComplete(context, r),
        );
      case 'yoga':
        return YogaSessionPlayer(
          key: phaseKey,
          isEmbedded: true,
          phaseMetadata: metadata,
          onPhaseComplete: (r) => _handlePhaseComplete(context, r),
        );
      case 'breathwork':
        return BreathworkPlayer(
          key: phaseKey,
          isEmbedded: true,
          phaseMetadata: metadata,
          onPhaseComplete: (r) => _handlePhaseComplete(context, r),
        );
      default:
        throw StateError(
          'unknown content_type for orchestrator phase: ${metadata.contentType}',
        );
    }
  }

  Future<void> _handlePhaseComplete(
    BuildContext context,
    PhaseResult result,
  ) async {
    final provider = _provider(context, listen: false);
    final storage = context.read<StorageService>();
    final api = context.read<ApiService>();
    await provider.completeCurrentPhase(result, storage: storage);
    if (!context.mounted) return;
    if (provider.allPhasesDone) {
      // S14-T6 §6.1: snapshot args BEFORE complete() resets _phaseResults.
      final args = _buildSummaryArgs(provider);
      // S14-T6 Commit 1.5 (retest #1): set the suppress-bail flag BEFORE
      // navigating. go_router keeps this page mounted through the route-
      // transition animation; during that window provider.complete() runs
      // and clears session state. The flag tells build() not to bail home
      // when it sees the null session — the Router will dispose us.
      // Without the flag, the bail wins the race (intermittently) and the
      // summary flashes for ~50ms before being replaced by home.
      _navigatingToSummary = true;
      context.go('/session/summary', extra: args);
      // ignore: unawaited_futures — fire-and-forget. The page is gone from
      // the tree once the transition completes; backend write errors are
      // swallowed inside _writeMultiPhaseSessionRow.
      provider.complete(storage: storage, api: api);
      return;
    }
    if (provider.useAutoAdvanceCountdown) {
      final next = provider.session!.phases[provider.currentPhaseIndex];
      setState(() {
        _showCountdown = true;
        _nextPhaseLabel = _phaseLabel(next);
      });
    }
    // State-focus: no countdown. AnimatedSwitcher fades the new phase body in.
  }

  Future<void> _dismissCountdown(MultiPhaseSessionProvider provider) async {
    setState(() {
      _showCountdown = false;
    });
  }

  Future<void> _onCountdownPause(MultiPhaseSessionProvider provider) async {
    final storage = context.read<StorageService>();
    await provider.pause(storage: storage);
  }

  Future<void> _handleSkip(
    BuildContext context,
    MultiPhaseSessionProvider provider,
  ) async {
    final storage = context.read<StorageService>();
    final api = context.read<ApiService>();

    // S14-T6 §6.2: confirm dialog for both shapes (cross-pillar previously
    // single-tap; state-focus already had this). Calm-session users may be
    // in emotionally sensitive states; cross-pillar users benefit from a
    // misclick guard before losing the phase's elapsed work.
    final confirmed = await _showSkipConfirmSheet(context, provider);
    if (!context.mounted || confirmed != true) return;

    final phaseLabel = _phaseLabel(provider.session!.phases[provider.currentPhaseIndex]);
    await provider.skipCurrentPhase(storage: storage);
    if (!context.mounted) return;

    if (provider.allPhasesDone) {
      // Final-phase skip: skip the undo window and go straight to summary
      // (the undo banner would be displaced by the summary navigation).
      // Same retest #1 pattern as _handlePhaseComplete — set the flag
      // before context.go so the build()-defensive bail doesn't fire
      // when complete()'s deferred notification clears session state
      // during the route-transition window.
      final args = _buildSummaryArgs(provider);
      _navigatingToSummary = true;
      context.go('/session/summary', extra: args);
      // ignore: unawaited_futures
      provider.complete(storage: storage, api: api);
      return;
    }
    // S14-T6 §6.2 / Commit 1.5: top-anchored, auto-dismissing undo banner.
    _showUndoBanner(
      phaseLabel: phaseLabel,
      onUndo: () async {
        final ok = await provider.undoLastSkip(storage: storage);
        if (!ok || !mounted) return;
      },
    );
  }

  /// Composes the summary page args from the provider's current state.
  /// Must be called BEFORE [MultiPhaseSessionProvider.complete] resets
  /// `_phaseResults`.
  SessionSummaryArgs _buildSummaryArgs(MultiPhaseSessionProvider provider) {
    final session = provider.session!;
    final results = provider.phaseResults;
    // Map phase index → PhaseResult so we can pair engine phases with the
    // player's actual durations + skip flags.
    final byIndex = <int, PhaseResult>{};
    for (var i = 0; i < results.length && i < session.phases.length; i++) {
      byIndex[i] = results[i];
    }
    final phases = <CompletedPhaseSnapshot>[];
    final skippedLabels = <String>[];
    var totalSeconds = 0;
    for (var i = 0; i < session.phases.length; i++) {
      final p = session.phases[i];
      final r = byIndex[i];
      final ct = p.items.isNotEmpty ? p.items.first.contentType : null;
      final label = phaseDisplayLabel(p.phase, contentType: ct);
      final dur = r?.actualDuration.inSeconds ?? 0;
      final skipped = r?.wasSkipped ?? false;
      final firstItem = p.items.isNotEmpty ? p.items.first : null;
      phases.add(CompletedPhaseSnapshot(
        phaseLabel: label,
        phaseSlug: p.phase,
        durationSeconds: skipped ? 0 : dur,
        wasSkipped: skipped,
        primaryContentName: firstItem?.name,
      ));
      if (skipped) skippedLabels.add(label);
      if (!skipped) totalSeconds += dur;
    }
    return SessionSummaryArgs(
      sessionShape: widget.sessionShape,
      focusSlug: session.metadata.focusSlug ?? 'unknown',
      focusDisplayName: _focusTitle(session.metadata.focusSlug),
      phases: phases,
      skippedPhaseLabels: skippedLabels,
      totalSeconds: totalSeconds,
      userLevels: Map<String, String>.from(session.metadata.userLevels),
    );
  }

  Future<bool?> _showSkipConfirmSheet(
    BuildContext context,
    MultiPhaseSessionProvider provider,
  ) async {
    final session = provider.session;
    if (session == null) return false;
    final phase = session.phases[provider.currentPhaseIndex];
    final label = phaseDisplayLabel(
      phase.phase,
      contentType: phase.items.isNotEmpty ? phase.items.first.contentType : null,
    );
    return showModalBottomSheet<bool>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Skip ${label.toLowerCase()}?',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              const Text(
                'This stage will be marked as skipped in your session log.',
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Skip this stage'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Stay here'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showPreview(
    BuildContext context,
    SuggestedSession session,
    MultiPhaseSessionProvider provider,
  ) {
    showModalBottomSheet(
      context: context,
      builder: (_) => PhasePreviewSheet(
        phases: session.phases,
        currentIndex: provider.currentPhaseIndex,
        statuses: provider.statuses,
        currentPhaseElapsedSeconds: provider.currentPhaseElapsedSeconds,
      ),
    );
  }

  Future<void> _showCloseSheet(
    BuildContext context,
    MultiPhaseSessionProvider provider,
  ) async {
    final storage = context.read<StorageService>();
    final api = context.read<ApiService>();
    final choice = await showModalBottomSheet<_CloseChoice>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('End session?',
                  style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => Navigator.of(ctx).pop(_CloseChoice.saveQuit),
                icon: const Icon(Icons.bookmark_outline),
                label: const Text('Save and quit (resume later)'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(ctx).pop(_CloseChoice.endEarly),
                icon: const Icon(Icons.stop_circle_outlined),
                label: const Text('End early (log progress)'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(_CloseChoice.cancel),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ),
      ),
    );
    if (!context.mounted) return;
    switch (choice) {
      case _CloseChoice.saveQuit:
        await provider.pauseAndQuit(storage: storage);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Session paused — resume from home next time.'),
          ),
        );
        context.go('/home');
        break;
      case _CloseChoice.endEarly:
        final count = provider.phasesCompletedCount;
        final noun = provider.phasesNoun(count);
        await provider.endEarly(storage: storage, api: api);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Session ended — $count $noun logged.')),
        );
        context.go('/home');
        break;
      case _CloseChoice.cancel:
      case null:
        break;
    }
  }

  String _focusTitle(String? slug) {
    if (slug == null || slug.isEmpty) return 'Session';
    return slug
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  String _phaseLabel(SessionPhase phase) => phaseDisplayLabel(
        phase.phase,
        contentType:
            phase.items.isNotEmpty ? phase.items.first.contentType : null,
      );
}

enum _CloseChoice { saveQuit, endEarly, cancel }

class _PhaseActionBar extends StatelessWidget {
  final MultiPhaseSessionProvider provider;
  final bool isStateFocus;
  final VoidCallback onSkip;

  const _PhaseActionBar({
    required this.provider,
    required this.isStateFocus,
    required this.onSkip,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            TextButton(
              onPressed: onSkip,
              child: Text(isStateFocus ? 'Skip stage' : 'Skip phase'),
            ),
            const Spacer(),
            IconButton(
              icon: Icon(provider.paused ? Icons.play_arrow : Icons.pause),
              tooltip: provider.paused ? 'Resume' : 'Pause',
              onPressed: () async {
                final storage = context.read<StorageService>();
                if (provider.paused) {
                  await provider.resume(storage: storage);
                } else {
                  await provider.pause(storage: storage);
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

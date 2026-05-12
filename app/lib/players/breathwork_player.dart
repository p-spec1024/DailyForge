import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../models/breathwork_technique.dart';
import '../providers/breathwork_timer_provider.dart';
import '../services/api_service.dart';
import '../services/breathwork_service.dart';
import '../widgets/breathwork/breath_circle.dart';
import '../widgets/breathwork/safety_warning_modal.dart';
import '../widgets/breathwork/session_summary.dart';
import '../widgets/breathwork/timer_controls.dart';
import 'embeddable_player.dart';
import 'phase_metadata.dart';
import 'phase_result.dart';

String _fmtElapsedStatic(int s) {
  final m = (s ~/ 60).toString().padLeft(2, '0');
  final sec = (s % 60).toString().padLeft(2, '0');
  return '$m:$sec';
}

/// S14-T4: extracted breathwork body widget. Renders inside
/// [BreathworkTimerPage]'s Scaffold shell for standalone use, or directly
/// inside [FivePhaseSessionPage] for cross-pillar phases 1 (bookend_open)
/// and 5 (bookend_close).
///
/// Standalone-mode contract: takes a [techniqueId] route arg, fetches the
/// technique, shows the pre-start safety/begin view, then runs the timer
/// for the full protocol cycle count. Existing behavior preserved.
///
/// Embedded-mode contract: takes the engine-supplied technique via
/// [phaseMetadata.items.first.contentId], skips pre-start view (auto-
/// begins on phase enter), honors [phaseMetadata.durationMinutes] as a
/// hard cap (AMENDMENT-1 D3 + spec Anomaly #11 simplest version), skips
/// the summary screen, and emits `onPhaseComplete` when the cap fires.
class BreathworkPlayer extends StatefulWidget {
  final bool isEmbedded;
  final PhaseMetadata phaseMetadata;
  final void Function(PhaseResult) onPhaseComplete;

  /// Standalone routes pass a techniqueId. Embedded mode ignores this and
  /// reads the id from [phaseMetadata.items.first.contentId].
  final int? techniqueId;

  const BreathworkPlayer({
    super.key,
    required this.isEmbedded,
    required this.phaseMetadata,
    required this.onPhaseComplete,
    this.techniqueId,
  });

  @override
  State<BreathworkPlayer> createState() => _BreathworkPlayerState();
}

class _BreathworkPlayerState extends State<BreathworkPlayer>
    with EmbeddablePlayer {
  @override
  bool get isEmbedded => widget.isEmbedded;

  @override
  PhaseMetadata get phaseMetadata => widget.phaseMetadata;

  @override
  void Function(PhaseResult) get onPhaseComplete => widget.onPhaseComplete;

  @override
  Widget build(BuildContext context) {
    final effectiveId = widget.techniqueId ??
        (widget.phaseMetadata.items.isNotEmpty
            ? widget.phaseMetadata.items.first.contentId
            : null);
    if (effectiveId == null) {
      return Center(
        child: Text(
          'No technique specified',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
      );
    }
    return ChangeNotifierProvider<BreathworkTimerProvider>(
      create: (ctx) => BreathworkTimerProvider(ctx.read<ApiService>()),
      child: _BreathworkBody(
        techniqueId: effectiveId,
        isEmbedded: widget.isEmbedded,
        phaseMetadata: widget.phaseMetadata,
        onPhaseComplete: widget.onPhaseComplete,
      ),
    );
  }
}

class _BreathworkBody extends StatefulWidget {
  final int techniqueId;
  final bool isEmbedded;
  final PhaseMetadata phaseMetadata;
  final void Function(PhaseResult) onPhaseComplete;

  const _BreathworkBody({
    required this.techniqueId,
    required this.isEmbedded,
    required this.phaseMetadata,
    required this.onPhaseComplete,
  });

  @override
  State<_BreathworkBody> createState() => _BreathworkBodyState();
}

class _BreathworkBodyState extends State<_BreathworkBody> {
  BreathworkTechnique? _technique;
  bool _loading = true;
  String? _error;
  bool _safetyAccepted = false;
  bool _completionFired = false;
  DateTime? _startedAt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<ApiService>();
      final service = BreathworkService(api);
      final t = await service.getTechnique(widget.techniqueId);
      if (!mounted) return;
      setState(() {
        _technique = t;
        _loading = false;
      });
      final provider = context.read<BreathworkTimerProvider>();
      if (widget.isEmbedded) {
        // S14-T6 §6.5: route through mode-aware start methods. Endless
        // (state-focus practice) uses startEndless — no cap, user-driven
        // completion. Capped (cross-pillar bookends, state-focus centering,
        // timed practice) uses startCapped — cycle-boundary completion
        // "always ≥ engine budget, never <" per Decision C.
        //
        // Embedded: skip safety modal (engine is trusted to pick safe-for-
        // bookend techniques) and auto-start. Pre-flight gate 4 confirmed
        // engine bookends are always green-tier.
        final isOpenEnded = widget.phaseMetadata.isEndless &&
            widget.phaseMetadata.phase == 'practice';
        final dur = widget.phaseMetadata.durationMinutes;
        _startedAt = DateTime.now();
        if (isOpenEnded) {
          provider.startEndless(
            technique: t,
            focusSlug: widget.phaseMetadata.focusSlug,
          );
        } else if (dur != null && dur > 0) {
          provider.startCapped(
            technique: t,
            maxDuration: Duration(minutes: dur),
            focusSlug: widget.phaseMetadata.focusSlug,
          );
        } else {
          // Embedded but no duration in metadata — defensive fallback to
          // full protocol. Engine should never emit this shape, but the
          // path is here so a missing field doesn't crash the player.
          provider.setTechnique(t, focusSlug: widget.phaseMetadata.focusSlug);
          provider.start();
        }
      } else {
        provider.setTechnique(t);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  void _handleStandaloneBack() {
    final timer = context.read<BreathworkTimerProvider>();
    if (timer.isRunning || timer.isPaused) {
      _confirmStopStandalone();
    } else {
      widget.onPhaseComplete(_buildPhaseResult(
        provider: timer,
        wasSkipped: true,
        sessionId: null,
      ));
    }
  }

  Future<void> _confirmStopStandalone() async {
    final timer = context.read<BreathworkTimerProvider>();
    final wasRunning = timer.isRunning;
    if (wasRunning) timer.pause();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('End session early?'),
        content: const Text(
          'Your progress will still be saved.',
          style: TextStyle(color: AppColors.secondaryText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error.withValues(alpha: 0.15),
              foregroundColor: AppColors.error,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('End Now'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (confirmed == true) {
      timer.stop();
    } else if (wasRunning) {
      timer.resume();
    }
  }

  PhaseResult _buildPhaseResult({
    required BreathworkTimerProvider provider,
    required bool wasSkipped,
    required int? sessionId,
  }) {
    final start = _startedAt ?? DateTime.now();
    return PhaseResult(
      phase: widget.phaseMetadata.phase,
      contentType: 'breathwork',
      completedAt: DateTime.now(),
      actualDuration: DateTime.now().difference(start),
      items: widget.phaseMetadata.items,
      pillarSpecific: <String, dynamic>{
        'rounds_completed': provider.roundsCompleted,
        'total_rounds': provider.totalRounds,
        'elapsed_seconds': provider.totalElapsedSeconds,
      },
      wasSkipped: wasSkipped,
      sessionId: sessionId,
    );
  }

  Future<void> _handleEmbeddedCompletion(
      BreathworkTimerProvider provider) async {
    if (_completionFired) return;
    _completionFired = true;
    // Wait for the in-flight breathwork_sessions write so we can carry the
    // id forward to PhaseResult.sessionId (cross_pillar FK).
    final sessionId = await provider.awaitLogging();
    if (!mounted) return;
    widget.onPhaseComplete(_buildPhaseResult(
      provider: provider,
      wasSkipped: false,
      sessionId: sessionId,
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null || _technique == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _error ?? 'Technique not found',
            style: const TextStyle(color: AppColors.error),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    final technique = _technique!;

    // Embedded mode skips the safety modal (engine selects safe techniques
    // for cross-pillar bookends). Standalone keeps the safety gate.
    final needsSafety =
        !widget.isEmbedded && technique.safetyLevel != 'green' && !_safetyAccepted;
    if (needsSafety) {
      return SafetyWarningModal(
        technique: technique,
        onAccept: () => setState(() => _safetyAccepted = true),
        onDecline: () => widget.onPhaseComplete(_buildPhaseResult(
          provider: context.read<BreathworkTimerProvider>(),
          wasSkipped: true,
          sessionId: null,
        )),
      );
    }

    return Consumer<BreathworkTimerProvider>(
      builder: (context, timer, _) {
        if (timer.isCompleted) {
          if (widget.isEmbedded) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _handleEmbeddedCompletion(timer);
            });
            return const Center(child: CircularProgressIndicator());
          }
          // Standalone keeps the existing summary screen.
          return BreathworkSessionSummary(
            technique: technique,
            durationSeconds: timer.totalElapsedSeconds,
            roundsCompleted: timer.roundsCompleted,
            totalRounds: timer.totalRounds,
            fullyCompleted: timer.roundsCompleted >= timer.totalRounds,
            onDone: () => widget.onPhaseComplete(_buildPhaseResult(
              provider: timer,
              wasSkipped: false,
              sessionId: timer.loggedSessionId,
            )),
          );
        }
        if (timer.isIdle) {
          // Embedded auto-starts in _load — this branch only fires for
          // standalone before the user taps Begin.
          if (widget.isEmbedded) {
            return const Center(child: CircularProgressIndicator());
          }
          return _PreStartView(
            technique: technique,
            onBack: () => widget.onPhaseComplete(_buildPhaseResult(
              provider: timer,
              wasSkipped: true,
              sessionId: null,
            )),
            onBegin: () {
              _startedAt = DateTime.now();
              timer.start();
            },
          );
        }
        return _ActiveTimerView(
          technique: technique,
          timer: timer,
          showAppBar: !widget.isEmbedded,
          // S14-T5: state-focus endless practice gets the inline stopwatch
          // + "I'm done" footer so the user can advance whenever ready.
          showEndlessFooter: widget.isEmbedded &&
              widget.phaseMetadata.isEndless &&
              widget.phaseMetadata.phase == 'practice',
          onBack: _handleStandaloneBack,
          onStop: _confirmStopStandalone,
          onUserDone: () => timer.stop(),
        );
      },
    );
  }
}

class _PreStartView extends StatelessWidget {
  final BreathworkTechnique technique;
  final VoidCallback onBack;
  final VoidCallback onBegin;

  const _PreStartView({
    required this.technique,
    required this.onBack,
    required this.onBegin,
  });

  String _protocolSummary() {
    final phases = (technique.protocol['phases'] as List?) ?? const [];
    final active = phases
        .whereType<Map>()
        .where((p) => ((p['duration'] as num?)?.toInt() ?? 0) > 0)
        .toList();
    if (active.isEmpty) return '';
    return active.map((p) {
      final type = (p['type'] as String?) ?? '';
      final dur = (p['duration'] as num?)?.toInt() ?? 0;
      return '${dur}s $type';
    }).join(' → ');
  }

  @override
  Widget build(BuildContext context) {
    final cycles = (technique.protocol['cycles'] as num?)?.toInt() ?? 1;
    final est = technique.estimatedDuration;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: onBack,
        ),
        title: Text(technique.name),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (technique.sanskritName != null &&
                          technique.sanskritName!.isNotEmpty) ...[
                        Text(
                          technique.sanskritName!,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                        const SizedBox(height: 4),
                      ],
                      Text(
                        '${capitalize(technique.tradition)} · ${capitalize(technique.difficulty)}',
                        style: const TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (technique.description.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.cardBackground,
                            border: Border.all(color: AppColors.cardBorder),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            technique.description,
                            style: const TextStyle(
                              color: AppColors.secondaryText,
                              fontSize: 14,
                              height: 1.6,
                            ),
                          ),
                        ),
                      if (technique.instructions != null &&
                          technique.instructions!.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.cardBackground,
                            border: Border.all(color: AppColors.cardBorder),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'INSTRUCTIONS',
                                style: TextStyle(
                                  color: AppColors.hintText,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.6,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                technique.instructions!,
                                style: const TextStyle(
                                  color: AppColors.secondaryText,
                                  fontSize: 13,
                                  height: 1.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      const Text(
                        'PROTOCOL',
                        style: TextStyle(
                          color: AppColors.hintText,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.6,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _protocolSummary(),
                        style: const TextStyle(
                          color: AppColors.primaryText,
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '$cycles rounds${est != null ? ' · ~${(est / 60).ceil()} min' : ''}',
                        style: const TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onBegin,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.purple.withValues(alpha: 0.15),
                  foregroundColor: AppColors.purple,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                      color: AppColors.purple.withValues(alpha: 0.4),
                    ),
                  ),
                ),
                child: const Text(
                  'BEGIN SESSION',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActiveTimerView extends StatelessWidget {
  final BreathworkTechnique technique;
  final BreathworkTimerProvider timer;
  final bool showAppBar;
  final bool showEndlessFooter;
  final VoidCallback onBack;
  final VoidCallback onStop;
  final VoidCallback onUserDone;

  const _ActiveTimerView({
    required this.technique,
    required this.timer,
    required this.showAppBar,
    required this.showEndlessFooter,
    required this.onBack,
    required this.onStop,
    required this.onUserDone,
  });

  String _fmtElapsed(int s) => _fmtElapsedStatic(s);

  @override
  Widget build(BuildContext context) {
    final body = SafeArea(
      top: showAppBar,
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Column(
          children: [
            const SizedBox(height: 8),
            // AMENDMENT-1 D6: technique label always rendered. In embedded
            // mode (state-focus practice / cross-pillar bookend) this is the
            // only place the user sees which technique is playing.
            Text(
              technique.name,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.primaryText,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            if (timer.currentInstruction.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 16, top: 8),
                child: Text(
                  timer.currentInstruction,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 18,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
            Expanded(
              child: BreathCircle(
                phaseKey: timer.currentPhaseKey,
                phaseLabel: timer.currentPhaseLabel,
                secondsRemaining: timer.secondsRemaining,
                phaseDuration: timer.phaseDuration,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Round ${timer.currentRound} of ${timer.totalRounds}',
              style: const TextStyle(
                color: AppColors.hintText,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            // Hide transport controls in embedded mode — orchestrator owns
            // pause/skip via its action bar.
            if (showAppBar)
              TimerControls(
                isRunning: timer.isRunning,
                onPauseResume: () =>
                    timer.isRunning ? timer.pause() : timer.resume(),
                onStop: onStop,
              ),
            // S14-T5: endless practice footer (stopwatch counting up +
            // "I'm done" button). Only rendered when the orchestrator passed
            // showEndlessFooter=true (state-focus practice in endless mode).
            if (showEndlessFooter) ...[
              Text(
                _fmtElapsedStatic(timer.totalElapsedSeconds),
                style: const TextStyle(
                  fontFamily: 'RobotoMono',
                  color: AppColors.primaryText,
                  fontSize: 26,
                  fontWeight: FontWeight.w300,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'elapsed',
                style: TextStyle(
                  color: AppColors.hintText,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: onUserDone,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.purple.withValues(alpha: 0.15),
                    foregroundColor: AppColors.purple,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: AppColors.purple.withValues(alpha: 0.4),
                      ),
                    ),
                  ),
                  child: const Text(
                    "I'm done",
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
    if (!showAppBar) return body;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: onBack,
        ),
        title: Text(technique.name),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                _fmtElapsed(timer.totalElapsedSeconds),
                style: const TextStyle(
                  fontFamily: 'RobotoMono',
                  color: AppColors.hintText,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
      body: body,
    );
  }
}

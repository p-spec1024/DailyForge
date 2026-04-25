import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/breathwork_technique.dart';
import '../../providers/breathwork_timer_provider.dart';
import '../../services/api_service.dart';
import '../../services/breathwork_service.dart';
import '../../widgets/breathwork/breath_circle.dart';
import '../../widgets/breathwork/safety_warning_modal.dart';
import '../../widgets/breathwork/session_summary.dart';
import '../../widgets/breathwork/timer_controls.dart';

class BreathworkTimerPage extends StatelessWidget {
  final int techniqueId;
  const BreathworkTimerPage({super.key, required this.techniqueId});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<BreathworkTimerProvider>(
      create: (ctx) => BreathworkTimerProvider(ctx.read<ApiService>()),
      child: _BreathworkTimerView(techniqueId: techniqueId),
    );
  }
}

class _BreathworkTimerView extends StatefulWidget {
  final int techniqueId;
  const _BreathworkTimerView({required this.techniqueId});

  @override
  State<_BreathworkTimerView> createState() => _BreathworkTimerViewState();
}

class _BreathworkTimerViewState extends State<_BreathworkTimerView> {
  BreathworkTechnique? _technique;
  bool _loading = true;
  String? _error;
  bool _safetyAccepted = false;

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
      context.read<BreathworkTimerProvider>().setTechnique(t);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  void _handleBack() {
    final timer = context.read<BreathworkTimerProvider>();
    if (timer.isRunning || timer.isPaused) {
      _confirmStop();
    } else {
      context.pop();
    }
  }

  Future<void> _confirmStop() async {
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null || _technique == null) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.pop(),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _error ?? 'Technique not found',
              style: const TextStyle(color: AppColors.error),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final technique = _technique!;
    final needsSafety =
        technique.safetyLevel != 'green' && !_safetyAccepted;

    if (needsSafety) {
      return SafetyWarningModal(
        technique: technique,
        onAccept: () => setState(() => _safetyAccepted = true),
        onDecline: () => context.pop(),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: Consumer<BreathworkTimerProvider>(
        builder: (context, timer, _) {
          if (timer.isCompleted) {
            return BreathworkSessionSummary(
              technique: technique,
              durationSeconds: timer.totalElapsedSeconds,
              roundsCompleted: timer.roundsCompleted,
              totalRounds: timer.totalRounds,
              fullyCompleted: timer.roundsCompleted >= timer.totalRounds,
              onDone: () => context.pop(),
            );
          }
          if (timer.isIdle) {
            return _PreStartView(
              technique: technique,
              onBack: () => context.pop(),
              onBegin: timer.start,
            );
          }
          return _ActiveTimerView(
            technique: technique,
            timer: timer,
            onBack: _handleBack,
            onStop: _confirmStop,
          );
        },
      ),
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
  final VoidCallback onBack;
  final VoidCallback onStop;

  const _ActiveTimerView({
    required this.technique,
    required this.timer,
    required this.onBack,
    required this.onStop,
  });

  String _fmtElapsed(int s) {
    final m = (s ~/ 60).toString().padLeft(2, '0');
    final sec = (s % 60).toString().padLeft(2, '0');
    return '$m:$sec';
  }

  @override
  Widget build(BuildContext context) {
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
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Column(
            children: [
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
              TimerControls(
                isRunning: timer.isRunning,
                onPauseResume: () =>
                    timer.isRunning ? timer.pause() : timer.resume(),
                onStop: onStop,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

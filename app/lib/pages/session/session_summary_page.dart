import 'dart:io' show File;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../config/theme.dart';
import '../../models/completed_phase_snapshot.dart';
import '../../services/api_service.dart';
import '../../services/streaks_service.dart';
import '../../widgets/session/share_card.dart';

/// S14-T6 §6.1 args bundle passed via `go_router` `extra` from the
/// orchestrator's `onAllPhasesComplete`. All fields are required so the
/// summary page never has to defensively render a "missing data" empty
/// state — the caller is the single source of truth.
class SessionSummaryArgs {
  /// 'cross_pillar' | 'pillar_pure' | 'state_focus'
  final String sessionShape;
  final String focusSlug;
  final String focusDisplayName;
  final List<CompletedPhaseSnapshot> phases;
  final List<String> skippedPhaseLabels;
  final int totalSeconds;
  final Map<String, String> userLevels;

  const SessionSummaryArgs({
    required this.sessionShape,
    required this.focusSlug,
    required this.focusDisplayName,
    required this.phases,
    required this.skippedPhaseLabels,
    required this.totalSeconds,
    required this.userLevels,
  });
}

class SessionSummaryPage extends StatefulWidget {
  final SessionSummaryArgs args;

  const SessionSummaryPage({super.key, required this.args});

  @override
  State<SessionSummaryPage> createState() => _SessionSummaryPageState();
}

class _SessionSummaryPageState extends State<SessionSummaryPage> {
  final GlobalKey _shareBoundary = GlobalKey();

  StreaksSnapshot? _streaks;
  bool _streaksLoading = true;
  String? _streaksError;
  bool _sharing = false;

  @override
  void initState() {
    super.initState();
    _loadStreaks();
  }

  Future<void> _loadStreaks() async {
    try {
      final api = context.read<ApiService>();
      final svc = StreaksService(api);
      final snap = await svc.fetch(focusSlug: widget.args.focusSlug);
      if (!mounted) return;
      setState(() {
        _streaks = snap;
        _streaksLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _streaksLoading = false;
        _streaksError = e.toString();
      });
    }
  }

  Future<void> _onShare() async {
    if (_sharing) return;
    setState(() => _sharing = true);
    try {
      final boundary = _shareBoundary.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) {
        throw StateError('Share boundary not mounted');
      }
      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData =
          await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) {
        throw StateError('Share card render returned null bytes');
      }
      final png = byteData.buffer.asUint8List();
      final dir = await getTemporaryDirectory();
      final path =
          '${dir.path}/dailyforge_share_${DateTime.now().millisecondsSinceEpoch}.png';
      final file = await File(path).writeAsBytes(png, flush: true);
      await Share.shareXFiles(
        [XFile(file.path)],
        text: _shareText(),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Couldn\'t open share: $e')),
      );
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  String _shareText() {
    final mins = (widget.args.totalSeconds / 60).round();
    final daily = _streaks?.dailyStreakDays ?? 0;
    final streakLine = daily > 0 ? '\n🔥 Day $daily of my streak' : '';
    return 'Just completed a ${widget.args.focusDisplayName} session on DailyForge 💪\n'
        '$mins min • ${widget.args.phases.length} phases'
        '$streakLine';
  }

  String _fmtTotal(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    if (m == 0) return '$s sec';
    if (s == 0) return '$m min';
    return '$m min $s sec';
  }

  @override
  Widget build(BuildContext context) {
    final args = widget.args;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: [
                _hero(),
                const SizedBox(height: 24),
                _streakStack(),
                const SizedBox(height: 28),
                _phaseBreakdown(),
                const SizedBox(height: 24),
                _actions(),
              ],
            ),
            // Offscreen share card — laid out but never visible. Uses a
            // far-negative offset so the RepaintBoundary still rasterizes
            // when toImage() is called from _onShare.
            Positioned(
              left: -10000,
              top: 0,
              child: RepaintBoundary(
                key: _shareBoundary,
                child: ShareCard(
                  focusDisplayName: args.focusDisplayName,
                  totalSeconds: args.totalSeconds,
                  phasesCount: args.phases.length,
                  dailyStreakDays: _streaks?.dailyStreakDays ?? 0,
                  weeklyCount: _streaks?.weeklyCount ?? 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero() {
    return Column(
      children: [
        const SizedBox(height: 12),
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.gold.withValues(alpha: 0.18),
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.45)),
          ),
          child: const Icon(LucideIcons.trophy,
              size: 34, color: AppColors.gold),
        ),
        const SizedBox(height: 16),
        Text(
          'Session complete',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: AppColors.primaryText,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 6),
        Text(
          widget.args.focusDisplayName,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          _fmtTotal(widget.args.totalSeconds),
          style: const TextStyle(
            color: AppColors.primaryText,
            fontSize: 30,
            fontFamily: 'RobotoMono',
            fontWeight: FontWeight.w300,
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }

  Widget _streakStack() {
    if (_streaksLoading) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.primaryText.withValues(alpha: 0.4),
          ),
        ),
      );
    }
    if (_streaksError != null || _streaks == null) {
      return const _StreakRow(
        icon: LucideIcons.flame,
        text: 'Streaks unavailable right now',
        muted: true,
      );
    }
    final s = _streaks!;
    final focusLabel = widget.args.focusDisplayName;
    return Column(
      children: [
        _StreakRow(
          icon: LucideIcons.flame,
          text: s.dailyStreakDays > 0
              ? '${s.dailyStreakDays}-day streak'
              : 'Start your daily streak',
          accent: s.dailyStreakDays > 0,
        ),
        const SizedBox(height: 8),
        _StreakRow(
          icon: LucideIcons.target,
          text: s.focusStreak.isFirst
              ? 'Your first $focusLabel session this week'
              : '${_ordinal(s.focusStreak.countThisWeek)} $focusLabel session this week',
        ),
        const SizedBox(height: 8),
        _StreakRow(
          icon: LucideIcons.calendar,
          text: s.weeklyCount > 0
              ? '${s.weeklyCount} ${s.weeklyCount == 1 ? 'session' : 'sessions'} this week'
              : 'Your first session this week',
        ),
      ],
    );
  }

  String _ordinal(int n) {
    if (n <= 0) return '0';
    if (n % 100 >= 11 && n % 100 <= 13) return '${n}th';
    switch (n % 10) {
      case 1:
        return '${n}st';
      case 2:
        return '${n}nd';
      case 3:
        return '${n}rd';
      default:
        return '${n}th';
    }
  }

  Widget _phaseBreakdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'PHASES',
            style: TextStyle(
              color: AppColors.hintText,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
        ),
        ...widget.args.phases.map(_phaseRow),
      ],
    );
  }

  Widget _phaseRow(CompletedPhaseSnapshot p) {
    final muted = p.wasSkipped;
    final textColor =
        muted ? AppColors.hintText : AppColors.primaryText;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(_iconForPhase(p.phaseSlug), size: 18, color: textColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.phaseLabel,
                  style: TextStyle(
                    color: textColor,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (p.primaryContentName != null &&
                    p.primaryContentName!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      p.primaryContentName!,
                      style: TextStyle(
                        color: muted
                            ? AppColors.hintText
                            : AppColors.secondaryText,
                        fontSize: 13,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (muted)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'SKIPPED',
                style: TextStyle(
                  color: AppColors.warning,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            )
          else
            Text(
              _fmtTotal(p.durationSeconds),
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontSize: 13,
                fontFamily: 'RobotoMono',
              ),
            ),
        ],
      ),
    );
  }

  IconData _iconForPhase(String slug) {
    switch (slug) {
      case 'bookend_open':
      case 'bookend_close':
        return LucideIcons.wind;
      case 'warmup':
        return LucideIcons.sunrise;
      case 'main':
        return LucideIcons.dumbbell;
      case 'cooldown':
        return LucideIcons.sunset;
      case 'centering':
        return LucideIcons.circle;
      case 'practice':
        return LucideIcons.activity;
      case 'reflection':
        return LucideIcons.moon;
      default:
        return LucideIcons.checkCircle;
    }
  }

  Widget _actions() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () => context.go('/home'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.gold.withValues(alpha: 0.18),
              foregroundColor: AppColors.gold,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: AppColors.gold.withValues(alpha: 0.4),
                ),
              ),
            ),
            child: const Text(
              'Done',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _sharing ? null : _onShare,
            icon: _sharing
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primaryText,
                    ),
                  )
                : const Icon(LucideIcons.share2, size: 18),
            label: Text(_sharing ? 'Preparing…' : 'Share'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primaryText,
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: BorderSide(
                color: AppColors.cardBorder,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _StreakRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final bool accent;
  final bool muted;
  const _StreakRow({
    required this.icon,
    required this.text,
    this.accent = false,
    this.muted = false,
  });
  @override
  Widget build(BuildContext context) {
    final color = muted
        ? AppColors.hintText
        : (accent ? AppColors.gold : AppColors.primaryText);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: color,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../launchers/focus_utils.dart';
import '../../launchers/session_launcher.dart';
import '../../models/suggested_session.dart';
import '../../providers/suggest_provider.dart';
import '../../providers/yoga_provider.dart';
import '../../providers/yoga_session_provider.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/home/entry_point_warning_slot.dart';
import '../../widgets/yoga/practice_type_selector.dart';
import '../../widgets/yoga/level_selector.dart';
import '../../widgets/yoga/duration_selector.dart';
import '../../widgets/yoga/focus_chips.dart';
import '../../widgets/yoga/recent_sessions.dart';
import '../../widgets/yoga/yoga_start_button.dart';
import '../../widgets/yoga/pose_preview_modal.dart';

const String _kYogaTabFallbackFocus = 'hamstrings';
const int _kYogaTabTimeBudgetMin = 30;

class YogaPage extends StatefulWidget {
  const YogaPage({super.key});

  @override
  State<YogaPage> createState() => _YogaPageState();
}

class _YogaPageState extends State<YogaPage> {
  /// S14-T3: tracks which focus_slug the "TODAY'S YOGA" card has already
  /// fetched, so a return-to-tab visit after the user changed focus on Home
  /// triggers a refetch (matches T1's β behavior).
  String? _lastFetchedFocusSlug;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<YogaProvider>();
      p.loadConfig();
      if (p.recentSessions.isEmpty && !p.isLoadingRecent) {
        p.loadRecentSessions();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final suggest = context.read<SuggestProvider>();
    if (isStateFocus(suggest.currentFocusSlug)) {
      // Q1 lock: card is hidden when home focus is a state focus. No fetch.
      return;
    }
    final currentFocus = suggest.currentFocusSlug.isNotEmpty
        ? suggest.currentFocusSlug
        : _kYogaTabFallbackFocus;
    if (_lastFetchedFocusSlug != currentFocus) {
      _lastFetchedFocusSlug = currentFocus;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _fetchTodaysYoga(currentFocus);
      });
    }
  }

  Future<void> _fetchTodaysYoga(String focusSlug) async {
    if (!mounted) return;
    final suggest = context.read<SuggestProvider>();
    await suggest.refreshForEntryPoint(
      entryPoint: 'yoga_tab',
      focusSlug: focusSlug,
      timeBudgetMin: _kYogaTabTimeBudgetMin,
    );
  }

  Future<void> _onTodaysYogaStart(SuggestedSession session) async {
    await SessionLauncher.launch(context, session);
  }

  void _handleStart() {
    context.read<YogaProvider>().generateSession();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Consumer<YogaProvider>(
          builder: (context, provider, _) {
            return Stack(
              children: [
                // Main scrollable content
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 16, 16, 18),
                      child: Text(
                        'Yoga',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    if (provider.error != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: _ErrorBanner(
                          message: provider.error!,
                          onDismiss: provider.clearError,
                        ),
                      ),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // S14-T6 §6.4: recency-overlap banner above
                            // the engine-seeded card. Non-blocking — Start
                            // stays enabled.
                            const EntryPointWarningSlot(entryPoint: 'yoga_tab'),
                            // S14-T3: engine-seeded "TODAY'S YOGA" card.
                            _TodaysYogaCard(
                              onStart: _onTodaysYogaStart,
                              onRetry: () => _fetchTodaysYoga(
                                _lastFetchedFocusSlug ??
                                    _kYogaTabFallbackFocus,
                              ),
                            ),
                            const SizedBox(height: 20),
                            PracticeTypeSelector(
                              selected: provider.config.type,
                              onSelect: provider.setType,
                            ),
                            const SizedBox(height: 20),
                            LevelSelector(
                              selected: provider.config.level,
                              onSelect: provider.setLevel,
                            ),
                            const SizedBox(height: 20),
                            DurationSelector(
                              selected: provider.config.duration,
                              onSelect: provider.setDuration,
                            ),
                            const SizedBox(height: 20),
                            FocusChips(
                              selected: provider.config.focus,
                              onToggle: provider.toggleFocus,
                            ),
                            const SizedBox(height: 16),
                            RecentSessions(
                              sessions: provider.recentSessions,
                              onLoad: provider.loadFromRecent,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                // Floating start button
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: YogaStartButton(
                    config: provider.config,
                    isGenerating: provider.isGenerating,
                    onStart: _handleStart,
                  ),
                ),

                // Pose preview modal
                if (provider.generatedSession != null)
                  Positioned.fill(
                    child: PosePreviewModal(
                      session: provider.generatedSession!,
                      config: provider.config,
                      isGenerating: provider.isGenerating,
                      onRegenerate: _handleStart,
                      onBegin: () {
                        final session = provider.generatedSession!;
                        context.read<YogaSessionProvider>().startSession(session);
                        context.go('/yoga/session');
                      },
                      onClose: provider.clearSession,
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback onDismiss;
  const _ErrorBanner({required this.message, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Color(0xFFFCA5A5),
                fontSize: 12,
              ),
            ),
          ),
          GestureDetector(
            onTap: onDismiss,
            child: Icon(
              Icons.close,
              size: 14,
              color: Colors.white.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }
}

/// S14-T3 "TODAY'S YOGA" card. Mirrors `_TodaysStrengthCard` from the
/// Strength tab — same `GlassCard` shell, same skeleton/error/ready
/// progression, swapped accent color and copy. Hidden when the home focus
/// is a state focus (Q1 lock).
class _TodaysYogaCard extends StatelessWidget {
  final Future<void> Function(SuggestedSession session) onStart;
  final VoidCallback onRetry;

  const _TodaysYogaCard({
    required this.onStart,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<SuggestProvider>(
      builder: (context, suggest, _) {
        if (isStateFocus(suggest.currentFocusSlug)) {
          return const SizedBox.shrink();
        }
        final isLoading = suggest.isLoading;
        final session = suggest.currentSession;
        final error = suggest.lastError;

        if (isLoading && session == null) {
          return _buildSkeleton();
        }
        if (error != null && session == null) {
          return _buildError(error.userFacingMessage);
        }
        if (session == null) {
          return const SizedBox.shrink();
        }
        if (session.sessionShape != 'pillar_pure') {
          return const SizedBox.shrink();
        }
        // Defensive: ensure the current session is yoga-pillar before
        // rendering. Other tabs may have populated SuggestProvider with a
        // non-yoga pillar_pure session.
        if (session.phases.isEmpty) return const SizedBox.shrink();
        final mainPhase = session.phases.firstWhere(
          (p) => p.phase == 'main',
          orElse: () => session.phases.first,
        );
        final firstItem = mainPhase.items.isEmpty ? null : mainPhase.items.first;
        if (firstItem?.contentType != 'yoga') {
          return const SizedBox.shrink();
        }
        return _buildReady(session, isLoading);
      },
    );
  }

  Widget _buildSkeleton() {
    return GlassCard(
      borderColor: AppColors.yoga,
      child: SizedBox(
        height: 132,
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.yoga.withValues(alpha: 0.6),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildError(String message) {
    return GlassCard(
      borderColor: AppColors.yoga,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.primaryText,
            ),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(foregroundColor: AppColors.yoga),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildReady(SuggestedSession session, bool refreshing) {
    final mins = session.metadata.estimatedTotalMin;
    final focusSlug = session.metadata.focusSlug ?? '';
    final focusDisplay =
        focusSlug.isEmpty ? 'Yoga' : _capitalizeFocus(focusSlug);
    final poseCount = session.phases
        .expand((p) => p.items)
        .where((i) => i.contentType == 'yoga')
        .length;

    final card = GlassCard(
      borderColor: AppColors.yoga,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "TODAY'S YOGA",
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$focusDisplay · $mins min',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryText,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            poseCount == 1 ? '1 pose' : '$poseCount poses',
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: FilledButton(
              onPressed: () => onStart(session),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.yoga,
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

    if (!refreshing) return card;
    return AnimatedOpacity(
      opacity: 0.6,
      duration: const Duration(milliseconds: 180),
      child: card,
    );
  }

  String _capitalizeFocus(String slug) {
    return slug
        .split('_')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }
}

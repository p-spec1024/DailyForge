import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../constants/focus_categories.dart';
import '../../launchers/session_launcher.dart';
import '../../models/suggested_session.dart';
import '../../providers/suggest_provider.dart';
import '../../providers/yoga_provider.dart';
import '../../providers/yoga_session_provider.dart';
import '../../utils/focus_display.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/home/entry_point_warning_slot.dart';
import '../../widgets/yoga/practice_type_selector.dart';
import '../../widgets/yoga/level_selector.dart';
import '../../widgets/yoga/duration_selector.dart';
import '../../widgets/yoga/focus_chips.dart';
import '../../widgets/yoga/recent_sessions.dart';
import '../../widgets/yoga/yoga_start_button.dart';
import '../../widgets/yoga/pose_preview_modal.dart';

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
    // FS #224: cold-start gate. No confirmed pick yet → don't fetch. The
    // pillar-pure suggest request only makes sense once the user has chosen
    // a focus; firing with the provider default ('full_body') on first cold
    // open used to surface a "Check your connection" card on engine
    // timeout. Empty-state widget renders instead.
    if (!suggest.hasUserSelectedFocus) return;
    if (isStateFocus(suggest.currentFocusSlug)) {
      // Q1 lock: card is hidden when home focus is a state focus. No fetch.
      return;
    }
    final currentFocus = suggest.currentFocusSlug;
    // FS #203 W3: re-fetch when sessionShape drifts away from pillar_pure.
    // Pre-fix, this branch only re-fetched on focus-slug change — so if the
    // user went Home → picked a body focus (cross_pillar shape) → switched
    // to Yoga tab, the card showed stale yoga data because focus_slug
    // matched and the cross_pillar shape was treated as "already fetched."
    if (_lastFetchedFocusSlug != currentFocus
        || suggest.currentSession?.sessionShape != 'pillar_pure') {
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
    // Commit 2.1 W-1: omit timeBudgetMin so refreshForEntryPoint falls
    // back to the user's persisted budget — matches strength_page parity.
    // Pre-fix, a hardcoded 30-min const here meant the same focus showed
    // different durations on Yoga vs Strength tabs.
    await suggest.refreshForEntryPoint(
      entryPoint: 'yoga_tab',
      focusSlug: focusSlug,
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
                              onRetry: () {
                                // Commit 2.1 S-1: fall back to the provider's
                                // current slug when no prior fetch has been
                                // recorded. _lastFetchedFocusSlug is null on a
                                // first-fetch-failed-before-store path; the
                                // hasUserSelectedFocus gate guarantees
                                // currentFocusSlug is a real user-confirmed
                                // pick at this point.
                                final suggest =
                                    context.read<SuggestProvider>();
                                final retry = _lastFetchedFocusSlug
                                    ?? suggest.currentFocusSlug;
                                if (retry.isEmpty || isStateFocus(retry)) {
                                  return;
                                }
                                _fetchTodaysYoga(retry);
                              },
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
        // FS #224: pre-pick state. Surface a thoughtful empty state instead
        // of a doomed fetch's error card. State-focus check below still wins
        // for the case where the user *has* picked, but picked a state focus.
        if (!suggest.hasUserSelectedFocus) {
          return const _YogaTabEmptyState();
        }
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
        focusSlug.isEmpty ? 'Yoga' : capitalizeFocus(focusSlug);
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

}

/// FS #224: pre-pick empty state shown above the Yoga tab's manual builder
/// when the user hasn't actively picked a focus yet. Replaces the doomed
/// `_TodaysYogaCard` fetch (which previously surfaced a misleading network
/// error on cold-open). The rest of the tab — practice type / level /
/// duration / focus chips — is still functional below, so the copy points
/// the user at both Home and the manual picker.
class _YogaTabEmptyState extends StatelessWidget {
  const _YogaTabEmptyState();

  @override
  Widget build(BuildContext context) {
    return const GlassCard(
      borderColor: AppColors.yoga,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'No focus selected',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.primaryText,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Pick a focus on Home, or use the picker below to start a '
            'custom Yoga session.',
            style: TextStyle(
              fontSize: 13,
              color: AppColors.secondaryText,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

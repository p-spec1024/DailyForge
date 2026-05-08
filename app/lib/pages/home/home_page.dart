import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../models/focus_area.dart';
import '../../providers/home_provider.dart';
import '../../providers/suggest_provider.dart';
import '../../widgets/cards/state_focus_session_card.dart';
import '../../widgets/sheets/half_pie_picker_sheet.dart';
import 'widgets_v2/_tokens_v2.dart';
import 'widgets_v2/focus_pie_picker.dart';
import 'widgets_v2/recent_bar_chart.dart';
import 'widgets_v2/stat_tile.dart';
import 'widgets_v2/todays_session_card.dart';
import 'widgets_v2/training_load_chart.dart';

/// S13-T4 home page (replaces Sprint-10 dashboard at `_legacy/home_page_s10.dart`).
///
/// **S13-T5 update:** the tap-and-instant-suggest model is replaced by
/// tap → sheet → pick → suggest. First-load home shows the empty
/// session-card slot until the user taps a focus and confirms a duration.
/// `HomeProvider._fetchAll` already does NOT call /suggest; the previous
/// auto-fire path lived here in `_maybeFireInitialSuggest` and has been
/// removed.
///
/// Composition (top → bottom): app bar with streak chip + body-map shortcut
/// → today's session slot (empty / loading / state-card / body-card / error)
/// → focus orbit picker → training-load chart → streak / this-week stat
/// tiles → 14-bar daily-counts chart.
///
/// Data flow: HomeProvider.load() fans out to /home/stats,
/// /home/weekly-activity, /home/daily-load, /home/daily-counts,
/// /focus-areas, /users/me/pillar-levels in parallel. SuggestProvider holds
/// the selected focus + current suggestion separately so a chip tap
/// re-fires only the engine call without disturbing the rest of the page.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _redirected = false;
  DateTime _lastTapAt = DateTime.fromMillisecondsSinceEpoch(0);
  // Tracks the slug shown on the pie before the user opened the picker, so
  // a sheet dismiss can revert the pie's visual selection (Decision #13).
  String? _previousSelectedSlug;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      // Kick off all home-page data slices and the suggest-provider's
      // persisted-focus hydration in parallel. T5 removes the auto-fire of
      // /suggest — the picker flow is the only path that fires it.
      final home = context.read<HomeProvider>();
      final suggest = context.read<SuggestProvider>();
      home.load();
      await suggest.hydrate();
    });
  }

  FocusArea? _resolveFocus(List<FocusArea> all, String slug) {
    for (final f in all) {
      if (f.slug == slug) return f;
    }
    // Fall back to default focus from design doc §3 decision #3.
    for (final f in all) {
      if (f.slug == 'full_body') return f;
    }
    return all.isNotEmpty ? all.first : null;
  }

  Future<void> _onChipTap(FocusArea focus) async {
    // 300ms debounce to absorb double-taps on small chips.
    final now = DateTime.now();
    if (now.difference(_lastTapAt).inMilliseconds < 300) return;
    _lastTapAt = now;

    final suggest = context.read<SuggestProvider>();

    // Capture the pie's pre-tap slug so a dismiss can revert visually.
    _previousSelectedSlug = suggest.currentFocusSlug;
    suggest.previewFocus(focus.slug);

    // S13-T5 AMENDMENT-1: unified half-pie picker for both focus types.
    // Returns int (minutes) for body or String (bracket label) for state.
    final picked = await showHalfPiePicker(
      context,
      focusSlug: focus.slug,
      focusName: focus.displayName,
      focusType: focus.isState ? FocusType.state : FocusType.body,
    );

    if (!mounted) return;

    if (picked == null) {
      // Dismissed without a pick. Revert the visual pie selection ONLY —
      // do NOT touch SuggestProvider's session/error state. If a session
      // card was already showing, it stays. If state was idle, it stays
      // idle (empty card slot).
      final prev = _previousSelectedSlug;
      if (prev != null) suggest.previewFocus(prev);
      return;
    }

    if (focus.isState) {
      await suggest.selectStateFocus(focus.slug, picked as String);
    } else {
      await suggest.selectBodyFocus(focus.slug, timeBudgetMin: picked as int);
    }
  }

  Future<void> _reopenPickerForCurrent() async {
    // Retry path for the error card. Re-opens the picker for the currently
    // selected focus so the user can confirm intent rather than silently
    // re-firing with potentially stale parameters.
    final home = context.read<HomeProvider>();
    final suggest = context.read<SuggestProvider>();
    final focusAreas = home.focusAreas;
    if (focusAreas == null || focusAreas.isEmpty) return;
    final focus = _resolveFocus(focusAreas, suggest.currentFocusSlug);
    if (focus == null) return;
    await _onChipTap(focus);
  }

  void _onStart() {
    // S14-T1 reroute (Amendment 1): home Start does not launch yet — home
    // produces `cross_pillar` sessions, which T1's launcher does not handle.
    // S14-T2 promotes cross_pillar and wires home Start to the launcher.
    // Until then, point users at the Strength tab where T1's strength_only
    // path is wired.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          "Strength workouts available now from the Strength tab. "
          "Full home flow lands in S14-T2.",
        ),
        duration: Duration(seconds: 3),
      ),
    );
  }

  Future<void> _refreshAll() async {
    final home = context.read<HomeProvider>();
    await home.refresh();
    // Note: T5 does NOT re-fire /suggest on pull-to-refresh. The current
    // session card (if any) stays as-is; refresh only re-pulls the home
    // aggregation slices. To get a new session, the user re-taps a focus.
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: kHomeBg,
      ),
      child: Scaffold(
        backgroundColor: kHomeBg,
        body: SafeArea(
          child: Consumer2<HomeProvider, SuggestProvider>(
            builder: (context, home, suggest, _) {
              // Fresh-user gate. Only redirects on a positive empty-list
              // signal — a network error keeps us on home and shows the
              // skeleton instead of bouncing the user.
              if (home.isFreshUser && !_redirected) {
                _redirected = true;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) {
                    context.go('/onboarding/level-capture/strength');
                  }
                });
              }

              final selectedFocus = home.focusAreas == null
                  ? null
                  : _resolveFocus(home.focusAreas!, suggest.currentFocusSlug);

              return RefreshIndicator(
                onRefresh: _refreshAll,
                color: kStateAccent,
                backgroundColor: kHomeCard,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 14, 12, 60),
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    _AppBarRow(
                      streakDays: home.stats?.streakDays ?? 0,
                    ),
                    const SizedBox(height: 14),
                    _SessionSlot(
                      focus: selectedFocus,
                      suggest: suggest,
                      onStart: _onStart,
                      onRetry: _reopenPickerForCurrent,
                    ),
                    const SizedBox(height: 10),
                    Container(
                      decoration: kHomeCardDecoration(),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: home.focusAreas == null || home.focusAreas!.isEmpty
                          ? const _PickerSkeleton()
                          : FocusPiePicker(
                              focusAreas: home.focusAreas!,
                              selectedSlug: suggest.currentFocusSlug,
                              weeklyProgressPercent: home.weeklyProgressPercent,
                              isSuggestionLoading: suggest.isLoading,
                              onTap: _onChipTap,
                            ),
                    ),
                    const SizedBox(height: 10),
                    TrainingLoadChart(data: home.dailyLoad),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: StatTile(
                            label: 'Streak',
                            value: '${home.stats?.streakDays ?? 0}',
                            unit: 'days',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: StatTile(
                            label: 'This week',
                            value: '${home.sessionsThisWeek}',
                            unit: 'sessions',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    RecentBarChart(data: home.dailyCounts),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Picks the right session-slot widget given the SuggestProvider state.
/// Idle (no current session, not loading, no error) → empty prompt slot.
/// Otherwise delegates to the body-focus card or state-focus card based on
/// the engine's `session_shape`. The body-focus card also handles its own
/// loading/error rendering (T4 pattern); state-focus card just renders the
/// loaded session.
class _SessionSlot extends StatelessWidget {
  final FocusArea? focus;
  final SuggestProvider suggest;
  final VoidCallback onStart;
  final VoidCallback onRetry;

  const _SessionSlot({
    required this.focus,
    required this.suggest,
    required this.onStart,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final session = suggest.currentSession;
    final isLoading = suggest.isLoading;
    final error = suggest.lastError;

    // Idle: nothing requested yet, no in-flight call, no past error.
    // Render zero-height — the slot collapses entirely until the user taps
    // a focus on the pie below. The previous "Pick today's focus →" prompt
    // card was removed because the pie itself is the affordance.
    if (session == null && !isLoading && error == null) {
      return const SizedBox.shrink();
    }

    // State-focus loaded session gets the dedicated card.
    if (session != null && session.sessionShape == 'state_focus') {
      return StateFocusSessionCard(
        focus: focus,
        session: session,
        isLoading: isLoading,
        onStart: onStart,
      );
    }

    // Everything else (body-focus loaded, loading, error) flows through the
    // T4 card — its internal switch handles skeleton / error / loaded.
    return TodaysSessionCard(
      focus: focus,
      session: session,
      isLoading: isLoading,
      error: error,
      onStart: onStart,
      onRetry: onRetry,
    );
  }
}

class _AppBarRow extends StatelessWidget {
  final int streakDays;
  const _AppBarRow({required this.streakDays});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Today',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: kHomeTextPrimary,
              letterSpacing: -0.6,
            ),
          ),
          Row(
            children: [
              // Hide the streak chip entirely on a zero-streak — "🔥 0" reads
              // as a discouraging "you broke it" rather than absence
              // (S13-T4 AMENDMENT-1 §2.4).
              if (streakDays > 0) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: const ShapeDecoration(
                    color: kStreakChipBg,
                    shape: StadiumBorder(),
                  ),
                  child: Text(
                    '🔥 $streakDays',
                    style: const TextStyle(
                      color: kStreakChipText,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              IconButton(
                tooltip: 'Body map',
                onPressed: () => context.push('/body'),
                icon: const Icon(
                  LucideIcons.scan,
                  color: kHomeTextSecondary,
                  size: 20,
                ),
                splashRadius: 22,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PickerSkeleton extends StatelessWidget {
  const _PickerSkeleton();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 380,
      child: Center(
        child: SizedBox(
          width: 56,
          height: 56,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            valueColor:
                AlwaysStoppedAnimation<Color>(kStateAccent.withValues(alpha: 0.5)),
          ),
        ),
      ),
    );
  }
}

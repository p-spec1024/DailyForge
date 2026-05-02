import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../models/focus_area.dart';
import '../../providers/home_provider.dart';
import '../../providers/suggest_provider.dart';
import 'widgets_v2/_tokens_v2.dart';
import 'widgets_v2/focus_pie_picker.dart';
import 'widgets_v2/recent_bar_chart.dart';
import 'widgets_v2/stat_tile.dart';
import 'widgets_v2/todays_session_card.dart';
import 'widgets_v2/training_load_chart.dart';

/// S13-T4 home page (replaces Sprint-10 dashboard at `_legacy/home_page_s10.dart`).
///
/// Composition (top → bottom): app bar with streak chip + body-map shortcut
/// → today's session card → focus orbit picker → training-load chart →
/// streak / this-week stat tiles → 14-bar daily-counts chart.
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
  bool _hydrated = false;
  bool _redirected = false;
  DateTime _lastTapAt = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      // Kick off all home-page data slices and the suggest-provider's
      // persisted-focus hydration in parallel. The first /suggest call
      // fires only after both finish (we need the persisted slug + the
      // focus-areas list to map slug → FocusArea for the orbit chip).
      final home = context.read<HomeProvider>();
      final suggest = context.read<SuggestProvider>();
      home.load();
      await suggest.hydrate();
      if (!mounted) return;
      setState(() => _hydrated = true);
      await _maybeFireInitialSuggest();
    });
  }

  Future<void> _maybeFireInitialSuggest() async {
    final home = context.read<HomeProvider>();
    final suggest = context.read<SuggestProvider>();
    // Only fire once we know which focus-area to target. focus-areas may
    // still be loading; we'll re-try once it lands.
    final focusAreas = home.focusAreas;
    if (focusAreas == null || focusAreas.isEmpty) return;
    if (suggest.currentSession != null) return;
    final focus = _resolveFocus(focusAreas, suggest.currentFocusSlug);
    if (focus == null) return;
    await _fireSuggest(focus);
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

  Future<void> _fireSuggest(FocusArea focus) async {
    final suggest = context.read<SuggestProvider>();
    if (focus.isBody) {
      await suggest.selectBodyFocus(focus.slug);
    } else {
      // Per S13-T4 build decision May 2 2026: state-focus tap on home
      // defaults to bracket '21-30'. T5 lands a bracket sheet for re-tap.
      await suggest.selectStateFocus(focus.slug, kDefaultStateBracket);
    }
  }

  void _onChipTap(FocusArea focus) {
    // 300ms debounce to absorb double-taps on small chips.
    final now = DateTime.now();
    if (now.difference(_lastTapAt).inMilliseconds < 300) return;
    _lastTapAt = now;
    _fireSuggest(focus);
  }

  void _onStart() {
    // T6 wires the session player handoff. Until then surface a clear
    // placeholder so device-tests don't silently swallow the tap.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Session player wires up in S13-T6."),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _refreshAll() async {
    final home = context.read<HomeProvider>();
    final suggest = context.read<SuggestProvider>();
    await home.refresh();
    if (!mounted) return;
    final focus = home.focusAreas == null
        ? null
        : _resolveFocus(home.focusAreas!, suggest.currentFocusSlug);
    if (focus != null) await _fireSuggest(focus);
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
              // Once focus-areas land, fire the initial /suggest if it
              // hasn't fired yet.
              if (_hydrated &&
                  suggest.currentSession == null &&
                  !suggest.isLoading &&
                  home.focusAreas != null) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) _maybeFireInitialSuggest();
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
                    TodaysSessionCard(
                      focus: selectedFocus,
                      session: suggest.currentSession,
                      isLoading: suggest.isLoading,
                      error: suggest.lastError,
                      onStart: _onStart,
                      onRetry: () {
                        if (selectedFocus != null) _fireSuggest(selectedFocus);
                      },
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

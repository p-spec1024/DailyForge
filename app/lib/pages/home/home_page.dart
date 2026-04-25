import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../models/body_map.dart';
import '../../providers/body_map_provider.dart';
import '../../providers/home_provider.dart';
import 'widgets/_tokens.dart';
import 'widgets/body_map_3d.dart';
import 'widgets/heatmap_legend.dart';
import 'widgets/inspirational_footer.dart';
import 'widgets/mode_toggle.dart';
import 'widgets/recent_wins_list.dart';
import 'widgets/selected_muscle_card.dart';
import 'widgets/stats_row.dart';
import 'widgets/todays_practice_section.dart';
import 'widgets/weekly_activity_chart.dart';

/// DailyForge home page (S10-T5a UI, T5c-a/b real data).
/// Sprint 8's dashboard version preserved at `_legacy/home_page_s8.dart`.
///
/// Data sources:
///   • BodyMapProvider — muscle heatmap, selected-muscle card, recent wins
///   • HomeProvider    — pillar durations, stats row, weekly chart, footer
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  BodyMapMode _mode = BodyMapMode.muscles;
  String? _selectedGroup;

  @override
  void initState() {
    super.initState();
    // Per spec: "fetch fresh on page open for v1 — no caching layer."
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<BodyMapProvider>().load();
      context.read<HomeProvider>().load();
    });
  }

  Future<void> _refreshAll() async {
    final bodyMap = context.read<BodyMapProvider>();
    final home = context.read<HomeProvider>();
    await Future.wait([bodyMap.refresh(), home.refresh()]);
  }

  void _onMuscleTap(String? group) {
    setState(() {
      _selectedGroup = group;
    });
  }

  void _onModeChanged(BodyMapMode mode) {
    if (mode == _mode) return;
    setState(() {
      _mode = mode;
      _selectedGroup = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: kCream,
        textSelectionTheme: const TextSelectionThemeData(
          cursorColor: kCoral,
          selectionColor: Color(0x33D85A30),
          selectionHandleColor: kCoral,
        ),
      ),
      child: Scaffold(
        body: SafeArea(
          child: Consumer<BodyMapProvider>(
            builder: (context, provider, _) {
              return RefreshIndicator(
                onRefresh: _refreshAll,
                color: kCoral,
                backgroundColor: Colors.white,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: _buildSlivers(provider),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _buildSlivers(BodyMapProvider provider) {
    final volumes = provider.muscleVolumes ?? const <String, int>{};
    final details = provider.muscleDetails ?? const <String, MuscleDetail>{};
    final flexibility = provider.flexibility ?? const <String, int>{};
    // Surface any error — including refresh failures over stale data — not
    // just first-load failures (per phone-test issue #3 in T5c-a review).
    // refresh() clears _error at the start of every fetch, so the banner
    // disappears as soon as the user retries successfully.
    final showError = provider.error != null;

    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        sliver: SliverList(
          delegate: SliverChildListDelegate([
            const _TopBar(),
            const SizedBox(height: 24),
            if (showError) ...[
              _ErrorBanner(
                message: provider.error!,
                loading: provider.loading,
                onRetry: provider.refresh,
              ),
              const SizedBox(height: 16),
            ],
            const Text('TODAY', style: kSectionLabel),
            const SizedBox(height: 12),
            ModeToggle(mode: _mode, onChanged: _onModeChanged),
            const SizedBox(height: 16),
          ]),
        ),
      ),
      SliverToBoxAdapter(
        child: BodyMap3D(
          mode: _mode,
          muscleVolumes: volumes,
          flexibilityScores: flexibility,
          onMuscleTap: _onMuscleTap,
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        sliver: SliverList(
          delegate: SliverChildListDelegate([
            SelectedMuscleCard(
              mode: _mode,
              selectedGroup: _selectedGroup,
              flexibilityScores: flexibility,
              muscleDetails: details,
            ),
            const SizedBox(height: 16),
            HeatmapLegend(mode: _mode),
            const SizedBox(height: 24),
            _buildRecentWins(provider),
            const SizedBox(height: 24),
            const TodaysPracticeSection(),
            const SizedBox(height: 24),
            const StatsRow(),
            const SizedBox(height: 24),
            const WeeklyActivityChart(),
            const SizedBox(height: 8),
            const InspirationalFooter(),
            const SizedBox(height: 60),
          ]),
        ),
      ),
    ];
  }

  Widget _buildRecentWins(BodyMapProvider provider) {
    final wins = provider.recentWins;
    if (wins == null && provider.loading) {
      return const _RecentWinsSkeleton();
    }
    return RecentWinsList(wins: wins ?? const []);
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'DailyForge',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.3,
            color: kPrimaryText,
          ),
        ),
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: kCoral.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.person_outline, size: 18, color: kCoral),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  final bool loading;
  final Future<void> Function() onRetry;
  const _ErrorBanner({
    required this.message,
    required this.loading,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: kPrimaryText, fontSize: 13),
            ),
          ),
          TextButton(
            // Disable while in-flight so a second tap doesn't queue a
            // duplicate refresh. Spinner gives users visible feedback for
            // the up-to-15s timeout window — without it the button looked
            // dead between tap and banner re-display.
            onPressed: loading ? null : onRetry,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 32),
            ),
            child: loading
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor:
                          AlwaysStoppedAnimation<Color>(AppColors.error),
                    ),
                  )
                : const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _RecentWinsSkeleton extends StatelessWidget {
  const _RecentWinsSkeleton();

  @override
  Widget build(BuildContext context) {
    final block = Colors.black.withValues(alpha: 0.05);
    Widget bar({double width = 160, double height = 14}) => Container(
          height: height,
          width: width,
          decoration: BoxDecoration(
            color: block,
            borderRadius: BorderRadius.circular(4),
          ),
        );
    Widget row() => Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: block, shape: BoxShape.circle),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  bar(width: 100),
                  const SizedBox(height: 6),
                  bar(width: 180, height: 12),
                ],
              ),
            ],
          ),
        );
    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: Column(
        children: [
          row(),
          const Divider(height: 1, color: kCardBorder),
          row(),
          const Divider(height: 1, color: kCardBorder),
          row(),
        ],
      ),
    );
  }
}


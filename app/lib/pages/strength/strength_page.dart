import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../constants/focus_categories.dart';
import '../../launchers/session_launcher.dart';
import '../../models/suggested_session.dart';
import '../../providers/strength_provider.dart';
import '../../providers/suggest_provider.dart';
import '../../utils/focus_display.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/home/entry_point_warning_slot.dart';
import 'widgets/exercise_browse_card.dart';
import 'widgets/muscle_filter_chips.dart';
import 'widgets/routine_card.dart';

class StrengthPage extends StatefulWidget {
  const StrengthPage({super.key});

  @override
  State<StrengthPage> createState() => _StrengthPageState();
}

class _StrengthPageState extends State<StrengthPage> {
  final TextEditingController _searchController = TextEditingController();

  /// S14-T1 reroute: tracks which focus_slug the "TODAY'S STRENGTH" card has
  /// already fetched, so a return-to-tab visit after the user changed focus
  /// on Home triggers a refetch (β behavior, per amendment §5).
  String? _lastFetchedFocusSlug;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<StrengthProvider>();
      if (provider.exercises.isEmpty) {
        provider.refresh();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final suggest = context.read<SuggestProvider>();
    // FS #224: cold-start gate — see yoga_page for full rationale. Symmetric
    // fix; without it, opening the Strength tab on a cold app launch (with
    // no Home pick yet) would fire a doomed pillar-pure fetch and surface
    // a misleading network-error card.
    if (!suggest.hasUserSelectedFocus) return;
    if (isStateFocus(suggest.currentFocusSlug)) return;
    final currentFocus = suggest.currentFocusSlug;
    // FS #203 W3: re-fetch when sessionShape drifts away from pillar_pure
    // (e.g. user went Home → picked a body focus that produced a
    // cross_pillar shape → returned to Strength tab). Same root cause as
    // yoga_page; same fix.
    if (_lastFetchedFocusSlug != currentFocus
        || suggest.currentSession?.sessionShape != 'pillar_pure') {
      _lastFetchedFocusSlug = currentFocus;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _fetchTodaysStrength(currentFocus);
      });
    }
  }

  Future<void> _fetchTodaysStrength(String focusSlug) async {
    if (!mounted) return;
    final suggest = context.read<SuggestProvider>();
    await suggest.refreshForEntryPoint(
      entryPoint: 'strength_tab',
      focusSlug: focusSlug,
    );
  }

  Future<void> _onTodaysStrengthStart(SuggestedSession session) async {
    await SessionLauncher.launch(context, session);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Consumer<StrengthProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading && provider.exercises.isEmpty) {
              return _buildSkeleton();
            }

            if (provider.error != null && provider.exercises.isEmpty) {
              return _buildError(provider);
            }

            return RefreshIndicator(
              color: AppColors.strength,
              backgroundColor: AppColors.surface,
              onRefresh: () => provider.refresh(),
              child: CustomScrollView(
                slivers: [
                  // Header
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(
                        'Strength',
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                    ),
                  ),

                  // S14-T6 §6.4: recency-overlap banner above today's card.
                  const SliverToBoxAdapter(
                    child: EntryPointWarningSlot(entryPoint: 'strength_tab'),
                  ),
                  // S14-T1 reroute: Today's strength workout (engine-seeded).
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: _TodaysStrengthCard(
                        onStart: _onTodaysStrengthStart,
                        onRetry: () {
                          final last = _lastFetchedFocusSlug;
                          if (last == null) return;
                          _fetchTodaysStrength(last);
                        },
                      ),
                    ),
                  ),

                  // Empty Workout Card
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: GlassCard(
                        borderColor: AppColors.strength,
                        onTap: () => context.push('/workout/empty'),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.strength.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(LucideIcons.plus, color: AppColors.strength),
                            ),
                            const SizedBox(width: 16),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Empty Workout',
                                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                ),
                                Text(
                                  'Start from scratch',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // My Routines Section
                  SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 32, 16, 16),
                          child: Text(
                            'My Routines',
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                        ),
                        _buildRoutinesSection(provider),
                      ],
                    ),
                  ),

                  // Exercise Browser Section
                  SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 32, 16, 16),
                          child: Row(
                            children: [
                              Text(
                                'Exercise Library',
                                style: Theme.of(context).textTheme.headlineSmall,
                              ),
                              const SizedBox(width: 8),
                              if (provider.totalExercises > 0)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.cardBorder,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    '${provider.totalExercises}',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: AppColors.secondaryText,
                                          fontWeight: FontWeight.w600,
                                        ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0),
                          child: TextField(
                            controller: _searchController,
                            onChanged: provider.setSearch,
                            decoration: InputDecoration(
                              hintText: 'Search exercises...',
                              prefixIcon: const Icon(LucideIcons.search, size: 20, color: AppColors.hintText),
                              suffixIcon: _searchController.text.isNotEmpty
                                  ? IconButton(
                                      icon: const Icon(Icons.clear, size: 18),
                                      onPressed: () {
                                        _searchController.clear();
                                        provider.setSearch('');
                                      },
                                    )
                                  : null,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        const MuscleFilterChips(),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),

                  // Exercise List
                  if (provider.isLoading && provider.exercises.isEmpty)
                    const SliverToBoxAdapter(
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(40.0),
                          child: CircularProgressIndicator(color: AppColors.strength),
                        ),
                      ),
                    )
                  else if (provider.exercises.isEmpty)
                    SliverToBoxAdapter(
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(40.0),
                          child: Text(
                            'No exercises found',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ),
                      ),
                    )
                  else
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          if (index < provider.exercises.length) {
                            return ExerciseBrowseCard(exercise: provider.exercises[index]);
                          } else if (provider.hasMore) {
                            return Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Center(
                                child: provider.isLoading
                                    ? const CircularProgressIndicator(color: AppColors.strength)
                                    : TextButton(
                                        onPressed: provider.loadMore,
                                        child: Text(
                                          'Load More',
                                          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                                color: AppColors.strength,
                                              ),
                                        ),
                                      ),
                              ),
                            );
                          }
                          return null;
                        },
                        childCount: provider.exercises.length + (provider.hasMore ? 1 : 0),
                      ),
                    ),

                  const SliverToBoxAdapter(child: SizedBox(height: 40)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildSkeleton() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _skeletonBox(120, 28),
          const SizedBox(height: 20),
          _skeletonBox(double.infinity, 72),
          const SizedBox(height: 32),
          _skeletonBox(120, 20),
          const SizedBox(height: 16),
          _skeletonBox(double.infinity, 120),
          const SizedBox(height: 32),
          _skeletonBox(140, 20),
          const SizedBox(height: 16),
          _skeletonBox(double.infinity, 48),
          const SizedBox(height: 16),
          ...[1, 2, 3].map((_) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _skeletonBox(double.infinity, 64),
              )),
        ],
      ),
    );
  }

  Widget _skeletonBox(double width, double height) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
    );
  }

  Widget _buildError(StrengthProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.wifiOff, size: 48, color: AppColors.secondaryText),
            const SizedBox(height: 16),
            Text(
              provider.error ?? 'Something went wrong',
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => provider.refresh(),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.strength,
                foregroundColor: Colors.white,
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoutinesSection(StrengthProvider provider) {
    if (provider.isLoadingRoutines) {
      return const SizedBox(
        height: 120,
        child: Center(child: CircularProgressIndicator(color: AppColors.strength)),
      );
    }

    if (provider.routines.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: GlassCard(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Text(
              'No saved routines yet',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: 120,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: provider.routines.length,
        itemBuilder: (context, index) {
          return RoutineCard(routine: provider.routines[index]);
        },
      ),
    );
  }
}

/// S14-T1 reroute: top-of-page card on the Strength tab. Shows the engine's
/// pillar-pure strength suggestion for today's focus and a Start button that
/// dispatches [SessionLauncher]. Subscribes to [SuggestProvider] so changes
/// from the home page (or anywhere else) reactively refresh the card.
///
/// Visual style mirrors the home session card structurally (TODAY label,
/// title, subtitle, primary Start button) while reusing the dark-theme
/// Strength-tab tokens — `GlassCard` + `AppColors.strength` accent.
class _TodaysStrengthCard extends StatelessWidget {
  final Future<void> Function(SuggestedSession session) onStart;
  final VoidCallback onRetry;

  const _TodaysStrengthCard({
    required this.onStart,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<SuggestProvider>(
      builder: (context, suggest, _) {
        // FS #224: pre-pick empty state; mirrors the yoga_page treatment.
        if (!suggest.hasUserSelectedFocus) {
          return const _StrengthTabEmptyState();
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
          // Defensive: home is showing cross_pillar via _entryPointHome; we
          // shouldn't get here from refreshForEntryPoint('strength_tab') but
          // guard rather than render a broken card.
          return const SizedBox.shrink();
        }
        return _buildReady(session, isLoading);
      },
    );
  }

  Widget _buildSkeleton() {
    return GlassCard(
      borderColor: AppColors.strength,
      child: SizedBox(
        height: 132,
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.strength.withValues(alpha: 0.6),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildError(String message) {
    return GlassCard(
      borderColor: AppColors.strength,
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
            style: TextButton.styleFrom(foregroundColor: AppColors.strength),
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
        focusSlug.isEmpty ? 'Strength' : capitalizeFocus(focusSlug);
    final exerciseCount = session.phases
        .expand((p) => p.items)
        .where((i) => i.contentType == 'strength')
        .length;

    final card = GlassCard(
      borderColor: AppColors.strength,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "TODAY'S STRENGTH",
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
            exerciseCount == 1 ? '1 exercise' : '$exerciseCount exercises',
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
                backgroundColor: AppColors.strength,
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

/// FS #224: pre-pick empty state shown above the Strength tab body when the
/// user hasn't actively picked a focus yet. Strength tab below — Empty
/// Workout / Routines / Exercise Library — stays fully functional. Copy is
/// intentionally narrower than the Yoga tab's because Strength has no
/// "custom session builder" picker analogue on this page.
class _StrengthTabEmptyState extends StatelessWidget {
  const _StrengthTabEmptyState();

  @override
  Widget build(BuildContext context) {
    return const GlassCard(
      borderColor: AppColors.strength,
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
            'Pick a focus on Home to see today\'s suggested Strength '
            'workout.',
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

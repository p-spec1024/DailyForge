import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/strength_provider.dart';
import '../../widgets/glass_card.dart';
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

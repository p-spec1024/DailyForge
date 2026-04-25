import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/body_measurements_provider.dart';
import '../../providers/profile_provider.dart';
import '../../widgets/body_measurements/add_measurement_sheet.dart';
import '../../widgets/body_measurements/chart_view.dart';
import '../../widgets/body_measurements/list_view.dart';

class BodyMeasurementsPage extends StatefulWidget {
  const BodyMeasurementsPage({super.key});

  @override
  State<BodyMeasurementsPage> createState() => _BodyMeasurementsPageState();
}

class _BodyMeasurementsPageState extends State<BodyMeasurementsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BodyMeasurementsProvider>().fetchAll(force: true);
      context.read<ProfileProvider>().fetchProfile();
    });
  }

  void _showAddSheet() {
    final profileProvider = context.read<ProfileProvider>();
    final measurementsProvider = context.read<BodyMeasurementsProvider>();
    final today = measurementsProvider.todayEntry;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddMeasurementSheet(
        unitSystem: profileProvider.unitSystem,
        existing: today,
        onSave: (data) => today != null
            ? measurementsProvider.updateMeasurement(today.id, data)
            : measurementsProvider.addMeasurement(data),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Consumer2<BodyMeasurementsProvider, ProfileProvider>(
          builder: (context, provider, profile, _) {
            if (provider.isLoading && provider.stats == null) {
              return const Center(
                child: CircularProgressIndicator(color: AppColors.gold),
              );
            }

            if (provider.error != null && provider.stats == null) {
              return _buildError(provider);
            }

            return RefreshIndicator(
              onRefresh: () => provider.fetchAll(force: true),
              color: AppColors.gold,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: _buildHeader(context, provider),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                    sliver: SliverToBoxAdapter(
                      child: provider.viewMode == ViewMode.chart
                          ? const ChartView()
                          : const MeasurementsListView(),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
      floatingActionButton: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.accent.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: FloatingActionButton(
          onPressed: _showAddSheet,
          backgroundColor: AppColors.accent,
          elevation: 0,
          child: const Icon(Icons.add, color: Colors.white, size: 26),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, BodyMeasurementsProvider provider) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(LucideIcons.arrowLeft,
                color: AppColors.primaryText, size: 20),
            onPressed: () => context.pop(),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          ),
          const SizedBox(width: 4),
          const Expanded(
            child: Text(
              'Body measurements',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          _ViewToggle(
            mode: provider.viewMode,
            onChanged: provider.setViewMode,
          ),
        ],
      ),
    );
  }

  Widget _buildError(BodyMeasurementsProvider provider) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.alertCircle, color: Colors.red.shade400, size: 48),
          const SizedBox(height: 16),
          Text(
            'Failed to load measurements',
            style: TextStyle(color: Colors.red.shade400),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => provider.fetchAll(force: true),
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.gold),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _ViewToggle extends StatelessWidget {
  final ViewMode mode;
  final ValueChanged<ViewMode> onChanged;

  const _ViewToggle({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        children: [
          _buildIcon(LucideIcons.lineChart, ViewMode.chart),
          _buildIcon(LucideIcons.list, ViewMode.list),
        ],
      ),
    );
  }

  Widget _buildIcon(IconData icon, ViewMode target) {
    final active = mode == target;
    return GestureDetector(
      onTap: () => onChanged(target),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Icon(
          icon,
          size: 16,
          color: active ? Colors.white : Colors.white.withValues(alpha: 0.4),
        ),
      ),
    );
  }
}

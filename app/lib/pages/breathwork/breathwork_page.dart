import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/breathwork_provider.dart';
import '../../widgets/breathwork/category_filter_chips.dart';
import '../../widgets/breathwork/technique_card.dart';
import '../../widgets/glass_card.dart';

const _kCategories = [
  'all',
  'energizing',
  'calming',
  'focus',
  'sleep',
  'performance',
  'recovery',
];

class BreathworkPage extends StatefulWidget {
  const BreathworkPage({super.key});

  @override
  State<BreathworkPage> createState() => _BreathworkPageState();
}

class _BreathworkPageState extends State<BreathworkPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<BreathworkProvider>();
      if (p.techniques.isEmpty && !p.isLoading) p.loadTechniques();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Consumer<BreathworkProvider>(
          builder: (context, provider, _) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, 12),
                  child: Text(
                    'Breathwork',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primaryText,
                    ),
                  ),
                ),
                CategoryFilterChips(
                  categories: _kCategories,
                  active: provider.activeCategory,
                  onSelect: provider.setCategory,
                ),
                if (provider.error != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: _ErrorBanner(
                      message: provider.error!,
                      onRetry: provider.loadTechniques,
                    ),
                  ),
                Expanded(child: _buildList(provider)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildList(BreathworkProvider provider) {
    if (provider.isLoading && provider.techniques.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        itemCount: 4,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, __) => const _SkeletonCard(),
      );
    }

    final items = provider.filteredTechniques;
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: provider.loadTechniques,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            Padding(
              padding: const EdgeInsets.all(32),
              child: Text(
                provider.activeCategory == 'all'
                    ? 'No techniques found'
                    : 'No techniques found for "${capitalize(provider.activeCategory)}"',
                style: const TextStyle(color: AppColors.hintText),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: provider.loadTechniques,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final t = items[i];
          return TechniqueCard(
            technique: t,
            onTap: () => context.push('/breathwork/${t.id}'),
          );
        },
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorBanner({required this.message, required this.onRetry});

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
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    final base = Colors.white.withValues(alpha: 0.06);
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(height: 14, width: 160, color: base),
          const SizedBox(height: 8),
          Container(height: 10, width: 120, color: base),
          const SizedBox(height: 8),
          Container(height: 10, width: 90, color: base),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(height: 14, width: 50, color: base),
              const SizedBox(width: 6),
              Container(height: 14, width: 50, color: base),
            ],
          ),
        ],
      ),
    );
  }
}

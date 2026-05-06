import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/body_map.dart';
import '../../providers/body_map_provider.dart';
import '../home/widgets/_tokens.dart';
import '../home/widgets/body_map_3d.dart';
import '../home/widgets/heatmap_legend.dart';
import '../home/widgets/mode_toggle.dart';
import '../home/widgets/selected_muscle_card.dart';

/// Body tab — relocated 3D body map (S13-T4).
/// Reuses the Sprint-10 widgets without redesign per the design doc:
/// "no redesign in this ticket, just relocation". The home-page muscle-card
/// detail panel and heatmap-mode toggle move with it.
class BodyPage extends StatefulWidget {
  const BodyPage({super.key});

  @override
  State<BodyPage> createState() => _BodyPageState();
}

class _BodyPageState extends State<BodyPage> {
  BodyMapMode _mode = BodyMapMode.muscles;
  String? _selectedGroup;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<BodyMapProvider>().load();
    });
  }

  void _onMuscleTap(String? group) {
    setState(() => _selectedGroup = group);
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
      ),
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: kCream,
          surfaceTintColor: kCream,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: kPrimaryText),
            onPressed: () => context.go('/home'),
          ),
          title: const Text(
            'Body',
            style: TextStyle(
              color: kPrimaryText,
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
        ),
        body: SafeArea(
          child: Consumer<BodyMapProvider>(
            builder: (context, provider, _) {
              final volumes = provider.muscleVolumes ?? const <String, int>{};
              final details = provider.muscleDetails ?? const <String, MuscleDetail>{};
              final flexibility = provider.flexibility ?? const <String, int>{};
              return CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
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
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
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
                      ]),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

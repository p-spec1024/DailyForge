import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:interactive_3d/interactive_3d.dart';

import '../../../data/muscle_groups.dart';
import '../../../utils/heatmap_color.dart';

enum BodyMapMode { muscles, flexibility }

const List<double> _bgCream = [0.98, 0.98, 0.97, 1.0];
const List<double> _selectionCoral = [0.95, 0.55, 0.40, 1.0];
// Base (non-muscle) mesh = #606060, intentionally one notch DARKER than
// the heatmap "0-20 Fresh" band (#686868) so a barely-trained muscle
// reads as just visible against the untrained silhouette. Final color in
// the T5c-a iteration sequence #C8C8C8 → #A8A8A8 → #808080 → #606060;
// further visual work deferred to FUTURE_SCOPE #108 (Tripo AI character).
const List<double> _neutralGrayRgba = [0.376, 0.376, 0.376, 1.0];

/// 3D anatomical figure with heatmap coloring and tap-to-select.
///
/// Native (Filament/SceneKit) owns selection state — the host observes via
/// [onMuscleTap] if it needs to mirror the selection into its own state.
/// The only place this widget imperatively reaches back into native is
/// `clearSelections()` on mode switch, which is an explicit user action
/// rather than reactive sync. Reactive sync fights the package's
/// architecture and stalls its input pipeline on Android (see Step 2
/// post-mortem for the symptoms).
class BodyMap3D extends StatefulWidget {
  final BodyMapMode mode;

  /// Group → 0-100 volume (e.g. 'Chest' → 72). Used in Muscles mode.
  final Map<String, int> muscleVolumes;

  /// Region → 0-100 mobility score (e.g. 'Spine' → 68). Used in Flexibility mode.
  final Map<String, int> flexibilityScores;

  /// Fires with the resolved group name on muscle tap, or `null` to deselect.
  final void Function(String? group) onMuscleTap;

  const BodyMap3D({
    super.key,
    required this.mode,
    required this.muscleVolumes,
    required this.flexibilityScores,
    required this.onMuscleTap,
  });

  @override
  State<BodyMap3D> createState() => _BodyMap3DState();
}

class _BodyMap3DState extends State<BodyMap3D> {
  final Interactive3dController _controller = Interactive3dController();
  late final Map<String, String> _meshToGroup = buildMeshToGroup();

  List<PatchColor> _buildPatchColors() {
    final patches = <PatchColor>[];

    if (widget.mode == BodyMapMode.muscles) {
      for (final mesh in tappableMeshes) {
        final group = _meshToGroup[mesh];
        final volume = group == null ? 0 : (widget.muscleVolumes[group] ?? 0);
        patches.add(PatchColor(name: mesh, color: heatmapRgba(volume)));
      }
    } else {
      // Flexibility: a mesh may belong to multiple regions — take MAX score.
      final meshScores = <String, int>{};
      widget.flexibilityScores.forEach((region, score) {
        final meshes = flexibilityToMeshes[region];
        if (meshes == null) return;
        for (final m in meshes) {
          meshScores[m] = math.max(meshScores[m] ?? 0, score);
        }
      });
      for (final mesh in tappableMeshes) {
        patches.add(
          PatchColor(name: mesh, color: heatmapRgba(meshScores[mesh] ?? 0)),
        );
      }
    }

    patches.add(PatchColor(name: 'base', color: _neutralGrayRgba));
    return patches;
  }

  void _handleSelection(List<EntityData> entities) {
    HapticFeedback.selectionClick();

    // Single-select normalization. Native lets multiple meshes accumulate
    // (no single-select widget config exists in interactive_3d 2.0.3).
    // Trim to the most-recently-tapped (last in list) and unselect older
    // IDs so figure highlights match the card. This is a tap-driven user
    // action — NOT a reactive state-transition clear (per Apr 23 learning,
    // SPRINT_TRACKER.md): the race condition there was about clearing in
    // didUpdateWidget, not in the user-tap callback.
    if (entities.length > 1) {
      final keepId = entities.last.id;
      final unselectIds = entities
          .where((e) => e.id != keepId)
          .map((e) => e.id)
          .toList(growable: false);
      if (unselectIds.isNotEmpty) {
        _controller.unselectEntities(entityIds: unselectIds);
      }
    }

    String? resolved;
    if (entities.isNotEmpty) {
      final meshName = entities.last.name;
      if (meshName != 'base' && tappableMeshes.contains(meshName)) {
        resolved = widget.mode == BodyMapMode.muscles
            ? _meshToGroup[meshName]
            : meshToFlexibilityRegion(meshName);
      }
    }

    widget.onMuscleTap(resolved);
  }

  @override
  Widget build(BuildContext context) {
    // KNOWN package quirk (interactive_3d 2.0.3): patchColors are sent to
    // native ONCE in initState/loadModel — not re-applied on widget update.
    // So we must (a) defer mounting until provider data has arrived, and
    // (b) force a remount (via ValueKey) on mode change so the new mode's
    // patches are sent at init. As a side effect, pull-to-refresh does NOT
    // recolor the figure mid-session; refreshed data flows through the
    // selected-muscle card and recent-wins list, but the figure colors are
    // first-mount-only. Acceptable v1 limitation per spec ("fetch fresh on
    // page open").
    final hasData = widget.muscleVolumes.isNotEmpty ||
        widget.flexibilityScores.isNotEmpty;
    if (!hasData) {
      // Reserve the layout space so nothing jumps when the figure mounts.
      return const SizedBox(height: 420);
    }
    return Center(
      child: SizedBox(
        height: 420,
        child: Interactive3d(
          key: ValueKey(
            'body-map-${widget.mode}-${widget.muscleVolumes.length}-${widget.flexibilityScores.length}',
          ),
          controller: _controller,
          modelPath: 'assets/models/male_anatomy_split.glb',
          solidBackgroundColor: _bgCream,
          selectionColor: _selectionCoral,
          defaultZoom: 2.5,
          patchColors: _buildPatchColors(),
          onSelectionChanged: _handleSelection,
        ),
      ),
    );
  }
}

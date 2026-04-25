// SPIKE — Step 0 of S10-T5a. Delete this directory before final commit.
//
// Goal: verify interactive_3d 2.0.3 loads our GLB, colors all 26 named
// muscle meshes via PatchColor, and returns our mesh names via
// onSelectionChanged.
//
// The package does NOT expose a "list all entities on load" API (v2.0.3 —
// no onModelLoaded callback, controller has no listEntities method). So we
// verify name coverage visually: paint every expected mesh with a heatmap
// color. Any expected name that's missing from the GLB will render default
// (unpainted white). Cross-reference taps against the expected-names list
// rendered below the figure.
//
// Reachable at /spike/body-map via Profile → [spike] menu item.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:interactive_3d/interactive_3d.dart';

// Mock volumes per muscle group, 0-100 — same as ticket's mock data.
const Map<String, int> _mockVolumes = {
  'Chest': 72, 'Shoulders': 58, 'Biceps': 48, 'Triceps': 65,
  'Forearms': 32, 'Core': 55, 'Back': 78, 'Glutes': 12,
  'Quads': 85, 'Hamstrings': 38, 'Calves': 22,
};

// Group → meshes mapping (same as ticket's muscle_groups.dart).
const Map<String, List<String>> _groupToMeshes = {
  'Chest':      ['chest_L', 'chest_R'],
  'Shoulders':  ['delt_L', 'delt_R'],
  'Biceps':     ['bicep_L', 'bicep_R'],
  'Triceps':    ['tricep_L', 'tricep_R'],
  'Forearms':   ['forearm_L', 'forearm_R'],
  'Core':       ['abs_upper', 'abs_lower', 'oblique_L', 'oblique_R'],
  'Back':       ['upper_back_L', 'upper_back_R', 'lats_L', 'lats_R', 'lower_back'],
  'Glutes':     ['glutes'],
  'Quads':      ['quad_L', 'quad_R'],
  'Hamstrings': ['ham_L', 'ham_R'],
  'Calves':     ['calf_L', 'calf_R'],
};

List<double> _heatmapRgba(int v) {
  if (v < 20) return const [0.784, 0.784, 0.784, 1.0];
  if (v < 40) return const [0.961, 0.769, 0.702, 1.0];
  if (v < 60) return const [0.941, 0.600, 0.482, 1.0];
  if (v < 80) return const [0.847, 0.353, 0.188, 1.0];
  return const [0.600, 0.235, 0.114, 1.0];
}

List<PatchColor> _buildPatchColors() {
  final patches = <PatchColor>[];
  _groupToMeshes.forEach((group, meshes) {
    final rgba = _heatmapRgba(_mockVolumes[group] ?? 0);
    for (final m in meshes) {
      patches.add(PatchColor(name: m, color: rgba));
    }
  });
  patches.add(PatchColor(name: 'base', color: const [0.784, 0.784, 0.784, 1.0]));
  return patches;
}

List<String> _expectedNames() =>
    [..._groupToMeshes.values.expand((m) => m), 'base'];

class BodyMapSpikePage extends StatefulWidget {
  const BodyMapSpikePage({super.key});

  @override
  State<BodyMapSpikePage> createState() => _BodyMapSpikePageState();
}

class _BodyMapSpikePageState extends State<BodyMapSpikePage> {
  final List<String> _log = [];
  late final List<PatchColor> _patches = _buildPatchColors();
  late final List<String> _expected = _expectedNames();

  void _append(String line) {
    setState(() {
      _log.insert(0, line);
      if (_log.length > 40) _log.removeLast();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAF7),
      appBar: AppBar(
        title: const Text('interactive_3d spike'),
        backgroundColor: const Color(0xFFFAFAF7),
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: Column(
        children: [
          SizedBox(
            height: 420,
            child: Interactive3d(
              solidBackgroundColor: const [0.98, 0.98, 0.97, 1.0],
              modelPath: 'assets/models/male_anatomy_split.glb',
              selectionColor: const [0.95, 0.55, 0.40, 1.0],
              defaultZoom: 2.5,
              patchColors: _patches,
              onSelectionChanged: (entities) {
                HapticFeedback.selectionClick();
                final line = entities.isEmpty
                    ? 'TAPPED: <empty>'
                    : 'TAPPED: ${entities.map((e) => '${e.name}#${e.id}').join(", ")}';
                debugPrint(line);
                _append(line);
              },
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Tap log:', style: TextStyle(fontWeight: FontWeight.w600)),
                Text(
                  '${_expected.length} expected meshes',
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 2,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _log.length,
              itemBuilder: (_, i) => Text(
                _log[i],
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              ),
            ),
          ),
          const Divider(height: 1),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Expected names (any unpainted mesh = missing):',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
          Expanded(
            flex: 1,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _expected.join(', '),
                style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.black54),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

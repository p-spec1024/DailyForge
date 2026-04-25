// Maps between GLB mesh names and user-facing muscle group labels for the
// 3D body map on the Home page (S10-T5a).

const Map<String, List<String>> dbGroupToMeshes = {
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

Map<String, String> buildMeshToGroup() {
  final result = <String, String>{};
  dbGroupToMeshes.forEach((group, meshes) {
    for (final m in meshes) {
      result[m] = group;
    }
  });
  return result;
}

const Set<String> tappableMeshes = {
  'chest_L', 'chest_R', 'delt_L', 'delt_R', 'bicep_L', 'bicep_R',
  'tricep_L', 'tricep_R', 'forearm_L', 'forearm_R',
  'abs_upper', 'abs_lower', 'oblique_L', 'oblique_R',
  'upper_back_L', 'upper_back_R', 'lats_L', 'lats_R', 'lower_back',
  'glutes', 'quad_L', 'quad_R', 'ham_L', 'ham_R', 'calf_L', 'calf_R',
};

/// Flexibility regions → meshes. A mesh may appear in multiple regions;
/// the Flexibility heatmap takes the MAX score across applicable regions.
const Map<String, List<String>> flexibilityToMeshes = {
  'Spine':     ['lower_back', 'upper_back_L', 'upper_back_R'],
  'Hips':      ['glutes', 'ham_L', 'ham_R'],
  'Shoulders': ['delt_L', 'delt_R', 'upper_back_L', 'upper_back_R'],
};

/// Resolves a mesh name to its flexibility region, or null if the mesh
/// isn't part of any region (e.g. chest tapped while in Flex mode).
/// Returns the first matching region in `flexibilityToMeshes` insertion
/// order, which is deterministic for shared meshes like `upper_back_*`.
String? meshToFlexibilityRegion(String mesh) {
  for (final entry in flexibilityToMeshes.entries) {
    if (entry.value.contains(mesh)) return entry.key;
  }
  return null;
}

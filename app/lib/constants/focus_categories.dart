/// The 5 state focuses — modalities targeting a mental/emotional state
/// rather than a body part. State-focus sessions are breathwork-driven and
/// do not produce pillar-pure yoga/strength shapes; entry-point surfaces use
/// this set to decide when to hide pillar-specific cards.
///
/// S14-T6 FS #226: single source of truth for the state-focus taxonomy.
/// Replaces inline duplicates previously living in `launchers/focus_utils.dart`
/// and `widgets/home/entry_point_warning_slot.dart`.
const Set<String> kStateFocusSlugs = <String>{
  'energize',
  'calm',
  'focus',
  'sleep',
  'recover',
};

/// True iff [slug] is one of the 5 state focuses. Returns false for null,
/// empty, or any body focus.
bool isStateFocus(String? slug) {
  if (slug == null || slug.isEmpty) return false;
  return kStateFocusSlugs.contains(slug);
}

/// The 5 state focus slugs enumerated in `focus_areas` (S12-T3.5).
/// Hardcoded here per S14-T3 spec PF6 path B — no `currentFocusType` getter
/// is exposed by `SuggestProvider`. A migration would change the source set,
/// so this set is safe to enumerate.
const Set<String> _kStateFocusSlugs = {
  'energize',
  'calm',
  'focus',
  'sleep',
  'recover',
};

/// True if [slug] is one of the 5 state focuses. Returns false for null/empty
/// or any body focus.
bool isStateFocus(String? slug) {
  if (slug == null || slug.isEmpty) return false;
  return _kStateFocusSlugs.contains(slug);
}

/// FS #203 A1: shared focus-slug → display-name capitalization.
///
/// Used by entry-point cards (yoga_tab, strength_tab) and elsewhere where a
/// focus_slug needs to be rendered as a user-facing label. Pre-extraction the
/// same 5-line implementation lived inline in yoga_page.dart and
/// strength_page.dart as private `_capitalizeFocus` methods.
///
/// Splits on underscore, capitalizes each segment's first char, joins with
/// space. Leaves the slug as a single capitalized word when there are no
/// underscores.
///
///   'full_body'  → 'Full Body'
///   'biceps'     → 'Biceps'
///   ''           → ''  (caller responsibility to handle empty)
String capitalizeFocus(String slug) {
  return slug
      .split('_')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

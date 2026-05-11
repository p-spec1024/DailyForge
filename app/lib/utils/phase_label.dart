/// Maps engine-internal phase slugs to user-facing labels per Blueprint
/// v5 §6 and S14-T4 AMENDMENT-2 D7.
///
/// Cross-pillar phases:
///   bookend_open  → Opening
///   warmup        → Warm-up
///   main          → Strength / Yoga / Breathwork (uses [contentType])
///   cooldown      → Cool-down
///   bookend_close → Closing
///
/// State-focus legs:
///   centering   → Centering
///   practice    → Practice
///   reflection  → Reflection
///
/// Defensive fallback for unknown slugs: prettify `_` → space + title-case.
String phaseDisplayLabel(String slug, {String? contentType}) {
  switch (slug) {
    case 'bookend_open':
      return 'Opening';
    case 'warmup':
      return 'Warm-up';
    case 'main':
      switch (contentType) {
        case 'strength':
          return 'Strength';
        case 'yoga':
          return 'Yoga';
        case 'breathwork':
          return 'Breathwork';
        default:
          return 'Main';
      }
    case 'cooldown':
      return 'Cool-down';
    case 'bookend_close':
      return 'Closing';
    case 'centering':
      return 'Centering';
    case 'practice':
      return 'Practice';
    case 'reflection':
      return 'Reflection';
    default:
      return slug
          .split('_')
          .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
          .join(' ');
  }
}

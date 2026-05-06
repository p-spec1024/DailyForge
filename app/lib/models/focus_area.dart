// Focus-area model for the home-page orbit picker (S13-T4).
// Decoded from `GET /api/focus-areas` (S13-T2 endpoint).
//
// Server returns `{focus_areas: [{slug, display_name, type, display_order}]}`,
// where `type` is the route-layer alias for the DB's `focus_type` column
// (FUTURE_SCOPE #169 — column rename queued).

class FocusArea {
  final String slug;
  final String displayName;
  /// 'body' or 'state' — anything else is a server contract violation.
  final String type;
  final int displayOrder;

  const FocusArea({
    required this.slug,
    required this.displayName,
    required this.type,
    required this.displayOrder,
  });

  bool get isBody => type == 'body';
  bool get isState => type == 'state';

  factory FocusArea.fromJson(Map<String, dynamic> json) {
    final slug = json['slug'];
    if (slug is! String || slug.isEmpty) {
      throw FormatException(
        'FocusArea: expected non-empty `slug` string, got ${slug.runtimeType}',
      );
    }
    final name = json['display_name'];
    if (name is! String || name.isEmpty) {
      throw FormatException(
        'FocusArea: expected non-empty `display_name` string, got ${name.runtimeType}',
      );
    }
    final type = json['type'];
    if (type != 'body' && type != 'state') {
      throw FormatException(
        'FocusArea: expected `type` in {body,state}, got $type',
      );
    }
    final order = json['display_order'];
    if (order is! num) {
      throw FormatException(
        'FocusArea: expected `display_order` to be a number, got ${order.runtimeType}',
      );
    }
    return FocusArea(
      slug: slug,
      displayName: name,
      type: type,
      displayOrder: order.toInt(),
    );
  }
}

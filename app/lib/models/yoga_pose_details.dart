// FS #203 A2 (S14-T3 carryover): lightweight view of a yoga pose row,
// populated by the `POST /api/yoga/poses-by-ids` hydration endpoint. The
// yoga adapter combines engine output (phase placement, hold duration)
// with these details to produce the YogaPose objects the player consumes.
//
// Lives in `models/` because it's a pure data class with no behavior;
// pre-relocation it shared a file with the adapter under `launchers/`.

import '../adapters/yoga_session_errors.dart';

class YogaPoseDetails {
  final int id;
  final String name;
  final String? sanskritName;
  final String? description;
  final String? targetMuscles;
  final String difficulty;

  YogaPoseDetails({
    required this.id,
    required this.name,
    this.sanskritName,
    this.description,
    this.targetMuscles,
    required this.difficulty,
  });

  /// FS #203 W2: throws [YogaHydrationException] on shape violations so the
  /// launcher's `_friendlyYogaError` can switch on exception type rather
  /// than substring-matching messages.
  factory YogaPoseDetails.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final name = json['name'];
    if (id is! int) {
      throw YogaHydrationException(
        'YogaPoseDetails: id must be int, got ${id.runtimeType}',
      );
    }
    if (name is! String || name.isEmpty) {
      throw YogaHydrationException(
        'YogaPoseDetails: name must be non-empty string',
      );
    }
    return YogaPoseDetails(
      id: id,
      name: name,
      sanskritName: json['sanskrit_name'] as String?,
      description: json['description'] as String?,
      targetMuscles: json['target_muscles'] as String?,
      difficulty: (json['difficulty'] as String?) ?? 'beginner',
    );
  }
}

// Shared types for the home-page 3D body map (S10-T5a/b/c).
//
// Both the live BodyMapService (HTTP) and mock_body_map_data.dart (offline)
// emit instances of these types — keep them aligned so the
// kUseMockBodyMap flip is a no-op for downstream widgets.

class RecentWin {
  final String icon;
  final String title;
  final String subtitle;

  const RecentWin({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  /// Backend contract: `List<{icon, title, subtitle}>`, all string values.
  /// See `server/src/routes/bodyMap.js` recent-wins handler.
  factory RecentWin.fromJson(Map<String, dynamic> json) {
    return RecentWin(
      icon: json['icon'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
    );
  }
}

/// Per-muscle tap-card detail (Last trained / Volume / Top exercise / Sets).
/// Emitted server-side by `/api/body-map/muscle-volumes` (S10-T5c-b) as part
/// of the `details` map.
class MuscleDetail {
  final String lastTrained;
  final String volumeLabel;
  final String topExercise;
  final int setsThisWeek;

  const MuscleDetail({
    required this.lastTrained,
    required this.volumeLabel,
    required this.topExercise,
    required this.setsThisWeek,
  });

  static const zero = MuscleDetail(
    lastTrained: 'Not yet',
    volumeLabel: '—',
    topExercise: '—',
    setsThisWeek: 0,
  );

  factory MuscleDetail.fromJson(Map<String, dynamic> json) {
    return MuscleDetail(
      lastTrained: json['lastTrained'] as String? ?? '',
      volumeLabel: json['volumeLabel'] as String? ?? '',
      topExercise: json['topExercise'] as String? ?? '',
      setsThisWeek: (json['setsThisWeek'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Envelope response for `GET /api/body-map/muscle-volumes` (S10-T5c-b).
/// Wraps the existing heatmap map with per-muscle detail for the tap-card.
class MuscleVolumesResponse {
  final Map<String, int> volumes;
  final Map<String, MuscleDetail> details;

  const MuscleVolumesResponse({required this.volumes, required this.details});

  /// Graceful decode — tolerates the pre-T5c-b flat shape
  /// (Map<String, int> with muscle keys) so a stale server doesn't break the
  /// client. In that case details map is empty and the card falls back to
  /// `MuscleDetail.zero` per group.
  factory MuscleVolumesResponse.fromJson(Map<String, dynamic> json) {
    final rawVolumes = json['volumes'];
    if (rawVolumes is Map) {
      final volumes = <String, int>{};
      rawVolumes.forEach((k, v) {
        if (k is String && v is num) volumes[k] = v.toInt();
      });
      final details = <String, MuscleDetail>{};
      final rawDetails = json['details'];
      if (rawDetails is Map) {
        rawDetails.forEach((k, v) {
          if (k is String && v is Map) {
            details[k] = MuscleDetail.fromJson(
              v.map((ik, iv) => MapEntry(ik as String, iv)),
            );
          }
        });
      }
      return MuscleVolumesResponse(volumes: volumes, details: details);
    }

    // Legacy shape: the payload itself is the volume map.
    final volumes = <String, int>{};
    json.forEach((k, v) {
      if (v is num) volumes[k] = v.toInt();
    });
    return MuscleVolumesResponse(volumes: volumes, details: const {});
  }
}

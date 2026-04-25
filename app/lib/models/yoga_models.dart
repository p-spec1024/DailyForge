class YogaConfig {
  final String type;
  final String level;
  final int duration;
  final List<String> focus;

  const YogaConfig({
    required this.type,
    required this.level,
    required this.duration,
    required this.focus,
  });

  YogaConfig copyWith({
    String? type,
    String? level,
    int? duration,
    List<String>? focus,
  }) {
    return YogaConfig(
      type: type ?? this.type,
      level: level ?? this.level,
      duration: duration ?? this.duration,
      focus: focus ?? this.focus,
    );
  }

  Map<String, dynamic> toJson() => {
        'type': type,
        'level': level,
        'duration': duration,
        'focus': focus,
      };

  factory YogaConfig.fromJson(Map<String, dynamic> json) {
    List<String> strList(dynamic v) {
      if (v is List) return v.map((e) => e.toString()).toList();
      return const [];
    }

    return YogaConfig(
      type: json['type'] as String? ?? 'vinyasa',
      level: json['level'] as String? ?? 'intermediate',
      duration: json['duration'] as int? ?? 30,
      focus: strList(json['focus']),
    );
  }

  static const defaults = YogaConfig(
    type: 'vinyasa',
    level: 'intermediate',
    duration: 30,
    focus: [],
  );
}

class YogaPose {
  final int id;
  final String name;
  final String? sanskritName;
  final String? description;
  final String phase; // warmup, peak, cooldown, savasana
  final String? targetMuscles;
  final int holdSeconds;
  final String difficulty;

  const YogaPose({
    required this.id,
    required this.name,
    this.sanskritName,
    this.description,
    required this.phase,
    this.targetMuscles,
    required this.holdSeconds,
    required this.difficulty,
  });

  factory YogaPose.fromJson(Map<String, dynamic> json) {
    return YogaPose(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      sanskritName: json['sanskrit_name'] as String?,
      description: json['description'] as String?,
      phase: json['phase'] as String? ?? json['category'] as String? ?? 'peak',
      targetMuscles: json['target_muscles'] as String?,
      holdSeconds: json['hold_seconds'] as int? ?? 30,
      difficulty: json['difficulty'] as String? ?? 'beginner',
    );
  }
}

class YogaSession {
  final String type;
  final String level;
  final int duration;
  final List<String> focus;
  final List<YogaPose> poses;
  final int totalMinutes;
  final int poseCount;

  const YogaSession({
    required this.type,
    required this.level,
    required this.duration,
    required this.focus,
    required this.poses,
    required this.totalMinutes,
    required this.poseCount,
  });

  factory YogaSession.fromJson(Map<String, dynamic> json) {
    List<String> strList(dynamic v) {
      if (v is List) return v.map((e) => e.toString()).toList();
      return const [];
    }

    final poses = (json['poses'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(YogaPose.fromJson)
            .toList() ??
        const [];

    return YogaSession(
      type: json['type'] as String? ?? 'vinyasa',
      level: json['level'] as String? ?? 'intermediate',
      duration: json['duration'] as int? ?? 30,
      focus: strList(json['focus']),
      poses: poses,
      totalMinutes: json['total_minutes'] as int? ?? json['duration'] as int? ?? 30,
      poseCount: json['pose_count'] as int? ?? poses.length,
    );
  }
}

class RecentYogaSession {
  final int id;
  final String type;
  final String level;
  final int duration;
  final List<String> focus;
  final DateTime createdAt;

  const RecentYogaSession({
    required this.id,
    required this.type,
    required this.level,
    required this.duration,
    required this.focus,
    required this.createdAt,
  });

  factory RecentYogaSession.fromJson(Map<String, dynamic> json) {
    List<String> strList(dynamic v) {
      if (v is List) return v.map((e) => e.toString()).toList();
      return const [];
    }

    return RecentYogaSession(
      id: json['id'] as int? ?? 0,
      type: json['type'] as String? ?? 'vinyasa',
      level: json['level'] as String? ?? 'intermediate',
      duration: json['duration'] as int? ?? 30,
      focus: strList(json['focus']),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? json['date'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

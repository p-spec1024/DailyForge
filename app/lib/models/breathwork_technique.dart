class BreathworkTechnique {
  final int id;
  final String name;
  final String? sanskritName;
  final String tradition;
  final String category;
  final List<String> purposes;
  final String difficulty;
  final String safetyLevel;
  final String? cautionNote;
  final Map<String, dynamic> protocol;
  final String description;
  final String? instructions;
  final List<String>? benefits;
  final List<String>? contraindications;
  final int? estimatedDuration;

  BreathworkTechnique({
    required this.id,
    required this.name,
    this.sanskritName,
    required this.tradition,
    required this.category,
    required this.purposes,
    required this.difficulty,
    required this.safetyLevel,
    this.cautionNote,
    required this.protocol,
    this.description = '',
    this.instructions,
    this.benefits,
    this.contraindications,
    this.estimatedDuration,
  });

  factory BreathworkTechnique.fromJson(Map<String, dynamic> json) {
    List<String> strList(dynamic v) {
      if (v is List) return v.map((e) => e.toString()).toList();
      return const [];
    }

    return BreathworkTechnique(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      sanskritName: json['sanskrit_name'] as String?,
      tradition: json['tradition'] as String? ?? '',
      category: json['category'] as String? ?? '',
      purposes: strList(json['purposes']),
      difficulty: json['difficulty'] as String? ?? 'beginner',
      safetyLevel: json['safety_level'] as String? ?? 'green',
      cautionNote: json['caution_note'] as String?,
      protocol: (json['protocol'] as Map?)?.cast<String, dynamic>() ?? const {},
      description: json['description'] as String? ?? '',
      instructions: json['instructions'] as String?,
      benefits: json['benefits'] is List ? strList(json['benefits']) : null,
      contraindications: json['contraindications'] is List
          ? strList(json['contraindications'])
          : null,
      estimatedDuration: json['estimated_duration'] as int?,
    );
  }

  BreathworkTechnique copyWith({
    int? id,
    String? name,
    String? sanskritName,
    String? tradition,
    String? category,
    List<String>? purposes,
    String? difficulty,
    String? safetyLevel,
    String? cautionNote,
    Map<String, dynamic>? protocol,
    String? description,
    String? instructions,
    List<String>? benefits,
    List<String>? contraindications,
    int? estimatedDuration,
  }) {
    return BreathworkTechnique(
      id: id ?? this.id,
      name: name ?? this.name,
      sanskritName: sanskritName ?? this.sanskritName,
      tradition: tradition ?? this.tradition,
      category: category ?? this.category,
      purposes: purposes ?? this.purposes,
      difficulty: difficulty ?? this.difficulty,
      safetyLevel: safetyLevel ?? this.safetyLevel,
      cautionNote: cautionNote ?? this.cautionNote,
      protocol: protocol ?? this.protocol,
      description: description ?? this.description,
      instructions: instructions ?? this.instructions,
      benefits: benefits ?? this.benefits,
      contraindications: contraindications ?? this.contraindications,
      estimatedDuration: estimatedDuration ?? this.estimatedDuration,
    );
  }
}

/// Parse a value that may arrive as num or String (PostgreSQL DECIMAL).
double? _toDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

/// Most recent non-null value for [accessor] across [measurements]
/// (which must be sorted ascending by date). Used to surface circumferences
/// whose latest entry omitted that field.
double? latestNonNull(
  List<BodyMeasurement> measurements,
  double? Function(BodyMeasurement) accessor,
) {
  for (final m in measurements.reversed) {
    final v = accessor(m);
    if (v != null) return v;
  }
  return null;
}

/// Compute the change in [accessor]'s value over the past week, using the
/// most recent measurement as the endpoint and the most recent measurement
/// at least 7 days before it as the reference. Returns null when no valid
/// reference exists. [measurements] must be sorted ascending by date.
double? weeklyDelta(
  List<BodyMeasurement> measurements,
  double? Function(BodyMeasurement) accessor,
) {
  BodyMeasurement? latest;
  for (final m in measurements.reversed) {
    if (accessor(m) != null) {
      latest = m;
      break;
    }
  }
  if (latest == null) return null;

  final cutoff = latest.measuredAt.subtract(const Duration(days: 7));
  for (final m in measurements.reversed) {
    if (m == latest) continue;
    if (!m.measuredAt.isAfter(cutoff) && accessor(m) != null) {
      return accessor(latest)! - accessor(m)!;
    }
  }
  return null;
}

class BodyMeasurement {
  final int id;
  final DateTime measuredAt;
  final double? weightKg;
  final double? bodyFatPercent;
  final double? waistCm;
  final double? hipsCm;
  final double? chestCm;
  final double? bicepLeftCm;
  final double? bicepRightCm;
  final String? notes;

  BodyMeasurement({
    required this.id,
    required this.measuredAt,
    this.weightKg,
    this.bodyFatPercent,
    this.waistCm,
    this.hipsCm,
    this.chestCm,
    this.bicepLeftCm,
    this.bicepRightCm,
    this.notes,
  });

  factory BodyMeasurement.fromJson(Map<String, dynamic> json) {
    return BodyMeasurement(
      id: json['id'] as int,
      measuredAt: DateTime.parse(json['measured_at'] as String),
      weightKg: _toDouble(json['weight_kg']),
      bodyFatPercent: _toDouble(json['body_fat_percent']),
      waistCm: _toDouble(json['waist_cm']),
      hipsCm: _toDouble(json['hips_cm']),
      chestCm: _toDouble(json['chest_cm']),
      bicepLeftCm: _toDouble(json['bicep_left_cm']),
      bicepRightCm: _toDouble(json['bicep_right_cm']),
      notes: json['notes'] as String?,
    );
  }
}

class CircumferenceDelta {
  final double? week;
  final double? total;

  CircumferenceDelta({this.week, this.total});

  factory CircumferenceDelta.fromJson(Map<String, dynamic>? json) {
    if (json == null) return CircumferenceDelta();
    return CircumferenceDelta(
      week: _toDouble(json['week']),
      total: _toDouble(json['total']),
    );
  }
}

class BodyMeasurementStats {
  final BodyMeasurement? latest;
  final double? bmi;
  final String? bmiCategory;
  final double? rollingAvg7d;
  final double? weightDeltaWeek;
  final double? weightDeltaTotal;
  final Map<String, CircumferenceDelta> circumferenceDeltas;

  BodyMeasurementStats({
    this.latest,
    this.bmi,
    this.bmiCategory,
    this.rollingAvg7d,
    this.weightDeltaWeek,
    this.weightDeltaTotal,
    this.circumferenceDeltas = const {},
  });

  factory BodyMeasurementStats.fromJson(Map<String, dynamic> json) {
    final latestJson = json['latest'] as Map<String, dynamic>?;
    final circumJson =
        json['circumference_deltas'] as Map<String, dynamic>? ?? {};

    return BodyMeasurementStats(
      latest:
          latestJson != null ? BodyMeasurement.fromJson(latestJson) : null,
      bmi: _toDouble(json['bmi']),
      bmiCategory: json['bmi_category'] as String?,
      rollingAvg7d: _toDouble(json['rolling_avg_7d']),
      weightDeltaWeek: _toDouble(json['weight_delta_week']),
      weightDeltaTotal: _toDouble(json['weight_delta_total']),
      circumferenceDeltas: {
        'waist': CircumferenceDelta.fromJson(
            circumJson['waist_cm'] as Map<String, dynamic>?),
        'hips': CircumferenceDelta.fromJson(
            circumJson['hips_cm'] as Map<String, dynamic>?),
        'chest': CircumferenceDelta.fromJson(
            circumJson['chest_cm'] as Map<String, dynamic>?),
        'bicep_left': CircumferenceDelta.fromJson(
            circumJson['bicep_left_cm'] as Map<String, dynamic>?),
        'bicep_right': CircumferenceDelta.fromJson(
            circumJson['bicep_right_cm'] as Map<String, dynamic>?),
      },
    );
  }
}

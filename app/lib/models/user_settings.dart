class UserSettings {
  final int restTimerDuration;
  final bool restTimerEnabled;
  final bool restTimerAutoStart;

  const UserSettings({
    this.restTimerDuration = 90,
    this.restTimerEnabled = true,
    this.restTimerAutoStart = true,
  });

  factory UserSettings.fromJson(Map<String, dynamic> json) {
    return UserSettings(
      restTimerDuration: (json['rest_timer_duration'] as num?)?.toInt() ?? 90,
      restTimerEnabled: json['rest_timer_enabled'] as bool? ?? true,
      restTimerAutoStart: json['rest_timer_auto_start'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'rest_timer_duration': restTimerDuration,
        'rest_timer_enabled': restTimerEnabled,
        'rest_timer_auto_start': restTimerAutoStart,
      };

  UserSettings copyWith({
    int? restTimerDuration,
    bool? restTimerEnabled,
    bool? restTimerAutoStart,
  }) {
    return UserSettings(
      restTimerDuration: restTimerDuration ?? this.restTimerDuration,
      restTimerEnabled: restTimerEnabled ?? this.restTimerEnabled,
      restTimerAutoStart: restTimerAutoStart ?? this.restTimerAutoStart,
    );
  }
}

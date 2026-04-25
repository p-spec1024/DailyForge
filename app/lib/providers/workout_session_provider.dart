import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import '../config/api_config.dart';
import '../services/api_service.dart';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

class SetData {
  final int setNumber;
  final double weight;
  final int reps;
  final bool completed;
  final String setType; // 'normal', 'warmup', 'dropset', 'failure'

  const SetData({
    required this.setNumber,
    this.weight = 0,
    this.reps = 0,
    this.completed = false,
    this.setType = 'normal',
  });

  SetData copyWith({
    int? setNumber,
    double? weight,
    int? reps,
    bool? completed,
    String? setType,
  }) {
    return SetData(
      setNumber: setNumber ?? this.setNumber,
      weight: weight ?? this.weight,
      reps: reps ?? this.reps,
      completed: completed ?? this.completed,
      setType: setType ?? this.setType,
    );
  }
}

class PreviousData {
  final double? weight;
  final int? reps;
  final String? display; // "60 x 10"

  const PreviousData({this.weight, this.reps, this.display});

  factory PreviousData.fromJson(Map<String, dynamic> json) {
    final w = json['weight'] != null
        ? (json['weight'] as num).toDouble()
        : null;
    final r = json['reps'] != null ? (json['reps'] as num).toInt() : null;
    return PreviousData(
      weight: w,
      reps: r,
      display: w != null && r != null
          ? '${w % 1 == 0 ? w.toInt() : w} x $r'
          : null,
    );
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

class WorkoutSessionProvider extends ChangeNotifier {
  final ApiService _api;

  WorkoutSessionProvider(this._api);

  // --- State ---
  int? _sessionId;
  int? _workoutId;
  bool _isActive = false;
  DateTime? _startedAt;
  bool _isLoading = false;
  String? _error;

  List<Map<String, dynamic>> _exercises = [];
  Map<int, List<SetData>> _exerciseSets = {};
  Map<int, PreviousData> _previousPerformance = {};

  // exerciseId -> {weight: bool, volume: bool, reps: bool}
  Map<int, Map<String, bool>> _exercisePrs = {};

  Timer? _timer;

  // --- Rest timer state ---
  bool _isRestTimerActive = false;
  int _restTimerDuration = 90;

  /// Separate notifier for the elapsed timer so the full widget tree
  /// doesn't rebuild every second.
  final ValueNotifier<int> elapsedNotifier = ValueNotifier<int>(0);

  // Track in-flight set requests to prevent double-taps
  final Set<String> _pendingSets = {};

  // --- Getters ---
  int? get sessionId => _sessionId;
  int? get workoutId => _workoutId;
  bool get isActive => _isActive;
  DateTime? get startedAt => _startedAt;
  int get elapsedSeconds => elapsedNotifier.value;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<Map<String, dynamic>> get exercises => List<Map<String, dynamic>>.unmodifiable(_exercises);

  Map<int, List<SetData>> get exerciseSets => Map<int, List<SetData>>.unmodifiable(
      _exerciseSets.map((k, v) => MapEntry(k, List<SetData>.unmodifiable(v))));

  Map<int, PreviousData> get previousPerformance =>
      Map<int, PreviousData>.unmodifiable(_previousPerformance);

  Map<String, bool>? getExercisePrs(int exerciseId) => _exercisePrs[exerciseId];

  int get totalSets => _exerciseSets.values.fold(
      0, (sum, sets) => sum + sets.where((s) => s.completed).length);

  double get totalVolume => _exerciseSets.values.fold(
      0.0,
      (sum, sets) =>
          sum +
          sets
              .where((s) => s.completed)
              .fold(0.0, (s, set) => s + (set.weight * set.reps)));

  // --- Rest timer getters ---
  bool get isRestTimerActive => _isRestTimerActive;
  int get restTimerDuration => _restTimerDuration;

  /// Start the rest timer overlay with the given duration.
  void startRestTimer(int duration) {
    _restTimerDuration = duration;
    _isRestTimerActive = true;
    notifyListeners();
  }

  /// Skip / dismiss the rest timer overlay.
  void skipRestTimer() {
    if (!_isRestTimerActive) return;
    _isRestTimerActive = false;
    notifyListeners();
  }

  /// Called when the rest timer finishes its natural countdown + dismiss delay.
  void onRestTimerComplete() {
    if (!_isRestTimerActive) return;
    _isRestTimerActive = false;
    notifyListeners();
  }

  /// Clear the error after it has been displayed (e.g. in a SnackBar).
  void clearError() {
    if (_error != null) {
      _error = null;
      notifyListeners();
    }
  }

  // --- Session lifecycle ---

  /// Start a session for a scheduled workout with exercises.
  Future<void> startSession(
      int workoutId, List<Map<String, dynamic>> exercises) async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post(ApiConfig.sessionStart, {
        'workout_id': workoutId,
        'type': 'strength',
      });

      final session = response['session'] as Map<String, dynamic>;
      _sessionId = _parseId(session['id']);
      _workoutId = workoutId;
      _startedAt = DateTime.parse(session['started_at'] as String);
      _isActive = true;
      _exercises = List.of(exercises); // defensive copy

      // Always initialize default sets first, then overlay any logged sets
      // from a resumed session so unlogged sets are preserved.
      _initializeDefaultSets(exercises);
      if (response['resumed'] == true && response['logged_sets'] != null) {
        _overlayLoggedSets(response['logged_sets'] as List<dynamic>);
      }

      // Fetch previous performance
      await _fetchPreviousPerformance(exercises);

      _startTimer();
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to start session';
      _isLoading = false;
      notifyListeners();
      debugPrint('Unexpected error starting session: $e');
    }
  }

  /// Start an empty session (no workout_id).
  Future<void> startEmptySession() async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post(ApiConfig.sessionStart, {
        'type': 'strength',
      });

      final session = response['session'] as Map<String, dynamic>;
      _sessionId = _parseId(session['id']);
      _workoutId = null;
      _startedAt = DateTime.parse(session['started_at'] as String);
      _isActive = true;
      _exercises = <Map<String, dynamic>>[];
      _exerciseSets = <int, List<SetData>>{};

      _startTimer();
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to start session';
      _isLoading = false;
      notifyListeners();
      debugPrint('Unexpected error starting empty session: $e');
    }
  }

  /// Log a completed set to the server.
  /// Returns the response map on success, null on failure (sets `error`).
  Future<Map<String, dynamic>?> logSet(
    int exerciseId,
    int setNumber,
    double weight,
    int reps, {
    String setType = 'normal',
  }) async {
    if (_sessionId == null) return null;

    final key = '$exerciseId-$setNumber';
    if (_pendingSets.contains(key)) return null;
    _pendingSets.add(key);

    try {
      final response = await _api.put(ApiConfig.sessionLogSet(_sessionId!), {
        'exercise_id': exerciseId,
        'set_number': setNumber,
        'weight': weight,
        'reps': reps,
        'set_type': setType,
      });

      // Update local state
      final sets = List<SetData>.of(_exerciseSets[exerciseId] ?? <SetData>[]);
      final idx = sets.indexWhere((s) => s.setNumber == setNumber);
      final newSet = SetData(
        setNumber: setNumber,
        weight: weight,
        reps: reps,
        completed: true,
        setType: setType,
      );

      if (idx >= 0) {
        sets[idx] = newSet;
      } else {
        sets.add(newSet);
        sets.sort((a, b) => a.setNumber.compareTo(b.setNumber));
      }
      _exerciseSets[exerciseId] = sets;

      // ignore: avoid_print
      print('[PR] log-set response for exercise=$exerciseId keys=${response.keys.toList()} prs=${response['prs']} (runtimeType=${response['prs']?.runtimeType})');
      final prs = response['prs'];
      if (prs is Map) {
        final weight = prs['weight'] == true;
        final volume = prs['volume'] == true;
        final reps = prs['reps'] == true;
        // ignore: avoid_print
        print('[PR] parsed weight=$weight volume=$volume reps=$reps');
        if (weight || volume || reps) {
          _exercisePrs[exerciseId] = {
            'weight': weight,
            'volume': volume,
            'reps': reps,
          };
          unawaited(HapticFeedback.mediumImpact());
          // ignore: avoid_print
          print('PR DETECTED: $prs for exercise $exerciseId');
        }
      } else {
        // ignore: avoid_print
        print('[PR] prs field missing or not a Map');
      }

      notifyListeners();
      return response;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return null;
    } finally {
      _pendingSets.remove(key);
    }
  }

  /// Add an exercise to the active session (mid-workout).
  /// Dedupes by id, initializes default sets, and fetches previous performance.
  Future<void> addExercise(Map<String, dynamic> exercise) async {
    final id = _parseId(exercise['id']);
    if (_exercises.any((e) => _parseId(e['id']) == id)) return;

    final defaultSets = (exercise['default_sets'] as num?)?.toInt() ?? 3;
    _exercises = List<Map<String, dynamic>>.from(_exercises)..add(exercise);
    _exerciseSets[id] = List<SetData>.generate(
      defaultSets,
      (i) => SetData(setNumber: i + 1),
    );
    notifyListeners();

    await _fetchPreviousPerformance([exercise]);
    notifyListeners();
  }

  /// Batched add for routine pre-load: mutates state once, fetches previous
  /// performance for all new exercises in a single request.
  Future<void> addExercises(List<Map<String, dynamic>> exercises) async {
    final added = <Map<String, dynamic>>[];
    final nextList = List<Map<String, dynamic>>.from(_exercises);
    for (final ex in exercises) {
      final id = _parseId(ex['id']);
      if (nextList.any((e) => _parseId(e['id']) == id)) continue;
      final defaultSets = (ex['default_sets'] as num?)?.toInt() ?? 3;
      nextList.add(ex);
      _exerciseSets[id] = List<SetData>.generate(
        defaultSets,
        (i) => SetData(setNumber: i + 1),
      );
      added.add(ex);
    }
    if (added.isEmpty) return;
    _exercises = nextList;
    notifyListeners();

    await _fetchPreviousPerformance(added);
    notifyListeners();
  }

  /// Check for an unfinished session on the server.
  /// Returns `{session, logged_sets}` or null on none / error.
  /// Filters out sessions already marked completed.
  Future<Map<String, dynamic>?> checkActiveSession() async {
    try {
      final response = await _api.get(ApiConfig.sessionActive);
      final session = response['session'];
      if (session is! Map) return null;
      if (session['completed'] == true) return null;
      return response;
    } on ApiException catch (e) {
      debugPrint('Failed to check active session: ${e.message}');
      return null;
    }
  }

  /// Resume an unfinished session by hydrating state from `/session/active`
  /// data. Fully resolves all fetches before flipping `_isActive`, so the UI
  /// never sees an "active but empty" intermediate state.
  Future<void> resumeActiveSession(Map<String, dynamic> sessionData) async {
    if (_isLoading || _isActive) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final session = sessionData['session'] as Map<String, dynamic>;
      if (session['completed'] == true) {
        _error = 'This session is already completed.';
        _isLoading = false;
        notifyListeners();
        return;
      }
      final loggedSets =
          (sessionData['logged_sets'] as List<dynamic>? ?? const []);

      // Unique exercise ids preserving insertion order.
      final seen = <int>{};
      final orderedIds = <int>[];
      for (final raw in loggedSets) {
        if (raw is! Map) continue;
        final exId = _parseId(raw['exercise_id']);
        if (seen.add(exId)) orderedIds.add(exId);
      }

      // Fetch all exercises in parallel.
      final results = await Future.wait(orderedIds.map((id) async {
        try {
          return await _api.get(ApiConfig.exercise(id));
        } on ApiException catch (e) {
          debugPrint('Failed to fetch exercise $id during resume: ${e.message}');
          return null;
        }
      }));
      final fetched = results
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);

      // Build full local state before flipping isActive.
      _sessionId = _parseId(session['id']);
      _workoutId = session['workout_id'] != null
          ? _parseId(session['workout_id'])
          : null;
      _startedAt = DateTime.parse(session['started_at'] as String);
      _exercises = List<Map<String, dynamic>>.from(fetched);
      _initializeDefaultSets(fetched);
      _overlayLoggedSets(loggedSets);
      await _fetchPreviousPerformance(fetched);

      _isActive = true;
      _startTimer();
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e, st) {
      _error = 'Failed to resume session: $e';
      _isLoading = false;
      notifyListeners();
      debugPrint('Unexpected error resuming session: $e\n$st');
    }
  }

  /// Discard a server-side active session. Returns true on success so the UI
  /// can reconcile state; surfaces the error on failure.
  Future<bool> discardActiveSession(int sessionId) async {
    try {
      await _api.delete(ApiConfig.sessionDelete(sessionId));
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  /// Add a new empty set row for an exercise (local only).
  void addSet(int exerciseId) {
    final sets = List<SetData>.of(_exerciseSets[exerciseId] ?? <SetData>[]);
    final nextNumber = sets.isEmpty ? 1 : sets.last.setNumber + 1;

    // Pre-fill from previous performance if available
    final prev = _previousPerformance[exerciseId];
    sets.add(SetData(
      setNumber: nextNumber,
      weight: prev?.weight ?? 0,
      reps: prev?.reps ?? 0,
    ));
    _exerciseSets[exerciseId] = sets;
    notifyListeners();
  }

  /// Fetch alternative exercises for a slot in the current workout.
  Future<Map<String, dynamic>?> fetchAlternatives(int exerciseId) async {
    if (_workoutId == null) return null;
    try {
      return await _api
          .get('/workout/$_workoutId/slots/$exerciseId/alternatives');
    } on ApiException catch (e) {
      debugPrint('Failed to fetch alternatives: ${e.message}');
      return null;
    }
  }

  /// Save a preferred exercise for a slot. Returns true on success.
  Future<bool> saveExercisePreference(
      int originalExerciseId, int chosenExerciseId) async {
    try {
      await _api.put('/workout/slot/$originalExerciseId/choose', {
        'chosen_exercise_id': chosenExerciseId,
      });
      return true;
    } on ApiException catch (e) {
      debugPrint('Failed to save preference: ${e.message}');
      return false;
    }
  }

  /// Swap an exercise locally with a new one. Initializes default sets and
  /// clears any PR state for the original exercise.
  Future<void> swapExercise(
      int originalExerciseId, Map<String, dynamic> newExercise) async {
    final idx = _exercises.indexWhere(
        (e) => _parseId(e['id']) == originalExerciseId);
    if (idx < 0) return;

    final newId = _parseId(newExercise['id']);
    // `...newExercise` wins on conflict; fall back to the slot's default_sets.
    final mergedExercise = <String, dynamic>{
      'default_sets': _exercises[idx]['default_sets'],
      ...newExercise,
    };
    _exercises[idx] = mergedExercise;

    final defaultSets = (mergedExercise['default_sets'] as num?)?.toInt() ?? 3;
    _exerciseSets.remove(originalExerciseId);
    _exerciseSets[newId] = List<SetData>.generate(
      defaultSets,
      (i) => SetData(setNumber: i + 1),
    );
    _exercisePrs.remove(originalExerciseId);
    _previousPerformance.remove(originalExerciseId);
    notifyListeners();

    await _fetchPreviousPerformance([mergedExercise]);
    notifyListeners();
  }

  /// Complete the active session.
  Future<Map<String, dynamic>?> completeSession() async {
    if (_sessionId == null || _isLoading) return null;
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.put(ApiConfig.sessionComplete(_sessionId!), {});
      _resetState();
      notifyListeners();
      return response;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Failed to complete session';
      _isLoading = false;
      notifyListeners();
      debugPrint('Unexpected error completing session: $e');
      return null;
    }
  }

  /// Discard the active session.
  Future<void> discardSession() async {
    if (_sessionId == null) return;

    try {
      await _api.delete(ApiConfig.sessionDelete(_sessionId!));
    } on ApiException catch (e) {
      debugPrint('Failed to discard session: ${e.message}');
    }
    _resetState();
    notifyListeners();
  }

  // --- Timer ---

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_startedAt != null) {
        elapsedNotifier.value =
            DateTime.now().difference(_startedAt!).inSeconds;
      }
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  String formatTime(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    final mm = m.toString().padLeft(2, '0');
    final ss = s.toString().padLeft(2, '0');
    return h > 0 ? '$h:$mm:$ss' : '$mm:$ss';
  }

  // --- Helpers ---

  /// Safely parse an id that may arrive as int or String from the server.
  int _parseId(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.parse(value);
    throw FormatException('Cannot parse id from: $value');
  }

  /// Safely parse a double that may arrive as num or String (PostgreSQL
  /// NUMERIC/DECIMAL columns come back as strings via the `pg` driver).
  double _parseDouble(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  /// Safely parse an int that may arrive as num or String.
  int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) {
      final n = num.tryParse(value);
      return n?.toInt() ?? 0;
    }
    return 0;
  }

  void _initializeDefaultSets(List<Map<String, dynamic>> exercises) {
    _exerciseSets = <int, List<SetData>>{};
    for (final ex in exercises) {
      final id = _parseId(ex['id']);
      final defaultSets = (ex['default_sets'] as num?)?.toInt() ?? 3;
      _exerciseSets[id] = List<SetData>.generate(
        defaultSets,
        (i) => SetData(setNumber: i + 1),
      );
    }
  }

  /// Overlay logged sets onto the already-initialized default sets.
  /// This preserves unlogged sets so the user sees the full workout.
  ///
  /// Note: PostgreSQL NUMERIC columns (`weight`, `reps_completed`) are
  /// returned as strings by the `pg` Node driver, so we always parse
  /// defensively.
  void _overlayLoggedSets(List<dynamic> loggedSets) {
    for (final raw in loggedSets) {
      if (raw is! Map) continue;
      final s = Map<String, dynamic>.from(raw);
      if (s['set_number'] == null) continue;
      final exId = _parseId(s['exercise_id']);
      final setNumber = _parseInt(s['set_number']);
      final loggedSet = SetData(
        setNumber: setNumber,
        weight: _parseDouble(s['weight']),
        // Server aliases `reps_completed` as `reps` on some endpoints and
        // returns it raw on others — accept either.
        reps: _parseInt(s['reps_completed'] ?? s['reps']),
        completed: s['completed'] as bool? ?? false,
        setType: s['set_type'] as String? ?? 'normal',
      );

      final sets = _exerciseSets.putIfAbsent(exId, () => <SetData>[]);
      final idx = sets.indexWhere((sd) => sd.setNumber == setNumber);
      if (idx >= 0) {
        sets[idx] = loggedSet;
      } else {
        sets.add(loggedSet);
        sets.sort((a, b) => a.setNumber.compareTo(b.setNumber));
      }
    }
  }

  Future<void> _fetchPreviousPerformance(
      List<Map<String, dynamic>> exercises) async {
    if (exercises.isEmpty) return;

    final ids = exercises.map((e) => e['id']).join(',');
    try {
      final response =
          await _api.get('${ApiConfig.sessionPreviousPerformance}?exerciseIds=$ids');
      final prev =
          response['previousPerformance'] as Map<String, dynamic>? ?? {};
      _previousPerformance = <int, PreviousData>{};
      for (final entry in prev.entries) {
        final id = int.tryParse(entry.key);
        if (id != null && entry.value is Map<String, dynamic>) {
          _previousPerformance[id] =
              PreviousData.fromJson(entry.value as Map<String, dynamic>);
        }
      }
    } on ApiException catch (e) {
      debugPrint('Failed to fetch previous performance: ${e.message}');
    }
  }

  void _resetState() {
    _stopTimer();
    elapsedNotifier.value = 0;
    _sessionId = null;
    _workoutId = null;
    _isActive = false;
    _startedAt = null;
    _isLoading = false;
    _error = null;
    _exercises = <Map<String, dynamic>>[];
    _exerciseSets = <int, List<SetData>>{};
    _previousPerformance = <int, PreviousData>{};
    _exercisePrs = <int, Map<String, bool>>{};
    _isRestTimerActive = false;
  }

  @override
  void dispose() {
    _timer?.cancel();
    elapsedNotifier.dispose();
    super.dispose();
  }
}

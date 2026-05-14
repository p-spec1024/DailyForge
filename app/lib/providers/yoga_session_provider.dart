import 'dart:async';
import 'package:flutter/foundation.dart';
import '../adapters/yoga_session_adapter.dart';
import '../models/suggested_session.dart';
import '../models/yoga_models.dart';
import '../models/yoga_pose_details.dart';
import '../services/api_service.dart';
import '../services/yoga_service.dart';

class YogaSessionProvider extends ChangeNotifier {
  final YogaService _yogaService;

  YogaSessionProvider(ApiService api) : _yogaService = YogaService(api);

  // Session data
  List<YogaPose> _poses = [];
  int _currentIndex = 0;

  // Timer state
  int _remainingSeconds = 0;
  int _totalHoldSeconds = 0;
  bool _isRunning = false;
  bool _isPaused = false;
  bool _isComplete = false;
  Timer? _timer;

  // Session tracking
  int _totalElapsedSeconds = 0;
  int _posesCompleted = 0;
  List<int> _skippedPoseIds = [];

  // Swap state
  bool _isLoadingAlternatives = false;
  List<YogaPose>? _alternatives;

  // Original session for logging
  YogaSession? _originalSession;
  bool _sessionLogged = false;

  // Getters
  YogaPose? get currentPose =>
      _poses.isNotEmpty && _currentIndex < _poses.length
          ? _poses[_currentIndex]
          : null;
  List<YogaPose> get poses => _poses;
  int get currentIndex => _currentIndex;
  int get totalPoses => _poses.length;
  int get remainingSeconds => _remainingSeconds;
  int get totalHoldSeconds => _totalHoldSeconds;
  double get progress =>
      _totalHoldSeconds > 0 ? 1 - (_remainingSeconds / _totalHoldSeconds) : 0;
  bool get isRunning => _isRunning;
  bool get isPaused => _isPaused;
  bool get isComplete => _isComplete;
  bool get isLastPose => _currentIndex >= _poses.length - 1;
  int get posesCompleted => _posesCompleted;
  List<int> get skippedPoseIds => _skippedPoseIds;
  int get elapsedSeconds => _totalElapsedSeconds;
  String get currentPhase => currentPose?.phase ?? '';
  YogaSession? get originalSession => _originalSession;

  bool get isLoadingAlternatives => _isLoadingAlternatives;
  List<YogaPose>? get alternatives => _alternatives;

  // Initialize session from YogaProvider's generated session
  void startSession(YogaSession session) {
    _originalSession = session;
    _poses = List<YogaPose>.from(session.poses);
    _currentIndex = 0;
    _totalElapsedSeconds = 0;
    _posesCompleted = 0;
    _skippedPoseIds = [];
    _isComplete = false;
    _sessionLogged = false;
    _loadCurrentPose();
    _startTimer();
    notifyListeners();
  }

  void _loadCurrentPose() {
    if (currentPose != null) {
      _totalHoldSeconds = currentPose!.holdSeconds;
      _remainingSeconds = _totalHoldSeconds;
    }
  }

  void _startTimer() {
    _isRunning = true;
    _isPaused = false;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    _totalElapsedSeconds++;
    if (_remainingSeconds > 0) {
      _remainingSeconds--;
      notifyListeners();
    } else {
      _completeCurrentPose();
    }
  }

  void _completeCurrentPose() {
    _posesCompleted++;
    if (!isLastPose) {
      _currentIndex++;
      _loadCurrentPose();
      notifyListeners();
    } else {
      _finishSession();
    }
  }

  void skipPose() {
    if (currentPose == null) return;
    _skippedPoseIds.add(currentPose!.id);
    if (!isLastPose) {
      _currentIndex++;
      _loadCurrentPose();
      notifyListeners();
    } else {
      _finishSession();
    }
  }

  void pause() {
    _isPaused = true;
    _timer?.cancel();
    notifyListeners();
  }

  void resume() {
    _isPaused = false;
    _startTimer();
    notifyListeners();
  }

  void _finishSession() {
    _timer?.cancel();
    _isRunning = false;
    _isComplete = true;
    notifyListeners();
  }

  // Swap functionality
  Future<void> loadAlternatives(ApiService api) async {
    if (currentPose == null) return;
    _isLoadingAlternatives = true;
    notifyListeners();

    try {
      final pose = currentPose!;
      final params = <String, String>{
        'exerciseId': pose.id.toString(),
        'category': pose.phase,
      };
      if (_originalSession != null) {
        params['practiceType'] = _originalSession!.type;
        params['maxDifficulty'] = _originalSession!.level;
      }
      final qs = Uri(queryParameters: params).query;
      final response = await api.get('/yoga/alternatives?$qs');
      final alts = response['alternatives'] as List?;
      _alternatives = alts
              ?.whereType<Map<String, dynamic>>()
              .map((e) => YogaPose.fromJson(e))
              .toList() ??
          [];
    } catch (e) {
      debugPrint('[YogaSessionProvider] loadAlternatives error: $e');
      _alternatives = [];
    }
    _isLoadingAlternatives = false;
    notifyListeners();
  }

  void swapPose(YogaPose newPose) {
    _poses[_currentIndex] = newPose;
    _loadCurrentPose();
    _alternatives = null;
    notifyListeners();
  }

  void clearAlternatives() {
    _alternatives = null;
    notifyListeners();
  }

  // Log session to API. Returns the server-side `sessions.id` on success so
  // callers (S14-T4 embedded mode) can FK it on `cross_pillar_sessions`.
  // null when not seeded, already logged, or on transport failure.
  Future<int?> logSession(ApiService api, {String? focusSlug}) async {
    if (_sessionLogged || _originalSession == null) return null;
    _sessionLogged = true;
    try {
      final body = <String, dynamic>{
        'type': _originalSession!.type,
        'level': _originalSession!.level,
        'duration': _originalSession!.duration,
        'focus': _originalSession!.focus,
        'poses': _poses.map((p) => p.id).toList(),
        'completed_poses': _posesCompleted,
        'skipped_poses': _skippedPoseIds,
        'total_duration_seconds': elapsedSeconds,
      };
      if (focusSlug != null && focusSlug.isNotEmpty) {
        body['focus_slug'] = focusSlug;
      }
      final response = await api.post('/yoga/session', body);
      final id = response['id'];
      if (id is int) return id;
      if (id is num) return id.toInt();
      return null;
    } catch (e) {
      debugPrint('[YogaSessionProvider] logSession error: $e');
      // Don't block UI on logging failure
      return null;
    }
  }

  void reset() {
    _timer?.cancel();
    _poses = [];
    _currentIndex = 0;
    _remainingSeconds = 0;
    _totalHoldSeconds = 0;
    _isRunning = false;
    _isPaused = false;
    _isComplete = false;
    _totalElapsedSeconds = 0;
    _alternatives = null;
    _originalSession = null;
    _sessionLogged = false;
    notifyListeners();
  }

  /// S14-T3: hydrate engine pose ids → run adapter → start session.
  ///
  /// Strict-mode (Q3 lock): any failure throws [StateError]; the launcher's
  /// snackbar wrapper translates user-facing copy. The player must not open
  /// with placeholder pose names — partial hydration is rejected server-side
  /// (`/api/yoga/poses-by-ids` returns 404 if any id is missing).
  Future<void> loadFromEngineSession(SuggestedSession session) async {
    final ids = <int>{};
    for (final phase in session.phases) {
      for (final item in phase.items) {
        final id = item.contentId;
        if (id != null) ids.add(id);
      }
    }
    if (ids.isEmpty) {
      throw StateError('yoga session has no poses');
    }

    final List<YogaPoseDetails> details;
    try {
      details = await _yogaService.fetchPosesByIds(ids.toList());
    } on ApiException catch (e) {
      throw StateError('failed to hydrate poses: ${e.message}');
    } catch (e) {
      throw StateError('hydration network error: $e');
    }
    if (details.length != ids.length) {
      throw StateError(
        'hydration incomplete: expected ${ids.length}, got ${details.length}',
      );
    }
    final byId = {for (final d in details) d.id: d};
    final yogaSession = yogaSessionFromEngine(
      session: session,
      hydratedById: byId,
    );
    startSession(yogaSession);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

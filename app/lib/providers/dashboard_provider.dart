import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import '../services/api_service.dart';

class DashboardProvider extends ChangeNotifier {
  final ApiService _api;

  Map<String, dynamic>? _dashboardData;
  Map<String, dynamic>? _todayWorkout;
  bool _isLoading = false;
  String? _error;

  Map<String, dynamic>? get dashboardData => _dashboardData;
  Map<String, dynamic>? get todayWorkout => _todayWorkout;
  bool get isLoading => _isLoading;
  String? get error => _error;

  DashboardProvider(this._api);

  // --- Computed getters ---

  String get greeting {
    final hour = DateTime.now().hour;
    final period =
        hour < 12 ? 'morning' : (hour < 17 ? 'afternoon' : 'evening');
    final name = _dashboardData?['user']?['firstName'] as String? ?? '';
    return name.isNotEmpty ? 'Good $period, $name' : 'Good $period';
  }

  int get currentStreak {
    return (_dashboardData?['user']?['streak'] as int?) ?? 0;
  }

  List<Map<String, dynamic>> get recentPRs {
    final prs = _dashboardData?['recentPRs'] as List<dynamic>?;
    if (prs == null) return [];
    return prs.whereType<Map<String, dynamic>>().toList();
  }

  /// 7 bools for Mon–Sun, true if any activity that day.
  List<bool> get weekDots {
    final thisWeek = _dashboardData?['thisWeek'] as Map<String, dynamic>?;
    if (thisWeek == null) return List.filled(7, false);
    final days = thisWeek['days'] as List<dynamic>?;
    if (days == null || days.length < 7) return List.filled(7, false);
    return days.map<bool>((d) => d == true).toList();
  }

  Map<String, dynamic>? get milestone {
    final m = _dashboardData?['milestone'] as Map<String, dynamic>?;
    if (m == null || m['reached'] != true) return null;
    return m;
  }

  // --- Data fetching ---

  Future<void> fetchDashboard() async {
    _dashboardData = await _api.get(ApiConfig.dashboard);
  }

  Future<void> fetchTodayWorkout() async {
    _todayWorkout = await _api.get(ApiConfig.workoutToday);
  }

  Future<void> refresh() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      if (kDebugMode) debugPrint('[Dashboard] refresh: fetching…');
      await Future.wait([fetchDashboard(), fetchTodayWorkout()]);
      _error = null;
      if (kDebugMode) debugPrint('[Dashboard] refresh: ok');
    } on ApiException catch (e) {
      _dashboardData = null;
      _todayWorkout = null;
      _error = e.message;
      if (kDebugMode) debugPrint('[Dashboard] refresh: ApiException → ${e.message}');
    } catch (e, st) {
      _dashboardData = null;
      _todayWorkout = null;
      _error = 'Unexpected error: $e';
      if (kDebugMode) debugPrint('[Dashboard] refresh: $e\n$st');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

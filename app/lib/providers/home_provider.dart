import 'package:flutter/foundation.dart';

import '../models/home.dart';
import '../services/api_service.dart';
import '../services/home_service.dart';

/// Backs the stats row + weekly chart + three-pillar durations on the
/// Sprint 10 home page.
///
/// Errors are tracked per-slice (stats vs weekly) so a single endpoint
/// failure doesn't blank both sections. The UI can also fall back to
/// [PillarDurations.fallback] when stats is null, ensuring the pillar
/// cards always render.
class HomeProvider extends ChangeNotifier {
  final HomeService _service;

  HomeStats? _stats;
  List<WeeklyActivity>? _weeks;
  bool _loading = false;
  String? _statsError;
  String? _weeksError;

  HomeProvider(ApiService api) : _service = HomeService(api);

  HomeStats? get stats => _stats;
  List<WeeklyActivity>? get weeks => _weeks;
  bool get loading => _loading;
  String? get statsError => _statsError;
  String? get weeksError => _weeksError;

  /// Convenience getter — pillar cards render even when stats hasn't loaded.
  PillarDurations get pillarDurations =>
      _stats?.pillarDurations ?? PillarDurations.fallback;

  bool get hasNoData => _stats == null && _weeks == null;

  Future<void> load() => _fetchAll();
  Future<void> refresh() => _fetchAll();

  Future<void> _fetchAll() async {
    _loading = true;
    notifyListeners();
    // Run both independently so one failure doesn't poison the other slice.
    await Future.wait([_fetchStats(), _fetchWeeks()]);
    _loading = false;
    notifyListeners();
  }

  Future<void> _fetchStats() async {
    try {
      _stats = await _service.fetchStats();
      _statsError = null;
    } on ApiException catch (e) {
      _statsError = e.message;
      debugPrint('[HomeProvider] stats error: $e');
    }
  }

  Future<void> _fetchWeeks() async {
    try {
      _weeks = await _service.fetchWeeklyActivity();
      _weeksError = null;
    } on ApiException catch (e) {
      _weeksError = e.message;
      debugPrint('[HomeProvider] weekly-activity error: $e');
    }
  }

  void clear() {
    _stats = null;
    _weeks = null;
    _statsError = null;
    _weeksError = null;
    notifyListeners();
  }
}

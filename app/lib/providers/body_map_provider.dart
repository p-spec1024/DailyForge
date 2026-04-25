import 'package:flutter/foundation.dart';

import '../models/body_map.dart';
import '../services/api_service.dart';
import '../services/body_map_service.dart';

/// Backs the 3D body-map home-page sections (S10-T5c-a).
///
/// State semantics:
///   - `null` data    → not yet loaded (or post-error with no prior success)
///   - populated data → backend response; volumes/flexibility ALWAYS carry
///     all keys (zero-history users get all-zeros, never an empty map)
///
/// On page mount the host calls [load]; pull-to-refresh calls [refresh].
/// [setRange] re-fetches volumes + flexibility (recent-wins is range-less).
class BodyMapProvider extends ChangeNotifier {
  final BodyMapService _service;

  Map<String, int>? _muscleVolumes;
  Map<String, MuscleDetail>? _muscleDetails;
  Map<String, int>? _flexibility;
  List<RecentWin>? _recentWins;
  bool _loading = false;
  String? _error;
  String _range = '30d';

  BodyMapProvider(ApiService api) : _service = BodyMapService(api);

  Map<String, int>? get muscleVolumes => _muscleVolumes;
  Map<String, MuscleDetail>? get muscleDetails => _muscleDetails;
  Map<String, int>? get flexibility => _flexibility;
  List<RecentWin>? get recentWins => _recentWins;
  bool get loading => _loading;
  String? get error => _error;
  String get range => _range;

  /// True when none of the three sections have data yet — hosts can use
  /// this to decide between "show skeleton" and "show stale-with-spinner."
  bool get hasNoData =>
      _muscleVolumes == null && _flexibility == null && _recentWins == null;

  /// Initial fetch — fan-out via Future.wait, single notify per phase.
  Future<void> load() => _fetchAll();

  /// Pull-to-refresh hook. Same fetch as [load] — kept as a distinct method
  /// so it's grep-able from RefreshIndicator wiring.
  Future<void> refresh() => _fetchAll();

  /// Switch the date window for muscle-volumes + flexibility. Recent-wins
  /// doesn't take a range param so we leave it untouched.
  Future<void> setRange(String range) async {
    if (range == _range) return;
    _range = range;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _service.fetchMuscleVolumes(range: _range),
        _service.fetchFlexibility(range: _range),
      ]);
      final mv = results[0] as MuscleVolumesResponse;
      _muscleVolumes = mv.volumes;
      _muscleDetails = mv.details;
      _flexibility = results[1] as Map<String, int>;
    } on ApiException catch (e) {
      _error = e.message;
      debugPrint('[BodyMapProvider] setRange($range) error: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> _fetchAll() async {
    _loading = true;
    // Intentionally NOT clearing _error here — keeping it set during the
    // in-flight fetch lets the error banner stay visible so the Retry
    // button can transition to a spinner. Clearing on success only.
    notifyListeners();
    try {
      final results = await Future.wait([
        _service.fetchMuscleVolumes(range: _range),
        _service.fetchFlexibility(range: _range),
        _service.fetchRecentWins(),
      ]);
      final mv = results[0] as MuscleVolumesResponse;
      _muscleVolumes = mv.volumes;
      _muscleDetails = mv.details;
      _flexibility = results[1] as Map<String, int>;
      _recentWins = results[2] as List<RecentWin>;
      _error = null; // success → clear so banner dismisses
    } on ApiException catch (e) {
      _error = e.message;
      debugPrint('[BodyMapProvider] load error: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Drop cached data — called from auth invalidation handler in main.dart.
  void clear() {
    _muscleVolumes = null;
    _muscleDetails = null;
    _flexibility = null;
    _recentWins = null;
    _error = null;
    _range = '30d';
    notifyListeners();
  }
}

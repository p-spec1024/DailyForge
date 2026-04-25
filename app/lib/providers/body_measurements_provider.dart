import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../models/body_measurement.dart';
import '../services/api_service.dart';

enum ViewMode { chart, list }

/// Aggregate stats for a single calendar month, used by the list view
/// header and the full-month page.
class MonthStats {
  final double? latest;
  final double? average;
  final double? lowest;
  final double? highest;
  final double? change;
  final int entryCount;

  const MonthStats({
    this.latest,
    this.average,
    this.lowest,
    this.highest,
    this.change,
    required this.entryCount,
  });
}

class BodyMeasurementsProvider with ChangeNotifier {
  static const _kViewModeKey = 'body_measurements_view_mode';

  final ApiService _api;

  List<BodyMeasurement> _measurements = [];
  BodyMeasurementStats? _stats;
  bool _isLoading = false;
  String? _error;

  ViewMode _viewMode = ViewMode.chart;
  DateTime _selectedMonth = _currentMonth();
  String _selectedMetric = 'weight';
  String _selectedRange = '3M';
  bool _disposed = false;

  BodyMeasurementsProvider(this._api) {
    _loadViewMode();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  // ---- Data getters ----
  List<BodyMeasurement> get measurements => _measurements;
  BodyMeasurementStats? get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // ---- UI state getters ----
  ViewMode get viewMode => _viewMode;
  DateTime get selectedMonth => _selectedMonth;
  String get selectedMetric => _selectedMetric;
  String get selectedRange => _selectedRange;

  /// The measurement logged for today (if any).
  BodyMeasurement? get todayEntry {
    final now = DateTime.now();
    for (final m in _measurements) {
      final d = m.measuredAt;
      if (d.year == now.year && d.month == now.month && d.day == now.day) {
        return m;
      }
    }
    return null;
  }

  bool get hasTodayEntry => todayEntry != null;

  /// Entries for [_selectedMonth] sorted newest-first.
  List<BodyMeasurement> get measurementsForSelectedMonth {
    final year = _selectedMonth.year;
    final month = _selectedMonth.month;
    final list = _measurements
        .where((m) =>
            m.measuredAt.year == year && m.measuredAt.month == month)
        .toList();
    list.sort((a, b) => b.measuredAt.compareTo(a.measuredAt));
    return list;
  }

  List<BodyMeasurement> get previewEntries =>
      measurementsForSelectedMonth.take(5).toList();

  bool get hasMoreEntries => measurementsForSelectedMonth.length > 5;

  /// Earliest month that has any entry. Falls back to current month.
  DateTime get earliestMonth {
    if (_measurements.isEmpty) return _currentMonth();
    final first = _measurements.first.measuredAt;
    return DateTime(first.year, first.month);
  }

  bool canGoPreviousMonth() {
    final prev = DateTime(_selectedMonth.year, _selectedMonth.month - 1);
    return !prev.isBefore(earliestMonth);
  }

  bool canGoNextMonth() {
    final next = DateTime(_selectedMonth.year, _selectedMonth.month + 1);
    return !next.isAfter(_currentMonth());
  }

  /// Summary stats for the currently selected month.
  MonthStats get monthStats {
    final entries = measurementsForSelectedMonth;
    final weights = entries
        .map((m) => m.weightKg)
        .whereType<double>()
        .toList();

    if (weights.isEmpty) {
      return MonthStats(entryCount: entries.length);
    }

    // measurementsForSelectedMonth is newest-first; "latest" is the first.
    final latest = weights.first;
    final oldest = weights.last;
    final avg = weights.reduce((a, b) => a + b) / weights.length;
    final low = weights.reduce((a, b) => a < b ? a : b);
    final high = weights.reduce((a, b) => a > b ? a : b);

    return MonthStats(
      latest: latest,
      average: avg,
      lowest: low,
      highest: high,
      change: latest - oldest,
      entryCount: entries.length,
    );
  }

  /// The most-recent entry strictly before [current]. Walks the full
  /// dataset so the result crosses month boundaries — use this when
  /// you want a delta for the oldest visible row in a paginated view.
  BodyMeasurement? getPreviousEntry(BodyMeasurement current) {
    // _measurements is ascending; iterate in reverse for O(1) on typical
    // "previous of latest" lookups.
    for (final m in _measurements.reversed) {
      if (m.measuredAt.isBefore(current.measuredAt) && m.id != current.id) {
        return m;
      }
    }
    return null;
  }

  /// Entry count for an arbitrary month (used by the picker preview).
  int entryCountForMonth(DateTime month) {
    return _measurements
        .where((m) =>
            m.measuredAt.year == month.year &&
            m.measuredAt.month == month.month)
        .length;
  }

  // ---- Fetching ----
  Future<void> fetchAll({bool force = false}) async {
    if (_isLoading) return;
    if (_stats != null && !force) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await refresh();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    try {
      await Future.wait([
        _fetchMeasurements(),
        _fetchStats(),
      ]);
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    notifyListeners();
  }

  Future<void> _fetchMeasurements() async {
    final response =
        await _api.getList('${ApiConfig.bodyMeasurements}?limit=500');
    final list = response
        .map((e) => BodyMeasurement.fromJson(e as Map<String, dynamic>))
        .toList();
    // Ascending by date for chart/derivation helpers.
    list.sort((a, b) => a.measuredAt.compareTo(b.measuredAt));
    _measurements = list;
  }

  Future<void> _fetchStats() async {
    final response = await _api.get(ApiConfig.bodyMeasurementsStats);
    _stats = BodyMeasurementStats.fromJson(response);
  }

  // ---- UI state setters ----
  Future<void> _loadViewMode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (_disposed) return;
      final raw = prefs.getString(_kViewModeKey);
      if (raw == 'list') {
        _viewMode = ViewMode.list;
        notifyListeners();
      }
    } catch (_) {
      // Non-fatal; default to chart.
    }
  }

  Future<void> setViewMode(ViewMode mode) async {
    if (_viewMode == mode) return;
    _viewMode = mode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          _kViewModeKey, mode == ViewMode.list ? 'list' : 'chart');
    } catch (_) {}
  }

  void setSelectedMonth(DateTime month) {
    final normalized = DateTime(month.year, month.month);
    if (_selectedMonth == normalized) return;
    _selectedMonth = normalized;
    notifyListeners();
  }

  void setSelectedMetric(String metric) {
    if (_selectedMetric == metric) return;
    _selectedMetric = metric;
    notifyListeners();
  }

  void setSelectedRange(String range) {
    if (_selectedRange == range) return;
    _selectedRange = range;
    notifyListeners();
  }

  void goToPreviousMonth() {
    if (!canGoPreviousMonth()) return;
    _selectedMonth =
        DateTime(_selectedMonth.year, _selectedMonth.month - 1);
    notifyListeners();
  }

  void goToNextMonth() {
    if (!canGoNextMonth()) return;
    _selectedMonth =
        DateTime(_selectedMonth.year, _selectedMonth.month + 1);
    notifyListeners();
  }

  // ---- Mutations ----
  Future<bool> addMeasurement(Map<String, dynamic> data) async {
    try {
      await _api.post(ApiConfig.bodyMeasurements, data);
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateMeasurement(int id, Map<String, dynamic> data) async {
    try {
      await _api.put(ApiConfig.bodyMeasurement(id), data);
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteMeasurement(int id) async {
    try {
      await _api.delete(ApiConfig.bodyMeasurement(id));
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  void clear() {
    _measurements = [];
    _stats = null;
    _error = null;
    _selectedMonth = _currentMonth();
    notifyListeners();
  }
}

DateTime _currentMonth() {
  final now = DateTime.now();
  return DateTime(now.year, now.month);
}

import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class CalendarProvider with ChangeNotifier {
  final ApiService _api;

  DateTime _currentMonth = DateTime.now();
  List<Map<String, dynamic>> _sessions = [];
  Map<String, dynamic> _streak = {'current': 0, 'best': 0};
  bool _isLoading = false;
  String? _error;

  CalendarProvider(this._api);

  DateTime get currentMonth => _currentMonth;
  List<Map<String, dynamic>> get sessions => _sessions;
  int get currentStreak => _streak['current'] ?? 0;
  int get bestStreak => _streak['best'] ?? 0;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Map<String, List<Map<String, dynamic>>> get sessionsByDate {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final session in _sessions) {
      final date = session['date'] as String;
      map.putIfAbsent(date, () => []).add(session);
    }
    return map;
  }

  Future<void> fetchMonth([DateTime? month]) async {
    if (month != null) {
      _currentMonth = DateTime(month.year, month.month, 1);
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    final monthStr =
        '${_currentMonth.year}-${_currentMonth.month.toString().padLeft(2, '0')}';

    try {
      final response = await _api.get('/session/calendar?month=$monthStr');
      _sessions =
          List<Map<String, dynamic>>.from(response['sessions'] ?? []);
      _streak = response['streak'] ?? {'current': 0, 'best': 0};
      _error = null;
    } catch (e) {
      _error = e.toString();
      _sessions = [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void previousMonth() {
    _currentMonth =
        DateTime(_currentMonth.year, _currentMonth.month - 1, 1);
    fetchMonth();
  }

  void nextMonth() {
    _currentMonth =
        DateTime(_currentMonth.year, _currentMonth.month + 1, 1);
    fetchMonth();
  }

  List<Map<String, dynamic>> getSessionsForDate(DateTime date) {
    final dateStr =
        '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    return sessionsByDate[dateStr] ?? [];
  }
}

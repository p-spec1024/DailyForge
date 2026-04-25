import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class ProgressProvider with ChangeNotifier {
  final ApiService _api;

  Map<String, List<Map<String, dynamic>>> _exercises = {};
  Map<String, dynamic>? _exerciseDetail;
  bool _isLoading = false;
  bool _isLoadingDetail = false;
  String? _exercisesError;
  String? _detailError;
  String _selectedRange = '30d';

  ProgressProvider(this._api);

  List<Map<String, dynamic>> get strengthExercises =>
      _exercises['strength'] ?? [];
  List<Map<String, dynamic>> get yogaExercises => _exercises['yoga'] ?? [];
  List<Map<String, dynamic>> get breathworkExercises =>
      _exercises['breathwork'] ?? [];
  Map<String, dynamic>? get exerciseDetail => _exerciseDetail;
  bool get isLoading => _isLoading;
  bool get isLoadingDetail => _isLoadingDetail;
  String? get exercisesError => _exercisesError;
  String? get detailError => _detailError;
  String get selectedRange => _selectedRange;

  Future<void> fetchExercises() async {
    _isLoading = true;
    _exercisesError = null;
    notifyListeners();

    try {
      final response = await _api.get('/progress/exercises');
      _exercises = {
        'strength':
            List<Map<String, dynamic>>.from(response['strength'] ?? []),
        'yoga': List<Map<String, dynamic>>.from(response['yoga'] ?? []),
        'breathwork':
            List<Map<String, dynamic>>.from(response['breathwork'] ?? []),
      };
    } catch (e) {
      _exercisesError = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchExerciseDetail(int exerciseId, String type,
      {String? range}) async {
    _isLoadingDetail = true;
    _detailError = null;
    if (range != null) _selectedRange = range;
    notifyListeners();

    try {
      final response = await _api
          .get('/progress/exercise/$exerciseId?range=$_selectedRange&type=$type');
      _exerciseDetail = response;
    } catch (e) {
      _detailError = e.toString();
    } finally {
      _isLoadingDetail = false;
      notifyListeners();
    }
  }

  void setRange(String range) {
    _selectedRange = range;
    notifyListeners();
  }

  void clearDetail() {
    _exerciseDetail = null;
    _detailError = null;
    _selectedRange = '30d';
  }

  void clear() {
    _exercises = {};
    _exerciseDetail = null;
    _exercisesError = null;
    _detailError = null;
    _selectedRange = '30d';
  }
}

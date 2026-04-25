import 'dart:async';
import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import '../services/api_service.dart';

class StrengthProvider extends ChangeNotifier {
  final ApiService _api;

  List<Map<String, dynamic>> _exercises = [];
  int _totalExercises = 0;
  bool _hasMore = false;
  bool _isLoading = false;
  String? _error;

  // Filters
  String _searchQuery = '';
  String? _selectedMuscle; // null = "All"
  List<String> _muscleGroups = [];

  // Routines
  List<Map<String, dynamic>> _routines = [];
  bool _isLoadingRoutines = false;

  // Pagination
  int _offset = 0;
  static const int _pageSize = 30;

  Timer? _debounce;

  StrengthProvider(this._api);

  // --- Getters ---

  List<Map<String, dynamic>> get exercises => _exercises;
  int get totalExercises => _totalExercises;
  bool get hasMore => _hasMore;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String get searchQuery => _searchQuery;
  String? get selectedMuscle => _selectedMuscle;
  List<String> get muscleGroups => _muscleGroups;
  List<Map<String, dynamic>> get routines => _routines;
  bool get isLoadingRoutines => _isLoadingRoutines;

  // --- Data fetching ---

  Future<void> fetchExercises({bool reset = false}) async {
    if (reset) {
      _offset = 0;
      _exercises = [];
      _hasMore = false;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final muscleParam = _selectedMuscle != null ? '&muscle=$_selectedMuscle' : '';
      final searchParam = _searchQuery.isNotEmpty ? '&search=$_searchQuery' : '';
      final path = '${ApiConfig.exercisesStrength}?limit=$_pageSize&offset=$_offset$muscleParam$searchParam';

      final response = await _api.get(path);

      final newExercises = (response['exercises'] as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .toList();
      _totalExercises = response['total'] as int? ?? 0;
      _hasMore = response['hasMore'] as bool? ?? false;

      if (reset) {
        _exercises = newExercises;
      } else {
        _exercises.addAll(newExercises);
      }

      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchMuscleGroups() async {
    try {
      final response = await _api.get(ApiConfig.exerciseMuscleGroups);
      _muscleGroups = List<String>.from(response['groups'] as List<dynamic>);
      notifyListeners();
    } on ApiException catch (e) {
      debugPrint('Error fetching muscle groups: ${e.message}');
    }
  }

  Future<void> fetchRoutines() async {
    _isLoadingRoutines = true;
    notifyListeners();

    try {
      final response = await _api.get(ApiConfig.routines);
      final list = response['routines'] as List<dynamic>? ?? response['data'] as List<dynamic>? ?? [];
      _routines = list.whereType<Map<String, dynamic>>().toList();
      _isLoadingRoutines = false;
      notifyListeners();
    } on ApiException catch (e) {
      debugPrint('Error fetching routines: ${e.message}');
      _isLoadingRoutines = false;
      notifyListeners();
    }
  }

  Future<void> deleteRoutine(int id) async {
    try {
      await _api.delete('${ApiConfig.routines}/$id');
      _routines.removeWhere((r) => r['id'] == id);
      notifyListeners();
    } on ApiException catch (e) {
      debugPrint('Error deleting routine: ${e.message}');
    }
  }

  Future<void> refresh() async {
    _error = null;
    await Future.wait([
      fetchMuscleGroups(),
      fetchRoutines(),
      fetchExercises(reset: true),
    ]);
  }

  void setSearch(String query) {
    if (_searchQuery == query) return;
    _searchQuery = query;
    notifyListeners();

    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      fetchExercises(reset: true);
    });
  }

  void setMuscleFilter(String? muscle) {
    if (_selectedMuscle == muscle) return;
    _selectedMuscle = muscle;
    _debounce?.cancel();
    fetchExercises(reset: true);
  }

  Future<void> loadMore() async {
    if (_isLoading || !_hasMore) return;
    _offset += _pageSize;
    await fetchExercises();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}

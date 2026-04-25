import 'package:flutter/foundation.dart';
import '../models/breathwork_technique.dart';
import '../services/api_service.dart';
import '../services/breathwork_service.dart';

class BreathworkProvider extends ChangeNotifier {
  final BreathworkService _service;

  List<BreathworkTechnique> _techniques = [];
  String _activeCategory = 'all';
  bool _isLoading = false;
  String? _error;

  BreathworkProvider(ApiService api) : _service = BreathworkService(api);

  List<BreathworkTechnique> get techniques => _techniques;
  String get activeCategory => _activeCategory;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<BreathworkTechnique> get filteredTechniques {
    if (_activeCategory == 'all') return _techniques;
    return _techniques.where((t) => t.category == _activeCategory).toList();
  }

  Future<void> loadTechniques() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _techniques = await _service.getTechniques();
    } on ApiException catch (e) {
      _error = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setCategory(String category) {
    if (_activeCategory == category) return;
    _activeCategory = category;
    notifyListeners();
  }
}

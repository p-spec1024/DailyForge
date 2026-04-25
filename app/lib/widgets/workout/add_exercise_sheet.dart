import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../config/api_config.dart';
import '../../config/theme.dart';
import '../../services/api_service.dart';

/// Full-screen bottom sheet that lets the user search and pick an exercise
/// to add to the current workout session.
class AddExerciseSheet extends StatefulWidget {
  /// Called with the picked exercise (raw JSON map). The sheet closes on tap
  /// only after this returns; caller is responsible for any side effect.
  final void Function(Map<String, dynamic> exercise) onAdd;

  /// Exercise ids already in the workout — tapping one of these shows a
  /// warning snackbar instead of adding.
  final Set<int> existingIds;

  const AddExerciseSheet({
    super.key,
    required this.onAdd,
    required this.existingIds,
  });

  static Future<void> show(
    BuildContext context, {
    required void Function(Map<String, dynamic> exercise) onAdd,
    required Set<int> existingIds,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => AddExerciseSheet(onAdd: onAdd, existingIds: existingIds),
    );
  }

  @override
  State<AddExerciseSheet> createState() => _AddExerciseSheetState();
}

class _AddExerciseSheetState extends State<AddExerciseSheet> {
  static const int _pageSize = 30;

  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  final ScrollController _scrollController = ScrollController();

  List<Map<String, dynamic>> _exercises = [];
  List<String> _muscleGroups = [];
  String? _selectedMuscle;
  String _searchQuery = '';
  int _offset = 0;
  bool _hasMore = false;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;
  Timer? _debounce;
  // Monotonic token — only the latest in-flight fetch is allowed to write
  // results back into state.
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _searchFocus.requestFocus();
    });
    _scrollController.addListener(_onScroll);
    _searchController.addListener(_onSearchControllerChanged);
    _fetchMuscleGroups();
    _fetch(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onSearchControllerChanged);
    _searchController.dispose();
    _searchFocus.dispose();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// Drives the clear (X) suffix icon visibility on every keystroke — the
  /// TextField builds it from `_searchController.text.isNotEmpty` and needs
  /// a rebuild when that flips.
  void _onSearchControllerChanged() {
    if (mounted) setState(() {});
  }

  void _onScroll() {
    if (!_hasMore || _isLoadingMore || _isLoading) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 120) {
      _fetch();
    }
  }

  Future<void> _fetchMuscleGroups() async {
    final api = context.read<ApiService>();
    try {
      final response = await api.get(ApiConfig.exerciseMuscleGroups);
      if (!mounted) return;
      setState(() {
        _muscleGroups = List<String>.from(
            response['groups'] as List<dynamic>? ?? const []);
      });
    } on ApiException {
      // Non-fatal; user can still search without filter chips.
    }
  }

  Future<void> _fetch({bool reset = false}) async {
    final myId = ++_requestId;
    if (reset) {
      _offset = 0;
    }
    setState(() {
      if (reset) {
        _isLoading = true;
        _error = null;
      } else {
        _isLoadingMore = true;
      }
    });

    final api = context.read<ApiService>();
    final muscleParam =
        _selectedMuscle != null ? '&muscle=$_selectedMuscle' : '';
    final searchParam =
        _searchQuery.isNotEmpty ? '&search=${Uri.encodeQueryComponent(_searchQuery)}' : '';
    final path =
        '${ApiConfig.exercisesStrength}?limit=$_pageSize&offset=$_offset$muscleParam$searchParam';

    try {
      final response = await api.get(path);
      if (!mounted || myId != _requestId) return; // stale — discard
      final newItems = (response['exercises'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      setState(() {
        if (reset) {
          _exercises = newItems;
        } else {
          _exercises.addAll(newItems);
        }
        _hasMore = response['hasMore'] as bool? ?? false;
        _offset += _pageSize;
        _isLoading = false;
        _isLoadingMore = false;
      });
    } on ApiException catch (e) {
      if (!mounted || myId != _requestId) return;
      setState(() {
        _error = e.message;
        _isLoading = false;
        _isLoadingMore = false;
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() => _searchQuery = value);
      _fetch(reset: true);
    });
  }

  void _onMuscleSelected(String? muscle) {
    if (_selectedMuscle == muscle) return;
    _debounce?.cancel();
    setState(() => _selectedMuscle = muscle);
    _fetch(reset: true);
  }

  void _handleTap(Map<String, dynamic> exercise) {
    final id = (exercise['id'] as num).toInt();
    if (widget.existingIds.contains(id)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              '${exercise['name'] ?? 'Exercise'} is already in this workout'),
          backgroundColor: AppColors.warning,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }
    final navigator = Navigator.of(context);
    widget.onAdd(exercise);
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, sheetScroll) {
        return Column(
          children: [
            _buildHeader(context),
            _buildSearch(),
            const SizedBox(height: 12),
            _buildMuscleChips(),
            const SizedBox(height: 8),
            Expanded(child: _buildList(sheetScroll)),
          ],
        );
      },
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
      child: Row(
        children: [
          Text('Add Exercise',
              style: Theme.of(context).textTheme.headlineSmall),
          const Spacer(),
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(LucideIcons.x, color: AppColors.secondaryText),
            tooltip: 'Close',
          ),
        ],
      ),
    );
  }

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: TextField(
        controller: _searchController,
        focusNode: _searchFocus,
        onChanged: _onSearchChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search exercises...',
          prefixIcon: const Icon(LucideIcons.search,
              size: 20, color: AppColors.hintText),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () {
                    _searchController.clear();
                    _debounce?.cancel();
                    setState(() => _searchQuery = '');
                    _fetch(reset: true);
                  },
                )
              : null,
        ),
      ),
    );
  }

  Widget _buildMuscleChips() {
    if (_muscleGroups.isEmpty) return const SizedBox.shrink();
    final groups = ['All', ..._muscleGroups];
    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: groups.length,
        itemBuilder: (context, i) {
          final group = groups[i];
          final isAll = group == 'All';
          final isSelected =
              isAll ? _selectedMuscle == null : _selectedMuscle == group;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                capitalize(group),
                style: TextStyle(
                  color: isSelected ? Colors.white : AppColors.secondaryText,
                  fontWeight:
                      isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
              selected: isSelected,
              onSelected: (_) => _onMuscleSelected(isAll ? null : group),
              backgroundColor: Colors.transparent,
              selectedColor: AppColors.strength,
              showCheckmark: false,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected
                      ? AppColors.strength
                      : AppColors.cardBorder,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildList(ScrollController sheetScroll) {
    if (_isLoading && _exercises.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.strength),
      );
    }
    if (_error != null && _exercises.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.wifiOff,
                  size: 40, color: AppColors.secondaryText),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => _fetch(reset: true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.strength,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    if (_exercises.isEmpty) {
      return Center(
        child: Text(
          'No exercises found',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: _exercises.length + (_hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= _exercises.length) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Center(
              child: _isLoadingMore
                  ? const CircularProgressIndicator(color: AppColors.strength)
                  : TextButton(
                      onPressed: _fetch,
                      child: Text(
                        'Load More',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: AppColors.strength,
                            ),
                      ),
                    ),
            ),
          );
        }
        final ex = _exercises[index];
        final id = (ex['id'] as num).toInt();
        final inWorkout = widget.existingIds.contains(id);
        return _ExerciseRow(
          exercise: ex,
          disabled: inWorkout,
          onTap: () => _handleTap(ex),
        );
      },
    );
  }
}

class _ExerciseRow extends StatelessWidget {
  final Map<String, dynamic> exercise;
  final bool disabled;
  final VoidCallback onTap;

  const _ExerciseRow({
    required this.exercise,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = exercise['name'] as String? ?? '';
    final muscle = (exercise['target_muscles']?.toString() ?? '')
        .split(',')
        .first
        .trim();
    final difficulty = exercise['difficulty'] as String? ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Opacity(
          opacity: disabled ? 0.5 : 1.0,
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.cardBackground,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (muscle.isNotEmpty)
                            _TagChip(
                              label: capitalize(muscle),
                              color: AppColors.strength,
                            ),
                          if (muscle.isNotEmpty && difficulty.isNotEmpty)
                            const SizedBox(width: 8),
                          if (difficulty.isNotEmpty)
                            _TagChip(
                              label: capitalize(difficulty),
                              color: AppColors.difficultyColor(difficulty),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: disabled
                        ? AppColors.cardBorder
                        : AppColors.strength.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    disabled ? LucideIcons.check : LucideIcons.plus,
                    size: 18,
                    color:
                        disabled ? AppColors.secondaryText : AppColors.strength,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  final String label;
  final Color color;

  const _TagChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

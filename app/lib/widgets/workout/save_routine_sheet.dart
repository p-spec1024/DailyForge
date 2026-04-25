import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../config/api_config.dart';
import '../../config/theme.dart';
import '../../services/api_service.dart';

/// Bottom sheet that captures a name + optional description and saves the
/// provided [exercises] as a routine via `POST /routines`.
class SaveRoutineSheet extends StatefulWidget {
  final List<Map<String, dynamic>> exercises;

  /// Called after a successful save with the created routine map.
  final void Function(Map<String, dynamic> routine)? onSaved;

  const SaveRoutineSheet({
    super.key,
    required this.exercises,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required List<Map<String, dynamic>> exercises,
    void Function(Map<String, dynamic> routine)? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
        ),
        child: SaveRoutineSheet(exercises: exercises, onSaved: onSaved),
      ),
    );
  }

  @override
  State<SaveRoutineSheet> createState() => _SaveRoutineSheetState();
}

class _SaveRoutineSheetState extends State<SaveRoutineSheet> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    if (widget.exercises.isEmpty) {
      setState(() => _error = 'No exercises to save');
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });

    final api = context.read<ApiService>();
    final payload = <String, dynamic>{
      'name': name,
      if (_descController.text.trim().isNotEmpty)
        'description': _descController.text.trim(),
      'exercises': widget.exercises.map((e) {
        final rawId = e['id'] ?? e['exercise_id'];
        final id = rawId is num ? rawId.toInt() : int.parse('$rawId');
        final targetSets = (e['sets_count'] as num?)?.toInt() ??
            (e['default_sets'] as num?)?.toInt() ??
            3;
        return {
          'exercise_id': id,
          'target_sets': targetSets,
        };
      }).toList(),
    };

    // Capture messenger + navigator before any await so they survive pop.
    // messenger belongs to the parent Scaffold and stays valid after the
    // sheet is popped, so post-pop showSnackBar is safe.
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    try {
      final routine = await api.post(ApiConfig.routines, payload);
      widget.onSaved?.call(routine);
      if (mounted) navigator.pop();
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Routine saved!'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 2),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _isSaving = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not save routine. Please try again.';
        _isSaving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(LucideIcons.clipboardList, color: AppColors.gold),
                const SizedBox(width: 8),
                Text('Save as Routine',
                    style: Theme.of(context).textTheme.headlineSmall),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameController,
              maxLength: 100,
              autofocus: true,
              enabled: !_isSaving,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Name',
                hintText: 'e.g. Upper Body A',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _descController,
              maxLength: 200,
              maxLines: 2,
              enabled: !_isSaving,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                hintText: 'What this routine is for',
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${widget.exercises.length} exercises',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 160),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: widget.exercises
                      .map((e) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              children: [
                                const Icon(LucideIcons.dumbbell,
                                    size: 14, color: AppColors.secondaryText),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    e['name'] as String? ?? 'Exercise',
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ),
                              ],
                            ),
                          ))
                      .toList(),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(color: AppColors.error, fontSize: 13),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: _isSaving
                        ? null
                        : () => Navigator.of(context).pop(),
                    child: const Text('Cancel',
                        style: TextStyle(color: AppColors.secondaryText)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.strength,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _isSaving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Save Routine',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

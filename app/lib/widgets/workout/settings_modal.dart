import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../models/user_settings.dart';
import '../../providers/settings_provider.dart';

class SettingsBottomSheet extends StatefulWidget {
  const SettingsBottomSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SettingsBottomSheet(),
    );
  }

  @override
  State<SettingsBottomSheet> createState() => _SettingsBottomSheetState();
}

class _SettingsBottomSheetState extends State<SettingsBottomSheet> {
  static const List<_DurationOption> _durations = [
    _DurationOption(30, '30s'),
    _DurationOption(60, '60s'),
    _DurationOption(90, '90s'),
    _DurationOption(120, '120s'),
    _DurationOption(180, '3m'),
    _DurationOption(300, '5m'),
  ];

  late int _duration;
  late bool _enabled;
  late bool _autoStart;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final current = context.read<SettingsProvider>().settings;
    _duration = current.restTimerDuration;
    _enabled = current.restTimerEnabled;
    _autoStart = current.restTimerAutoStart;
  }

  Future<void> _handleSave() async {
    setState(() => _saving = true);
    final provider = context.read<SettingsProvider>();
    final ok = await provider.updateSettings(UserSettings(
      restTimerDuration: _duration,
      restTimerEnabled: _enabled,
      restTimerAutoStart: _autoStart,
    ));
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) {
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Failed to save settings'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      provider.clearError();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.cardBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'Rest Timer Settings',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 20),
            Text(
              'Duration',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.secondaryText,
                  ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _durations.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final opt = _durations[i];
                  final selected = opt.seconds == _duration;
                  return ChoiceChip(
                    label: Text(opt.label),
                    selected: selected,
                    onSelected: (_) => setState(() => _duration = opt.seconds),
                    showCheckmark: false,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                    backgroundColor: AppColors.background,
                    selectedColor: AppColors.strength,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(
                        color: selected ? AppColors.strength : AppColors.cardBorder,
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
            Divider(color: AppColors.cardBorder, height: 1),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Rest Timer Enabled',
                style: TextStyle(color: Colors.white, fontSize: 15),
              ),
              value: _enabled,
              activeThumbColor: AppColors.strength,
              onChanged: (v) => setState(() => _enabled = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Auto-Start After Set',
                style: TextStyle(color: Colors.white, fontSize: 15),
              ),
              value: _autoStart,
              activeThumbColor: AppColors.strength,
              onChanged: _enabled ? (v) => setState(() => _autoStart = v) : null,
            ),
            const SizedBox(height: 8),
            Divider(color: AppColors.cardBorder, height: 1),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.secondaryText,
                      side: BorderSide(color: AppColors.cardBorder),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _saving ? null : _handleSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.strength,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Save',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
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

class _DurationOption {
  final int seconds;
  final String label;
  const _DurationOption(this.seconds, this.label);
}

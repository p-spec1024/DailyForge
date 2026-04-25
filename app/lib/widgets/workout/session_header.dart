import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';

class SessionHeader extends StatelessWidget {
  final ValueNotifier<int> elapsedNotifier;
  final double totalVolume;
  final int totalSets;
  final VoidCallback onFinish;
  final VoidCallback onDiscard;
  final VoidCallback onSettings;
  final String Function(int) formatTime;

  const SessionHeader({
    super.key,
    required this.elapsedNotifier,
    required this.totalVolume,
    required this.totalSets,
    required this.onFinish,
    required this.onDiscard,
    required this.onSettings,
    required this.formatTime,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surface.withValues(alpha: 0.85),
            border: Border(
              bottom: BorderSide(color: AppColors.cardBorder),
            ),
          ),
          child: Row(
            children: [
              // Timer — only this text rebuilds every second
              ValueListenableBuilder<int>(
                valueListenable: elapsedNotifier,
                builder: (context, elapsed, _) => Text(
                  formatTime(elapsed),
                  style: monoStyle.copyWith(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.strength,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Volume
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${_formatVolume(totalVolume)} kg',
                      style: monoStyle.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '$totalSets sets',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              // Settings
              IconButton(
                onPressed: onSettings,
                icon: const Icon(
                  LucideIcons.settings,
                  color: AppColors.secondaryText,
                  size: 20,
                ),
                tooltip: 'Rest timer settings',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(
                  minWidth: 36,
                  minHeight: 36,
                ),
              ),
              // More menu (discard)
              PopupMenuButton<String>(
                icon: const Icon(
                  LucideIcons.moreVertical,
                  color: AppColors.secondaryText,
                  size: 20,
                ),
                color: AppColors.surface,
                onSelected: (value) {
                  if (value == 'discard') onDiscard();
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'discard',
                    child: Row(
                      children: [
                        Icon(LucideIcons.trash2,
                            size: 16, color: AppColors.error),
                        SizedBox(width: 8),
                        Text(
                          'Discard Workout',
                          style: TextStyle(color: AppColors.error),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              // Finish button
              SizedBox(
                height: 36,
                child: ElevatedButton(
                  onPressed: onFinish,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.check, size: 16),
                      SizedBox(width: 4),
                      Text(
                        'Finish',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatVolume(double volume) {
    final intStr = volume.toStringAsFixed(0);
    return intStr.replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]},',
    );
  }
}

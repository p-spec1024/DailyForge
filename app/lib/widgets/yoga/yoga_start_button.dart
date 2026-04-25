import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/yoga_models.dart';

const _typeLabels = {
  'vinyasa': 'Vinyasa',
  'hatha': 'Hatha',
  'yin': 'Yin',
  'restorative': 'Restore',
  'sun_salutation': 'Sun',
};

class YogaStartButton extends StatelessWidget {
  final YogaConfig config;
  final bool isGenerating;
  final VoidCallback onStart;

  const YogaStartButton({
    super.key,
    required this.config,
    required this.isGenerating,
    required this.onStart,
  });

  @override
  Widget build(BuildContext context) {
    String focusLabel = '';
    if (config.focus.length == 1) {
      focusLabel = ' \u00B7 ${capitalize(config.focus[0])}';
    } else if (config.focus.length >= 2) {
      focusLabel = ' \u00B7 ${config.focus.length} areas';
    }

    final text = isGenerating
        ? 'Generating...'
        : 'Start ${config.duration}m ${_typeLabels[config.type] ?? config.type}$focusLabel';

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 26),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.transparent,
            AppColors.background.withValues(alpha: 0.95),
          ],
          stops: const [0.0, 0.5],
        ),
      ),
      child: Center(
        child: GestureDetector(
          onTap: isGenerating ? null : onStart,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
            decoration: BoxDecoration(
              color: isGenerating
                  ? const Color(0xFF5EEAD4).withValues(alpha: 0.5)
                  : const Color(0xFF5EEAD4),
              borderRadius: BorderRadius.circular(50),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF5EEAD4).withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: isGenerating
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.background,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        text,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.background,
                        ),
                      ),
                    ],
                  )
                : Text(
                    text,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.background,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

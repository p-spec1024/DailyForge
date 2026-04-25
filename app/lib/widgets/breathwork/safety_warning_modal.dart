import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/breathwork_technique.dart';

class SafetyWarningModal extends StatelessWidget {
  final BreathworkTechnique technique;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const SafetyWarningModal({
    super.key,
    required this.technique,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final isRed = technique.safetyLevel == 'red';
    final accent = isRed ? AppColors.safetyRed : AppColors.safetyYellow;
    final heading = isRed ? 'Advanced Technique' : 'Caution';
    final contraindications = technique.contraindications ?? const [];

    return Scaffold(
      backgroundColor: Colors.black.withValues(alpha: 0.6),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 360),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Icon(
                      isRed ? Icons.warning_rounded : Icons.warning_amber_rounded,
                      color: accent,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    heading,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: accent,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 16),
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        color: AppColors.primaryText,
                        fontSize: 14,
                        height: 1.5,
                      ),
                      children: [
                        TextSpan(
                          text: technique.name,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const TextSpan(text: ' requires extra awareness.'),
                      ],
                    ),
                  ),
                  if (technique.cautionNote != null &&
                      technique.cautionNote!.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      technique.cautionNote!,
                      style: const TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                  ],
                  if (contraindications.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    const Text(
                      'Not recommended if you have:',
                      style: TextStyle(
                        color: AppColors.hintText,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ...contraindications.map(
                      (c) => Padding(
                        padding: const EdgeInsets.only(left: 8, bottom: 2),
                        child: Text(
                          '• $c',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: onDecline,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.secondaryText,
                            side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.1),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: const Text('Go Back'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: onAccept,
                          style: FilledButton.styleFrom(
                            backgroundColor: accent.withValues(alpha: 0.18),
                            foregroundColor: accent,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: BorderSide(
                                color: accent.withValues(alpha: 0.4),
                              ),
                            ),
                          ),
                          child: const Text('I Understand'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

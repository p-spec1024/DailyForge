import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/yoga_models.dart';

const _typeLabels = {
  'vinyasa': 'Vinyasa',
  'hatha': 'Hatha',
  'yin': 'Yin',
  'restorative': 'Restorative',
  'sun_salutation': 'Sun Salutation',
};

const _phaseLabels = {
  'warmup': 'Warmup',
  'peak': 'Peak poses',
  'cooldown': 'Cool-down',
  'savasana': 'Savasana',
};

const _phaseEmojis = {
  'warmup': '\u{1F305}',
  'peak': '\u{1F525}',
  'cooldown': '\u{1F319}',
  'savasana': '\u{1F9D8}',
};

const _phaseOrder = ['warmup', 'peak', 'cooldown', 'savasana'];

class PosePreviewModal extends StatelessWidget {
  final YogaSession session;
  final YogaConfig config;
  final bool isGenerating;
  final VoidCallback onRegenerate;
  final VoidCallback onBegin;
  final VoidCallback onClose;

  const PosePreviewModal({
    super.key,
    required this.session,
    required this.config,
    required this.isGenerating,
    required this.onRegenerate,
    required this.onBegin,
    required this.onClose,
  });

  List<_PhaseGroup> get _grouped {
    final groups = <String, List<YogaPose>>{};
    for (final pose in session.poses) {
      final phase = pose.phase;
      (groups[phase] ??= []).add(pose);
    }
    return _phaseOrder
        .where((p) => groups[p]?.isNotEmpty == true)
        .map((p) => _PhaseGroup(p, groups[p]!))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final poseCount = session.poses.length;
    final duration = session.totalMinutes;
    final kcal = duration * 3;

    final focusLabel = config.focus.isNotEmpty
        ? ' \u00B7 ${config.focus.map((f) => capitalize(f)).join(', ')} focus'
        : '';
    final subtitle =
        '${duration}m ${_typeLabels[session.type] ?? session.type}$focusLabel';

    return Material(
      color: AppColors.background.withValues(alpha: 0.98),
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Your session',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: onClose,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.close,
                        size: 14,
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Stats row
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  _StatBox(value: '$poseCount', label: 'poses', teal: true),
                  const SizedBox(width: 8),
                  _StatBox(value: '$duration', label: 'minutes', teal: false),
                  const SizedBox(width: 8),
                  _StatBox(value: '$kcal', label: 'kcal', teal: false),
                ],
              ),
            ),

            // Pose list
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                children: _grouped.expand((group) {
                  return [
                    Padding(
                      padding: const EdgeInsets.only(top: 14, bottom: 6),
                      child: Text(
                        '${_phaseEmojis[group.phase] ?? ''} ${_phaseLabels[group.phase] ?? group.phase}',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.3),
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    ...group.poses.map((pose) => _PoseCard(pose: pose)),
                  ];
                }).toList(),
              ),
            ),

            // Bottom buttons
            Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    AppColors.background.withValues(alpha: 0.95),
                  ],
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: isGenerating ? null : onRegenerate,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(50),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.1),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Opacity(
                          opacity: isGenerating ? 0.5 : 1.0,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '\u21BB ',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.white.withValues(alpha: 0.8),
                                ),
                              ),
                              Text(
                                isGenerating ? 'Generating...' : 'Regenerate',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white.withValues(alpha: 0.8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: GestureDetector(
                      onTap: onBegin,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF5EEAD4), Color(0xFF2DD4BF)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(50),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF5EEAD4).withValues(alpha: 0.3),
                              blurRadius: 15,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'Begin session \u2192',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.background,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhaseGroup {
  final String phase;
  final List<YogaPose> poses;
  const _PhaseGroup(this.phase, this.poses);
}

class _StatBox extends StatelessWidget {
  final String value;
  final String label;
  final bool teal;

  const _StatBox({
    required this.value,
    required this.label,
    required this.teal,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: teal
              ? const Color(0xFF5EEAD4).withValues(alpha: 0.08)
              : Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: teal
                ? const Color(0xFF5EEAD4).withValues(alpha: 0.2)
                : Colors.white.withValues(alpha: 0.06),
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontFamily: 'RobotoMono',
                fontWeight: FontWeight.w600,
                color: teal ? const Color(0xFF5EEAD4) : Colors.white,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: Colors.white.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PoseCard extends StatelessWidget {
  final YogaPose pose;

  const _PoseCard({required this.pose});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pose.name,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.white,
                  ),
                ),
                if (pose.sanskritName != null && pose.sanskritName!.isNotEmpty)
                  Text(
                    pose.sanskritName!,
                    style: TextStyle(
                      fontSize: 10,
                      fontStyle: FontStyle.italic,
                      color: Colors.white.withValues(alpha: 0.35),
                    ),
                  ),
                if (pose.targetMuscles != null && pose.targetMuscles!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      pose.targetMuscles!,
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.white.withValues(alpha: 0.4),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${pose.holdSeconds}s',
                style: const TextStyle(
                  fontSize: 11,
                  fontFamily: 'RobotoMono',
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF5EEAD4),
                ),
              ),
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: AppColors.difficultyColor(pose.difficulty).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  capitalize(pose.difficulty),
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w500,
                    color: AppColors.difficultyColor(pose.difficulty),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

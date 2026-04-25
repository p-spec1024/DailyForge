import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';

class _PracticeType {
  final String id;
  final String label;
  final IconData icon;
  const _PracticeType(this.id, this.label, this.icon);
}

const _types = [
  _PracticeType('vinyasa', 'Vinyasa', LucideIcons.waves),
  _PracticeType('hatha', 'Hatha', LucideIcons.flower2),
  _PracticeType('yin', 'Yin', LucideIcons.moon),
  _PracticeType('restorative', 'Restore', LucideIcons.cloud),
  _PracticeType('sun_salutation', 'Sun', LucideIcons.sun),
];

class PracticeTypeSelector extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelect;

  const PracticeTypeSelector({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            'PRACTICE TYPE',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.35),
              letterSpacing: 0.6,
            ),
          ),
        ),
        SizedBox(
          height: 42,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _types.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (context, i) {
              final t = _types[i];
              final active = t.id == selected;
              return GestureDetector(
                onTap: () => onSelect(t.id),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: active
                        ? AppColors.yoga.withValues(alpha: 0.08)
                        : Colors.white.withValues(alpha: 0.02),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: active
                          ? AppColors.yoga.withValues(alpha: 0.4)
                          : Colors.white.withValues(alpha: 0.06),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        t.icon,
                        size: 14,
                        color: active ? Colors.white : Colors.white.withValues(alpha: 0.6),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        t.label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: active ? Colors.white : Colors.white.withValues(alpha: 0.6),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

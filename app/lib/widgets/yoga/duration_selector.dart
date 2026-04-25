import 'package:flutter/material.dart';
import '../../config/theme.dart';

const _durations = [10, 20, 30, 45, 60];

class DurationSelector extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onSelect;

  const DurationSelector({
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
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            'DURATION',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.35),
              letterSpacing: 0.6,
            ),
          ),
        ),
        Row(
          children: _durations.map((d) {
            final active = d == selected;
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  right: d == _durations.last ? 0 : 6,
                ),
                child: GestureDetector(
                  onTap: () => onSelect(d),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: active
                          ? AppColors.yoga.withValues(alpha: 0.08)
                          : Colors.white.withValues(alpha: 0.02),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: active
                            ? AppColors.yoga.withValues(alpha: 0.4)
                            : Colors.white.withValues(alpha: 0.06),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      active ? '${d}m' : '$d',
                      style: TextStyle(
                        fontSize: 13,
                        fontFamily: 'RobotoMono',
                        fontWeight: FontWeight.w600,
                        color: active ? Colors.white : Colors.white.withValues(alpha: 0.65),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

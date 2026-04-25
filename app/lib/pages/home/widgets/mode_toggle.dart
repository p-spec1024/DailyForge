import 'package:flutter/material.dart';

import '_tokens.dart';
import 'body_map_3d.dart' show BodyMapMode;

class ModeToggle extends StatelessWidget {
  final BodyMapMode mode;
  final ValueChanged<BodyMapMode> onChanged;

  const ModeToggle({super.key, required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      decoration: BoxDecoration(
        color: kCardBorder,
        borderRadius: BorderRadius.circular(18),
      ),
      padding: const EdgeInsets.all(2),
      child: Row(
        children: [
          Expanded(child: _segment('Muscles', BodyMapMode.muscles)),
          Expanded(child: _segment('Flexibility', BodyMapMode.flexibility)),
        ],
      ),
    );
  }

  Widget _segment(String label, BodyMapMode target) {
    final selected = mode == target;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        if (!selected) onChanged(target);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOut,
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          boxShadow: selected ? const [kCardShadow] : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? kCoral : kSecondaryText,
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../pages/home/widgets_v2/_tokens_v2.dart';

/// First-load empty state for the home page session slot. Renders the same
/// outer dimensions as the populated card (no layout shift on tap) with a
/// soft prompt and a gentle horizontally pulsing chevron, nudging the user
/// toward the focus pie below.
class EmptySessionCardSlot extends StatefulWidget {
  const EmptySessionCardSlot({super.key});

  @override
  State<EmptySessionCardSlot> createState() => _EmptySessionCardSlotState();
}

class _EmptySessionCardSlotState extends State<EmptySessionCardSlot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _translation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _translation = Tween<double>(begin: 0.0, end: 4.0)
        .chain(CurveTween(curve: Curves.easeInOut))
        .animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kHomeBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kHomeDivider, width: 0.5),
      ),
      padding: const EdgeInsets.all(14),
      // Match the populated session-card height: header row + 8 + 22pt title
      // + 4 + 13pt subtitle + 14 + 44pt button = roughly 130-140px. The
      // populated card's exact height varies with recency-warning presence;
      // using a fixed-height SizedBox would create layout jumps, so let the
      // child intrinsic height drive layout while padding holds the chrome.
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text(
            "Pick today's focus",
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w300,
              fontStyle: FontStyle.italic,
              color: kHomeTextSecondary,
            ),
          ),
          const SizedBox(width: 6),
          AnimatedBuilder(
            animation: _translation,
            builder: (context, _) => Transform.translate(
              offset: Offset(_translation.value, 0),
              child: const Text(
                '›',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w400,
                  color: kHomeTextSecondary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

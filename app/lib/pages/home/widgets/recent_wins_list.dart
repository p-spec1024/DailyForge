import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../models/body_map.dart';
import '_tokens.dart';

class RecentWinsList extends StatelessWidget {
  final List<RecentWin> wins;

  const RecentWinsList({super.key, required this.wins});

  static const _iconMap = <String, IconData>{
    'trophy': LucideIcons.trophy,
    'flame': LucideIcons.flame,
    'star': LucideIcons.star,
  };

  static const _colorMap = <String, Color>{
    'trophy': kTrophyGold,
    'flame': kCoral,
    'star': kStarBlue,
  };

  @override
  Widget build(BuildContext context) {
    if (wins.isEmpty) {
      return Container(
        decoration: kCardDecoration(),
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        alignment: Alignment.center,
        child: const Text(
          'No wins yet — log a session to get started.',
          style: TextStyle(fontSize: 14, color: kSecondaryText),
        ),
      );
    }
    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: Column(
        children: [
          for (int i = 0; i < wins.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: kCardBorder),
            _WinRow(win: wins[i]),
          ],
        ],
      ),
    );
  }
}

class _WinRow extends StatelessWidget {
  final RecentWin win;
  const _WinRow({required this.win});

  @override
  Widget build(BuildContext context) {
    final icon = RecentWinsList._iconMap[win.icon] ?? LucideIcons.award;
    final color = RecentWinsList._colorMap[win.icon] ?? kCoral;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  win.title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: kPrimaryText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  win.subtitle,
                  style: const TextStyle(fontSize: 14, color: kSecondaryText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

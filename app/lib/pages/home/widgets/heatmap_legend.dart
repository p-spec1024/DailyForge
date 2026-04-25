import 'package:flutter/material.dart';

import '_tokens.dart';
import 'body_map_3d.dart' show BodyMapMode;

class HeatmapLegend extends StatelessWidget {
  final BodyMapMode mode;
  const HeatmapLegend({super.key, required this.mode});

  static const _labels = ['Fresh', 'Light', 'Medium', 'Heavy', 'Max'];
  static const _stops = [
    kHeatmapFresh,
    kHeatmapLight,
    kHeatmapMedium,
    kHeatmapHeavy,
    kHeatmapMax,
  ];

  @override
  Widget build(BuildContext context) {
    final subtitle = mode == BodyMapMode.muscles
        ? 'Muscle color shows training volume over the last 7 days.'
        : 'Color intensity shows your mobility score by region.';

    return Container(
      decoration: kCardDecoration(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 10,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(5),
              gradient: const LinearGradient(colors: _stops),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _labels
                .map((l) => Text(
                      l,
                      style: const TextStyle(
                        fontSize: 11,
                        color: kSecondaryText,
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 12),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 13, color: kSecondaryText),
          ),
        ],
      ),
    );
  }
}

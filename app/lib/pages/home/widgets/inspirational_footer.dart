import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../providers/home_provider.dart';
import '_tokens.dart';

/// Quiet footer line at the bottom of the home scroll. Shows the user's
/// current-year session count, or a first-session nudge when empty.
class InspirationalFooter extends StatelessWidget {
  const InspirationalFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final sessionsThisYear = context.select<HomeProvider, int>(
      (p) => p.stats?.sessionsThisYear ?? 0,
    );
    final year = DateTime.now().year;
    final text = sessionsThisYear > 0
        ? '$sessionsThisYear sessions of practice in $year'
        : 'Your practice starts with one session';

    return Padding(
      padding: const EdgeInsets.only(top: 32, bottom: 24),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 15,
            fontStyle: FontStyle.italic,
            fontWeight: FontWeight.w300,
            color: kSecondaryText.withValues(alpha: 0.9),
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }
}

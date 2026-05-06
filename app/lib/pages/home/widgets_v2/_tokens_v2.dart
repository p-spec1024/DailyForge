import 'package:flutter/material.dart';

/// Color tokens for the S13-T4 home redesign. Locked in
/// `Trackers/S13-T4-DESIGN.md` §8. Kept local to this widget set so the
/// app-wide dark theme (`config/theme.dart`) is unaffected — the home page
/// applies a local light-theme override (same precedent as the Sprint-10
/// home page using `kCream`).
const Color kHomeBg = Color(0xFFFAF8F2);
const Color kHomeCard = Colors.white;
const Color kHomeBorder = Color(0xFFD3D1C7);
const Color kHomeDivider = Color(0xFFE6E4DC);

const Color kHomeTextPrimary = Color(0xFF2C2C2A);
const Color kHomeTextSecondary = Color(0xFF5F5E5A);
const Color kHomeTextTertiary = Color(0xFF888780);
const Color kHomeTextMuted = Color(0xFFB4B2A9);

// Body focus accent
const Color kBodyAccent = Color(0xFF534AB7);
const Color kBodyChipBg = Color(0xFFEEEDFE);
const Color kBodyChipText = Color(0xFF3C3489);

// State focus accent
const Color kStateAccent = Color(0xFF1D9E75);
const Color kStateChipBg = Color(0xFFE1F5EE);
const Color kStateChipText = Color(0xFF0F6E56);

// Streak chip
const Color kStreakChipBg = Color(0xFFFAEEDA);
const Color kStreakChipText = Color(0xFF854F0B);

// Recency warning text
const Color kRecencyText = Color(0xFF854F0B);

// Strava-style training-load chart
const Color kStravaRed = Color(0xFFFC4C02);

// Bar chart bars (re-uses state-green per design doc §8)
const Color kBarChart = Color(0xFF1D9E75);

/// Default state-focus bracket for v1 home-page tap. T5's bracket sheet
/// will let the user override; until then every state-focus chip tap fires
/// /suggest with this fixed value (per S13-T4 build decision May 2 2026).
const String kDefaultStateBracket = '21-30';

/// Emoji map for pie-segment picker (S13-T4 AMENDMENT-1, May 3 2026):
/// - Selected segment shows emoji + display-name label inside the segment.
/// - Unselected segments show this emoji only.
/// Same-emoji collisions on biceps/triceps and quads/hamstrings are
/// intentional placeholders — the locked icon set is FUTURE_SCOPE.
///
/// Body slugs match the live `focus_areas` table (12 rows including
/// `full_body`; AMENDMENT-1's prose listed a `hips` slot that doesn't
/// exist in DB — pre-flight ruling "DB wins" dropped it.)
const Map<String, String> kFocusEmoji = {
  // body
  'biceps': '💪',
  'triceps': '💪',
  'chest': '🫁',
  'shoulders': '🤲',
  'back': '↩',
  'core': '🧱',
  'glutes': '🍑',
  'hamstrings': '🦵',
  'quads': '🦵',
  'calves': '🦶',
  'mobility': '🫧',
  'full_body': '🏋️',
  // state
  'energize': '⚡',
  'calm': '🌊',
  'focus': '🎯',
  'sleep': '🌙',
  'recover': '🍃',
};

String emojiFor(String slug) => kFocusEmoji[slug] ?? '•';

BoxDecoration kHomeCardDecoration() => BoxDecoration(
      color: kHomeCard,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: kHomeBorder, width: 0.5),
    );

import 'package:flutter/material.dart';

class AppColors {
  // Background
  static const Color background = Color(0xFF0A1628);
  static const Color surface = Color(0xFF0F1D32);
  static Color cardBackground = surface.withValues(alpha: 0.80);
  static Color cardBorder = Colors.white.withValues(alpha: 0.08);

  // Text
  static const Color primaryText = Colors.white;
  static const Color secondaryText = Color(0xFF94A3B8);
  static const Color hintText = Color(0xFF64748B);

  // Accents
  static const Color gold = Color(0xFFF59E0B);
  static const Color strength = Color(0xFFF97316);
  static const Color yoga = Color(0xFF14B8A6);
  static const Color breathwork = Color(0xFF3B82F6);
  static const Color purple = Color(0xFFa78bfa);

  // Semantic accents (used across body measurements and elsewhere
  // where difficulty labels would be misleading).
  static const Color accent = Color(0xFFD85A30);
  static const Color positive = Color(0xFF1D9E75);

  // Difficulty
  static const Color beginner = Color(0xFF1D9E75);
  static const Color intermediate = Color(0xFFD85A30);
  static const Color advanced = Color(0xFFE53E3E);

  // Status
  static const Color success = Color(0xFF22C55E);
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFEAB308);

  // Safety levels (breathwork)
  static const Color safetyGreen = Color(0xFF10B981);
  static const Color safetyYellow = Color(0xFFF59E0B);
  static const Color safetyRed = Color(0xFFEF4444);

  static Color safetyColor(String level) {
    switch (level.toLowerCase()) {
      case 'green':
        return safetyGreen;
      case 'yellow':
        return safetyYellow;
      case 'red':
        return safetyRed;
      default:
        return secondaryText;
    }
  }

  static Color difficultyColor(String difficulty) {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return beginner;
      case 'intermediate':
        return intermediate;
      case 'advanced':
        return advanced;
      default:
        return secondaryText;
    }
  }

  static Color pillarColor(String pillar) {
    switch (pillar) {
      case 'strength':
        return strength;
      case 'yoga':
        return yoga;
      case 'breathwork':
        return breathwork;
      default:
        return Colors.white;
    }
  }
}

const TextStyle monoStyle = TextStyle(
  fontFamily: 'RobotoMono',
  color: Colors.white,
);

/// Safely capitalise the first letter of a string.
String capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.gold,
        secondary: AppColors.breathwork,
        surface: AppColors.surface,
        error: AppColors.error,
      ),
      cardTheme: CardThemeData(
        color: AppColors.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        elevation: 0,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
        iconTheme: IconThemeData(color: Colors.white),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: Colors.white,
        unselectedItemColor: AppColors.secondaryText,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
        headlineMedium: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
        headlineSmall: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.normal,
          color: Colors.white,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.normal,
          color: AppColors.secondaryText,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.normal,
          color: AppColors.hintText,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        hintStyle: const TextStyle(color: AppColors.secondaryText),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.gold),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
    );
  }
}

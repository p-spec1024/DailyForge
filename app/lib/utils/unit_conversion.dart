import 'package:flutter/material.dart';

// Weight
double kgToLbs(double kg) => kg * 2.20462;
double lbsToKg(double lbs) => lbs / 2.20462;

// Length
double cmToInches(double cm) => cm / 2.54;
double inchesToCm(double inches) => inches * 2.54;

// Height
double feetInchesToCm(int feet, int inches) {
  return (feet * 12 + inches) * 2.54;
}

// BMI
String getBMICategory(double bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

Color getBMICategoryColor(double bmi) {
  if (bmi < 18.5) return const Color(0xFF60a5fa);
  if (bmi < 25) return const Color(0xFF1D9E75);
  if (bmi < 30) return const Color(0xFFf59e0b);
  return const Color(0xFFef4444);
}

// Format helpers
String formatWeight(double kg, String unitSystem) {
  if (unitSystem == 'imperial') {
    return '${kgToLbs(kg).toStringAsFixed(1)} lb';
  }
  return '${kg.toStringAsFixed(1)} kg';
}

String formatLength(double cm, String unitSystem) {
  if (unitSystem == 'imperial') {
    return '${cmToInches(cm).toStringAsFixed(1)} in';
  }
  return '${cm.toStringAsFixed(1)} cm';
}

String weightUnit(String unitSystem) =>
    unitSystem == 'imperial' ? 'lb' : 'kg';

String lengthUnit(String unitSystem) =>
    unitSystem == 'imperial' ? 'in' : 'cm';

/// Convert a display weight value to kg for API storage.
double displayWeightToKg(double value, String unitSystem) =>
    unitSystem == 'imperial' ? lbsToKg(value) : value;

/// Convert a display length value to cm for API storage.
double displayLengthToCm(double value, String unitSystem) =>
    unitSystem == 'imperial' ? inchesToCm(value) : value;

/// Convert kg to the user's display unit.
double kgToDisplay(double kg, String unitSystem) =>
    unitSystem == 'imperial' ? kgToLbs(kg) : kg;

/// Convert cm to the user's display unit.
double cmToDisplay(double cm, String unitSystem) =>
    unitSystem == 'imperial' ? cmToInches(cm) : cm;

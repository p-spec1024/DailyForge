// Bundled mock data for the 3D body-map home page (S10-T5a baseline).
//
// Real data flows through `BodyMapProvider` (S10-T5c-a). This mock file
// stays alive for two reasons:
//   1. Offline UI work — flip `kUseMockBodyMap` in body_map_service.dart.
//   2. Sections not yet backed by an endpoint (mockMuscleDetails, mockStats,
//      mockLast4Weeks, mockInspirationalStat) — these become real in T5c-b.
//
// Types live in `lib/models/body_map.dart` so mock and real data emit
// identical Dart shapes — downstream widgets don't care which is which.

import '../models/body_map.dart';

const Map<String, int> mockMuscleVolumes = {
  'Chest': 72, 'Shoulders': 58, 'Biceps': 48, 'Triceps': 65,
  'Forearms': 32, 'Core': 55, 'Back': 78, 'Glutes': 12,
  'Quads': 85, 'Hamstrings': 38, 'Calves': 22,
};

const Map<String, MuscleDetail> mockMuscleDetails = {
  'Chest':      MuscleDetail(lastTrained: '2 days ago', volumeLabel: '14,280 kg', topExercise: 'Barbell Bench Press', setsThisWeek: 12),
  'Shoulders':  MuscleDetail(lastTrained: '3 days ago', volumeLabel: '8,450 kg',  topExercise: 'Overhead Press',      setsThisWeek: 9),
  'Biceps':     MuscleDetail(lastTrained: '4 days ago', volumeLabel: '5,120 kg',  topExercise: 'Barbell Curl',         setsThisWeek: 8),
  'Triceps':    MuscleDetail(lastTrained: '2 days ago', volumeLabel: '7,830 kg',  topExercise: 'Close-Grip Bench',     setsThisWeek: 10),
  'Forearms':   MuscleDetail(lastTrained: '5 days ago', volumeLabel: '1,200 kg',  topExercise: 'Wrist Curl',           setsThisWeek: 4),
  'Core':       MuscleDetail(lastTrained: '1 day ago',  volumeLabel: '—',         topExercise: 'Hanging Leg Raise',    setsThisWeek: 8),
  'Back':       MuscleDetail(lastTrained: 'Yesterday',  volumeLabel: '16,900 kg', topExercise: 'Deadlift',             setsThisWeek: 13),
  'Glutes':     MuscleDetail(lastTrained: '9 days ago', volumeLabel: '2,100 kg',  topExercise: 'Hip Thrust',           setsThisWeek: 2),
  'Quads':      MuscleDetail(lastTrained: 'Yesterday',  volumeLabel: '21,450 kg', topExercise: 'Barbell Squat',        setsThisWeek: 14),
  'Hamstrings': MuscleDetail(lastTrained: '4 days ago', volumeLabel: '4,800 kg',  topExercise: 'Romanian Deadlift',    setsThisWeek: 6),
  'Calves':     MuscleDetail(lastTrained: '6 days ago', volumeLabel: '3,200 kg',  topExercise: 'Standing Calf Raise',  setsThisWeek: 4),
};

const Map<String, int> mockFlexibilityScores = {
  'Spine': 68, 'Hips': 42, 'Shoulders': 75,
};

const Map<String, int> mockStats = {
  'streakDays': 47,
  'minutesThisWeek': 234,
  'sessionsThisYear': 89,
};

const List<Map<String, dynamic>> mockLast4Weeks = [
  {'week': 'W1', 'strength': 120, 'yoga': 60, 'breath': 30},
  {'week': 'W2', 'strength': 150, 'yoga': 45, 'breath': 40},
  {'week': 'W3', 'strength': 180, 'yoga': 90, 'breath': 20},
  {'week': 'W4', 'strength': 165, 'yoga': 75, 'breath': 50},
];

const List<RecentWin> mockRecentWins = [
  RecentWin(icon: 'trophy', title: 'New PR',           subtitle: 'Barbell Bench Press — 100 kg × 5'),
  RecentWin(icon: 'flame',  title: '45-day streak',    subtitle: 'Longest streak yet'),
  RecentWin(icon: 'star',   title: '10 yoga sessions', subtitle: 'This month'),
];

const String mockInspirationalStat = '47 days of practice in 2026';

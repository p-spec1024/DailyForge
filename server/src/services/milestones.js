// Shared milestone + streak helpers extracted from routes/dashboard.js so
// that body-map's recent-wins endpoint can reuse them (S10-T5b).

export const MILESTONES = [10, 25, 50, 100, 250, 500];

export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compute the user's current consecutive-day streak from a Set of active
 * date strings (YYYY-MM-DD). If today has no entry, counts back from
 * yesterday so we don't penalize users who haven't worked out yet today.
 */
export function calculateStreak(activeDateSet, today = new Date()) {
  let streak = 0;
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  if (!activeDateSet.has(fmtDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDateSet.has(fmtDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

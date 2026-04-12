import { C } from '../workout/tokens.jsx';

function hasAnyWin(recentPRs, weekActivity, milestone) {
  if (recentPRs && recentPRs.length > 0) return true;
  if (milestone?.reached) return true;
  if (weekActivity) {
    const { workouts, yoga, breathworkMinutes } = weekActivity;
    if ((workouts || 0) + (yoga || 0) + (breathworkMinutes || 0) > 0) return true;
  }
  return false;
}

function formatPR(pr) {
  const w = pr.weight;
  if (pr.reps != null) return `${pr.exercise} PR — ${w}kg × ${pr.reps}`;
  return `${pr.exercise} PR — ${w}kg`;
}

export default function RecentWins({ recentPRs, weekActivity, milestone }) {
  if (!hasAnyWin(recentPRs, weekActivity, milestone)) return null;

  const rows = [];

  if (recentPRs && recentPRs.length > 0) {
    for (const pr of recentPRs) {
      rows.push({ icon: '🏆', text: formatPR(pr), key: `pr-${pr.exercise}-${pr.date}` });
    }
  }

  if (weekActivity) {
    const { workouts = 0, yoga = 0, breathworkMinutes = 0 } = weekActivity;
    if (workouts + yoga + breathworkMinutes > 0) {
      rows.push({
        icon: '📊',
        text: `${workouts} workout${workouts === 1 ? '' : 's'} · ${yoga} yoga · ${breathworkMinutes}m breath`,
        key: 'activity',
      });
    }
  }

  if (milestone?.reached && milestone.count) {
    const n = milestone.count;
    const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    rows.push({ icon: '🎉', text: `${n}${suffix} session!`, key: 'milestone' });
  }

  return (
    <div
      style={{
        background: C.card,
        border: C.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '1.5px',
          color: C.textMuted,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Recent Wins
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div
            key={r.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: C.text,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{r.icon}</span>
            <span>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

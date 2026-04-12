import { C, GOLD } from '../workout/tokens.jsx';

const PHASES = [
  { color: '#3b82f6', label: 'Breathe',   short: 'Br' },
  { color: '#14b8a6', label: 'Warm-up',   short: 'Wm' },
  { color: GOLD,      label: 'Strength',  short: 'St' },
  { color: '#14b8a6', label: 'Cool-down', short: 'Cl' },
  { color: '#3b82f6', label: 'Close',     short: 'En' },
];

function lastSessionLabel(lastSession) {
  if (!lastSession) return 'No sessions yet';
  const d = lastSession.daysAgo;
  if (d === 0) return 'Last session: Today';
  if (d === 1) return 'Last session: Yesterday';
  return `Last session: ${d} days ago`;
}

export default function TodaySessionCard({ workoutName, durationMin, lastSession, onStart }) {
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
          marginBottom: 6,
        }}
      >
        Today's Session
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 2 }}>
        {workoutName || '5-Phase Full Body'}
      </div>
      <div style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>
        ~{durationMin || 45} min
      </div>

      {/* Phase dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {PHASES.map((p, i) => (
          <div
            key={i}
            aria-label={p.label}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: p.color,
              boxShadow: `0 0 8px ${p.color}55`,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          fontSize: 9,
          color: C.textMuted,
          marginBottom: 14,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {PHASES.map((p, i) => (
          <div key={i} style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>
            {p.short}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>
        {lastSessionLabel(lastSession)}
      </div>

      <button
        onClick={() => onStart?.()}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 10,
          background: 'rgba(29,158,117,0.15)',
          border: '1px solid rgba(29,158,117,0.25)',
          color: C.green,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        Start Full Session
      </button>
    </div>
  );
}

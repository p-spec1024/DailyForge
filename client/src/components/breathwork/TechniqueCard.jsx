import { C, MONO } from '../workout/tokens.jsx';

const SAFETY_DOTS = { green: '\u{1F7E2}', yellow: '\u{1F7E1}', red: '\u{1F534}' };

const DIFFICULTY_COLORS = {
  beginner: '#10B981',
  intermediate: '#F59E0B',
  advanced: '#EF4444',
};

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  if (m < 1) return `${seconds}s`;
  return `~${m} min`;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export default function TechniqueCard({ technique, onClick, suggestion }) {
  const {
    name, tradition, category, difficulty, safety_level, estimated_duration,
  } = technique;

  const showHint =
    suggestion &&
    (suggestion.reason === 'cycle_increase' || suggestion.reason === 'maintain');

  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        border: C.border,
        borderRadius: 12,
        borderLeft: `3px solid #a78bfa`,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'transform 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {name}
      </div>
      {showHint && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          Ready for {suggestion.suggestedCycles} cycles
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{
          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
        }}>
          {capitalize(tradition)}
        </span>
        <span style={{
          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          background: 'rgba(59,130,246,0.15)', color: '#60A5FA',
        }}>
          {capitalize(category)}
        </span>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: C.textSec,
      }}>
        <span>
          {SAFETY_DOTS[safety_level] || SAFETY_DOTS.green}{' '}
          <span style={{ color: DIFFICULTY_COLORS[difficulty] || C.textSec, fontWeight: 500 }}>
            {capitalize(difficulty)}
          </span>
        </span>
        <span style={{ fontFamily: MONO, color: C.textMuted }}>
          {formatDuration(estimated_duration)}
        </span>
      </div>
    </div>
  );
}

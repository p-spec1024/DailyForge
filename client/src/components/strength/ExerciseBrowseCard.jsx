import { C, parseMuscles } from '../workout/tokens.jsx';

export default function ExerciseBrowseCard({ exercise, onTap }) {
  const muscles = parseMuscles(exercise.target_muscles);
  const primary = muscles[0] || null;

  return (
    <button
      onClick={() => onTap(exercise)}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '12px 14px',
        borderRadius: 12,
        background: C.card,
        border: C.border,
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
      onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      onTouchEnd={e => e.currentTarget.style.background = C.card}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = C.card}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 500,
          color: C.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {exercise.name}
        </div>
        {primary && (
          <div style={{
            fontSize: 11,
            color: C.textMuted,
            marginTop: 3,
            textTransform: 'capitalize',
          }}>
            {primary}
            {muscles.length > 1 && (
              <span style={{ opacity: 0.6 }}> +{muscles.length - 1}</span>
            )}
          </div>
        )}
      </div>
      {exercise.difficulty && (
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: exercise.difficulty === 'beginner' ? '#1D9E75'
               : exercise.difficulty === 'intermediate' ? '#D85A30'
               : '#E53E3E',
          background: exercise.difficulty === 'beginner' ? 'rgba(29,158,117,0.15)'
                    : exercise.difficulty === 'intermediate' ? 'rgba(216,90,48,0.15)'
                    : 'rgba(229,62,62,0.15)',
          borderRadius: 6,
          padding: '3px 8px',
          flexShrink: 0,
        }}>
          {exercise.difficulty}
        </span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke={C.textMuted} strokeWidth="2" strokeLinecap="round"
        style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

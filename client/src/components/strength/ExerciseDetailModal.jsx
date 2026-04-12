import { C, parseMuscles } from '../workout/tokens.jsx';
import BottomSheet from '../BottomSheet.jsx';

export default function ExerciseDetailModal({ exercise, onClose, onDoThis }) {
  const muscles = parseMuscles(exercise.target_muscles);
  const sets = exercise.default_sets || 3;
  const reps = exercise.default_reps || 10;

  return (
    <BottomSheet onClose={onClose} title={exercise.name} maxHeight="75vh">
      {(close) => (
        <>
          {/* Muscle tags */}
          {muscles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {muscles.map(m => (
                <span key={m} style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 8, padding: '4px 10px',
                  textTransform: 'capitalize',
                }}>{m}</span>
              ))}
            </div>
          )}

          {/* Quick info */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 16,
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sets</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{sets}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reps</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{reps}</div>
            </div>
            {exercise.difficulty && (
              <>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Level</div>
                  <div style={{
                    fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
                    color: exercise.difficulty === 'beginner' ? '#1D9E75'
                         : exercise.difficulty === 'intermediate' ? '#D85A30'
                         : '#E53E3E',
                  }}>{exercise.difficulty}</div>
                </div>
              </>
            )}
          </div>

          {/* Description */}
          {exercise.description ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '1px', color: C.textMuted, marginBottom: 6,
              }}>Instructions</div>
              <div style={{
                fontSize: 13, color: C.textSec, lineHeight: 1.6,
                whiteSpace: 'pre-line',
              }}>{exercise.description}</div>
            </div>
          ) : (
            <div style={{
              fontSize: 13, color: C.textHint, fontStyle: 'italic',
              marginBottom: 20,
            }}>No instructions available</div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => close(() => onDoThis(exercise))}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: 'rgba(245,158,11,0.15)',
                color: '#f59e0b',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Do This Exercise
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

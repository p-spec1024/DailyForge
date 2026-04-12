import { useState, useEffect } from 'react';
import { C } from './workout/tokens.jsx';
import { api } from '../utils/api.js';
import BottomSheet from './BottomSheet.jsx';

const DIFFICULTY_COLORS = {
  beginner: '#1D9E75',
  intermediate: '#D85A30',
  advanced: '#E53E3E',
};

export default function AlternativePicker({ exerciseId, workoutId, onSelect, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/workout/${workoutId}/slots/${exerciseId}/alternatives`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [exerciseId, workoutId]);

  return (
    <BottomSheet onClose={onClose} title="Swap Exercise">
      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          Loading alternatives...
        </div>
      ) : !data || data.alternatives?.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          No alternatives available for this exercise.
        </div>
      ) : (
        <>
          {/* Current exercise label */}
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', padding: '8px 0 4px',
          }}>CURRENT</div>
          <div style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 12,
            background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.15)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{data.default_exercise.name}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {data.default_exercise.muscle_groups.map(m => (
                <span key={m} style={{
                  fontSize: 9, color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 6px',
                }}>{m}</span>
              ))}
            </div>
          </div>

          {/* Alternatives label */}
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', padding: '4px 0',
          }}>ALTERNATIVES</div>

          {/* Alternative list */}
          {data.alternatives.map(alt => (
            <button
              key={alt.id}
              onClick={() => onSelect(alt)}
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '12px', borderRadius: 10, marginBottom: 6,
                background: 'rgba(255,255,255,0.04)',
                border: data.user_preference?.id === alt.id
                  ? '1px solid rgba(29,158,117,0.3)'
                  : '1px solid rgba(255,255,255,0.06)',
                transition: 'background 0.15s',
              }}
              onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onTouchEnd={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{alt.name}</div>
                <span style={{
                  fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: DIFFICULTY_COLORS[alt.difficulty] || C.textMuted,
                  background: `${DIFFICULTY_COLORS[alt.difficulty] || 'rgba(255,255,255,0.1)'}20`,
                  borderRadius: 6, padding: '3px 8px',
                }}>{alt.difficulty}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {alt.muscle_groups.map(m => (
                  <span key={m} style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.4)',
                    background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 6px',
                  }}>{m}</span>
                ))}
              </div>
              {data.user_preference?.id === alt.id && (
                <div style={{ fontSize: 10, color: C.green, marginTop: 4 }}>
                  Currently saved preference
                </div>
              )}
            </button>
          ))}
        </>
      )}
    </BottomSheet>
  );
}

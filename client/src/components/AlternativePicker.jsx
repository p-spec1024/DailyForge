import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C } from './workout/tokens.jsx';
import { api } from '../utils/api.js';

const DIFFICULTY_COLORS = {
  beginner: '#1D9E75',
  intermediate: '#D85A30',
  advanced: '#E53E3E',
};

export default function AlternativePicker({ exerciseId, workoutId, onSelect, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    api.get(`/workout/${workoutId}/slots/${exerciseId}/alternatives`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    // Trigger slide-up animation
    requestAnimationFrame(() => setVisible(true));
  }, [exerciseId, workoutId]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        transition: 'opacity 0.2s',
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: '60vh',
          background: 'rgba(20,28,50,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px 16px 0 0',
          padding: '0 0 env(safe-area-inset-bottom, 16px)',
          overflowY: 'auto',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky', top: 0,
          background: 'rgba(20,28,50,0.98)', zIndex: 1,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Swap Exercise</div>
          <button onClick={handleClose} style={{
            width: 28, height: 28, borderRadius: 14, border: 'none',
            background: 'rgba(255,255,255,0.08)', color: C.textSec,
            fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '8px 16px 16px' }}>
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
        </div>
      </div>
    </div>,
    document.body
  );
}

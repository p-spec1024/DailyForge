import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C, parseMuscles } from '../workout/tokens.jsx';

export default function ExerciseDetailModal({ exercise, onClose, onDoThis }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  function handleDoThis() {
    setVisible(false);
    setTimeout(() => onDoThis(exercise), 200);
  }

  const muscles = parseMuscles(exercise.target_muscles);
  const sets = exercise.default_sets || 3;
  const reps = exercise.default_reps || 10;

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
          maxHeight: '75vh',
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
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky', top: 0,
          background: 'rgba(20,28,50,0.98)', zIndex: 1,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, flex: 1, marginRight: 12 }}>
            {exercise.name}
          </div>
          <button onClick={handleClose} style={{
            width: 28, height: 28, borderRadius: 14, border: 'none',
            background: 'rgba(255,255,255,0.08)', color: C.textSec,
            fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>
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
              onClick={handleDoThis}
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
        </div>
      </div>
    </div>,
    document.body
  );
}

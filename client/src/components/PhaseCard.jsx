import { useState } from 'react';
import { C } from './workout/tokens.jsx';
import ExerciseRow from './ExerciseCard.jsx';

/* ── Phase Checkbox (non-strength phases in active mode) ── */
export function PhaseCheckbox({ phase, checked, onToggle }) {
  return (
    <div style={{
      background: C.card, border: C.border, borderRadius: 10,
      borderTop: `2px solid ${phase.color}`,
      marginBottom: 6, overflow: 'hidden',
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: 14, display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          border: checked ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
          background: checked ? 'rgba(29,158,117,0.2)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {checked && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={C.green} strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 500,
            color: checked ? C.green : C.text,
            textDecoration: checked ? 'line-through' : 'none',
          }}>
            Complete {phase.label.toLowerCase()}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {phase.duration_min} min &middot; {phase.exercises.length} exercise{phase.exercises.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Phase Section (view mode) ── */
export function PhaseSection({ phase, expandedId, onToggleExpand, onSwap, onReset }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      background: C.card, border: C.border, borderRadius: 10,
      borderTop: `2px solid ${phase.color}`,
      marginBottom: 6, overflow: 'hidden',
    }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: 12, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '1.5px', color: phase.color,
        }}>
          {phase.label} &middot; {phase.duration_min} min
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.textMuted} strokeWidth="1.5"
          style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
          <polyline points="2,3 5,7 8,3" />
        </svg>
      </div>
      {open && (
        <div style={{ padding: '0 12px 8px' }}>
          {phase.exercises.map((ex, i) => (
            <ExerciseRow
              key={ex.id || `${ex.name}-${i}`}
              exercise={ex}
              isExpanded={expandedId === (ex.id || `${ex.name}-${i}`)}
              onToggle={() => onToggleExpand(ex.id || `${ex.name}-${i}`)}
              onSwap={onSwap}
              onReset={onReset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Phase Bar ── */
export function PhaseBar({ phases }) {
  const totalDuration = phases.reduce((s, p) => s + p.duration_min, 0);
  if (totalDuration === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 2 }}>
        {phases.map((p, i) => (
          <div key={i} style={{
            flex: p.duration_min / totalDuration, background: p.color, borderRadius: 2,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {phases.map((p, i) => (
          <div key={i} style={{
            flex: p.duration_min / totalDuration,
            fontSize: 9, color: p.color, textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {p.label.toLowerCase().replace('opening ', '').replace('closing ', '')}
          </div>
        ))}
      </div>
    </div>
  );
}

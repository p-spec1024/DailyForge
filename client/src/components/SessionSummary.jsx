import { C, MONO, formatVolume } from './workout/tokens.jsx';

/* ── Workout Summary Card ── */
export default function SessionSummary({ data, onDone }) {
  if (!data) return null;
  const { session, summary } = data;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'rgba(20,28,50,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 28, textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '2px',
          color: C.green, textTransform: 'uppercase', marginBottom: 8,
        }}>WORKOUT COMPLETE</div>

        <div style={{ fontSize: 32, marginBottom: 20 }}>&#127881;</div>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
        }}>
          {[
            { label: 'Duration', value: summary.duration_formatted },
            { label: 'Volume', value: `${formatVolume(summary.total_volume)} kg` },
            { label: 'Sets', value: String(summary.total_sets) },
            { label: 'Exercises', value: String(summary.exercises_completed) },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 8px',
            }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 20, fontFamily: MONO, fontWeight: 600, color: C.text }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Exercise list */}
        {summary.exercises && summary.exercises.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12,
            }} />
            <div style={{
              fontSize: 10, fontWeight: 600, color: C.textMuted,
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8, textAlign: 'left',
            }}>Exercises completed</div>
            {summary.exercises.map(ex => (
              <div key={ex.exercise_id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 0', fontSize: 13,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={C.green} strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: C.text, flex: 1, textAlign: 'left' }}>{ex.name}</span>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: MONO }}>
                  {ex.sets} set{ex.sets !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onDone} style={{
          width: '100%', padding: '14px', borderRadius: 10, border: 'none',
          background: 'rgba(29,158,117,0.2)', color: C.green,
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ── */
export function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: 'rgba(20,28,50,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: C.textSec, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: 'none',
            background: confirmColor || 'rgba(29,158,117,0.2)',
            color: confirmColor ? '#fff' : C.green,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

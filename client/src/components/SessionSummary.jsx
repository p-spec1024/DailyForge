import { C, MONO, formatVolume } from './workout/tokens.jsx';

const GOLD = '#f59e0b';

function PrBadge({ type }) {
  const label = type === 'weight' ? 'WEIGHT' : 'REPS';
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
      padding: '2px 6px', borderRadius: 4,
      background: 'rgba(245,158,11,0.15)', color: GOLD,
      textTransform: 'uppercase',
    }}>{label} PR</span>
  );
}

/* ── Workout Summary Card ── */
export default function SessionSummary({ data, onDone }) {
  if (!data) return null;
  const { summary, prs = [] } = data;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#0a1628',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        display: 'flex', flexDirection: 'column',
        height: '100%',
      }}>
        {/* Fixed header */}
        <div style={{
          flexShrink: 0, padding: '48px 20px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '2px',
            color: C.green, textTransform: 'uppercase', marginBottom: 8,
          }}>WORKOUT COMPLETE</div>
          <div style={{ fontSize: 32, marginBottom: 24 }}>&#127881;</div>
        </div>

        {/* Scrollable middle section */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 20px',
          minHeight: 0,
        }}>

        {/* Stats grid */}
        <div style={{
          width: '100%',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24,
        }}>
          {[
            { label: 'Duration', value: summary.duration_formatted },
            { label: 'Volume', value: `${formatVolume(summary.total_volume)} kg` },
            { label: 'Sets', value: String(summary.total_sets) },
            { label: 'Exercises', value: String(summary.exercises_completed) },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '14px 10px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 10, color: C.textMuted, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '1px',
              }}>{stat.label}</div>
              <div style={{
                fontSize: 22, fontFamily: MONO, fontWeight: 600,
                color: C.text, fontVariantNumeric: 'tabular-nums',
              }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* PR section */}
        {prs.length > 0 ? (
          <div style={{
            width: '100%',
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 12, padding: 16, marginBottom: 24,
          }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: GOLD,
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>&#127942;</span> PRs Hit!
            </div>
            {prs.map((pr, i) => (
              <div key={`${pr.exercise_id}-${pr.pr_type}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 0',
                borderTop: i > 0 ? '1px solid rgba(245,158,11,0.1)' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                    {pr.exercise_name}
                  </div>
                  <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                    <span style={{ fontFamily: MONO, color: GOLD, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {pr.new_value}{pr.unit === 'kg' ? ' kg' : ''}
                    </span>
                    {' '}
                    <span style={{ color: C.textMuted }}>
                      (prev: {pr.previous_best}{pr.unit === 'kg' ? ' kg' : ''})
                    </span>
                  </div>
                </div>
                <PrBadge type={pr.pr_type} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '20px 16px', marginBottom: 24,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: C.textSec }}>
              Solid workout! Keep pushing. &#128170;
            </div>
          </div>
        )}

        {/* Exercise list */}
        {summary.exercises && summary.exercises.length > 0 && (
          <div style={{ width: '100%', marginBottom: 24 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: C.textMuted,
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8,
            }}>Exercises completed</div>
            {summary.exercises.map(ex => (
              <div key={ex.exercise_id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', fontSize: 13,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={C.green} strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: C.text, flex: 1 }}>{ex.name}</span>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                  {ex.sets} set{ex.sets !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        </div>{/* end scrollable middle */}

        {/* Fixed footer — Done button above bottom nav */}
        <div style={{
          flexShrink: 0, padding: '16px 20px',
          paddingBottom: 96,
        }}>
          <button onClick={onDone} style={{
            width: '100%', padding: '16px', borderRadius: 12, border: 'none',
            background: 'rgba(29,158,117,0.2)', color: C.green,
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}>
            Done
          </button>
        </div>
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

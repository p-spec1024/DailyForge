import { C } from '../workout/tokens.jsx';
import BottomSheet from '../BottomSheet.jsx';

const DIFFICULTY_COLORS = {
  beginner: '#1D9E75',
  intermediate: '#D85A30',
  advanced: '#E53E3E',
};

const SAFETY_COLORS = {
  green: '#1D9E75',
  yellow: '#D4A017',
  red: '#E53E3E',
};

/**
 * MidSessionPicker — reusable bottom sheet for swapping yoga poses or breathwork techniques.
 *
 * Props:
 *  - type: 'yoga' | 'breathwork'
 *  - currentName: display name of current item
 *  - alternatives: array of alternative items (already fetched)
 *  - loading: whether alternatives are still loading
 *  - onSelect: (item) => void
 *  - onClose: () => void
 *  - accentColor: theme color (e.g. '#5DCAA5' for yoga, '#a78bfa' for breathwork)
 */
export default function MidSessionPicker({
  type, currentName, alternatives, loading, onSelect, onClose, accentColor,
}) {
  const title = type === 'yoga' ? 'Swap Pose' : 'Swap Technique';

  return (
    <BottomSheet onClose={onClose} title={title}>
      {(close) => (
        <>
          {/* Current item */}
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', padding: '8px 0 4px',
          }}>CURRENT</div>
          <div style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 12,
            background: `${accentColor}12`, border: `1px solid ${accentColor}25`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{currentName}</div>
          </div>

          {/* Alternatives */}
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', padding: '4px 0',
          }}>ALTERNATIVES</div>

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
              Loading alternatives...
            </div>
          ) : !alternatives || alternatives.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
              No alternatives available.
            </div>
          ) : (
            alternatives.map(alt => (
              <button
                key={alt.id}
                onClick={() => close(() => onSelect(alt))}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '12px', borderRadius: 10, marginBottom: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'background 0.15s',
                }}
                onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onTouchEnd={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{alt.name}</div>
                    {type === 'yoga' && alt.sanskrit_name && (
                      <div style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic', marginTop: 2 }}>
                        {alt.sanskrit_name}
                      </div>
                    )}
                    {type === 'breathwork' && alt.tradition && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {alt.tradition}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {type === 'breathwork' && alt.safety_level && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: SAFETY_COLORS[alt.safety_level] || SAFETY_COLORS.green,
                      }} />
                    )}
                    <span style={{
                      fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                      color: DIFFICULTY_COLORS[alt.difficulty] || C.textMuted,
                      background: `${DIFFICULTY_COLORS[alt.difficulty] || 'rgba(255,255,255,0.1)'}20`,
                      borderRadius: 6, padding: '3px 8px',
                    }}>{alt.difficulty}</span>
                  </div>
                </div>
                {type === 'breathwork' && alt.estimated_duration > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    ~{Math.round(alt.estimated_duration / 60)}m
                  </div>
                )}
              </button>
            ))
          )}
        </>
      )}
    </BottomSheet>
  );
}

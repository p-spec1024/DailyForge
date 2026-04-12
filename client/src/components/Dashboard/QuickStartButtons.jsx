import { C } from '../workout/tokens.jsx';

const BUTTONS = [
  { key: 'strength', icon: '🏋️', label: 'Strength Only' },
  { key: 'yoga',     icon: '🧘', label: 'Yoga Only' },
  { key: 'breathe',  icon: '🌬️', label: 'Breathwork Only' },
];

export default function QuickStartButtons({ onSelect, disabled }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '1.5px',
          color: C.textMuted,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Quick Start
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {BUTTONS.map(b => (
          <button
            key={b.key}
            onClick={() => onSelect?.(b.key)}
            disabled={disabled}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: C.text,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              backdropFilter: 'blur(8px)',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{b.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{b.label}</span>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

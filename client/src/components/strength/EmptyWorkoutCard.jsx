import { C } from '../workout/tokens.jsx';

export default function EmptyWorkoutCard({ onStart, disabled }) {
  return (
    <div style={{
      background: 'rgba(245,158,11,0.06)',
      border: '1px solid rgba(245,158,11,0.15)',
      borderRadius: 14,
      padding: '18px 16px',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
          Start Empty Workout
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textSec, marginBottom: 14, lineHeight: 1.5 }}>
        Log exercises as you go. Add exercises mid-session or browse the library below.
      </div>
      <button
        onClick={onStart}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 10,
          border: 'none',
          background: 'rgba(245,158,11,0.18)',
          color: '#f59e0b',
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
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
        Start
      </button>
    </div>
  );
}

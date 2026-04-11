import { C } from '../workout/tokens.jsx';

export default function TimerControls({ isRunning, onPause, onResume, onStop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingBottom: 8 }}>
      {/* Large circular play/pause button */}
      <button
        onClick={isRunning ? onPause : onResume}
        style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '1px solid rgba(167,139,250,0.3)',
          background: 'rgba(167,139,250,0.12)',
          backdropFilter: 'blur(8px)',
          color: '#a78bfa', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, transform 0.1s',
          boxShadow: '0 0 20px rgba(167,139,250,0.1)',
        }}
      >
        {isRunning ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </button>

      {/* Stop button — smaller, subtle */}
      <button
        onClick={onStop}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.textMuted, fontSize: 13, fontWeight: 500,
          padding: '6px 14px', transition: 'color 0.15s',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
        Stop
      </button>
    </div>
  );
}

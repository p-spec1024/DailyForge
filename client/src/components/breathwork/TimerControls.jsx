import { C } from '../workout/tokens.jsx';

export default function TimerControls({ isRunning, onPause, onResume, onStop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
      <button
        onClick={isRunning ? onPause : onResume}
        style={{
          width: '100%', maxWidth: 280, padding: '16px 0',
          borderRadius: 12, border: '1px solid rgba(167,139,250,0.3)',
          background: 'rgba(167,139,250,0.12)',
          color: '#a78bfa', fontSize: 16, fontWeight: 600,
          cursor: 'pointer', transition: 'background 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {isRunning ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            Pause
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
            Resume
          </>
        )}
      </button>

      <button
        onClick={onStop}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.textMuted, fontSize: 14, fontWeight: 500,
          padding: '8px 16px', transition: 'color 0.15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
        Stop
      </button>
    </div>
  );
}

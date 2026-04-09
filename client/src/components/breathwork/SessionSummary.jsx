import { useNavigate } from 'react-router-dom';
import { C, MONO } from '../workout/tokens.jsx';

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SessionSummary({ techniqueName, totalElapsed, roundsCompleted, totalRounds, isComplete }) {
  const navigate = useNavigate();
  const stoppedEarly = !isComplete;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100vh - 80px)',
      padding: '20px 16px', maxWidth: 420, margin: '0 auto',
    }}>
      <div style={{
        fontSize: 48, marginBottom: 8,
        color: isComplete ? '#10B981' : '#F59E0B',
      }}>
        {isComplete ? '\u2713' : '\u25A0'}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        {isComplete ? 'Complete!' : 'Session Ended'}
      </div>

      <div style={{
        width: '100%', background: C.card, border: C.border,
        borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 32,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          {techniqueName}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Duration</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: MONO, color: C.text }}>
              {formatTime(totalElapsed)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Rounds</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: MONO, color: C.text }}>
              {roundsCompleted} / {totalRounds}
            </div>
          </div>
        </div>

        {stoppedEarly && (
          <div style={{ fontSize: 13, color: C.textMuted }}>Stopped early</div>
        )}
      </div>

      <button
        onClick={() => navigate('/breathe')}
        style={{
          width: '100%', maxWidth: 280, padding: '16px 0',
          borderRadius: 12, border: '1px solid rgba(167,139,250,0.3)',
          background: 'rgba(167,139,250,0.12)',
          color: '#a78bfa', fontSize: 16, fontWeight: 600,
          cursor: 'pointer', marginBottom: 12,
        }}
      >
        Start Another
      </button>

      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.textMuted, fontSize: 14, fontWeight: 500, padding: '8px 16px',
        }}
      >
        Done
      </button>
    </div>
  );
}

import { C } from '../workout/tokens.jsx';

export default function SafetyWarningModal({ techniqueName, cautionNote, contraindications, onAccept, onGoBack }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'rgba(20,28,50,0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>
          {'\u26A0\uFE0F'}
        </div>
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, color: '#F59E0B', marginBottom: 16 }}>
          Caution
        </div>

        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, marginBottom: 8 }}>
          <strong>{techniqueName}</strong> requires extra awareness.
        </div>

        {cautionNote && (
          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5, marginBottom: 12 }}>
            {cautionNote}
          </div>
        )}

        {contraindications?.length > 0 && (
          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5, marginBottom: 16 }}>
            <strong style={{ color: C.textMuted }}>Not recommended if you have:</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              {contraindications.map((c, i) => (
                <li key={i} style={{ marginBottom: 2 }}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={onGoBack}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
              color: C.textSec, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Go Back
          </button>
          <button
            onClick={onAccept}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#F59E0B', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

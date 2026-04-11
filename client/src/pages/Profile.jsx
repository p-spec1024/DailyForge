import { useNavigate } from 'react-router-dom';
import { C } from '../components/workout/tokens.jsx';
import WorkoutCalendar from '../components/Calendar/WorkoutCalendar.jsx';

export default function Profile({ onLogout }) {
  const navigate = useNavigate();

  return (
    <div style={{
      maxWidth: 480,
      margin: '0 auto',
      padding: '24px 16px',
    }}>
      <h1 style={{
        margin: '8px 4px 20px',
        color: C.text,
        fontSize: 20,
        fontWeight: 500,
      }}>Profile</h1>

      <WorkoutCalendar />

      <div
        onClick={() => navigate('/exercise-history')}
        style={{
          background: C.card,
          border: C.border,
          borderRadius: 12,
          padding: '16px 18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ color: C.text, fontSize: 15, fontWeight: 500, marginBottom: 2 }}>
            📊 Exercise History
          </div>
          <div style={{ color: C.textMuted, fontSize: 12 }}>
            View your progression charts
          </div>
        </div>
        <span style={{ color: C.textMuted, fontSize: 18 }}>›</span>
      </div>

      {onLogout && (
        <button
          onClick={onLogout}
          style={{
            marginTop: 24,
            padding: '12px 24px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            color: C.textSec,
            fontSize: 14,
            cursor: 'pointer',
            width: '100%',
            minHeight: 44,
          }}
        >
          Log out
        </button>
      )}
    </div>
  );
}

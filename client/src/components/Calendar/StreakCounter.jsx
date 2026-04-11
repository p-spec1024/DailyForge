import { C } from '../workout/tokens.jsx';

export const STREAK_GOLD = '#f59e0b';

export default function StreakCounter({ current, best }) {
  const isActive = current > 0;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      borderRadius: 10,
      background: isActive ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
      border: isActive ? '0.5px solid rgba(245, 158, 11, 0.3)' : C.border,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{isActive ? '\uD83D\uDD25' : '\u2728'}</span>
      <div style={{ flex: 1 }}>
        <div style={{
          color: isActive ? STREAK_GOLD : C.text,
          fontSize: 14,
          fontWeight: 600,
        }}>
          {isActive
            ? `${current} day streak`
            : 'Start a new streak!'}
        </div>
        {best > 0 && (
          <div style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>
            Best: {best} day{best === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </div>
  );
}

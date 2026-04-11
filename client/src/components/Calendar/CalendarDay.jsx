import { C } from '../workout/tokens.jsx';

export const DOT_COLORS = {
  strength: '#f59e0b',
  yoga: '#14b8a6',
  breathwork: '#3b82f6',
};

export function dotColorFor(mainWorkType) {
  return DOT_COLORS[mainWorkType] || DOT_COLORS.strength;
}

export default function CalendarDay({
  day,
  isToday,
  isFuture,
  isCurrentMonth,
  inStreak,
  sessions,
  onTap,
}) {
  const hasSessions = sessions && sessions.length > 0;
  const tappable = !isFuture && isCurrentMonth;
  const dots = sessions ? sessions.slice(0, 3) : [];

  return (
    <button
      type="button"
      onClick={tappable ? onTap : undefined}
      disabled={!tappable}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        background: inStreak ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        border: isToday ? '1px solid rgba(245, 158, 11, 0.9)' : '0.5px solid transparent',
        borderRadius: 8,
        padding: 0,
        color: !isCurrentMonth ? C.textHint
             : isFuture ? C.textMuted
             : C.text,
        cursor: tappable && hasSessions ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: isToday ? 600 : 400,
      }}
    >
      <span style={{ lineHeight: 1 }}>{day}</span>
      {hasSessions && (
        <div style={{
          display: 'flex',
          gap: 3,
          marginTop: 3,
          minHeight: 6,
        }}>
          {dots.map((s, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: dotColorFor(s.main_work_type),
                display: 'block',
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}

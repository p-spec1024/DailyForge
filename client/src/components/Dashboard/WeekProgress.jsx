import { C } from '../workout/tokens.jsx';

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function WeekProgress({ days, todayIndex }) {
  const safeDays = Array.isArray(days) && days.length === 7
    ? days
    : [false, false, false, false, false, false, false];

  return (
    <div
      style={{
        background: C.card,
        border: C.border,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.5px',
            color: C.textMuted,
            textTransform: 'uppercase',
          }}
        >
          This Week
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {safeDays.map((filled, i) => {
          const isToday = i === todayIndex;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: filled ? C.green : 'transparent',
                  border: filled
                    ? `1px solid ${C.green}`
                    : '1px solid rgba(255,255,255,0.15)',
                  boxShadow: isToday ? `0 0 0 2px rgba(255,255,255,0.25)` : 'none',
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  color: isToday ? C.text : C.textMuted,
                  fontWeight: isToday ? 600 : 400,
                }}
              >
                {LABELS[i]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

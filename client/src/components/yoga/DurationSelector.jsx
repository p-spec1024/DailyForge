const DURATIONS = [10, 20, 30, 45, 60];

const s = {
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.6px',
    fontWeight: 600,
    marginBottom: 8,
  },
  container: {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
  },
  btn: (active) => ({
    flex: 1,
    padding: '10px 0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 600,
    background: active
      ? 'rgba(94,234,212,0.08)'
      : 'rgba(255,255,255,0.02)',
    border: active
      ? '1px solid rgba(94,234,212,0.4)'
      : '1px solid rgba(255,255,255,0.06)',
    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
    cursor: 'pointer',
  }),
};

export default function DurationSelector({ selected, onSelect }) {
  return (
    <div>
      <div style={s.label}>Duration</div>
      <div style={s.container}>
        {DURATIONS.map(d => (
          <button key={d} style={s.btn(selected === d)} onClick={() => onSelect(d)}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

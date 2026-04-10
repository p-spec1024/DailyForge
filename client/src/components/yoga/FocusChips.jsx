const AREAS = [
  'Hips', 'Hamstrings', 'Back', 'Shoulders', 'Core',
  'Neck', 'Chest', 'Balance', 'Twists', 'Strength',
];

const s = {
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.6px',
    fontWeight: 600,
    marginBottom: 8,
  },
  optional: {
    fontWeight: 400,
    opacity: 0.6,
  },
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 16,
  },
  chip: (active) => ({
    padding: '5px 10px',
    borderRadius: 14,
    fontSize: 11,
    fontWeight: active ? 500 : 400,
    background: active ? 'rgba(94,234,212,0.08)' : 'transparent',
    border: active
      ? '1px solid rgba(94,234,212,0.4)'
      : '1px solid rgba(255,255,255,0.08)',
    color: active ? '#5eead4' : 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
  }),
};

export default function FocusChips({ selected, onToggle }) {
  return (
    <div>
      <div style={s.label}>
        Focus <span style={s.optional}>optional</span>
      </div>
      <div style={s.container}>
        {AREAS.map(area => (
          <div
            key={area}
            style={s.chip(selected.includes(area.toLowerCase()))}
            onClick={() => onToggle(area.toLowerCase())}
          >
            {area}
          </div>
        ))}
      </div>
    </div>
  );
}

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

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
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 2,
    marginBottom: 20,
  },
  btn: (active) => ({
    flex: 1,
    padding: '7px 4px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: active ? 600 : 500,
    background: active ? 'rgba(94,234,212,0.1)' : 'none',
    color: active ? '#5eead4' : 'rgba(255,255,255,0.4)',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'center',
  }),
};

export default function LevelSelector({ selected, onSelect }) {
  return (
    <div>
      <div style={s.label}>Level</div>
      <div style={s.container}>
        {LEVELS.map(l => (
          <button key={l} style={s.btn(selected === l)} onClick={() => onSelect(l)}>
            {LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

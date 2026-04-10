import { useEffect } from 'react';

const TYPES = [
  { id: 'vinyasa', icon: '\u{1F30A}', label: 'Vinyasa' },
  { id: 'hatha', icon: '\u{1F9D8}', label: 'Hatha' },
  { id: 'yin', icon: '\u{1F319}', label: 'Yin' },
  { id: 'restorative', icon: '\u2601\uFE0F', label: 'Restore' },
  { id: 'sun_salutation', icon: '\u2600\uFE0F', label: 'Sun' },
];

const s = {
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.6px',
    fontWeight: 600,
    marginBottom: 12,
  },
  container: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 6,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 4,
    marginTop: 2,
    marginBottom: 20,
  },
  pill: (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 10,
    border: active
      ? '1px solid rgba(94,234,212,0.4)'
      : '1px solid rgba(255,255,255,0.06)',
    background: active
      ? 'rgba(94,234,212,0.08)'
      : 'rgba(255,255,255,0.02)',
    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  }),
  icon: { fontSize: 14 },
};

// Custom scrollbar styles
const scrollbarCSS = `
.yoga-type-scroll::-webkit-scrollbar { height: 3px; }
.yoga-type-scroll::-webkit-scrollbar-track { background: transparent; }
.yoga-type-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
`;

export default function PracticeTypeSelector({ selected, onSelect }) {
  useEffect(() => {
    if (document.getElementById('yoga-type-scrollbar')) return;
    const el = document.createElement('style');
    el.id = 'yoga-type-scrollbar';
    el.textContent = scrollbarCSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <div>
      <div style={s.label}>Practice Type</div>
      <div className="yoga-type-scroll" style={s.container}>
        {TYPES.map(t => (
          <div
            key={t.id}
            style={s.pill(selected === t.id)}
            onClick={() => onSelect(t.id)}
          >
            <span style={s.icon}>{t.icon}</span>
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
}

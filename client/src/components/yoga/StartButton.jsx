const TYPE_LABELS = {
  vinyasa: 'Vinyasa',
  hatha: 'Hatha',
  yin: 'Yin',
  restorative: 'Restore',
  sun_salutation: 'Sun',
};

const s = {
  wrapper: {
    position: 'fixed',
    bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
    left: 0,
    right: 0,
    padding: '12px 16px 26px',
    background: 'linear-gradient(transparent, #0a1628 50%)',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 50,
  },
  btn: (generating) => ({
    padding: '12px 28px',
    borderRadius: 50,
    background: generating ? 'rgba(94,234,212,0.5)' : '#5eead4',
    color: '#0a1628',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: generating ? 'default' : 'pointer',
    boxShadow: '0 4px 20px rgba(94,234,212,0.3)',
    pointerEvents: 'auto',
  }),
};

export default function StartButton({ config, isGenerating, onStart }) {
  let focusLabel = '';
  if (config.focus.length === 1) {
    focusLabel = ` \u00B7 ${config.focus[0].charAt(0).toUpperCase() + config.focus[0].slice(1)}`;
  } else if (config.focus.length >= 2) {
    focusLabel = ` \u00B7 ${config.focus.length} areas`;
  }

  const text = isGenerating
    ? 'Generating...'
    : `Start ${config.duration}m ${TYPE_LABELS[config.type] || config.type}${focusLabel}`;

  return (
    <div style={s.wrapper}>
      <button style={s.btn(isGenerating)} onClick={onStart} disabled={isGenerating}>
        {text}
      </button>
    </div>
  );
}

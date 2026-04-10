const TYPE_LABELS = {
  vinyasa: 'Vinyasa',
  hatha: 'Hatha',
  yin: 'Yin',
  restorative: 'Restore',
  sun_salutation: 'Sun',
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
    gap: 8,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    textAlign: 'left',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
  },
  title: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RecentSessions({ sessions, onLoad }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div>
      <div style={s.label}>Recent</div>
      <div style={s.container}>
        {sessions.map(sess => (
          <div key={sess.id} style={s.card} onClick={() => onLoad(sess)}>
            <div style={s.title}>
              {sess.duration}m {TYPE_LABELS[sess.type] || sess.type}
              {sess.focus?.length > 0 ? ` \u00B7 ${sess.focus.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}` : ''}
            </div>
            <div style={s.subtitle}>
              {formatDate(sess.date)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

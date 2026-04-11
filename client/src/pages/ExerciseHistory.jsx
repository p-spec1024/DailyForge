import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { C, MONO, GOLD, typeColor } from '../components/workout/tokens.jsx';

const PILLARS = [
  { key: 'strength',   label: 'STRENGTH',   icon: '🏋️', color: typeColor('strength') },
  { key: 'yoga',       label: 'YOGA',       icon: '🧘', color: typeColor('yoga') },
  { key: 'breathwork', label: 'BREATHWORK', icon: '🌬️', color: typeColor('breathwork') },
];

function formatHold(s) {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}:${String(sec).padStart(2, '0')}`;
  return `${sec}s`;
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ExerciseRow({ kind, item, onClick }) {
  const bestMetric = kind === 'strength'
    ? (item.best_weight ? `${item.best_weight}kg` : '—')
    : formatHold(item.best_hold_seconds);

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        borderBottom: '0.5px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 44,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>{item.name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.text, fontSize: 14, fontFamily: MONO, fontWeight: 500 }}>{bestMetric}</span>
          {kind === 'strength' && item.has_pr && (
            <span style={{
              color: GOLD,
              fontSize: 11,
              textShadow: `0 0 8px ${GOLD}80`,
            }}>✨ PR</span>
          )}
        </span>
      </div>
      <div style={{ color: C.textMuted, fontSize: 11, fontFamily: MONO }}>
        Last: {formatDate(item.last_session)} · {item.total_sessions} session{item.total_sessions === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function PillarSection({ pillar, items, expanded, onToggle, onItemClick }) {
  return (
    <div style={{
      background: C.card,
      border: `0.5px solid ${pillar.color}25`,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>{pillar.icon}</span>
          <span style={{
            color: pillar.color,
            fontSize: 12,
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}>
            {pillar.label} ({items.length})
          </span>
        </div>
        <span style={{ color: C.textMuted, fontSize: 14 }}>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && items.length > 0 && (
        <div>
          {items.map((item) => (
            <ExerciseRow
              key={`${pillar.key}-${item.exercise_id}`}
              kind={pillar.key}
              item={item}
              onClick={() => onItemClick(item.exercise_id, pillar.key)}
            />
          ))}
        </div>
      )}
      {expanded && items.length === 0 && (
        <div style={{ padding: '16px', color: C.textMuted, fontSize: 12, textAlign: 'center' }}>
          No {pillar.label.toLowerCase()} history yet
        </div>
      )}
    </div>
  );
}

export default function ExerciseHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Sections start collapsed by default. When this page is reached via the
  // back button from ExerciseProgress, the source section is restored from
  // the ?expand=<kind> URL param (set by ExerciseProgress's back button) so
  // the user lands on the same expanded view they left.
  const initialExpand = searchParams.get('expand');
  const [expanded, setExpanded] = useState(
    initialExpand ? { [initialExpand]: true } : {}
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get('/progress/exercises')
      .then((res) => { if (mounted) setData(res); })
      .catch((err) => { if (mounted) setError(err.message || 'Failed to load history'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const handleClick = (exerciseId, kind) => {
    navigate(`/progress/${exerciseId}?type=${kind}`);
  };

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const totalItems = data
    ? (data.strength?.length || 0) + (data.yoga?.length || 0) + (data.breathwork?.length || 0)
    : 0;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 24px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 4px 18px',
      }}>
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.textSec,
            fontSize: 20,
            cursor: 'pointer',
            padding: 4,
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label="Back"
        >
          ←
        </button>
        <h1 style={{
          margin: 0,
          color: C.text,
          fontSize: 18,
          fontWeight: 500,
        }}>Exercise History</h1>
      </div>

      {loading && (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: 40, fontSize: 13 }}>
          Loading…
        </div>
      )}

      {error && (
        <div style={{
          color: '#ef4444',
          background: 'rgba(239,68,68,0.08)',
          border: '0.5px solid rgba(239,68,68,0.3)',
          borderRadius: 12,
          padding: 16,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && totalItems === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: C.textMuted,
          fontSize: 14,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div>No history yet.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Complete a session to start tracking progress.</div>
        </div>
      )}

      {!loading && !error && data && totalItems > 0 && PILLARS.map((p) => (
        <PillarSection
          key={p.key}
          pillar={p}
          items={data[p.key] || []}
          expanded={expanded[p.key]}
          onToggle={() => toggle(p.key)}
          onItemClick={handleClick}
        />
      ))}
    </div>
  );
}

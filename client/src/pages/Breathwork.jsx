import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { C } from '../components/workout/tokens.jsx';
import TechniqueCard from '../components/breathwork/TechniqueCard.jsx';

const CATEGORIES = ['all', 'energizing', 'calming', 'focus', 'sleep', 'performance', 'recovery'];

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export default function Breathwork() {
  const navigate = useNavigate();
  const [techniques, setTechniques] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState({});

  useEffect(() => {
    setLoading(true);
    const query = activeFilter === 'all' ? '' : `?category=${activeFilter}`;
    api.get(`/breathwork/techniques${query}`)
      .then(setTechniques)
      .catch(() => setTechniques([]))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  useEffect(() => {
    const ids = techniques.map(t => t.id).filter(Boolean);
    if (ids.length === 0) { setSuggestions({}); return; }
    let cancelled = false;
    api.get(`/suggestions/breathwork?techniqueIds=${ids.join(',')}`)
      .then(data => { if (!cancelled) setSuggestions(data?.suggestions || {}); })
      .catch(() => { if (!cancelled) setSuggestions({}); });
    return () => { cancelled = true; };
  }, [techniques]);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0 }}>
          Breathwork
        </h1>
      </div>

      {/* Filter Chips */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12,
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {CATEGORIES.map((cat) => {
          const active = cat === activeFilter;
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: active ? '1px solid rgba(167,139,250,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
                background: active ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                color: active ? '#a78bfa' : C.textSec,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {capitalize(cat)}
            </button>
          );
        })}
      </div>

      {/* Technique List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading...</div>
      ) : techniques.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
          No techniques found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {techniques.map((t) => (
            <TechniqueCard
              key={t.id}
              technique={t}
              suggestion={suggestions[t.id]}
              onClick={() => navigate(`/breathe/${t.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

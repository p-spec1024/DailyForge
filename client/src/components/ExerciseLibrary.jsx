import { useState, useMemo } from 'react';

/* ── Design tokens ── */
const C = {
  bg: '#0c1222',
  card: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.06)',
  text: 'rgba(255,255,255,0.95)',
  textSec: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',
  textHint: 'rgba(255,255,255,0.2)',
  strength: '#D85A30',
  yoga: '#1D9E75',
  breathwork: '#a78bfa',
  cardio: '#F9CB40',
  stretch: '#5DCAA5',
};

const MONO = "'SF Mono', 'Fira Code', monospace";

const DIFF_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };
const DIFF_COLORS = { beginner: '#1D9E75', intermediate: '#F9CB40', advanced: '#D85A30' };

/* ── Helpers ── */
function typeColor(type) {
  if (!type) return C.strength;
  const t = type.toLowerCase();
  if (t === 'yoga') return C.yoga;
  if (t === 'breathwork') return C.breathwork;
  if (t === 'cardio') return C.cardio;
  if (t === 'mobility' || t === 'stretch') return C.stretch;
  return C.strength;
}

function formatDuration(secs) {
  if (!secs) return null;
  if (secs >= 60) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${secs}s`;
}

/* ── Filter Bar ── */
function FilterBar({ difficulty, setDifficulty, sort, setSort, search, setSearch, categories, category, setCategory }) {
  const pillStyle = (active) => ({
    padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
    border: active ? '0.5px solid rgba(255,255,255,0.15)' : C.border,
    background: active ? 'rgba(255,255,255,0.08)' : C.card,
    color: active ? C.text : C.textMuted,
    cursor: 'pointer', transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      {/* Search */}
      <input
        type="text"
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: C.border, background: C.card,
          color: C.text, fontSize: 13,
          fontFamily: "'Outfit', sans-serif",
        }}
      />

      {/* Difficulty filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Level</span>
        {['all', 'beginner', 'intermediate', 'advanced'].map((d) => (
          <button key={d} onClick={() => setDifficulty(d)} style={{
            ...pillStyle(difficulty === d),
            color: difficulty === d
              ? (d === 'all' ? C.text : DIFF_COLORS[d])
              : C.textMuted,
          }}>
            {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {/* Category filter (if categories provided) */}
      {categories && categories.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Group</span>
          <button onClick={() => setCategory('all')} style={pillStyle(category === 'all')}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} style={pillStyle(category === c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Sort */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Sort</span>
        {[['name', 'A-Z'], ['difficulty', 'Difficulty'], ['duration', 'Duration']].map(([val, label]) => (
          <button key={val} onClick={() => setSort(val)} style={pillStyle(sort === val)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function youtubeSearchUrl(name, type) {
  const n = encodeURIComponent(name).replace(/%20/g, '+');
  const t = (type || '').toLowerCase();
  if (t === 'yoga') return `https://www.youtube.com/results?search_query=${n}+yoga+pose+tutorial`;
  if (t === 'breathwork') return `https://www.youtube.com/results?search_query=${n}+breathing+technique`;
  if (t === 'strength') return `https://www.youtube.com/results?search_query=${n}+dumbbell+exercise+form`;
  if (t === 'stretch' || t === 'mobility') return `https://www.youtube.com/results?search_query=${n}+stretch+tutorial`;
  if (t === 'cardio') return `https://www.youtube.com/results?search_query=${n}+exercise+tutorial`;
  return `https://www.youtube.com/results?search_query=${n}+exercise+tutorial`;
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Infer exercise type from library category for YouTube search
function inferType(exercise) {
  const cat = (exercise.category || '').toLowerCase();
  if (exercise.sanskrit) return 'yoga';
  if (cat.includes('energiz') || cat.includes('calm') || cat.includes('meditat') || cat.includes('advanced')) {
    if (exercise.muscles && exercise.muscles.includes('diaphragm')) return 'breathwork';
  }
  if (cat === 'chest' || cat === 'back' || cat === 'shoulders' || cat === 'arms' || cat === 'legs' || cat === 'core') return 'strength';
  if (cat.includes('upper body') || cat.includes('lower body') || cat.includes('spine') || cat.includes('full body')) return 'stretch';
  return null;
}

const YTIcon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
    <rect width="20" height="14" rx="3" fill="#FF0000" />
    <polygon points="8,3 8,11 14,7" fill="#fff" />
  </svg>
);

/* ── Exercise Detail (expanded) ── */
function ExerciseDetail({ exercise }) {
  const muscles = exercise.muscles
    ? exercise.muscles.split(',').map((m) => m.trim()).filter(Boolean)
    : [];
  const realUrl = exercise.url;
  const videoId = extractVideoId(realUrl);
  const exType = inferType(exercise);

  const btnStyle = {
    width: '100%', padding: '10px', borderRadius: 10,
    background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
    color: C.textSec, fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.2s',
  };

  return (
    <div style={{
      padding: '10px 0 6px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Muscle tags */}
      {muscles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {muscles.map((m) => (
            <span key={m} style={{
              fontSize: 10, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.06)', borderRadius: 8,
              padding: '2px 7px',
            }}>{m}</span>
          ))}
        </div>
      )}

      {/* Description */}
      <div>
        <div style={{
          fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '1.5px', color: C.textMuted, marginBottom: 5,
        }}>HOW TO DO IT</div>
        {exercise.description ? (
          <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>
            {exercise.description}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.textHint, fontStyle: 'italic' }}>
            No instructions added yet
          </div>
        )}
      </div>

      {/* Video */}
      {realUrl && videoId ? (
        <div>
          <div onClick={() => window.open(realUrl, '_blank', 'noopener')} style={{
            height: 140, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
            background: C.card, border: C.border, position: 'relative',
          }}>
            <img src={`https://img.youtube.com/vi/${videoId}/0.jpg`} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6,
            }} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
          <button onClick={() => window.open(realUrl, '_blank', 'noopener')}
            style={{ ...btnStyle, marginTop: 6 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <YTIcon /> Watch video
          </button>
        </div>
      ) : (
        <button
          onClick={() => window.open(youtubeSearchUrl(exercise.name, exType), '_blank', 'noopener')}
          style={btnStyle}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        >
          <YTIcon /> Watch on YouTube
        </button>
      )}

      {/* Info pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {exercise.difficulty && (
          <span style={{
            fontSize: 10, color: DIFF_COLORS[exercise.difficulty] || C.textMuted,
            background: C.card, borderRadius: 6, padding: '3px 8px',
          }}>{exercise.difficulty}</span>
        )}
        {exercise.category && (
          <span style={{
            fontSize: 10, color: C.textMuted,
            background: C.card, borderRadius: 6, padding: '3px 8px',
          }}>{exercise.category}</span>
        )}
        {exercise.duration && (
          <span style={{
            fontSize: 10, color: C.textMuted, fontFamily: MONO,
            background: C.card, borderRadius: 6, padding: '3px 8px',
          }}>{formatDuration(exercise.duration)}</span>
        )}
        {exercise.sets && (
          <span style={{
            fontSize: 10, color: C.textMuted, fontFamily: MONO,
            background: C.card, borderRadius: 6, padding: '3px 8px',
          }}>{exercise.sets} &times; {exercise.reps}</span>
        )}
      </div>
    </div>
  );
}

/* ── Exercise Row ── */
function ExerciseRow({ exercise, isExpanded, onToggle, accentColor }) {
  const diffColor = DIFF_COLORS[exercise.difficulty] || C.textMuted;

  return (
    <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0', cursor: 'pointer',
      }}>
        {/* Difficulty dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: diffColor, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{exercise.name}</div>
          {exercise.sanskrit && (
            <div style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>{exercise.sanskrit}</div>
          )}
        </div>
        {/* Right: duration or sets */}
        <div style={{ fontSize: 11, fontFamily: MONO, color: C.textMuted, flexShrink: 0 }}>
          {exercise.duration ? formatDuration(exercise.duration) : exercise.sets ? `${exercise.sets}\u00d7${exercise.reps}` : ''}
        </div>
        {/* Expand chevron */}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.textHint} strokeWidth="1.5"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="2,3 5,7 8,3" />
        </svg>
      </div>
      {isExpanded && <ExerciseDetail exercise={exercise} />}
    </div>
  );
}

/* ── Main Component ── */
export default function ExerciseLibrary({ exercises, accentColor = C.strength, title }) {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('name');
  const [expandedIdx, setExpandedIdx] = useState(null);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(exercises.map((e) => e.category).filter(Boolean))];
    return cats.sort();
  }, [exercises]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...exercises];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        (e.sanskrit && e.sanskrit.toLowerCase().includes(q)) ||
        (e.muscles && e.muscles.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
      );
    }

    // Difficulty filter
    if (difficulty !== 'all') {
      list = list.filter((e) => e.difficulty === difficulty);
    }

    // Category filter
    if (category !== 'all') {
      list = list.filter((e) => e.category === category);
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'difficulty') {
        return (DIFF_ORDER[a.difficulty] || 0) - (DIFF_ORDER[b.difficulty] || 0) || a.name.localeCompare(b.name);
      }
      if (sort === 'duration') {
        return (a.duration || 0) - (b.duration || 0) || a.name.localeCompare(b.name);
      }
      return 0;
    });

    return list;
  }, [exercises, search, difficulty, category, sort]);

  return (
    <div>
      <FilterBar
        difficulty={difficulty} setDifficulty={setDifficulty}
        sort={sort} setSort={setSort}
        search={search} setSearch={setSearch}
        categories={categories} category={category} setCategory={setCategory}
      />

      {/* Count */}
      <div style={{
        fontSize: 11, color: C.textMuted, marginBottom: 10, fontFamily: MONO,
      }}>
        {filtered.length} exercise{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Exercise list */}
      <div style={{
        background: C.card, border: C.border, borderRadius: 10,
        borderTop: `2px solid ${accentColor}`,
        padding: '0 12px',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '32px 0', textAlign: 'center',
            color: C.textMuted, fontSize: 13,
          }}>
            No exercises match your filters
          </div>
        ) : (
          filtered.map((ex, i) => (
            <ExerciseRow
              key={`${ex.name}-${i}`}
              exercise={ex}
              isExpanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
              accentColor={accentColor}
            />
          ))
        )}
      </div>
    </div>
  );
}

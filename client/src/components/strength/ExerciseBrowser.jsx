import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../utils/api.js';
import { C } from '../workout/tokens.jsx';
import MuscleFilterChips from './MuscleFilterChips.jsx';
import ExerciseBrowseCard from './ExerciseBrowseCard.jsx';
import ExerciseDetailModal from './ExerciseDetailModal.jsx';

const PAGE_SIZE = 30;

export default function ExerciseBrowser({ onDoExercise }) {
  const [muscle, setMuscle] = useState(null);
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEx, setSelectedEx] = useState(null);
  const debounceRef = useRef(null);
  const offsetRef = useRef(0);

  const fetchExercises = useCallback(async (muscleFilter, searchFilter, offset = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const params = new URLSearchParams();
      if (muscleFilter) params.set('muscle', muscleFilter);
      if (searchFilter) params.set('search', searchFilter);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));

      const data = await api.get(`/exercises/strength?${params}`);
      if (append) {
        setExercises(prev => [...prev, ...data.exercises]);
      } else {
        setExercises(data.exercises);
      }
      setTotal(data.total);
      setHasMore(data.hasMore);
      offsetRef.current = offset + data.exercises.length;
    } catch (err) {
      setError(err?.message || 'Failed to load exercises');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Fetch on filter change (debounced for search)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchExercises(muscle, search.trim(), 0, false);
    }, search ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [muscle, search, fetchExercises]);

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    fetchExercises(muscle, search.trim(), offsetRef.current, true);
  }

  return (
    <div>
      {/* Section header */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '1.5px',
        color: C.textMuted,
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        Browse Exercises
        {!loading && (
          <span style={{ fontWeight: 400, marginLeft: 6, letterSpacing: '0.5px' }}>
            {total}
          </span>
        )}
      </div>

      {/* Muscle filter chips */}
      <MuscleFilterChips selected={muscle} onSelect={setMuscle} />

      {/* Search */}
      <div style={{ position: 'relative', margin: '10px 0 12px' }}>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={C.textMuted} strokeWidth="2" strokeLinecap="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px 10px 38px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: C.text,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 10, width: 20, height: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: C.textSec, fontSize: 12,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          color: '#f87171', fontSize: 12, padding: 12, marginBottom: 12,
          background: 'rgba(239,68,68,0.08)', borderRadius: 8, textAlign: 'center',
        }}>{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{
              height: 52, borderRadius: 12, background: C.card,
            }} />
          ))}
        </div>
      )}

      {/* Exercise list */}
      {!loading && exercises.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '32px 16px',
          color: C.textMuted, fontSize: 13,
        }}>
          {search || muscle ? 'No exercises match your filters' : 'No exercises found'}
        </div>
      )}

      {!loading && exercises.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {exercises.map(ex => (
            <ExerciseBrowseCard
              key={ex.id}
              exercise={ex}
              onTap={setSelectedEx}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: 10,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: C.textSec,
            fontSize: 13,
            cursor: loadingMore ? 'default' : 'pointer',
            opacity: loadingMore ? 0.5 : 1,
          }}
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}

      {/* Detail modal */}
      {selectedEx && (
        <ExerciseDetailModal
          exercise={selectedEx}
          onClose={() => setSelectedEx(null)}
          onDoThis={(ex) => {
            setSelectedEx(null);
            onDoExercise(ex);
          }}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api.js';
import { C, parseMuscles } from './tokens.jsx';
import MuscleFilterChips from '../strength/MuscleFilterChips.jsx';

const PAGE_SIZE = 30;

function ExercisePickCard({ exercise, onTap }) {
  const muscles = parseMuscles(exercise.target_muscles);
  const primary = muscles[0] || null;

  return (
    <button
      onClick={() => onTap(exercise)}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '12px 14px',
        borderRadius: 12,
        background: C.card,
        border: C.border,
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
      onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      onTouchEnd={e => e.currentTarget.style.background = C.card}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: C.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {exercise.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {primary && (
            <span style={{ fontSize: 11, color: C.textMuted, textTransform: 'capitalize' }}>
              {primary}
              {muscles.length > 1 && <span style={{ opacity: 0.6 }}> +{muscles.length - 1}</span>}
            </span>
          )}
          {exercise.equipment && (
            <>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>&middot;</span>
              <span style={{ fontSize: 11, color: C.textMuted, textTransform: 'capitalize' }}>
                {exercise.equipment}
              </span>
            </>
          )}
        </div>
      </div>
      {/* Add icon */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    </button>
  );
}

export default function AddExerciseModal({ onAdd, onClose, existingExerciseIds = [] }) {
  const [muscle, setMuscle] = useState(null);
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const debounceRef = useRef(null);
  const offsetRef = useRef(0);
  const searchInputRef = useRef(null);
  const existingIds = useRef(new Set(existingExerciseIds));

  // Animate in + auto-focus search after slide-up completes
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => searchInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const fetchExercises = useCallback(async (muscleFilter, searchFilter, offset = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

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
      setHasMore(data.hasMore);
      offsetRef.current = offset + data.exercises.length;
    } catch {
      // Silently fail — user can retry by changing filters
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchExercises(muscle, search.trim(), 0, false);
    }, search ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [muscle, search, fetchExercises]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  function handleSelect(exercise) {
    if (existingIds.current.has(exercise.id)) {
      setToast('Exercise already in workout');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    existingIds.current.add(exercise.id);
    onAdd(exercise);
    handleClose();
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    fetchExercises(muscle, search.trim(), offsetRef.current, true);
  }

  const modal = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(6,14,26,0.6)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'relative',
        marginTop: 'env(safe-area-inset-top, 0px)',
        flex: 1,
        display: 'flex', flexDirection: 'column',
        background: '#0a1628',
        borderRadius: '16px 16px 0 0',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.25s ease-out',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: 0 }}>
            Add Exercise
          </h2>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.textSec,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search + filters */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={C.textMuted} strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
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

          {/* Muscle chips */}
          <MuscleFilterChips selected={muscle} onSelect={setMuscle} />
        </div>

        {/* Exercise list (scrollable) */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 16px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          WebkitOverflowScrolling: 'touch',
        }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ height: 52, borderRadius: 12, background: C.card }} />
              ))}
            </div>
          )}

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
                <ExercisePickCard key={ex.id} exercise={ex} onTap={handleSelect} />
              ))}
            </div>
          )}

          {!loading && hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                width: '100%', padding: '12px', marginTop: 10,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: C.textSec, fontSize: 13,
                cursor: loadingMore ? 'default' : 'pointer',
                opacity: loadingMore ? 0.5 : 1,
              }}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>

        {/* Toast notification — centered in scrollable area */}
        {toast && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '12px 24px', borderRadius: 12,
            background: 'rgba(30,30,40,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f87171', fontSize: 13, fontWeight: 500,
            textAlign: 'center', zIndex: 5,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

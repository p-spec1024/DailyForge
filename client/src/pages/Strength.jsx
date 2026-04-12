import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { C, MONO } from '../components/workout/tokens.jsx';
import { ConfirmDialog } from '../components/SessionSummary.jsx';
import EmptyWorkoutCard from '../components/strength/EmptyWorkoutCard.jsx';
import ExerciseBrowser from '../components/strength/ExerciseBrowser.jsx';

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function RoutineCard({ routine, onStart, onDelete }) {
  return (
    <div style={{
      background: C.card,
      border: C.border,
      borderRadius: 12,
      padding: '14px 16px',
      minWidth: 240,
      width: 240,
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Tap area to start */}
      <div
        onClick={onStart}
        style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
      >
        <div style={{
          fontSize: 14, fontWeight: 600, color: C.text,
          marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{routine.name}</div>
        <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
            {routine.exercise_count} exercise{routine.exercise_count !== 1 ? 's' : ''}
          </span>
          {routine.last_used && (
            <>
              <span style={{ opacity: 0.4 }}>&middot;</span>
              <span>{timeAgo(routine.last_used)}</span>
            </>
          )}
        </div>
      </div>

      {/* Start button */}
      <button onClick={onStart} style={{
        width: 36, height: 36, borderRadius: 10, border: 'none',
        background: 'rgba(216,90,48,0.12)', color: C.accent,
        cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6,3 20,12 6,21" />
        </svg>
      </button>

      {/* Delete button */}
      <button onClick={onDelete} style={{
        width: 36, height: 36, borderRadius: 10, border: 'none',
        background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.6)',
        cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </div>
  );
}

export default function Strength() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchRoutines = useCallback(() => {
    setRoutinesLoading(true);
    api.get('/routines')
      .then(setRoutines)
      .catch(() => setRoutines([]))
      .finally(() => setRoutinesLoading(false));
  }, []);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  function handleStartEmpty() {
    if (starting) return;
    setStarting(true);
    navigate('/?mode=empty');
  }

  function handleDoExercise(exercise) {
    navigate(`/?mode=empty&exerciseId=${exercise.id}&exerciseName=${encodeURIComponent(exercise.name)}`);
  }

  function handleStartRoutine(routine) {
    navigate(`/?mode=empty&routineId=${routine.id}`);
  }

  async function handleDeleteRoutine() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/routines/${deleteTarget.id}`);
      setRoutines(prev => prev.filter(r => r.id !== deleteTarget.id));
    } catch { /* ignore */ }
    setDeleteTarget(null);
  }

  return (
    <div style={{
      maxWidth: 420,
      margin: '0 auto',
      padding: '0 16px',
      background: '#0a1628',
      minHeight: 'calc(100vh - 80px)',
      paddingBottom: 90,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 0 18px',
      }}>
        <div style={{
          fontSize: 17,
          fontWeight: 600,
          color: '#fff',
          letterSpacing: '-0.2px',
        }}>
          Strength
        </div>
      </div>

      {/* Empty Workout CTA */}
      <EmptyWorkoutCard onStart={handleStartEmpty} disabled={starting} />

      {/* My Routines */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '1.5px',
        color: C.textMuted,
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        My Routines
      </div>

      {routinesLoading ? (
        <div style={{
          background: C.card, border: C.border, borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>Loading...</div>
        </div>
      ) : routines.length === 0 ? (
        <div style={{
          background: C.card, border: C.border, borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', marginBottom: 20,
        }}>
          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.3 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="16" x2="12" y2="16" />
            </svg>
          </div>
          <div style={{ fontSize: 13, color: C.textSec, marginBottom: 2 }}>
            No saved routines yet
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            Finish a workout to save it as a reusable routine
          </div>
        </div>
      ) : (
        <div className="routines-scroll" style={{
          display: 'flex',
          overflowX: 'auto',
          gap: 12,
          paddingBottom: 8,
          marginBottom: 20,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          <style>{`.routines-scroll::-webkit-scrollbar { display: none; }`}</style>
          {routines.map(routine => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onStart={() => handleStartRoutine(routine)}
              onDelete={() => setDeleteTarget(routine)}
            />
          ))}
        </div>
      )}

      {/* Exercise Browser */}
      <ExerciseBrowser onDoExercise={handleDoExercise} />

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.name}"?`}
          message="This routine will be permanently removed. Your workout history is not affected."
          confirmLabel="Delete"
          confirmColor="rgba(239,68,68,0.3)"
          onConfirm={handleDeleteRoutine}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

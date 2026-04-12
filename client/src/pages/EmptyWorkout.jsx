import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutSession } from '../hooks/useWorkoutSession.js';
import { useSaveRoutine } from '../hooks/useSaveRoutine.js';
import { api } from '../utils/api.js';
import { C, formatVolume } from '../components/workout/tokens.jsx';
import SessionHeader from '../components/SessionHeader.jsx';
import { ExerciseSessionCard } from '../components/ExerciseCard.jsx';
import SessionSummary, { ConfirmDialog } from '../components/SessionSummary.jsx';
import RestTimer from '../components/RestTimer.jsx';
import AddExerciseModal from '../components/workout/AddExerciseModal.jsx';
import SaveRoutineModal from '../components/SaveRoutineModal.jsx';
import SettingsModal from '../components/SettingsModal.jsx';

export default function EmptyWorkoutView({ initialExerciseId, initialExerciseName, routineId: initialRoutineId }) {
  const navigate = useNavigate();
  const session = useWorkoutSession();
  const [exercises, setExercises] = useState([]);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [previousPerformance, setPreviousPerformance] = useState({});
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [restTimerKey, setRestTimerKey] = useState(0);
  const [restTimerEndTime, setRestTimerEndTime] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [toast, setToast] = useState(null);
  const restTimerActivatedAtRef = useRef(null);
  const startedRef = useRef(false);
  const timerStartedRef = useRef(false);
  const saveRoutine = useSaveRoutine();

  const restDuration = userSettings?.rest_timer_duration ?? 90;
  const restEnabled = userSettings?.rest_timer_enabled ?? true;
  const restAutoStart = userSettings?.rest_timer_auto_start ?? true;

  // Defer timer for truly empty workouts (no pre-loaded exercises)
  useEffect(() => {
    if (!initialExerciseId && !initialRoutineId) {
      session.setTimerDeferred(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start timer when first exercise is added (only for truly empty workouts)
  useEffect(() => {
    if (exercises.length > 0 && !timerStartedRef.current) {
      timerStartedRef.current = true;
      if (!initialExerciseId && !initialRoutineId) {
        session.undeferTimer();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises.length]);

  // Fetch user settings
  useEffect(() => {
    api.get('/settings').then(setUserSettings).catch(() => {});
  }, []);

  // Restore rest timer from sessionStorage on resume
  const restoredTimerRef = useRef(false);
  useEffect(() => {
    if (session.isActive && !restoredTimerRef.current) {
      restoredTimerRef.current = true;
      const saved = parseInt(sessionStorage.getItem('dailyforge_rest_timer_end'), 10);
      if (saved && saved > Date.now()) {
        setRestTimerEndTime(saved);
        setRestTimerKey(k => k + 1);
        restTimerActivatedAtRef.current = Date.now() - 1000;
        setIsRestTimerActive(true);
      } else {
        sessionStorage.removeItem('dailyforge_rest_timer_end');
      }
    }
  }, [session.isActive]);

  // Start empty session on mount — run once only
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // If starting from a routine, fetch it first to get exercise IDs
    if (initialRoutineId) {
      api.get(`/routines/${initialRoutineId}`).then(async (routine) => {
        const exerciseIds = routine.exercises.map(e => e.exercise_id);
        const sess = await session.startSession(null, null, { initial_exercises: exerciseIds, routine_id: initialRoutineId });
        if (!sess) return;
        if (sess.workout_id != null) { navigate('/'); return; }
        setExercises(routine.exercises.map(e => ({
          id: e.exercise_id,
          name: e.name,
          target_muscles: e.target_muscles,
          type: e.type,
          default_sets: e.target_sets || e.default_sets || 3,
          default_reps: e.default_reps,
          default_duration_secs: e.default_duration_secs,
          tracking_type: e.tracking_type,
        })));
      }).catch(() => {
        setToast("Couldn't load routine");
        setTimeout(() => navigate('/strength'), 1500);
      });
      return;
    }

    const initialExercises = initialExerciseId ? [initialExerciseId] : [];
    session.startSession(null, null, { initial_exercises: initialExercises }).then(async (sess) => {
      if (!sess) return;
      if (sess.workout_id != null) {
        navigate('/');
        return;
      }

      // Resumed existing session — restore exercises from logged_sets metadata
      if (sess._resumed && sess._loggedSets) {
        const seen = new Set();
        const restored = [];
        for (const s of sess._loggedSets) {
          if (seen.has(s.exercise_id)) continue;
          seen.add(s.exercise_id);
          restored.push({
            id: s.exercise_id,
            name: s.name,
            target_muscles: s.target_muscles,
            type: s.exercise_type,
            default_sets: s.default_sets || 3,
            default_reps: s.default_reps,
            default_duration_secs: s.default_duration_secs,
            tracking_type: s.tracking_type,
          });
        }
        if (restored.length > 0) {
          timerStartedRef.current = true;
          session.setTimerDeferred(false);
          setExercises(restored);
          return;
        }
      }

      if (initialExerciseId) {
        try {
          const ex = await api.get(`/exercises/${initialExerciseId}`);
          setExercises([ex]);
        } catch {
          if (initialExerciseName) {
            setExercises([{ id: parseInt(initialExerciseId), name: initialExerciseName, default_sets: 3, default_reps: 10 }]);
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch prev performance for exercises
  useEffect(() => {
    if (exercises.length === 0 || !session.isActive) return;
    const ids = exercises.map(e => e.id);
    api.get(`/session/previous-performance?exerciseIds=${ids.join(',')}`)
      .then(data => setPreviousPerformance(data.previousPerformance || {}))
      .catch(() => {});
  }, [exercises, session.isActive]);

  function handleDismissTimer() {
    const elapsed = Date.now() - (restTimerActivatedAtRef.current || 0);
    if (elapsed < 500) return;
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
  }

  async function handleLogSet(exerciseId, setData) {
    const result = await session.logSet(exerciseId, setData);
    if (result) {
      if (result.prs && result.prs.length > 0 && navigator.vibrate) {
        navigator.vibrate(100);
      }
      if (restEnabled && restAutoStart) {
        const endTime = Date.now() + restDuration * 1000;
        setRestTimerEndTime(endTime);
        sessionStorage.setItem('dailyforge_rest_timer_end', String(endTime));
        setRestTimerKey(k => k + 1);
        restTimerActivatedAtRef.current = Date.now();
        setIsRestTimerActive(true);
      }
    }
    return result;
  }

  async function handleAddExercise(exercise) {
    setExercises(prev => {
      if (prev.some(e => e.id === exercise.id)) return prev;
      return [...prev, exercise];
    });
    try {
      const data = await api.get(`/session/previous-performance?exerciseIds=${exercise.id}`);
      if (data.previousPerformance) {
        setPreviousPerformance(prev => ({ ...prev, ...data.previousPerformance }));
      }
    } catch { /* ignore */ }
  }

  async function handleFinish() {
    setConfirmFinish(false);
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
    if (session.isActive) {
      const data = await session.completeSession();
      if (data) {
        setSummaryData(data);
      }
    }
  }

  async function handleDiscard() {
    setConfirmDiscard(false);
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
    if (session.isActive) await session.discardSession();
    navigate('/');
  }

  function handleSummaryDone() {
    setSummaryData(null);
    navigate('/');
  }

  if (summaryData) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <SessionSummary
          data={summaryData}
          onDone={handleSummaryDone}
          onSaveRoutine={saveRoutine.canSave(summaryData.summary?.exercises) ? saveRoutine.open : undefined}
        />
        <SaveRoutineModal
          isOpen={saveRoutine.isOpen}
          onClose={saveRoutine.close}
          exercises={(summaryData.summary?.exercises || []).map(ex => ({
            id: ex.exercise_id, name: ex.name, sets_count: ex.sets,
          }))}
          onSaved={saveRoutine.onSaved}
        />
      </div>
    );
  }

  if (!session.isActive && startedRef.current) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>
        {toast || 'Starting workout...'}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <SessionHeader
        elapsed={session.elapsedSeconds}
        totalVolume={session.totalVolume}
        onFinish={() => setConfirmFinish(true)}
        onDiscard={() => setConfirmDiscard(true)}
        onSaveRoutine={saveRoutine.canSave(exercises) ? saveRoutine.open : undefined}
        onSettings={() => setShowSettings(true)}
        formatTime={session.formatTime}
        isFinishing={session.isLoading}
      />

      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
          color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
        }}>CUSTOM WORKOUT</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>
          Empty Workout
        </h2>
        <div style={{ fontSize: 12, color: C.textSec }}>
          {session.totalSets} sets &middot; {formatVolume(session.totalVolume)} kg &middot; {session.exercisesDone} exercises
        </div>
      </div>

      {/* Exercise list */}
      {exercises.length > 0 ? (
        exercises.map(ex => {
          const exSets = session.exerciseSets[ex.id]?.sets || [];
          return (
            <ExerciseSessionCard
              key={ex.id}
              exercise={ex}
              sets={exSets}
              previousData={previousPerformance[ex.id] || null}
              prData={session.sessionPrs[ex.id] || null}
              onLogSet={handleLogSet}
              onInputFocus={handleDismissTimer}
            />
          );
        })
      ) : (
        <div style={{
          background: C.card,
          border: C.border,
          borderRadius: 12,
          padding: '32px 16px',
          textAlign: 'center',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div style={{ fontSize: 14, color: C.textSec, marginBottom: 4 }}>
            No exercises added yet
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
            Tap below to add exercises to your workout.
          </div>
        </div>
      )}

      {/* + Add Exercise button */}
      <button
        onClick={() => setShowAddExercise(true)}
        style={{
          width: '100%', padding: '14px 16px', marginBottom: 12,
          borderRadius: 12,
          background: C.card,
          border: '1px solid rgba(255,255,255,0.08)',
          color: C.textSec, fontSize: 14, fontWeight: 500,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Exercise
      </button>

      {/* Finish Workout button */}
      <div style={{
        position: 'sticky', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))', zIndex: 15, paddingTop: 12,
      }}>
        <button onClick={() => setConfirmFinish(true)} style={{
          width: '100%', padding: '16px', borderRadius: 12,
          background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.25)',
          color: C.green, fontSize: 16, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          backdropFilter: 'blur(8px)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Finish Workout
        </button>
      </div>

      {/* Rest Timer */}
      <RestTimer
        key={restTimerKey}
        duration={restDuration}
        endTime={restTimerEndTime}
        isActive={isRestTimerActive}
        onSkip={handleDismissTimer}
        onFinish={handleDismissTimer}
        onDismiss={handleDismissTimer}
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={userSettings}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => {
            setUserSettings(updated);
            setShowSettings(false);
          }}
        />
      )}

      {/* Confirm finish */}
      {confirmFinish && (
        <ConfirmDialog
          title="Finish this workout?"
          message="Your session will be saved with all logged sets."
          confirmLabel="Finish"
          onConfirm={handleFinish}
          onCancel={() => setConfirmFinish(false)}
        />
      )}

      {/* Confirm discard */}
      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this workout?"
          message="All logged sets will be lost. This cannot be undone."
          confirmLabel="Discard"
          confirmColor="rgba(239,68,68,0.3)"
          onConfirm={handleDiscard}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <AddExerciseModal
          onAdd={handleAddExercise}
          onClose={() => setShowAddExercise(false)}
          existingExerciseIds={exercises.map(ex => ex.id)}
        />
      )}

      {/* Save as Routine Modal */}
      <SaveRoutineModal
        isOpen={saveRoutine.isOpen}
        onClose={saveRoutine.close}
        exercises={exercises.map(ex => ({
          id: ex.id, name: ex.name,
          sets_count: session.exerciseSets[ex.id]?.sets?.filter(s => s.completed).length || ex.default_sets || 3,
        }))}
        onSaved={saveRoutine.onSaved}
      />
    </div>
  );
}

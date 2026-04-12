import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../../contexts/DataProvider.jsx';
import { useWorkoutSession } from '../../hooks/useWorkoutSession.js';
import { api } from '../../utils/api.js';
import { C, formatVolume, isStrengthPhase, MONO } from '../workout/tokens.jsx';
import SessionHeader from '../SessionHeader.jsx';
import { PhaseCheckbox } from '../PhaseCard.jsx';
import { ExerciseSessionCard } from '../ExerciseCard.jsx';
import RestTimer from '../RestTimer.jsx';
import AlternativePicker from '../AlternativePicker.jsx';
import SavePreferencePrompt from '../SavePreferencePrompt.jsx';
import AddExerciseModal from '../workout/AddExerciseModal.jsx';
import { ConfirmDialog } from '../SessionSummary.jsx';

function PauseOverlay({ onResume }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(6,14,26,0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '2px',
        color: C.textMuted, textTransform: 'uppercase',
      }}>SESSION PAUSED</div>
      <button onClick={onResume} style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(216,90,48,0.15)',
        border: '1px solid rgba(216,90,48,0.3)',
        color: C.accent, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 24px rgba(216,90,48,0.1)',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6,3 20,12 6,21" />
        </svg>
      </button>
      <div style={{ fontSize: 14, color: C.textSec }}>Tap to resume</div>
    </div>
  );
}

export default function SessionMainWork({ onComplete, flow }) {
  const { workoutData: workout, workoutLoading: loading, fetchWorkout, invalidateWorkout } = useData();
  const [completedPhases, setCompletedPhases] = useState({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [restTimerKey, setRestTimerKey] = useState(0);
  const [userSettings, setUserSettings] = useState(null);
  const [previousPerformance, setPreviousPerformance] = useState({});
  const [restTimerEndTime, setRestTimerEndTime] = useState(null);
  const [swapPickerExercise, setSwapPickerExercise] = useState(null);
  const [swappedExercises, setSwappedExercises] = useState({});
  const [savePromptData, setSavePromptData] = useState(null);
  const [promptedExercises, setPromptedExercises] = useState(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [skippedExercises, setSkippedExercises] = useState(new Set());
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addedExercises, setAddedExercises] = useState([]);
  const restTimerActivatedAtRef = useRef(null);
  const phaseStartRef = useRef(Date.now());
  const restTimerPausedRemaining = useRef(null);

  const session = useWorkoutSession();

  const restDuration = userSettings?.rest_timer_duration ?? 90;
  const restEnabled = userSettings?.rest_timer_enabled ?? true;
  const restAutoStart = userSettings?.rest_timer_auto_start ?? true;

  useEffect(() => { fetchWorkout(); }, [fetchWorkout]);
  useEffect(() => { api.get('/settings').then(setUserSettings).catch(() => {}); }, []);

  // Auto-start session when component mounts (once)
  const sessionStartedRef = useRef(false);
  useEffect(() => {
    if (!workout?.phases || session.isActive || sessionStartedRef.current) return;
    const workoutIds = workout.phases.map(p => p.workout_id).filter(Boolean);
    if (workoutIds.length > 0) {
      sessionStartedRef.current = true;
      phaseStartRef.current = Date.now();
      session.startSession(workoutIds[0], workoutIds);
    }
  }, [workout]);

  // Fetch previous performance
  const fetchPreviousPerformance = useCallback(async () => {
    if (!workout?.phases) return;
    const exerciseIds = workout.phases
      .filter(isStrengthPhase)
      .flatMap(p => p.exercises.map(ex => ex.id));
    if (exerciseIds.length === 0) return;
    try {
      const data = await api.get(`/session/previous-performance?exerciseIds=${exerciseIds.join(',')}`);
      setPreviousPerformance(data.previousPerformance || {});
    } catch { setPreviousPerformance({}); }
  }, [workout]);

  useEffect(() => {
    if (session.isActive && workout?.phases) fetchPreviousPerformance();
  }, [session.isActive, fetchPreviousPerformance]);

  const getPhaseExercises = useCallback((phase) => {
    return phase.exercises.map(ex => {
      const originalId = ex.original_exercise_id || ex.id;
      const swap = swappedExercises[originalId];
      if (swap) {
        return {
          ...swap.chosen,
          exercise_type: swap.chosen.exercise_type ?? ex.exercise_type,
          default_sets: swap.chosen.default_sets ?? ex.default_sets,
          default_reps: swap.chosen.default_reps ?? ex.default_reps,
          default_duration_secs: swap.chosen.default_duration_secs ?? ex.default_duration_secs,
          target_muscles: swap.chosen.target_muscles || ex.target_muscles,
          default_exercise_id: ex.default_exercise_id ?? originalId,
          default_exercise_name: ex.default_exercise_name ?? ex.name,
          original_exercise_id: originalId,
          original_exercise_name: swap.originalName,
          _swapped_in_session: true,
        };
      }
      return ex;
    });
  }, [swappedExercises]);

  const isLastSetOfLastExercise = useCallback((exerciseId, setData) => {
    if (!workout?.phases) return false;
    const mainPhases = workout.phases.filter(isStrengthPhase);
    if (mainPhases.length === 0) return false;
    const lastMainPhase = mainPhases[mainPhases.length - 1];
    const exercises = getPhaseExercises(lastMainPhase);
    if (exercises.length === 0) return false;
    const lastEx = exercises[exercises.length - 1];
    if (Number(lastEx.id) !== Number(exerciseId)) return false;
    const targetSets = Number(lastEx.default_sets) || 3;
    return Number(setData.set_number) >= targetSets;
  }, [workout, getPhaseExercises]);

  async function handleLogSet(exerciseId, setData) {
    const result = await session.logSet(exerciseId, setData);
    if (result) {
      if (result.prs && result.prs.length > 0 && navigator.vibrate) navigator.vibrate(100);
      if (restEnabled && restAutoStart && !isLastSetOfLastExercise(exerciseId, setData)) {
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

  function handleDismissTimer() {
    const elapsed = Date.now() - (restTimerActivatedAtRef.current || 0);
    if (elapsed < 500) return;
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
  }

  // Pause / Resume
  function handlePause() {
    setIsPaused(true);
    if (flow) flow.pauseSession();
    // Pause rest timer if running
    if (isRestTimerActive && restTimerEndTime) {
      restTimerPausedRemaining.current = Math.max(0, restTimerEndTime - Date.now());
      setIsRestTimerActive(false);
      setRestTimerEndTime(null);
    }
  }

  function handleResume() {
    setIsPaused(false);
    if (flow) flow.resumeSession();
    // Resume rest timer if it was paused
    if (restTimerPausedRemaining.current && restTimerPausedRemaining.current > 0) {
      const newEnd = Date.now() + restTimerPausedRemaining.current;
      setRestTimerEndTime(newEnd);
      sessionStorage.setItem('dailyforge_rest_timer_end', String(newEnd));
      setRestTimerKey(k => k + 1);
      restTimerActivatedAtRef.current = Date.now();
      setIsRestTimerActive(true);
      restTimerPausedRemaining.current = null;
    }
  }

  function handleSkipExercise(exerciseId) {
    setSkippedExercises(prev => new Set(prev).add(exerciseId));
  }

  function handleSwapSelect(alternative) {
    if (!swapPickerExercise) return;
    const originalId = swapPickerExercise.original_exercise_id || swapPickerExercise.id;
    setSwappedExercises(prev => ({
      ...prev,
      [originalId]: {
        chosen: alternative,
        originalExId: originalId,
        originalName: swapPickerExercise.original_exercise_name || swapPickerExercise.name,
        _swapped_in_session: true,
      },
    }));
    setSwapPickerExercise(null);
  }

  async function handleResetToDefault(originalExerciseId) {
    try {
      await api.put(`/workout/slot/${originalExerciseId}/reset`);
      setSwappedExercises(prev => { const next = { ...prev }; delete next[originalExerciseId]; return next; });
      invalidateWorkout();
      fetchWorkout();
    } catch {}
  }

  async function handleAddExercise(exercise) {
    // Check against routine exercises to prevent duplicate cards sharing state
    const routineExerciseIds = new Set(
      (workout?.phases || [])
        .filter(isStrengthPhase)
        .flatMap(p => getPhaseExercises(p).map(ex => ex.id))
    );
    if (routineExerciseIds.has(exercise.id)) return;

    setAddedExercises(prev => {
      if (prev.some(e => e.id === exercise.id)) return prev;
      return [...prev, exercise];
    });
    // Fetch previous performance for the new exercise
    try {
      const data = await api.get(`/session/previous-performance?exerciseIds=${exercise.id}`);
      if (data.previousPerformance) {
        setPreviousPerformance(prev => ({ ...prev, ...data.previousPerformance }));
      }
    } catch { /* ignore */ }
  }

  // Save preference prompt
  useEffect(() => {
    if (!session.isActive || savePromptData) return;
    for (const [origId, swap] of Object.entries(swappedExercises)) {
      if (!swap._swapped_in_session) continue;
      const exerciseId = swap.chosen.id;
      if (promptedExercises.has(exerciseId)) continue;
      const exSets = session.exerciseSets[exerciseId]?.sets || [];
      if (exSets.length === 0) continue;
      for (const phase of (workout?.phases || [])) {
        const ex = getPhaseExercises(phase).find(e => e.id === exerciseId);
        if (ex) {
          const targetSets = ex.default_sets || 3;
          const completedSets = exSets.filter(s => s.completed).length;
          if (completedSets >= targetSets) {
            setPromptedExercises(prev => new Set(prev).add(exerciseId));
            setSavePromptData({ exerciseName: swap.chosen.name, originalExerciseId: parseInt(origId), chosenExerciseId: exerciseId });
          }
          break;
        }
      }
    }
  }, [session.exerciseSets, swappedExercises, workout, getPhaseExercises, session.isActive, savePromptData, promptedExercises]);

  async function handleFinish() {
    if (session.isLoading) return;
    setConfirmFinish(false);
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
    const data = await session.completeSession();
    if (data) {
      const actualDuration = Math.floor((Date.now() - phaseStartRef.current) / 1000);
      invalidateWorkout();
      onComplete({
        completed: true,
        sets: data.summary?.total_sets || session.totalSets,
        prs: data.prs?.length || 0,
        duration: actualDuration,
        summary: data.summary,
        prDetails: data.prs,
        exerciseNames: getAllExerciseNames(),
        totalVolume: session.totalVolume,
      });
    }
  }

  function getAllExerciseNames() {
    if (!workout?.phases) return [];
    const names = workout.phases
      .filter(isStrengthPhase)
      .flatMap(p => getPhaseExercises(p).map(ex => ex.name));
    return [...names, ...addedExercises.map(ex => ex.name)];
  }

  async function handleDiscard() {
    setConfirmDiscard(false);
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
    await session.discardSession();
    onComplete({ completed: false, sets: 0, prs: 0, duration: 0 });
  }

  if (loading || !workout?.phases) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>Loading workout...</div>;
  }

  if (!session.isActive) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>Starting session...</div>;
  }

  const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayName = DAY_NAMES[new Date().getDay()];

  return (
    <div style={{ paddingBottom: 40 }}>
      <SessionHeader
        elapsed={flow ? flow.elapsedSeconds : session.elapsedSeconds}
        totalVolume={session.totalVolume}
        onFinish={() => setConfirmFinish(true)}
        onDiscard={() => setConfirmDiscard(true)}
        onPause={handlePause}
        formatTime={flow ? flow.formatTime : session.formatTime}
        isFinishing={session.isLoading}
      />

      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
          color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
        }}>{dayName} &middot; MAIN WORK</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>{workout.name}</h2>
        <div style={{ fontSize: 12, color: C.textSec }}>
          {session.totalSets} sets &middot; {formatVolume(session.totalVolume)} kg &middot; {session.exercisesDone} exercises
        </div>
      </div>

      {workout.phases.map((phase, i) => {
        if (isStrengthPhase(phase)) {
          const exercises = getPhaseExercises(phase);
          return (
            <div key={phase.phase || i}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
                color: phase.color, textTransform: 'uppercase', padding: '8px 0 4px',
              }}>{phase.label}</div>
              {exercises.map(ex => {
                if (skippedExercises.has(ex.id)) {
                  return (
                    <div key={ex.id} style={{
                      background: C.card, border: C.border, borderRadius: 10,
                      marginBottom: 6, padding: '12px', opacity: 0.4,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: 13, color: C.textMuted, textDecoration: 'line-through' }}>{ex.name}</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>Skipped</span>
                    </div>
                  );
                }
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
                    onSwap={setSwapPickerExercise}
                    onReset={handleResetToDefault}
                    onSkip={() => handleSkipExercise(ex.id)}
                  />
                );
              })}
            </div>
          );
        } else {
          return (
            <PhaseCheckbox
              key={phase.phase || i}
              phase={phase}
              checked={!!completedPhases[phase.phase]}
              onToggle={() => setCompletedPhases(prev => ({ ...prev, [phase.phase]: !prev[phase.phase] }))}
            />
          );
        }
      })}

      {/* Added exercises (from + Add Exercise) */}
      {addedExercises.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', padding: '8px 0 4px',
          }}>Added</div>
          {addedExercises.map(ex => {
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
          })}
        </div>
      )}

      {/* + Add Exercise button */}
      <button
        onClick={() => setShowAddExercise(true)}
        style={{
          width: '100%', padding: '14px 16px', marginBottom: 12, marginTop: 4,
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

      {/* Finish button */}
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Finish Workout
        </button>
      </div>

      <RestTimer key={restTimerKey} duration={restDuration} endTime={restTimerEndTime}
        isActive={isRestTimerActive} onSkip={handleDismissTimer} onFinish={handleDismissTimer} onDismiss={handleDismissTimer} />

      {confirmFinish && (
        <ConfirmDialog title="Finish this workout?" message="Your session will be saved with all logged sets."
          confirmLabel="Finish" onConfirm={handleFinish} onCancel={() => setConfirmFinish(false)} />
      )}
      {confirmDiscard && (
        <ConfirmDialog title="Discard this workout?" message="All logged sets will be lost."
          confirmLabel="Discard" confirmColor="rgba(239,68,68,0.3)"
          onConfirm={handleDiscard} onCancel={() => setConfirmDiscard(false)} />
      )}
      {swapPickerExercise && workout && (
        <AlternativePicker
          exerciseId={swapPickerExercise.original_exercise_id || swapPickerExercise.id}
          workoutId={workout.phases.find(p => p.phase === 'main')?.workout_id || workout.phases[0]?.workout_id}
          onSelect={handleSwapSelect} onClose={() => setSwapPickerExercise(null)} />
      )}
      {savePromptData && (
        <SavePreferencePrompt
          exerciseName={savePromptData.exerciseName}
          originalExerciseId={savePromptData.originalExerciseId}
          chosenExerciseId={savePromptData.chosenExerciseId}
          onSave={() => setSavePromptData(null)} onDismiss={() => setSavePromptData(null)} />
      )}
      {showAddExercise && (
        <AddExerciseModal
          onAdd={handleAddExercise}
          onClose={() => setShowAddExercise(false)}
          existingExerciseIds={[
            ...(workout?.phases || []).filter(isStrengthPhase).flatMap(p => getPhaseExercises(p).map(ex => ex.id)),
            ...addedExercises.map(ex => ex.id),
          ]}
        />
      )}
      {isPaused && <PauseOverlay onResume={handleResume} />}
    </div>
  );
}

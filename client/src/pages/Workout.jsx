import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../contexts/DataProvider.jsx';
import { useWorkoutSession } from '../hooks/useWorkoutSession.js';
import { api } from '../utils/api.js';
import { C, formatVolume, isStrengthPhase, MONO } from '../components/workout/tokens.jsx';
import SessionHeader from '../components/SessionHeader.jsx';
import { PhaseCheckbox, PhaseSection, PhaseBar } from '../components/PhaseCard.jsx';
import { ExerciseSessionCard } from '../components/ExerciseCard.jsx';
import SessionSummary, { ConfirmDialog } from '../components/SessionSummary.jsx';
import RestTimer from '../components/RestTimer.jsx';
import AlternativePicker from '../components/AlternativePicker.jsx';
import SavePreferencePrompt from '../components/SavePreferencePrompt.jsx';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/* ── Resume Banner ── */
function ResumeBanner({ session, onResume, onDiscard }) {
  const startDate = new Date(session.started_at);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const time = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label = isToday ? time : `${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  return (
    <div style={{
      background: 'rgba(216,90,48,0.1)', border: '1px solid rgba(216,90,48,0.2)',
      borderRadius: 10, padding: 14, marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>
        You have an unfinished workout from {label}.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onResume} style={{
          flex: 1, padding: '10px', borderRadius: 8, border: 'none',
          background: 'rgba(216,90,48,0.2)', color: C.accent,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Resume</button>
        <button onClick={onDiscard} style={{
          flex: 1, padding: '10px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
          color: C.textMuted, fontSize: 13, cursor: 'pointer',
        }}>Discard</button>
      </div>
    </div>
  );
}

/* ── Rest Timer Settings Modal ── */
const DURATION_OPTIONS = [30, 60, 90, 120, 180, 300];

function SettingsModal({ settings, onClose, onSave }) {
  const [duration, setDuration] = useState(settings?.rest_timer_duration ?? 90);
  const [enabled, setEnabled] = useState(settings?.rest_timer_enabled ?? true);
  const [autoStart, setAutoStart] = useState(settings?.rest_timer_auto_start ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put('/settings', {
        rest_timer_duration: duration,
        rest_timer_enabled: enabled,
        rest_timer_auto_start: autoStart,
      });
      onSave(updated);
    } catch {
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function Toggle({ value, onChange }) {
    return (
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
          background: value ? 'rgba(29,158,117,0.4)' : 'rgba(255,255,255,0.1)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 10,
          background: value ? C.green : 'rgba(255,255,255,0.3)',
          position: 'absolute', top: 2,
          left: value ? 22 : 2,
          transition: 'left 0.2s, background 0.2s',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'rgba(20,28,50,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 }}>
          Rest Timer Settings
        </div>

        {/* Duration */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textSec, marginBottom: 8 }}>Duration</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DURATION_OPTIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)} style={{
                padding: '8px 12px', borderRadius: 8, border: 'none',
                background: d === duration ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.06)',
                color: d === duration ? C.green : C.textSec,
                fontSize: 13, fontFamily: MONO, fontWeight: 500, cursor: 'pointer',
              }}>
                {d >= 60 ? `${d / 60}m` : `${d}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Enabled */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.text }}>Rest timer</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Show timer between sets</div>
          </div>
          <Toggle value={enabled} onChange={setEnabled} />
        </div>

        {/* Auto-start */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.text }}>Auto-start</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Start timer after each set</div>
          </div>
          <Toggle value={autoStart} onChange={setAutoStart} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: C.textSec, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: 'none',
            background: 'rgba(29,158,117,0.2)', color: C.green,
            fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Today's Workout View ── */
function TodayView({ onLogout }) {
  const { workoutData: workout, workoutLoading: loading, fetchWorkout, invalidateWorkout } = useData();
  const [expandedId, setExpandedId] = useState(null);
  const [completedPhases, setCompletedPhases] = useState({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [startDisabled, setStartDisabled] = useState(false);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [restTimerKey, setRestTimerKey] = useState(0);
  const [userSettings, setUserSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [previousPerformance, setPreviousPerformance] = useState({});
  const [restTimerEndTime, setRestTimerEndTime] = useState(null);
  const [swapPickerExercise, setSwapPickerExercise] = useState(null); // exercise to show picker for
  const [swappedExercises, setSwappedExercises] = useState({}); // { originalExId: { chosen, originalExId } } — session-level swaps
  const [savePromptData, setSavePromptData] = useState(null); // { exerciseName, originalExerciseId, chosenExerciseId }
  const [promptedExercises, setPromptedExercises] = useState(new Set());
  const restTimerActivatedAtRef = useRef(null);

  const session = useWorkoutSession();

  const restDuration = userSettings?.rest_timer_duration ?? 90;
  const restEnabled = userSettings?.rest_timer_enabled ?? true;
  const restAutoStart = userSettings?.rest_timer_auto_start ?? true;

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  useEffect(() => {
    session.checkActiveSession();
  }, [session.checkActiveSession]);

  // Fetch user settings for rest timer
  useEffect(() => {
    api.get('/settings').then(setUserSettings).catch(() => {});
  }, []);

  // Restore rest timer after tab switch
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
    if (!session.isActive) {
      restoredTimerRef.current = false;
    }
  }, [session.isActive]);

  // Fetch previous performance data for all exercises in the workout
  const fetchPreviousPerformance = useCallback(async () => {
    if (!workout?.phases) return;
    const exerciseIds = workout.phases
      .filter(isStrengthPhase)
      .flatMap(p => p.exercises.map(ex => ex.id));
    if (exerciseIds.length === 0) return;
    try {
      const data = await api.get(`/session/previous-performance?exerciseIds=${exerciseIds.join(',')}`);
      setPreviousPerformance(data.previousPerformance || {});
    } catch {
      setPreviousPerformance({});
    }
  }, [workout]);

  // Fetch previous performance when session becomes active
  useEffect(() => {
    if (session.isActive && workout?.phases) {
      fetchPreviousPerformance();
    }
  }, [session.isActive, fetchPreviousPerformance]);

  async function handleStart() {
    if (!workout || !workout.phases || startDisabled) return;
    setStartDisabled(true);
    try {
      const workoutIds = workout.phases.map(p => p.workout_id).filter(Boolean);
      await session.startSession(workoutIds[0], workoutIds);
    } finally {
      setStartDisabled(false);
    }
  }

  // Helper: get exercises for a phase, with session-level swaps applied
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

  // Check if this is the last set of the last exercise in the main (strength) phase
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
      // Trigger rest timer if enabled and not the last set of the last exercise
      if (restEnabled && restAutoStart && !isLastSetOfLastExercise(exerciseId, setData)) {
        const endTime = Date.now() + restDuration * 1000;
        setRestTimerEndTime(endTime);
        sessionStorage.setItem('dailyforge_rest_timer_end', String(endTime));
        setRestTimerKey(k => k + 1);
        restTimerActivatedAtRef.current = Date.now();
        setIsRestTimerActive(true);
      }
      // Don't auto-scroll or focus — on mobile this causes the page to jump
      // and the keyboard to reopen unexpectedly
    }
    return result;
  }

  function handleDismissTimer() {
    // Ignore dismiss calls within 500ms of activation to prevent
    // accidental double-taps from immediately killing the timer
    const elapsed = Date.now() - (restTimerActivatedAtRef.current || 0);
    if (elapsed < 500) return;
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
  }

  // --- Exercise Swap Handlers ---
  function handleOpenSwapPicker(exercise) {
    // Use original_exercise_id if this exercise was already swapped via saved pref
    setSwapPickerExercise(exercise);
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
      // Remove from session swaps too
      setSwappedExercises(prev => {
        const next = { ...prev };
        delete next[originalExerciseId];
        return next;
      });
      // Refresh workout data to get defaults back
      invalidateWorkout();
      fetchWorkout();
    } catch {
      // Network or server error — leave state unchanged
    }
  }

  // Show save-preference prompt when all sets of a session-swapped exercise complete
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
            setSavePromptData({
              exerciseName: swap.chosen.name,
              originalExerciseId: parseInt(origId),
              chosenExerciseId: exerciseId,
            });
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
      setPreviousPerformance({});
      setSummaryData(data);
      invalidateWorkout();
    }
  }

  async function handleDiscard() {
    setConfirmDiscard(false);
    setIsRestTimerActive(false);
    setRestTimerEndTime(null);
    sessionStorage.removeItem('dailyforge_rest_timer_end');
    setPreviousPerformance({});
    await session.discardSession();
  }

  async function handleDiscardResume() {
    sessionStorage.removeItem('dailyforge_rest_timer_end');
    await session.dismissResume();
  }

  function toggleExpand(id) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <div>
        <div style={{ height: 10, width: 80, borderRadius: 4, background: C.card, marginBottom: 8 }} />
        <div style={{ height: 20, width: 160, borderRadius: 6, background: C.card, marginBottom: 6 }} />
        <div style={{ height: 14, width: 120, borderRadius: 4, background: C.card, marginBottom: 24 }} />
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 64, borderRadius: 10, background: C.card, marginBottom: 6 }} />
        ))}
      </div>
    );
  }

  /* ─── Rest day ─── */
  if (!workout || !workout.phases || workout.phases.length === 0) {
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>
          {dayName}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>Rest Day</h2>
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.textSec }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 18a5 5 0 00-10 0" /><line x1="12" y1="9" x2="12" y2="2" />
              <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" /><line x1="1" y1="18" x2="3" y2="18" />
              <line x1="21" y1="18" x2="23" y2="18" /><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
            </svg>
          </div>
          <p style={{ fontSize: 14 }}>No workout scheduled for today.</p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Recovery is part of the process.</p>
        </div>
      </div>
    );
  }

  const totalDuration = workout.phases.reduce((s, p) => s + p.duration_min, 0);
  const totalExercises = workout.phases.reduce((s, p) => s + p.exercises.length, 0);

  /* ─── ACTIVE SESSION MODE ─── */
  if (session.isActive) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <SessionHeader
          elapsed={session.elapsedSeconds}
          totalVolume={session.totalVolume}
          onFinish={() => setConfirmFinish(true)}
          onDiscard={() => setConfirmDiscard(true)}
          onSettings={() => setShowSettings(true)}
          formatTime={session.formatTime}
          isFinishing={session.isLoading}
        />

        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
          }}>{dayName}</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>
            {workout.name}
          </h2>
          <div style={{ fontSize: 12, color: C.textSec }}>
            {session.totalSets} sets &middot; {formatVolume(session.totalVolume)} kg &middot; {session.exercisesDone} exercises
          </div>
        </div>

        {/* Phases */}
        {workout.phases.map((phase, i) => {
          if (isStrengthPhase(phase)) {
            const exercises = getPhaseExercises(phase);
            return (
              <div key={phase.phase || i}>
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
                  color: phase.color, textTransform: 'uppercase',
                  padding: '8px 0 4px',
                }}>
                  {phase.label}
                </div>
                {exercises.map(ex => {
                  const exSets = session.exerciseSets[ex.id]?.sets || [];
                  return (
                    <ExerciseSessionCard
                      key={ex.id}
                      exercise={ex}
                      sets={exSets}
                      previousData={previousPerformance[ex.id] || null}
                      onLogSet={handleLogSet}
                      onInputFocus={handleDismissTimer}
                      onSwap={handleOpenSwapPicker}
                      onReset={handleResetToDefault}
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
                onToggle={() => setCompletedPhases(prev => ({
                  ...prev, [phase.phase]: !prev[phase.phase],
                }))}
              />
            );
          }
        })}

        {/* Finish Workout button (sticky at bottom) */}
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

        {/* Confirm finish dialog */}
        {confirmFinish && (
          <ConfirmDialog
            title="Finish this workout?"
            message="Your session will be saved with all logged sets."
            confirmLabel="Finish"
            onConfirm={handleFinish}
            onCancel={() => setConfirmFinish(false)}
          />
        )}

        {/* Confirm discard dialog */}
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

        {/* Summary card */}
        {summaryData && (
          <SessionSummary
            data={summaryData}
            onDone={() => setSummaryData(null)}
          />
        )}

        {/* Alternative Picker (active session mode — swap in UI only) */}
        {swapPickerExercise && workout && (
          <AlternativePicker
            exerciseId={swapPickerExercise.original_exercise_id || swapPickerExercise.id}
            workoutId={workout.phases.find(p => p.phase === 'main')?.workout_id || workout.phases[0]?.workout_id}
            onSelect={handleSwapSelect}
            onClose={() => setSwapPickerExercise(null)}
          />
        )}

        {/* Save Preference Prompt (after completing swapped exercise) */}
        {savePromptData && (
          <SavePreferencePrompt
            exerciseName={savePromptData.exerciseName}
            originalExerciseId={savePromptData.originalExerciseId}
            chosenExerciseId={savePromptData.chosenExerciseId}
            onSave={() => setSavePromptData(null)}
            onDismiss={() => setSavePromptData(null)}
          />
        )}
      </div>
    );
  }

  /* ─── VIEW MODE (no active session) ─── */
  return (
    <div>
      {/* Resume banner */}
      {session.resumeData && (
        <ResumeBanner
          session={session.resumeData.session}
          onResume={session.resumeSession}
          onDiscard={handleDiscardResume}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
          }}>{dayName}</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>
            {workout.name}
          </h2>
          <div style={{ fontSize: 12, color: C.textSec }}>
            {totalDuration} min &middot; {totalExercises} exercises
          </div>
        </div>
        {onLogout && (
          <button onClick={onLogout} style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: C.textMuted,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Phase Bar */}
      <PhaseBar phases={workout.phases} />

      {/* Phase Sections */}
      {workout.phases.map((phase, i) => (
        <PhaseSection
          key={phase.phase || i}
          phase={phase}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
          onSwap={handleOpenSwapPicker}
          onReset={handleResetToDefault}
        />
      ))}

      {/* Start Workout (sticky at bottom) */}
      <div style={{
        position: 'sticky', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))', zIndex: 15, paddingTop: 12,
      }}>
        <button
          onClick={handleStart}
          disabled={startDisabled}
          style={{
            width: '100%', padding: '16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 16, fontWeight: 600, cursor: startDisabled ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            backdropFilter: 'blur(8px)',
            opacity: startDisabled ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          {startDisabled ? (
            <>Starting...</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Start Workout
            </>
          )}
        </button>
      </div>

      {/* Summary card (shows after completing via summary) */}
      {summaryData && (
        <SessionSummary data={summaryData} onDone={() => setSummaryData(null)} />
      )}

      {/* Alternative Picker Bottom Sheet */}
      {swapPickerExercise && workout && (
        <AlternativePicker
          exerciseId={swapPickerExercise.original_exercise_id || swapPickerExercise.id}
          workoutId={workout.phases.find(p => p.phase === 'main')?.workout_id || workout.phases[0]?.workout_id}
          onSelect={async (alt) => {
            const originalId = swapPickerExercise.original_exercise_id || swapPickerExercise.id;
            setSwapPickerExercise(null);
            // In view mode, save preference immediately
            try {
              await api.put(`/workout/slot/${originalId}/choose`, { chosen_exercise_id: alt.id });
              invalidateWorkout();
              fetchWorkout();
            } catch {
              // Network or server error — no action needed
            }
          }}
          onClose={() => setSwapPickerExercise(null)}
        />
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function Workout({ onLogout }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
      <TodayView onLogout={onLogout} />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api.js';

const LS_KEY = 'dailyforge_active_session';

function saveToStorage(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

function clearStorage() {
  localStorage.removeItem(LS_KEY);
}

export function useWorkoutSession() {
  const [sessionId, setSessionId] = useState(null);
  const [workoutId, setWorkoutId] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [exerciseSets, setExerciseSets] = useState({}); // { [exerciseId]: { sets: [...] } }
  const [totalSets, setTotalSets] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [exercisesDone, setExercisesDone] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [resumeData, setResumeData] = useState(null); // set when an unfinished session is found
  const [sessionPrs, setSessionPrs] = useState({}); // { [exerciseId]: { [setNumber]: [{ type, previous, new }] } }
  const timerRef = useRef(null);
  const loadingRef = useRef(false); // ref-based guard to prevent stale-closure double-taps
  const pendingSets = useRef(new Set()); // per-set concurrency guard
  const sessionIdRef = useRef(null); // avoids stale-closure reads of sessionId

  // Keep sessionIdRef in sync with state
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Timer: calculate from startedAt, not from ticks
  useEffect(() => {
    if (!isActive || !startedAt) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    function tick() {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsedSeconds(Math.max(0, elapsed));
    }

    tick(); // immediate
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [isActive, startedAt]);

  // Persist to localStorage on state changes
  useEffect(() => {
    if (isActive && sessionId) {
      saveToStorage({ sessionId, workoutId, startedAt, exerciseSets });
    }
  }, [isActive, sessionId, workoutId, startedAt, exerciseSets]);

  // Recalculate local totals from exerciseSets
  const recalcTotals = useCallback((sets) => {
    let tSets = 0, tVol = 0;
    const exerciseIds = new Set();
    for (const [exId, data] of Object.entries(sets)) {
      for (const s of data.sets) {
        if (s.completed) {
          tSets++;
          tVol += (s.weight || 0) * (s.reps || 0);
          exerciseIds.add(exId);
        }
      }
    }
    setTotalSets(tSets);
    setTotalVolume(tVol);
    setExercisesDone(exerciseIds.size);
  }, []);

  // Check for active session on mount
  const checkActiveSession = useCallback(async () => {
    try {
      const data = await api.get('/session/active');

      if (data.session) {
        // There's an active session on the server
        const sets = {};
        for (const s of data.logged_sets) {
          if (s.set_number == null) continue; // skip non-logged placeholder rows
          const exId = s.exercise_id;
          if (!sets[exId]) sets[exId] = { sets: [] };
          sets[exId].sets.push({
            set_number: s.set_number,
            weight: s.weight != null ? parseFloat(s.weight) : null,
            reps: s.reps != null ? parseInt(s.reps) : null,
            rpe: s.rpe != null ? parseFloat(s.rpe) : null,
            set_type: s.set_type || 'normal',
            completed: s.completed || false,
          });
        }
        // Sort sets within each exercise
        for (const exId of Object.keys(sets)) {
          sets[exId].sets.sort((a, b) => a.set_number - b.set_number);
        }

        setResumeData({
          session: data.session,
          exerciseSets: sets,
        });
      } else {
        // No active session on server — clear stale localStorage
        clearStorage();
        setResumeData(null);
      }
    } catch (err) {
      console.error('Failed to check active session:', err);
    }
  }, []);

  // Resume the found session
  const resumeSession = useCallback(() => {
    if (!resumeData) return;
    const { session, exerciseSets: sets } = resumeData;
    setSessionId(session.id);
    setWorkoutId(session.workout_id);
    setStartedAt(session.started_at);
    setIsActive(true);
    setExerciseSets(sets);
    recalcTotals(sets);
    setResumeData(null);
  }, [resumeData, recalcTotals]);

  // Dismiss resume prompt (discard)
  const dismissResume = useCallback(async () => {
    if (!resumeData) return;
    try {
      await api.delete(`/session/${resumeData.session.id}`);
    } catch (err) {
      console.error('Failed to discard session:', err);
    }
    clearStorage();
    setResumeData(null);
  }, [resumeData]);

  // Start a new session
  const startSession = useCallback(async (wId, workoutIds) => {
    if (loadingRef.current) return null;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const data = await api.post('/session/start', {
        workout_id: wId,
        workout_ids: workoutIds,
        type: 'strength',
      });
      const session = data.session;
      setSessionId(session.id);
      setWorkoutId(session.workout_id);
      setStartedAt(session.started_at);
      setIsActive(true);
      setExerciseSets({});
      setTotalSets(0);
      setTotalVolume(0);
      setExercisesDone(0);
      setSessionPrs({});
      return session;
    } catch (err) {
      console.error('Failed to start session:', err);
      return null;
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Log a single set
  const logSet = useCallback(async (exerciseId, setData) => {
    const sid = sessionIdRef.current;
    if (!sid) return null;
    const key = `${exerciseId}-${setData.set_number}`;
    if (pendingSets.current.has(key)) return null;
    pendingSets.current.add(key);
    try {
      const data = await api.put(`/session/${sid}/log-set`, {
        exercise_id: exerciseId,
        set_number: setData.set_number,
        weight: setData.weight,
        reps: setData.reps,
        rpe: setData.rpe || null,
        set_type: setData.set_type || 'normal',
      });

      // Update local state
      setExerciseSets(prev => {
        const exSets = prev[exerciseId]?.sets || [];
        const idx = exSets.findIndex(s => s.set_number === setData.set_number);
        const newSet = {
          set_number: setData.set_number,
          weight: setData.weight,
          reps: setData.reps,
          rpe: setData.rpe || null,
          set_type: setData.set_type || 'normal',
          completed: true,
        };
        const newSets = [...exSets];
        if (idx >= 0) {
          newSets[idx] = newSet;
        } else {
          newSets.push(newSet);
          newSets.sort((a, b) => a.set_number - b.set_number);
        }
        return { ...prev, [exerciseId]: { sets: newSets } };
      });

      // Update totals from server response
      if (data.session_totals) {
        setTotalSets(data.session_totals.total_sets);
        setTotalVolume(data.session_totals.total_volume);
        setExercisesDone(data.session_totals.exercises_done);
      }

      // Track PRs from this set (always update — clear stale PRs on re-log)
      setSessionPrs(prev => {
        const exPrs = { ...prev[exerciseId] };
        if (data.prs && data.prs.length > 0) {
          exPrs[setData.set_number] = data.prs;
        } else {
          delete exPrs[setData.set_number];
        }
        if (Object.keys(exPrs).length === 0) {
          const next = { ...prev };
          delete next[exerciseId];
          return next;
        }
        return { ...prev, [exerciseId]: exPrs };
      });

      return data;
    } catch (err) {
      console.error('Failed to log set:', err);
      return null;
    } finally {
      pendingSets.current.delete(key);
    }
  }, []);

  // Complete the session
  const completeSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || loadingRef.current) return null;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const data = await api.put(`/session/${sid}/complete`);
      setSessionId(null);
      setWorkoutId(null);
      setIsActive(false);
      setStartedAt(null);
      setElapsedSeconds(0);
      setExerciseSets({});
      setTotalSets(0);
      setTotalVolume(0);
      setExercisesDone(0);
      setSessionPrs({});
      clearStorage();
      return data;
    } catch (err) {
      console.error('Failed to complete session:', err);
      return null;
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Discard active session
  const discardSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await api.delete(`/session/${sid}`);
    } catch (err) {
      console.error('Failed to discard session:', err);
    }
    setSessionId(null);
    setWorkoutId(null);
    setIsActive(false);
    setStartedAt(null);
    setElapsedSeconds(0);
    setExerciseSets({});
    setTotalSets(0);
    setTotalVolume(0);
    setExercisesDone(0);
    setSessionPrs({});
    clearStorage();
  }, []);

  // Format elapsed time
  const formatTime = useCallback((secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }, []);

  return {
    // State
    sessionId,
    workoutId,
    isActive,
    startedAt,
    elapsedSeconds,
    exerciseSets,
    totalSets,
    totalVolume,
    exercisesDone,
    isLoading,
    resumeData,
    sessionPrs,

    // Actions
    checkActiveSession,
    startSession,
    logSet,
    completeSession,
    discardSession,
    resumeSession,
    dismissResume,
    formatTime,
  };
}

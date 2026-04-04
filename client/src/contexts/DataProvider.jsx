import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../utils/api.js';

const STALE_MS = 5 * 60 * 1000; // 5 minutes

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [workoutData, setWorkoutData] = useState(null);
  const [workoutLoading, setWorkoutLoading] = useState(true);
  const fetchedAtRef = useRef(null);
  const fetchingRef = useRef(false);

  const isFresh = useCallback(() => {
    return fetchedAtRef.current && (Date.now() - fetchedAtRef.current < STALE_MS);
  }, []);

  const fetchWorkout = useCallback(async (force = false) => {
    if (!force && isFresh() && workoutData !== null) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const data = await api.get('/workout/today');
      setWorkoutData(data);
      fetchedAtRef.current = Date.now();
    } catch {
      // On error, keep existing data if available
      if (workoutData === null) setWorkoutData(null);
    } finally {
      setWorkoutLoading(false);
      fetchingRef.current = false;
    }
  }, [isFresh, workoutData]);

  const invalidateWorkout = useCallback(() => {
    fetchedAtRef.current = null;
    fetchWorkout(true);
  }, [fetchWorkout]);

  // Refetch when app returns from background after 5+ minutes
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && !isFresh()) {
        fetchWorkout(true);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchWorkout, isFresh]);

  return (
    <DataContext.Provider value={{
      workoutData,
      workoutLoading,
      fetchWorkout,
      invalidateWorkout,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

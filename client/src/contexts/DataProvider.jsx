import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
    if (!force && isFresh()) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const data = await api.get('/workout/today');
      setWorkoutData(data);
      fetchedAtRef.current = Date.now();
    } catch {
      // Keep existing cached data on error; loading state still clears in finally
    } finally {
      setWorkoutLoading(false);
      fetchingRef.current = false;
    }
  }, [isFresh]);

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

  const value = useMemo(() => ({
    workoutData,
    workoutLoading,
    fetchWorkout,
    invalidateWorkout,
  }), [workoutData, workoutLoading, fetchWorkout, invalidateWorkout]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

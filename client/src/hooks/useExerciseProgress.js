import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api.js';

// Fetches progression detail for a single exercise.
//
// type is an optional hint ('strength' | 'yoga' | 'breathwork') — breathwork ids
// live in a separate namespace (breathwork_techniques) so the hint is required
// for breathwork lookups.
//
// W2: stale fetches are cancelled via an epoch counter. When the user toggles
// the range (30d → 90d → all) quickly, only the most recent request is allowed
// to update state — earlier in-flight responses are dropped even if they
// resolve last.
export function useExerciseProgress(exerciseId, range = '30d', type = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refetch = useCallback(() => {
    if (!exerciseId) return;
    const myId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ range });
    if (type) qs.set('type', type);
    api.get(`/progress/exercise/${exerciseId}?${qs.toString()}`)
      .then((result) => {
        if (requestIdRef.current !== myId) return; // stale, ignore
        setData(result);
      })
      .catch((err) => {
        if (requestIdRef.current !== myId) return; // stale, ignore
        setError(err.message || 'Failed to load progress');
      })
      .finally(() => {
        if (requestIdRef.current !== myId) return; // stale, ignore
        setLoading(false);
      });
  }, [exerciseId, range, type]);

  useEffect(() => {
    refetch();
    // On unmount, bumping the counter invalidates any in-flight response.
    return () => { requestIdRef.current++; };
  }, [refetch]);

  return { data, loading, error, refetch };
}

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Timestamp-based pausable timer. All elapsed calculations derive from
 * Date.now() anchors, so re-renders never drift or reset the count.
 *
 * Usage:
 *   const timer = usePausableTimer({ autoStart: true });
 *   timer.pause();   // freezes elapsed
 *   timer.resume();  // continues from where it left off
 *   timer.reset();   // back to 0, stopped
 *
 * Returns { elapsed, state, start, pause, resume, reset }
 *   state: 'idle' | 'running' | 'paused'
 *
 * Legacy compat (read-only):
 *   isRunning = state !== 'idle'  (timer is active — running or paused)
 *   isPaused  = state === 'paused'
 */
export function usePausableTimer({ autoStart = false } = {}) {
  // Accumulated seconds before the current running segment
  const accumulatedRef = useRef(0);
  // Timestamp when the current running segment started (null = not ticking)
  const segmentStartRef = useRef(null);

  const [elapsed, setElapsed] = useState(0);
  const [timerState, setTimerState] = useState('idle'); // 'idle' | 'running' | 'paused'

  // Compute elapsed = accumulated + (now - segmentStart)
  const computeElapsed = useCallback(() => {
    if (segmentStartRef.current === null) return accumulatedRef.current;
    return accumulatedRef.current + Math.floor((Date.now() - segmentStartRef.current) / 1000);
  }, []);

  const start = useCallback(() => {
    accumulatedRef.current = 0;
    segmentStartRef.current = Date.now();
    setElapsed(0);
    setTimerState('running');
  }, []);

  const pause = useCallback(() => {
    if (segmentStartRef.current !== null) {
      accumulatedRef.current += Math.floor((Date.now() - segmentStartRef.current) / 1000);
      segmentStartRef.current = null;
    }
    setElapsed(accumulatedRef.current);
    setTimerState('paused');
  }, []);

  const resume = useCallback(() => {
    segmentStartRef.current = Date.now();
    setTimerState('running');
  }, []);

  const reset = useCallback(() => {
    accumulatedRef.current = 0;
    segmentStartRef.current = null;
    setElapsed(0);
    setTimerState('idle');
  }, []);

  // Tick interval — only runs when actively counting
  useEffect(() => {
    if (timerState !== 'running') return;
    if (segmentStartRef.current === null) {
      segmentStartRef.current = Date.now();
    }
    const id = setInterval(() => {
      setElapsed(computeElapsed());
    }, 250);
    return () => clearInterval(id);
  }, [timerState, computeElapsed]);

  // Auto-start on mount if requested
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      start();
    }
  }, [autoStart, start]);

  return {
    elapsed,
    state: timerState,
    // Legacy compat — derived booleans
    isRunning: timerState !== 'idle',
    isPaused: timerState === 'paused',
    start,
    pause,
    resume,
    reset,
  };
}

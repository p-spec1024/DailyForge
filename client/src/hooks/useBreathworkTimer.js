import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

function phaseLabel(type) {
  if (type === 'inhale') return 'Inhale';
  if (type === 'exhale') return 'Exhale';
  if (type === 'hold_in' || type === 'hold_out' || type === 'hold') return 'Hold';
  if (type === 'pause') return 'Pause';
  return type;
}

function phaseKey(type) {
  if (type === 'inhale') return 'inhale';
  if (type === 'exhale') return 'exhale';
  return 'hold';
}

export function useBreathworkTimer(protocol) {
  const rawPhases = protocol?.phases;
  const totalRounds = protocol?.cycles || 1;

  // Stabilize phases reference — only recompute when the source array changes
  const phases = useMemo(
    () => (rawPhases || []).filter((p) => p.duration > 0),
    [rawPhases],
  );

  const [state, setState] = useState({
    currentPhaseIndex: 0,
    currentRound: 1,
    secondsRemaining: phases[0]?.duration || 0,
    totalElapsed: 0,
    isRunning: false,
    isComplete: false,
  });

  const intervalRef = useRef(null);
  // Store phases in a ref so the interval callback always reads the latest
  const phasesRef = useRef(phases);
  phasesRef.current = phases;

  // Haptic + audio feedback on phase transition.
  // navigator.vibrate() is unsupported on iOS Safari.
  // Fallback: AudioContext beep. iOS requires AudioContext to be created/resumed
  // during a user gesture — call initAudio() from the start button's click handler.
  const audioCtxRef = useRef(null);

  const initAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch {}
  }, []);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    // Audio beep (AudioContext must already be unlocked via initAudio)
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }, []);

  useEffect(() => {
    if (!state.isRunning || state.isComplete) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev.isRunning || prev.isComplete) return prev;

        const p = phasesRef.current;
        const next = { ...prev, totalElapsed: prev.totalElapsed + 1 };

        const phaseDuration = p[prev.currentPhaseIndex]?.duration || 1;
        const decrement = phaseDuration < 1 ? phaseDuration : 1;

        next.secondsRemaining = Math.max(0, +(prev.secondsRemaining - decrement).toFixed(2));

        if (next.secondsRemaining <= 0) {
          triggerHaptic();
          let nextPhaseIndex = prev.currentPhaseIndex + 1;
          let nextRound = prev.currentRound;

          if (nextPhaseIndex >= p.length) {
            nextPhaseIndex = 0;
            nextRound = prev.currentRound + 1;

            if (nextRound > totalRounds) {
              return { ...next, isComplete: true, isRunning: false, secondsRemaining: 0 };
            }
          }

          next.currentPhaseIndex = nextPhaseIndex;
          next.currentRound = nextRound;
          next.secondsRemaining = p[nextPhaseIndex].duration;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [state.isRunning, state.isComplete, totalRounds, triggerHaptic]);

  const start = useCallback(() => {
    initAudio(); // Unlock AudioContext during user gesture (critical for iOS)
    const p = phasesRef.current;
    setState((prev) => ({
      ...prev,
      isRunning: true,
      secondsRemaining: prev.secondsRemaining || p[0]?.duration || 0,
    }));
  }, [initAudio]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const stop = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const currentPhaseData = phases[state.currentPhaseIndex] || { type: 'inhale', duration: 4 };

  return {
    currentPhase: {
      ...currentPhaseData,
      label: phaseLabel(currentPhaseData.type),
      key: phaseKey(currentPhaseData.type),
    },
    currentRound: state.currentRound,
    totalRounds,
    secondsRemaining: state.secondsRemaining,
    totalElapsed: state.totalElapsed,
    isRunning: state.isRunning,
    isComplete: state.isComplete,
    initAudio,
    start,
    pause,
    resume,
    stop,
  };
}

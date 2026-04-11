import { useState, useCallback, useRef, useEffect } from 'react';
import { usePausableTimer } from './usePausableTimer.js';

const PHASES = ['overview', 'opening_breathwork', 'warmup', 'main_work', 'cooldown', 'closing_breathwork', 'summary'];

const ACTIVE_PHASES = PHASES.filter(p => p !== 'overview' && p !== 'summary');

export function useSessionFlow() {
  const [currentPhase, setCurrentPhase] = useState('overview');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [skippedPhases, setSkippedPhases] = useState([]);
  const [phaseConfig, setPhaseConfig] = useState({
    opening_breathwork: { technique_id: null, technique_name: '', duration: 300 },
    warmup: { duration: 300, level: 'beginner', focus: [] },
    cooldown: { duration: 300, level: 'beginner', focus: [] },
    closing_breathwork: { technique_id: null, technique_name: '', duration: 300 },
  });
  const [phaseResults, setPhaseResults] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [sessionType, setSessionType] = useState('strength');
  const [phaseBanner, setPhaseBanner] = useState(null);
  const bannerTimerRef = useRef(null);

  // Single shared pausable timer for session elapsed time
  const sessionTimer = usePausableTimer();

  const getActivePhases = useCallback(() => {
    return ACTIVE_PHASES.filter(p => !skippedPhases.includes(p));
  }, [skippedPhases]);

  const toggleSkipPhase = useCallback((phase) => {
    setSkippedPhases(prev =>
      prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]
    );
  }, []);

  const updatePhaseConfig = useCallback((phase, config) => {
    setPhaseConfig(prev => ({ ...prev, [phase]: { ...prev[phase], ...config } }));
  }, []);

  const recordPhaseResult = useCallback((phase, result) => {
    setPhaseResults(prev => ({ ...prev, [phase]: result }));
  }, []);

  // Start the session flow
  const beginSession = useCallback(() => {
    setStartedAt(Date.now());
    sessionTimer.start();
    const active = ACTIVE_PHASES.filter(p => !skippedPhases.includes(p));
    if (active.length > 0) {
      setCurrentPhase(active[0]);
      setPhaseIndex(PHASES.indexOf(active[0]));
    }
  }, [skippedPhases, sessionTimer]);

  // Get next non-skipped phase
  const getNextPhase = useCallback(() => {
    const active = ACTIVE_PHASES.filter(p => !skippedPhases.includes(p));
    const currentIdx = active.indexOf(currentPhase);
    if (currentIdx < 0 || currentIdx >= active.length - 1) return null;
    return active[currentIdx + 1];
  }, [currentPhase, skippedPhases]);

  const PHASE_LABELS = {
    opening_breathwork: 'Opening Breathwork',
    warmup: 'Warm-up',
    main_work: 'Main Work',
    cooldown: 'Cool-down',
    closing_breathwork: 'Closing Breathwork',
  };

  const PHASE_ICONS = {
    opening_breathwork: '\uD83E\uDEC1',
    warmup: '\uD83E\uDDD8',
    main_work: '\uD83D\uDCAA',
    cooldown: '\uD83E\uDDD8',
    closing_breathwork: '\uD83E\uDEC1',
  };

  // Complete current phase and go directly to next
  const completePhase = useCallback((result) => {
    if (result) {
      setPhaseResults(prev => ({ ...prev, [currentPhase]: result }));
    }

    const next = (() => {
      const active = ACTIVE_PHASES.filter(p => !skippedPhases.includes(p));
      const currentIdx = active.indexOf(currentPhase);
      if (currentIdx < 0 || currentIdx >= active.length - 1) return null;
      return active[currentIdx + 1];
    })();

    if (!next) {
      setCurrentPhase('summary');
      setPhaseIndex(PHASES.indexOf('summary'));
      return;
    }

    // Go directly to next phase, show a brief banner
    setCurrentPhase(next);
    setPhaseIndex(PHASES.indexOf(next));
    setPhaseBanner({ phase: next, label: PHASE_LABELS[next] || next });
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setPhaseBanner(null), 2500);
  }, [currentPhase, skippedPhases]);

  // Pause/resume delegates to sessionTimer
  const pauseSession = useCallback(() => {
    sessionTimer.pause();
  }, [sessionTimer]);

  const resumeSession = useCallback(() => {
    sessionTimer.resume();
  }, [sessionTimer]);

  // Format time helper
  const formatTime = useCallback((secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }, []);

  // Total duration from all phase results
  const getTotalDuration = useCallback(() => {
    return Object.values(phaseResults).reduce((sum, r) => sum + (r.duration || 0), 0);
  }, [phaseResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  return {
    // State
    currentPhase,
    phaseIndex,
    skippedPhases,
    phaseConfig,
    phaseResults,
    sessionId,
    startedAt,
    sessionType,
    elapsedSeconds: sessionTimer.elapsed,
    isPaused: sessionTimer.isPaused,
    phaseBanner,

    // Constants
    PHASES,
    ACTIVE_PHASES,
    PHASE_LABELS,
    PHASE_ICONS,

    // Actions
    setSessionType,
    setSessionId,
    toggleSkipPhase,
    updatePhaseConfig,
    recordPhaseResult,
    beginSession,
    completePhase,
    getActivePhases,
    getNextPhase,
    pauseSession,
    resumeSession,
    formatTime,
    getTotalDuration,
  };
}

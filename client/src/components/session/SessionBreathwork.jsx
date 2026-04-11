import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../utils/api.js';
import { C, MONO } from '../workout/tokens.jsx';
import { useBreathworkTimer } from '../../hooks/useBreathworkTimer.js';
import { usePausableTimer } from '../../hooks/usePausableTimer.js';
import BreathCircle from '../breathwork/BreathCircle.jsx';
import TimerControls from '../breathwork/TimerControls.jsx';

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SILENT_SIT_DURATION = 60; // seconds

// Fix Issue 2: SilentSit uses usePausableTimer (timestamp-based, no re-render resets)
// Fix Issue 2: onFinish stored in ref so the effect has zero deps
function SilentSit({ onFinish }) {
  const timer = usePausableTimer({ autoStart: true });
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const autoFinishedRef = useRef(false);

  useEffect(() => {
    if (timer.elapsed >= SILENT_SIT_DURATION && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      onFinishRef.current();
    }
  }, [timer.elapsed]);

  const remaining = Math.max(0, SILENT_SIT_DURATION - timer.elapsed);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100vh - 160px)',
      background: '#060e1a',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '2px',
        color: 'rgba(167,139,250,0.6)', textTransform: 'uppercase', marginBottom: 16,
      }}>SILENT SIT</div>
      <div style={{
        fontSize: 48, fontFamily: MONO, fontWeight: 300,
        color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums',
        marginBottom: 8,
      }}>{formatElapsed(timer.elapsed)}</div>
      <div style={{
        fontSize: 12, fontFamily: MONO, color: 'rgba(255,255,255,0.25)',
        fontVariantNumeric: 'tabular-nums', marginBottom: 32,
      }}>{remaining}s remaining</div>
      <div style={{
        fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 40,
        textAlign: 'center', maxWidth: 260, lineHeight: 1.5,
      }}>
        Sit quietly. Let the breath return to its natural rhythm.
      </div>
      <button onClick={() => onFinishRef.current()} style={{
        padding: '14px 48px', borderRadius: 10,
        background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
        color: '#a78bfa', fontSize: 14, fontWeight: 600, cursor: 'pointer',
      }}>End Early</button>
    </div>
  );
}

// Sound toggle icon button
function SoundToggle({ enabled, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: enabled ? '#a78bfa' : C.textMuted, padding: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} title={enabled ? 'Mute sounds' : 'Unmute sounds'}>
      {enabled ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
    </button>
  );
}

export default function SessionBreathwork({ techniqueId, duration, phase, onComplete }) {
  const [technique, setTechnique] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showSilentSit, setShowSilentSit] = useState(false);
  const phaseStartRef = useRef(Date.now());
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!techniqueId) {
      setLoading(false);
      return;
    }
    phaseStartRef.current = Date.now();
    api.get(`/breathwork/techniques/${techniqueId}`)
      .then(setTechnique)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [techniqueId]);

  const protocol = technique?.protocol || { phases: [], cycles: 1 };
  const timer = useBreathworkTimer(protocol);

  const timerRef = useRef(timer);
  timerRef.current = timer;

  // Ref-stabilize callbacks to avoid identity churn in effects
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const techniqueRef = useRef(technique);
  techniqueRef.current = technique;

  // logGuard prevents double-logging to the API.
  // completePhase always calls onComplete — never blocked by the guard.
  const logGuardRef = useRef(false);

  const logSession = useCallback(async (completed) => {
    if (logGuardRef.current) return;
    logGuardRef.current = true;
    const actualDuration = Math.floor((Date.now() - phaseStartRef.current) / 1000);
    const t = timerRef.current;
    try {
      await api.post('/breathwork/sessions', {
        technique_id: techniqueId,
        duration_seconds: t.totalElapsed || actualDuration,
        rounds_completed: completed ? t.totalRounds : Math.max(0, t.currentRound - 1),
        completed,
      });
    } catch (err) {
      console.warn('Failed to log breathwork session:', err);
    }
  }, [techniqueId]);

  const completePhase = useCallback((completed) => {
    const actualDuration = Math.floor((Date.now() - phaseStartRef.current) / 1000);
    const t = timerRef.current;
    onCompleteRef.current({
      completed: true,
      duration: actualDuration,
      technique_name: techniqueRef.current?.name,
      rounds_completed: completed ? t.totalRounds : Math.max(0, t.currentRound - 1),
    });
  }, []); // stable — reads from refs

  const logAndComplete = useCallback(async (completed) => {
    await logSession(completed);
    completePhase(completed);
  }, [logSession, completePhase]);

  // Auto-transition when timer completes
  const autoCompletedRef = useRef(false);
  useEffect(() => {
    if (timer.isComplete && !autoCompletedRef.current) {
      autoCompletedRef.current = true;
      if (phase === 'closing') {
        logSession(true); // log now, complete after silent sit
        setShowSilentSit(true);
      } else {
        logAndComplete(true);
      }
    }
  }, [timer.isComplete, phase, logSession, logAndComplete]);

  // Auto-start timer as soon as technique is loaded
  useEffect(() => {
    if (technique && !autoStartedRef.current && !timer.isRunning && !timer.isComplete) {
      autoStartedRef.current = true;
      timer.initAudio();
      phaseStartRef.current = Date.now();
      timer.start();
    }
  }, [technique, timer.isRunning, timer.isComplete]);

  const handleSkip = () => {
    const actualDuration = Math.floor((Date.now() - phaseStartRef.current) / 1000);
    onComplete({ completed: false, duration: actualDuration, technique_name: technique?.name });
  };

  // Skip to next breathwork phase (round)
  const handleSkipPhase = () => {
    if (timer.isComplete) return;
    timer.pause();
    if (phase === 'closing') {
      logSession(false); // log the skip, don't block completion
      setShowSilentSit(true);
    } else {
      logAndComplete(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>Loading technique...</div>;
  }

  if (loadError) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ color: '#f87171', marginBottom: 16, fontSize: 14 }}>Failed to load technique</div>
        <button onClick={handleSkip} style={{
          padding: '12px 32px', borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.08)', color: C.textSec,
          fontSize: 14, cursor: 'pointer',
        }}>Skip</button>
      </div>
    );
  }

  if (!technique) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ color: C.textMuted, marginBottom: 16 }}>No technique available</div>
        <button onClick={handleSkip} style={{
          padding: '12px 32px', borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.08)', color: C.textSec,
          fontSize: 14, cursor: 'pointer',
        }}>Skip</button>
      </div>
    );
  }

  // Silent sit after closing breathwork — completePhase on finish (logging already done)
  if (showSilentSit) {
    return <SilentSit onFinish={() => completePhase(true)} />;
  }

  // Active timer
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 0',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {technique.name}
          </div>
          <SoundToggle enabled={timer.soundEnabled} onToggle={timer.toggleSound} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSkipPhase} style={{
            background: 'none', border: 'none', fontSize: 12,
            color: C.textMuted, cursor: 'pointer',
          }}>Skip ›</button>
          <div style={{ fontFamily: MONO, fontSize: 14, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {formatElapsed(timer.totalElapsed)}
          </div>
        </div>
      </div>

      {/* Phase instruction */}
      {timer.currentPhase.instruction && (
        <div style={{
          textAlign: 'center', fontSize: 13, color: C.textSec,
          marginBottom: 8, fontStyle: 'italic',
        }}>{timer.currentPhase.instruction}</div>
      )}

      {/* Breath circle */}
      <BreathCircle
        phaseKey={timer.currentPhase.key}
        phaseLabel={timer.currentPhase.label}
        secondsRemaining={timer.secondsRemaining}
        phaseDuration={timer.currentPhase.duration}
      />

      {/* Round counter */}
      <div style={{ textAlign: 'center', fontSize: 14, color: C.textMuted, margin: '16px 0' }}>
        Round {timer.currentRound} of {timer.totalRounds}
      </div>

      {/* Controls */}
      <TimerControls
        isRunning={timer.isRunning}
        onPause={timer.pause}
        onResume={timer.resume}
        onStop={handleSkip}
      />
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { C, MONO } from '../components/workout/tokens.jsx';
import { useBreathworkTimer } from '../hooks/useBreathworkTimer.js';
import BreathCircle from '../components/breathwork/BreathCircle.jsx';
import TimerControls from '../components/breathwork/TimerControls.jsx';
import SessionSummary from '../components/breathwork/SessionSummary.jsx';
import SafetyWarningModal from '../components/breathwork/SafetyWarningModal.jsx';

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function BreathworkTimer() {
  const { techniqueId } = useParams();
  const navigate = useNavigate();

  const [technique, setTechnique] = useState(null);
  const [loading, setLoading] = useState(true);
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [sessionLogged, setSessionLogged] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    api.get(`/breathwork/techniques/${techniqueId}`)
      .then(setTechnique)
      .catch(() => navigate('/breathe', { replace: true }))
      .finally(() => setLoading(false));
  }, [techniqueId, navigate]);

  const protocol = technique?.protocol || { phases: [], cycles: 1 };
  const timer = useBreathworkTimer(protocol);

  const needsSafetyWarning = technique && technique.safety_level !== 'green' && !safetyAccepted;

  // Use a ref so logSession always reads the latest timer values
  const timerRef = useRef(timer);
  timerRef.current = timer;

  const logSession = useCallback(async (completed) => {
    if (sessionLogged || !technique) return;
    setSessionLogged(true);
    const t = timerRef.current;
    try {
      await api.post('/breathwork/sessions', {
        technique_id: technique.id,
        duration_seconds: t.totalElapsed,
        rounds_completed: completed ? t.totalRounds : Math.max(0, t.currentRound - 1),
        completed,
      });
    } catch {}
  }, [sessionLogged, technique]);

  // Auto-log when complete
  useEffect(() => {
    if (timer.isComplete && !sessionLogged) logSession(true);
  }, [timer.isComplete, sessionLogged, logSession]);

  const handleStart = () => {
    timer.initAudio(); // Unlock AudioContext in user gesture for phase-transition chime
    setHasStarted(true);
    timer.start();
  };

  const handleStop = () => {
    setShowStopConfirm(true);
    timer.pause();
  };

  const confirmStop = () => {
    setShowStopConfirm(false);
    timer.stop();
    logSession(false);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px', textAlign: 'center', color: C.textMuted }}>
        Loading...
      </div>
    );
  }

  if (!technique) return null;

  // Safety warning for yellow/red techniques
  if (needsSafetyWarning) {
    return (
      <SafetyWarningModal
        techniqueName={technique.name}
        cautionNote={technique.caution_note}
        contraindications={technique.contraindications}
        onAccept={() => setSafetyAccepted(true)}
        onGoBack={() => navigate('/breathe')}
      />
    );
  }

  // Session complete or stopped early
  if (timer.isComplete || (sessionLogged && !timer.isRunning)) {
    return (
      <SessionSummary
        techniqueName={technique.name}
        totalElapsed={timer.totalElapsed}
        roundsCompleted={timer.isComplete ? timer.totalRounds : Math.max(0, timer.currentRound - 1)}
        totalRounds={timer.totalRounds}
        isComplete={timer.isComplete}
      />
    );
  }

  // Pre-start state
  if (!hasStarted) {
    return (
      <div style={{
        maxWidth: 420, margin: '0 auto', padding: '20px 16px',
        display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 80px)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <button
            onClick={() => navigate('/breathe')}
            style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: 18 }}
          >
            ←
          </button>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>
            {technique.name}
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, marginBottom: 16 }}>
          {technique.description}
        </div>

        {/* Instructions */}
        {technique.instructions && (
          <div style={{
            background: C.card, border: C.border, borderRadius: 10,
            padding: 14, fontSize: 13, color: C.textSec, lineHeight: 1.5, marginBottom: 16,
          }}>
            <div style={{ fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>
              Instructions
            </div>
            {technique.instructions}
          </div>
        )}

        {/* Protocol info */}
        <div style={{
          background: C.card, border: C.border, borderRadius: 10,
          padding: 14, marginBottom: 24,
        }}>
          <div style={{ fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>
            Protocol
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Phases</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: MONO }}>
                {protocol.phases.filter(p => p.duration > 0).length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Rounds</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: MONO }}>
                {protocol.cycles || 1}
              </div>
            </div>
            {protocol.ratio && (
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>Ratio</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: MONO }}>
                  {protocol.ratio}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '18px 0', borderRadius: 12,
            border: '1px solid rgba(167,139,250,0.4)',
            background: 'rgba(167,139,250,0.15)',
            color: '#a78bfa', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', marginBottom: 16,
          }}
        >
          Begin Session
        </button>
      </div>
    );
  }

  // Active timer view
  return (
    <div style={{
      maxWidth: 420, margin: '0 auto', padding: '20px 16px',
      display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 80px)',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleStop}
            style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: 18 }}
          >
            ←
          </button>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
            {technique.name}
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 14, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          {formatElapsed(timer.totalElapsed)}
        </div>
      </div>

      {/* Phase instruction */}
      {timer.currentPhase.instruction && (
        <div style={{
          textAlign: 'center', fontSize: 13, color: C.textSec,
          marginBottom: 8, fontStyle: 'italic',
        }}>
          {timer.currentPhase.instruction}
        </div>
      )}

      {/* Breath Circle */}
      <BreathCircle
        phaseKey={timer.currentPhase.key}
        phaseLabel={timer.currentPhase.label}
        secondsRemaining={timer.secondsRemaining}
        phaseDuration={timer.currentPhase.duration}
      />

      {/* Round counter */}
      <div style={{
        textAlign: 'center', fontSize: 14, color: C.textMuted,
        margin: '16px 0',
      }}>
        Round {timer.currentRound} of {timer.totalRounds}
      </div>

      {/* Controls */}
      <TimerControls
        isRunning={timer.isRunning}
        onPause={timer.pause}
        onResume={timer.resume}
        onStop={handleStop}
      />

      {/* Stop confirmation modal */}
      {showStopConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 300,
            background: 'rgba(20,28,50,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>
              End session early?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowStopConfirm(false); timer.resume(); }}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
                  color: C.textSec, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Continue
              </button>
              <button
                onClick={confirmStop}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10,
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

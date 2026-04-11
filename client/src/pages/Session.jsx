import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataProvider.jsx';
import { useSessionFlow } from '../hooks/useSessionFlow.js';
import { C, MONO } from '../components/workout/tokens.jsx';
import PreSessionOverview from '../components/session/PreSessionOverview.jsx';
import SessionBreathwork from '../components/session/SessionBreathwork.jsx';
import SessionYoga from '../components/session/SessionYoga.jsx';
import SessionMainWork from '../components/session/SessionMainWork.jsx';
import SessionSummary5Phase from '../components/session/SessionSummary5Phase.jsx';

// Inject banner animation once at module load
if (typeof document !== 'undefined' && !document.getElementById('phase-banner-style')) {
  const style = document.createElement('style');
  style.id = 'phase-banner-style';
  style.textContent = `@keyframes phaseBannerFade {
    0% { opacity: 0; transform: translateY(-10px); }
    15% { opacity: 1; transform: translateY(0); }
    70% { opacity: 1; }
    100% { opacity: 0; }
  }`;
  document.head.appendChild(style);
}

export default function Session() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workoutData: workout, fetchWorkout } = useData();
  const flow = useSessionFlow();

  const sessionType = searchParams.get('type') || 'strength';
  const workoutId = workout?.phases?.find(p => p.phase === 'main')?.workout_id;
  const workoutName = workout?.name;

  useEffect(() => {
    fetchWorkout();
    flow.setSessionType(sessionType);
  }, []);

  const handleBegin = () => {
    // Unlock AudioContext during this user gesture (required for iOS Safari).
    // Breathwork phases auto-start without a tap, so this is the last chance.
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
      window.__dailyforge_audio_ctx = ctx;
    } catch {}
    flow.beginSession();
  };

  const handleDone = () => {
    navigate('/');
  };

  const config = flow.phaseConfig;

  // Render current phase content
  const renderPhase = () => {
    switch (flow.currentPhase) {
      case 'overview':
        return (
          <PreSessionOverview
            workoutId={workoutId}
            workoutName={workoutName}
            sessionType={sessionType}
            flow={flow}
            onBegin={handleBegin}
          />
        );

      case 'opening_breathwork':
        return (
          <SessionBreathwork
            techniqueId={config.opening_breathwork.technique_id}
            duration={config.opening_breathwork.duration}
            phase="opening"
            onComplete={(result) => flow.completePhase(result)}
          />
        );

      case 'warmup':
        return (
          <SessionYoga
            phase="warmup"
            duration={config.warmup.duration}
            level={config.warmup.level}
            focus={config.warmup.focus}
            onComplete={(result) => flow.completePhase(result)}
          />
        );

      case 'main_work':
        return (
          <SessionMainWork
            flow={flow}
            onComplete={(result) => flow.completePhase(result)}
          />
        );

      case 'cooldown':
        return (
          <SessionYoga
            phase="cooldown"
            duration={config.cooldown.duration}
            level={config.cooldown.level}
            focus={config.cooldown.focus}
            onComplete={(result) => flow.completePhase(result)}
          />
        );

      case 'closing_breathwork':
        return (
          <SessionBreathwork
            techniqueId={config.closing_breathwork.technique_id}
            duration={config.closing_breathwork.duration}
            phase="closing"
            onComplete={(result) => flow.completePhase(result)}
          />
        );

      case 'summary':
        return (
          <SessionSummary5Phase
            flow={flow}
            workoutName={workoutName}
            workoutId={workoutId}
            onDone={handleDone}
          />
        );

      default:
        return null;
    }
  };

  // Phase progress indicator (not shown during overview/summary)
  const showProgress = flow.currentPhase !== 'overview' && flow.currentPhase !== 'summary';
  const activePhases = flow.getActivePhases();
  const currentActiveIndex = activePhases.indexOf(flow.currentPhase);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
      {/* Phase progress dots */}
      {showProgress && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          marginBottom: 16,
        }}>
          {activePhases.map((phase, i) => {
            const isDone = i < currentActiveIndex;
            const isCurrent = i === currentActiveIndex;
            const colors = {
              opening_breathwork: '#a78bfa',
              warmup: '#5DCAA5',
              main_work: '#D85A30',
              cooldown: '#5DCAA5',
              closing_breathwork: '#a78bfa',
            };
            const color = colors[phase] || C.textMuted;
            return (
              <div key={phase} style={{
                width: isCurrent ? 24 : 8, height: 8, borderRadius: 4,
                background: isDone ? color : isCurrent ? color : 'rgba(255,255,255,0.1)',
                opacity: isDone ? 0.5 : 1,
                transition: 'all 0.3s',
              }} />
            );
          })}
        </div>
      )}

      {/* Elapsed time (during active phases) */}
      {showProgress && flow.startedAt && (
        <div style={{
          textAlign: 'center', fontSize: 12, color: C.textMuted,
          fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
          marginBottom: 12,
        }}>
          Session: {flow.formatTime(flow.elapsedSeconds)}
        </div>
      )}

      {/* Phase banner — fades in briefly on transition */}
      {flow.phaseBanner && (
        <div key={flow.phaseBanner.phase} style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 50,
          padding: '12px 16px',
          pointerEvents: 'none',
          animation: 'phaseBannerFade 2.5s ease-out forwards',
        }}>
          <div style={{
            background: 'rgba(20,28,50,0.92)', backdropFilter: 'blur(8px)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '8px 20px',
            fontSize: 13, fontWeight: 600, color: C.text,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>{flow.PHASE_ICONS[flow.phaseBanner.phase] || ''}</span>
            {flow.phaseBanner.label}
          </div>
        </div>
      )}
      {renderPhase()}
    </div>
  );
}

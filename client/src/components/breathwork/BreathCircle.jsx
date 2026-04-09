import { MONO } from '../workout/tokens.jsx';

const PHASE_STYLES = {
  inhale: {
    bg: 'rgba(59, 130, 246, 0.2)',
    border: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.3)',
  },
  exhale: {
    bg: 'rgba(245, 158, 11, 0.2)',
    border: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.3)',
  },
  hold: {
    bg: 'rgba(16, 185, 129, 0.2)',
    border: '#10B981',
    glow: 'rgba(16, 185, 129, 0.3)',
  },
};

function getScale(phaseKey, secondsRemaining, phaseDuration) {
  if (!phaseDuration) return 0.8;
  const progress = 1 - secondsRemaining / phaseDuration;

  if (phaseKey === 'inhale') return 0.6 + 0.4 * progress;
  if (phaseKey === 'exhale') return 1.0 - 0.4 * progress;
  // hold — subtle pulse
  return 1.0 + 0.02 * Math.sin(progress * Math.PI * 2);
}

export default function BreathCircle({ phaseKey, phaseLabel, secondsRemaining, phaseDuration }) {
  const style = PHASE_STYLES[phaseKey] || PHASE_STYLES.hold;
  const scale = getScale(phaseKey, secondsRemaining, phaseDuration);
  const displaySeconds = Math.ceil(secondsRemaining);

  const size = 'min(65vw, 280px)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flex: 1, width: '100%',
    }}>
      <div style={{
        width: size, height: size,
        borderRadius: '50%',
        background: style.bg,
        border: `2.5px solid ${style.border}`,
        boxShadow: `0 0 40px ${style.glow}`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        transform: `scale(${scale})`,
        transition: `transform 1s ease-in-out, background 0.6s, border-color 0.6s, box-shadow 0.6s`,
        willChange: 'transform',
      }}>
        <div style={{
          fontSize: 22, fontWeight: 600,
          color: style.border, letterSpacing: '0.5px',
          marginBottom: 4,
        }}>
          {phaseLabel}
        </div>
        <div style={{
          fontSize: 48, fontWeight: 700,
          fontFamily: MONO,
          fontVariantNumeric: 'tabular-nums',
          color: 'rgba(255,255,255,0.95)',
        }}>
          {displaySeconds}
        </div>
      </div>
    </div>
  );
}

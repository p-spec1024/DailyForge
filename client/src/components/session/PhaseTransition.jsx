import { useState, useEffect, useRef } from 'react';
import { C, MONO } from '../workout/tokens.jsx';

const PHASE_ICONS = {
  opening_breathwork: '\uD83E\uDEC1',
  warmup: '\uD83E\uDDD8',
  main_work: '\uD83D\uDCAA',
  cooldown: '\uD83E\uDDD8',
  closing_breathwork: '\uD83E\uDEC1',
};

const PHASE_LABELS = {
  opening_breathwork: 'Opening Breathwork',
  warmup: 'Warm-up',
  main_work: 'Main Work',
  cooldown: 'Cool-down',
  closing_breathwork: 'Closing Breathwork',
};

export default function PhaseTransition({ nextPhase, subtitle, onStartNow, onSkip }) {
  const [countdown, setCountdown] = useState(5);
  const startRef = useRef(Date.now());
  const onStartNowRef = useRef(onStartNow);
  onStartNowRef.current = onStartNow;
  const firedRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    firedRef.current = false;
    setCountdown(5);
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const remaining = Math.max(0, 5 - elapsed);
      setCountdown(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onStartNowRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [nextPhase]);

  const icon = PHASE_ICONS[nextPhase] || '\uD83D\uDCAA';
  const label = PHASE_LABELS[nextPhase] || nextPhase;

  // Circular countdown
  const circumference = 2 * Math.PI * 28;
  const progress = countdown / 5;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,22,40,0.98)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '2px',
        color: C.green, textTransform: 'uppercase', marginBottom: 32,
      }}>PHASE COMPLETE &#10003;</div>

      <div style={{
        fontSize: 14, color: C.textSec, marginBottom: 8,
      }}>Up Next:</div>

      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 4 }}>{label}</div>
      {subtitle && (
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 24 }}>{subtitle}</div>
      )}

      {/* Countdown circle */}
      <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 32 }}>
        <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={36} cy={36} r={28} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
          <circle cx={36} cy={36} r={28} fill="none" stroke={C.green} strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.25s linear' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontFamily: MONO, fontWeight: 600, color: C.text,
          fontVariantNumeric: 'tabular-nums',
        }}>{countdown}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 300 }}>
        <button onClick={onSkip} style={{
          flex: 1, padding: '14px 0', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
          color: C.textSec, fontSize: 14, fontWeight: 500, cursor: 'pointer',
        }}>Skip Phase</button>
        <button onClick={onStartNow} style={{
          flex: 1, padding: '14px 0', borderRadius: 10,
          background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.25)',
          color: C.green, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Start Now</button>
      </div>
    </div>
  );
}

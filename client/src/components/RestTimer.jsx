import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MONO } from './workout/tokens.jsx';

const TIMER_Z = 90;
const RING_SIZE = 64;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function getColor(fraction) {
  if (fraction > 0.5) return '#4ade80';
  if (fraction > 0.2) return '#facc15';
  return '#ef4444';
}

function formatMmSs(secs) {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.floor(Math.max(0, secs) % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RestTimer({ duration = 90, endTime, isActive, onSkip, onFinish, onDismiss }) {
  const [remaining, setRemaining] = useState(duration);
  const [visible, setVisible] = useState(false);
  const [finished, setFinished] = useState(false);
  const rafRef = useRef(null);
  const finishTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    rafRef.current = null;
    finishTimeoutRef.current = null;
  }, []);

  // Start/stop timer based on isActive and endTime
  useEffect(() => {
    if (isActive && endTime) {
      const left = (endTime - Date.now()) / 1000;
      setVisible(true);

      if (left <= 0) {
        setRemaining(0);
        setFinished(true);
      } else {
        setRemaining(left);
        setFinished(false);

        function tick() {
          const left = (endTime - Date.now()) / 1000;
          if (left <= 0) {
            setRemaining(0);
            setFinished(true);
            return; // stop ticking
          }
          setRemaining(left);
          rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
      }
    } else {
      cleanup();
      setVisible(false);
      setFinished(false);
    }

    return cleanup;
  }, [isActive, endTime, cleanup]);

  // Auto-dismiss 2 seconds after finished
  useEffect(() => {
    if (finished && isActive) {
      finishTimeoutRef.current = setTimeout(() => {
        onFinish?.();
      }, 2000);
      return () => {
        if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
      };
    }
  }, [finished, isActive, onFinish]);

  if (!visible) return null;

  const fraction = Math.max(0, Math.min(1, remaining / duration));
  const color = getColor(fraction);
  const dashOffset = RING_CIRCUMFERENCE * (1 - fraction);

  // Portal to document.body to avoid ancestor stacking context issues
  // (backdrop-filter on SessionHeader creates a new containing block,
  //  which breaks position:fixed relative to viewport on iOS Safari)
  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: 'calc(70px + env(safe-area-inset-bottom, 0px) + 12px)',
      left: 12,
      right: 12,
      zIndex: TIMER_Z,
      animation: 'restTimerSlideUp 0.3s ease-out',
      pointerEvents: 'auto',
    }}>
      <style>{`
        @keyframes restTimerSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes restTimerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>

      <div style={{
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 16,
        border: '0.5px solid rgba(255,255,255,0.1)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: finished ? 'restTimerPulse 0.6s ease-in-out 2' : 'none',
      }}>
        {/* Circular progress ring */}
        <div style={{ flexShrink: 0, position: 'relative', width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background ring */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={RING_STROKE}
            />
            {/* Progress ring */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke 0.5s ease, stroke-dashoffset 0.3s linear' }}
            />
          </svg>
          {/* Center time (small) */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontFamily: MONO, fontWeight: 600, color,
            letterSpacing: '0.5px',
          }}>
            {formatMmSs(remaining)}
          </div>
        </div>

        {/* Large countdown */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 28, fontFamily: MONO, fontWeight: 700, color: 'rgba(255,255,255,0.95)',
            letterSpacing: '2px', lineHeight: 1,
          }}>
            {formatMmSs(remaining)}
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2,
          }}>
            {finished ? 'Rest complete' : 'Rest timer'}
          </div>
        </div>

        {/* Skip button */}
        {!finished && (
          <button
            onClick={onSkip}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Skip Rest
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

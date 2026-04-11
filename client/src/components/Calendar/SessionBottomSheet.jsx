import { useEffect, useRef } from 'react';
import { C } from '../workout/tokens.jsx';
import { dotColorFor } from './CalendarDay.jsx';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

function formatDateHeader(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

function formatDuration(secs) {
  if (!secs) return '0 min';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function typeLabel(mainWorkType) {
  if (mainWorkType === 'strength') return 'Strength';
  if (mainWorkType === 'yoga') return 'Yoga';
  if (mainWorkType === 'breathwork') return 'Breathwork';
  return mainWorkType || 'Session';
}

const CLOSE_THRESHOLD_PX = 80;
const CLOSE_THRESHOLD_VELOCITY = 0.5; // px/ms — flick down to dismiss

export default function SessionBottomSheet({ dateStr, sessions, onClose }) {
  const sheetRef = useRef(null);
  const startYRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const currentDyRef = useRef(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyTransform = (y) => {
    const el = sheetRef.current;
    if (el) el.style.transform = y > 0 ? `translate3d(0, ${y}px, 0)` : '';
  };

  const onTouchStart = (e) => {
    // Only start a drag when the sheet is scrolled to top — otherwise the
    // user is scrolling content.
    if ((sheetRef.current?.scrollTop || 0) > 0) return;
    const t = e.touches[0];
    startYRef.current = t.clientY;
    lastYRef.current = t.clientY;
    startTimeRef.current = performance.now();
    lastTimeRef.current = startTimeRef.current;
    currentDyRef.current = 0;
    draggingRef.current = true;
    const el = sheetRef.current;
    if (el) el.style.transition = 'none';
  };

  const onTouchMove = (e) => {
    if (!draggingRef.current) return;
    const t = e.touches[0];
    const dy = t.clientY - startYRef.current;
    lastYRef.current = t.clientY;
    lastTimeRef.current = performance.now();
    if (dy > 0) {
      currentDyRef.current = dy;
      applyTransform(dy);
    } else {
      currentDyRef.current = 0;
      applyTransform(0);
    }
  };

  const onTouchEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const dy = currentDyRef.current;
    const dt = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = dy / dt;
    const shouldClose = dy > CLOSE_THRESHOLD_PX || velocity > CLOSE_THRESHOLD_VELOCITY;

    const el = sheetRef.current;
    if (shouldClose) {
      if (el) {
        el.style.transition = 'transform 180ms ease-out';
        el.style.transform = 'translate3d(0, 100%, 0)';
      }
      setTimeout(onClose, 180);
    } else {
      if (el) {
        el.style.transition = 'transform 200ms ease-out';
        el.style.transform = '';
      }
    }
  };

  if (!dateStr) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'dfFadeIn 180ms ease-out',
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#111a2e',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '20px 20px 32px',
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: 'dfSlideUp 220ms ease-out',
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
      >
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.2)',
          margin: '0 auto 14px',
        }} />

        <h3 style={{
          margin: '0 0 14px',
          color: C.text,
          fontSize: 16,
          fontWeight: 600,
        }}>
          {formatDateHeader(dateStr)}
        </h3>

        {(!sessions || sessions.length === 0) ? (
          <div style={{ color: C.textMuted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            Rest day
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map((s) => {
              const color = dotColorFor(s.main_work_type);
              return (
                <div
                  key={s.id}
                  style={{
                    background: C.card,
                    border: C.border,
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 10,
                      background: `${color}22`,
                      color,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                      {typeLabel(s.main_work_type)}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>
                      {formatDuration(s.duration)}
                    </span>
                    {s.pr_count > 0 && (
                      <span style={{ color: '#f59e0b', fontSize: 12, marginLeft: 'auto' }}>
                        &#127942; {s.pr_count} PR{s.pr_count === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>
                    {s.summary || 'Workout'}
                  </div>
                  {s.exercise_count > 0 && (
                    <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                      {s.exercise_count} exercise{s.exercise_count === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '12px',
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color: C.textSec,
            fontSize: 14,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          Close
        </button>
      </div>

      <style>{`
        @keyframes dfFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dfSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}

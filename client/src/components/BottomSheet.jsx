import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { C } from './workout/tokens.jsx';

/**
 * Shared bottom-sheet overlay.
 *
 * Props:
 *  - onClose:    called after exit animation finishes
 *  - title:      header text (string or node)
 *  - maxHeight:  CSS max-height for the panel (default '60vh')
 *  - zIndex:     overlay z-index (default 200)
 *  - children:   JSX content, OR a render-function (close) => JSX
 *                `close(afterClose?)` triggers the exit animation;
 *                afterClose is called after the 200 ms slide-out.
 */
export default function BottomSheet({ onClose, title, maxHeight = '60vh', zIndex = 200, children }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback((afterClose) => {
    setVisible(false);
    setTimeout(() => {
      onClose();
      afterClose?.();
    }, 200);
  }, [onClose]);

  return createPortal(
    <div
      onClick={() => close()}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        transition: 'opacity 0.2s',
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight,
          background: 'rgba(20,28,50,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px 16px 0 0',
          padding: '0 0 env(safe-area-inset-bottom, 16px)',
          overflowY: 'auto',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky', top: 0,
          background: 'rgba(20,28,50,0.98)', zIndex: 1,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, flex: 1, marginRight: 12 }}>
            {title}
          </div>
          <button onClick={() => close()} style={{
            width: 28, height: 28, borderRadius: 14, border: 'none',
            background: 'rgba(255,255,255,0.08)', color: C.textSec,
            fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '8px 16px 16px' }}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      </div>
    </div>,
    document.body
  );
}

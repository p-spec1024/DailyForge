import { useState } from 'react';
import { C, MONO, formatVolume } from './workout/tokens.jsx';

export default function SessionHeader({ elapsed, totalVolume, onFinish, onDiscard, onSettings, formatTime, isFinishing }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'rgba(12,18,34,0.95)', backdropFilter: 'blur(12px)',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      padding: '10px 0', marginBottom: 12, marginTop: -4,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Timer */}
          <div style={{
            fontSize: 20, fontFamily: MONO, fontWeight: 600, color: C.accent,
            letterSpacing: '1px',
          }}>
            {formatTime(elapsed)}
          </div>
          {/* Volume */}
          <div style={{ fontSize: 12, color: C.textSec }}>
            <span style={{ fontFamily: MONO, fontWeight: 500 }}>{formatVolume(totalVolume)}</span> kg
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Timer settings gear */}
          <button onClick={onSettings} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: C.textMuted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: C.textMuted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', top: 36, right: 0, zIndex: 30,
                background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, overflow: 'hidden', minWidth: 150,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <button onClick={() => { setShowMenu(false); onDiscard(); }} style={{
                  display: 'block', width: '100%', padding: '10px 14px', border: 'none',
                  background: 'transparent', color: '#ef4444', fontSize: 13,
                  textAlign: 'left', cursor: 'pointer',
                }}>
                  Discard workout
                </button>
              </div>
            )}
          </div>

          {/* Finish button */}
          <button onClick={onFinish} disabled={isFinishing} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'rgba(29,158,117,0.2)', color: C.green,
            fontSize: 13, fontWeight: 600, cursor: isFinishing ? 'default' : 'pointer',
            opacity: isFinishing ? 0.5 : 1, transition: 'opacity 0.2s',
          }}>
            {isFinishing ? 'Finishing...' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}

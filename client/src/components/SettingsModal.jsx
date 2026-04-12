import { useState } from 'react';
import { api } from '../utils/api.js';
import { C, MONO } from './workout/tokens.jsx';

const DURATION_OPTIONS = [30, 60, 90, 120, 180, 300];

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
        background: value ? 'rgba(29,158,117,0.4)' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 10,
        background: value ? C.green : 'rgba(255,255,255,0.3)',
        position: 'absolute', top: 2,
        left: value ? 22 : 2,
        transition: 'left 0.2s, background 0.2s',
      }} />
    </div>
  );
}

export default function SettingsModal({ settings, onClose, onSave }) {
  const [duration, setDuration] = useState(settings?.rest_timer_duration ?? 90);
  const [enabled, setEnabled] = useState(settings?.rest_timer_enabled ?? true);
  const [autoStart, setAutoStart] = useState(settings?.rest_timer_auto_start ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put('/settings', {
        rest_timer_duration: duration,
        rest_timer_enabled: enabled,
        rest_timer_auto_start: autoStart,
      });
      onSave(updated);
    } catch {
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'rgba(20,28,50,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 }}>
          Rest Timer Settings
        </div>

        {/* Duration */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textSec, marginBottom: 8 }}>Duration</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DURATION_OPTIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)} style={{
                padding: '8px 12px', borderRadius: 8, border: 'none',
                background: d === duration ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.06)',
                color: d === duration ? C.green : C.textSec,
                fontSize: 13, fontFamily: MONO, fontWeight: 500, cursor: 'pointer',
              }}>
                {d >= 60 ? `${d / 60}m` : `${d}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Enabled */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.text }}>Rest timer</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Show timer between sets</div>
          </div>
          <Toggle value={enabled} onChange={setEnabled} />
        </div>

        {/* Auto-start */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.text }}>Auto-start</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Start timer after each set</div>
          </div>
          <Toggle value={autoStart} onChange={setAutoStart} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: C.textSec, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: 'none',
            background: 'rgba(29,158,117,0.2)', color: C.green,
            fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

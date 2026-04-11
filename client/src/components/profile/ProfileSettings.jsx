import { useEffect, useRef, useState } from 'react';
import { C } from '../workout/tokens.jsx';
import { api } from '../../utils/api.js';

export default function ProfileSettings({ unitSystem, onChange }) {
  const inFlight = useRef(false);
  const aliveRef = useRef(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  async function handleSelect(next) {
    if (next === unitSystem || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setSaving(true);
    try {
      const updated = await api.put('/users/profile', { unit_system: next });
      if (!aliveRef.current) return;
      onChange?.(updated);
    } catch (e) {
      if (aliveRef.current) setError(e?.userMessage || 'Failed to update settings');
    } finally {
      inFlight.current = false;
      if (aliveRef.current) setSaving(false);
    }
  }

  return (
    <div style={{
      background: C.card,
      border: C.border,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10, color: C.textMuted, textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 12,
      }}>Settings</div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ color: C.textSec, fontSize: 13 }}>Units</div>
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: 3,
        }}>
          {[
            { key: 'metric', label: 'Metric' },
            { key: 'imperial', label: 'Imperial' },
          ].map((opt) => {
            const active = unitSystem === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt.key)}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 7, border: 'none',
                  background: active ? 'rgba(216,90,48,0.2)' : 'transparent',
                  color: active ? C.accent : C.textMuted,
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  cursor: saving ? 'default' : 'pointer',
                  minHeight: 32, minWidth: 72,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: 11, marginTop: 10 }}>{error}</div>
      )}
    </div>
  );
}

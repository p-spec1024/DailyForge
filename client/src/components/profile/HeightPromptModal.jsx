import { useState } from 'react';
import { C } from '../workout/tokens.jsx';
import { feetInchesToCm } from '../../utils/unitConversion.js';
import { api } from '../../utils/api.js';

export default function HeightPromptModal({ unitSystem = 'metric', onSaved }) {
  const [system, setSystem] = useState(unitSystem);
  const [cm, setCm] = useState('');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setError(null);
    let heightCm = null;
    if (system === 'imperial') {
      const f = Number(feet);
      const i = Number(inches) || 0;
      if (!Number.isFinite(f) || f <= 0) {
        setError('Enter a valid height');
        return;
      }
      heightCm = feetInchesToCm(f, i);
    } else {
      const n = Number(cm);
      if (!Number.isFinite(n) || n < 50 || n > 280) {
        setError('Enter a valid height (50-280 cm)');
        return;
      }
      heightCm = n;
    }

    try {
      setSaving(true);
      const updated = await api.put('/users/profile', {
        height_cm: heightCm,
        unit_system: system,
      });
      onSaved?.(updated);
    } catch (e) {
      setError(e?.userMessage || 'Failed to save height');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, zIndex: 1000,
    }}>
      <div style={{
        background: '#0c1222',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        padding: 24,
        maxWidth: 360,
        width: '100%',
      }}>
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 500, margin: '0 0 6px' }}>
          Set your height
        </h2>
        <p style={{ color: C.textSec, fontSize: 13, margin: '0 0 18px' }}>
          We need this once to calculate BMI from your weight.
        </p>

        <div style={{
          display: 'flex', gap: 6, marginBottom: 16,
          background: C.card, border: C.border, borderRadius: 10, padding: 4,
        }}>
          {['metric', 'imperial'].map((s) => (
            <button
              key={s}
              onClick={() => setSystem(s)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 7, border: 'none',
                background: system === s ? 'rgba(216,90,48,0.2)' : 'transparent',
                color: system === s ? C.accent : C.textSec,
                fontSize: 12, fontWeight: system === s ? 600 : 400,
                cursor: 'pointer', minHeight: 40,
              }}
            >
              {s === 'metric' ? 'cm / kg' : 'ft / lb'}
            </button>
          ))}
        </div>

        {system === 'metric' ? (
          <input
            type="number"
            inputMode="decimal"
            placeholder="Height in cm"
            value={cm}
            onChange={(e) => setCm(e.target.value)}
            style={inputStyle}
          />
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              inputMode="numeric"
              placeholder="ft"
              value={feet}
              onChange={(e) => setFeet(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="in"
              value={inches}
              onChange={(e) => setInches(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        )}

        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 18, width: '100%', padding: '12px',
            borderRadius: 10, border: 'none',
            background: C.accent, color: '#fff',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            minHeight: 44, opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.95)',
  fontSize: 15,
  boxSizing: 'border-box',
};

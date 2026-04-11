import { useState } from 'react';
import { C } from '../workout/tokens.jsx';
import { toKg, toCm } from '../../utils/unitConversion.js';
import { api } from '../../utils/api.js';

const CIRC_FIELDS = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'bicep_left_cm', label: 'L Bicep' },
  { key: 'bicep_right_cm', label: 'R Bicep' },
];

export default function AddMeasurementModal({ unitSystem = 'metric', onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [circ, setCirc] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const weightUnit = unitSystem === 'imperial' ? 'lb' : 'kg';
  const lengthUnit = unitSystem === 'imperial' ? 'in' : 'cm';

  function setCircField(key, value) {
    setCirc((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    const payload = {
      measured_at: date,
      weight_kg: weight !== '' ? toKg(weight, unitSystem) : null,
      body_fat_percent: bodyFat !== '' ? Number(bodyFat) : null,
      notes: notes || null,
    };
    for (const f of CIRC_FIELDS) {
      const v = circ[f.key];
      payload[f.key] = v !== undefined && v !== '' ? toCm(v, unitSystem) : null;
    }

    const MEASUREMENT_KEYS = [
      'weight_kg', 'body_fat_percent',
      'waist_cm', 'hips_cm', 'chest_cm', 'bicep_left_cm', 'bicep_right_cm',
    ];
    const hasAny = MEASUREMENT_KEYS.some((k) => payload[k] != null);
    if (!hasAny) {
      setError('Enter at least one measurement');
      return;
    }

    try {
      setSaving(true);
      const saved = await api.post('/body-measurements', payload);
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      setError(e?.userMessage || 'Failed to save measurement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#0c1222',
        borderTop: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: '20px 20px 0 0',
        padding: 22,
        maxWidth: 480,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 500, margin: 0 }}>
            Add measurement
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: C.textSec,
              fontSize: 22, cursor: 'pointer', padding: 4, minHeight: 44, minWidth: 44,
            }}
            aria-label="Close"
          >×</button>
        </div>

        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today}
            style={inputStyle}
          />
        </Field>

        <Field label={`Weight (${weightUnit})`}>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Body fat %">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <div style={{
          fontSize: 11, color: C.textMuted, textTransform: 'uppercase',
          letterSpacing: '0.06em', margin: '18px 0 8px',
        }}>
          Circumferences ({lengthUnit})
        </div>

        {CIRC_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={circ[f.key] || ''}
              onChange={(e) => setCircField(f.key, e.target.value)}
              style={inputStyle}
            />
          </Field>
        ))}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 18, width: '100%', padding: '14px',
            borderRadius: 12, border: 'none',
            background: C.accent, color: '#fff',
            fontSize: 15, fontWeight: 500, cursor: 'pointer',
            minHeight: 48, opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save measurement'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 11, color: C.textSec, marginBottom: 4,
      }}>{label}</div>
      {children}
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

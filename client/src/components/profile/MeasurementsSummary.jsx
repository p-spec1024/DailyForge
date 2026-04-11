import { C, MONO } from '../workout/tokens.jsx';
import { formatWeight, getBMICategory } from '../../utils/unitConversion.js';

export default function MeasurementsSummary({ stats, unitSystem, onAdd }) {
  if (!stats || !stats.latest) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>📊</div>
        <div style={{ color: C.text, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
          No measurements yet
        </div>
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 18 }}>
          Track your weight and body composition over time
        </div>
        <button onClick={onAdd} style={{ ...addButtonStyle, padding: '10px 20px' }}>
          + Add first measurement
        </button>
      </div>
    );
  }

  const { latest, bmi, rolling_avg_7d, weight_delta_week, days_since_last_entry } = stats;
  const bmiCat = getBMICategory(bmi);

  const weekArrow =
    weight_delta_week == null
      ? null
      : weight_delta_week > 0
        ? '↑'
        : weight_delta_week < 0
          ? '↓'
          : '→';

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 10, color: C.textMuted, textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 4,
        }}>Weight</div>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        }}>
          <div style={{ color: C.text, fontSize: 26, fontFamily: MONO, fontWeight: 500 }}>
            {formatWeight(latest.weight_kg, unitSystem)}
          </div>
          {weekArrow && (
            <div style={{ color: C.textSec, fontSize: 12, fontFamily: MONO }}>
              {weekArrow} {Math.abs(weight_delta_week).toFixed(1)} {unitSystem === 'imperial' ? 'lb' : 'kg'} this week
            </div>
          )}
        </div>
        {rolling_avg_7d != null && (
          <div style={{ color: C.textMuted, fontSize: 11, fontFamily: MONO, marginTop: 2 }}>
            7-day avg: {formatWeight(rolling_avg_7d, unitSystem)}
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', gap: 12,
        paddingTop: 12,
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={statLabelStyle}>BMI</div>
          <div style={{ color: bmiCat.color, fontSize: 18, fontFamily: MONO, fontWeight: 500 }}>
            {bmi != null ? bmi : '—'}
          </div>
          <div style={{ color: bmiCat.color, fontSize: 11 }}>{bmiCat.label}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={statLabelStyle}>Body fat</div>
          <div style={{ color: C.text, fontSize: 18, fontFamily: MONO, fontWeight: 500 }}>
            {latest.body_fat_percent != null ? `${Number(latest.body_fat_percent).toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 12, marginTop: 12,
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ color: C.textMuted, fontSize: 11, fontFamily: MONO }}>
          Last entry: {days_since_last_entry === 0 ? 'today' : `${days_since_last_entry}d ago`}
        </div>
        <button onClick={onAdd} style={addButtonStyle}>+ Add</button>
      </div>
    </div>
  );
}

const cardStyle = {
  background: C.card,
  border: C.border,
  borderRadius: 14,
  padding: 18,
  marginBottom: 12,
};

const statLabelStyle = {
  fontSize: 10,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
};

const addButtonStyle = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'rgba(216,90,48,0.18)',
  color: C.accent,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 36,
};

import { C, MONO } from '../workout/tokens.jsx';
import { formatLength, cmToInches } from '../../utils/unitConversion.js';

const FIELDS = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'bicep_left_cm', label: 'L Bicep' },
  { key: 'bicep_right_cm', label: 'R Bicep' },
];

function formatDelta(deltaCm, system) {
  if (deltaCm == null) return null;
  const v = system === 'imperial' ? cmToInches(deltaCm) : deltaCm;
  const unit = system === 'imperial' ? 'in' : 'cm';
  if (Math.abs(v) < 0.1) return { arrow: '→', text: 'no change', color: C.textMuted };
  const arrow = v > 0 ? '↑' : '↓';
  return { arrow, text: `${arrow} ${Math.abs(v).toFixed(1)} ${unit}`, color: C.textSec };
}

export default function CircumferencesCard({ stats, unitSystem }) {
  if (!stats || !stats.latest) return null;

  const { latest, circumference_deltas, entry_count } = stats;
  const useTotal = entry_count > 4;
  const hasAny = FIELDS.some((f) => latest[f.key] != null);
  if (!hasAny) return null;

  let totalDelta = 0;
  let totalCount = 0;

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
      }}>Circumferences</div>

      {FIELDS.map((f) => {
        const value = latest[f.key];
        const delta = circumference_deltas?.[f.key];
        const deltaCm = useTotal ? delta?.total : delta?.week;
        const formatted = formatDelta(deltaCm, unitSystem);
        if (deltaCm != null) {
          totalDelta += deltaCm;
          totalCount++;
        }
        return (
          <div key={f.key} style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '8px 0',
            borderTop: '0.5px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ color: C.textSec, fontSize: 13 }}>{f.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ color: C.text, fontSize: 14, fontFamily: MONO }}>
                {formatLength(value, unitSystem)}
              </div>
              {formatted && (
                <div style={{ color: formatted.color, fontSize: 11, fontFamily: MONO, minWidth: 80, textAlign: 'right' }}>
                  {formatted.text}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {totalCount > 0 && (
        <div style={{
          paddingTop: 10, marginTop: 6,
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between',
          color: C.textMuted, fontSize: 11, fontFamily: MONO,
        }}>
          <span>{useTotal ? 'Total change' : 'Week change'}</span>
          <span>
            {totalDelta > 0 ? '+' : ''}
            {(unitSystem === 'imperial' ? cmToInches(totalDelta) : totalDelta).toFixed(1)}{' '}
            {unitSystem === 'imperial' ? 'in' : 'cm'}
          </span>
        </div>
      )}
    </div>
  );
}

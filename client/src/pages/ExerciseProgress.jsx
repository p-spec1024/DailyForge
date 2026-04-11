import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ProgressChart from '../components/ProgressChart.jsx';
import { useExerciseProgress } from '../hooks/useExerciseProgress.js';
import { C, MONO, GOLD, typeColor } from '../components/workout/tokens.jsx';

const RANGES = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'all', label: 'All time' },
];

function formatHold(s) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}:${String(sec).padStart(2, '0')}`;
  return `${sec}s`;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCell({ label, value, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '10px 4px' }}>
      <div style={{
        fontSize: 10, color: C.textMuted, textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 18, color: accent || C.text, fontFamily: MONO, fontWeight: 500,
      }}>{value}</div>
    </div>
  );
}

function SummaryStrength({ summary }) {
  return (
    <>
      <div style={{
        display: 'flex',
        background: C.card,
        border: C.border,
        borderRadius: 12,
        padding: '4px 8px',
        marginBottom: 10,
      }}>
        <StatCell label="Current" value={`${summary.current_best || 0}kg`} />
        <StatCell label="Best" value={`${summary.all_time_best || 0}kg`} accent={GOLD} />
        <StatCell label="Δ from start" value={`${summary.improvement_percent > 0 ? '+' : ''}${summary.improvement_percent || 0}%`} />
      </div>
      <div style={{
        color: C.textSec,
        fontSize: 12,
        fontFamily: MONO,
        padding: '0 4px 12px',
      }}>
        {summary.estimated_1rm ? `Est. 1RM: ${summary.estimated_1rm}kg · ` : ''}
        Volume: {summary.total_volume_month?.toLocaleString() || 0}kg/mo · {summary.total_sessions} sessions
      </div>
    </>
  );
}

function SummaryYoga({ summary }) {
  return (
    <>
      <div style={{
        display: 'flex',
        background: C.card,
        border: C.border,
        borderRadius: 12,
        padding: '4px 8px',
        marginBottom: 10,
      }}>
        <StatCell label="Current" value={formatHold(summary.current_best_hold)} />
        <StatCell label="Best" value={formatHold(summary.all_time_best_hold)} accent={GOLD} />
        <StatCell label="Δ from start" value={`${summary.improvement_percent > 0 ? '+' : ''}${summary.improvement_percent || 0}%`} />
      </div>
      <div style={{ color: C.textSec, fontSize: 12, fontFamily: MONO, padding: '0 4px 12px' }}>
        {summary.total_sessions} sessions
      </div>
    </>
  );
}

function SummaryBreathwork({ summary }) {
  return (
    <>
      <div style={{
        display: 'flex',
        background: C.card,
        border: C.border,
        borderRadius: 12,
        padding: '4px 8px',
        marginBottom: 10,
      }}>
        <StatCell label="Avg hold" value={formatHold(summary.avg_hold_seconds)} />
        <StatCell label="Best hold" value={formatHold(summary.best_hold_seconds)} accent={GOLD} />
        <StatCell label="Avg rounds" value={summary.avg_rounds_per_session || 0} />
      </div>
      <div style={{ color: C.textSec, fontSize: 12, fontFamily: MONO, padding: '0 4px 12px' }}>
        {summary.total_sessions} sessions · {summary.total_breathwork_minutes || 0} min total
      </div>
    </>
  );
}

export default function ExerciseProgress() {
  const { exerciseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeHint = searchParams.get('type');
  const [range, setRange] = useState('30d');

  const { data, loading, error } = useExerciseProgress(exerciseId, range, typeHint);

  const kind = data?.exercise?.type || typeHint || 'strength';
  const color = typeColor(kind);

  const chartConfig = {
    strength:   { dataKey: 'weight',           prKey: 'is_pr',   unit: 'kg' },
    yoga:       { dataKey: 'hold_seconds',     prKey: 'is_best', unit: 's' },
    breathwork: { dataKey: 'max_hold_seconds', prKey: 'is_best', unit: 's' },
  }[kind] || { dataKey: 'weight', prKey: 'is_pr', unit: 'kg' };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 24px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 4px 16px',
      }}>
        <button
          onClick={() => {
            // Return to history with the source section pre-expanded.
            // Explicit URL beats navigate(-1) because React Router unmounts
            // ExerciseHistory on navigation, so its local expanded-state would
            // otherwise reset to the collapsed default.
            const expandKind = (data?.exercise?.type || typeHint || '').toLowerCase();
            const target = expandKind
              ? `/exercise-history?expand=${expandKind}`
              : '/exercise-history';
            navigate(target);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.textSec,
            fontSize: 20,
            cursor: 'pointer',
            padding: 4,
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label="Back"
        >
          ←
        </button>
        <h1 style={{
          margin: 0,
          color: C.text,
          fontSize: 18,
          fontWeight: 500,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data?.exercise?.name || 'Progress'}
        </h1>
      </div>

      {loading && (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: 40, fontSize: 13 }}>
          Loading…
        </div>
      )}

      {error && (
        <div style={{
          color: '#ef4444',
          background: 'rgba(239,68,68,0.08)',
          border: '0.5px solid rgba(239,68,68,0.3)',
          borderRadius: 12,
          padding: 16,
          fontSize: 13,
        }}>{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {/* Range toggle */}
          <div style={{
            display: 'flex',
            gap: 6,
            marginBottom: 14,
            background: C.card,
            border: C.border,
            borderRadius: 10,
            padding: 4,
          }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 7,
                  border: 'none',
                  background: range === r.key ? `${color}25` : 'transparent',
                  color: range === r.key ? color : C.textSec,
                  fontSize: 12,
                  fontWeight: range === r.key ? 600 : 400,
                  cursor: 'pointer',
                  minHeight: 44,
                  transition: 'all 0.15s',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div style={{
            background: C.card,
            border: `0.5px solid ${color}25`,
            borderRadius: 12,
            padding: '16px 8px 12px',
            marginBottom: 14,
          }}>
            <ProgressChart
              data={data.chart_data || []}
              dataKey={chartConfig.dataKey}
              color={color}
              prKey={chartConfig.prKey}
              unit={chartConfig.unit}
            />
            {data.chart_data?.some(p => p[chartConfig.prKey]) && (
              <div style={{
                color: GOLD,
                fontSize: 11,
                fontFamily: MONO,
                textAlign: 'center',
                marginTop: 8,
                textShadow: `0 0 8px ${GOLD}60`,
              }}>
                ✨ Gold dots mark personal bests
              </div>
            )}
          </div>

          {/* Summary stats */}
          {kind === 'strength' && <SummaryStrength summary={data.summary || {}} />}
          {kind === 'yoga' && <SummaryYoga summary={data.summary || {}} />}
          {kind === 'breathwork' && <SummaryBreathwork summary={data.summary || {}} />}

          {/* Recent sessions (strength only has set breakdown) */}
          {kind === 'strength' && data.recent_sessions?.length > 0 && (
            <div style={{
              background: C.card,
              border: C.border,
              borderRadius: 12,
              padding: '14px 16px',
              marginTop: 6,
            }}>
              <div style={{
                fontSize: 10,
                color: C.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}>Recent Sessions</div>
              {data.recent_sessions.map((s, i) => (
                <div key={i} style={{
                  padding: '8px 0',
                  borderTop: i === 0 ? 'none' : '0.5px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  gap: 12,
                  fontSize: 12,
                  fontFamily: MONO,
                }}>
                  <span style={{ color: C.textSec, minWidth: 56 }}>{formatDate(s.date)}</span>
                  <span style={{ color: C.text, flex: 1 }}>
                    {(s.sets || [])
                      .filter(set => set.weight != null && set.reps != null)
                      .map(set => `${set.weight}kg×${set.reps}`)
                      .join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

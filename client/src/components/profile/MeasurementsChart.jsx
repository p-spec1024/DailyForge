import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { C } from '../workout/tokens.jsx';
import { kgToLbs, cmToInches } from '../../utils/unitConversion.js';

const RANGES = [
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
];

const METRIC_OPTIONS = [
  { key: 'weight_kg', label: 'Weight', isWeight: true },
  { key: 'body_fat_percent', label: 'Body Fat %', isWeight: false, unitOverride: '%' },
  { key: 'waist_cm', label: 'Waist', isWeight: false },
  { key: 'hips_cm', label: 'Hips', isWeight: false },
  { key: 'chest_cm', label: 'Chest', isWeight: false },
  { key: 'bicep_left_cm', label: 'L Bicep', isWeight: false },
  { key: 'bicep_right_cm', label: 'R Bicep', isWeight: false },
];

function rollingAverage(points, days = 7, key = 'value') {
  return points.map((p, i) => {
    const window = points.slice(Math.max(0, i - days + 1), i + 1);
    const valid = window.filter((w) => w[key] != null);
    if (valid.length === 0) return { ...p, avg: null };
    const sum = valid.reduce((acc, w) => acc + w[key], 0);
    return { ...p, avg: sum / valid.length };
  });
}

export default function MeasurementsChart({ entries, unitSystem }) {
  const [range, setRange] = useState('3m');
  const [metric, setMetric] = useState('weight_kg');

  const { chartData, displayUnit, metricDef } = useMemo(() => {
    const def = METRIC_OPTIONS.find((m) => m.key === metric);
    const rangeDef = RANGES.find((r) => r.key === range);
    const cutoff = rangeDef.days
      ? new Date(Date.now() - rangeDef.days * 24 * 60 * 60 * 1000)
      : null;

    const filtered = entries
      .filter((e) => e[metric] != null)
      .filter((e) => !cutoff || new Date(e.measured_at) >= cutoff)
      .slice()
      .sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at));

    let unit = '';
    if (def.unitOverride) unit = def.unitOverride;
    else if (def.isWeight) unit = unitSystem === 'imperial' ? 'lb' : 'kg';
    else if (metric !== 'body_fat_percent') unit = unitSystem === 'imperial' ? 'in' : 'cm';

    const points = filtered.map((e) => {
      let value = Number(e[metric]);
      if (def.isWeight && unitSystem === 'imperial') value = kgToLbs(value);
      else if (!def.isWeight && metric !== 'body_fat_percent' && unitSystem === 'imperial') {
        value = cmToInches(value);
      }
      return {
        date: e.measured_at.slice(0, 10),
        value: Number(value.toFixed(2)),
      };
    });

    return { chartData: rollingAverage(points, 7), displayUnit: unit, metricDef: def };
  }, [entries, range, metric, unitSystem]);

  const formatTick = (d) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{
      background: C.card,
      border: C.border,
      borderRadius: 14,
      padding: '14px 12px',
      marginBottom: 12,
    }}>
      {/* Metric selector */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto',
      }}>
        {METRIC_OPTIONS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            style={{
              flexShrink: 0,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: metric === m.key ? 'rgba(216,90,48,0.2)' : 'rgba(255,255,255,0.04)',
              color: metric === m.key ? C.accent : C.textSec,
              fontSize: 11,
              fontWeight: metric === m.key ? 600 : 400,
              cursor: 'pointer',
              minHeight: 36,
              whiteSpace: 'nowrap',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Range selector */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 12,
        background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3,
      }}>
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: 6,
              border: 'none',
              background: range === r.key ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: range === r.key ? C.text : C.textSec,
              fontSize: 11,
              fontWeight: range === r.key ? 600 : 400,
              cursor: 'pointer',
              minHeight: 32,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', height: 220 }}>
        {chartData.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.textMuted, fontSize: 13,
          }}>
            No data in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
                stroke="rgba(255,255,255,0.35)"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.35)"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}${displayUnit}`}
                width={52}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#0c1222',
                  border: '0.5px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#fff',
                }}
                labelFormatter={formatTick}
                formatter={(value, name) => [`${Number(value).toFixed(1)}${displayUnit}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="value"
                name={metricDef.label}
                stroke={C.accent}
                strokeWidth={2}
                dot={{ r: 2.5, fill: C.accent }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="avg"
                name="7-day avg"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

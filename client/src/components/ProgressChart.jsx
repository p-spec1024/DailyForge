import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GOLD } from './workout/tokens.jsx';

// Reusable progression line chart.
// Props:
//   data       — array of { date, [dataKey], [prKey] }
//   dataKey    — field to plot (weight | hold_seconds | max_hold_seconds)
//   color      — line color
//   prKey      — field name marking a best/PR (is_pr | is_best)
//   unit       — label suffix ("kg", "s")
//   height     — chart height (default 220)
export default function ProgressChart({ data = [], dataKey = 'weight', color = '#f59e0b', prKey = 'is_pr', unit = '', height = 220 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.02)', borderRadius: 12,
        border: '0.5px solid rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.35)', fontSize: 13,
      }}>
        No data yet — log a session to see progress.
      </div>
    );
  }

  // Custom dot renderer: gold + larger when the point is a PR/best.
  // This is more reliable than ReferenceDot, which depends on the x-value
  // matching the category axis exactly and silently no-ops on type mismatch.
  const renderDot = (props) => {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null) return null;
    const isPr = payload && payload[prKey];
    if (isPr) {
      return (
        <g key={`dot-${index}`}>
          {/* Soft glow */}
          <circle cx={cx} cy={cy} r={9} fill={GOLD} fillOpacity={0.25} />
          <circle cx={cx} cy={cy} r={6} fill={GOLD} stroke="#fff" strokeWidth={1.5} />
        </g>
      );
    }
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={color} />
    );
  };

  // Short date formatter (Apr 10)
  const formatTick = (d) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatValue = (v) => {
    if (dataKey === 'hold_seconds' || dataKey === 'max_hold_seconds') {
      const mins = Math.floor(v / 60);
      const secs = v % 60;
      if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}`;
      return `${secs}s`;
    }
    return `${v}${unit}`;
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            stroke="rgba(255,255,255,0.35)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="rgba(255,255,255,0.35)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
            width={48}
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
            formatter={(value) => [formatValue(value), '']}
            separator=""
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={renderDot}
            activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 1 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * ChartRenderer.tsx
 *
 * Renders a live, interactive chart using Recharts.
 * Supports: Bar, Line, Area, Pie, Doughnut, Radar chart types.
 * Reads directly from ChartElement data and options.
 */

import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartElement } from '@/core/schema';

// ─── colour palette ───────────────────────────────────────────────────────────

const PALETTE = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981',
  '#f43f5e', '#a78bfa', '#34d399', '#fb923c',
  '#60a5fa', '#e879f9',
];

function getColor(ds: ChartElement['data']['datasets'][0], index: number): string {
  if (typeof ds.color === 'string' && ds.color) return ds.color;
  if (Array.isArray(ds.color) && ds.color[index]) return ds.color[index];
  return PALETTE[index % PALETTE.length];
}

function getColors(ds: ChartElement['data']['datasets'][0]): string[] {
  if (Array.isArray(ds.color)) return ds.color;
  const base = typeof ds.color === 'string' && ds.color ? ds.color : PALETTE[0];
  return [base, ...PALETTE.slice(1)];
}

// ─── shared axis style ────────────────────────────────────────────────────────

const AXIS_STYLE = { fontSize: 11, fill: '#9ca3af' };
const GRID_STYLE = { stroke: 'rgba(255,255,255,0.06)' };
const TOOLTIP_STYLE = {
  backgroundColor: '#1e2433',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e5e7eb',
};

// ─── ChartRenderer ────────────────────────────────────────────────────────────

interface Props {
  element: ChartElement;
}

export default function ChartRenderer({ element }: Props) {
  const { chartType, data, options = {} } = element;
  const {
    showLegend = true,
    showGrid   = true,
    showLabels = true,
    stacked    = false,
  } = options;

  // Transform labels + datasets → recharts data format: [{ name, ds0, ds1, … }]
  const chartData = data.labels.map((label, li) => {
    const row: Record<string, string | number> = { name: label };
    data.datasets.forEach((ds, di) => {
      row[ds.label || `Series ${di + 1}`] = ds.data[li] ?? 0;
    });
    return row;
  });

  // For Pie/Doughnut: flatten to [{ name, value, fill }]
  const pieData = data.labels.map((label, li) => ({
    name: label,
    value: data.datasets[0]?.data[li] ?? 0,
    fill: getColors(data.datasets[0] ?? { label: '', data: [] })[li % PALETTE.length],
  }));

  const commonProps = { data: chartData, margin: { top: 8, right: 12, left: -8, bottom: 4 } };

  // ── Bar ──────────────────────────────────────────────────────────────────────
  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...commonProps}>
          {showGrid   && <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} />}
          <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />}
          {data.datasets.map((ds, di) => (
            <Bar
              key={di}
              dataKey={ds.label || `Series ${di + 1}`}
              fill={getColor(ds, di)}
              stackId={stacked ? 'stack' : undefined}
              radius={[3, 3, 0, 0]}
              label={showLabels ? { position: 'top', fontSize: 10, fill: '#9ca3af' } : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Line ─────────────────────────────────────────────────────────────────────
  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...commonProps}>
          {showGrid   && <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} />}
          <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />}
          {data.datasets.map((ds, di) => (
            <Line
              key={di}
              type="monotone"
              dataKey={ds.label || `Series ${di + 1}`}
              stroke={getColor(ds, di)}
              strokeWidth={2.5}
              dot={{ r: 4, fill: getColor(ds, di), strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              label={showLabels ? { fontSize: 10, fill: '#9ca3af' } : undefined}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Area ─────────────────────────────────────────────────────────────────────
  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...commonProps}>
          <defs>
            {data.datasets.map((ds, di) => {
              const col = getColor(ds, di);
              return (
                <linearGradient key={di} id={`areaGrad${di}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={col} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={col} stopOpacity={0.03} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid   && <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} />}
          <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />}
          {data.datasets.map((ds, di) => {
            const col = getColor(ds, di);
            return (
              <Area
                key={di}
                type="monotone"
                dataKey={ds.label || `Series ${di + 1}`}
                stroke={col}
                strokeWidth={2.5}
                fill={`url(#areaGrad${di})`}
                stackId={stacked ? 'stack' : undefined}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── Pie ───────────────────────────────────────────────────────────────────────
  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            dataKey="value"
            label={showLabels ? ({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : undefined}
            labelLine={showLabels}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // ── Doughnut ──────────────────────────────────────────────────────────────────
  if (chartType === 'doughnut') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius="45%"
            outerRadius="75%"
            dataKey="value"
            label={showLabels ? ({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : undefined}
            labelLine={showLabels}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // ── Radar ─────────────────────────────────────────────────────────────────────
  if (chartType === 'radar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />}
          {data.datasets.map((ds, di) => {
            const col = getColor(ds, di);
            return (
              <Radar
                key={di}
                dataKey={ds.label || `Series ${di + 1}`}
                stroke={col}
                fill={col}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  // Fallback
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#6b7280', fontSize: 13, background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8,
    }}>
      📊 {chartType} chart
    </div>
  );
}

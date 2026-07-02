import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

type Param = 'temperature' | 'turbidity' | 'ph' | 'dissolvedOxygen' | 'nitrates';

interface ParamDef {
  key: Param; label: string; unit: string;
  safeMin: number; safeMax: number;
}

const PARAMS: ParamDef[] = [
  { key: 'temperature',     label: 'Temperature',      unit: '°C',   safeMin: 15,  safeMax: 30 },
  { key: 'turbidity',       label: 'Turbidity',        unit: 'NTU',  safeMin: 0,   safeMax: 5 },
  { key: 'ph',              label: 'pH Level',         unit: 'pH',   safeMin: 6.5, safeMax: 8.5 },
  { key: 'dissolvedOxygen', label: 'Dissolved Oxygen', unit: 'mg/L', safeMin: 6,   safeMax: 14 },
  { key: 'nitrates',        label: 'Nitrates',         unit: 'mg/L', safeMin: 0,   safeMax: 10 },
];

function ChartTooltip({ active, payload, label, param }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const safe = val >= param.safeMin && val <= param.safeMax;
  return (
    <div className="bg-white dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl shadow-lg px-4 py-3">
      <p className="text-2xs text-txt-muted dark:text-txt-dark-muted mb-1">{label}</p>
      <div className="flex items-baseline gap-1 mb-1.5">
        <span className="text-lg font-extrabold text-txt dark:text-txt-dark">{val}</span>
        <span className="text-xs text-txt-muted dark:text-txt-dark-muted">{param.unit}</span>
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${safe ? 'text-ok' : 'text-err'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${safe ? 'bg-ok' : 'bg-err'}`} />
        {safe ? 'Within safe range' : 'Outside safe range'}
      </div>
    </div>
  );
}

interface Props { regionName: string; }

export default function ParameterChart({ regionName }: Props) {
  const [selected, setSelected] = useState<Param>('turbidity');
  const { theme } = useTheme();
  const { timeSeriesData } = useData();
  const param = PARAMS.find(p => p.key === selected)!;
  const dk = theme === 'dark';

  const vals = timeSeriesData.map(d => (d as any)[selected] as number);
  const yMin = vals.length ? Math.floor(Math.min(Math.min(...vals), param.safeMin) * 0.9) : 0;
  const yMax = vals.length ? Math.ceil(Math.max(Math.max(...vals), param.safeMax) * 1.1) : 100;
  const ticks = timeSeriesData.filter((_, i) => i % 4 === 0).map(d => d.time);

  const lineColor = dk ? '#3B82F6' : '#2563EB';
  const grid = dk ? '#293650' : '#E2E8F0';

  return (
    <div className="card p-7">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-txt dark:text-txt-dark">Parameter Trends — {regionName}</h2>
          <p className="text-xs text-txt-muted dark:text-txt-dark-muted mt-0.5">24-hour monitoring · Safe range shown in green</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PARAMS.map(p => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                selected === p.key
                  ? 'bg-primary dark:bg-primary-dark text-white shadow-sm'
                  : 'bg-surface-subtle dark:bg-surface-subtle-dark text-txt-secondary dark:text-txt-dark-secondary hover:text-txt dark:hover:text-txt-dark'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={timeSeriesData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={`cg-${selected}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <ReferenceLine y={param.safeMax} stroke="#22C55E" strokeDasharray="6 4" strokeWidth={1} label={{ value: `Max ${param.safeMax}`, position: 'insideTopLeft', fontSize: 10, fill: '#22C55E' }} />
          <ReferenceLine y={param.safeMin} stroke="#22C55E" strokeDasharray="6 4" strokeWidth={1} label={{ value: `Min ${param.safeMin}`, position: 'insideBottomLeft', fontSize: 10, fill: '#22C55E' }} />
          <XAxis dataKey="time" ticks={ticks} tick={{ fontSize: 11, fill: dk ? '#64748B' : '#94A3B8' }} axisLine={false} tickLine={false} dy={8} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: dk ? '#64748B' : '#94A3B8' }} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={(props: any) => <ChartTooltip {...props} param={param} />} cursor={{ stroke: grid, strokeWidth: 1 }} />
          <Area type="monotone" dataKey={selected} stroke={lineColor} strokeWidth={2.5} fill={`url(#cg-${selected})`} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: dk ? '#212B3D' : '#FFFFFF', fill: lineColor }} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-6 mt-5 pt-4 border-t border-line dark:border-line-dark">
        <div className="flex items-center gap-2">
          <span className="w-5 h-0.5 rounded-full bg-primary dark:bg-primary-dark" />
          <span className="text-xs text-txt-muted dark:text-txt-dark-muted">{param.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-0.5 rounded-full bg-ok" style={{ borderTop: '2px dashed #22C55E' }} />
          <span className="text-xs text-txt-muted dark:text-txt-dark-muted">Safe range ({param.safeMin}–{param.safeMax} {param.unit})</span>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { ArrowUpRight } from 'lucide-react';

type Param = 'temperature' | 'turbidity' | 'ph' | 'dissolvedOxygen' | 'nitrates';

interface ParamDef {
  key: Param; label: string; unit: string;
  safeMin: number; safeMax: number; explain: string;
}

const PARAMS: ParamDef[] = [
  { key: 'temperature',     label: 'Temperature',      unit: '°C',   safeMin: 15,  safeMax: 30,   explain: 'Should stay between 15–30 °C. High temps reduce dissolved oxygen.' },
  { key: 'turbidity',       label: 'Turbidity',        unit: 'NTU',  safeMin: 0,   safeMax: 5,    explain: 'Water cloudiness. Below 5 NTU is safe for drinking.' },
  { key: 'ph',              label: 'pH Level',         unit: 'pH',   safeMin: 6.5, safeMax: 8.5,  explain: 'Healthy range is 6.5–8.5. Outside this, water is unsafe.' },
  { key: 'dissolvedOxygen', label: 'Dissolved Oxygen', unit: 'mg/L', safeMin: 6,   safeMax: 14,   explain: 'Below 6 mg/L signals pollution.' },
  { key: 'nitrates',        label: 'Nitrates',         unit: 'mg/L', safeMin: 0,   safeMax: 10,   explain: 'From fertiliser runoff. Below 10 mg/L is safe.' },
];

function ChartTooltip({ active, payload, label, param }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const safe = val >= param.safeMin && val <= param.safeMax;
  return (
    <div className="bg-white dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl shadow-lg px-4 py-3">
      <p className="text-2xs text-txt-muted dark:text-txt-dark-muted mb-1">{label}</p>
      <div className="flex items-baseline gap-1 mb-2">
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

export default function WaterQualityChart() {
  const [selected, setSelected] = useState<Param>('turbidity');
  const { theme } = useTheme();
  const { timeSeriesData } = useData();
  const param = PARAMS.find(p => p.key === selected)!;
  const dk = theme === 'dark';

  const vals = timeSeriesData.map(d => (d as any)[selected] as number);
  const yMin = vals.length ? Math.floor(Math.min(Math.min(...vals), param.safeMin) * 0.9) : 0;
  const yMax = vals.length ? Math.ceil(Math.max(Math.max(...vals), param.safeMax) * 1.1) : 100;
  const ticks = timeSeriesData.filter((_, i) => i % 4 === 0).map(d => d.time);

  const lineColor = dk ? '#60A5FA' : '#2563EB';
  const grid = dk ? '#1E293B' : '#E2E8F0';

  return (
    <div className="card p-7">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-txt dark:text-txt-dark">Water Quality Trend</h2>
            <ArrowUpRight size={14} className="text-txt-muted dark:text-txt-dark-muted" />
          </div>
          <p className="text-xs text-txt-muted dark:text-txt-dark-muted mt-0.5">24-hour monitoring · {param.explain}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PARAMS.map(p => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                selected === p.key
                  ? 'bg-primary dark:bg-primary-dark text-white dark:text-[#0C1425] shadow-sm'
                  : 'bg-surface-subtle dark:bg-surface-subtle-dark text-txt-secondary dark:text-txt-dark-secondary hover:text-txt dark:hover:text-txt-dark'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={timeSeriesData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={`cg-${selected}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <ReferenceArea y1={param.safeMin} y2={param.safeMax} fill={dk ? 'rgba(34,197,94,0.03)' : 'rgba(34,197,94,0.04)'} stroke="none" />
          <ReferenceLine y={param.safeMax} stroke="#22C55E" strokeDasharray="6 4" strokeWidth={1} label={{ value: `Max ${param.safeMax}`, position: 'insideTopLeft', fontSize: 10, fill: '#22C55E' }} />
          <ReferenceLine y={param.safeMin} stroke="#22C55E" strokeDasharray="6 4" strokeWidth={1} label={{ value: `Min ${param.safeMin}`, position: 'insideBottomLeft', fontSize: 10, fill: '#22C55E' }} />
          <XAxis dataKey="time" ticks={ticks} tick={{ fontSize: 11, fill: dk ? '#64748B' : '#94A3B8' }} axisLine={false} tickLine={false} dy={8} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: dk ? '#64748B' : '#94A3B8' }} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={(props: any) => <ChartTooltip {...props} param={param} />} cursor={{ stroke: grid, strokeWidth: 1 }} />
          <Area type="monotone" dataKey={selected} stroke={lineColor} strokeWidth={2.5} fill={`url(#cg-${selected})`} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: dk ? '#111722' : '#FFFFFF', fill: lineColor }} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-6 mt-5 pt-4 border-t border-line dark:border-line-dark">
        <div className="flex items-center gap-2">
          <span className="w-5 h-0.5 rounded-full bg-primary dark:bg-primary-dark" />
          <span className="text-xs text-txt-muted dark:text-txt-dark-muted">{param.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }} />
          <span className="text-xs text-txt-muted dark:text-txt-dark-muted">Safe zone</span>
        </div>
      </div>
    </div>
  );
}

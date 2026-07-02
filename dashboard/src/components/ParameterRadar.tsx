import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { ArrowUpRight } from 'lucide-react';

export default function ParameterRadar() {
  const { theme } = useTheme();
  const { currentReadings } = useData();
  const dk = theme === 'dark';

  const data = currentReadings.map(r => {
    const range = r.safeMax - r.safeMin;
    return { parameter: r.name, score: Math.round(Math.min(100, Math.max(0, ((r.value - r.safeMin) / range) * 100))) };
  });

  const color = dk ? '#60A5FA' : '#2563EB';

  return (
    <div className="card p-7">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-bold text-txt dark:text-txt-dark">Parameter Health</h2>
        <ArrowUpRight size={14} className="text-txt-muted dark:text-txt-dark-muted" />
      </div>
      <p className="text-xs text-txt-muted dark:text-txt-dark-muted mb-4">Position within safe range</p>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke={dk ? '#1E293B' : '#E2E8F0'} />
          <PolarAngleAxis dataKey="parameter" tick={{ fontSize: 10, fill: dk ? '#64748B' : '#94A3B8', fontWeight: 600 }} />
          <Radar name="Level" dataKey="score" stroke={color} fill={color} fillOpacity={dk ? 0.06 : 0.08} strokeWidth={2} />
          <Tooltip
            formatter={(v: any) => [`${v}%`, 'In safe range']}
            contentStyle={{ fontSize: 11, fontWeight: 600, borderRadius: 12, border: dk ? '1px solid #1E293B' : '1px solid #E2E8F0', background: dk ? '#111722' : '#FFFFFF', color: dk ? '#E2E8F0' : '#0F172A' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

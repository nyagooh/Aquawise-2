import { SensorReading } from '../data/mockData';
import { getSensorRisk, getSensorPercent } from '../utils/riskCalculator';
import { Thermometer, Droplets, FlaskConical, Wind, Zap, Leaf } from 'lucide-react';

interface Props { reading: SensorReading; }

const icons: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  turbidity: Droplets,
  ph: FlaskConical,
  dissolved_oxygen: Wind,
  conductivity: Zap,
  nitrates: Leaf,
};

const cfg = {
  safe:    { bar: '#2563EB', label: 'Normal',   color: '#22C55E', bg: 'rgba(34,197,94,0.06)' },
  warning: { bar: '#EAB308', label: 'Elevated', color: '#EAB308', bg: 'rgba(234,179,8,0.06)' },
  danger:  { bar: '#EF4444', label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.06)' },
};

export default function SensorCard({ reading }: Props) {
  const risk = getSensorRisk(reading);
  const pct  = getSensorPercent(reading);
  const c    = cfg[risk];
  const Icon = icons[reading.id] || Droplets;

  return (
    <div className="card px-5 py-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/6 dark:bg-primary-dark/8">
            <Icon size={16} className="text-primary dark:text-primary-dark" />
          </div>
          <span className="text-sm font-semibold text-txt dark:text-txt-dark truncate">{reading.name}</span>
        </div>
        {reading.isReal && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/6 text-primary dark:bg-primary-dark/8 dark:text-primary-dark">Live</span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-2xl font-extrabold tracking-tight text-txt dark:text-txt-dark">{reading.value}</span>
        <span className="text-xs text-txt-muted dark:text-txt-dark-muted">{reading.unit}</span>
      </div>

      <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-3" style={{ background: c.bg, color: c.color }}>{c.label}</span>

      <div className="h-1.5 rounded-full overflow-hidden bg-line dark:bg-line-dark">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.bar }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-2xs text-txt-muted dark:text-txt-dark-muted">{reading.safeMin}</span>
        <span className="text-2xs text-txt-muted dark:text-txt-dark-muted">{reading.safeMax}</span>
      </div>
    </div>
  );
}

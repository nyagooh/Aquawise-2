import { RiskScore } from '../utils/riskCalculator';
import { ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props { risk: RiskScore; }

const levelCfg = {
  safe:    { color: '#3CBF7A', bg: 'rgba(60,191,122,0.06)' },
  warning: { color: '#F4B740', bg: 'rgba(244,183,64,0.06)' },
  danger:  { color: '#E85D5D', bg: 'rgba(232,93,93,0.06)' },
};

export default function RiskGauge({ risk }: Props) {
  const { theme } = useTheme();
  const dk = theme === 'dark';
  const c = levelCfg[risk.level];
  const r = 72, circ = Math.PI * r, off = circ - (risk.score / 100) * circ;
  // Gauge track uses primary palette for harmony
  const trackColor = dk ? '#1E1C2E' : '#EBE8F5';

  return (
    <div className="card p-7 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-txt dark:text-txt-dark">Overall Risk</h2>
        <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: c.bg, color: c.color }}>{risk.label}</span>
      </div>

      <div className="flex flex-col items-center my-4">
        <div className="relative">
          <svg width="180" height="100" viewBox="0 0 180 100">
            <path d="M 11 90 A 79 79 0 0 1 169 90" fill="none" stroke={trackColor} strokeWidth="14" strokeLinecap="round" />
            <path d="M 11 90 A 79 79 0 0 1 169 90" fill="none" stroke={c.color} strokeWidth="14" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-4xl font-extrabold leading-none" style={{ color: c.color }}>{risk.score}</span>
            <span className="text-xs text-txt-muted dark:text-txt-dark-muted mt-0.5">/ 100</span>
          </div>
        </div>
        <div className="flex w-44 justify-between text-[10px] font-semibold mt-1">
          <span className="text-ok">Safe</span>
          <span className="text-warn">Caution</span>
          <span className="text-err">Danger</span>
        </div>
      </div>

      <div className="rounded-2xl p-5 mt-auto" style={{ background: c.bg }}>
        <p className="text-xs font-bold mb-1.5" style={{ color: c.color }}>What this means</p>
        <p className="text-xs text-txt-secondary dark:text-txt-dark-secondary leading-relaxed">{risk.recommendation}</p>
      </div>

      {risk.factors.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-txt-muted dark:text-txt-dark-muted">Contributing factors</p>
          {risk.factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-surface-subtle dark:bg-surface-subtle-dark rounded-xl px-3 py-2.5">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.impact === 'high' ? 'bg-err' : 'bg-warn'}`} />
              <p className="text-xs text-txt-secondary dark:text-txt-dark-secondary leading-snug">{f.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl p-3 mt-4" style={{ background: 'rgba(60,191,122,0.05)' }}>
          <ShieldCheck size={15} className="text-ok flex-shrink-0" />
          <p className="text-xs font-medium text-ok">All parameters within safe limits</p>
        </div>
      )}
    </div>
  );
}

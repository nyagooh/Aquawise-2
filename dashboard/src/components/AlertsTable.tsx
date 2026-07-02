import { AlertTriangle, CheckCircle, XCircle, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { useData } from '../context/DataContext';

interface Props { selectedRegion: string; }

const cfg = {
  safe:    { icon: <CheckCircle size={14} />, color: '#22C55E', bg: 'rgba(34,197,94,0.06)',  label: 'Resolved' },
  warning: { icon: <AlertTriangle size={14} />, color: '#EAB308', bg: 'rgba(234,179,8,0.06)', label: 'Warning' },
  danger:  { icon: <XCircle size={14} />,       color: '#EF4444', bg: 'rgba(239,68,68,0.06)',  label: 'Critical' },
  info:    { icon: <CheckCircle size={14} />,    color: '#2563EB', bg: 'rgba(37,99,235,0.06)', label: 'Info' },
};

type Filter = 'all' | 'danger' | 'warning' | 'safe';

export default function AlertsTable({ selectedRegion }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const { recentAlerts } = useData();

  // Filter by region first, then by severity
  const regionAlerts = selectedRegion === 'all' ? recentAlerts : recentAlerts.filter(a => a.regionId === selectedRegion);
  const filtered = filter === 'all' ? regionAlerts : regionAlerts.filter(a => a.risk === filter);
  const displayed = showAll ? filtered : filtered.slice(0, 4);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'danger', label: 'Critical' },
    { key: 'warning', label: 'Warning' },
    { key: 'safe', label: 'Resolved' },
  ];

  return (
    <div className="card p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-txt dark:text-txt-dark">Recent Alerts</h2>
            <ArrowUpRight size={14} className="text-txt-muted dark:text-txt-dark-muted" />
          </div>
          <p className="text-sm text-txt-muted dark:text-txt-dark-muted mt-0.5">
            {regionAlerts.length} alert{regionAlerts.length !== 1 ? 's' : ''}{selectedRegion !== 'all' ? ' in this region' : ' · Kisumu stations'}
          </p>
        </div>
        <div className="hidden sm:flex gap-1.5">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setShowAll(false); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                filter === f.key
                  ? 'bg-primary dark:bg-primary-dark text-white dark:text-[#1A2332] shadow-sm'
                  : 'bg-surface-subtle dark:bg-surface-subtle-dark text-txt-secondary dark:text-txt-dark-secondary hover:text-txt dark:hover:text-txt-dark'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle size={24} className="mx-auto text-ok mb-2" />
          <p className="text-sm text-txt-secondary dark:text-txt-dark-secondary">No alerts for this region</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(a => {
            const c = cfg[a.risk];
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-surface-subtle/40 dark:hover:bg-surface-subtle-dark/40 transition-colors">
                <div className="rounded-lg p-2.5 flex-shrink-0" style={{ background: c.bg }}>
                  <span style={{ color: c.color }}>{c.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-txt dark:text-txt-dark">{a.source}</span>
                    <span className="text-txt-muted dark:text-txt-dark-muted opacity-30">·</span>
                    <span className="text-sm text-txt-secondary dark:text-txt-dark-secondary">{a.parameter}</span>
                    <span className="text-sm font-semibold text-txt dark:text-txt-dark">{a.value}</span>
                  </div>
                  <p className="text-xs text-txt-muted dark:text-txt-dark-muted mt-0.5 truncate">{a.action}</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0" style={{ background: c.bg, color: c.color }}>{c.label}</span>
                <span className="text-xs text-txt-muted dark:text-txt-dark-muted flex-shrink-0 w-20 text-right">{a.time}</span>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-4 py-3 text-sm font-semibold text-primary dark:text-primary-dark rounded-xl hover:bg-surface-subtle/50 dark:hover:bg-surface-subtle-dark/50 transition-colors"
        >
          {showAll ? 'Show less' : `View all ${filtered.length} alerts`}
        </button>
      )}
    </div>
  );
}

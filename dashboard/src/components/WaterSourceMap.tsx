import { ArrowUpRight } from 'lucide-react';
import { useData } from '../context/DataContext';

interface Props { selectedRegion: string; }

const cfg = {
  safe:    { color: '#22C55E', label: 'Safe' },
  warning: { color: '#EAB308', label: 'Caution' },
  danger:  { color: '#EF4444', label: 'Danger' },
};

export default function WaterSourceMap({ selectedRegion }: Props) {
  const { waterSources } = useData();
  const stations = selectedRegion === 'all' ? waterSources : waterSources.filter(s => s.regionId === selectedRegion);

  return (
    <div className="card p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-txt dark:text-txt-dark">Monitoring Stations</h2>
            <ArrowUpRight size={14} className="text-txt-muted dark:text-txt-dark-muted" />
          </div>
          <p className="text-sm text-txt-muted dark:text-txt-dark-muted mt-0.5">{stations.length} station{stations.length !== 1 ? 's' : ''} · Kisumu</p>
        </div>
        <div className="flex gap-4">
          {(['safe', 'warning', 'danger'] as const).map(r => {
            const n = stations.filter(s => s.risk === r).length;
            return n ? (
              <div key={r} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: cfg[r].color }} />
                <span className="text-sm font-medium text-txt-secondary dark:text-txt-dark-secondary">{n}</span>
              </div>
            ) : null;
          })}
        </div>
      </div>

      {stations.length === 0 ? (
        <p className="text-center py-8 text-sm text-txt-muted dark:text-txt-dark-muted">No stations in this region</p>
      ) : (
        <div className="space-y-2">
          {stations.map(s => {
            const c = cfg[s.risk];
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-subtle/50 dark:bg-surface-subtle-dark/50 hover:bg-surface-subtle dark:hover:bg-surface-subtle-dark transition-colors">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <p className="flex-1 text-sm font-medium text-txt dark:text-txt-dark truncate">{s.name}</p>
                <span className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</span>
                <span className="text-xs text-txt-muted dark:text-txt-dark-muted w-20 text-right flex-shrink-0">{s.lastUpdated}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

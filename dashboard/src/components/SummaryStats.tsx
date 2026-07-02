import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { useData } from '../context/DataContext';

interface Props { selectedRegion: string; }

export default function SummaryStats({ selectedRegion }: Props) {
  const { setActivePage } = useNavigation();
  const { waterSources, recentAlerts, regionPredictions } = useData();

  const stations = selectedRegion === 'all' ? waterSources : waterSources.filter(s => s.regionId === selectedRegion);
  const alerts = selectedRegion === 'all' ? recentAlerts : recentAlerts.filter(a => a.regionId === selectedRegion);
  const activeAlerts = alerts.filter(a => a.risk === 'danger' || a.risk === 'warning').length;
  const safe = stations.filter(s => s.risk === 'safe').length;

  const regions = selectedRegion === 'all' ? regionPredictions : regionPredictions.filter(r => r.id === selectedRegion);
  const avgRisk = regions.length > 0 ? Math.round(regions.reduce((s, r) => s + r.contaminationProbability, 0) / regions.length) : 0;

  const stats = [
    { label: 'Monitoring Stations', value: stations.length, change: selectedRegion === 'all' ? '+2' : '', sub: selectedRegion === 'all' ? 'this week' : 'in region', up: true, onClick: () => setActivePage('stations') },
    { label: 'Stations Safe', value: `${safe}/${stations.length}`, change: 'Stable', sub: 'no change', up: true, onClick: () => setActivePage('stations') },
    { label: 'Active Alerts', value: activeAlerts, change: activeAlerts > 0 ? 'Monitor' : 'Clear', sub: activeAlerts > 0 ? 'need attention' : 'all clear', up: activeAlerts === 0, onClick: () => setActivePage('alerts') },
    { label: 'Contamination Risk', value: `${avgRisk}%`, change: avgRisk < 30 ? 'Low' : avgRisk < 50 ? 'Moderate' : 'High', sub: '7-day forecast', up: avgRisk < 40, onClick: () => setActivePage('predictions') },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <button key={i} onClick={s.onClick} className="card px-6 py-5 text-left group relative">
          <ArrowUpRight size={15} className="absolute top-4 right-4 text-primary/20 dark:text-primary-dark/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-sm text-txt-secondary dark:text-txt-dark-secondary">{s.label}</p>
          <p className="text-2xl font-extrabold text-txt dark:text-txt-dark tracking-tight mt-1">{s.value}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {s.change && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${s.up ? 'text-primary dark:text-primary-dark' : 'text-txt-muted dark:text-txt-dark-muted'}`}>
                {s.up ? <TrendingUp size={12} /> : <Minus size={12} />}
                {s.change}
              </span>
            )}
            <span className="text-xs text-txt-muted dark:text-txt-dark-muted">{s.sub}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

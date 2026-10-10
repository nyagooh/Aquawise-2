import { Link, useLocation } from 'react-router-dom';
import { useOps } from '../demo/model';

export type Active = 'overview' | 'network' | 'monitoring' | 'alerts' | 'assets' | 'reports';

const I = (d: JSX.Element) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const NAV_ICONS: Record<string, JSX.Element> = {
  overview:   I(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /></>),
  network:    I(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>),
  monitoring: I(<><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></>),
  alerts:     I(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" /><path d="M10 21h4" /></>),
  nrw:        I(<><rect x={4} y={4} width={16} height={16} rx={3} /><circle cx={12} cy={12} r={3.5} /></>),
  assets:     I(<><path d="M12 3 3 7.5 12 12l9-4.5L12 3z" /><path d="m3 12 9 4.5 9-4.5" /><path d="m3 16.5 9 4.5 9-4.5" /></>),
  reports:    I(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>),
  quality:    I(<><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /><path d="M9 14a3 3 0 0 0 3 3" /></>),
  pressure:   I(<><path d="M4 18a8 8 0 1 1 16 0" /><path d="m12 14 4-4" /></>),
  tanks:      I(<><rect x={5} y={3} width={14} height={18} rx={3} /><path d="M5 13h14" /></>),
  sensors:    I(<><path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0" /><circle cx={12} cy={12} r={1} /><path d="M12 13v8" /></>)
};

const ITEMS: Array<{ key: Active; label: string; href: string }> = [
  { key: 'overview',   label: 'Overview',   href: '/overview' },
  { key: 'network',    label: 'Network',    href: '/network' },
  { key: 'monitoring', label: 'Monitoring', href: '/monitoring' },
  { key: 'assets',     label: 'Assets',     href: '/assets' },
  { key: 'reports',    label: 'Reports',    href: '/reports' }
];
const MON_SUB = [
  { k: 'quality', label: 'Water Quality', href: '/monitoring/water-quality' },
  { k: 'pressure', label: 'Pressure', href: '/monitoring/pressure' },
  { k: 'tanks', label: 'Tank Levels', href: '/monitoring/tank-levels' },
  { k: 'sensors', label: 'Sensors', href: '/monitoring/sensors' }
];

export function Sidebar({ active, collapsed }: { active: Active; collapsed?: boolean; onToggle?: () => void }) {
  const ops = useOps();
  const { pathname } = useLocation();
  const offline = ops ? ops.sensors.filter(s => s.health === 'off').length : 0;
  return (
    <aside className={`sidebar aw-sb${collapsed ? ' collapsed' : ''}`}>
      <Link to="/" className="aw-sb-brand" aria-label="AquaWise home">
        <svg width={24} height={24} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M12 50 L32 14 L52 50" stroke="#1769E8" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 50 L32 14 L43 50" stroke="#1769E8" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
        </svg>
        <span className="sb-text">Aqua<b>Wise</b></span>
      </Link>
      <nav className="aw-sb-nav" aria-label="Platform">
        {ITEMS.map(item => (
          <div key={item.key}>
            <Link to={item.href} title={item.label} className={`aw-sb-link${item.key === active ? ' active' : ''}`}>
              {NAV_ICONS[item.key]}
              <span className="sb-text">{item.label}</span>
              {item.key === 'monitoring' && (
                <svg className="sb-text aw-sb-chev" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d={active === 'monitoring' ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'} /></svg>
              )}
            </Link>
            {item.key === 'monitoring' && active === 'monitoring' && !collapsed && (
              <div className="aw-sb-sub">
                {MON_SUB.map(s => (
                  <Link key={s.k} to={s.href} className={`aw-sb-sublink${pathname === s.href ? ' active' : ''}`}>
                    {NAV_ICONS[s.k]}<span>{s.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="aw-sb-utility sb-text">
        <div className="aw-sb-utility-icon">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M4 21V9l5-3v15M9 21V4l6 3v14M15 21v-9l5 2v7M2 21h20" /></svg>
        </div>
        <div>
          <b>Riverton Utility</b>
          <span><i className={offline ? 'warn' : ''} />{offline ? `Operational · ${offline} offline` : 'Operational'}</span>
        </div>
      </div>
    </aside>
  );
}

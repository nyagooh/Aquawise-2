import { Link } from 'react-router-dom';
import { alerts as allAlerts, leaks as allLeaks } from '../data';
import { useTheme } from '../theme';
import { useEffect, useState } from 'react';
import { getAuthHeaders } from '../data/network';

export type Active = 'dashboard' | 'gis' | 'alerts' | 'leaks' | 'nrw' | 'sensors' | 'reports';

const ICONS: Record<Active, JSX.Element> = {
  dashboard: <><rect x={3} y={3} width={7} height={9} /><rect x={14} y={3} width={7} height={5} /><rect x={14} y={12} width={7} height={9} /><rect x={3} y={16} width={7} height={5} /></>,
  gis:       <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx={12} cy={10} r={3} /></>,
  alerts:    <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1={12} y1={9} x2={12} y2={13} /><line x1={12} y1={17} x2={12.01} y2={17} /></>,
  leaks:     <><path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0014 0c0-5-7-12.5-7-12.5z" /><path d="M9 15a3 3 0 003 3" /></>,
  nrw:       <><line x1={18} y1={20} x2={18} y2={10} /><line x1={12} y1={20} x2={12} y2={4} /><line x1={6} y1={20} x2={6} y2={14} /></>,
  sensors:   <><circle cx={12} cy={12} r={3} /><circle cx={12} cy={12} r={9} /></>,
  reports:   <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1={16} y1={13} x2={8} y2={13} /><line x1={16} y1={17} x2={8} y2={17} /></>
};

const ITEMS: Array<{ key: Active; label: string; href: string }> = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'gis',       label: 'GIS Map',   href: '/gis' },
  { key: 'alerts',    label: 'Alerts',    href: '/alerts' },
  { key: 'leaks',     label: 'Leaks',     href: '/leaks' },
  { key: 'nrw',       label: 'NRW',       href: '/nrw' },
  { key: 'sensors',   label: 'Sensors',   href: '/sensors' },
  { key: 'reports',   label: 'Reports',   href: '/reports' }
];

export function Sidebar({ active, collapsed, onToggle }: { active: Active; collapsed?: boolean; onToggle?: () => void }) {
  const { mode, toggle } = useTheme();
  const activeAlertCount = allAlerts.filter(a => a.status === 'active').length;
  const openLeakCount = allLeaks.filter(l => l.status === 'reported' || l.status === 'dispatched').length;

  const [userProfile, setUserProfile] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getAuthHeaders()
      .then(async (headers) => {
        const res = await fetch('/api/v1/auth/me/', { headers });
        if (res.ok) {
          const profile = await res.json();
          if (profile && alive) {
            setUserProfile({
              username: profile.username || 'admin',
              role: profile.role || 'Admin'
            });
          }
        }
      })
      .catch(() => { /* ignore fallback */ });
    return () => { alive = false; };
  }, []);
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <Link to="/" className="sb-brand" style={{ color: 'inherit' }}>
        <svg width={22} height={22} viewBox="0 0 64 64" fill="none" aria-label="Aquawise" style={{ color: 'hsl(var(--primary))' }}>
          <path d="M12 50 L32 14 L52 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 50 L32 14 L43 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
          <path d="M29 50 L32 14 L35 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.22} />
        </svg>
        <span className="sb-text">Aqua<span className="accent">wise</span></span>
      </Link>
      <div className="sb-section sb-text">Platform</div>
      {onToggle && (
        <button className="theme-toggle icon-only" onClick={onToggle} title="Collapse or expand navigation">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {ITEMS.map(item => (
        <Link key={item.key} to={item.href} title={item.label} className={`sb-link${item.key === active ? ' active' : ''}`}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            {ICONS[item.key]}
          </svg>
          <span className="sb-text">{item.label}</span>
          {item.key === 'alerts' && activeAlertCount > 0 && <span className="badge">{activeAlertCount}</span>}
          {item.key === 'leaks' && openLeakCount > 0 && <span className="badge">{openLeakCount}</span>}
        </Link>
      ))}
      <div className="sb-foot">
        <button className="theme-toggle" onClick={toggle} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'}`}>
          {mode === 'dark' ? (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={12} r={4} />
              <line x1={12} y1={2} x2={12} y2={4} />
              <line x1={12} y1={20} x2={12} y2={22} />
              <line x1={4.93} y1={4.93} x2={6.34} y2={6.34} />
              <line x1={17.66} y1={17.66} x2={19.07} y2={19.07} />
              <line x1={2} y1={12} x2={4} y2={12} />
              <line x1={20} y1={12} x2={22} y2={12} />
              <line x1={4.93} y1={19.07} x2={6.34} y2={17.66} />
              <line x1={17.66} y1={6.34} x2={19.07} y2={4.93} />
            </svg>
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
          <span className="sb-text">{mode === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <div className="sb-user">
          <div className="sb-avatar" style={{ textTransform: 'uppercase' }}>
            {userProfile ? userProfile.username.substring(0, 2) : 'DM'}
          </div>
          <div className="sb-user-meta sb-text">
            <span className="sb-user-name" style={{ textTransform: 'capitalize' }}>
              {userProfile ? userProfile.username : 'Demo User'}
            </span>
            <span className="sb-user-sub">
              {userProfile ? `${userProfile.role} profile` : 'Read-only sandbox'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

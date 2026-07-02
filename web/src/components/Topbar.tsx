import { useLocation } from 'react-router-dom';
import { Search, Bell, HelpCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const titles: Record<string, string> = {
  '/': 'Network Overview',
  '/dashboard': 'Network Overview',
  '/alerts': 'Alerts',
  '/predictive': 'Predictive Analytics',
  '/statistics': 'Statistics',
  '/settings': 'Settings',
  '/account': 'Account',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? (pathname.startsWith('/locations') ? 'Location Detail' : 'AquaWatch');

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        <span>AquaWatch</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-current">{title}</span>
      </div>
      <div className="topbar-title" />
      <div className="topbar-actions">
        <div className="search-box" style={{ width: 280 }}>
          <Search size={14} color="var(--text-muted)" />
          <input type="text" placeholder="Search utilities, parameters, alerts…" />
        </div>
        <ThemeToggle />
        <button className="icon-btn" aria-label="Help"><HelpCircle size={18} /></button>
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={18} />
          <span className="dot" />
        </button>
        <div className="user-avatar" style={{ cursor: 'pointer' }}>TL</div>
      </div>
    </header>
  );
}

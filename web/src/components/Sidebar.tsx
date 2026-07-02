import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MapPin, Bell, BarChart3, TrendingUp, Settings, User, Droplets,
} from 'lucide-react';

const sections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard',  label: 'Dashboard',         icon: LayoutDashboard },
      { to: '/predictive', label: 'Predictive',        icon: TrendingUp },
      { to: '/statistics', label: 'Statistics',        icon: BarChart3 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/locations/nairobi', label: 'Locations', icon: MapPin },
      { to: '/alerts',            label: 'Alerts',    icon: Bell, badge: 3 },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/account',  label: 'Account',  icon: User },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Droplets size={22} color="var(--accent)" />
        <div className="sidebar-logo-text">Aqua<span>Watch</span></div>
      </div>
      <nav className="sidebar-nav">
        {sections.map(section => (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <item.icon className="nav-icon" size={18} />
                <span>{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/account" className="user-chip">
          <div className="user-avatar">TL</div>
          <div className="user-info">
            <div className="user-name">Tlou Letshufi</div>
            <div className="user-role">Utility Operator</div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

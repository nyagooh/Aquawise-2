import { LayoutDashboard, Droplets, MapPin, AlertTriangle, BarChart2, Settings, HelpCircle, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigation, Page } from '../context/NavigationContext';

const NAV: { icon: typeof LayoutDashboard; label: string; page: Page }[] = [
  { icon: LayoutDashboard, label: 'Dashboard',   page: 'dashboard' },
  { icon: Droplets,        label: 'Sensors',     page: 'sensors' },
  { icon: MapPin,          label: 'Stations',    page: 'stations' },
  { icon: BarChart2,       label: 'Predictions', page: 'predictions' },
  { icon: AlertTriangle,   label: 'Alerts',      page: 'alerts' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { activePage, setActivePage } = useNavigation();

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 h-full bg-white dark:bg-surface-dark border-r border-line dark:border-line-dark transition-all duration-300"
      style={{ width: collapsed ? 72 : 250 }}
    >
      <div className="flex items-center gap-3 px-5 h-[72px] flex-shrink-0">
        <img src="/logo.png" alt="" className="h-9 w-9 object-contain flex-shrink-0" />
        {!collapsed && (
          <p className="text-md font-extrabold text-txt dark:text-txt-dark leading-tight tracking-tight">
            Uhai <span className="text-primary dark:text-primary-dark">WashWise</span>
          </p>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="ml-auto p-1.5 rounded-lg text-txt-muted hover:text-txt dark:text-txt-dark-muted dark:hover:text-txt-dark transition-colors">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 pt-4 space-y-1">
        {NAV.map(({ icon: Icon, label, page }) => {
          const active = activePage === page;
          return (
            <button
              key={page}
              onClick={() => { if (collapsed) setCollapsed(false); setActivePage(page); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary text-white dark:bg-primary-dark dark:text-[#1A2332] font-semibold shadow-lg shadow-primary/25'
                  : 'text-txt-secondary dark:text-txt-dark-secondary hover:bg-surface-subtle dark:hover:bg-surface-subtle-dark hover:text-txt dark:hover:text-txt-dark'
              }`}
            >
              <Icon size={19} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-5 pt-3 space-y-1">
        {[{ icon: Settings, label: 'Settings' }, { icon: HelpCircle, label: 'Help' }].map(({ icon: Icon, label }) => (
          <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-txt-muted dark:text-txt-dark-muted hover:bg-surface-subtle dark:hover:bg-surface-subtle-dark hover:text-txt-secondary dark:hover:text-txt-dark-secondary transition-colors">
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="w-full flex items-center justify-center py-2 text-txt-muted hover:text-primary dark:hover:text-primary-dark transition-colors">
            <ChevronLeft size={16} className="rotate-180" />
          </button>
        )}
      </div>
    </aside>
  );
}

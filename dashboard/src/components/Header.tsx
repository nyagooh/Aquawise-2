import { Bell, RefreshCw, Sun, Moon, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '../context/NavigationContext';

interface Props { alertCount: number; }

export default function Header({ alertCount }: Props) {
  const [time, setTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, toggle } = useTheme();
  const { setActivePage } = useNavigation();

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <header className="flex items-center px-8 py-5 gap-5 flex-shrink-0" style={{ background: theme === 'dark' ? '#1A2332' : '#E8EEF8' }}>
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-txt dark:text-txt-dark">Welcome back, Admin!</h1>
        <p className="text-xs text-txt-muted dark:text-txt-dark-muted mt-0.5">
          {time.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          <span className="mx-2 opacity-30">·</span>
          <span className="font-mono tabular-nums">{time.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
        </p>
      </div>

      <div className="flex-1 max-w-xl mx-auto">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 dark:text-primary-dark/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search stations, sensors, alerts..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white dark:bg-surface-dark border border-line dark:border-line-dark text-sm text-txt dark:text-txt-dark placeholder:text-txt-muted/50 dark:placeholder:text-txt-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary-dark/20 focus:border-primary/30 dark:focus:border-primary-dark/30 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={toggle} className="p-3 rounded-xl bg-white dark:bg-surface-dark border border-line dark:border-line-dark text-txt-secondary dark:text-txt-dark-secondary hover:text-primary dark:hover:text-primary-dark hover:border-primary/20 transition-all">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); }} className="p-3 rounded-xl bg-white dark:bg-surface-dark border border-line dark:border-line-dark text-txt-secondary dark:text-txt-dark-secondary hover:text-primary dark:hover:text-primary-dark hover:border-primary/20 transition-all">
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => setActivePage('alerts')} className="relative p-3 rounded-xl bg-white dark:bg-surface-dark border border-line dark:border-line-dark text-txt-secondary dark:text-txt-dark-secondary hover:text-primary dark:hover:text-primary-dark hover:border-primary/20 transition-all">
          <Bell size={18} />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary dark:bg-primary-dark rounded-full text-white dark:text-[#1A2332] text-[10px] font-bold flex items-center justify-center ring-2 ring-bg dark:ring-bg-dark">{alertCount}</span>
          )}
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-line dark:border-line-dark">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-primary dark:bg-primary-dark">A</div>
          <div className="hidden xl:block">
            <p className="text-sm font-semibold text-txt dark:text-txt-dark leading-tight">Admin</p>
            <p className="text-xs text-txt-muted dark:text-txt-dark-muted">Operator</p>
          </div>
        </div>
      </div>
    </header>
  );
}

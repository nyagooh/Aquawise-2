import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label="Toggle theme"
      data-tooltip={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

import { useEffect, useState } from 'react';

const KEY = 'aquawise-theme';
type Theme = 'light' | 'dark';

function getInitial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = (document.documentElement.getAttribute('data-theme') as Theme) || getInitial();
    return t;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme(t => (t === 'light' ? 'dark' : 'light')),
  };
}

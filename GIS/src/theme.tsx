import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Mode = 'light' | 'dark';
type Ctx = { mode: Mode; toggle: () => void };

const ThemeCtx = createContext<Ctx>({ mode: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('aw-theme') as Mode | null;
    return stored || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('aw-theme', mode);
  }, [mode]);

  const toggle = () => setMode(m => (m === 'light' ? 'dark' : 'light'));
  return <ThemeCtx.Provider value={{ mode, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

export type Page = 'dashboard' | 'sensors' | 'stations' | 'predictions' | 'alerts';

interface NavContextType {
  activePage: Page;
  setActivePage: (page: Page) => void;
  sectionRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  registerSection: (id: string, el: HTMLElement | null) => void;
  scrollToSection: (page: Page) => void;
}

const NavContext = createContext<NavContextType>(null!);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePageState] = useState<Page>('dashboard');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainRef = useRef<HTMLElement | null>(null);

  const registerSection = useCallback((id: string, el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
    if (id === 'main') mainRef.current = el as HTMLElement;
  }, []);

  const scrollToSection = useCallback((page: Page) => {
    setActivePageState(page);
    if (page === 'dashboard') {
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = sectionRefs.current[page];
    if (el && mainRef.current) {
      const top = el.offsetTop - mainRef.current.offsetTop - 24;
      mainRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  const setActivePage = useCallback((page: Page) => {
    scrollToSection(page);
  }, [scrollToSection]);

  return (
    <NavContext.Provider value={{ activePage, setActivePage, sectionRefs, registerSection, scrollToSection }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavContext);
}

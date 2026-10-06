import { ReactNode, useEffect, useState } from 'react';
import { Sidebar, type Active } from './Sidebar';
import { Topbar } from './Topbar';
import '../demo/demo.css';

type Props = {
  active: Active;
  title: string;
  sub?: string;
  children: ReactNode;
  pagePadding?: boolean;
  /** Which global filters this page responds to. */
  filters?: { zone?: boolean; range?: boolean };
  /** Overrides the page heading (e.g. a greeting on Overview). */
  greeting?: string;
  headRight?: ReactNode;
  /** @deprecated retained for source compatibility — the right rail has been removed. */
  hideRightRail?: boolean;
};

export function Shell({ active, title, sub, children, pagePadding = true, filters, greeting, headRight }: Props) {
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('aw-nav-collapsed') === '1';
  });

  useEffect(() => {
    localStorage.setItem('aw-nav-collapsed', navCollapsed ? '1' : '0');
  }, [navCollapsed]);

  return (
    <div className={`app${navCollapsed ? ' nav-collapsed' : ''}`}>
      <Sidebar
        active={active}
        collapsed={navCollapsed}
        onToggle={() => setNavCollapsed(v => !v)}
      />
      <main className="main">
        <Topbar
          title={title}
          sub={sub}
          filters={filters}
          onToggleNav={() => setNavCollapsed(v => !v)}
        />
        <div className="page" style={pagePadding ? undefined : { padding: 0, flex: 1 }}>
          {pagePadding && (
            <div className="aw-pagehead">
              <div>
                <h1>{greeting ?? title}</h1>
                {sub && <p>{sub}</p>}
              </div>
              {headRight}
            </div>
          )}
          {children}
        </div>
        <footer className="app-footer">
          <div className="app-footer-contact">
            Riverton Water &amp; Sanitation Co. · <a href="mailto:info.aquawise@gmail.com">info.aquawise@gmail.com</a> · <a href="tel:+254710433161">+254 710 433 161</a> · Nairobi, Kenya
          </div>
          <div className="app-footer-copy">© 2026 Riverton Water &amp; Sanitation Co.</div>
        </footer>
      </main>
    </div>
  );
}

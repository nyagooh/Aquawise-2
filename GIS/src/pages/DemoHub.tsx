/**
 * Demo Hub — premium intermediate landing between marketing and live map.
 *
 * View-only demo: access is open (no lead-capture gate) and data upload has
 * been removed. The hub simply routes visitors into the live Riverton map.
 *
 * Routes:
 *   /demo         → single "View Your Network" entry into the live map
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../theme';
import { loadNetwork, clearUploadedNetwork, type NetworkMeta } from '../data/network';

export default function DemoHub() {
  // View-only demo: access is always open, so no gate here.
  return <ChooserView />;
}

/* ════════════════════════════════════════════════════════════
   Shared layout shell
   ════════════════════════════════════════════════════════════ */

function DemoFrame({ children }: { children: React.ReactNode }) {
  const { mode, toggle } = useTheme();
  return (
    <div className="demo-hub">
      <nav className="demo-hub-nav">
        <Link to="/" className="demo-hub-brand">
          <BrandMark />
          <span>Aqua<b>wise</b></span>
        </Link>
        <div className="demo-hub-nav-meta">
          <span className="demo-hub-pill"><span className="live-dot" />Live · Riverton Water Network</span>
          <button className="theme-toggle" onClick={toggle} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'}`}>
            {mode === 'dark' ? '☀' : '☾'} {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Chooser
   ════════════════════════════════════════════════════════════ */

function ChooserView() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<NetworkMeta | null>(null);

  useEffect(() => {
    let alive = true;
    loadNetwork()
      .then((d) => { if (alive) setMeta(d.meta); })
      .catch(() => { /* swallow — preview-only stats */ });
    return () => { alive = false; };
  }, []);

  return (
    <DemoFrame>
      <header className="demo-hub-head">
        <div className="demo-hub-eyebrow">Choose how to start</div>
        <h1>Start the live demo.</h1>
        <p>Explore the Riverton network — read-only, no sign-up required.</p>
      </header>

      <section className="demo-hub-options">
        <button
          className="demo-hub-card primary"
          onClick={() => { clearUploadedNetwork(); navigate('/gis'); }}
        >
          <div className="demo-hub-card-inner">
            <div className="demo-hub-card-head">
              <div className="demo-hub-card-icon">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx={12} cy={10} r={3} />
                </svg>
              </div>
              <div className="demo-hub-card-tag">Sandbox · live</div>
            </div>
            <h2>View Your Network</h2>
            <p>Open the live Riverton map — every pipe, valve and sensor.</p>
            <ul className="demo-hub-card-stats">
              <li>
                <strong>{meta ? meta.feature_count.toLocaleString() : '—'}</strong>
                <span>Pipe segments</span>
              </li>
              <li>
                <strong>{meta ? `${meta.total_length_km.toFixed(0)} km` : '—'}</strong>
                <span>Total length</span>
              </li>
              <li>
                <strong>{meta ? Object.keys(meta.length_km_by_zone).filter(z => z !== 'HDPE' && z !== 'CDD' && z !== 'MTY').length : '—'}</strong>
                <span>Service zones</span>
              </li>
              <li>
                <strong>{meta ? meta.asset_count : '—'}</strong>
                <span>Telemetry nodes</span>
              </li>
            </ul>
            <div className="demo-hub-card-cta">
              Enter the live map
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1={5} y1={12} x2={19} y2={12}/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </div>
        </button>
      </section>

      <footer className="demo-hub-foot">
        <div className="demo-hub-foot-cell">
          <span>Source dataset</span>
          <strong>Riverton water demo data · 2024 export</strong>
        </div>
        <div className="demo-hub-foot-cell">
          <span>Projection</span>
          <strong>WGS 84 · UTM 36S → EPSG:4326</strong>
        </div>
        <div className="demo-hub-foot-cell">
          <span>Demo policy</span>
          <strong>Read-only · no sign-up required</strong>
        </div>
      </footer>
    </DemoFrame>
  );
}

function BrandMark() {
  return (
    <svg width={22} height={22} viewBox="0 0 64 64" fill="none" aria-label="Aquawise" style={{ color: 'hsl(var(--primary))' }}>
      <path d="M12 50 L32 14 L52 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 50 L32 14 L43 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      <path d="M29 50 L32 14 L35 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.22} />
    </svg>
  );
}

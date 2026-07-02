import React from 'react';

/**
 * Exact, static recreations of the real AquaWise UI for the trailer — the same
 * DOM structure and class names the live app renders (.app / .sidebar /
 * .topbar / .ops-* dashboard / .gis-* map workspace / .side-panel), styled by
 * the app's own stylesheet (app-styles.css). No Leaflet / router, but
 * component-for-component faithful so the film shows the actual product.
 */

export const BLUE = '#2563EB';
export const FLOW = '#1FA2FF';
export const CORAL = '#EF4444';
export const AMBER = '#F59E0B';

/* ── Shell chrome (Sidebar + Topbar + page), matching components/Shell.tsx ── */

const NAV: Array<{key: string; label: string; badge?: number}> = [
  {key: 'dashboard', label: 'Dashboard'},
  {key: 'gis', label: 'GIS Map'},
  {key: 'alerts', label: 'Alerts', badge: 5},
  {key: 'leaks', label: 'Leaks', badge: 3},
  {key: 'nrw', label: 'NRW'},
  {key: 'sensors', label: 'Sensors'},
  {key: 'reports', label: 'Reports'},
];
const NAV_ICON: Record<string, React.ReactNode> = {
  dashboard: <><rect x={3} y={3} width={7} height={9}/><rect x={14} y={3} width={7} height={5}/><rect x={14} y={12} width={7} height={9}/><rect x={3} y={16} width={7} height={5}/></>,
  gis: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx={12} cy={10} r={3}/></>,
  alerts: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1={12} y1={9} x2={12} y2={13}/><line x1={12} y1={17} x2={12.01} y2={17}/></>,
  leaks: <><path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0014 0c0-5-7-12.5-7-12.5z"/><path d="M9 15a3 3 0 003 3"/></>,
  nrw: <><line x1={18} y1={20} x2={18} y2={10}/><line x1={12} y1={20} x2={12} y2={4}/><line x1={6} y1={20} x2={6} y2={14}/></>,
  sensors: <><circle cx={12} cy={12} r={3}/><circle cx={12} cy={12} r={9}/></>,
  reports: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1={16} y1={13} x2={8} y2={13}/></>,
};

const Sidebar: React.FC<{active: string}> = ({active}) => (
  <aside className="sidebar">
    <div className="sb-brand">
      <svg width={22} height={22} viewBox="0 0 64 64" fill="none" style={{color: 'hsl(var(--primary))'}}>
        <path d="M12 50 L32 14 L52 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 50 L32 14 L43 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5}/>
        <path d="M29 50 L32 14 L35 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.22}/>
      </svg>
      <span className="sb-text">Aqua<span className="accent">wise</span></span>
    </div>
    <div className="sb-section sb-text">Platform</div>
    {NAV.map((n) => (
      <div key={n.key} className={`sb-link${n.key === active ? ' active' : ''}`}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{NAV_ICON[n.key]}</svg>
        <span className="sb-text">{n.label}</span>
        {n.badge && <span className="badge">{n.badge}</span>}
      </div>
    ))}
    <div className="sb-foot">
      <div className="sb-user">
        <div className="sb-avatar">DM</div>
        <div className="sb-user-meta sb-text">
          <span className="sb-user-name">Demo User</span>
          <span className="sb-user-sub">Read-only sandbox</span>
        </div>
      </div>
    </div>
  </aside>
);

const Topbar: React.FC<{title: string; sub: string}> = ({title, sub}) => (
  <header className="topbar">
    <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
      <div>
        <div className="tb-title">{title}</div>
        <div className="tb-sub">{sub}</div>
      </div>
    </div>
    <div className="search">
      <svg className="search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/>
      </svg>
      <input className="search-input" type="search" placeholder="Search zones, sensors, pipes…" readOnly/>
    </div>
  </header>
);

export const AppFrame: React.FC<{active: string; title: string; sub: string; flush?: boolean; children: React.ReactNode}> = ({active, title, sub, flush, children}) => (
  <div className="app" style={{height: '100%'}}>
    <Sidebar active={active}/>
    <main className="main">
      <Topbar title={title} sub={sub}/>
      <div className="page" style={flush ? {padding: 0, flex: 1} : undefined}>{children}</div>
    </main>
  </div>
);

/* ── Operations Dashboard, matching pages/Dashboard.tsx ── */

const KPIS: Array<{label: string; value: string; unit: string; sub: string; tone: string}> = [
  {label: 'Pipe network', value: '716', unit: 'km', sub: '3,233 segments', tone: 'primary'},
  {label: 'Household connections', value: '8,940', unit: 'lines', sub: '156.2 km service', tone: 'primary'},
  {label: 'Reservoirs', value: '6', unit: 'tanks', sub: 'Avg fill 68%', tone: 'info'},
  {label: 'Pressure valves', value: '18', unit: 'PRVs', sub: '2 drifting', tone: 'warn'},
  {label: 'Meter valves', value: '22', unit: 'bulk', sub: 'Consumption metered', tone: 'primary'},
  {label: 'Active alerts', value: '5', unit: 'open', sub: '1 critical', tone: 'danger'},
  {label: 'Estimated NRW', value: '22.5', unit: '%', sub: 'Age-weighted estimate', tone: 'danger'},
  {label: 'Network health', value: '96', unit: '%', sub: '3,100 segments open', tone: 'safe'},
];
const CLASS_BARS = [
  {label: 'Transmission mains', km: '188.4', pct: 26, color: '#1D4ED8'},
  {label: 'Distribution mains', km: '301.7', pct: 42, color: '#0EA5E9'},
  {label: 'Household connections', km: '156.2', pct: 22, color: '#94A3B8'},
  {label: 'Backfeed (closed)', km: '41.0', pct: 6, color: '#F59E0B'},
  {label: 'Zone boundaries', km: '28.7', pct: 4, color: '#A78BFA'},
];
const MATERIALS = [
  {name: 'HDPE', km: '288.1', pct: 40, color: '#1D4ED8'},
  {name: 'uPVC', km: '201.4', pct: 28, color: '#22D3EE'},
  {name: 'PVC', km: '129.0', pct: 18, color: '#0EA5E9'},
  {name: 'GI', km: '64.6', pct: 9, color: '#94A3B8'},
  {name: 'Steel', km: '33.1', pct: 5, color: '#64748B'},
];
const AGES = [
  {bucket: 'pre-2000', count: '742', pct: 60, color: '#dc2626'},
  {bucket: '2000-2009', count: '511', pct: 42, color: '#f97316'},
  {bucket: '2010-2019', count: '980', pct: 80, color: '#22c55e'},
  {bucket: '2020+', count: '623', pct: 52, color: '#0EA5E9'},
  {bucket: 'unknown', count: '377', pct: 30, color: '#94a3b8'},
];
const ZONES = [
  {label: 'Milimani', code: 'MIL', pipes: '612', km: '128.4', pct: 18, risk: false},
  {label: 'Central Business District', code: 'CBD', pipes: '548', km: '104.1', pct: 15, risk: true},
  {label: 'Manyatta East', code: 'ME', pipes: '470', km: '92.6', pct: 13, risk: false},
  {label: 'Mamboleo · Tom Mboya', code: 'MYT', pipes: '388', km: '77.3', pct: 11, risk: false},
  {label: 'Kibos · Kajulu', code: 'KREKAJ', pipes: '301', km: '61.0', pct: 9, risk: true},
];
const ALERTS = [
  {sev: 'critical', title: 'Pressure alarm · PV-07', detail: 'Live 1.9 bar (set 3.0) — drift −1.10 bar', time: '3m ago'},
  {sev: 'warning', title: 'Reservoir level low · TANK-03', detail: 'Mamboleo at 28% (560 m³ stored)', time: '8m ago'},
  {sev: 'warning', title: 'Sensor anomaly · SN-12', detail: 'Flow 31 L/s · pressure 2.2 bar', time: '11m ago'},
  {sev: 'info', title: 'Backfeed lines closed', detail: '41 segments isolated for redundancy', time: '24h'},
];
const RES = [
  {name: 'Milimani High', id: 'TANK-01', cap: '2,400 m³', lvl: 82, color: '#22c55e', tone: 'safe', s: 'OK'},
  {name: 'CBD Central', id: 'TANK-02', cap: '1,800 m³', lvl: 64, color: '#f59e0b', tone: 'warn', s: 'Watch'},
  {name: 'Mamboleo', id: 'TANK-03', cap: '2,000 m³', lvl: 28, color: '#ef4444', tone: 'danger', s: 'Low'},
];

const ClassRow: React.FC<{label: string; km: string; pct: number; color: string}> = ({label, km, pct, color}) => (
  <div className="ops-class-row">
    <span className="ops-class-swatch" style={{background: color}}/>
    <div className="ops-class-body">
      <div className="ops-class-name">{label}</div>
      <div className="ops-class-bar"><div className="ops-class-fill" style={{width: `${pct}%`, background: color}}/></div>
    </div>
    <div className="ops-class-stat"><strong>{km} km</strong><span>{pct}%</span></div>
  </div>
);

// Individually exported cards so the trailer can spotlight each one.
export {KPIS};

export const KpiCard: React.FC<{k: typeof KPIS[number]}> = ({k}) => (
  <button className={`ops-kpi tone-${k.tone}`} disabled>
    <div className="ops-kpi-label">{k.label}</div>
    <div className="ops-kpi-value">{k.value}<span className="ops-kpi-unit">{k.unit}</span></div>
    <div className="ops-kpi-sub">{k.sub}</div>
  </button>
);

export const CompositionCard: React.FC = () => (
  <div className="ops-card">
    <div className="ops-card-head"><div><div className="ops-card-title">Network composition</div><div className="ops-card-sub">By pipe class · % of total length</div></div></div>
    <div className="ops-class-bars">{CLASS_BARS.map((b) => <ClassRow key={b.label} {...b}/>)}</div>
  </div>
);
export const MaterialsCard: React.FC = () => (
  <div className="ops-card">
    <div className="ops-card-head"><div><div className="ops-card-title">Materials in use</div><div className="ops-card-sub">5 pipe materials</div></div></div>
    <div className="ops-class-bars">{MATERIALS.map((m) => <ClassRow key={m.name} label={m.name} {...m}/>)}</div>
  </div>
);
export const AgeCard: React.FC = () => (
  <div className="ops-card">
    <div className="ops-card-head"><div><div className="ops-card-title">Age distribution</div><div className="ops-card-sub">Install date · oldest on the left</div></div></div>
    <div className="ops-age-grid">
      {AGES.map((a) => (
        <div key={a.bucket} className="ops-age-cell">
          <div className="ops-age-bar"><div className="ops-age-fill" style={{height: `${a.pct}%`, background: a.color}}/></div>
          <div className="ops-age-label"><span>{a.bucket}</span><strong>{a.count}</strong></div>
        </div>
      ))}
    </div>
  </div>
);
export const ZonesCard: React.FC = () => (
  <div className="ops-card">
    <div className="ops-card-head"><div><div className="ops-card-title">Service zones</div><div className="ops-card-sub">Ranked by pipe-length coverage</div></div><button className="btn btn-ghost btn-sm" disabled>Open map →</button></div>
    <table className="ops-zone-table">
      <thead><tr><th>Zone</th><th style={{textAlign: 'right'}}>Pipes</th><th style={{textAlign: 'right'}}>Length</th><th>Share of network</th><th style={{textAlign: 'right'}}>Status</th></tr></thead>
      <tbody>
        {ZONES.map((z) => (
          <tr key={z.code}>
            <td><strong>{z.label}</strong><div className="ops-zone-code">{z.code}</div></td>
            <td className="mono" style={{textAlign: 'right'}}>{z.pipes}</td>
            <td className="mono" style={{textAlign: 'right'}}>{z.km} km</td>
            <td><div className="ops-zone-share"><div className="ops-zone-share-fill" style={{width: `${z.pct}%`}}/><span>{z.pct}%</span></div></td>
            <td style={{textAlign: 'right'}}><span className={`pill ${z.risk ? 'warn' : 'safe'}`}><span className="dot"/>{z.risk ? 'Watch' : 'Healthy'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
export const AlertsCard: React.FC = () => (
  <div className="ops-card">
    <div className="ops-card-head"><div><div className="ops-card-title">Live alerts</div><div className="ops-card-sub">5 open · auto-generated from telemetry</div></div><button className="btn btn-ghost btn-sm" disabled>All →</button></div>
    <div className="ops-alert-list">
      {ALERTS.map((a) => (
        <div key={a.title} className={`ops-alert sev-${a.sev}`}>
          <span className="ops-alert-dot"/>
          <div className="ops-alert-body"><div className="ops-alert-title">{a.title}</div><div className="ops-alert-detail">{a.detail}</div></div>
          <div className="ops-alert-time">{a.time}</div>
        </div>
      ))}
    </div>
  </div>
);
export const ReservoirCard: React.FC = () => (
  <div className="ops-card">
    <div className="ops-card-head"><div><div className="ops-card-title">Reservoir watch</div><div className="ops-card-sub">Live fill levels · inflow / outflow · hours to empty</div></div><button className="btn btn-ghost btn-sm" disabled>Inspect on map →</button></div>
    <div className="ops-reservoir-grid">
      {RES.map((r) => (
        <div key={r.id} className="ops-reservoir">
          <div className="ops-reservoir-head">
            <div><div className="ops-reservoir-name">{r.name}</div><div className="ops-reservoir-id">{r.id} · {r.cap}</div></div>
            <span className={`pill ${r.tone}`}><span className="dot"/>{r.s}</span>
          </div>
          <div className="ops-reservoir-gauge"><div className="ops-reservoir-gauge-fill" style={{height: `${r.lvl}%`, background: r.color}}/><span className="ops-reservoir-gauge-value">{r.lvl}%</span></div>
          <div className="ops-reservoir-meta"><span>In <strong>12 L/s</strong></span><span>Out <strong>14 L/s</strong></span><span>To empty <strong>{r.lvl < 35 ? '11h' : '—'}</strong></span></div>
        </div>
      ))}
    </div>
  </div>
);

export const DashboardView: React.FC = () => (
  <>
    <section className="ops-kpi-band">{KPIS.map((k) => <KpiCard key={k.label} k={k}/>)}</section>
    <section className="ops-row ops-row-3"><CompositionCard/><MaterialsCard/><AgeCard/></section>
    <section className="ops-row ops-row-2"><ZonesCard/><AlertsCard/></section>
    <ReservoirCard/>
  </>
);

/* ── AquaWise AI co-pilot recommendation card ── */
export const AICard: React.FC<{applied?: boolean}> = ({applied}) => (
  <div className="ai-card">
    <div className="ai-card-head">
      <div className="ai-spark">
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx={12} cy={12} r={3}/></svg>
      </div>
      <div><div className="ai-title">AquaWise AI · Recommended action</div><div className="ai-sub">Validated on the hydraulic model</div></div>
      <span className="ai-conf">94% confidence</span>
    </div>
    <div className="ai-rec">Throttle <b>PV-204</b> to 2.6 bar &amp; reroute supply via <b>DMA-3</b></div>
    <div className="ai-impacts">
      <div><small>Pressure restored</small><strong>+0.6 bar</strong></div>
      <div><small>NRW impact</small><strong style={{color: '#16a34a'}}>−8%</strong></div>
      <div><small>Customers protected</small><strong>1,240</strong></div>
    </div>
    <div className="ai-foot">
      <span className="ai-badge"><span className="dot"/>Hydraulic model validated</span>
      <button className={`ai-apply${applied ? ' done' : ''}`}>{applied ? '✓ Intervention queued' : 'Apply intervention'}</button>
    </div>
  </div>
);

/* ── GIS map workspace, matching pages/GISMap.tsx ── */

const NODES: Array<[number, number]> = [
  [160, 240], [370, 160], [585, 280], [800, 150], [1040, 245], [1290, 150], [1500, 270],
  [280, 500], [520, 470], [740, 570], [980, 445], [1240, 545], [1470, 490],
  [410, 760], [690, 740], [920, 820], [1190, 740], [1450, 810],
];
const LINKS: Array<[number, number]> = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[0,7],[7,8],[8,2],[8,9],[9,10],[10,4],[10,11],[11,12],[12,6],[7,13],[13,14],[14,9],[14,15],[15,16],[16,11],[16,17]];

const MapNetwork: React.FC<{dash: number; leak?: boolean}> = ({dash, leak}) => (
  <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} viewBox="0 0 1680 920" preserveAspectRatio="xMidYMid slice">
    <defs><filter id="ng"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    {LINKS.map(([a,b], i) => (
      <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke={leak && i === 13 ? CORAL : FLOW} strokeWidth={i % 6 === 0 ? 7 : 4} opacity={0.9} strokeLinecap="round"/>
    ))}
    {LINKS.map(([a,b], i) => (
      <line key={`f${i}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="#cfeeff" strokeWidth="3" strokeDasharray="2 26" strokeDashoffset={-dash - i * 11} strokeLinecap="round" filter="url(#ng)" opacity={0.9}/>
    ))}
    {NODES.map(([x,y], i) => <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 10 : 7} fill={FLOW} stroke="#eaf6ff" strokeWidth="3"/>) }
  </svg>
);

const PIPE_LEGEND = [
  {label: 'Transmission main', count: '146', dash: false},
  {label: 'Distribution main', count: '1,204', dash: false},
  {label: 'Service connection', count: '1,663', dash: false},
  {label: 'Backfeed / closed', count: '180', dash: true},
];
const ASSET_LEGEND = [
  {label: 'Reservoir / tank', count: '6'},
  {label: 'Valve (PRV)', count: '18'},
  {label: 'Sensor', count: '26'},
];

const LegendRow: React.FC<{label: string; count: string; swatch: React.ReactNode}> = ({label, count, swatch}) => (
  <button className="gis-layer-toggle on" disabled>
    <span className="gis-lt-check">✓</span>
    <span className="gis-lt-swatch">{swatch}</span>
    <span className="gis-lt-label">{label}</span>
    <span className="gis-lt-count">{count}</span>
  </button>
);

export const GISWorkspace: React.FC<{dash?: number; leak?: boolean; sim?: string; leakPulse?: number; nomap?: boolean}> = ({dash = 0, leak, sim = 'Ready to run', leakPulse = 0, nomap}) => {
  const ok = sim.includes('success');
  const running = sim.includes('Running');
  return (
    <div className="gis-workspace">
      <div className="gis-toolbar">
        <div className="gis-basemap-tabs">
          <button className={`gis-basemap-tab${nomap ? '' : ' active'}`}>Satellite</button>
          <button className={`gis-basemap-tab${nomap ? ' active' : ''}`}>No basemap</button>
        </div>
        <button className="gis-tool" title="Fit view">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5"/></svg>
        </button>
        <div className="gis-toolbar-spacer"/>
        <button className={`gis-simulate-btn sim-${ok ? 'success' : running ? 'running' : 'idle'}`}><span className="gis-sim-dot"/>{running ? 'Running…' : 'Run simulation'}</button>
      </div>

      <div className={`gis-canvas gis-canvas--real${nomap ? ' gis-canvas--nomap' : ' gis-canvas--sat'}`}>
        <div className="gis-leaflet" style={nomap ? undefined : {background: 'radial-gradient(120% 120% at 50% 18%,#13243f,#0b1626 60%,#070d18)'}}>
          {!nomap && <div style={{position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(120,160,210,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(120,160,210,.06) 1px,transparent 1px)', backgroundSize: '46px 46px'}}/>}
          <MapNetwork dash={dash} leak={leak}/>
          {leak && (
            <div style={{position: 'absolute', left: '40%', top: '80%', transform: 'translate(-50%,-100%)'}}>
              <span style={{position: 'absolute', left: '50%', bottom: 4, width: 42, height: 42, marginLeft: -21, borderRadius: '50%', border: `4px solid ${CORAL}`, transform: `scale(${1 + leakPulse})`, opacity: 1 - leakPulse * 0.7}}/>
              <svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" fill={CORAL} stroke="#fff" strokeWidth="1.6"/></svg>
            </div>
          )}
        </div>

        <div className="gis-layer-control">
          <div className="gis-layer-control-head">
            <div><div className="gis-lc-title">Layers</div><div className="gis-lc-meta">3,193 pipes · 50 assets</div></div>
            <button className="gis-lc-collapse"><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="18 15 12 9 6 15"/></svg></button>
          </div>
          <div className="gis-layer-control-body">
            <div className="gis-lc-section">
              <div className="gis-lc-section-head"><span>Network</span></div>
              {PIPE_LEGEND.map((p) => (
                <LegendRow key={p.label} label={p.label} count={p.count} swatch={<span className="gis-pipe-swatch" style={{background: FLOW, backgroundImage: p.dash ? `repeating-linear-gradient(90deg,${FLOW} 0 6px,transparent 6px 10px)` : undefined, height: 4}}/>}/>
              ))}
            </div>
            <div className="gis-lc-section">
              <div className="gis-lc-section-head"><span>Telemetry</span></div>
              {ASSET_LEGEND.map((a, i) => (
                <LegendRow key={a.label} label={a.label} count={a.count} swatch={
                  i === 0 ? <svg width={18} height={18} viewBox="0 0 18 18"><rect x={5} y={3} width={8} height={12} rx={1.5} fill={FLOW} stroke="#fff" strokeWidth={1}/></svg>
                  : i === 1 ? <svg width={18} height={18} viewBox="0 0 18 18"><polygon points="3,4 3,14 9,9" fill={FLOW}/><polygon points="15,4 15,14 9,9" fill={FLOW}/></svg>
                  : <svg width={18} height={18} viewBox="0 0 18 18"><circle cx={9} cy={9} r={3} fill={FLOW}/><circle cx={9} cy={9} r={6} fill="none" stroke={FLOW} strokeWidth={1.4} opacity={0.5}/></svg>
                }/>
              ))}
            </div>
            <div className="gis-lc-section">
              <div className="gis-lc-section-head"><span>Link symbology</span></div>
              <select className="gis-symbology-select" value="flow" disabled><option value="flow">Flow</option></select>
            </div>
            <div className="gis-lc-section">
              <div className="gis-lc-section-head"><span>Node symbology</span></div>
              <select className="gis-symbology-select" value="pressure" disabled><option value="pressure">Pressure</option></select>
            </div>
          </div>
        </div>
      </div>

      <div className={`gis-sim-strip sim-${ok ? 'success' : running ? 'running' : 'idle'}`}>
        <div className="gis-sim-state"><span className="gis-sim-dot"/><strong>{sim}</strong></div>
        <div className="gis-sim-fields">
          <div><span>Headloss formula</span><strong>Hazen-Williams</strong></div>
          <div><span>Demand multiplier</span><strong>1.0×</strong></div>
          <div><span>Links by</span><strong>Flow</strong></div>
          <div><span>Nodes by</span><strong>Pressure</strong></div>
          <div><span>Results</span><strong>{ok ? 'Available' : 'None'}</strong></div>
        </div>
        <button className="gis-sim-run">{running ? 'Running…' : ok ? 'Re-run' : 'Run simulation'}</button>
      </div>
    </div>
  );
};

/* ── Side panel (selected asset / leak), matching components/SidePanel.tsx ── */

const labelStyle: React.CSSProperties = {fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'hsl(var(--muted-foreground))', fontWeight: 700};

export const SidePanelCard: React.FC<{kind: string; title: string; pill: {label: string; tone: string}; sections: Array<{label: string; rows: Array<[string, string, boolean?]>}>}> = ({kind, title, pill, sections}) => (
  <aside className="side-panel open" style={{position: 'relative', height: '100%', boxShadow: '0 40px 100px rgba(15,30,60,.45)'}}>
    <div className="sp-head">
      <div>
        <div style={labelStyle}>{kind}</div>
        <div style={{fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.01em', marginTop: 4}}>{title}</div>
        <div style={{marginTop: 8}}><span className={`pill ${pill.tone}`}><span className="dot"/>{pill.label}</span></div>
      </div>
      <button className="sp-close">✕</button>
    </div>
    <div className="sp-body">
      {sections.map((s, si) => (
        <React.Fragment key={s.label}>
          {si > 0 && <div style={{height: 14}}/>}
          <div className="sp-section-label">{s.label}</div>
          {s.rows.map(([l, v, mono]) => (
            <div className="sp-row" key={l}><span className="label">{l}</span><span className={`value${mono ? ' mono' : ''}`}>{v}</span></div>
          ))}
        </React.Fragment>
      ))}
    </div>
  </aside>
);

export const AssetPanel: React.FC = () => (
  <SidePanelCard kind="Pressure reducing valve" title="PV-204" pill={{label: 'Within range', tone: 'safe'}} sections={[
    {label: 'Pressure', rows: [['Set point', '3.0 bar', true], ['Live reading', '3.4 bar', true], ['Drift', '+0.40 bar', true]]},
    {label: 'Asset', rows: [['Diameter', '200 mm', true], ['Material', 'HDPE'], ['Flow', '42.8 L/s', true], ['Last service', '14 days', true]]},
    {label: 'Identifier', rows: [['Valve ID', 'PV-204', true], ['Zone', 'Milimani']]},
  ]}/>
);

export const LeakPanel: React.FC = () => (
  <SidePanelCard kind="Critical leak" title="LK-014" pill={{label: 'Reported', tone: 'danger'}} sections={[
    {label: 'Incident', rows: [['Severity', 'Critical'], ['Zone', 'Central Business District'], ['Address', 'Oginga Odinga St'], ['On pipe', 'P-01184', true], ['Est. loss', '9.4 L/s', true]]},
    {label: 'Report', rows: [['Reported', '08:42 · today', true], ['Source', 'Field crew'], ['Status', 'Dispatched']]},
  ]}/>
);

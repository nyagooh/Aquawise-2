/**
 * Landing — premium editorial direction.
 * Each section is its own composition (not eyebrow → heading → 3 cards).
 * Product imagery is cropped from the real demo; every number is drawn from
 * the same demo engine (series.ts / nrw.ts), so the page and the product agree.
 * Styles: ../landing.css (.ed-*). Always light, independent of the app theme.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hasDemoAccess } from '../access';
import { zoneLabel } from '../data/network';
import { buildNrwMonthly, ZONE_SEED } from '../demo/nrw';
import {
  series, seriesWindow, current, rangeSpec, toneFor, METRICS, QUALITY_POINTS, QUALITY_METRICS, NOW, HOURS,
  type Metric, type Point, type Tone
} from '../demo/series';
import { SparkAreaChart } from '@tremor/react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { LineChart, ChartLegend } from '../demo/charts';
import '../landing.css';

/* ═════════════ motion helpers ═════════════ */
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Adds `.in` to every `.rv` element as it scrolls into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.ed .rv');
    if (reduced()) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function useInView<T extends Element>(threshold = 0.25): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (reduced()) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen];
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(900);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Counts up to `to` once visible. */
function Count({ to, decimals = 0, prefix = '', suffix = '' }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.6);
  const [v, setV] = useState(reduced() ? to : 0);
  useEffect(() => {
    if (!seen || reduced()) { if (seen) setV(to); return; }
    let raf = 0; const start = performance.now(); const dur = 1100;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setV(to * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to]);
  return <span ref={ref}>{prefix}{v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/* ═════════════ data from the demo engine ═════════════ */
type AssetProps = Record<string, number | string>;
/** Telemetry asset snapshot (19 KB) — used for reservoir and logger bases. */
function useAssets(): Record<string, AssetProps> | null {
  const [a, setA] = useState<Record<string, AssetProps> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/data/erline-assets.geojson').then(r => r.json()).then(fc => {
      if (!alive) return;
      const m: Record<string, AssetProps> = {};
      for (const f of fc.features) m[f.properties.id] = f.properties;
      setA(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return a;
}

const WQ_SHAURI = QUALITY_POINTS.find(q => q.id === 'WQ-SHAURI')!;
const fmtClock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ═════════════ page ═════════════ */
export default function Landing() {
  const navigate = useNavigate();
  const openDemo = useCallback(() => navigate(hasDemoAccess() ? '/overview' : '/demo'), [navigate]);
  const talkToUs = useCallback(() => navigate('/request-demo?mode=book'), [navigate]);
  const assets = useAssets();
  const nrw = useMemo(() => buildNrwMonthly(), []);
  useReveal();

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="landing ed">
      <header className={`ed-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="ed-wrap ed-nav-in">
          <Link to="/" className="ed-brand" aria-label="AquaWise home"><Mark /><span>Aqua<b>Wise</b></span></Link>
          <nav aria-label="Main">
            <a href="#network">Network</a>
            <a href="#monitor">Monitoring</a>
            <a href="#quality">Water quality</a>
            <a href="#product">Product</a>
          </nav>
          <div className="ed-nav-cta">
            <button type="button" className="ed-link-btn" onClick={talkToUs}>Talk to us</button>
            <button type="button" className="ed-btn ed-btn-blue sm" onClick={openDemo}>Explore demo</button>
          </div>
        </div>
      </header>

      <main>
        <Hero onDemo={openDemo} onTalk={talkToUs} />
        <OneNetwork assets={assets} />
        <Mosaic assets={assets} nrw={nrw} />
        <Monitor assets={assets} />
        <Parameters />
        <QualityStory />
        <Infrastructure />
        <Explorer onDemo={openDemo} />
        <Outcomes />
      </main>

      <Final onDemo={openDemo} onTalk={talkToUs} />
    </div>
  );
}

/* ═════════════ 1 · HERO ═════════════ */
function Hero({ onDemo, onTalk }: { onDemo: () => void; onTalk: () => void }) {
  return (
    <section className="ed-hero">
      <div className="ed-wrap ed-hero-copy">
        <p className="ed-eyebrow rv">Water quality · Pressure · Tank levels · GIS</p>
        <h1 className="ed-hero-h rv">The smart water grid<br />for water utilities</h1>
        <p className="ed-hero-sub rv">
          Your whole network, live on one map. Spot a burst, a dirty reading or a draining tank
          the moment it happens — and fix it before your customers ever notice.
        </p>
        <div className="ed-row ed-hero-ctas rv">
          <button type="button" className="ed-btn ed-btn-blue" onClick={onDemo}>Explore demo</button>
          <button type="button" className="ed-btn ed-btn-line" onClick={onTalk}>Talk to us <span aria-hidden="true">→</span></button>
        </div>
      </div>
      <div className="ed-wrap">
        <div className="ed-hero-frame rv">
          <img className="ed-hero-bg" src="/img/treatment-plant.jpg" alt="" />
          <div className="ed-hero-shot">
            <img src="/img/ui/view-overview.webp" alt="AquaWise Overview: network health, active alerts, water quality, pressure, network map and issues needing attention" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═════════════ 2 · ONE NETWORK ═════════════ */
function OneNetwork({ assets }: { assets: Record<string, AssetProps> | null }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  const tanks = TANK_IDS;
  const capacity = assets ? tanks.reduce((s, id) => s + Number(assets[id]?.capacity_m3 ?? 0), 0) : null;
  const wtw = QUALITY_POINTS.find(q => q.id === 'WQ-WTW')!;
  const tapCl = QUALITY_POINTS.filter(q => q.zone !== 'WTW').map(q => current('chlorine', q.id, q.base.chlorine));
  const avgCl = tapCl.reduce((a, b) => a + b, 0) / tapCl.length;

  return (
    <section className="ed-sec" id="network">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>01</b> / The network</p>
        <h2 className="ed-h2 rv" style={{ gridColumn: '1 / span 9' }}>
          Every pipe. Every sensor. <span className="muted">One live map.</span>
        </h2>
        <p className="ed-aside rv" style={{ gridColumn: '9 / span 4' }}>
          Your map, your sensors and your lab results in one place. When something changes anywhere in
          the network, you see it — and you see where.
        </p>
      </div>

      <div className={`ed-flow${seen ? ' drawn' : ''}`} ref={ref}>
        <div className="ed-flow-row">
          <svg className="ed-flow-line" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="2" x2="1000" y2="2" pathLength={1} />
          </svg>
          <Stage n="01" name="Treatment" wide top={<img src="/img/treatment-plant.jpg" alt="Clarifiers at the treatment works" className="fl-img" />}
            data={`Water leaves the works at ${current('turbidity', wtw.id, wtw.base.turbidity).toFixed(2)} NTU, checked every 15 minutes.`} />
          <Stage n="02" name="Storage" top={<img src="/img/reservoir-pipes.jpg" alt="Storage reservoir and mains" className="fl-img tall" style={{ objectPosition: '32% 40%' }} />}
            data={capacity ? `${capacity.toLocaleString()} m³ across five reservoirs. You see every level, and how fast it is falling.` : 'Every reservoir level, and how fast it is falling.'} />
          <Stage n="03" name="Distribution" below top={<div className="fl-type"><b>121</b><span>km</span></div>}
            data="of mapped pipe, watched by 24 pressure loggers across five zones."
            extra={<img src="/img/field-engineers.jpg" alt="Field engineers at a valve" className="fl-img small" />} />
          <Stage n="04" name="Customer" top={<div className="fl-type"><b>{avgCl.toFixed(2)}</b><span>mg/L</span></div>}
            data="Average chlorine still in the water at five zone sampling points — protection that reaches the tap." />
        </div>
      </div>
    </section>
  );
}

function Stage({ n, name, top, data, wide, below, extra }: { n: string; name: string; top: ReactNode; data: string; wide?: boolean; below?: boolean; extra?: ReactNode }) {
  return (
    <div className={`fl-stage${wide ? ' wide' : ''}${below ? ' below' : ''}`}>
      <div className="fl-top">{top}</div>
      <div className="fl-node"><i /></div>
      <div className="fl-meta">
        <span className="fl-n">{n}</span>
        <h3>{name}</h3>
        <p>{data}</p>
        {extra}
      </div>
    </div>
  );
}

/* ═════════════ 3 · PLATFORM ═════════════ */
function Mosaic({ assets }: { assets: Record<string, AssetProps> | null; nrw?: unknown }) {
  const day = rangeSpec('24H');
  const tb = series('turbidity', WQ_SHAURI.id, WQ_SHAURI.base.turbidity, day);
  const sn14 = assets?.['SN-14'] ? series('pressure', 'SN-14', Number(assets['SN-14'].pressure_bar), day) : null;
  const t2 = assets?.['TANK-02'] ? series('level', 'TANK-02', Number(assets['TANK-02'].level_pct), day) : null;
  const last = (p: Point[] | null) => (p ? p[p.length - 1].v : null);
  return (
    <section className="ed-sec ed-tint">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 3' }}><b>02</b> / The platform</p>
        <h2 className="ed-h2 rv" style={{ gridColumn: '1 / span 7' }}>See it. Find it. <span className="muted">Fix it.</span></h2>
        <p className="ed-aside rv" style={{ gridColumn: '9 / span 4' }}>Every reading points to a real place on the map, so your crew knows exactly where to go.</p>
      </div>
      <div className="ed-wrap">
        <div className="ed-bento">
          <figure className="bx bx-map rv">
            <img src="/img/ui/crop-gis.webp" alt="AquaWise network map with pipes, valves, meters, reservoirs and sensors" />
            <figcaption><span className="ed-mini">Network map</span><b>121 km of pipe, every asset in place</b></figcaption>
          </figure>
          <StatTile label="Water quality · Shauri, Ndothua" value={last(tb)} unit="NTU" decimals={2} tone="warn"
            note="Above the safe limit since this morning." points={tb} color="amber" />
          <StatTile label="Pressure · Ziwani 3" value={last(sn14)} unit="bar" decimals={2} tone="crit"
            note="Below the 1.5 bar minimum — a likely burst." points={sn14} color="red" />
          <StatTile label="Storage · Ziwani Reservoir 2" value={last(t2)} unit="%" decimals={0} tone="warn"
            note="Emptying faster than yesterday." points={t2} color="amber" />
        </div>
      </div>
    </section>
  );
}

function StatTile({ label, value, unit, decimals, tone, note, points, color }: {
  label: string; value: number | null; unit: string; decimals: number; tone: Tone; note: string; points: Point[] | null; color: string;
}) {
  return (
    <div className="bx bx-stat rv">
      <span className="ed-mini">{label}</span>
      <div className={`bx-val ${tone}`}>{value === null ? '—' : value.toFixed(decimals)}<small>{unit}</small></div>
      <p>{note}</p>
      {points && (
        <div className="bx-spark-wrap">
          <SparkAreaChart data={points.map(p => ({ t: p.t, v: p.v }))} index="t" categories={['v']} colors={[color]} curveType="monotone" className="h-12 w-full" />
          <span className="bx-spark-cap">Last 24 hours</span>
        </div>
      )}
    </div>
  );
}

/* ═════════════ 4 · MONITORING (dark) ═════════════ */
type MonKey = 'quality' | 'pressure' | 'tanks' | 'sensors';
const TANK_IDS = ['TANK-01', 'TANK-02', 'TANK-03', 'TANK-04', 'TANK-05'];
const TANK_NAMES: Record<string, string> = { 'TANK-01': 'Ziwani 1', 'TANK-02': 'Ziwani 2', 'TANK-03': 'Ziwani 3', 'TANK-04': 'Shauri', 'TANK-05': 'Kwa Njora' };
function Monitor({ assets }: { assets: Record<string, AssetProps> | null }) {
  const [view, setView] = useState<MonKey>('quality');
  const [param, setParam] = useState<Metric>('turbidity');
  const spec = rangeSpec('CUSTOM', 2);
  const day = rangeSpec('24H');
  const data = useMemo(() => {
    if (view === 'pressure' && assets?.['SN-14']) return { metric: 'pressure' as Metric, where: 'Ziwani 3 logger SN-14', pts: series('pressure', 'SN-14', Number(assets['SN-14'].pressure_bar), spec) };
    if (view === 'tanks' && assets?.['TANK-02']) return { metric: 'level' as Metric, where: 'Ziwani Reservoir 2', pts: series('level', 'TANK-02', Number(assets['TANK-02'].level_pct), spec) };
    return { metric: param, where: 'Shauri, Ndothua kiosk', pts: series(param, WQ_SHAURI.id, WQ_SHAURI.base[param as keyof typeof WQ_SHAURI.base], spec) };
  }, [view, param, assets, spec]);
  const def = METRICS[data.metric];
  const now = data.pts[data.pts.length - 1].v;
  const weekAgo = data.pts[0].v; // start of the window
  const tone = toneFor(data.metric, now);
  const items: Array<{ k: MonKey; label: string; sub: string }> = [
    { k: 'quality', label: 'Water quality', sub: 'Five parameters, every 15 minutes' },
    { k: 'pressure', label: 'Pressure', sub: '26 loggers, drops flagged as they happen' },
    { k: 'tanks', label: 'Tank levels', sub: 'Five reservoirs, filling and emptying live' },
    { k: 'sensors', label: 'Sensors', sub: 'Battery, signal and last contact' }
  ];
  const tiles = view === 'quality'
    ? QUALITY_METRICS.map(m => {
        const pts = series(m, WQ_SHAURI.id, WQ_SHAURI.base[m as keyof typeof WQ_SHAURI.base], day);
        const v = pts[pts.length - 1].v;
        return { key: m, label: METRICS[m].label.replace('Residual chlorine', 'Chlorine'), value: v.toFixed(METRICS[m].decimals), unit: METRICS[m].unit, tone: toneFor(m, v), pts, on: m === param, onClick: () => setParam(m) };
      })
    : view === 'tanks' && assets
      ? TANK_IDS.map(id => {
          const pts = series('level', id, Number(assets[id]?.level_pct ?? 50), day);
          const v = pts[pts.length - 1].v;
          return { key: id, label: TANK_NAMES[id], value: v.toFixed(0), unit: '%', tone: toneFor('level', v), pts, on: id === 'TANK-02', onClick: undefined };
        })
      : view === 'pressure' && assets
        ? ['SN-14', 'SN-15', 'SN-16', 'SN-05'].map(id => {
            const pts = series('pressure', id, Number(assets[id]?.pressure_bar ?? 2.5), day);
            const v = pts[pts.length - 1].v;
            return { key: id, label: `Logger ${id} · Ziwani 3`, value: v.toFixed(2), unit: 'bar', tone: toneFor('pressure', v), pts, on: id === 'SN-14', onClick: undefined };
          })
        : [];

  return (
    <section className="ed-sec ed-dark" id="monitor">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>03</b> / Monitor</p>
        <h2 className="ed-h1 rv" style={{ gridColumn: '1 / span 8' }}>Live monitoring, <span className="muted">around the clock.</span></h2>
        <p className="ed-aside rv" style={{ gridColumn: '9 / span 4' }}>Every reading is checked against its safe limit the moment it arrives. If something drifts, you know straight away.</p>
      </div>
      <div className="ed-wrap ed-grid ed-mon">
        <ul className="ed-mon-nav rv" style={{ gridColumn: '1 / span 3' }}>
          {items.map(i => (
            <li key={i.k}>
              <button type="button" className={view === i.k ? 'on' : ''} onClick={() => setView(i.k)} aria-pressed={view === i.k}>
                <b>{i.label}</b><span>{i.sub}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="ed-mon-main rv" style={{ gridColumn: '4 / -1' }}>
          {view === 'sensors' ? (
            <div className="ed-mon-card ed-sensors">
              <div><b><Count to={36} /></b><span>online and reporting</span></div>
              <div><b className="warn">2</b><span>low battery or weak signal</span></div>
              <div><b className="off">2</b><span>offline · flagged automatically</span></div>
              <p>A quiet sensor isn’t the same as a quiet network. AquaWise watches the health of every device separately from what it measures, so a flat battery or lost signal is flagged before it leaves a gap in your data.</p>
            </div>
          ) : (
            <div className="ed-mon-card">
              <div className="ed-mon-head">
                <div>
                  <span className="ed-mini">{def.label} · {data.where} · last 48 hours</span>
                  <div className="ed-mon-now-row">
                    <span className={`ed-mon-now ${tone}`}>{now.toFixed(def.decimals)}<small>{def.unit}</small></span>
                    <span className={`ed-chip ${tone}`}>{tone === 'ok' ? 'Within safe range' : tone === 'warn' ? 'Outside safe range' : 'Critical'}</span>
                    <span className="ed-mon-delta">{now >= weekAgo ? '▲' : '▼'} {Math.abs(now - weekAgo).toFixed(def.decimals)}{def.unit ? ` ${def.unit}` : ''} vs 48 hours ago</span>
                  </div>
                </div>
                <span className="ed-mon-range">Safe range · {def.rangeText}</span>
              </div>
              <div className="ed-mon-chart">
                <LineChart series={[{ id: `${view}${param}`, label: def.label, points: data.pts }]} metric={data.metric}
                  band={data.metric === 'level' ? null : undefined} yMin={data.metric === 'level' ? 0 : undefined} height={340} />
              </div>
              <ChartLegend items={[
                { label: def.label, color: '#5B9BFF' },
                ...(data.metric === 'level' ? [] : [{ label: 'Safe range', color: '', band: true }]),
                { label: data.metric === 'level' ? 'Warning level' : 'Limit', color: '#E59A17', dashed: true },
                { label: 'Out of range', color: '#E59A17' }
              ]} />
            </div>
          )}
          {tiles.length > 0 && (
            <div className="ed-mon-tiles">
              {tiles.map(t => {
                const Tag = t.onClick ? 'button' : 'div';
                return (
                  <Tag key={t.key} type={t.onClick ? 'button' : undefined} className={`ed-mon-tile${t.on ? ' on' : ''}`} onClick={t.onClick}>
                    <span className="lbl"><i className={`dot ${t.tone}`} />{t.label}</span>
                    <b>{t.value}<small>{t.unit}</small></b>
                    <SparkAreaChart data={t.pts.map(p => ({ t: p.t, v: p.v }))} index="t" categories={['v']}
                      colors={[t.tone === 'ok' ? 'blue' : t.tone === 'warn' ? 'amber' : 'red']} curveType="monotone" className="h-9 w-full" />
                  </Tag>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═════════════ 4b · THE FIVE PARAMETERS ═════════════ */
const PARAMS: Array<{ m: Metric; name: string; unit: string; what: string }> = [
  { m: 'turbidity', name: 'Turbidity', unit: 'NTU',
    what: 'How clear the water is. A rise means particles in suspension — often the first sign of a treatment problem, a disturbed main or contamination.' },
  { m: 'ph', name: 'pH', unit: 'pH scale, 0–14',
    what: 'How acidic or alkaline the water is. Keeping it between 6.5 and 8.5 protects your pipes from corrosion and keeps disinfection working.' },
  { m: 'chlorine', name: 'Residual chlorine', unit: 'mg/L',
    what: 'The disinfectant still left in the water. Too little, and treated water loses its protection on the way to the tap.' },
  { m: 'conductivity', name: 'Conductivity / TDS', unit: 'µS/cm · mg/L',
    what: 'Dissolved minerals and salts. A sudden change can point to a new source, an intrusion or a change at the works.' },
  { m: 'temperature', name: 'Temperature', unit: '°C',
    what: 'Warmer water uses up chlorine faster and lets bacteria grow, so temperature tells you how hard your disinfection has to work.' }
];
function Parameters() {
  const wtw = QUALITY_POINTS.find(q => q.id === 'WQ-WTW')!;
  return (
    <section className="ed-sec ed-tint" id="quality">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>04</b> / Water quality</p>
        <h2 className="ed-h2 rv" style={{ gridColumn: '1 / span 8' }}>Five checks. <span className="muted">Safe water, proven.</span></h2>
        <p className="ed-aside rv" style={{ gridColumn: '9 / span 4' }}>
          Measured continuously at the works and in every zone, with an alert the moment any of them leaves its safe range.
        </p>
      </div>
      <div className="ed-wrap">
        <div className="ed-params-table">
          <div className="ed-pt-head" aria-hidden="true"><span>Parameter</span><span>What it tells you</span><span>At the works now</span><span>Safe range</span></div>
          {PARAMS.map(p => {
            const v = current(p.m, wtw.id, wtw.base[p.m as keyof typeof wtw.base]);
            const tds = p.m === 'conductivity' ? ` · ≈ ${Math.round(v * 0.65)} mg/L TDS` : '';
            return (
              <div key={p.m} className="ed-pt-row rv">
                <div className="ed-pt-name"><b>{p.name}</b><span>{p.unit}</span></div>
                <p className="ed-pt-what">{p.what}</p>
                <div className="ed-pt-now"><b>{v.toFixed(METRICS[p.m].decimals)}</b><span>{METRICS[p.m].unit}{tds}</span></div>
                <div className="ed-pt-range">{METRICS[p.m].rangeText}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═════════════ 5 · WATER QUALITY STORY ═════════════ */
function QualityStory() {
  // A resolved Shauri turbidity event from the demo history (22 days ago).
  const story = useMemo(() => {
    const evStart = NOW - 22 * 24 * HOURS; const evEnd = NOW - (22 * 24 - 10) * HOURS;
    const pts = seriesWindow('turbidity', WQ_SHAURI.id, WQ_SHAURI.base.turbidity, evStart - 10 * HOURS, evEnd + 12 * HOURS, 240);
    const over = pts.find(p => p.v > 1.0)!;
    const peak = pts.reduce((a, b) => (b.v > a.v ? b : a), pts[0]);
    const back = pts.find(p => p.t > peak.t && p.v <= 1.0)!;
    const rows = pts.map((p, i) => {
      const bad = (j: number) => pts[j] && pts[j].v > 1.0;
      return { t: p.t, v: p.v, hi: bad(i) || bad(i - 1) || bad(i + 1) ? p.v : null };
    });
    return {
      rows, over, peak, back,
      date: new Date(evStart).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      hours: Math.round((back.t - over.t) / HOURS)
    };
  }, []);
  const tick = { fontSize: 12, fill: '#667085' };
  const Marker = (n: number, color: string) => (props: { cx?: number; cy?: number }) => (
    <g>
      <circle cx={props.cx} cy={props.cy} r={13} fill="#fff" stroke={color} strokeWidth={2} />
      <text x={props.cx} y={(props.cy ?? 0) + 4.5} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>{n}</text>
    </g>
  );
  const steps = [
    { n: 1, color: '#E59A17', when: fmtClock(story.over.t), title: 'Breach detected', text: 'Turbidity crosses the limit and your quality team is alerted straight away.' },
    { n: 2, color: '#E59A17', when: `${story.peak.v.toFixed(2)} NTU`, title: 'Peak recorded', text: 'You see how far it went. Every reading is kept.' },
    { n: 3, color: '#16A66A', when: fmtClock(story.back.t), title: 'Back in range', text: `Clear after ${story.hours} hours, logged and ready for your report.` }
  ];
  return (
    <section className="ed-sec">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>05</b> / Over time</p>
        <h2 className="ed-h1 rv" style={{ gridColumn: '1 / span 9' }}>Every reading recorded. <span className="muted">Every event explained.</span></h2>
      </div>
      <div className="ed-wrap">
        <div className="ed-story-card rv">
          <div className="ed-story-top">
            <div>
              <span className="ed-mini">Turbidity · Shauri, Ndothua kiosk · {story.date}</span>
              <h3>An eleven-hour turbidity event, start to finish</h3>
            </div>
            <div className="ed-story-key">
              <span><i className="band" />Safe range</span><span><i className="dash" />1.0 NTU limit</span><span><i className="amb" />Above limit</span>
            </div>
          </div>
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={story.rows} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="storyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1769E8" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#1769E8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF0F3" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtClock} tick={tick} axisLine={false} tickLine={false} minTickGap={56} tickMargin={10} />
                <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={tick} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${v}`} />
                <ReferenceArea y1={0} y2={1} fill="#16A66A" fillOpacity={0.07} stroke="none" />
                <ReferenceLine y={1} stroke="#E59A17" strokeDasharray="5 5" />
                <ReferenceArea x1={story.over.t} x2={story.back.t} fill="#E59A17" fillOpacity={0.05} stroke="none" />
                <Area dataKey="v" type="monotone" stroke="#1769E8" strokeWidth={2.25} fill="url(#storyFill)" dot={false} activeDot={false} isAnimationActive={false} />
                <Line dataKey="hi" type="monotone" stroke="#E59A17" strokeWidth={3} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
                <ReferenceDot x={story.over.t} y={story.over.v} r={0} shape={Marker(1, '#E59A17')} />
                <ReferenceDot x={story.peak.t} y={story.peak.v} r={0} shape={Marker(2, '#E59A17')} />
                <ReferenceDot x={story.back.t} y={story.back.v} r={0} shape={Marker(3, '#16A66A')} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ol className="ed-story-steps">
            {steps.map(s => (
              <li key={s.n}>
                <span className="num" style={{ color: s.color, borderColor: s.color }}>{s.n}</span>
                <div><b>{s.when}</b><strong>{s.title}</strong><p>{s.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ═════════════ 6 · INFRASTRUCTURE ═════════════ */
function Infrastructure() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || reduced()) return;
    const img = el.querySelector('.ed-infra-layer') as HTMLDivElement;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const k = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
        img.style.transform = `translate3d(0, ${(k * -4).toFixed(2)}%, 0) scale(1.12)`;
      });
    };
    on(); addEventListener('scroll', on, { passive: true });
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);
  const labels: Array<{ x: number; y: number; t: string; s: string; side?: 'l' }> = [
    { x: 43, y: 50, t: 'Pressure logger', s: 'reports every 15 minutes' },
    { x: 33, y: 22, t: 'Storage reservoir', s: 'level sensor · capacity in m³', side: 'l' },
    { x: 62, y: 62, t: 'Gate valve', s: 'in the asset register and on the map' },
    { x: 84, y: 66, t: 'Treatment basin', s: 'water-quality sampling point', side: 'l' }
  ];
  return (
    <section className="ed-infra" ref={ref} aria-label="Physical infrastructure, digital intelligence">
      <div className="ed-infra-layer">
        <img src="/img/reservoir-pipes.jpg" alt="Water reservoir, distribution mains and a telemetry unit at sunset" />
        {labels.map((l, i) => (
          <span key={i} className={`ed-pin rv${l.side ? ' l' : ''}`} style={{ left: `${l.x}%`, top: `${l.y}%`, transitionDelay: `${0.2 + i * 0.15}s` }}>
            <i /><span><b>{l.t}</b>{l.s}</span>
          </span>
        ))}
      </div>
      <div className="ed-infra-shade" />
      <div className="ed-wrap ed-infra-text">
        <h2 className="ed-h1 rv">Smart sensors <span className="muted">for the pipes you can’t see.</span></h2>
      </div>
    </section>
  );
}

/* ═════════════ 8 · PRODUCT EXPLORER ═════════════ */
const VIEWS = [
  { k: 'overview', label: 'Overview', cap: 'What’s healthy, what needs attention, and where.' },
  { k: 'network', label: 'Network', cap: 'Every pipe, valve, reservoir and sensor on the map.' },
  { k: 'monitoring', label: 'Monitoring', cap: 'Water quality, pressure and tank levels over time.' },
  { k: 'alerts', label: 'Alerts', cap: 'Every alert with the readings behind it.' },
  { k: 'reports', label: 'Reports', cap: 'Regulator-ready reports in a few clicks.' }
] as const;

function Explorer({ onDemo }: { onDemo: () => void }) {
  const [i, setI] = useState(0);
  return (
    <section className="ed-sec ed-tint ed-explorer" id="product">
      <div className="ed-wrap ed-center">
        <p className="ed-label rv"><b>06</b> / The product</p>
        <h2 className="ed-h1 rv">One platform. <span className="muted">Your whole network.</span></h2>
        <div className="ed-tabs rv" role="tablist" aria-label="Product views">
          {VIEWS.map((v, j) => (
            <button key={v.k} role="tab" type="button" aria-selected={i === j} className={i === j ? 'on' : ''} onClick={() => setI(j)}>{v.label}</button>
          ))}
        </div>
        <p className="ed-tab-cap" aria-live="polite">{VIEWS[i].cap}</p>
      </div>
      <div className="ed-shot-wrap rv">
        <div className="ed-shot">
          {VIEWS.map((v, j) => (
            <img key={v.k} src={`/img/ui/view-${v.k}.webp`} alt={`AquaWise ${v.label} screen`} className={i === j ? 'on' : ''} loading={j ? 'lazy' : undefined} />
          ))}
        </div>
        <button type="button" className="ed-btn ed-btn-blue ed-shot-cta" onClick={onDemo}>Explore demo <Arrow /></button>
      </div>
    </section>
  );
}

/* ═════════════ 9 · OUTCOMES ═════════════ */
function Outcomes() {
  return (
    <section className="ed-sec">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>07</b> / In the Erline Water network</p>
        <h2 className="ed-h2 rv" style={{ gridColumn: '1 / span 8' }}>Live from <span className="muted">day one.</span></h2>
      </div>
      <div className="ed-wrap">
        <div className="ed-report">
          <div className="rv"><b><Count to={121} /><small>km</small></b><span>of pipe network mapped</span></div>
          <div className="rv"><b><Count to={192} /></b><span>assets in one register</span></div>
          <div className="rv"><b><Count to={35} /></b><span>sensors reporting from across the network</span></div>
          <div className="rv"><b><Count to={15} /><small>min</small></b><span>between readings, around the clock</span></div>
          <div className="rv"><b>24/7</b><span>monitoring, with a safe limit on every reading</span></div>
          <div className="rv"><b>One</b><span>view of your whole network</span></div>
        </div>
        <p className="ed-mini ed-source rv">Figures describe the Erline Water network in the live demo.</p>
      </div>
    </section>
  );
}

/* ═════════════ FINAL + FOOTER ═════════════ */
function Final({ onDemo, onTalk }: { onDemo: () => void; onTalk: () => void }) {
  return (
    <>
      <section className="ed-final">
        <div className="ed-wrap ed-final-in">
          <p className="ed-label light rv">Ready when you are</p>
          <h2 className="ed-giant rv">Run a smarter <span className="muted">water network.</span></h2>
          <p className="ed-final-sub rv">See your network the way AquaWise does — live, on one map.</p>
          <div className="ed-row rv">
            <button type="button" className="ed-btn ed-btn-white" onClick={onDemo}>Explore demo <Arrow /></button>
            <button type="button" className="ed-btn ed-btn-ghost" onClick={onTalk}>Talk to us</button>
          </div>
        </div>
      </section>
      <footer className="ed-footer">
        <div className="ed-wrap ed-footer-top">
          <div className="ed-footer-about">
            <Link to="/" className="ed-brand light"><Mark /><span>Aqua<b>Wise</b></span></Link>
            <p>Helping water utilities see problems first and fix them faster.</p>
          </div>
          <div className="ed-footer-cols">
            <div><h4>Platform</h4><Link to="/overview">Overview</Link><Link to="/network">Network map</Link><Link to="/monitoring">Monitoring</Link><Link to="/alerts">Alerts</Link></div>
            <div><h4>Insight</h4><Link to="/assets">Assets</Link><Link to="/reports">Reports</Link></div>
            <div><h4>Contact</h4><a href="mailto:info.aquawise@gmail.com">info.aquawise@gmail.com</a><a href="tel:+254710433161">+254 710 433 161</a><button type="button" onClick={onTalk}>Book a walkthrough</button></div>
          </div>
        </div>
        <div className="ed-wordmark" aria-hidden="true">AquaWise</div>
        <div className="ed-wrap ed-footer-bottom">
          <span>© {new Date().getFullYear()} AquaWise. All rights reserved.</span>
          <span>Nairobi, Kenya</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button>
        </div>
      </footer>
    </>
  );
}

/* ═════════════ marks ═════════════ */
function Mark() {
  return (
    <svg width={22} height={22} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M12 50 L32 14 L52 50" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 50 L32 14 L43 50" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      <path d="M29 50 L32 14 L35 50" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.22} />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

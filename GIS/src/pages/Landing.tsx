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
    fetch('/data/riverton-assets.geojson').then(r => r.json()).then(fc => {
      if (!alive) return;
      const m: Record<string, AssetProps> = {};
      for (const f of fc.features) m[f.properties.id] = f.properties;
      setA(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return a;
}

const WQ_MIL = QUALITY_POINTS.find(q => q.id === 'WQ-MIL')!;
const fmtClock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ═════════════ page ═════════════ */
export default function Landing() {
  const navigate = useNavigate();
  const openDemo = useCallback(() => navigate(hasDemoAccess() ? '/demo' : '/request-demo'), [navigate]);
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
            <a href="#nrw">NRW</a>
            <a href="#product">Product</a>
          </nav>
          <div className="ed-nav-cta">
            <button type="button" className="ed-link-btn" onClick={talkToUs}>Talk to us</button>
            <button type="button" className="ed-btn ed-btn-blue sm" onClick={openDemo}>Explore AquaWise</button>
          </div>
        </div>
      </header>

      <main>
        <Hero onDemo={openDemo} onTalk={talkToUs} />
        <OneNetwork assets={assets} />
        <Mosaic assets={assets} nrw={nrw} />
        <Monitor assets={assets} />
        <QualityStory />
        <Infrastructure />
        <Losses nrw={nrw} />
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
        <p className="ed-eyebrow rv">GIS · Monitoring · Water quality · NRW</p>
        <h1 className="ed-hero-h rv">The smart water grid<br />for water utilities</h1>
        <p className="ed-hero-sub rv">
          AquaWise brings your pipe network, live monitoring, water quality and losses
          into one operational view, so your team sees problems early and knows where to act.
        </p>
        <div className="ed-row ed-hero-ctas rv">
          <button type="button" className="ed-btn ed-btn-blue" onClick={onDemo}>Explore the live demo</button>
          <button type="button" className="ed-btn ed-btn-line" onClick={onTalk}>Talk to us <span aria-hidden="true">→</span></button>
        </div>
      </div>
      <div className="ed-wrap">
        <div className="ed-hero-frame rv">
          <img className="ed-hero-bg" src="/img/treatment-plant.jpg" alt="" />
          <div className="ed-hero-shot">
            <img src="/img/ui/view-overview.webp" alt="AquaWise Overview: network health, active alerts, water quality, NRW, network map and issues needing attention" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═════════════ 2 · ONE NETWORK ═════════════ */
function OneNetwork({ assets }: { assets: Record<string, AssetProps> | null }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  const tanks = ['TANK-01', 'TANK-02', 'TANK-03', 'TANK-04', 'TANK-05', 'TANK-06'];
  const inflow = assets ? tanks.reduce((s, id) => s + Number(assets[id]?.inflow_lps ?? 0), 0) : null;
  const capacity = assets ? tanks.reduce((s, id) => s + Number(assets[id]?.capacity_m3 ?? 0), 0) : null;
  const wtw = QUALITY_POINTS.find(q => q.id === 'WQ-WTW')!;
  const tapCl = QUALITY_POINTS.filter(q => q.zone !== 'WTW').map(q => current('chlorine', q.id, q.base.chlorine));
  const avgCl = tapCl.reduce((a, b) => a + b, 0) / tapCl.length;

  return (
    <section className="ed-sec" id="network">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>01</b> / The network</p>
        <h2 className="ed-h2 rv" style={{ gridColumn: '1 / span 9' }}>
          From source to tap, <span className="muted">one connected view.</span>
        </h2>
        <p className="ed-aside rv" style={{ gridColumn: '9 / span 4' }}>
          Storage, treatment and distribution report into the same picture. When pressure falls in one zone,
          you see the reservoir feeding it and the water quality reaching customers — in the same place.
        </p>
      </div>

      <div className={`ed-flow${seen ? ' drawn' : ''}`} ref={ref}>
        <div className="ed-flow-row">
          <svg className="ed-flow-line" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="2" x2="1000" y2="2" pathLength={1} />
          </svg>
          <Stage n="01" name="Source" top={<div className="fl-type"><b>{inflow ?? '—'}</b><span>L/s</span></div>}
            data="Inflow to storage across six reservoirs" />
          <Stage n="02" name="Storage" top={<img src="/img/reservoir-pipes.jpg" alt="Storage reservoir and mains" className="fl-img tall" style={{ objectPosition: '32% 40%' }} />}
            data={capacity ? `${capacity.toLocaleString()} m³ of storage, level read every 15 minutes` : 'Reservoir levels read every 15 minutes'} />
          <Stage n="03" name="Treatment" wide top={<img src="/img/treatment-plant.jpg" alt="Clarifiers at the treatment works" className="fl-img" />}
            data={`Turbidity at the works outlet: ${current('turbidity', wtw.id, wtw.base.turbidity).toFixed(2)} NTU`} />
          <Stage n="04" name="Distribution" below top={<div className="fl-type"><b>716</b><span>km</span></div>}
            data="of mapped pipe, with 26 pressure and flow loggers"
            extra={<img src="/img/field-engineers.jpg" alt="Field engineers at a valve" className="fl-img small" />} />
          <Stage n="05" name="Customer" top={<div className="fl-type"><b>{avgCl.toFixed(2)}</b><span>mg/L</span></div>}
            data="Average residual chlorine at 7 zone monitoring points" />
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

/* ═════════════ 3 · PLATFORM MOSAIC ═════════════ */
function Mosaic({ assets, nrw }: { assets: Record<string, AssetProps> | null; nrw: ReturnType<typeof buildNrwMonthly> }) {
  const tb = series('turbidity', WQ_MIL.id, WQ_MIL.base.turbidity, rangeSpec('24H'));
  const tbNow = tb[tb.length - 1].v;
  const sn12 = assets?.['SN-12'] ? current('pressure', 'SN-12', Number(assets['SN-12'].pressure_bar)) : null;
  const tanks = ['TANK-01', 'TANK-02', 'TANK-03', 'TANK-04', 'TANK-05', 'TANK-06'].map(id => ({
    id, level: assets?.[id] ? current('level', id, Number(assets[id].level_pct)) : null
  }));
  const last = nrw[nrw.length - 1]; const prev = nrw[nrw.length - 2];

  return (
    <section className="ed-sec ed-tint">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 3' }}><b>02</b> / The platform</p>
        <h2 className="ed-h2 rv" style={{ gridColumn: '1 / span 7' }}>See everything. <span className="muted">Miss less.</span></h2>
        <p className="ed-aside rv" style={{ gridColumn: '10 / span 3' }}>Network, quality, pressure, storage and losses in one operational view — each tied to a place on the map.</p>
      </div>

      <div className="ed-wrap">
        <div className="ed-bento">
          <figure className="bx bx-map rv">
            <img src="/img/ui/crop-gis.webp" alt="" />
            <figcaption><span className="ed-mini">Network</span><b>3,233 pipe segments · 716 km</b></figcaption>
          </figure>

          <div className="bx bx-wq rv">
            <span className="ed-mini">Water quality · Riverside booster</span>
            <div className="bx-big warn">{tbNow.toFixed(2)}<small>NTU</small></div>
            <p>Turbidity above the 1.0 NTU limit since this morning. The other seven monitoring points are within range.</p>
            <MiniLine points={tb} metric="turbidity" />
          </div>

          <div className="bx bx-blue rv">
            <span className="ed-mini">Active alerts</span>
            <div className="bx-big">06</div>
            <p>2 critical · 3 warning · 1 info</p>
          </div>

          <div className="bx bx-navy rv">
            <span className="ed-mini">Pressure · Northgate</span>
            <div className="bx-big">{sn12 !== null ? sn12.toFixed(2) : '—'}<small>bar</small></div>
            <p><i className="dot crit" />Below the 1.5 bar minimum</p>
          </div>

          <div className="bx bx-nrw rv">
            <span className="ed-mini">Non-revenue water</span>
            <div className="bx-big">{last.nrw.toFixed(1)}<small>%</small></div>
            <p className="good">▼ {(prev.nrw - last.nrw).toFixed(1)} pts vs last month</p>
            <div className="bx-bars" aria-hidden="true">
              {nrw.map(m => <span key={m.t} style={{ height: `${((m.nrw - 28) / 10) * 100}%` }} title={`${m.month}: ${m.nrw}%`} />)}
            </div>
          </div>

          <div className="bx bx-store rv">
            <img src="/img/reservoir-pipes.jpg" alt="" />
            <div className="bx-store-data">
              <span className="ed-mini">Storage · six reservoirs</span>
              <div className="bx-tanks">
                {tanks.map((t, i) => (
                  <div key={t.id} className={t.level !== null && t.level < 35 ? 'low' : ''}>
                    <span className="lvl" style={{ height: `${t.level ?? 0}%` }} />
                    <b>{t.level !== null ? Math.round(t.level) : '—'}%</b>
                    <small>R{String(i + 1).padStart(2, '0')}</small>
                  </div>
                ))}
              </div>
              <p>Reservoir 01 is draining faster than at the same time yesterday.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniLine({ points, metric }: { points: Point[]; metric: Metric }) {
  const w = 300, h = 70;
  const lo = Math.min(...points.map(p => p.v), METRICS[metric].normal[0] === -Infinity ? 0 : METRICS[metric].normal[0]);
  const hi = Math.max(...points.map(p => p.v));
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const lim = METRICS[metric].normal[1];
  return (
    <svg className="bx-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {Number.isFinite(lim) && lim < hi && <line x1={0} x2={w} y1={y(lim)} y2={y(lim)} className="lim" />}
      <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('')} />
    </svg>
  );
}

/* ═════════════ shared editorial chart ═════════════ */
interface Annotation { t: number; title: string; sub?: string; tone: Tone }
function EdChart({ points, metric, dark, height = 380, annotations = [], drawn }: {
  points: Point[]; metric: Metric; dark?: boolean; height?: number; annotations?: Annotation[]; drawn: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const def = METRICS[metric];
  const pad = { l: 0, r: 0, t: annotations.length ? 30 + annotations.length * 38 : 16, b: 30 };
  const iw = W - pad.l - pad.r; const ih = height - pad.t - pad.b;
  const t0 = points[0].t; const t1 = points[points.length - 1].t;
  let lo = Math.min(...points.map(p => p.v)); let hi = Math.max(...points.map(p => p.v));
  if (Number.isFinite(def.normal[1]) && def.normal[1] < hi * 1.6) hi = Math.max(hi, def.normal[1]);
  if (Number.isFinite(def.normal[0]) && def.normal[0] > lo - (hi - lo)) lo = Math.min(lo, def.normal[0]);
  const span = hi - lo || 1; lo -= span * 0.1; hi += span * 0.12;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0 || 1)) * iw;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * ih;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const bandTop = y(Math.min(Number.isFinite(def.normal[1]) ? def.normal[1] : hi, hi));
  const bandBot = y(Math.max(Number.isFinite(def.normal[0]) ? def.normal[0] : lo, lo));
  // contiguous out-of-range runs, drawn over the base line
  const runs: Array<{ d: string; tone: Tone }> = [];
  let cur: Point[] = []; let curTone: Tone = 'ok';
  points.forEach((p, i) => {
    const tone = toneFor(metric, p.v);
    if (tone !== 'ok') { if (!cur.length && i) cur.push(points[i - 1]); cur.push(p); if (tone === 'crit') curTone = 'crit'; else if (curTone !== 'crit') curTone = 'warn'; }
    else if (cur.length) { cur.push(p); runs.push({ d: cur.map((q, j) => `${j ? 'L' : 'M'}${x(q.t).toFixed(1)},${y(q.v).toFixed(1)}`).join(''), tone: curTone }); cur = []; curTone = 'ok'; }
  });
  if (cur.length > 1) runs.push({ d: cur.map((q, j) => `${j ? 'L' : 'M'}${x(q.t).toFixed(1)},${y(q.v).toFixed(1)}`).join(''), tone: curTone });
  const spanMs = t1 - t0;
  const tick = (t: number) => spanMs <= 2.2 * 86_400_000 ? fmtClock(t) : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const nTicks = Math.max(3, Math.min(8, Math.floor(iw / 150)));
  const ticks = Array.from({ length: nTicks }, (_, i) => t0 + (spanMs * i) / (nTicks - 1));

  return (
    <div className={`ed-chart${dark ? ' dark' : ''}${drawn ? ' drawn' : ''}`} ref={ref} style={{ height }}>
      <svg width={W} height={height} role="img" aria-label={`${def.label} over time`}>
        {bandBot > bandTop && <rect x={pad.l} width={iw} y={bandTop} height={bandBot - bandTop} className="band" />}
        {(['normal', 'crit'] as const).flatMap(k => def[k].map((v, j) => Number.isFinite(v) && v > lo && v < hi
          ? <g key={`${k}${j}`}><line x1={pad.l} x2={W} y1={y(v)} y2={y(v)} className={`thr ${k === 'crit' ? 'crit' : 'warn'}`} /><text x={W - 4} y={y(v) - 6} textAnchor="end" className="thr-l">{k === 'crit' ? 'critical' : 'limit'} {v}{def.unit ? ` ${def.unit}` : ''}</text></g>
          : null))}
        <path d={`${d}L${x(t1)},${pad.t + ih}L${x(t0)},${pad.t + ih}Z`} className="area" />
        <path d={d} className="line" pathLength={1} />
        {runs.map((r, i) => <path key={i} d={r.d} className={`run ${r.tone}`} />)}
        {annotations.map((a, i) => {
          const ax = x(a.t); const right = ax > W * 0.72;
          const ly = 14 + i * 38;
          const v = points.reduce((best, p) => Math.abs(p.t - a.t) < Math.abs(best.t - a.t) ? p : best, points[0]).v;
          return (
            <g key={i} className={`ann ${a.tone}`} style={{ transitionDelay: `${1.1 + i * 0.25}s` }}>
              <line x1={ax} x2={ax} y1={ly + 22} y2={y(v)} />
              <circle cx={ax} cy={y(v)} r={4.5} />
              <text x={right ? ax - 8 : ax + 8} y={ly} textAnchor={right ? 'end' : 'start'} className="ann-t">{a.title}</text>
              {a.sub && <text x={right ? ax - 8 : ax + 8} y={ly + 15} textAnchor={right ? 'end' : 'start'} className="ann-s">{a.sub}</text>}
            </g>
          );
        })}
        {ticks.map((t, i) => <text key={i} x={x(t)} y={height - 8} className="axis" textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}>{tick(t)}</text>)}
      </svg>
    </div>
  );
}

/* ═════════════ 4 · MONITORING (dark) ═════════════ */
type MonKey = 'quality' | 'pressure' | 'tanks' | 'sensors';
function Monitor({ assets }: { assets: Record<string, AssetProps> | null }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.25);
  const [view, setView] = useState<MonKey>('quality');
  const [param, setParam] = useState<Metric>('turbidity');
  const spec = rangeSpec('7D');
  const data = useMemo(() => {
    if (view === 'pressure' && assets?.['SN-12']) return { metric: 'pressure' as Metric, label: 'Pressure · Northgate logger SN-12', pts: series('pressure', 'SN-12', Number(assets['SN-12'].pressure_bar), spec) };
    if (view === 'tanks' && assets?.['TANK-01']) return { metric: 'level' as Metric, label: 'Level · Reservoir 01', pts: series('level', 'TANK-01', Number(assets['TANK-01'].level_pct), spec) };
    return { metric: param, label: `${METRICS[param].label} · Riverside booster`, pts: series(param, WQ_MIL.id, WQ_MIL.base[param as keyof typeof WQ_MIL.base], spec) };
  }, [view, param, assets, spec]);
  const now = data.pts[data.pts.length - 1].v;
  const tone = toneFor(data.metric, now);
  const items: Array<{ k: MonKey; label: string; sub: string }> = [
    { k: 'quality', label: 'Water Quality', sub: 'Turbidity, pH, chlorine, conductivity, temperature' },
    { k: 'pressure', label: 'Pressure', sub: '26 loggers, anomalies marked' },
    { k: 'tanks', label: 'Tank Levels', sub: 'Six reservoirs, fill and drawdown' },
    { k: 'sensors', label: 'Sensors', sub: '40 devices · battery, signal, last contact' }
  ];

  return (
    <section className="ed-sec ed-dark" id="monitor">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>03</b> / Monitor</p>
        <h2 className="ed-h1 rv" style={{ gridColumn: '1 / span 11' }}>Water changes. <span className="muted">AquaWise watches.</span></h2>
      </div>
      <div className="ed-wrap ed-grid ed-mon" ref={ref}>
        <ul className="ed-mon-nav rv" style={{ gridColumn: '1 / span 3' }}>
          {items.map(i => (
            <li key={i.k}>
              <button type="button" className={view === i.k ? 'on' : ''} onClick={() => setView(i.k)} aria-pressed={view === i.k}>
                <b>{i.label}</b><span>{i.sub}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="ed-mon-main" style={{ gridColumn: '4 / -1' }}>
          {view === 'sensors' ? (
            <div className="ed-sensors">
              <div><b><Count to={36} /></b><span>online</span></div>
              <div><b className="warn">2</b><span>low battery or weak signal</span></div>
              <div><b className="off">2</b><span>offline · flagged automatically</span></div>
              <p>Sensors are how readings reach AquaWise. Their health is monitored separately from what they measure, so a silent logger is never mistaken for a quiet network.</p>
            </div>
          ) : (
            <>
              <div className="ed-mon-head">
                <div>
                  <span className="ed-mini">{data.label} · last 7 days</span>
                  <div className={`ed-mon-now ${tone}`}>{now.toFixed(METRICS[data.metric].decimals)}<small>{METRICS[data.metric].unit}</small></div>
                </div>
                {view === 'quality' && (
                  <div className="ed-params" role="radiogroup" aria-label="Parameter">
                    {QUALITY_METRICS.map(m => (
                      <button key={m} type="button" role="radio" aria-checked={param === m} className={param === m ? 'on' : ''} onClick={() => setParam(m)}>
                        {METRICS[m].label.replace('Residual chlorine', 'Chlorine')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="ed-bleed">
                <EdChart key={`${view}-${param}`} points={data.pts} metric={data.metric} dark height={420} drawn={seen} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═════════════ 5 · WATER QUALITY STORY ═════════════ */
function QualityStory() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  // A resolved Riverside turbidity event from the demo history (22 days ago).
  const story = useMemo(() => {
    const evStart = NOW - 22 * 24 * HOURS; const evEnd = NOW - (22 * 24 - 10) * HOURS;
    const pts = seriesWindow('turbidity', WQ_MIL.id, WQ_MIL.base.turbidity, evStart - 14 * HOURS, evEnd + 14 * HOURS, 220);
    const over = pts.find(p => p.v > 1.0);
    const peak = pts.reduce((a, b) => (b.v > a.v ? b : a), pts[0]);
    const back = pts.find(p => p.t > peak.t && p.v <= 1.0);
    const anns: Annotation[] = [];
    if (over) anns.push({ t: over.t, title: fmtClock(over.t), sub: 'Turbidity threshold exceeded', tone: 'warn' });
    anns.push({ t: peak.t, title: `${peak.v.toFixed(2)} NTU`, sub: 'Peak reading', tone: 'warn' });
    if (back) anns.push({ t: back.t, title: fmtClock(back.t), sub: 'Returned to acceptable range', tone: 'ok' });
    return { pts, anns, date: new Date(evStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }), hours: over && back ? Math.round((back.t - over.t) / HOURS) : null };
  }, []);

  return (
    <section className="ed-sec">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>04</b> / Water quality</p>
        <h2 className="ed-h1 rv" style={{ gridColumn: '1 / -1' }}>
          Not just what the water <br className="br-lg" />looks like now. <span className="muted">How it’s changing.</span>
        </h2>
      </div>
      <div className="ed-wrap" ref={ref}>
        <div className="ed-story-meta rv">
          <span>Riverside · Elm Rd booster</span><span>Turbidity, NTU</span><span>{story.date}</span>
          {story.hours !== null && <span>Out of range for {story.hours} h</span>}
        </div>
        <EdChart points={story.pts} metric="turbidity" height={460} annotations={story.anns} drawn={seen} />
        <div className="ed-grid ed-story-foot">
          <p className="rv" style={{ gridColumn: '1 / span 5' }}>Every reading is kept. Thresholds are drawn on the history itself, so a breach shows when it started, how far it went and when it cleared — not just that an alarm fired.</p>
          <p className="ed-mini rv" style={{ gridColumn: '9 / span 4', alignSelf: 'end' }}>Shaded band: acceptable range (≤ 1.0 NTU). Amber: above limit.</p>
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
    { x: 43, y: 50, t: 'Pressure & flow logger', s: 'reports every 15 min' },
    { x: 33, y: 22, t: 'Storage reservoir', s: 'level sensor · capacity in m³', side: 'l' },
    { x: 62, y: 62, t: 'Gate valve', s: 'in the asset register, on the map' },
    { x: 84, y: 66, t: 'Treatment basin', s: 'quality sampling point', side: 'l' }
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
        <h2 className="ed-h1 rv">Physical infrastructure. <span className="muted">Digital intelligence.</span></h2>
      </div>
    </section>
  );
}

/* ═════════════ 7 · LOSSES ═════════════ */
function Losses({ nrw }: { nrw: ReturnType<typeof buildNrwMonthly> }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const last = nrw[nrw.length - 1]; const prev = nrw[nrw.length - 2];
  const zones = [...ZONE_SEED].sort((a, b) => b.nrw - a.nrw);
  return (
    <section className="ed-sec" id="nrw">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>05</b> / Non-revenue water</p>
        <h2 className="ed-h1 rv" style={{ gridColumn: '1 / span 7' }}>Find the water <span className="muted">you’re losing.</span></h2>
        <div className="ed-nrw-big rv" style={{ gridColumn: '9 / span 4' }}>
          <b><Count to={last.nrw} decimals={1} />%</b>
          <span>Current NRW across seven zones</span>
          <span className="good">▼ {(prev.nrw - last.nrw).toFixed(1)} pts on last month</span>
        </div>
      </div>
      <div className="ed-wrap ed-grid ed-nrw-body">
        <div className={`ed-rank${seen ? ' drawn' : ''}`} ref={ref} style={{ gridColumn: '1 / span 6' }}>
          {zones.map((z, i) => {
            const tone = z.nrw >= 35 ? 'crit' : z.nrw >= 25 ? 'warn' : 'ok';
            return (
              <div key={z.code} className="ed-rank-row" style={{ transitionDelay: `${i * 0.07}s` }}>
                <span className="nm">{zoneLabel(z.code)}</span>
                <span className="tr"><span className={`fill ${tone}`} style={{ width: `${(z.nrw / 45) * 100}%`, transitionDelay: `${0.15 + i * 0.07}s` }} /></span>
                <span className="v">{z.nrw.toFixed(1)}%</span>
                <span className={`d ${z.nrw > z.nrwPrev ? 'up' : 'down'}`}>{z.nrw > z.nrwPrev ? '▲' : '▼'} {Math.abs(z.nrw - z.nrwPrev).toFixed(1)}</span>
              </div>
            );
          })}
          <p className="ed-note">Riverside has the highest loss and it is still rising, alongside three pressure anomalies this month. That is where to look first.</p>
        </div>
        <figure className="ed-nrw-map rv" style={{ gridColumn: '7 / -1' }}>
          <img src="/img/ui/crop-nrw-map.webp" alt="AquaWise map with pipes coloured by zone NRW and open leak reports" />
        </figure>
      </div>
    </section>
  );
}

/* ═════════════ 8 · PRODUCT EXPLORER ═════════════ */
const VIEWS = [
  { k: 'overview', label: 'Overview', cap: 'What is happening across the utility right now — status first, readings second.' },
  { k: 'network', label: 'Network', cap: 'The physical network on the map, every element one click from its data.' },
  { k: 'monitoring', label: 'Monitoring', cap: 'Water quality, pressure and storage over time, with thresholds on the history.' },
  { k: 'alerts', label: 'Alerts', cap: 'Incidents with the data around the event, ready to acknowledge and resolve.' },
  { k: 'nrw', label: 'NRW', cap: 'Losses ranked by zone, so investigation starts where it matters.' },
  { k: 'reports', label: 'Reports', cap: 'Regulator-ready reports generated from the same monitored data.' }
] as const;

function Explorer({ onDemo }: { onDemo: () => void }) {
  const [i, setI] = useState(0);
  return (
    <section className="ed-sec ed-tint ed-explorer" id="product">
      <div className="ed-wrap ed-center">
        <p className="ed-label rv"><b>06</b> / The product</p>
        <h2 className="ed-h1 rv">One platform. <span className="muted">Your entire network.</span></h2>
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
        <button type="button" className="ed-btn ed-btn-blue ed-shot-cta" onClick={onDemo}>Open the live demo <Arrow /></button>
      </div>
    </section>
  );
}

/* ═════════════ 9 · OUTCOMES ═════════════ */
function Outcomes() {
  return (
    <section className="ed-sec">
      <div className="ed-wrap ed-grid">
        <p className="ed-label rv" style={{ gridColumn: '1 / span 4' }}><b>07</b> / In the Riverton network</p>
        <h2 className="ed-h2 rv" style={{ gridColumn: '1 / span 8' }}>What a utility sees <span className="muted">on day one.</span></h2>
      </div>
      <div className="ed-wrap">
        <div className="ed-report">
          <div className="rv"><b><Count to={716} /><small>km</small></b><span>of pipe network mapped</span></div>
          <div className="rv"><b><Count to={3317} /></b><span>assets in one register</span></div>
          <div className="rv"><b><Count to={40} /></b><span>monitoring points and sensors</span></div>
          <div className="rv"><b><Count to={15} /><small>min</small></b><span>between readings</span></div>
          <div className="rv"><b>24/7</b><span>monitoring, with thresholds on every parameter</span></div>
          <div className="rv"><b>One</b><span>connected operational view</span></div>
        </div>
        <p className="ed-mini ed-source rv">Figures describe the Riverton demonstration network in the live demo.</p>
      </div>
    </section>
  );
}

/* ═════════════ FINAL ═════════════ */
function Final({ onDemo, onTalk }: { onDemo: () => void; onTalk: () => void }) {
  return (
    <footer className="ed-final">
      <div className="ed-wrap ed-final-in">
        <p className="ed-label light rv">Ready to see your network differently?</p>
        <h2 className="ed-giant rv">Your water network <span className="muted">shouldn’t be invisible.</span></h2>
        <div className="ed-row rv">
          <button type="button" className="ed-btn ed-btn-white" onClick={onDemo}>Explore AquaWise <Arrow /></button>
          <button type="button" className="ed-btn ed-btn-ghost" onClick={onTalk}>Talk to us</button>
        </div>
      </div>
      <div className="ed-wrap ed-foot">
        <Link to="/" className="ed-brand light"><Mark /><span>Aqua<b>Wise</b></span></Link>
        <nav aria-label="Footer">
          <Link to="/overview">Overview</Link><Link to="/network">Network</Link><Link to="/monitoring">Monitoring</Link>
          <Link to="/alerts">Alerts</Link><Link to="/nrw">NRW</Link><Link to="/assets">Assets</Link><Link to="/reports">Reports</Link>
        </nav>
        <span>© {new Date().getFullYear()} AquaWise · The smart water grid for water utilities</span>
      </div>
    </footer>
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

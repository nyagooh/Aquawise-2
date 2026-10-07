/**
 * Lightweight SVG charts for the operational UI.
 * Blue is the default series colour; green/amber/red appear only for
 * acceptable-range bands, threshold lines and out-of-range segments.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { METRICS, toneFor, type Metric, type Point, type Tone } from './series';

export const TONE_COLOR: Record<Tone, string> = {
  ok: 'hsl(var(--safe))', warn: 'hsl(var(--warning))', crit: 'hsl(var(--danger))', off: 'hsl(var(--offline))'
};
/** Comparison palette — restrained, never status colours. */
export const SERIES_COLORS = ['hsl(var(--primary))', '#0E9384', '#7A5AF8', '#475467', '#36A3D9', '#B54708'];

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    setW(Math.max(200, Math.floor(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count + 0.5) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function timeFmt(spanMs: number) {
  const day = 86_400_000;
  if (spanMs <= 2 * day) return (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (spanMs <= 120 * day) return (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return (t: number) => new Date(t).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
const tipTime = (t: number, spanMs: number) =>
  new Date(t).toLocaleString('en-GB', spanMs > 120 * 86_400_000
    ? { month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export interface ChartSeries { id: string; label: string; points: Point[]; color?: string }

export function LineChart({
  series, metric, height = 260, band, windows = [], marker, yLabel, format, showThresholds = true, area = true, yMin
}: {
  series: ChartSeries[];
  metric?: Metric;
  height?: number;
  band?: [number, number] | null;
  windows?: Array<{ start: number; end: number; tone: Tone; label?: string }>;
  marker?: { t: number; label: string };
  yLabel?: string;
  format?: (v: number) => string;
  showThresholds?: boolean;
  area?: boolean;
  yMin?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const def = metric ? METRICS[metric] : null;
  const fmtV = format ?? ((v: number) => (def ? v.toFixed(def.decimals) : v.toFixed(1)));
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const W = width; const H = height;
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;

  const pts = series.flatMap(s => s.points);
  const tMin = pts.length ? Math.min(...series.map(s => s.points[0]?.t ?? Infinity)) : 0;
  const tMax = pts.length ? Math.max(...series.map(s => s.points[s.points.length - 1]?.t ?? -Infinity)) : 1;
  const bandR = band === null ? null : band ?? (def ? def.normal : null);

  const [yLo, yHi] = useMemo(() => {
    let lo = Math.min(...pts.map(p => p.v));
    let hi = Math.max(...pts.map(p => p.v));
    if (bandR && showThresholds) {
      // keep the acceptable band in view when it is close to the data
      const near = (x: number) => Math.abs(x - (lo + hi) / 2) < (hi - lo + 1e-6) * 3 + Math.abs(hi) * 0.6;
      if (near(bandR[0])) lo = Math.min(lo, bandR[0]);
      if (near(bandR[1])) hi = Math.max(hi, bandR[1]);
    }
    if (yMin !== undefined) lo = Math.min(lo, yMin);
    const span = hi - lo || Math.abs(hi) * 0.1 || 1;
    return [lo - span * 0.08, hi + span * 0.1];
  }, [pts, bandR, showThresholds, yMin]);

  const x = (t: number) => pad.l + ((t - tMin) / (tMax - tMin || 1)) * iw;
  const y = (v: number) => pad.t + (1 - (v - yLo) / (yHi - yLo)) * ih;
  const yTicks = niceTicks(yLo, yHi, 4);
  const tf = timeFmt(tMax - tMin);
  const xTickCount = Math.max(2, Math.min(7, Math.floor(iw / 110)));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => tMin + ((tMax - tMin) * i) / (xTickCount - 1));

  const single = series.length === 1 && metric;
  const base = series[0]?.points ?? [];
  const idx = hover === null || !base.length ? null : Math.round(((hover - pad.l) / iw) * (base.length - 1));
  const hi = idx !== null && idx >= 0 && idx < base.length ? idx : null;

  const path = (p: Point[]) => p.map((q, i) => `${i ? 'L' : 'M'}${x(q.t).toFixed(1)},${y(q.v).toFixed(1)}`).join('');

  return (
    <div className="dx-chart" ref={ref} style={{ height }}>
      <svg width={W} height={H} onMouseMove={e => setHover(e.nativeEvent.offsetX)} onMouseLeave={() => setHover(null)} role="img" aria-label={yLabel || def?.label || 'Trend chart'}>
        {/* grid */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="dx-grid" />
            <text x={pad.l - 8} y={y(v)} className="dx-axis" textAnchor="end" dominantBaseline="middle">{fmtTick(v)}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={x(t)} y={H - 8} className="dx-axis" textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>{tf(t)}</text>
        ))}

        {/* acceptable band */}
        {bandR && showThresholds && (() => {
          const top = y(Math.min(bandR[1], yHi)); const bot = y(Math.max(bandR[0], yLo));
          if (!Number.isFinite(top) || !Number.isFinite(bot)) return null;
          return bot > top ? <rect x={pad.l} width={iw} y={top} height={bot - top} className="dx-band" /> : null;
        })()}
        {/* event windows */}
        {windows.map((w, i) => {
          const x0 = Math.max(pad.l, x(w.start)); const x1 = Math.min(W - pad.r, x(w.end));
          if (x1 <= pad.l || x0 >= W - pad.r) return null;
          return <rect key={i} x={x0} width={Math.max(2, x1 - x0)} y={pad.t} height={ih} fill={TONE_COLOR[w.tone]} opacity={0.08} />;
        })}
        {/* threshold lines */}
        {def && showThresholds && (['normal', 'crit'] as const).flatMap(k => def[k].map((v, j) => {
          if (!Number.isFinite(v) || v <= yLo || v >= yHi) return null;
          return <line key={`${k}${j}`} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={`dx-thr ${k === 'crit' ? 'crit' : 'warn'}`} />;
        }))}

        {/* series */}
        {series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
          return (
            <g key={s.id}>
              {area && series.length === 1 && s.points.length > 1 && (
                <path d={`${path(s.points)}L${x(s.points[s.points.length - 1].t)},${pad.t + ih}L${x(s.points[0].t)},${pad.t + ih}Z`} fill={color} opacity={0.07} />
              )}
              <path d={path(s.points)} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
            </g>
          );
        })}
        {/* out-of-range segments recoloured */}
        {single && base.slice(1).map((q, i) => {
          const p0 = base[i];
          const tone = worse(toneFor(metric!, p0.v), toneFor(metric!, q.v));
          if (tone === 'ok') return null;
          return <line key={i} x1={x(p0.t)} y1={y(p0.v)} x2={x(q.t)} y2={y(q.v)} stroke={TONE_COLOR[tone]} strokeWidth={2} strokeLinecap="round" />;
        })}
        {/* incident marker */}
        {marker && marker.t >= tMin && marker.t <= tMax && (
          <g>
            <line x1={x(marker.t)} x2={x(marker.t)} y1={pad.t} y2={pad.t + ih} className="dx-marker" />
            <text x={x(marker.t) + 4} y={pad.t + 10} className="dx-axis dx-marker-label">{marker.label}</text>
          </g>
        )}
        {/* hover */}
        {hi !== null && (
          <g>
            <line x1={x(base[hi].t)} x2={x(base[hi].t)} y1={pad.t} y2={pad.t + ih} className="dx-cross" />
            {series.map((s, si) => s.points[hi] && (
              <circle key={s.id} cx={x(s.points[hi].t)} cy={y(s.points[hi].v)} r={3.5} fill="hsl(var(--card))" stroke={s.color ?? SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hi !== null && (
        <div className="dx-tip" style={{ left: Math.min(W - 180, Math.max(0, x(base[hi].t) + 10)), top: 8 }}>
          <div className="dx-tip-time">{tipTime(base[hi].t, tMax - tMin)}</div>
          {series.map((s, si) => s.points[hi] && (
            <div key={s.id} className="dx-tip-row">
              <span className="sw" style={{ background: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length] }} />
              <span className="lbl">{s.label}</span>
              <b>{fmtV(s.points[hi].v)}{def?.unit ? ` ${def.unit}` : ''}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ORDER: Tone[] = ['ok', 'off', 'warn', 'crit'];
const worse = (a: Tone, b: Tone) => (ORDER.indexOf(a) > ORDER.indexOf(b) ? a : b);
function fmtTick(v: number) {
  const a = Math.abs(v);
  if (a >= 10000) return `${Math.round(v / 1000)}k`;
  if (a >= 100) return Math.round(v).toLocaleString();
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2);
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean; band?: boolean }> }) {
  return (
    <div className="dx-legend">
      {items.map(i => (
        <span key={i.label}>
          <i className={i.band ? 'band' : i.dashed ? 'dash' : ''} style={i.band ? undefined : { background: i.dashed ? undefined : i.color, borderColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Horizontal ranked bars. */
export function BarList({ rows, max, onRowClick }: {
  rows: Array<{ key: string; label: ReactNode; value: number; display: string; tone?: Tone; sub?: string }>;
  max?: number;
  onRowClick?: (key: string) => void;
}) {
  const m = max ?? Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="dx-barlist">
      {rows.map(r => (
        <div key={r.key} className={`dx-barrow${onRowClick ? ' click' : ''}`} onClick={onRowClick ? () => onRowClick(r.key) : undefined}>
          <div className="dx-barrow-top">
            <span className="lbl">{r.label}</span>
            <span className="val">{r.display}</span>
          </div>
          <div className="dx-bartrack">
            <div className="dx-barfill" style={{ width: `${(r.value / m) * 100}%`, background: r.tone && r.tone !== 'ok' ? TONE_COLOR[r.tone] : 'hsl(var(--primary))' }} />
          </div>
          {r.sub && <div className="dx-barrow-sub">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Monthly stacked columns, e.g. billed vs lost water. */
export function StackedColumns({ data, height = 220, keys }: {
  data: Array<{ label: string; values: number[] }>;
  keys: Array<{ label: string; color: string }>;
  height?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const iw = W - pad.l - pad.r; const ih = height - pad.t - pad.b;
  const max = Math.max(...data.map(d => d.values.reduce((a, b) => a + b, 0))) * 1.08;
  const ticks = niceTicks(0, max, 4);
  const bw = (iw / data.length) * 0.62;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  return (
    <div className="dx-chart" ref={ref} style={{ height }}>
      <svg width={W} height={height} onMouseLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="dx-grid" />
            <text x={pad.l - 8} y={y(v)} className="dx-axis" textAnchor="end" dominantBaseline="middle">{fmtTick(v)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + (iw / data.length) * (i + 0.5);
          let acc = 0;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={cx - (iw / data.length) / 2} width={iw / data.length} y={pad.t} height={ih} fill="transparent" />
              {d.values.map((v, k) => {
                const y0 = y(acc); acc += v; const y1 = y(acc);
                return <rect key={k} x={cx - bw / 2} width={bw} y={y1} height={Math.max(0, y0 - y1)} fill={keys[k].color} opacity={hover === null || hover === i ? 1 : 0.55} />;
              })}
              <text x={cx} y={height - 8} className="dx-axis" textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="dx-tip" style={{ left: Math.min(W - 180, pad.l + (iw / data.length) * (hover + 0.5) + 12), top: 8 }}>
          <div className="dx-tip-time">{data[hover].label}</div>
          {keys.map((k, i) => (
            <div key={k.label} className="dx-tip-row"><span className="sw" style={{ background: k.color }} /><span className="lbl">{k.label}</span><b>{Math.round(data[hover].values[i]).toLocaleString()} m³</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ points, tone, width = 96, height = 28 }: { points: Point[]; tone?: Tone; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const lo = Math.min(...points.map(p => p.v)); const hi = Math.max(...points.map(p => p.v));
  const sx = (i: number) => (i / (points.length - 1)) * width;
  const sy = (v: number) => height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 4);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.v).toFixed(1)}`).join('');
  const color = tone && tone !== 'ok' ? TONE_COLOR[tone] : 'hsl(var(--primary))';
  return (
    <svg width={width} height={height} className="dx-spark" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <circle cx={sx(points.length - 1)} cy={sy(points[points.length - 1].v)} r={2} fill={color} />
    </svg>
  );
}

/** Vertical tank fill indicator with the low-level threshold. */
export function TankGauge({ level, tone, low = 35 }: { level: number; tone: Tone; low?: number }) {
  return (
    <div className="dx-tank" aria-label={`${Math.round(level)} percent full`}>
      <div className="dx-tank-fill" style={{ height: `${level}%`, background: tone === 'ok' ? 'hsl(var(--primary) / 0.8)' : TONE_COLOR[tone] }} />
      <div className="dx-tank-low" style={{ bottom: `${low}%` }} />
    </div>
  );
}

/** Thin proportional bar split into segments. */
export function SegmentBar({ parts }: { parts: Array<{ value: number; color: string; label: string }> }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="dx-segbar" role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(', ')}>
      {parts.map(p => <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />)}
    </div>
  );
}

/* ── Tremor-style spark charts ── */
export function SparkArea({ points, tone, width = 110, height = 40, fluid }: { points: Point[]; tone?: Tone | 'blue'; width?: number; height?: number; fluid?: boolean }) {
  if (points.length < 2) return null;
  const lo = Math.min(...points.map(p => p.v)); const hi = Math.max(...points.map(p => p.v));
  const sx = (i: number) => (i / (points.length - 1)) * width;
  const sy = (v: number) => height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 6);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.v).toFixed(1)}`).join('');
  const color = !tone || tone === 'blue' ? 'hsl(var(--primary))' : TONE_COLOR[tone];
  const id = `sa${Math.round(Math.random() * 1e9)}`;
  return (
    <svg width={fluid ? undefined : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={`dx-spark${fluid ? ' fluid' : ''}`} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.28} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function SparkBars({ values, tone, width = 110, height = 40, highlightLast }: { values: number[]; tone?: Tone | 'blue'; width?: number; height?: number; highlightLast?: boolean }) {
  const max = Math.max(...values, 1);
  const bw = width / values.length;
  const color = !tone || tone === 'blue' ? 'hsl(var(--primary))' : TONE_COLOR[tone];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="dx-spark" aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 2));
        return <rect key={i} x={i * bw + bw * 0.18} width={bw * 0.64} y={height - h} height={h} rx={1} fill={color} opacity={highlightLast && i < values.length - 1 ? 0.35 : 0.9} />;
      })}
    </svg>
  );
}

/** Donut with a centred label (Tremor DonutChart look). */
export function Donut({ parts, size = 150, thickness = 16, label, sub }: {
  parts: Array<{ value: number; color: string; label: string }>; size?: number; thickness?: number; label: ReactNode; sub?: ReactNode;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = (size - thickness) / 2; const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="dx-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
        {parts.map(p => {
          const len = (p.value / total) * c; const off = acc; acc += len;
          return <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={thickness}
            strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        })}
      </svg>
      <div className="dx-donut-c"><b>{label}</b>{sub && <span>{sub}</span>}</div>
    </div>
  );
}

/** Vertical bar chart with axis (Tremor BarChart look). */
export function BarChart({ points, height = 170, format = (v: number) => v.toFixed(0), highlightLast = true }: { points: Point[]; height?: number; format?: (v: number) => string; highlightLast?: boolean }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 30, r: 4, t: 8, b: 22 };
  const iw = W - pad.l - pad.r; const ih = height - pad.t - pad.b;
  const max = Math.max(...points.map(p => p.v)) * 1.1 || 1;
  const ticks = niceTicks(0, max, 4);
  const bw = iw / points.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const tf = timeFmt(points[points.length - 1].t - points[0].t);
  const every = Math.ceil(points.length / Math.max(2, Math.floor(iw / 60)));
  return (
    <div className="dx-chart" ref={ref} style={{ height }}>
      <svg width={W} height={height} onMouseLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="dx-grid" /><text x={pad.l - 6} y={y(v)} className="dx-axis" textAnchor="end" dominantBaseline="middle">{fmtTick(v)}</text></g>
        ))}
        {points.map((p, i) => {
          const h = Math.max(1, (p.v / max) * ih);
          const on = hover === null ? (!highlightLast || i === points.length - 1) : hover === i;
          return (
            <g key={p.t} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * bw} width={bw} y={pad.t} height={ih} fill="transparent" />
              <rect x={pad.l + i * bw + bw * 0.15} width={bw * 0.7} y={y(p.v)} height={h} rx={2} fill="hsl(var(--primary))" opacity={on ? 1 : 0.45} />
              {i % every === 0 && <text x={pad.l + i * bw + bw / 2} y={height - 6} className="dx-axis" textAnchor="middle">{tf(p.t)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="dx-tip" style={{ left: Math.min(W - 170, pad.l + hover * bw + bw), top: 4 }}>
          <div className="dx-tip-time">{tipTime(points[hover].t, points[points.length - 1].t - points[0].t)}</div>
          <div className="dx-tip-row"><span className="sw" style={{ background: 'hsl(var(--primary))' }} /><span className="lbl">Value</span><b>{format(points[hover].v)}</b></div>
        </div>
      )}
    </div>
  );
}

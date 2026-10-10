/**
 * Charts for the operational UI, built on Tremor (@tremor/react).
 *
 * Tremor covers bars, donuts, spark charts, bar lists and category bars.
 * Monitoring charts need acceptable-range bands, threshold lines and event
 * windows, which Tremor's charts don't expose, so `LineChart` uses Recharts
 * (the library Tremor is built on) with Tremor's styling, tooltip and colours.
 *
 * Blue is the default series colour; green/amber/red appear only for
 * acceptable ranges, thresholds and out-of-range readings.
 */
import { useMemo, type ReactNode } from 'react';
import {
  BarChart as TBarChart, BarList as TBarList, CategoryBar, DonutChart,
  SparkAreaChart, SparkBarChart, SparkLineChart
} from '@tremor/react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { METRICS, toneFor, type Metric, type Point, type Tone } from './series';

/* ── colours ── */
export const TONE_COLOR: Record<Tone, string> = {
  ok: 'hsl(var(--safe))', warn: 'hsl(var(--warning))', crit: 'hsl(var(--danger))', off: 'hsl(var(--offline))'
};
const TONE_HEX: Record<Tone, string> = { ok: '#16A66A', warn: '#E59A17', crit: '#E5484D', off: '#98A2B3' };
const BLUE = '#1769E8'; // AquaWise blue for Recharts
/** Tremor colour per status. */
const TB = 'blue'; // Tremor colour name; Tailwind's blue is remapped to AquaWise blue
const TONE_TREMOR: Record<Tone | 'blue', string> = { ok: 'emerald', warn: 'amber', crit: 'red', off: 'gray', blue: TB };
/** Comparison palette — restrained, never status colours. */
export const SERIES_COLORS = ['#1769E8', '#0E9384', '#7A5AF8', '#475467', '#36A3D9', '#B54708'];

/* ── helpers ── */
const DAY = 86_400_000;
function timeFmt(spanMs: number) {
  if (spanMs <= 26 * 3_600_000) return (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (spanMs <= 2.5 * DAY) return (t: number) => {
    const d = new Date(t);
    return d.getHours() === 0 && d.getMinutes() === 0
      ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
      : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };
  if (spanMs <= 120 * DAY) return (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return (t: number) => new Date(t).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
const tipTime = (t: number, spanMs: number) =>
  new Date(t).toLocaleString('en-GB', spanMs > 120 * DAY
    ? { month: 'long', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => span / st <= count + 0.5) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.999; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
/** X-axis ticks on round clock/calendar boundaries (no repeated dates). */
function timeTicks(t0: number, t1: number, max = 7): number[] {
  const H = 3_600_000;
  const steps = [H, 2 * H, 3 * H, 6 * H, 12 * H, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];
  const step = steps.find(st => (t1 - t0) / st <= max) ?? 30 * DAY;
  const tz = new Date(t0).getTimezoneOffset() * 60_000;
  const out: number[] = [];
  for (let t = Math.ceil((t0 - tz) / step) * step + tz; t <= t1; t += step) out.push(t);
  return out;
}
function fmtTick(v: number) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 10000) return `${Math.round(v / 1000)}k`;
  if (a >= 100) return Math.round(v).toLocaleString();
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2);
}

/* ── Tremor tooltip markup, reused for the Recharts chart ── */
function TipBox({ title, rows }: { title: string; rows: Array<{ label: string; value: string; color: string }> }) {
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background text-tremor-default shadow-tremor-dropdown dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:shadow-dark-tremor-dropdown">
      <div className="border-b border-tremor-border px-4 py-2 dark:border-dark-tremor-border">
        <p className="m-0 font-medium text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis">{title}</p>
      </div>
      <div className="space-y-1 px-4 py-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between space-x-8">
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 shrink-0 rounded-tremor-full border-2 border-white shadow-tremor-card" style={{ background: r.color }} />
              <p className="m-0 whitespace-nowrap text-tremor-content dark:text-dark-tremor-content">{r.label}</p>
            </div>
            <p className="m-0 whitespace-nowrap font-medium tabular-nums text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis">{r.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ChartSeries { id: string; label: string; points: Point[]; color?: string }

/**
 * Time-series chart with acceptable-range band, threshold lines, event windows
 * and out-of-range highlighting. One series renders as a Tremor-style gradient
 * area; several render as lines for comparison.
 */
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
  const def = metric ? METRICS[metric] : null;
  const fmtV = format ?? ((v: number) => `${def ? v.toFixed(def.decimals) : v.toFixed(1)}${def?.unit ? ` ${def.unit}` : ''}`);
  const single = series.length === 1;
  const base = series[0]?.points ?? [];
  const t0 = base[0]?.t ?? 0; const t1 = base[base.length - 1]?.t ?? 1;
  const span = t1 - t0;
  const tf = timeFmt(span);
  const bandR = band === null ? null : band ?? (def ? def.normal : null);

  const { rows, yDomain, yTicks } = useMemo(() => {
    const tones = metric ? base.map(p => toneFor(metric, p.v)) : [];
    const bad = (j: number) => j >= 0 && j < tones.length && tones[j] !== 'ok';
    const crit = (j: number) => j >= 0 && j < tones.length && tones[j] === 'crit';
    const rows = base.map((p, i) => {
      const r: Record<string, number | null> = { t: p.t };
      series.forEach((s, si) => { r[`s${si}`] = s.points[i]?.v ?? null; });
      if (single && metric) {
        r.warn = bad(i) || bad(i - 1) || bad(i + 1) ? p.v : null;
        r.crit = crit(i) || crit(i - 1) || crit(i + 1) ? p.v : null;
      }
      return r;
    });
    const vals = series.flatMap(s => s.points.map(p => p.v));
    let lo = Math.min(...vals); let hi = Math.max(...vals);
    if (bandR && showThresholds) {
      const mid = (lo + hi) / 2; const reach = (hi - lo + 1e-6) * 3 + Math.abs(hi) * 0.6;
      if (Number.isFinite(bandR[0]) && Math.abs(bandR[0] - mid) < reach) lo = Math.min(lo, bandR[0]);
      if (Number.isFinite(bandR[1]) && Math.abs(bandR[1] - mid) < reach) hi = Math.max(hi, bandR[1]);
    }
    if (yMin !== undefined) lo = Math.min(lo, yMin);
    const pad = hi - lo || Math.abs(hi) * 0.1 || 1;
    const floor = yMin !== undefined ? yMin : lo - pad * 0.08;
    const ticks = niceTicks(Math.min(floor, lo), hi + pad * 0.05, 4);
    return { rows, yDomain: [ticks[0], ticks[ticks.length - 1]] as [number, number], yTicks: ticks };
  }, [series, metric, single, bandR, showThresholds, yMin, base]);

  const thresholds = def && showThresholds
    ? (['normal', 'crit'] as const).flatMap(k => def[k].map(v => ({ v, k })))
        .filter(x => Number.isFinite(x.v) && x.v > yDomain[0] && x.v < yDomain[1])
    : [];
  const gid = `g${series[0]?.id ?? 'x'}${series.length}`.replace(/[^a-zA-Z0-9]/g, '');
  const tick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };
  const bandLo = bandR && Number.isFinite(bandR[0]) ? Math.max(bandR[0], yDomain[0]) : yDomain[0];
  const bandHi = bandR && Number.isFinite(bandR[1]) ? Math.min(bandR[1], yDomain[1]) : yDomain[1];

  return (
    <div style={{ height }} aria-label={yLabel || def?.label || 'Trend chart'} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={series[0]?.color ?? BLUE} stopOpacity={0.2} />
              <stop offset="95%" stopColor={series[0]?.color ?? BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tf} ticks={timeTicks(t0, t1)}
            tick={tick} axisLine={false} tickLine={false} minTickGap={24} tickMargin={10} />
          <YAxis domain={yDomain} tick={tick} axisLine={false} tickLine={false} width={44} tickFormatter={fmtTick} ticks={yTicks} allowDataOverflow />
          {bandR && showThresholds && bandHi > bandLo && (
            <ReferenceArea y1={bandLo} y2={bandHi} fill={TONE_HEX.ok} fillOpacity={0.07} stroke="none" ifOverflow="hidden" />
          )}
          {windows.filter(w => w.end >= t0 && w.start <= t1).map((w, i) => (
            <ReferenceArea key={i} x1={Math.max(w.start, t0)} x2={Math.min(w.end, t1)} fill={TONE_HEX[w.tone]} fillOpacity={0.07} stroke="none" ifOverflow="hidden" />
          ))}
          {thresholds.map(({ v, k }) => (
            <ReferenceLine key={`${k}${v}`} y={v} stroke={k === 'crit' ? TONE_HEX.crit : TONE_HEX.warn} strokeDasharray="4 4" strokeOpacity={0.85} ifOverflow="hidden" />
          ))}
          {marker && marker.t >= t0 && marker.t <= t1 && (
            <ReferenceLine x={marker.t} stroke={TONE_HEX.crit} strokeWidth={1.5}
              label={{ value: marker.label, position: 'insideTopLeft', fill: TONE_HEX.crit, fontSize: 11, fontWeight: 600 }} />
          )}
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => active && payload?.length ? (
              <TipBox title={tipTime(Number(label), span)} rows={series.map((s, si) => {
                const v = payload.find(p => p.dataKey === `s${si}`)?.value as number | undefined | null;
                return { label: s.label, value: v === undefined || v === null ? '—' : fmtV(v), color: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length] };
              })} />
            ) : null}
          />
          {series.map((s, si) => single && area ? (
            <Area key={s.id} dataKey={`s${si}`} type="monotone" stroke={s.color ?? BLUE} strokeWidth={2} fill={`url(#${gid})`}
              dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: s.color ?? BLUE }} isAnimationActive={false} connectNulls />
          ) : (
            <Line key={s.id} dataKey={`s${si}`} type="monotone" stroke={s.color ?? SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth={2}
              dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} connectNulls />
          ))}
          {single && metric && <Line dataKey="warn" type="monotone" stroke={TONE_HEX.warn} strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} legendType="none" />}
          {single && metric && <Line dataKey="crit" type="monotone" stroke={TONE_HEX.crit} strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} legendType="none" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legend that can also describe bands and dashed threshold lines. */
export function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean; band?: boolean }> }) {
  return (
    <div className="dx-legend">
      {items.map(i => (
        <span key={i.label}>
          <i className={i.band ? 'band' : i.dashed ? 'dash' : 'dot'} style={i.band ? undefined : i.dashed ? { borderColor: i.color } : { background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Ranked horizontal bars (Tremor BarList). */
export function BarList({ rows, onRowClick }: {
  rows: Array<{ key: string; label: ReactNode; value: number; display: string; tone?: Tone; sub?: string }>;
  max?: number;
  onRowClick?: (key: string) => void;
}) {
  const byValue = new Map(rows.map(r => [r.value, r.display]));
  return (
    <TBarList
      data={rows.map(r => ({ key: r.key, name: r.label, value: r.value, color: (r.tone && r.tone !== 'ok' ? TONE_TREMOR[r.tone] : TB) as never }))}
      valueFormatter={(v: number) => byValue.get(v) ?? fmtTick(v)}
      sortOrder="none"
      onValueChange={onRowClick ? (p => onRowClick(String((p as { key?: string }).key))) : undefined}
    />
  );
}

/** Monthly stacked columns, e.g. billed vs lost water (Tremor BarChart). */
export function StackedColumns({ data, height = 220, keys }: {
  data: Array<{ label: string; values: number[] }>;
  keys: Array<{ label: string; color: string }>;
  height?: number;
}) {
  const rows = data.map(d => Object.fromEntries([['month', d.label], ...keys.map((k, i) => [k.label, Math.round(d.values[i])])]));
  return (
    <TBarChart data={rows} index="month" categories={keys.map(k => k.label)} colors={[TB, 'amber']} stack
      valueFormatter={(v: number) => `${Math.round(v / 1000).toLocaleString('en-US')}k`}
      showLegend={false} yAxisWidth={52} style={{ height }} showAnimation={false} />
  );
}

/** Small trend line (Tremor SparkLineChart). */
export function Sparkline({ points, tone, width = 96, height = 28 }: { points: Point[]; tone?: Tone; width?: number; height?: number }) {
  if (points.length < 2) return null;
  return (
    <SparkLineChart data={points.map(p => ({ t: p.t, v: p.v }))} index="t" categories={['v']}
      colors={[tone && tone !== 'ok' ? TONE_TREMOR[tone] : TB]} style={{ width, height }} curveType="monotone" />
  );
}

/** Small area trend (Tremor SparkAreaChart). */
export function SparkArea({ points, tone, width = 110, height = 40, fluid }: { points: Point[]; tone?: Tone | 'blue'; width?: number; height?: number; fluid?: boolean }) {
  if (points.length < 2) return null;
  return (
    <SparkAreaChart data={points.map(p => ({ t: p.t, v: p.v }))} index="t" categories={['v']}
      colors={[TONE_TREMOR[tone ?? 'blue']]} style={{ width: fluid ? '100%' : width, height }} curveType="monotone" />
  );
}

/** Small bars (Tremor SparkBarChart). */
export function SparkBars({ values, tone, width = 110, height = 40 }: { values: number[]; tone?: Tone | 'blue'; width?: number; height?: number; highlightLast?: boolean }) {
  return (
    <SparkBarChart data={values.map((v, i) => ({ i, v }))} index="i" categories={['v']}
      colors={[TONE_TREMOR[tone ?? 'blue']]} style={{ width, height }} />
  );
}

/** Donut with a centred label (Tremor DonutChart). Second slice uses amber. */
export function Donut({ parts, size = 150, label, sub }: {
  parts: Array<{ value: number; color: string; label: string }>; size?: number; thickness?: number; label: ReactNode; sub?: ReactNode;
}) {
  return (
    <div className="dx-donut" style={{ width: size, height: size }}>
      <DonutChart data={parts.map(p => ({ name: p.label, value: p.value }))} category="value" index="name"
        colors={[TB, 'amber']} showLabel={false} showAnimation={false}
        valueFormatter={(v: number) => `${v.toLocaleString()} m³/day`} className="dx-donut-chart" />
      <div className="dx-donut-c" aria-hidden="true"><b>{label}</b>{sub && <span>{sub}</span>}</div>
    </div>
  );
}

/** Vertical bars over time (Tremor BarChart). */
export function BarChart({ points, height = 170, format = (v: number) => v.toFixed(0) }: { points: Point[]; height?: number; format?: (v: number) => string; highlightLast?: boolean }) {
  const tf = timeFmt(points[points.length - 1].t - points[0].t);
  return (
    <TBarChart data={points.map(p => ({ time: tf(p.t), Value: p.v }))} index="time" categories={['Value']} colors={[TB]}
      valueFormatter={format} showLegend={false} yAxisWidth={36} style={{ height }} showAnimation={false} tickGap={24} />
  );
}

/** Vertical tank fill indicator with the warning level. */
export function TankGauge({ level, tone, low = 35 }: { level: number; tone: Tone; low?: number }) {
  return (
    <div className="dx-tank" aria-label={`${Math.round(level)} percent full`}>
      <div className="dx-tank-fill" style={{ height: `${level}%`, background: tone === 'ok' ? 'hsl(var(--primary) / 0.8)' : TONE_COLOR[tone] }} />
      <div className="dx-tank-low" style={{ bottom: `${low}%` }} />
    </div>
  );
}

/** Proportional bar split into status segments (Tremor CategoryBar). */
export function SegmentBar({ parts }: { parts: Array<{ value: number; color: string; label: string }> }) {
  const tones: Record<string, string> = {
    [TONE_COLOR.ok]: 'emerald', [TONE_COLOR.warn]: 'amber', [TONE_COLOR.crit]: 'red', [TONE_COLOR.off]: 'gray'
  };
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const shown = parts.filter(p => p.value > 0);
  return (
    <CategoryBar values={shown.map(p => (p.value / total) * 100)}
      colors={shown.map(p => (tones[p.color] ?? TB) as never)} showLabels={false} />
  );
}

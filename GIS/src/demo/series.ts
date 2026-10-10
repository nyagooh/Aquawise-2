/**
 * Deterministic telemetry engine for the demo.
 *
 * Every reading shown anywhere in the app — map popups, KPIs, tables, charts —
 * comes from `sampleAt()` / `series()`, so the "current" value on a card is
 * always the last point of the chart behind it. Values are smooth value-noise
 * plus diurnal demand patterns — there are no scripted events; alerts come
 * only from readings that cross their thresholds.
 *
 * No imports from the network loader: network.ts imports this file.
 */

export type Tone = 'ok' | 'warn' | 'crit' | 'off';
export type Metric =
  | 'pressure' | 'flow' | 'level'
  | 'turbidity' | 'ph' | 'chlorine' | 'conductivity' | 'temperature';

export interface Point { t: number; v: number }

/* ── time ── */
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "Now", snapped to the last 15-minute boundary so values are stable within a session view. */
export const NOW = (() => {
  const d = new Date();
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
  return d.getTime();
})();

export type RangeKey = '24H' | '7D' | '30D' | '3M' | 'CUSTOM';
export const RANGE_KEYS: RangeKey[] = ['24H', '7D', '30D', '3M', 'CUSTOM'];

export interface RangeSpec { key: RangeKey; hours: number; stepMin: number; label: string }

export function rangeSpec(key: RangeKey, customDays = 14): RangeSpec {
  switch (key) {
    case '24H': return { key, hours: 24, stepMin: 15, label: 'Last 24 hours' };
    case '7D':  return { key, hours: 168, stepMin: 60, label: 'Last 7 days' };
    case '30D': return { key, hours: 720, stepMin: 240, label: 'Last 30 days' };
    case '3M':  return { key, hours: 2160, stepMin: 1440, label: 'Last 3 months' };
    default: {
      const days = Math.max(1, Math.min(90, Math.round(customDays)));
      const stepMin = days <= 2 ? 15 : days <= 10 ? 60 : days <= 40 ? 240 : 1440;
      return { key, hours: days * 24, stepMin, label: `Last ${days} days` };
    }
  }
}

/* ── seeded noise ── */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rand01(seed: string): number {
  let t = hash(seed) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** Smooth noise in [-1, 1]: random knots every `period` ms, cosine-interpolated. */
function valueNoise(id: string, t: number, period: number): number {
  const k = Math.floor(t / period);
  const f = (t - k * period) / period;
  const a = rand01(`${id}:${k}`) * 2 - 1;
  const b = rand01(`${id}:${k + 1}`) * 2 - 1;
  const s = (1 - Math.cos(f * Math.PI)) / 2;
  return a + (b - a) * s;
}

/** Stable pseudo-random number for static attributes (battery, signal, …). */
export function stableRand(seed: string): number { return rand01(seed); }

/* ── diurnal patterns ── */
const hourOf = (t: number) => new Date(t).getHours() + new Date(t).getMinutes() / 60;
/** Water demand: morning and evening peaks, 0–1. */
function demand(h: number): number {
  return Math.exp(-(((h - 7.5) / 1.7) ** 2)) + 0.8 * Math.exp(-(((h - 19) / 1.9) ** 2));
}

/* ── metric definitions & thresholds ── */
export interface MetricDef {
  label: string;
  unit: string;
  decimals: number;
  /** Acceptable range — drawn as a tinted band on charts. */
  normal: [number, number];
  /** Beyond these the reading is critical. */
  crit: [number, number];
  rangeText: string;
}

export const METRICS: Record<Metric, MetricDef> = {
  pressure:     { label: 'Pressure',          unit: 'bar',   decimals: 2, normal: [1.5, 4.2], crit: [1.0, 5.0], rangeText: '1.5 – 4.2 bar' },
  flow:         { label: 'Flow',              unit: 'L/s',   decimals: 1, normal: [-Infinity, 60], crit: [-Infinity, 80],   rangeText: '—' },
  level:        { label: 'Tank level',        unit: '%',     decimals: 0, normal: [35, Infinity], crit: [20, Infinity],  rangeText: '≥ 35 %' },
  turbidity:    { label: 'Turbidity',         unit: 'NTU',   decimals: 2, normal: [-Infinity, 1.0], crit: [-Infinity, 5.0],  rangeText: '≤ 1.0 NTU' },
  ph:           { label: 'pH',                unit: '',      decimals: 1, normal: [6.5, 8.5], crit: [6.0, 9.0], rangeText: '6.5 – 8.5' },
  chlorine:     { label: 'Residual chlorine', unit: 'mg/L',  decimals: 2, normal: [0.2, 0.5], crit: [0.1, 1.0], rangeText: '0.2 – 0.5 mg/L' },
  conductivity: { label: 'Conductivity',      unit: 'µS/cm', decimals: 0, normal: [-Infinity, 1000], crit: [-Infinity, 1500], rangeText: '≤ 1,000 µS/cm' },
  temperature:  { label: 'Temperature',       unit: '°C',    decimals: 1, normal: [-Infinity, 25], crit: [-Infinity, 30],   rangeText: '≤ 25 °C' }
};

export const QUALITY_METRICS: Metric[] = ['turbidity', 'ph', 'chlorine', 'conductivity', 'temperature'];

export function toneFor(metric: Metric, v: number): Tone {
  const d = METRICS[metric];
  if (v < d.crit[0] || v > d.crit[1]) return 'crit';
  if (v < d.normal[0] || v > d.normal[1]) return 'warn';
  return 'ok';
}

export function fmt(metric: Metric, v: number, withUnit = true): string {
  const d = METRICS[metric];
  const n = v.toLocaleString('en-US', { minimumFractionDigits: d.decimals, maximumFractionDigits: d.decimals });
  return withUnit && d.unit ? `${n} ${d.unit}` : n;
}

/* ── threshold breaches ── */
/** Periods in the last `hours` where a reading sat outside its normal range. */
export function breachWindows(metric: Metric, id: string, base: number, hours = 30 * 24, stepMin = 30): Array<{ start: number; end: number; ongoing: boolean }> {
  const out: Array<{ start: number; end: number; ongoing: boolean }> = [];
  const step = stepMin * MIN;
  let open: number | null = null;
  for (let t = NOW - hours * HOUR; t <= NOW; t += step) {
    const bad = toneFor(metric, sampleAt(metric, id, base, t)) !== 'ok';
    if (bad && open === null) open = t;
    if (!bad && open !== null) { out.push({ start: open, end: t, ongoing: false }); open = null; }
  }
  if (open !== null) out.push({ start: open, end: NOW, ongoing: true });
  return out;
}

/* ── the generator ── */
/** Value of `metric` for entity `id` (whose typical value is `base`) at time `t`. */
export function sampleAt(metric: Metric, id: string, base: number, t: number): number {
  let v = rawSample(metric, id, base, t);
  if (metric === 'level') v = Math.max(3, Math.min(99, v));
  if (metric === 'turbidity') v = Math.max(0.05, v);
  if (metric === 'flow' || metric === 'pressure' || metric === 'chlorine') v = Math.max(0, v);
  return v;
}

/** Baseline behaviour: diurnal pattern plus smooth noise. */
function rawSample(metric: Metric, id: string, base: number, t: number): number {
  const h = hourOf(t);
  const n = (p: number, salt = '') => valueNoise(`${metric}:${id}${salt}`, t, p);
  const slow = n(DAY * 3, ':slow');
  let v: number;
  switch (metric) {
    case 'pressure':
      v = base + 0.18 - 0.42 * demand(h) + 0.07 * n(HOUR * 2) + 0.12 * slow;
      break;
    case 'flow':
      v = base * (0.55 + 0.65 * demand(h)) * (1 + 0.06 * n(HOUR * 2) + 0.05 * slow);
      break;
    case 'level':
      v = base + 13 * Math.cos((2 * Math.PI * (h - 5)) / 24) + 3 * n(HOUR * 3) + 4 * slow;
      break;
    case 'turbidity':
      v = base * (1 + 0.12 * n(HOUR * 2) + 0.15 * slow);
      break;
    case 'ph':
      v = base + 0.05 * n(HOUR * 3) + 0.08 * slow;
      break;
    case 'chlorine':
      v = base + 0.035 * Math.cos((2 * Math.PI * (h - 6)) / 24) + 0.015 * n(HOUR * 2) + 0.02 * slow;
      break;
    case 'conductivity':
      v = base + 9 * n(HOUR * 4) + 18 * slow;
      break;
    case 'temperature':
      v = base + 1.4 * Math.cos((2 * Math.PI * (h - 15)) / 24) + 0.25 * n(HOUR * 3) + 0.6 * slow;
      break;
  }
  return v;
}

export function current(metric: Metric, id: string, base: number): number {
  return sampleAt(metric, id, base, NOW);
}

export function series(metric: Metric, id: string, base: number, spec: RangeSpec): Point[] {
  const step = spec.stepMin * MIN;
  const n = Math.round((spec.hours * HOUR) / step);
  const out: Point[] = [];
  for (let i = n; i >= 0; i--) {
    const t = NOW - i * step;
    out.push({ t, v: sampleAt(metric, id, base, t) });
  }
  return out;
}

/** Point-wise mean of several series sharing the same time grid. */
export function meanSeries(list: Point[][]): Point[] {
  if (!list.length) return [];
  return list[0].map((p, i) => ({ t: p.t, v: list.reduce((s, l) => s + l[i].v, 0) / list.length }));
}

/* ── water-quality monitoring points (one per zone + works outlet) ── */
export interface QualityBase { turbidity: number; ph: number; chlorine: number; conductivity: number; temperature: number }

export const QUALITY_POINTS: Array<{ id: string; zone: string; name: string; base: QualityBase }> = [
  { id: 'WQ-WTW',      zone: 'WTW',      name: 'Mairo Inya WTP outlet',    base: { turbidity: 0.28, ph: 7.3, chlorine: 0.41, conductivity: 402, temperature: 18.6 } },
  { id: 'WQ-SHAURI',   zone: 'SHAURI',   name: 'Shauri · Ndothua kiosk',   base: { turbidity: 0.70, ph: 7.2, chlorine: 0.33, conductivity: 455, temperature: 19.4 } },
  { id: 'WQ-ZIWANI3',  zone: 'ZIWANI3',  name: 'Ziwani 3 · Kahembe TC',    base: { turbidity: 0.55, ph: 7.4, chlorine: 0.29, conductivity: 478, temperature: 19.9 } },
  { id: 'WQ-ZIWANI2',  zone: 'ZIWANI2',  name: 'Ziwani 2 · Shamata',       base: { turbidity: 0.62, ph: 6.9, chlorine: 0.36, conductivity: 431, temperature: 20.3 } },
  { id: 'WQ-ZIWANI1',  zone: 'ZIWANI1',  name: 'Ziwani 1 · Ngai Ndeithia', base: { turbidity: 0.48, ph: 7.1, chlorine: 0.31, conductivity: 612, temperature: 19.1 } },
  { id: 'WQ-KWANJORA', zone: 'KWANJORA', name: 'Kwa Njora · Ndogino',      base: { turbidity: 0.51, ph: 7.0, chlorine: 0.32, conductivity: 498, temperature: 18.7 } }
];

/** Current pH / turbidity at a zone's monitoring point — used by the map's quality probes. */
export function currentQualityForZone(zone: string): { ph: number; ntu: number; phTone: Tone; ntuTone: Tone } | null {
  const p = QUALITY_POINTS.find(q => q.zone === zone);
  if (!p) return null;
  const ph = current('ph', p.id, p.base.ph);
  const ntu = current('turbidity', p.id, p.base.turbidity);
  return { ph, ntu, phTone: toneFor('ph', ph), ntuTone: toneFor('turbidity', ntu) };
}

export const worstTone = (tones: Tone[]): Tone =>
  tones.includes('crit') ? 'crit' : tones.includes('warn') ? 'warn' : tones.includes('off') ? 'off' : 'ok';

export const HOURS = HOUR;
export const DAYS = DAY;

/** Series between two absolute times (used for "data around the event"). */
export function seriesWindow(metric: Metric, id: string, base: number, from: number, to: number, points = 120): Point[] {
  const step = Math.max(MIN, Math.round((to - from) / points / MIN) * MIN);
  const out: Point[] = [];
  for (let t = from; t <= Math.min(to, NOW); t += step) out.push({ t, v: sampleAt(metric, id, base, t) });
  return out;
}

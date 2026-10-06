/**
 * Deterministic telemetry engine for the demo.
 *
 * Every reading shown anywhere in the app — map popups, KPIs, tables, charts —
 * comes from `sampleAt()` / `series()`, so the "current" value on a card is
 * always the last point of the chart behind it. Values are smooth value-noise
 * plus diurnal demand patterns plus scripted operational events (a turbidity
 * rise in Riverside, a pressure drop in Northgate, a reservoir drawing down…).
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

/* ── scripted operational events ── */
export interface SeriesEvent {
  /** Hours before NOW the event starts (ramp begins). */
  startH: number;
  /** Hours before NOW the event ends (0 = ongoing). */
  endH: number;
  delta: number;
  rampH: number;
  /** For ongoing events: the value reached at NOW (overrides delta so "current" is stable at any time of day). */
  target?: number;
}

/** Events keyed by `${metric}:${entityId}`. Entity ids match the network data. */
export const EVENTS: Record<string, SeriesEvent[]> = {
  // Northgate pressure collapse — the headline incident
  'pressure:SN-12': [{ startH: 3.5, endH: 0, delta: -2.25, rampH: 0.75, target: 0.94 }, { startH: 9 * 24, endH: 9 * 24 - 5, delta: -1.4, rampH: 1 }],
  'pressure:SN-24': [{ startH: 3.25, endH: 0, delta: -1.05, rampH: 1, target: 1.36 }],
  'pressure:SN-04': [{ startH: 26 * 24, endH: 26 * 24 - 8, delta: -1.3, rampH: 1 }],
  // Downtown pressure anomaly yesterday — resolved
  'pressure:SN-01': [{ startH: 30, endH: 26, delta: -1.2, rampH: 0.5 }],
  // Riverside repeated anomalies over the month
  'pressure:SN-10': [{ startH: 6 * 24, endH: 6 * 24 - 4, delta: -1.25, rampH: 0.5 }, { startH: 17 * 24, endH: 17 * 24 - 6, delta: -1.3, rampH: 0.5 }, { startH: 40 * 24, endH: 40 * 24 - 6, delta: -1.1, rampH: 1 }],
  'pressure:SN-19': [{ startH: 13 * 24, endH: 13 * 24 - 3, delta: -1.4, rampH: 0.5 }],
  // Sensor flows mirror the leak
  'flow:SN-12': [{ startH: 3.5, endH: 0, delta: 9.5, rampH: 0.75 }],
  // Reservoir 01 drawing down
  'level:TANK-01': [{ startH: 11, endH: 0, delta: -30, rampH: 9, target: 31 }],
  'level:TANK-06': [{ startH: 20 * 24, endH: 20 * 24 - 10, delta: -30, rampH: 4 }],
  // Water quality
  'turbidity:WQ-MIL': [{ startH: 7, endH: 0, delta: 3.9, rampH: 3, target: 4.6 }, { startH: 22 * 24, endH: 22 * 24 - 10, delta: 1.6, rampH: 2 }],
  'turbidity:WQ-OBA': [{ startH: 9 * 24, endH: 9 * 24 - 14, delta: 5.6, rampH: 3 }],
  'chlorine:WQ-ME':   [{ startH: 30, endH: 0, delta: -0.14, rampH: 12, target: 0.16 }],
  'chlorine:WQ-CBD':  [{ startH: 15 * 24, endH: 15 * 24 - 20, delta: -0.17, rampH: 6 }],
  'ph:WQ-KREKAJ':     [{ startH: 4 * 24, endH: 4 * 24 - 6, delta: 1.05, rampH: 2 }]
};

function eventOffset(key: string, t: number, rawNow: () => number): number {
  const evs = EVENTS[key];
  if (!evs) return 0;
  let off = 0;
  for (const e of evs) {
    const delta = e.target !== undefined && e.endH === 0
      ? e.target - rawNow() - evs.filter(o => o !== e && o.endH === 0).reduce((s, o) => s + o.delta, 0)
      : e.delta;
    const start = NOW - e.startH * HOUR;
    const end = e.endH > 0 ? NOW - e.endH * HOUR : Infinity;
    if (t < start) continue;
    const up = Math.min(1, (t - start) / (e.rampH * HOUR));
    const down = t > end ? Math.max(0, 1 - (t - end) / (e.rampH * HOUR)) : 1;
    off += delta * Math.min(up, down);
  }
  return off;
}

/** Hours-ago windows where an entity was outside its normal range — used for anomaly markers. */
export function eventWindows(metric: Metric, id: string): Array<{ start: number; end: number; ongoing: boolean }> {
  return (EVENTS[`${metric}:${id}`] || []).map(e => ({
    start: NOW - e.startH * HOUR,
    end: e.endH > 0 ? NOW - e.endH * HOUR : NOW,
    ongoing: e.endH === 0
  }));
}

/* ── the generator ── */
/** Value of `metric` for entity `id` (whose typical value is `base`) at time `t`. */
export function sampleAt(metric: Metric, id: string, base: number, t: number): number {
  let v = rawSample(metric, id, base, t);
  v += eventOffset(`${metric}:${id}`, t, () => rawSample(metric, id, base, NOW));
  if (metric === 'level') v = Math.max(3, Math.min(99, v));
  if (metric === 'turbidity') v = Math.max(0.05, v);
  if (metric === 'flow' || metric === 'pressure' || metric === 'chlorine') v = Math.max(0, v);
  return v;
}

/** Baseline behaviour without scripted events. */
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
  { id: 'WQ-WTW',    zone: 'WTW',    name: 'Treatment works outlet',   base: { turbidity: 0.28, ph: 7.3, chlorine: 0.41, conductivity: 402, temperature: 20.6 } },
  { id: 'WQ-MIL',    zone: 'MIL',    name: 'Riverside · Elm Rd booster', base: { turbidity: 0.70, ph: 7.2, chlorine: 0.33, conductivity: 455, temperature: 21.4 } },
  { id: 'WQ-MYT',    zone: 'MYT',    name: 'Northgate · Kingsway',     base: { turbidity: 0.55, ph: 7.4, chlorine: 0.29, conductivity: 478, temperature: 21.9 } },
  { id: 'WQ-CBD',    zone: 'CBD',    name: 'Downtown · Central Plaza', base: { turbidity: 0.62, ph: 6.9, chlorine: 0.36, conductivity: 431, temperature: 22.3 } },
  { id: 'WQ-KREKAJ', zone: 'KREKAJ', name: 'East Meadows · Kajiado Rd', base: { turbidity: 0.48, ph: 7.1, chlorine: 0.31, conductivity: 612, temperature: 21.1 } },
  { id: 'WQ-ME',     zone: 'ME',     name: 'Millbrook East · Hill Rd', base: { turbidity: 0.51, ph: 7.0, chlorine: 0.32, conductivity: 498, temperature: 21.7 } },
  { id: 'WQ-OBA',    zone: 'OBA',    name: 'Westhaven · Cedar Lane',   base: { turbidity: 0.58, ph: 7.2, chlorine: 0.34, conductivity: 467, temperature: 21.5 } },
  { id: 'WQ-KRE',    zone: 'KRE',    name: 'Millwood · Old Mill',      base: { turbidity: 0.44, ph: 7.3, chlorine: 0.38, conductivity: 441, temperature: 21.0 } }
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

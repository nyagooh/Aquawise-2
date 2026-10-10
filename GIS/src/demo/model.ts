/**
 * Operational model for the demo — built once from the real Erline Water network
 * (pipes + telemetry assets) and the deterministic series engine.
 */
import { useEffect, useState } from 'react';
import {
  loadNetwork, zoneLabel,
  type NetworkData, type PipeFeature, type TankProps, type SensorProps,
  type PressureValveProps, type MeterValveProps, type FacilityProps
} from '../data/network';
import { ZONE_SEED, ZONE_CODES, buildNrwMonthly, type NrwMonth } from './nrw';
import {
  current, sampleAt, toneFor, worstTone, stableRand, breachWindows, seriesWindow, fmt, METRICS,
  NOW, HOURS, DAYS, QUALITY_POINTS, QUALITY_METRICS,
  type Metric, type Tone, type QualityBase
} from './series';

export type LatLng = [number, number];

/* ── zones ── */
export interface ZoneOps {
  code: string;
  name: string;
  lengthKm: number;
  pipeCount: number;
  connections: number;
  suppliedM3d: number;
  billedM3d: number;
  lossM3d: number;
  nrw: number;
  nrwPrev: number;
  center: LatLng;
  pressureAvg: number;
  tone: Tone;
}

export { ZONE_CODES } from './nrw';

/* ── monitoring entities ── */
export interface PressurePoint {
  id: string; name: string; zone: string; pos: LatLng; pipeId: string;
  base: number; value: number; tone: Tone;
  flowBase: number; flow: number;
  online: boolean;
}
export interface TankOps {
  id: string; name: string; zone: string; pos: LatLng;
  capacity: number; base: number; level: number; volume: number; tone: Tone;
  inflow: number; outflow: number; change6h: number;
  /** Change over the last 6 h minus the change over the same hours yesterday — isolates abnormal drawdown. */
  vsYesterday: number;
  abnormal: boolean;
  hoursToLow: number | null;
}
export interface QualityPointOps {
  id: string; name: string; zone: string; pos: LatLng; base: QualityBase;
  values: Record<Metric, number>; tones: Partial<Record<Metric, Tone>>; tone: Tone;
  updatedMin: number;
}
export type DeviceKind = 'Pressure & flow' | 'Tank level' | 'Water quality';
export interface SensorDevice {
  id: string; name: string; kind: DeviceKind; measures: string;
  zone: string; pos: LatLng;
  health: Tone;            // ok = online, warn = degraded, off = offline
  healthNote: string;
  battery: number;         // %
  signal: number;          // dBm
  lastCommMin: number;
  reading: string;
  entityId: string;        // id used for its series
  metric: Metric;
  base: number;
  installed: number;
}
export interface PrvOps extends PressureValveProps { zone: string; pos: LatLng }
export interface MeterOps extends MeterValveProps { zone: string; pos: LatLng }

/* ── incidents ── */
export type IncidentType =
  | 'Water quality breach' | 'Pressure anomaly' | 'Low tank level';
export type Severity = 'critical' | 'warning' | 'info';
export type IncidentStatus = 'active' | 'acknowledged' | 'resolved';

export interface Incident {
  id: string;
  type: IncidentType;
  severity: Severity;
  title: string;
  zone: string;
  location: string;
  metric: Metric;
  entityId: string;
  base: number;
  trigger: string;
  startedAt: number;
  resolvedAt?: number;
  status: IncidentStatus;
  focus: string;          // network deep link, e.g. asset:SN-14
  summary: string;
}

export type { NrwMonth };

export interface Ops {
  network: NetworkData;
  zones: ZoneOps[];
  pressure: PressurePoint[];
  tanks: TankOps[];
  quality: QualityPointOps[];
  sensors: SensorDevice[];
  prvs: PrvOps[];
  meters: MeterOps[];
  incidents: Incident[];
  nrwMonthly: NrwMonth[];
  nrw: { current: number; prev: number; supplied: number; billed: number; loss: number };
  health: { score: number; normal: number; total: number };
}

/* ── helpers ── */
export const zoneName = (code: string) => (code === 'WTW' ? 'Treatment works' : zoneLabel(code));
const toLatLng = (c: [number, number]): LatLng => [c[1], c[0]];
const mid = (p: PipeFeature): LatLng => toLatLng(p.geometry.coordinates[Math.floor(p.geometry.coordinates.length / 2)] as [number, number]);


function build(network: NetworkData): Ops {
  const { pipes, assets } = network;
  const pipeById = new Map(pipes.map(p => [p.properties.id, p]));
  const mids = pipes.filter(p => p.properties.zone && ZONE_CODES.includes(p.properties.zone)).map(p => ({ ll: mid(p), zone: p.properties.zone as string }));
  const nearestZone = (ll: LatLng) => {
    let best = mids[0]; let bd = Infinity;
    for (const m of mids) {
      const d = (m.ll[0] - ll[0]) ** 2 + (m.ll[1] - ll[1]) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    return best?.zone ?? 'SHAURI';
  };

  /* pressure points: real flow + pressure sensors */
  const pressure: PressurePoint[] = assets
    .filter(a => a.properties.asset === 'sensor' && !(a.properties as SensorProps).subtype)
    .map(a => {
      const p = a.properties as SensorProps;
      const pos = toLatLng(a.geometry.coordinates);
      const pz = pipeById.get(p.pipe_id)?.properties.zone;
      const zone = pz && ZONE_CODES.includes(pz) ? pz : nearestZone(pos);
      // base = the static snapshot value the series is built around (before live overwrite)
      const base = baseFor('pressure', p.id, p.pressure_bar);
      const flowBase = baseFor('flow', p.id, p.flow_lps);
      const online = true;
      const value = current('pressure', p.id, base);
      return {
        id: p.id, name: `${zoneName(zone)} · ${p.id}`, zone, pos, pipeId: p.pipe_id,
        base, value, tone: online ? toneFor('pressure', value) : 'off',
        flowBase, flow: current('flow', p.id, flowBase), online
      };
    });

  /* tanks */
  const tanks: TankOps[] = assets
    .filter(a => a.properties.asset === 'tank')
    .map(a => {
      const p = a.properties as TankProps;
      const pos = toLatLng(a.geometry.coordinates);
      const base = baseFor('level', p.id, p.level_pct);
      const level = current('level', p.id, base);
      const ago = level - levelAt(p.id, base, 6);
      const yesterday = levelAt(p.id, base, 24) - levelAt(p.id, base, 30);
      const vsYesterday = ago - yesterday;
      const abnormal = vsYesterday < -8;
      // Project only abnormal drawdown: the usual daytime fall refills overnight.
      const rate = vsYesterday / 6; // % per hour beyond the normal pattern
      const hoursToLow = abnormal && level > 20 ? (level - 20) / -rate : null;
      return {
        // Each reservoir feeds the zone named after it (Ziwani Reservoir 1 → Ziwani 1).
        id: p.id, name: p.name, zone: ZONE_CODES.find(c => zoneName(c) === p.name.replace(' Reservoir', '')) ?? nearestZone(pos), pos,
        capacity: p.capacity_m3, base, level, volume: (level / 100) * p.capacity_m3,
        tone: toneFor('level', level), inflow: p.inflow_lps, outflow: p.outflow_lps,
        change6h: ago, vsYesterday, abnormal, hoursToLow
      };
    });

  /* water-quality points */
  const zoneSample: Record<string, LatLng> = {};
  for (const p of pipes) {
    const z = p.properties.zone;
    if (z && !zoneSample[z]) zoneSample[z] = mid(p);
  }
  const tank1 = tanks[0]?.pos ?? [0, 0];
  const wtp = assets.find(a => a.properties.asset === 'facility' && (a.properties as FacilityProps).facility_type === 'wtp');
  const works: LatLng = wtp ? toLatLng(wtp.geometry.coordinates) : [tank1[0] + 0.004, tank1[1] - 0.004];
  const quality: QualityPointOps[] = QUALITY_POINTS.map((q, i) => {
    const values = {} as Record<Metric, number>;
    const tones: Partial<Record<Metric, Tone>> = {};
    for (const m of QUALITY_METRICS) {
      values[m] = current(m, q.id, q.base[m as keyof QualityBase]);
      tones[m] = toneFor(m, values[m]);
    }
    const pos: LatLng = q.zone === 'WTW' ? works : (zoneSample[q.zone] ?? tank1);
    return { id: q.id, name: q.name, zone: q.zone, pos, base: q.base, values, tones, tone: worstTone(Object.values(tones) as Tone[]), updatedMin: 1 + (i % 4) };
  });

  /* zones */
  const zones: ZoneOps[] = ZONE_SEED.map(z => {
    const zp = pipes.filter(p => p.properties.zone === z.code);
    const pts = pressure.filter(p => p.zone === z.code && p.online);
    const pressureAvg = pts.length ? pts.reduce((s, p) => s + p.value, 0) / pts.length : 0;
    const tones: Tone[] = [
      ...pts.map(p => p.tone),
      ...quality.filter(q => q.zone === z.code).map(q => q.tone),
      ...tanks.filter(t => t.zone === z.code).map(t => t.tone)
    ];
    const lls = zp.map(mid);
    const center: LatLng = lls.length
      ? [lls.reduce((s, l) => s + l[0], 0) / lls.length, lls.reduce((s, l) => s + l[1], 0) / lls.length]
      : network.meta.center ? [network.meta.center[1], network.meta.center[0]] : [0, 0];
    const lossM3d = Math.round(z.supplied * z.nrw / 100);
    return {
      code: z.code, name: zoneName(z.code), lengthKm: network.meta.length_km_by_zone[z.code] ?? 0,
      pipeCount: zp.length, connections: z.connections,
      suppliedM3d: z.supplied, billedM3d: z.supplied - lossM3d, lossM3d,
      nrw: z.nrw, nrwPrev: z.nrwPrev, center, pressureAvg, tone: worstTone(tones)
    };
  });

  /* valves & meters */
  const prvs: PrvOps[] = assets.filter(a => a.properties.asset === 'pressure_valve').map(a => {
    const pos = toLatLng(a.geometry.coordinates);
    return { ...(a.properties as PressureValveProps), zone: nearestZone(pos), pos };
  });
  const meters: MeterOps[] = assets.filter(a => a.properties.asset === 'meter_valve').map(a => {
    const pos = toLatLng(a.geometry.coordinates);
    return { ...(a.properties as MeterValveProps), zone: nearestZone(pos), pos };
  });

  /* sensor devices */
  const sensors: SensorDevice[] = [];
  pressure.forEach(p => {
    const r = stableRand(`bat:${p.id}`);
    const battery = Math.round(38 + r * 60);
    const signal = Math.round(-62 - stableRand(`sig:${p.id}`) * 38);
    const health: Tone = !p.online ? 'off' : battery < 20 ? 'warn' : 'ok';
    sensors.push({
      id: p.id, name: `Flow + pressure logger ${p.id.replace('SN-', '')}`, kind: 'Pressure & flow', measures: 'Pressure, flow',
      zone: p.zone, pos: p.pos, health,
      healthNote: !p.online ? 'Not reporting' : battery < 20 ? 'Low battery' : 'Reporting normally',
      battery, signal,
      lastCommMin: Math.max(1, Math.round(stableRand(`lc:${p.id}`) * 4)),
      reading: p.online ? `${p.value.toFixed(2)} bar · ${p.flow.toFixed(1)} L/s` : '—',
      entityId: p.id, metric: 'pressure', base: p.base,
      installed: 2019 + Math.floor(stableRand(`yr:${p.id}`) * 6)
    });
  });
  tanks.forEach((t, i) => {
    const id = `LV-${String(i + 1).padStart(2, '0')}`;
    sensors.push({
      id, name: `Ultrasonic level sensor · ${t.name}`, kind: 'Tank level', measures: 'Level',
      zone: t.zone, pos: t.pos, health: 'ok',
      healthNote: 'Reporting normally',
      battery: Math.round(55 + stableRand(`bat:${id}`) * 44), signal: Math.round(-60 - stableRand(`sig:${id}`) * 25),
      lastCommMin: 1 + (i % 3), reading: `${Math.round(t.level)} %`,
      entityId: t.id, metric: 'level', base: t.base, installed: 2021 + (i % 3)
    });
  });
  quality.forEach((q, i) => {
    const id = `WQS-${String(i + 1).padStart(2, '0')}`;
    sensors.push({
      id, name: `Multi-parameter sonde · ${q.name}`, kind: 'Water quality', measures: 'Turbidity, pH, chlorine, conductivity, temperature',
      zone: q.zone, pos: q.pos, health: 'ok', healthNote: 'Reporting normally',
      battery: Math.round(60 + stableRand(`bat:${id}`) * 39), signal: Math.round(-58 - stableRand(`sig:${id}`) * 30),
      lastCommMin: q.updatedMin, reading: `${q.values.turbidity.toFixed(2)} NTU · pH ${q.values.ph.toFixed(1)}`,
      entityId: q.id, metric: 'turbidity', base: q.base.turbidity, installed: 2022 + (i % 3)
    });
  });

  /* alerts: every period in the last 30 days where a monitored reading left
     its normal range. Nothing is scripted — they come from the readings. */
  const watched: Array<{ metric: Metric; id: string; base: number; zone: string; location: string; focus: string }> = [
    ...pressure.map(p => ({ metric: 'pressure' as Metric, id: p.id, base: p.base, zone: p.zone, location: `Logger ${p.id} · pipe ${p.pipeId}`, focus: `asset:${p.id}` })),
    ...tanks.map(t => ({ metric: 'level' as Metric, id: t.id, base: t.base, zone: t.zone, location: t.name, focus: `asset:${t.id}` })),
    ...quality.flatMap(q => QUALITY_METRICS.map(m => ({
      metric: m, id: q.id, base: q.base[m as keyof QualityBase], zone: q.zone, location: q.name,
      focus: q.zone === 'WTW' ? '' : `asset:${m === 'turbidity' ? 'TB' : 'PH'}-${q.zone}`
    })))
  ];
  const TYPE: Partial<Record<Metric, IncidentType>> = { pressure: 'Pressure anomaly', level: 'Low tank level' };
  const detected = watched.flatMap(w => breachWindows(w.metric, w.id, w.base).map(win => {
    const def = METRICS[w.metric];
    const pts = seriesWindow(w.metric, w.id, w.base, win.start, win.end, 40);
    const worst = pts.reduce((a, b) => (Math.abs(b.v - w.base) > Math.abs(a.v - w.base) ? b : a), pts[0]);
    const low = worst.v < def.normal[0];
    const limit = low ? def.normal[0] : def.normal[1];
    const tone = pts.some(x => toneFor(w.metric, x.v) === 'crit') ? 'crit' : 'warn';
    const hours = Math.max(1, Math.round((win.end - win.start) / HOURS));
    return {
      type: TYPE[w.metric] ?? 'Water quality breach',
      severity: (tone === 'crit' ? 'critical' : 'warning') as Severity,
      title: w.metric === 'level'
        ? `${w.location} ${tone === 'crit' ? 'nearly empty' : 'running low'}`
        : `${def.label} ${low ? 'below' : 'above'} range — ${zoneName(w.zone)}`,
      zone: w.zone, location: w.location, metric: w.metric, entityId: w.id, base: w.base,
      trigger: `${fmt(w.metric, win.ongoing ? sampleAt(w.metric, w.id, w.base, NOW) : worst.v)}, ${low ? 'below' : 'above'} the ${fmt(w.metric, limit)} limit`,
      startedAt: win.start, resolvedAt: win.ongoing ? undefined : win.end,
      status: (win.ongoing ? 'active' : 'resolved') as IncidentStatus,
      focus: w.focus,
      summary: win.ongoing
        ? `${def.label} has been outside its normal range (${def.rangeText}) for about ${hours} h and has not yet returned.`
        : `${def.label} was outside its normal range (${def.rangeText}) for about ${hours} h before returning to normal.`
    };
  }));
  detected.sort((a, b) => b.startedAt - a.startedAt);
  const incidents: Incident[] = detected.map((d, i) => ({ id: `ALT-${String(1000 + detected.length - i)}`, ...d }));

  const nrwMonthly = buildNrwMonthly();
  const last = nrwMonthly[nrwMonthly.length - 1];
  const prev = nrwMonthly[nrwMonthly.length - 2];
  const daySupplied = zones.reduce((s, z) => s + z.suppliedM3d, 0);
  const dayLoss = zones.reduce((s, z) => s + z.lossM3d, 0);

  /* network health = share of monitored points currently normal */
  const pointTones: Tone[] = [...pressure.map(p => p.tone), ...tanks.map(t => t.tone), ...quality.map(q => q.tone)];
  const normal = pointTones.filter(t => t === 'ok').length;

  return {
    network, zones, pressure, tanks, quality, sensors, prvs, meters, incidents, nrwMonthly,
    nrw: { current: last.nrw, prev: prev.nrw, supplied: daySupplied, billed: daySupplied - dayLoss, loss: dayLoss },
    health: { score: Math.round((normal / pointTones.length) * 100), normal, total: pointTones.length }
  };
}

/* The loader overwrites live values on the assets, so remember the original
   snapshot values to use as series bases. */
const BASES: Record<string, number> = {};
function baseFor(metric: Metric, id: string, fallback: number) {
  return BASES[`${metric}:${id}`] ?? fallback;
}
function levelAt(id: string, base: number, hoursAgo: number) {
  return sampleLevel(id, base, NOW - hoursAgo * HOURS);
}
const sampleLevel = (id: string, base: number, t: number) => sampleAt('level', id, base, t);

let opsPromise: Promise<Ops> | null = null;
async function loadOps(): Promise<Ops> {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  // Read the untouched snapshot so series bases match the dataset, not the live overwrite.
  const raw = await fetch(`${base.replace(/\/$/, '')}/data/erline-assets.geojson`).then(r => r.json());
  for (const f of raw.features as Array<{ properties: Record<string, unknown> }>) {
    const p = f.properties;
    if (p.asset === 'sensor') { BASES[`pressure:${p.id}`] = p.pressure_bar as number; BASES[`flow:${p.id}`] = p.flow_lps as number; }
    if (p.asset === 'tank') BASES[`level:${p.id}`] = p.level_pct as number;
  }
  return build(await loadNetwork());
}

export function useOps(): Ops | null {
  const [ops, setOps] = useState<Ops | null>(null);
  useEffect(() => {
    let alive = true;
    if (!opsPromise) opsPromise = loadOps();
    opsPromise.then(o => { if (alive) setOps(o); });
    return () => { alive = false; };
  }, []);
  return ops;
}

/* ── formatting ── */
export function ago(t: number): string {
  const m = Math.round((NOW - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60 ? `${m % 60} min ` : ''}ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}
export function minsAgo(m: number): string {
  if (m < 60) return `${m} min ago`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} h ${m % 60} min ago`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h ago`;
}
export function clock(t: number): string {
  const d = new Date(t);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export const DAY_MS = DAYS;

/**
 * Operational model for the demo — built once from the real Riverton network
 * (pipes + telemetry assets) and the deterministic series engine.
 */
import { useEffect, useState } from 'react';
import {
  loadNetwork, zoneLabel,
  type NetworkData, type PipeFeature, type TankProps, type SensorProps,
  type PressureValveProps, type MeterValveProps
} from '../data/network';
import { ZONE_SEED, ZONE_CODES, buildNrwMonthly, type NrwMonth } from './nrw';
import {
  current, sampleAt, toneFor, worstTone, stableRand, NOW, HOURS, DAYS, QUALITY_POINTS, QUALITY_METRICS,
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
  | 'Water quality breach' | 'Pressure anomaly' | 'Possible leak'
  | 'Low tank level' | 'Sensor offline' | 'Abnormal reading';
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
  focus: string;          // network deep link, e.g. asset:SN-12
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

const OFFLINE = new Set(['SN-07', 'SN-23']);

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
    return best?.zone ?? 'MIL';
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
      const online = !OFFLINE.has(p.id);
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
      const n = p.id.replace('TANK-', '');
      return {
        id: p.id, name: `Reservoir ${n}`, zone: nearestZone(pos), pos,
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
  const quality: QualityPointOps[] = QUALITY_POINTS.map((q, i) => {
    const values = {} as Record<Metric, number>;
    const tones: Partial<Record<Metric, Tone>> = {};
    for (const m of QUALITY_METRICS) {
      values[m] = current(m, q.id, q.base[m as keyof QualityBase]);
      tones[m] = toneFor(m, values[m]);
    }
    const pos: LatLng = q.zone === 'WTW' ? [tank1[0] + 0.004, tank1[1] - 0.004] : (zoneSample[q.zone] ?? tank1);
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
    const battery = p.id === 'SN-14' ? 14 : Math.round(38 + r * 60);
    const signal = Math.round(-62 - stableRand(`sig:${p.id}`) * 38);
    const health: Tone = !p.online ? 'off' : battery < 20 ? 'warn' : 'ok';
    sensors.push({
      id: p.id, name: `Flow + pressure logger ${p.id.replace('SN-', '')}`, kind: 'Pressure & flow', measures: 'Pressure, flow',
      zone: p.zone, pos: p.pos, health,
      healthNote: !p.online ? (p.id === 'SN-07' ? 'No data for 3 h 10 min' : 'No data for 2 days') : battery < 20 ? 'Low battery' : 'Reporting normally',
      battery, signal,
      lastCommMin: p.id === 'SN-07' ? 190 : p.id === 'SN-23' ? 2 * 24 * 60 + 35 : Math.max(1, Math.round(stableRand(`lc:${p.id}`) * 4)),
      reading: p.online ? `${p.value.toFixed(2)} bar · ${p.flow.toFixed(1)} L/s` : '—',
      entityId: p.id, metric: 'pressure', base: p.base,
      installed: 2019 + Math.floor(stableRand(`yr:${p.id}`) * 6)
    });
  });
  tanks.forEach((t, i) => {
    const id = `LV-${String(i + 1).padStart(2, '0')}`;
    const warn = id === 'LV-04';
    sensors.push({
      id, name: `Ultrasonic level sensor · ${t.name}`, kind: 'Tank level', measures: 'Level',
      zone: t.zone, pos: t.pos, health: warn ? 'warn' : 'ok',
      healthNote: warn ? 'Weak signal (−104 dBm)' : 'Reporting normally',
      battery: Math.round(55 + stableRand(`bat:${id}`) * 44), signal: warn ? -104 : Math.round(-60 - stableRand(`sig:${id}`) * 25),
      lastCommMin: warn ? 18 : 1 + (i % 3), reading: `${Math.round(t.level)} %`,
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

  /* incidents */
  const P = (id: string) => pressure.find(p => p.id === id)!;
  const Q = (id: string) => quality.find(q => q.id === id)!;
  const T = (id: string) => tanks.find(t => t.id === id)!;
  const ago = (h: number) => NOW - h * HOURS;
  const sn12 = P('SN-12'); const sn24 = P('SN-24');
  const wqMil = Q('WQ-MIL'); const wqMe = Q('WQ-ME');
  const t1 = T('TANK-01');
  const inc = (i: Omit<Incident, 'base'> & { base?: number }): Incident => ({ base: 0, ...i });
  const incidents: Incident[] = [
    inc({ id: 'INC-2318', type: 'Pressure anomaly', severity: 'critical', status: 'active', title: 'Pressure anomaly detected — Northgate',
      zone: 'MYT', location: `Logger SN-12 · pipe ${sn12.pipeId}`, metric: 'pressure', entityId: 'SN-12', base: sn12.base,
      trigger: `${sn12.value.toFixed(2)} bar, below the 1.5 bar minimum`, startedAt: ago(3.1), focus: 'asset:SN-12',
      summary: 'Pressure fell by more than 2 bar in under an hour while flow at the same logger rose. The pattern is consistent with a main break downstream of SN-12.' }),
    inc({ id: 'INC-2317', type: 'Possible leak', severity: 'critical', status: 'active', title: 'Possible leak — Northgate, Kingsway',
      zone: 'MYT', location: `Pipe ${sn12.pipeId} near SN-12`, metric: 'flow', entityId: 'SN-12', base: sn12.flowBase,
      trigger: `Flow ${sn12.flow.toFixed(1)} L/s, about ${(sn12.flow - sn12.flowBase).toFixed(0)} L/s above the expected profile`, startedAt: ago(3.0), focus: `pipe:${sn12.pipeId}`,
      summary: 'Sustained excess flow together with the pressure drop. A customer also reported water on the road surface (ticket LK-2041).' }),
    inc({ id: 'INC-2316', type: 'Water quality breach', severity: 'warning', status: 'active', title: 'Turbidity above threshold — Riverside',
      zone: 'MIL', location: wqMil.name, metric: 'turbidity', entityId: 'WQ-MIL', base: wqMil.base.turbidity,
      trigger: `${wqMil.values.turbidity.toFixed(2)} NTU, limit 1.0 NTU`, startedAt: ago(5.2), focus: 'asset:TB-MIL',
      summary: 'Turbidity has been rising for several hours at the Riverside booster. Check upstream works and flush if it continues.' }),
    inc({ id: 'INC-2315', type: 'Low tank level', severity: 'warning', status: 'active', title: 'Reservoir 01 approaching low level',
      zone: t1.zone, location: 'Reservoir 01', metric: 'level', entityId: 'TANK-01', base: t1.base,
      trigger: `${Math.round(t1.level)} % of ${t1.capacity.toLocaleString()} m³, warning level 35 %, low level 20 %`, startedAt: ago(1.6), focus: 'asset:TANK-01',
      summary: `Outflow has exceeded inflow for most of the day. At the current rate the reservoir reaches its 20 % low level in about ${t1.hoursToLow ? Math.max(1, Math.round(t1.hoursToLow)) : 'a few'} hours.` }),
    inc({ id: 'INC-2314', type: 'Pressure anomaly', severity: 'warning', status: 'active', title: 'Low pressure — Northgate',
      zone: 'MYT', location: `Logger SN-24 · pipe ${sn24.pipeId}`, metric: 'pressure', entityId: 'SN-24', base: sn24.base,
      trigger: `${sn24.value.toFixed(2)} bar, below the 1.5 bar minimum`, startedAt: ago(2.6), focus: 'asset:SN-24',
      summary: 'Neighbouring logger is also low, which supports a single event in the Kingsway area rather than a sensor fault.' }),
    inc({ id: 'INC-2312', type: 'Sensor offline', severity: 'info', status: 'active', title: 'Logger SN-07 not reporting — East Meadows',
      zone: 'KREKAJ', location: 'Logger SN-07', metric: 'pressure', entityId: 'SN-07', base: P('SN-07').base,
      trigger: 'No data for 3 h 10 min', startedAt: ago(3.17), focus: 'asset:SN-07',
      summary: 'Last message received with 41 % battery and good signal. Likely a modem or power issue on site.' }),
    inc({ id: 'INC-2313', type: 'Water quality breach', severity: 'warning', status: 'acknowledged', title: 'Chlorine residual below range — Millbrook East',
      zone: 'ME', location: wqMe.name, metric: 'chlorine', entityId: 'WQ-ME', base: wqMe.base.chlorine,
      trigger: `${wqMe.values.chlorine.toFixed(2)} mg/L, minimum 0.2 mg/L`, startedAt: ago(20), focus: 'asset:PH-ME',
      summary: 'Residual has been decaying at the end of the zone. Booster dosing check scheduled.' }),
    inc({ id: 'INC-2311', type: 'Abnormal reading', severity: 'warning', status: 'acknowledged', title: 'Erratic level signal — Reservoir 04',
      zone: T('TANK-04').zone, location: 'Level sensor LV-04', metric: 'level', entityId: 'TANK-04', base: T('TANK-04').base,
      trigger: 'Signal −104 dBm, 3 missed readings in the last hour', startedAt: ago(9), focus: 'asset:TANK-04',
      summary: 'Readings are plausible but intermittent. Antenna inspection requested.' }),
    inc({ id: 'INC-2309', type: 'Pressure anomaly', severity: 'warning', status: 'resolved', title: 'Pressure anomaly — Downtown Central',
      zone: 'CBD', location: 'Logger SN-01', metric: 'pressure', entityId: 'SN-01', base: P('SN-01').base,
      trigger: '1.18 bar at lowest', startedAt: ago(30), resolvedAt: ago(26), focus: 'asset:SN-01', summary: 'Valve operation during planned works. Pressure restored.' }),
    inc({ id: 'INC-2304', type: 'Water quality breach', severity: 'warning', status: 'resolved', title: 'pH above range — East Meadows',
      zone: 'KREKAJ', location: Q('WQ-KREKAJ').name, metric: 'ph', entityId: 'WQ-KREKAJ', base: Q('WQ-KREKAJ').base.ph,
      trigger: 'pH 8.6 at peak', startedAt: ago(4 * 24), resolvedAt: ago(4 * 24 - 6), focus: 'asset:PH-KREKAJ', summary: 'Dosing correction at the works.' }),
    inc({ id: 'INC-2301', type: 'Pressure anomaly', severity: 'warning', status: 'resolved', title: 'Pressure anomaly — Riverside',
      zone: 'MIL', location: 'Logger SN-10', metric: 'pressure', entityId: 'SN-10', base: P('SN-10').base,
      trigger: '1.26 bar at lowest', startedAt: ago(6 * 24), resolvedAt: ago(6 * 24 - 4), focus: 'asset:SN-10', summary: 'Burst on a 110 mm distribution main, repaired.' }),
    inc({ id: 'INC-2297', type: 'Water quality breach', severity: 'critical', status: 'resolved', title: 'Turbidity critical — Westhaven',
      zone: 'OBA', location: Q('WQ-OBA').name, metric: 'turbidity', entityId: 'WQ-OBA', base: Q('WQ-OBA').base.turbidity,
      trigger: '6.2 NTU at peak, limit 5.0 NTU', startedAt: ago(9 * 24), resolvedAt: ago(9 * 24 - 14), focus: 'asset:TB-OBA', summary: 'Mains repair disturbed sediment. Zone flushed.' }),
    inc({ id: 'INC-2294', type: 'Pressure anomaly', severity: 'critical', status: 'resolved', title: 'Pressure anomaly — Northgate',
      zone: 'MYT', location: 'Logger SN-12', metric: 'pressure', entityId: 'SN-12', base: sn12.base,
      trigger: '1.62 bar drop', startedAt: ago(9 * 24), resolvedAt: ago(9 * 24 - 5), focus: 'asset:SN-12', summary: 'Joint failure, repaired by Crew A.' }),
    inc({ id: 'INC-2290', type: 'Possible leak', severity: 'warning', status: 'resolved', title: 'Possible leak — Riverside',
      zone: 'MIL', location: 'Logger SN-19', metric: 'pressure', entityId: 'SN-19', base: P('SN-19').base,
      trigger: '1.4 bar drop with night-flow increase', startedAt: ago(13 * 24), resolvedAt: ago(13 * 24 - 3), focus: 'asset:SN-19', summary: 'Service-line leak found and fixed.' }),
    inc({ id: 'INC-2286', type: 'Water quality breach', severity: 'warning', status: 'resolved', title: 'Chlorine residual below range — Downtown Central',
      zone: 'CBD', location: Q('WQ-CBD').name, metric: 'chlorine', entityId: 'WQ-CBD', base: Q('WQ-CBD').base.chlorine,
      trigger: '0.17 mg/L at lowest', startedAt: ago(15 * 24), resolvedAt: ago(15 * 24 - 20), focus: 'asset:PH-CBD', summary: 'Booster chlorinator restarted.' }),
    inc({ id: 'INC-2280', type: 'Pressure anomaly', severity: 'warning', status: 'resolved', title: 'Pressure anomaly — Riverside',
      zone: 'MIL', location: 'Logger SN-10', metric: 'pressure', entityId: 'SN-10', base: P('SN-10').base,
      trigger: '1.21 bar at lowest', startedAt: ago(17 * 24), resolvedAt: ago(17 * 24 - 6), focus: 'asset:SN-10', summary: 'Recurring at the same logger — candidate for step-testing.' }),
    inc({ id: 'INC-2275', type: 'Low tank level', severity: 'warning', status: 'resolved', title: 'Reservoir 06 low level',
      zone: T('TANK-06').zone, location: 'Reservoir 06', metric: 'level', entityId: 'TANK-06', base: T('TANK-06').base,
      trigger: '27 % at lowest', startedAt: ago(20 * 24), resolvedAt: ago(20 * 24 - 10), focus: 'asset:TANK-06', summary: 'Pump station trip, restarted.' }),
    inc({ id: 'INC-2271', type: 'Water quality breach', severity: 'warning', status: 'resolved', title: 'Turbidity above threshold — Riverside',
      zone: 'MIL', location: wqMil.name, metric: 'turbidity', entityId: 'WQ-MIL', base: wqMil.base.turbidity,
      trigger: '2.4 NTU at peak', startedAt: ago(22 * 24), resolvedAt: ago(22 * 24 - 10), focus: 'asset:TB-MIL', summary: 'Heavy rain at intake. Cleared after filter backwash.' }),
    inc({ id: 'INC-2266', type: 'Pressure anomaly', severity: 'warning', status: 'resolved', title: 'Pressure anomaly — Northgate',
      zone: 'MYT', location: 'Logger SN-04', metric: 'pressure', entityId: 'SN-04', base: P('SN-04').base,
      trigger: '1.6 bar at lowest', startedAt: ago(26 * 24), resolvedAt: ago(26 * 24 - 8), focus: 'asset:SN-04', summary: 'PRV fault, recalibrated.' })
  ];

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
  const raw = await fetch(`${base.replace(/\/$/, '')}/data/riverton-assets.geojson`).then(r => r.json());
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

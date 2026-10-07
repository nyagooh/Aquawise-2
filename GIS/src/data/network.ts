/**
 * Network data loader — fetches the real Riverton shapefile (converted to
 * GeoJSON by scripts/shapefile_to_geojson.py) and exposes typed accessors.
 *
 * Files served as static assets from /public/data/:
 *   - riverton-pipes.geojson    (3,233 polylines, classified with ui_class)
 *   - riverton-assets.geojson   (synthesized point telemetry overlay)
 *   - riverton-meta.json        (rich aggregates: km by class/zone/material,
 *                              status counts, age/diameter distribution, bbox)
 */
import { current, currentQualityForZone, toneFor, QUALITY_POINTS, type Tone } from '../demo/series';

export type PipeClass = 'main' | 'distribution' | 'household' | 'backfeed' | 'boundary';
export type PipeStatus = 'open' | 'closed' | 'unknown';
export type ServiceState = 'in-service' | 'out-of-service' | 'pending' | 'unknown';

export interface PipeProps {
  id: string;
  class: 'transmission' | 'distribution' | 'service' | 'boundary';
  ui_class: PipeClass;
  network_raw: string | null;
  material: string | null;
  diameter_mm: number | null;
  length_m: number | null;
  status: PipeStatus;
  service: ServiceState;
  zone: string | null;
  installed: number | null;
  node_from: string | null;
  node_to: string | null;
  remarks: string | null;
  layer: string | null;
}

export interface PipeFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: PipeProps;
}

export type AssetKind = 'tank' | 'pressure_valve' | 'meter_valve' | 'sensor';
export type AssetStatus = 'ok' | 'warn' | 'alert';

export interface TankProps {
  asset: 'tank';
  id: string;
  name: string;
  capacity_m3: number;
  level_pct: number;
  inflow_lps: number;
  outflow_lps: number;
  status: AssetStatus;
  junction_degree: number;
}

export interface PressureValveProps {
  asset: 'pressure_valve';
  id: string;
  name: string;
  set_bar: number;
  live_bar: number;
  min_bar: number;
  max_bar: number;
  status: AssetStatus;
}

export interface MeterValveProps {
  asset: 'meter_valve';
  id: string;
  name: string;
  size_mm: number;
  state: 'open' | 'throttled';
  consumption_m3d: number;
  status: AssetStatus;
}

export type SensorSubtype = 'flow_pressure' | 'ph' | 'turbidity';

export interface SensorProps {
  asset: 'sensor';
  id: string;
  name: string;
  type: string;
  subtype?: SensorSubtype;
  flow_lps: number;
  pressure_bar: number;
  /** Quality reading — populated for pH and turbidity sensors. */
  ph?: number;
  turbidity_ntu?: number;
  last_seen: string;
  status: AssetStatus;
  pipe_id: string;
}

export type AssetProps = TankProps | PressureValveProps | MeterValveProps | SensorProps;

export interface AssetFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: AssetProps;
}

export interface NetworkMeta {
  source: string;
  /** Set by the EPANET .inp parser. Absent for GIS uploads / the bundled demo. */
  model_kind?: 'epanet';
  /** 'schematic' when .inp coordinates don't project to lon/lat. */
  projection?: 'geographic' | 'schematic';
  node_count?: number;
  feature_count: number;
  asset_count: number;
  asset_counts: Partial<Record<AssetKind, number>>;
  by_class: Partial<Record<PipeClass, number>>;
  length_km_by_class: Partial<Record<PipeClass, number>>;
  length_km_by_zone: Record<string, number>;
  length_km_by_material: Record<string, number>;
  top_zones: Array<[string, number]>;
  zones_normalized: Array<[string, number]>;
  materials: Array<[string, number]>;
  common_diameters_mm: Array<[number, number]>;
  diameter_distribution: Record<string, number>;
  age_distribution: Record<string, number>;
  status_counts: Record<PipeStatus, number>;
  service_counts: Record<ServiceState, number>;
  total_length_m: number;
  total_length_km: number;
  bbox: [number, number, number, number];
  center: [number, number];
}

export interface NetworkData {
  pipes: PipeFeature[];
  assets: AssetFeature[];
  meta: NetworkMeta;
}

let cache: Promise<NetworkData> | null = null;

/** Drop the memoised network so the next loadNetwork() refetches from source. */
export function clearNetworkCache(): void {
  cache = null;
}

/**
 * Auth headers for the optional Django backend (network upload / chooser pages).
 * The bundled Riverton demo is fully static and never calls this — it only runs
 * when a user drives the backend-backed upload flow against a live API.
 */
let accessToken: string | null = null;
export async function getAuthHeaders(): Promise<HeadersInit> {
  if (!accessToken) {
    const res = await fetch('/api/v1/auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    if (!res.ok) throw new Error('Failed to authenticate with backend.');
    const data = await res.json();
    accessToken = data.access;
  }
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

export function loadNetwork(): Promise<NetworkData> {
  if (cache) return cache;
  cache = (async () => {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    const url = (path: string) => `${base.replace(/\/$/, '')}/data/${path}`;
    const [pipesRes, assetsRes, metaRes] = await Promise.all([
      fetch(url('riverton-pipes.geojson')),
      fetch(url('riverton-assets.geojson')),
      fetch(url('riverton-meta.json'))
    ]);
    if (!pipesRes.ok || !assetsRes.ok || !metaRes.ok) {
      throw new Error('Failed to load Riverton network dataset.');
    }
    const pipesFc = await pipesRes.json();
    const assetsFc = await assetsRes.json();
    const rawMeta: NetworkMeta = await metaRes.json();

    const pipes = pipesFc.features as PipeFeature[];
    const assets = applyLiveReadings(assetsFc.features as AssetFeature[]);
    const synthetic = synthesizeQualitySensors(pipes);
    // Reflect synthetic sensors in the meta counts so KPIs match the rendered list.
    const meta: NetworkMeta = synthetic.length
      ? {
          ...rawMeta,
          asset_count: rawMeta.asset_count + synthetic.length,
          asset_counts: {
            ...rawMeta.asset_counts,
            sensor: (rawMeta.asset_counts.sensor || 0) + synthetic.length
          }
        }
      : rawMeta;

    return { pipes, assets: [...assets, ...synthetic], meta };
  })();
  return cache;
}

/** Session key holding a user-uploaded network parsed by the backend. */
const UPLOAD_KEY = 'aw:uploaded-network';

/**
 * Persist a backend parse response (pipes/assets FeatureCollections + meta) so
 * the map can render it after navigation. Stored in sessionStorage — cleared
 * when the tab closes, matching the demo's "your data stays yours" promise.
 */
export function storeUploadedNetwork(raw: {
  pipes: { features: unknown[] };
  assets: { features: unknown[] };
  meta: unknown;
}): void {
  sessionStorage.setItem(UPLOAD_KEY, JSON.stringify(raw));
}

export function hasUploadedNetwork(): boolean {
  return sessionStorage.getItem(UPLOAD_KEY) != null;
}

export function clearUploadedNetwork(): void {
  sessionStorage.removeItem(UPLOAD_KEY);
}

/**
 * Build NetworkData from a stored upload, mirroring loadNetwork's shaping
 * (feature extraction + synthesized quality sensors reflected in meta).
 * Returns null when no upload is staged.
 */
export function loadUploadedNetwork(): NetworkData | null {
  const stored = sessionStorage.getItem(UPLOAD_KEY);
  if (!stored) return null;
  const raw = JSON.parse(stored) as {
    pipes: { features: PipeFeature[] };
    assets: { features: AssetFeature[] };
    meta: NetworkMeta;
  };
  const pipes = raw.pipes.features;
  const assets = raw.assets.features;
  const synthetic = synthesizeQualitySensors(pipes);
  const meta: NetworkMeta = synthetic.length
    ? {
        ...raw.meta,
        asset_count: raw.meta.asset_count + synthetic.length,
        asset_counts: {
          ...raw.meta.asset_counts,
          sensor: (raw.meta.asset_counts.sensor || 0) + synthetic.length
        }
      }
    : raw.meta;
  return { pipes, assets: [...assets, ...synthetic], meta };
}

/**
 * Real Riverton telemetry covers flow + pressure only. Water utilities also
 * monitor water-quality sensors (pH, turbidity) at reservoirs and key
 * distribution points — we synthesize a representative set here so the
 * Sensors page can demo them alongside the real flow/pressure nodes.
 */
function synthesizeQualitySensors(pipes: PipeFeature[]): AssetFeature[] {
  const out: AssetFeature[] = [];
  for (const point of QUALITY_POINTS) {
    const sample = pipes.find((p) => p.properties.zone === point.zone);
    const q = currentQualityForZone(point.zone);
    if (!sample || !q) continue;
    const coords = sample.geometry.coordinates;
    const pt = coords[Math.floor(coords.length / 2)] as [number, number];
    const phId = `PH-${point.zone}`;
    const tbId = `TB-${point.zone}`;
    out.push({
      type: 'Feature',
      id: phId,
      geometry: { type: 'Point', coordinates: [pt[0] + 0.0006, pt[1] + 0.0006] },
      properties: {
        asset: 'sensor', id: phId, name: `pH probe · ${zoneLabel(point.zone)}`,
        type: 'pH', subtype: 'ph', ph: Math.round(q.ph * 10) / 10,
        flow_lps: 0, pressure_bar: 0,
        last_seen: '1m ago', status: toAssetStatus(q.phTone), pipe_id: ''
      }
    });
    out.push({
      type: 'Feature',
      id: tbId,
      geometry: { type: 'Point', coordinates: [pt[0] - 0.0006, pt[1] + 0.0006] },
      properties: {
        asset: 'sensor', id: tbId, name: `Turbidity probe · ${zoneLabel(point.zone)}`,
        type: 'Turbidity', subtype: 'turbidity', turbidity_ntu: Math.round(q.ntu * 100) / 100,
        flow_lps: 0, pressure_bar: 0,
        last_seen: '30s ago', status: toAssetStatus(q.ntuTone), pipe_id: ''
      }
    });
  }
  return out;
}

const toAssetStatus = (t: Tone): AssetStatus => (t === 'crit' ? 'alert' : t === 'warn' ? 'warn' : 'ok');

/**
 * Overwrite the static snapshot values on real telemetry assets with the
 * demo engine's current readings, so the map agrees with Monitoring.
 */
function applyLiveReadings(assets: AssetFeature[]): AssetFeature[] {
  return assets.map((a) => {
    const p = a.properties;
    if (p.asset === 'sensor' && !p.subtype) {
      const bar = current('pressure', p.id, p.pressure_bar);
      const lps = current('flow', p.id, p.flow_lps);
      return { ...a, properties: { ...p, pressure_bar: Math.round(bar * 100) / 100, flow_lps: Math.round(lps * 10) / 10, status: toAssetStatus(toneFor('pressure', bar)) } };
    }
    if (p.asset === 'tank') {
      const lvl = current('level', p.id, p.level_pct);
      return { ...a, properties: { ...p, level_pct: Math.round(lvl), status: toAssetStatus(toneFor('level', lvl)) } };
    }
    return a;
  });
}

/* ============================================================
   Qatium-inspired enterprise palette — strong hierarchy, soft
   support tones, high contrast for trunk vs distribution vs
   household.
   ============================================================ */

export const PIPE_STYLE: Record<PipeClass, {
  color: string;
  hoverColor: string;
  weight: number;
  hoverWeight: number;
  dashArray?: string;
  opacity: number;
  label: string;
  shortLabel: string;
  description: string;
}> = {
  // Functional palette: hue + width encode pipe class, so classes stay
  // distinguishable without relying on colour alone.
  main: {
    color: '#F97316',
    hoverColor: '#FB923C',
    weight: 4,
    hoverWeight: 6,
    opacity: 1,
    label: 'Transmission main',
    shortLabel: 'Mains',
    description: 'Primary supply trunk · highest priority'
  },
  distribution: {
    color: '#18AEEA',
    hoverColor: '#5CC8F2',
    weight: 2.5,
    hoverWeight: 4,
    opacity: 1,
    label: 'Distribution main',
    shortLabel: 'Distribution',
    description: 'Neighbourhood feeder · zone backbone'
  },
  household: {
    color: '#20C997',
    hoverColor: '#5ADBB3',
    weight: 1.5,
    hoverWeight: 3,
    opacity: 0.95,
    label: 'Service connection',
    shortLabel: 'Service',
    description: 'Service line to customer property'
  },
  backfeed: {
    color: '#64748B',
    hoverColor: '#94A3B8',
    weight: 2,
    hoverWeight: 3.5,
    dashArray: '6 5',
    opacity: 1,
    label: 'Backfeed / closed',
    shortLabel: 'Backfeed',
    description: 'Reversible supply path · currently closed'
  },
  boundary: {
    color: '#94A3B8',
    hoverColor: '#CBD5E1',
    weight: 1.5,
    hoverWeight: 3,
    dashArray: '6 4',
    opacity: 0.9,
    label: 'Zone boundary',
    shortLabel: 'DMA boundary',
    description: 'District metered area or service zone outline'
  }
};

export const PIPE_CLASS_ORDER: PipeClass[] = ['main', 'distribution', 'backfeed', 'household', 'boundary'];

export const ASSET_STYLE: Record<AssetKind, {
  color: string;
  ring: string;
  label: string;
  shortLabel: string;
  description: string;
}> = {
  // Each asset kind is a distinct category — give it its own hue so icons
  // read apart from the blue (#00B4FF) pipe network and from each other.
  // Status semantics (green/amber/red) stay on the separate status dot.
  tank: {
    color: '#7C3AED',
    ring: '#DDD6FE',
    label: 'Reservoir / tank',
    shortLabel: 'Reservoirs',
    description: 'Reservoir level-sensor telemetry'
  },
  pressure_valve: {
    color: '#F59E0B',
    ring: '#FDE68A',
    label: 'Valve (PRV)',
    shortLabel: 'Valves',
    description: 'Pressure-reducing valve · live drift'
  },
  meter_valve: {
    color: '#EC4899',
    ring: '#FBCFE8',
    label: 'Meter / pump',
    shortLabel: 'Meters',
    description: 'Consumption-metered valve assembly'
  },
  sensor: {
    color: '#2563EB',
    ring: '#BFDBFE',
    label: 'Sensors',
    shortLabel: 'Sensors',
    description: 'Pressure (blue) and water-quality (violet) sensors'
  }
};

export const ASSET_ORDER: AssetKind[] = ['tank', 'pressure_valve', 'meter_valve', 'sensor'];

export const STATUS_COLOR: Record<AssetStatus, string> = {
  ok: '#10B981',     // healthy / normal
  warn: '#F59E0B',   // warning / anomaly
  alert: '#EF4444'   // critical / leak
};
export const OFFLINE_COLOR = '#94A3B8';
export const QUALITY_SENSOR_COLOR = '#8B5CF6';
export const DMA_BOUNDARY_COLOR = '#8B5CF6';

/**
 * Map glyphs shared by markers and the legend: white badge, coloured ring,
 * engineering symbol inside. Returned as SVG strings for Leaflet divIcons.
 */
export function assetGlyph(kind: 'tank' | 'valve' | 'meter' | 'leak', color: string, size = 18): string {
  const st = `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case 'valve': // gate valve: bowtie body, stem and handwheel
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M3.5 10.5v9l8.5-4.5zM20.5 10.5v9L12 15z" fill="${color}"/><path d="M12 15V7" ${st}/><path d="M7.5 5.5h9" ${st} stroke-width="2.4"/></svg>`;
    case 'meter': // flow meter: dial with needle and pipe stubs
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M1.5 13h3.5M19 13h3.5" ${st}/><circle cx="12" cy="13" r="6.5" ${st}/><path d="M12 13l3.2-3.4" ${st}/><circle cx="12" cy="13" r="1.4" fill="${color}"/><path d="M8.6 9.3h.01M12 7.9h.01" ${st} stroke-width="2.4"/></svg>`;
    case 'tank': // reservoir: cylinder
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><ellipse cx="12" cy="6" rx="7" ry="2.6" ${st}/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" ${st}/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" ${st} opacity="0.55"/></svg>`;
    case 'leak':
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0c0-4 5.5-10 5.5-10z" fill="${color}"/><path d="M9.6 14.2a2.6 2.6 0 0 0 2.4 2.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }
}

export const MATERIAL_TINT: Record<string, string> = {
  PVC: '#0EA5E9',
  uPVC: '#22D3EE',
  HDPE: '#1D4ED8',
  PE: '#1D4ED8',
  GI: '#94A3B8',
  Steel: '#64748B',
  PPR: '#A78BFA',
  AC: '#F97316'
};

/** Zone display names (curated). Falls back to raw key for unknowns. */
export const ZONE_LABELS: Record<string, string> = {
  MIL: 'Riverside',
  MYT: 'Northgate',
  KREKAJ: 'East Meadows',
  CBD: 'Downtown Central',
  ME: 'Millbrook East',
  OBA: 'Westhaven',
  KRE: 'Millwood',
  'RIAT C': 'Hillcrest',
  MTY: 'Northgate (legacy)',
  HDPE: 'Unclassified',
  CDD: 'Unclassified'
};

export function zoneLabel(code: string): string {
  return ZONE_LABELS[code] || code;
}

export function isRealZone(code: string): boolean {
  // Filter out polluted zone codes (material names accidentally entered as zone, etc.)
  if (!code) return false;
  if (code === 'HDPE' || code === 'CDD' || code === 'MTY') return false;
  return code.length <= 8;
}

/** Network health derived from real status counts. */
export function deriveHealthScore(meta: NetworkMeta): number {
  const open = meta.status_counts.open || 0;
  const total = (meta.status_counts.open || 0) + (meta.status_counts.closed || 0) + (meta.status_counts.unknown || 0);
  if (total === 0) return 100;
  return Math.round((open / total) * 100);
}

/** Estimate NRW (non-revenue water) from network composition and age. */
export function deriveNRW(meta: NetworkMeta): number {
  const pre2000 = meta.age_distribution['pre-2000'] || 0;
  const e2000 = meta.age_distribution['2000-2009'] || 0;
  const e2010 = meta.age_distribution['2010-2019'] || 0;
  const post = meta.age_distribution['2020+'] || 0;
  const unknown = meta.age_distribution.unknown || 0;
  const total = pre2000 + e2000 + e2010 + post + unknown || 1;
  // weighted age-based estimate (older pipe → more loss)
  const score =
    (pre2000 * 0.32 + e2000 * 0.22 + e2010 * 0.13 + post * 0.08 + unknown * 0.18) / total;
  return Math.round(score * 1000) / 10; // %
}

export function lengthByClass(meta: NetworkMeta, cls: PipeClass): number {
  return meta.length_km_by_class[cls] || 0;
}

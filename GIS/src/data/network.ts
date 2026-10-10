/**
 * Network data loader — fetches the Erline Water asset shapefiles (converted
 * to GeoJSON by scripts/erline_to_geojson.py) and exposes typed accessors.
 *
 * Files served as static assets from /public/data/:
 *   - erline-pipes.geojson      (raw water, transmission + distribution lines and
 *                              the service-area outline, classified with ui_class)
 *   - erline-assets.geojson     (surveyed intakes, treatment plants, reservoirs +
 *                              synthesized telemetry overlay)
 *   - erline-meta.json          (aggregates: km by class/zone/material, age, bbox)
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

export type AssetKind = 'facility' | 'tank' | 'pressure_valve' | 'meter_valve' | 'sensor';
export type AssetStatus = 'ok' | 'warn' | 'alert';

export type FacilityType = 'intake' | 'wtp' | 'wwtp';

export interface FacilityProps {
  asset: 'facility';
  id: string;
  name: string;
  facility_type: FacilityType;
  capacity_m3d: number;
  throughput_m3d: number;
  status: AssetStatus;
}

export const FACILITY_LABEL: Record<FacilityType, string> = {
  intake: 'Dam & intake',
  wtp: 'Water treatment plant',
  wwtp: 'Wastewater treatment plant'
};

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

export type AssetProps = FacilityProps | TankProps | PressureValveProps | MeterValveProps | SensorProps;

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
 * The bundled Erline dataset is fully static and never calls this — it only runs
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
      fetch(url('erline-pipes.geojson')),
      fetch(url('erline-assets.geojson')),
      fetch(url('erline-meta.json'))
    ]);
    if (!pipesRes.ok || !assetsRes.ok || !metaRes.ok) {
      throw new Error('Failed to load Erline network dataset.');
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
 * The bundled telemetry overlay covers flow + pressure only. Water utilities also
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
    color: '#FB923C',          // bright orange — reads on satellite imagery
    hoverColor: '#FDBA74',
    weight: 6,
    hoverWeight: 6,
    opacity: 1,
    label: 'Transmission main',
    shortLabel: 'Mains',
    description: 'Primary supply trunk · highest priority'
  },
  distribution: {
    color: '#F0ABFC',          // light fuchsia — bright against green/brown satellite imagery
    hoverColor: '#FAE8FF',
    weight: 3.5,
    hoverWeight: 4,
    opacity: 1,
    label: 'Distribution main',
    shortLabel: 'Distribution',
    description: 'Neighbourhood feeder · zone backbone'
  },
  household: {
    color: '#65A30D',
    hoverColor: '#84CC16',
    weight: 2.2,
    hoverWeight: 3,
    opacity: 0.95,
    label: 'Service connection',
    shortLabel: 'Service',
    description: 'Service line to customer property'
  },
  backfeed: {
    color: '#334155',
    hoverColor: '#475569',
    weight: 3,
    hoverWeight: 3.5,
    dashArray: '6 5',
    opacity: 1,
    label: 'Backfeed / closed',
    shortLabel: 'Backfeed',
    description: 'Reversible supply path · currently closed'
  },
  boundary: {
    color: '#F8FAFC',          // white dashed outline — visible on imagery
    hoverColor: '#FFFFFF',
    weight: 2,
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
  // read apart from the orange / purple pipe network and from each other.
  // Status semantics (green/amber/red) stay on the separate status dot.
  facility: {
    color: '#14B8A6',          // bold teal — intake / treatment works
    ring: '#99F6E4',
    label: 'Intake / treatment plant',
    shortLabel: 'Facilities',
    description: 'Dam intakes, water & wastewater treatment works'
  },
  tank: {
    color: '#0284C7',          // sky blue — water storage, clear of the purple pipes
    ring: '#DDD6FE',
    label: 'Reservoir / tank',
    shortLabel: 'Reservoirs',
    description: 'Reservoir level-sensor telemetry'
  },
  pressure_valve: {
    color: '#B45309',
    ring: '#FDE68A',
    label: 'Valve (PRV)',
    shortLabel: 'Valves',
    description: 'Pressure-reducing valve · live drift'
  },
  meter_valve: {
    color: '#BE185D',
    ring: '#FBCFE8',
    label: 'Meter / pump',
    shortLabel: 'Meters',
    description: 'Consumption-metered valve assembly'
  },
  sensor: {
    color: '#1D4ED8',
    ring: '#BFDBFE',
    label: 'Sensors',
    shortLabel: 'Sensors',
    description: 'Pressure (blue) and water-quality (teal) sensors'
  }
};

export const ASSET_ORDER: AssetKind[] = ['facility', 'tank', 'pressure_valve', 'meter_valve', 'sensor'];

export const STATUS_COLOR: Record<AssetStatus, string> = {
  ok: '#10B981',     // healthy / normal
  warn: '#F59E0B',   // warning / anomaly
  alert: '#EF4444'   // critical
};
export const OFFLINE_COLOR = '#94A3B8';
export const QUALITY_SENSOR_COLOR = '#0E7490';
export const DMA_BOUNDARY_COLOR = '#8B5CF6';

/**
 * Flat engineering map symbols shared by markers and the legend:
 * valve = bowtie, meter = circle, reservoir = square, pressure sensor = dot,
 * water-quality sensor = diamond. Thin dark outline so they
 * read on dark and satellite basemaps alike.
 */
export type SymbolKind = 'valve' | 'meter' | 'tank' | 'pressure' | 'quality';
export function engSymbol(kind: SymbolKind, color: string, size = 14, outline = '#0B1220'): string {
  const o = `stroke="${outline}" stroke-width="1.25" stroke-linejoin="round"`;
  const v = `viewBox="0 0 16 16" width="${size}" height="${size}"`;
  switch (kind) {
    case 'valve':    return `<svg ${v}><path d="M1.5 3.5v9L8 8zM14.5 3.5v9L8 8z" fill="${color}" ${o}/></svg>`;
    case 'meter':    return `<svg ${v}><circle cx="8" cy="8" r="5.5" fill="${color}" ${o}/><circle cx="8" cy="8" r="1.6" fill="${outline}"/></svg>`;
    case 'tank':     return `<svg ${v}><rect x="2" y="2" width="12" height="12" rx="1.5" fill="${color}" ${o}/></svg>`;
    case 'pressure': return `<svg ${v}><circle cx="8" cy="8" r="4.5" fill="${color}" ${o}/></svg>`;
    case 'quality':  return `<svg ${v}><path d="M8 2.5 13.5 8 8 13.5 2.5 8z" fill="${color}" ${o}/></svg>`;
  }
}

/**
 * Map markers that show what the asset is: a coloured rounded tile with a
 * white line icon (reservoir, pressure sensor, water-quality probe, valve,
 * meter). Status shows as a ring around the tile.
 */
export type MarkerKind = 'plant' | 'tank' | 'pressure' | 'quality' | 'valve' | 'meter';
const MARKER_PATHS: Record<MarkerKind, string> = {
  plant: '<path d="M3.5 20.5V9.5l5 3v-3l5 3V4.5h7v16z"/><path d="M16.5 12s-2 2.2-2 3.6a2 2 0 0 0 4 0c0-1.4-2-3.6-2-3.6z" fill="#fff"/>',
  tank: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  pressure: '<path d="M4.5 16.5a8 8 0 1 1 15 0"/><path d="m12 13 4-4.5"/><circle cx="12" cy="13" r="1.2" fill="#fff"/>',
  quality: '<path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0c0-4 5.5-10 5.5-10z"/><path d="M9.8 14.5a2.3 2.3 0 0 0 2.2 2.2"/>',
  valve: '<path d="M3.5 10v8l8.5-4zM20.5 10v8L12 14z"/><path d="M12 14V7.5M8.5 5.5h7"/>',
  meter: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M7 10.5h2.5M10.8 10.5h2.4M14.5 10.5H17M7 14h10"/>'
};
export function markerIcon(kind: MarkerKind, color: string, size = 22): string {
  // Line icon in the asset colour over a white halo: reads on any basemap,
  // no tiles or badges.
  const paths = MARKER_PATHS[kind].replace(/fill="#fff"/g, `fill="${color}"`);
  return `<span class="mk mk-${kind}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke-linecap="round" stroke-linejoin="round">`
    + `<g stroke="#fff" stroke-width="5.5">${MARKER_PATHS[kind]}</g>`
    + `<g stroke="${color}" stroke-width="2.2">${paths}</g></svg></span>`;
}

/** @deprecated kept for older imports; maps to the engineering symbols. */
export function assetGlyph(kind: 'tank' | 'valve' | 'meter', color: string, size = 18): string {
  return engSymbol(kind, color, size);
}

export const MATERIAL_TINT: Record<string, string> = {
  PVC: '#0EA5E9',
  uPVC: '#22D3EE',
  HDPE: '#1D4ED8',
  PE: '#1D4ED8',
  GI: '#94A3B8',
  Steel: '#64748B',
  PPR: '#A78BFA',
  DI: '#475569',
  AC: '#F97316'
};

/** Zone display names — Erline distribution zones are named after the
 *  reservoir that feeds them. Falls back to the raw key for unknowns. */
export const ZONE_LABELS: Record<string, string> = {
  SHAURI: 'Shauri',
  ZIWANI1: 'Ziwani 1',
  ZIWANI2: 'Ziwani 2',
  ZIWANI3: 'Ziwani 3',
  KWANJORA: 'Kwa Njora',
  ZIWANI: 'Ziwani (shared)'
};

export function zoneLabel(code: string): string {
  return ZONE_LABELS[code] || code;
}

export function isRealZone(code: string): boolean {
  return !!code && code.trim().length > 0;
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

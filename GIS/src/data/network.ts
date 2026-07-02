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
    const assets = assetsFc.features as AssetFeature[];
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
  const zones = Array.from(new Set(
    pipes.map((p) => p.properties.zone).filter((z): z is string => !!z && isRealZone(z))
  )).slice(0, 5);

  // Pick a representative coordinate per zone from any pipe segment in that zone.
  const zonePoint: Record<string, [number, number]> = {};
  for (const z of zones) {
    const sample = pipes.find((p) => p.properties.zone === z);
    if (sample) {
      const coords = sample.geometry.coordinates;
      zonePoint[z] = coords[Math.floor(coords.length / 2)] as [number, number];
    }
  }

  const phReadings: Array<{ ph: number; status: AssetStatus }> = [
    { ph: 7.2, status: 'ok' },
    { ph: 6.9, status: 'ok' },
    { ph: 7.6, status: 'warn' },
    { ph: 6.4, status: 'alert' },
    { ph: 7.1, status: 'ok' }
  ];
  const turbidityReadings: Array<{ ntu: number; status: AssetStatus }> = [
    { ntu: 0.8, status: 'ok' },
    { ntu: 1.2, status: 'ok' },
    { ntu: 4.6, status: 'warn' },
    { ntu: 6.1, status: 'alert' },
    { ntu: 0.6, status: 'ok' }
  ];

  const out: AssetFeature[] = [];
  zones.forEach((z, i) => {
    const pt = zonePoint[z];
    if (!pt) return;
    const phr = phReadings[i % phReadings.length];
    const tbr = turbidityReadings[i % turbidityReadings.length];
    const phId = `PH-${String(i + 1).padStart(2, '0')}`;
    const tbId = `TB-${String(i + 1).padStart(2, '0')}`;
    out.push({
      type: 'Feature',
      id: phId,
      geometry: { type: 'Point', coordinates: [pt[0] + 0.0006, pt[1] + 0.0006] },
      properties: {
        asset: 'sensor', id: phId, name: `pH probe · ${zoneLabel(z)}`,
        type: 'pH', subtype: 'ph', ph: phr.ph,
        flow_lps: 0, pressure_bar: 0,
        last_seen: '1m ago', status: phr.status, pipe_id: ''
      }
    });
    out.push({
      type: 'Feature',
      id: tbId,
      geometry: { type: 'Point', coordinates: [pt[0] - 0.0006, pt[1] + 0.0006] },
      properties: {
        asset: 'sensor', id: tbId, name: `Turbidity probe · ${zoneLabel(z)}`,
        type: 'Turbidity', subtype: 'turbidity', turbidity_ntu: tbr.ntu,
        flow_lps: 0, pressure_bar: 0,
        last_seen: '30s ago', status: tbr.status, pipe_id: ''
      }
    });
  });
  return out;
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
  // Distinct categorical data palette (Tableau-style), full opacity, tuned to
  // read over label-free satellite imagery: blue trunk, cyan distribution,
  // light service, amber closed, pink DMA.
  // Bold, high-visibility engineering palette tuned for dark satellite imagery
  // — water-utility GIS convention: red trunk mains, blue distribution, light
  // service, gold closed/isolated, magenta DMA boundary. Heavy weights + full
  // opacity + white casing (see baseLineStyle) keep every class legible.
  main: {
    color: '#1FA2FF',          // shiny blue — transmission trunk
    hoverColor: '#7CC8FF',
    weight: 5.5,
    hoverWeight: 7.5,
    opacity: 1,
    label: 'Transmission main',
    shortLabel: 'Mains',
    description: 'Primary supply trunk · highest priority'
  },
  distribution: {
    color: '#1FA2FF',          // shiny blue — distribution backbone
    hoverColor: '#7CC8FF',
    weight: 3,
    hoverWeight: 5,
    opacity: 1,
    label: 'Distribution main',
    shortLabel: 'Distribution',
    description: 'Neighbourhood feeder · zone backbone'
  },
  household: {
    color: '#1FA2FF',          // shiny blue — service lines
    hoverColor: '#7CC8FF',
    weight: 1.8,
    hoverWeight: 3.2,
    opacity: 0.95,
    label: 'Service connection',
    shortLabel: 'Service',
    description: 'Service line to customer property'
  },
  backfeed: {
    color: '#1FA2FF',          // shiny blue — closed / isolated (dashed)
    hoverColor: '#7CC8FF',
    weight: 3,
    hoverWeight: 5,
    dashArray: '8 5',
    opacity: 1,
    label: 'Backfeed / closed',
    shortLabel: 'Backfeed',
    description: 'Reversible supply path · currently closed'
  },
  boundary: {
    color: '#1FA2FF',          // shiny blue — DMA outline (dashed)
    hoverColor: '#7CC8FF',
    weight: 3,
    hoverWeight: 4.5,
    dashArray: '6 4',
    opacity: 0.95,
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
  // read apart from the blue (#1FA2FF) pipe network and from each other.
  // Status semantics (green/amber/red) stay on the separate status dot.
  tank: {
    color: '#8B5CF6',          // violet — reservoir / tank node
    ring: '#DDD6FE',
    label: 'Reservoir / tank',
    shortLabel: 'Reservoirs',
    description: 'Reservoir level-sensor telemetry'
  },
  pressure_valve: {
    color: '#14B8A6',          // teal — pressure valve
    ring: '#99F6E4',
    label: 'Valve (PRV)',
    shortLabel: 'Valves',
    description: 'Pressure-reducing valve · live drift'
  },
  meter_valve: {
    color: '#EC4899',          // magenta — bulk meter / pump
    ring: '#FBCFE8',
    label: 'Meter / pump',
    shortLabel: 'Meters',
    description: 'Consumption-metered valve assembly'
  },
  sensor: {
    color: '#F97316',          // orange — sensor node (telemetry)
    ring: '#FED7AA',
    label: 'Flow + pressure sensor',
    shortLabel: 'Sensors',
    description: 'Live flow & pressure telemetry node'
  }
};

export const ASSET_ORDER: AssetKind[] = ['tank', 'pressure_valve', 'meter_valve', 'sensor'];

export const STATUS_COLOR: Record<AssetStatus, string> = {
  ok: '#4FA877',     // muted green — healthy
  warn: '#D9A156',   // amber — watch
  alert: '#D4675E'   // coral — critical
};

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

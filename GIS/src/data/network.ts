/**
 * Network data loader — fetches the real Kisumu shapefile (converted to
 * GeoJSON by scripts/shapefile_to_geojson.py) and exposes typed accessors.
 *
 * Files served as static assets from /public/data/:
 *   - kisumu-pipes.geojson    (3,233 polylines, classified with ui_class)
 *   - kisumu-assets.geojson   (synthesized point telemetry overlay)
 *   - kisumu-meta.json        (rich aggregates: km by class/zone/material,
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
  geometry: { type: 'LineString' | 'MultiLineString'; coordinates: any };
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
  id?: string;
  name?: string;
  source: string;
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

export interface JunctionFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    external_id: string;
    node_type: string;
    elevation_m?: number;
    demand_lps?: number;
  };
}

export interface NetworkData {
  pipes: PipeFeature[];
  assets: AssetFeature[];
  junctions?: JunctionFeature[];
  meta: NetworkMeta;
}

let cache: Promise<NetworkData> | null = null;
let accessToken: string | null = null;

export async function getAuthHeaders(): Promise<HeadersInit> {
  if (!accessToken) {
    const res = await fetch('/api/v1/auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    if (!res.ok) {
      throw new Error('Failed to authenticate with backend.');
    }
    const data = await res.json();
    accessToken = data.access;
  }
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

export function clearNetworkCache() {
  cache = null;
}

async function loadFromBackend(): Promise<NetworkData> {
  const headers = await getAuthHeaders();
  
  // 1. Fetch active network
  let networkId = localStorage.getItem('activeNetworkId');
  if (!networkId) {
    const netsRes = await fetch('/api/v1/networks/', { headers });
    if (!netsRes.ok) throw new Error('Failed to fetch networks list');
    const networks = await netsRes.json();
    const network = networks[0];
    if (!network) throw new Error('No networks found in backend');
    networkId = network.id;
    localStorage.setItem('activeNetworkId', networkId!);
  }

  // 2. Fetch zones
  const zonesRes = await fetch(`/api/v1/networks/${networkId}/zones/`, { headers });
  if (!zonesRes.ok) throw new Error('Failed to fetch zones');
  const zonesFc = await zonesRes.json();
  const zoneMap = new Map<string, string>();
  zonesFc.features.forEach((feat: any) => {
    if (feat.properties && feat.properties.id) {
      zoneMap.set(feat.properties.id, feat.properties.code || feat.properties.name);
    }
  });

  // 3. Fetch pipes
  const pipesRes = await fetch(`/api/v1/networks/${networkId}/pipes/`, { headers });
  if (!pipesRes.ok) throw new Error('Failed to fetch pipes');
  const pipesFc = await pipesRes.json();
  
  const pipes: PipeFeature[] = pipesFc.features.map((feat: any) => {
    const props = feat.properties;
    let uiClass: PipeClass = 'distribution';
    if (props.status === 'closed') {
      uiClass = 'backfeed';
    } else if (props.diameter_mm && props.diameter_mm >= 150) {
      uiClass = 'main';
    } else if (props.diameter_mm && props.diameter_mm <= 32) {
      uiClass = 'household';
    }

    let mappedStatus: PipeStatus = 'open';
    let mappedService: ServiceState = 'in-service';
    if (props.status === 'closed') {
      mappedStatus = 'closed';
      mappedService = 'pending';
    } else if (props.status === 'out_of_service') {
      mappedStatus = 'unknown';
      mappedService = 'out-of-service';
    } else if (props.status === 'pending') {
      mappedStatus = 'unknown';
      mappedService = 'pending';
    }

    return {
      type: 'Feature',
      id: props.external_id || props.id,
      geometry: feat.geometry,
      properties: {
        id: props.external_id || props.id,
        class: props.diameter_mm && props.diameter_mm >= 150 ? 'transmission' : 'distribution',
        ui_class: uiClass,
        network_raw: props.material || 'PVC',
        material: props.material,
        diameter_mm: props.diameter_mm,
        length_m: props.length_m,
        status: mappedStatus,
        service: mappedService,
        zone: zoneMap.get(props.zone_id) || props.zone_id || null,
        installed: props.installation_year || 2020,
        node_from: null,
        node_to: null,
        remarks: null,
        layer: null
      }
    };
  });

  // 4. Fetch assets
  const assetsRes = await fetch(`/api/v1/networks/${networkId}/assets/`, { headers });
  if (!assetsRes.ok) throw new Error('Failed to fetch assets');
  const assetsFc = await assetsRes.json();
  
  const assets: AssetFeature[] = assetsFc.features.map((feat: any) => {
    const props = feat.properties;
    return {
      type: 'Feature',
      id: props.id,
      geometry: feat.geometry,
      properties: {
        ...props,
        id: props.id,
        status: props.status || 'ok'
      }
    };
  });

  // 4b. Fetch nodes (junctions)
  const nodesRes = await fetch(`/api/v1/networks/${networkId}/nodes/`, { headers });
  if (!nodesRes.ok) throw new Error('Failed to fetch nodes');
  const nodesFc = await nodesRes.json();
  
  const junctions: JunctionFeature[] = nodesFc.features.map((feat: any) => {
    const props = feat.properties;
    return {
      type: 'Feature',
      id: props.external_id || props.id,
      geometry: feat.geometry,
      properties: {
        id: props.external_id || props.id,
        external_id: props.external_id || props.id,
        node_type: props.node_type || 'junction',
        elevation_m: props.elevation_m,
        demand_lps: props.demand_lps
      }
    };
  });

  // 5. Fetch stats
  const statsRes = await fetch(`/api/v1/networks/${networkId}/stats/`, { headers });
  if (!statsRes.ok) throw new Error('Failed to fetch stats');
  const stats = await statsRes.json();

  const assetCounts: Partial<Record<AssetKind, number>> = {};
  assets.forEach((f) => {
    const kind = f.properties.asset as AssetKind;
    assetCounts[kind] = (assetCounts[kind] || 0) + 1;
  });

  const byClass: Partial<Record<PipeClass, number>> = {};
  const lengthKmByClass: Partial<Record<PipeClass, number>> = {};
  pipes.forEach((p) => {
    const cls = p.properties.ui_class;
    byClass[cls] = (byClass[cls] || 0) + 1;
    const lenKm = (p.properties.length_m || 0) / 1000;
    lengthKmByClass[cls] = (lengthKmByClass[cls] || 0) + lenKm;
  });

  const lengthKmByZone: Record<string, number> = {};
  stats.zones_breakdown.forEach((z: any) => {
    lengthKmByZone[z.code || z.name] = z.length_km;
  });

  const lengthKmByMaterial: Record<string, number> = {};
  stats.materials_breakdown.forEach((m: any) => {
    lengthKmByMaterial[m.material] = m.length_km;
  });

  const materials: Array<[string, number]> = stats.materials_breakdown.map((m: any) => [m.material, m.count]);
  const statusCounts: Record<PipeStatus, number> = {
    open: stats.status_breakdown.open || 0,
    closed: stats.status_breakdown.closed || 0,
    unknown: stats.status_breakdown.unknown || 0
  };

  const netRes = await fetch(`/api/v1/networks/${networkId}/`, { headers });
  if (!netRes.ok) throw new Error('Failed to fetch network detail');
  const netDetail = await netRes.json();

  let bbox: [number, number, number, number] = [34.6, -0.15, 34.95, -0.01];
  let center: [number, number] = [34.75, -0.08];
  if (netDetail.bbox && netDetail.bbox.coordinates) {
    const coords = netDetail.bbox.coordinates[0];
    const lons = coords.map((pt: any) => pt[0]);
    const lats = coords.map((pt: any) => pt[1]);
    const minx = Math.min(...lons);
    const miny = Math.min(...lats);
    const maxx = Math.max(...lons);
    const maxy = Math.max(...lats);
    bbox = [minx, miny, maxx, maxy];
    center = [(minx + maxx) / 2, (miny + maxy) / 2];
  }

  // Detect if coordinates are schematic (non-geographic or huge span)
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const isGeographic = minLon >= -180 && maxLon <= 180 && minLat >= -90 && maxLat <= 90;
  const lonSpan = Math.abs(maxLon - minLon);
  const latSpan = Math.abs(maxLat - minLat);
  const schematic = !isGeographic || lonSpan > 2.0 || latSpan > 2.0;

  if (schematic) {
    const cx = (minLon + maxLon) / 2;
    const cy = (minLat + maxLat) / 2;
    const maxRange = Math.max(lonSpan, latSpan) || 1.0;
    const scale = 0.05 / maxRange;

    const normCoord = (pt: [number, number]): [number, number] => [
      (pt[0] - cx) * scale,
      (pt[1] - cy) * scale
    ];

    pipes.forEach((p) => {
      if (p.geometry.type === 'LineString') {
        p.geometry.coordinates = (p.geometry.coordinates as [number, number][]).map(normCoord);
      } else if (p.geometry.type === 'MultiLineString') {
        p.geometry.coordinates = (p.geometry.coordinates as any).map((line: [number, number][]) =>
          line.map(normCoord)
        );
      }
    });

    assets.forEach((a) => {
      a.geometry.coordinates = normCoord(a.geometry.coordinates);
    });

    junctions.forEach((j) => {
      j.geometry.coordinates = normCoord(j.geometry.coordinates);
    });

    bbox = [
      (minLon - cx) * scale,
      (minLat - cy) * scale,
      (maxLon - cx) * scale,
      (maxLat - cy) * scale
    ];
    center = [0.0, 0.0];
  }

  const meta: NetworkMeta = {
    id: networkId || undefined,
    name: netDetail.name,
    source: 'Django PostGIS Backend',
    feature_count: pipes.length,
    asset_count: assets.length,
    asset_counts: assetCounts,
    by_class: byClass,
    length_km_by_class: lengthKmByClass,
    length_km_by_zone: lengthKmByZone,
    length_km_by_material: lengthKmByMaterial,
    top_zones: stats.zones_breakdown.slice(0, 5).map((z: any) => [z.code || z.name, z.length_km] as [string, number]),
    zones_normalized: stats.zones_breakdown.map((z: any) => [z.code || z.name, z.length_km] as [string, number]),
    materials: materials,
    common_diameters_mm: [],
    diameter_distribution: {},
    age_distribution: stats.age_distribution,
    status_counts: statusCounts,
    service_counts: {
      'in-service': statusCounts.open,
      'out-of-service': 0,
      'pending': statusCounts.closed,
      'unknown': statusCounts.unknown
    },
    total_length_m: stats.total_length_km * 1000,
    total_length_km: stats.total_length_km,
    bbox: bbox,
    center: center
  };

  if (pipes.length === 0 && assets.length === 0) {
    throw new Error("EMPTY_NETWORK: A network with 0 pipes and 0 nodes has no lines/markers to render, and its bounding box defaults to null.");
  }

  const synthetic = synthesizeQualitySensors(pipes);
  meta.asset_count += synthetic.length;
  meta.asset_counts.sensor = (meta.asset_counts.sensor || 0) + synthetic.length;

  return { pipes, assets: [...assets, ...synthetic], junctions, meta };
}

export function loadNetwork(): Promise<NetworkData> {
  if (cache) return cache;
  cache = (async () => {
    try {
      console.log("Attempting to load network data from Django REST API...");
      return await loadFromBackend();
    } catch (err: any) {
      if (err.message && err.message.startsWith("EMPTY_NETWORK")) {
        throw new Error(err.message.replace("EMPTY_NETWORK: ", ""));
      }
      console.error("Backend load failed:", err);
      throw new Error(err.message || 'Unable to load network data from backend.');
    }
  })();
  return cache;
}

export interface SimulationData {
  network_id: string;
  timesteps: number[];
  nodes: Record<string, { pressure: number[]; demand: number[] }>;
  links: Record<string, { flow: number[]; velocity: number[]; status: string[] }>;
  patterns: Record<string, number[]>;
  controls: string[];
}

export async function loadSimulation(networkId: string): Promise<SimulationData> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/v1/networks/${networkId}/simulation/`, { headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load simulation results');
  }
  return await res.json();
}

/**
 * Real Kisumu telemetry covers flow + pressure only. Water utilities also
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
      const geom = sample.geometry;
      let coords = geom.coordinates;
      if (geom.type === 'MultiLineString') {
        coords = (geom.coordinates as any)[0];
      }
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
  main: {
    color: '#1E40AF',          // deep cobalt — trunk authority
    hoverColor: '#3B82F6',
    weight: 5,
    hoverWeight: 7,
    opacity: 0.98,
    label: 'Transmission main',
    shortLabel: 'Mains',
    description: 'Primary supply trunk · highest priority'
  },
  distribution: {
    color: '#14B8A6',          // teal — clearly distinct from mains' cobalt
    hoverColor: '#5EEAD4',
    weight: 2.2,
    hoverWeight: 4,
    opacity: 0.88,
    label: 'Distribution main',
    shortLabel: 'Distribution',
    description: 'Neighbourhood feeder · zone backbone'
  },
  household: {
    color: '#64748B',          // mid slate — visible on both light and dark basemaps
    hoverColor: '#0EA5E9',
    weight: 1.6,
    hoverWeight: 3,
    opacity: 0.85,
    label: 'Household connection',
    shortLabel: 'Households',
    description: 'Service line to customer property'
  },
  backfeed: {
    color: '#F97316',          // saturated orange — flags isolation
    hoverColor: '#FB923C',
    weight: 2.8,
    hoverWeight: 4.5,
    dashArray: '8 5',
    opacity: 0.95,
    label: 'Backfeed / closed',
    shortLabel: 'Backfeed',
    description: 'Reversible supply path · currently closed'
  },
  boundary: {
    color: '#A855F7',          // saturated purple — clearly visible on both basemaps
    hoverColor: '#D8B4FE',
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
  tank: {
    color: '#1D4ED8',
    ring: '#BFDBFE',
    label: 'Reservoir · level sensor',
    shortLabel: 'Level sensors',
    description: 'Reservoir level-sensor telemetry'
  },
  pressure_valve: {
    color: '#10B981',
    ring: '#A7F3D0',
    label: 'Pressure valve',
    shortLabel: 'PRVs',
    description: 'Pressure-reducing valve · live drift'
  },
  meter_valve: {
    color: '#F97316',
    ring: '#FED7AA',
    label: 'Meter / bulk valve',
    shortLabel: 'Meters',
    description: 'Consumption-metered valve assembly'
  },
  sensor: {
    color: '#EF4444',
    ring: '#FECACA',
    label: 'Flow + pressure sensor',
    shortLabel: 'Sensors',
    description: 'Live flow & pressure telemetry node'
  }
};

export const ASSET_ORDER: AssetKind[] = ['tank', 'pressure_valve', 'meter_valve', 'sensor'];

export const STATUS_COLOR: Record<AssetStatus, string> = {
  ok: '#22C55E',
  warn: '#F59E0B',
  alert: '#EF4444'
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
  MIL: 'Milimani',
  MYT: 'Mamboleo · Tom Mboya',
  KREKAJ: 'Kibos · Kajulu',
  CBD: 'Central Business District',
  ME: 'Manyatta East',
  OBA: 'Obaria',
  KRE: 'Kibos',
  'RIAT C': 'Riat Centre',
  MTY: 'Mamboleo (legacy)',
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

export async function renameNetwork(networkId: string, newName: string): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/v1/networks/${networkId}/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: newName })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to rename network');
  }
  return await res.json();
}


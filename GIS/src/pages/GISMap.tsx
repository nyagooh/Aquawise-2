/**
 * GISMap — real Riverton water supply network.
 *
 * Renders 4,951 pipe segments from the converted shapefile across five
 * operational layers (mains, distribution, service, backfeed, zone boundary)
 * plus a synthesized telemetry overlay (tanks, pressure valves, meter
 * valves, flow+pressure sensors). Click any asset to see its full operational
 * profile in the side panel.
 */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { Shell } from '../components/Shell';
import { SidePanel, SpRow } from '../components/SidePanel';
import { useTheme } from '../theme';
import {
  loadNetwork,
  loadUploadedNetwork,
  type NetworkData,
  type PipeClass,
  type PipeProps,
  type PipeFeature,
  type AssetFeature,
  type AssetKind,
  PIPE_STYLE,
  PIPE_CLASS_ORDER,
  ASSET_STYLE,
  ASSET_ORDER,
  STATUS_COLOR,
  zoneLabel
} from '../data/network';
import { leaks as leakData, type Leak, type LeakSeverity } from '../data';

const LEAK_SEVERITY_COLOR: Record<LeakSeverity, string> = {
  minor: '#7FAFD2',
  major: '#D9A156',
  critical: '#D4675E'
};
const LEAK_SEVERITY_LABEL: Record<LeakSeverity, string> = {
  minor: 'Minor', major: 'Major', critical: 'Critical'
};
const LEAK_STATUS_LABEL: Record<Leak['status'], string> = {
  reported: 'Reported', dispatched: 'Dispatched', in_progress: 'In progress', fixed: 'Fixed'
};

const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/">OSM</a> · <a href="https://carto.com/">CARTO</a> · water demo data';
// Google tiles — real imagery without a proxy. `lyrs=s` is pure satellite with
// NO labels/roads (clean backdrop for the network); `lyrs=m` is the street map.
const GOOGLE_KEY = (import.meta as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env?.VITE_GOOGLE_MAPS_API_KEY || '';
const TILE_GOOGLE_STREETS = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const TILE_GOOGLE_SATELLITE = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const TILE_GOOGLE_ATTR = 'Imagery &copy; <a href="https://www.google.com/maps">Google</a> · water demo data';

/** Basemap mode — street map, label-free satellite, or bare engineering canvas. */
type Basemap = 'streets' | 'satellite' | 'none';

/** Build the active basemap tile layer for the current mode + theme. */
function makeTileLayer(basemap: Basemap, dark: boolean): L.TileLayer | null {
  if (basemap === 'none') return null;
  if (basemap === 'satellite') {
    return L.tileLayer(TILE_GOOGLE_SATELLITE, { attribution: TILE_GOOGLE_ATTR, subdomains: '0123', maxZoom: 20 });
  }
  // streets
  return L.tileLayer(TILE_GOOGLE_STREETS, { attribution: TILE_GOOGLE_ATTR, subdomains: '0123', maxZoom: 20 });
}

/* ── Workspace toolbar + simulation model ── */
type ToolMode = 'select' | 'pan' | 'measure' | 'search' | 'fit' | 'simulate';
type SimState =
  | 'idle'        // Ready to run — no results yet
  | 'running'
  | 'success'
  | 'warning'
  | 'failed'
  | 'outdated';

const SIM_LABEL: Record<SimState, string> = {
  idle: 'Ready to run',
  running: 'Running…',
  success: 'Simulation successful',
  warning: 'Simulation with warnings',
  failed: 'Simulation failed',
  outdated: 'Simulation outdated'
};

/** Link colour-by options. The hydraulic ones need simulation results. */
const LINK_SYMBOLOGY = [
  { key: 'class', label: 'Asset class', needsSim: false },
  { key: 'diameter', label: 'Diameter', needsSim: false },
  { key: 'status', label: 'Status', needsSim: false },
  { key: 'flow', label: 'Flow', needsSim: true },
  { key: 'velocity', label: 'Velocity', needsSim: true },
  { key: 'headloss', label: 'Unit headloss', needsSim: true }
] as const;
type LinkSymbology = (typeof LINK_SYMBOLOGY)[number]['key'];

const NODE_SYMBOLOGY = [
  { key: 'asset', label: 'Asset kind', needsSim: false },
  { key: 'elevation', label: 'Elevation', needsSim: false },
  { key: 'pressure', label: 'Pressure', needsSim: true },
  { key: 'head', label: 'Head', needsSim: true },
  { key: 'demand', label: 'Demand', needsSim: true }
] as const;
type NodeSymbology = (typeof NODE_SYMBOLOGY)[number]['key'];

type Focus =
  | { kind: 'pipe'; feature: PipeFeature }
  | { kind: 'asset'; feature: AssetFeature }
  | { kind: 'leak'; leak: Leak }
  | null;

type LayerVis = Record<PipeClass | AssetKind, boolean>;

const DEFAULT_LAYERS: LayerVis = {
  main: true,
  distribution: true,
  household: false,        // off by default — turn on at street zoom
  backfeed: true,
  boundary: false,         // reference-only · off by default to declutter
  tank: true,
  pressure_valve: true,
  meter_valve: true,
  sensor: true
};

const PIPE_KEYS: PipeClass[] = PIPE_CLASS_ORDER;
const ASSET_KEYS: AssetKind[] = ASSET_ORDER;

export default function GISMap() {
  const { mode } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerVis>(DEFAULT_LAYERS);
  const [showLeaks, setShowLeaks] = useState(true);
  const [focus, setFocus] = useState<Focus>(null);
  const [basemap, setBasemap] = useState<Basemap>('satellite');
  const [sim, setSim] = useState<SimState>('idle');
  const [linkBy, setLinkBy] = useState<LinkSymbology>('class');
  const [nodeBy, setNodeBy] = useState<NodeSymbology>('asset');
  const hasResults = sim === 'success' || sim === 'warning' || sim === 'outdated';

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const layerGroupsRef = useRef<Partial<Record<PipeClass | AssetKind, L.LayerGroup>>>({});
  const leakGroupRef = useRef<L.LayerGroup | null>(null);
  const focusOutlineRef = useRef<L.Layer | null>(null);
  // Read inside Leaflet event handlers (which close over init-time values).
  const linkByRef = useRef<LinkSymbology>(linkBy);
  const simHasResultsRef = useRef<boolean>(hasResults);
  linkByRef.current = linkBy;
  simHasResultsRef.current = hasResults;

  /* ── 1. fetch network — a user-uploaded network takes priority over the
        bundled Riverton demo dataset ── */
  useEffect(() => {
    let alive = true;
    const uploaded = loadUploadedNetwork();
    if (uploaded) {
      setNetwork(uploaded);
      return () => { alive = false; };
    }
    loadNetwork()
      .then((data) => { if (alive) setNetwork(data); })
      .catch((err) => {
        console.error(err);
        if (alive) setLoadError(err.message || 'Unable to load network data.');
      });
    return () => { alive = false; };
  }, []);

  /* Schematic EPANET models have no geographic coordinates — render them on the
     bare engineering canvas rather than over satellite imagery. */
  useEffect(() => {
    if (network?.meta.projection === 'schematic') setBasemap('none');
  }, [network]);

  /* ── 2. initialise map once we have data ── */
  useEffect(() => {
    if (!mapRef.current || !network || leafletRef.current) return;

    const [lonMin, latMin, lonMax, latMax] = network.meta.bbox;
    const map = L.map(mapRef.current, {
      center: [network.meta.center[1], network.meta.center[0]],
      zoom: 13,
      preferCanvas: true,
      zoomControl: false,
      attributionControl: true,
      maxBounds: L.latLngBounds([latMin - 0.1, lonMin - 0.1], [latMax + 0.1, lonMax + 0.1]),
      minZoom: 10,
      maxZoom: 19
    });
    leafletRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Larger click tolerance — household lines are hairline, so a 6 px buffer
    // makes them clickable without forcing the operator to pixel-hunt.
    rendererRef.current = L.canvas({ padding: 0.4, tolerance: 6 });

    const tile = makeTileLayer(basemap, mode === 'dark');
    if (tile) { tile.addTo(map); tileRef.current = tile; }

    /* layer groups */
    const groups: Partial<Record<PipeClass | AssetKind, L.LayerGroup>> = {};
    [...PIPE_KEYS, ...ASSET_KEYS].forEach((k) => {
      const g = L.layerGroup();
      groups[k] = g;
      if (DEFAULT_LAYERS[k]) g.addTo(map);
    });
    layerGroupsRef.current = groups;

    /* pipes — paint household first (under), then distribution, backfeed,
       boundary, mains last so trunk lines render on top of branches. */
    const renderer = rendererRef.current;
    const sorted = [...network.pipes].sort((a, b) => {
      const order: Record<PipeClass, number> = {
        household: 0, boundary: 1, distribution: 2, backfeed: 3, main: 4
      };
      return order[a.properties.ui_class] - order[b.properties.ui_class];
    });
    sorted.forEach((feat) => {
      const cls = feat.properties.ui_class;
      const group = groups[cls];
      if (!group) return;
      const style = PIPE_STYLE[cls];
      const coords: [number, number][] = feat.geometry.coordinates.map(
        ([lon, lat]) => [lat, lon]
      );
      const line = L.polyline(coords, {
        color: style.color,
        weight: style.weight,
        opacity: style.opacity,
        dashArray: style.dashArray,
        lineCap: 'round',
        lineJoin: 'round',
        renderer
      });
      line.bindPopup(() => pipePopupHtml(feat), {
        className: 'aw-popup aw-popup-pipe',
        closeButton: false,
        offset: [0, -2],
        maxWidth: 280
      });
      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setFocus({ kind: 'pipe', feature: feat });
      });
      line.on('mouseover', () => line.setStyle({
        color: style.hoverColor,
        weight: style.hoverWeight,
        opacity: 1
      }));
      line.on('mouseout', () => line.setStyle(baseLineStyle(feat, linkByRef.current, simHasResultsRef.current)));
      (line as L.Polyline & { _awFeat?: PipeFeature })._awFeat = feat;
      line.addTo(group);
    });

    /* Zoom-aware weight scaling — pipes thicker at city scale, hairline
       when zoomed all the way out. */
    map.on('zoomend', () => {
      const z = map.getZoom();
      const scale = z >= 17 ? 1.35 : z >= 15 ? 1.15 : z >= 13 ? 1 : 0.78;
      Object.entries(groups).forEach(([key, grp]) => {
        if (!grp || !PIPE_KEYS.includes(key as PipeClass)) return;
        const style = PIPE_STYLE[key as PipeClass];
        grp.eachLayer((layer) => {
          (layer as L.Polyline).setStyle({ weight: style.weight * scale });
        });
      });
    });

    /* assets — points */
    network.assets.forEach((feat) => {
      const props = feat.properties;
      const [lon, lat] = feat.geometry.coordinates;
      const marker = L.marker([lat, lon], {
        icon: assetIcon(feat)
      });
      marker.bindPopup(() => assetPopupHtml(feat), {
        className: `aw-popup aw-popup-${props.asset}`,
        closeButton: false,
        offset: [0, -14],
        maxWidth: 280
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setFocus({ kind: 'asset', feature: feat });
      });
      marker.bindTooltip(assetTooltip(feat), { direction: 'top', offset: [0, -10], opacity: 1 });
      const grp = groups[props.asset];
      if (grp) marker.addTo(grp);
    });

    /* leaks — georeferenced incident markers, severity-coloured */
    const leakGroup = L.layerGroup();
    leakGroupRef.current = leakGroup;
    leakData.forEach((leak) => {
      const marker = L.marker([leak.lat, leak.lng], { icon: leakIcon(leak) });
      marker.bindPopup(() => leakPopupHtml(leak), {
        className: 'aw-popup aw-popup-leak',
        closeButton: false,
        offset: [0, -14],
        maxWidth: 280
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setFocus({ kind: 'leak', leak });
      });
      marker.bindTooltip(`${leak.id} · ${LEAK_SEVERITY_LABEL[leak.severity]} leak`, { direction: 'top', offset: [0, -12], opacity: 1 });
      marker.addTo(leakGroup);
    });
    if (showLeaks) leakGroup.addTo(map);

    /* dismiss focus on empty click */
    map.on('click', () => setFocus(null));

    return () => {
      map.remove();
      leafletRef.current = null;
      layerGroupsRef.current = {};
      leakGroupRef.current = null;
      tileRef.current = null;
    };
    // mode is read at init; subsequent changes handled by the tile-swap effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  /* ── 3. swap tiles on theme / basemap change without recreating map ── */
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    const tile = makeTileLayer(basemap, mode === 'dark');
    if (tile) { tile.addTo(map); tileRef.current = tile; }
  }, [mode, basemap]);

  /* ── 4. layer toggles ── */
  useEffect(() => {
    const map = leafletRef.current;
    const groups = layerGroupsRef.current;
    if (!map) return;
    ([...PIPE_KEYS, ...ASSET_KEYS] as Array<PipeClass | AssetKind>).forEach((k) => {
      const g = groups[k];
      if (!g) return;
      const on = layers[k];
      const has = map.hasLayer(g);
      if (on && !has) g.addTo(map);
      if (!on && has) map.removeLayer(g);
    });
  }, [layers]);

  /* ── 4b. leak layer toggle ── */
  useEffect(() => {
    const map = leafletRef.current;
    const grp = leakGroupRef.current;
    if (!map || !grp) return;
    const has = map.hasLayer(grp);
    if (showLeaks && !has) grp.addTo(map);
    if (!showLeaks && has) map.removeLayer(grp);
  }, [showLeaks]);

  /* ── 4c. recolour links when symbology / results change ── */
  useEffect(() => {
    const groups = layerGroupsRef.current;
    PIPE_KEYS.forEach((k) => {
      const g = groups[k];
      if (!g) return;
      g.eachLayer((layer) => {
        const feat = (layer as L.Polyline & { _awFeat?: PipeFeature })._awFeat;
        if (feat) (layer as L.Polyline).setStyle(baseLineStyle(feat, linkBy, hasResults));
      });
    });
  }, [linkBy, hasResults]);

  /* ── 5. focus outline (selected pipe highlight) ── */
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    if (focusOutlineRef.current) {
      map.removeLayer(focusOutlineRef.current);
      focusOutlineRef.current = null;
    }
    if (focus?.kind === 'pipe') {
      const coords: [number, number][] = focus.feature.geometry.coordinates.map(
        ([lon, lat]) => [lat, lon]
      );
      const ring = L.polyline(coords, {
        color: '#facc15',
        weight: 6,
        opacity: 0.55,
        lineCap: 'round',
        lineJoin: 'round'
      });
      ring.addTo(map);
      focusOutlineRef.current = ring;
      map.flyToBounds(ring.getBounds(), { duration: 0.5, padding: [40, 40], maxZoom: 17 });
    } else if (focus?.kind === 'asset') {
      const [lon, lat] = focus.feature.geometry.coordinates;
      map.flyTo([lat, lon], Math.max(map.getZoom(), 16), { duration: 0.5 });
    } else if (focus?.kind === 'leak') {
      map.flyTo([focus.leak.lat, focus.leak.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
    }
  }, [focus]);

  /* ── 6. honour ?focus=<kind>:<id> from deep links ── */
  useEffect(() => {
    if (!network) return;
    const f = searchParams.get('focus');
    if (!f) return;
    const [kind, id] = f.split(':');
    if (!id) return;
    if (kind === 'asset') {
      const match = network.assets.find((a) => a.properties.id === id);
      if (match) {
        setLayers((p) => ({ ...p, [match.properties.asset]: true }));
        setFocus({ kind: 'asset', feature: match });
      }
    } else if (kind === 'pipe') {
      const match = network.pipes.find((p) => p.properties.id === id);
      if (match) {
        setLayers((p) => ({ ...p, [match.properties.ui_class]: true }));
        setFocus({ kind: 'pipe', feature: match });
      }
    } else if (kind === 'leak') {
      const match = leakData.find((l) => l.id === id);
      if (match) {
        setShowLeaks(true);
        setFocus({ kind: 'leak', leak: match });
      }
    }
    // consume the param so a refresh doesn't keep re-focusing
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [network, searchParams, setSearchParams]);

  const fitView = useCallback(() => {
    const map = leafletRef.current;
    if (!map || !network) return;
    const [lonMin, latMin, lonMax, latMax] = network.meta.bbox;
    map.flyToBounds(L.latLngBounds([latMin, lonMin], [latMax, lonMax]), { duration: 0.6, padding: [48, 48] });
  }, [network]);

  // Simulate is a UX stand-in: it drives the status strip + unlocks the
  // hydraulic colour-by options. Real hydraulics land in a later phase.
  const runSimulate = useCallback(() => {
    setSim('running');
    const t = setTimeout(() => setSim('success'), 1100);
    return () => clearTimeout(t);
  }, []);

  // Editing the network invalidates any prior run.
  useEffect(() => {
    setSim((s) => (s === 'success' || s === 'warning' ? 'outdated' : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  const toggleLayer = useCallback(
    (k: PipeClass | AssetKind) => setLayers((p) => ({ ...p, [k]: !p[k] })),
    []
  );
  const setAllPipes = useCallback((on: boolean) => {
    setLayers((p) => ({ ...p, main: on, distribution: on, service: on, backfeed: on, boundary: on }));
  }, []);
  const setAllAssets = useCallback((on: boolean) => {
    setLayers((p) => ({ ...p, tank: on, pressure_valve: on, meter_valve: on, sensor: on }));
  }, []);

  const visibleStats = useMemo(() => {
    if (!network) return null;
    const pipeCounts: Record<PipeClass, number> = {
      main: 0, distribution: 0, household: 0, backfeed: 0, boundary: 0
    };
    for (const f of network.pipes) pipeCounts[f.properties.ui_class]++;
    const assetCounts: Record<AssetKind, number> = {
      tank: 0, pressure_valve: 0, meter_valve: 0, sensor: 0
    };
    for (const a of network.assets) assetCounts[a.properties.asset]++;
    return { pipeCounts, assetCounts };
  }, [network]);

  return (
    <Shell active="gis" title="GIS Map" sub="Water Supply Network · live operational view" pagePadding={false} hideRightRail>
      <div className="gis-workspace">
      <WorkspaceToolbar
        basemap={basemap}
        onBasemap={setBasemap}
        onFit={fitView}
        sim={sim}
        onSimulate={runSimulate}
      />
      <div className={`gis-canvas gis-canvas--real${basemap === 'none' ? ' gis-canvas--nomap' : ' gis-canvas--sat'}`}>
        <div ref={mapRef} className="gis-leaflet" />

        {!network && !loadError && (
          <div className="map-loading">
            <div className="map-loading-spinner" />
            <div className="map-loading-text">Loading water network …</div>
            <div className="map-loading-sub">4,951 polylines · reprojecting UTM 36S → WGS84</div>
          </div>
        )}
        {loadError && (
          <div className="map-loading map-loading--error">
            <div className="map-loading-text">Couldn't load network data</div>
            <div className="map-loading-sub">{loadError}</div>
          </div>
        )}

        {network && visibleStats && (
          <>
            <LayerControl
              layers={layers}
              counts={visibleStats}
              onToggle={toggleLayer}
              onAllPipes={setAllPipes}
              onAllAssets={setAllAssets}
              meta={network.meta}
              showLeaks={showLeaks}
              leakCount={leakData.length}
              onToggleLeaks={() => setShowLeaks((x) => !x)}
              linkBy={linkBy}
              nodeBy={nodeBy}
              onLinkBy={setLinkBy}
              onNodeBy={setNodeBy}
              hasResults={hasResults}
            />
          </>
        )}
      </div>
      <SimulationStrip sim={sim} onRun={runSimulate} linkBy={linkBy} nodeBy={nodeBy} hasResults={hasResults} />
      </div>

      {focus?.kind === 'pipe' && (
        <PipePanel feature={focus.feature} onClose={() => setFocus(null)} />
      )}
      {focus?.kind === 'asset' && (
        <AssetPanel feature={focus.feature} onClose={() => setFocus(null)} />
      )}
      {focus?.kind === 'leak' && (
        <LeakPanel leak={focus.leak} onClose={() => setFocus(null)} />
      )}
    </Shell>
  );
}

/* ─────────────────────────────────────────
   Symbology — colour links by the selected
   property. Class is the default; diameter and
   status are data-backed; flow/velocity/headloss
   come from synthesized simulation results.
   ───────────────────────────────────────── */

// Soft professional ramp: slate → pale blue → teal → amber → coral.
// Viridis — perceptually-uniform sequential scale, the data-viz standard.
const RAMP = ['#440154', '#3B528B', '#21918C', '#5EC962', '#FDE725'];
function rampColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = Math.min(RAMP.length - 2, Math.floor(clamped * (RAMP.length - 1)));
  return RAMP[idx + (clamped * (RAMP.length - 1) - idx > 0.5 ? 1 : 0)];
}

/** Deterministic pseudo-flow for a pipe so "simulate" produces stable results. */
function simFlow(p: PipeProps): number {
  const dia = p.diameter_mm || 80;
  const base = (dia / 25) ** 1.6 * 0.8;
  let h = 0;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return base * (0.7 + (h % 100) / 100 * 0.9);
}

/** Resolve the resting style for a pipe under the active symbology. */
function baseLineStyle(
  feat: PipeFeature,
  linkBy: LinkSymbology,
  hasResults: boolean
): L.PolylineOptions {
  const p = feat.properties;
  const style = PIPE_STYLE[p.ui_class];
  const dashArray = p.status === 'closed' ? '8 5' : style.dashArray;
  let color = style.color;
  if (linkBy === 'diameter') {
    const d = p.diameter_mm || 0;
    color = rampColor((d - 25) / (400 - 25));
  } else if (linkBy === 'status') {
    color = p.status === 'closed' ? '#D4675E' : p.service === 'out-of-service' ? '#D9A156' : '#4FA877';
  } else if (hasResults && (linkBy === 'flow' || linkBy === 'velocity' || linkBy === 'headloss')) {
    const flow = simFlow(p);
    const dia = p.diameter_mm || 80;
    const velocity = flow / (Math.PI * (dia / 2000) ** 2) / 1000;
    const headloss = (velocity ** 1.85) * (100 / dia);
    const metric = linkBy === 'flow' ? flow / 60 : linkBy === 'velocity' ? velocity / 2.5 : headloss / 12;
    color = rampColor(metric);
  }
  return {
    color,
    weight: style.weight,
    opacity: style.opacity,
    dashArray,
    lineCap: 'round',
    lineJoin: 'round'
  };
}

/* ─────────────────────────────────────────
   Map icons — divIcons for each asset kind
   ───────────────────────────────────────── */

function assetIcon(feat: AssetFeature): L.DivIcon {
  const props = feat.properties;
  const kind = props.asset;
  const status = props.status;
  const palette = ASSET_STYLE[kind];
  const statusColor = STATUS_COLOR[status];
  if (kind === 'tank') {
    const level = (props as { level_pct: number }).level_pct;
    const lvlColor = level > 70 ? '#22C55E' : level > 35 ? '#F59E0B' : '#EF4444';
    return L.divIcon({
      className: 'aw-marker',
      html: `<div class="aw-asset-marker aw-tank" style="--ac:${palette.color};--sc:${statusColor};--lc:${lvlColor}">
        <div class="aw-tank-shell">
          <div class="aw-tank-fill" style="height:${level}%"></div>
          <span class="aw-tank-label">${level}%</span>
        </div>
      </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }
  if (kind === 'pressure_valve') {
    // Standard hydraulic valve bowtie.
    return L.divIcon({
      className: 'aw-marker',
      html: `<div class="aw-asset-marker aw-prv" style="--ac:${palette.color};--sc:${statusColor}">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <polygon points="3,5 3,19 12,12" fill="var(--ac)" stroke="white" stroke-width="2"/>
          <polygon points="21,5 21,19 12,12" fill="var(--ac)" stroke="white" stroke-width="2"/>
        </svg>
        <span class="aw-status-dot" style="background:${statusColor}"></span>
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }
  if (kind === 'meter_valve') {
    // Pump / bulk meter — circle with drive wedge.
    return L.divIcon({
      className: 'aw-marker',
      html: `<div class="aw-asset-marker aw-mv" style="--ac:${palette.color};--sc:${statusColor}">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <circle cx="10" cy="14" r="7" fill="var(--ac)" stroke="white" stroke-width="2"/>
          <polygon points="10,14 19,5 19,14" fill="var(--ac)" stroke="white" stroke-width="2"/>
        </svg>
        <span class="aw-status-dot" style="background:${statusColor}"></span>
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }
  return L.divIcon({
    className: 'aw-marker',
    html: `<div class="aw-asset-marker aw-sensor" style="--ac:${palette.color};--sc:${statusColor}">
      <span class="aw-sensor-pulse"></span>
      <span class="aw-sensor-dot"></span>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function assetTooltip(feat: AssetFeature): string {
  const p = feat.properties;
  if (p.asset === 'tank') return `${p.name} · level sensor ${p.level_pct}%`;
  if (p.asset === 'pressure_valve') return `${p.name} · ${p.live_bar} bar`;
  if (p.asset === 'meter_valve') return `${p.name} · ⌀${p.size_mm} mm`;
  return `${p.name} · ${p.flow_lps} L/s`;
}

/* Leak incident marker — pulsing teardrop, severity-coloured.
   Fixed leaks render muted so open incidents stand out. */
function leakIcon(leak: Leak): L.DivIcon {
  const color = leak.severity === 'critical' ? LEAK_SEVERITY_COLOR.critical
    : leak.severity === 'major' ? LEAK_SEVERITY_COLOR.major
    : LEAK_SEVERITY_COLOR.minor;
  const fixed = leak.status === 'fixed';
  return L.divIcon({
    className: 'aw-marker',
    html: `<div class="aw-leak-marker${fixed ? ' fixed' : ''}" style="--lk:${color}">
      ${fixed ? '' : '<span class="aw-leak-pulse"></span>'}
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" fill="var(--lk)" stroke="white" stroke-width="1.5"/></svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 20]
  });
}

function leakPopupHtml(leak: Leak): string {
  const color = LEAK_SEVERITY_COLOR[leak.severity];
  const pill = leak.status === 'fixed'
    ? `<span class="aw-pop-pill aw-pop-pill--ok">Fixed</span>`
    : leak.status === 'reported'
      ? `<span class="aw-pop-pill aw-pop-pill--bad">Reported</span>`
      : `<span class="aw-pop-pill aw-pop-pill--warn">${escapeHtml(LEAK_STATUS_LABEL[leak.status])}</span>`;
  return `
    <div class="aw-pop">
      <div class="aw-pop-head">
        <span class="aw-pop-swatch dot" style="background:${color}"></span>
        <div class="aw-pop-head-text">
          <div class="aw-pop-title">${escapeHtml(LEAK_SEVERITY_LABEL[leak.severity])} leak</div>
          <div class="aw-pop-sub">${escapeHtml(leak.id)} · ${escapeHtml(zoneLabel(leak.zone))}</div>
        </div>
        ${pill}
      </div>
      <div class="aw-pop-grid">
        <div><span>Address</span><strong>${escapeHtml(leak.address)}</strong></div>
        <div><span>Pipe</span><strong>${escapeHtml(leak.pipe || '—')}</strong></div>
        <div><span>Reported</span><strong>${escapeHtml(leak.reported)}</strong></div>
        <div><span>Source</span><strong>${escapeHtml(leak.source)}</strong></div>
      </div>
      <div class="aw-pop-foot">Click again for full incident record →</div>
    </div>`;
}

/* ─────────────────────────────────────────
   Click popups — Qatium-style key facts at
   the click location. Side panel opens for
   the full operational record.
   ───────────────────────────────────────── */

function pipePopupHtml(feat: PipeFeature): string {
  const p = feat.properties;
  const style = PIPE_STYLE[p.ui_class];
  const length = p.length_m ? `${p.length_m < 1 ? p.length_m.toFixed(1) : p.length_m.toFixed(0)} m` : '—';
  const dia = p.diameter_mm ? `⌀${p.diameter_mm} mm` : '⌀—';
  const status = p.status === 'closed'
    ? `<span class="aw-pop-pill aw-pop-pill--warn">Closed</span>`
    : p.service === 'in-service'
      ? `<span class="aw-pop-pill aw-pop-pill--ok">In service</span>`
      : p.service === 'out-of-service'
        ? `<span class="aw-pop-pill aw-pop-pill--bad">Out of service</span>`
        : `<span class="aw-pop-pill aw-pop-pill--muted">Open</span>`;
  return `
    <div class="aw-pop">
      <div class="aw-pop-head">
        <span class="aw-pop-swatch" style="background:${style.color}"></span>
        <div class="aw-pop-head-text">
          <div class="aw-pop-title">${escapeHtml(style.label)}</div>
          <div class="aw-pop-sub">${escapeHtml(p.id)}</div>
        </div>
        ${status}
      </div>
      <div class="aw-pop-grid">
        <div><span>Material</span><strong>${escapeHtml(p.material || '—')}</strong></div>
        <div><span>Diameter</span><strong>${dia}</strong></div>
        <div><span>Length</span><strong>${length}</strong></div>
        <div><span>Zone</span><strong>${escapeHtml(p.zone ? zoneLabel(p.zone) : '—')}</strong></div>
        <div><span>Installed</span><strong>${p.installed || '—'}</strong></div>
        <div><span>Pressure</span><strong>${p.ui_class === 'main' ? '3.4 bar' : p.ui_class === 'backfeed' ? '— (closed)' : '2.6 bar'}</strong></div>
      </div>
      <div class="aw-pop-foot">Click again for full operational record →</div>
    </div>`;
}

function assetPopupHtml(feat: AssetFeature): string {
  const p = feat.properties;
  const statusPill =
    p.status === 'ok'
      ? `<span class="aw-pop-pill aw-pop-pill--ok">${p.asset === 'sensor' ? 'Online' : 'OK'}</span>`
      : p.status === 'warn'
        ? `<span class="aw-pop-pill aw-pop-pill--warn">Watch</span>`
        : `<span class="aw-pop-pill aw-pop-pill--bad">Alarm</span>`;
  if (p.asset === 'tank') {
    const lvlColor = p.level_pct > 70 ? '#22C55E' : p.level_pct > 35 ? '#F59E0B' : '#EF4444';
    return `
      <div class="aw-pop">
        <div class="aw-pop-head">
          <span class="aw-pop-swatch sq" style="background:${ASSET_STYLE.tank.color}"></span>
          <div class="aw-pop-head-text">
            <div class="aw-pop-title">${escapeHtml(p.name)}</div>
            <div class="aw-pop-sub">${escapeHtml(p.id)} · reservoir · level sensor</div>
          </div>
          ${statusPill}
        </div>
        <div class="aw-pop-level">
          <div class="aw-pop-level-label">Level sensor</div>
          <div class="aw-pop-level-value" style="color:${lvlColor}">${p.level_pct}%</div>
          <div class="aw-pop-level-bar"><div style="width:${p.level_pct}%;background:${lvlColor}"></div></div>
        </div>
        <div class="aw-pop-grid">
          <div><span>Capacity</span><strong>${p.capacity_m3.toLocaleString()} m³</strong></div>
          <div><span>Stored</span><strong>${Math.round(p.capacity_m3 * p.level_pct / 100).toLocaleString()} m³</strong></div>
          <div><span>Inflow</span><strong>${p.inflow_lps} L/s</strong></div>
          <div><span>Outflow</span><strong>${p.outflow_lps} L/s</strong></div>
        </div>
        <div class="aw-pop-foot">Click again for full reservoir record →</div>
      </div>`;
  }
  if (p.asset === 'pressure_valve') {
    const drift = (p.live_bar - p.set_bar).toFixed(2);
    return `
      <div class="aw-pop">
        <div class="aw-pop-head">
          <span class="aw-pop-swatch tri" style="background:${ASSET_STYLE.pressure_valve.color}"></span>
          <div class="aw-pop-head-text">
            <div class="aw-pop-title">${escapeHtml(p.name)}</div>
            <div class="aw-pop-sub">${escapeHtml(p.id)} · pressure reducing valve</div>
          </div>
          ${statusPill}
        </div>
        <div class="aw-pop-grid">
          <div><span>Live reading</span><strong>${p.live_bar} bar</strong></div>
          <div><span>Set point</span><strong>${p.set_bar} bar</strong></div>
          <div><span>Drift</span><strong>${drift} bar</strong></div>
          <div><span>Range</span><strong>${p.min_bar}–${p.max_bar} bar</strong></div>
        </div>
        <div class="aw-pop-foot">Click again for full valve record →</div>
      </div>`;
  }
  if (p.asset === 'meter_valve') {
    return `
      <div class="aw-pop">
        <div class="aw-pop-head">
          <span class="aw-pop-swatch dia" style="background:${ASSET_STYLE.meter_valve.color}"></span>
          <div class="aw-pop-head-text">
            <div class="aw-pop-title">${escapeHtml(p.name)}</div>
            <div class="aw-pop-sub">${escapeHtml(p.id)} · bulk meter valve</div>
          </div>
          ${statusPill}
        </div>
        <div class="aw-pop-grid">
          <div><span>Size</span><strong>⌀${p.size_mm} mm</strong></div>
          <div><span>State</span><strong>${escapeHtml(p.state)}</strong></div>
          <div><span>Today</span><strong>${p.consumption_m3d.toLocaleString()} m³</strong></div>
          <div><span>Trend</span><strong>${p.consumption_m3d > 700 ? '▲ rising' : '▬ steady'}</strong></div>
        </div>
        <div class="aw-pop-foot">Click again for full meter record →</div>
      </div>`;
  }
  // sensor
  return `
    <div class="aw-pop">
      <div class="aw-pop-head">
        <span class="aw-pop-swatch dot" style="background:${ASSET_STYLE.sensor.color}"></span>
        <div class="aw-pop-head-text">
          <div class="aw-pop-title">${escapeHtml(p.name)}</div>
          <div class="aw-pop-sub">${escapeHtml(p.id)} · ${escapeHtml(p.type)}</div>
        </div>
        ${statusPill}
      </div>
      <div class="aw-pop-grid">
        <div><span>Flow</span><strong>${p.flow_lps} L/s</strong></div>
        <div><span>Pressure</span><strong>${p.pressure_bar} bar</strong></div>
        <div><span>Last reading</span><strong>${escapeHtml(p.last_seen)}</strong></div>
        <div><span>On pipe</span><strong>${escapeHtml(p.pipe_id)}</strong></div>
      </div>
      <div class="aw-pop-foot">Click again for full sensor record →</div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;');
}

/* ─────────────────────────────────────────
   Floating layer control (top-left)
   ───────────────────────────────────────── */

function LayerControl({
  layers,
  counts,
  onToggle,
  onAllPipes,
  onAllAssets,
  meta,
  showLeaks,
  leakCount,
  onToggleLeaks,
  linkBy,
  nodeBy,
  onLinkBy,
  onNodeBy,
  hasResults
}: {
  layers: LayerVis;
  counts: { pipeCounts: Record<PipeClass, number>; assetCounts: Record<AssetKind, number> };
  onToggle: (k: PipeClass | AssetKind) => void;
  onAllPipes: (on: boolean) => void;
  onAllAssets: (on: boolean) => void;
  meta: NetworkData['meta'];
  showLeaks: boolean;
  leakCount: number;
  onToggleLeaks: () => void;
  linkBy: LinkSymbology;
  nodeBy: NodeSymbology;
  onLinkBy: (k: LinkSymbology) => void;
  onNodeBy: (k: NodeSymbology) => void;
  hasResults: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const visiblePipeCount = PIPE_KEYS.reduce((sum, k) => sum + (layers[k] ? counts.pipeCounts[k] : 0), 0);
  const visibleAssetCount = ASSET_KEYS.reduce((sum, k) => sum + (layers[k] ? counts.assetCounts[k] : 0), 0);

  return (
    <div className={`gis-layer-control${expanded ? '' : ' collapsed'}`}>
      <div className="gis-layer-control-head" onClick={() => setExpanded((x) => !x)}>
        <div>
          <div className="gis-lc-title">Layers</div>
          <div className="gis-lc-meta">{visiblePipeCount.toLocaleString()} pipes · {visibleAssetCount} assets</div>
        </div>
        <button className="gis-lc-collapse" aria-label="Collapse layers">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="gis-layer-control-body">
          <div className="gis-lc-section">
            <div className="gis-lc-section-head">
              <span>Network</span>
              <div className="gis-lc-bulk">
                <button onClick={(e) => { e.stopPropagation(); onAllPipes(true); }}>All</button>
                <button onClick={(e) => { e.stopPropagation(); onAllPipes(false); }}>None</button>
              </div>
            </div>
            {PIPE_KEYS.map((k) => (
              <LayerToggle
                key={k}
                label={PIPE_STYLE[k].label}
                count={counts.pipeCounts[k]}
                on={layers[k]}
                swatch={<PipeSwatch cls={k} />}
                onClick={() => onToggle(k)}
              />
            ))}
          </div>
          <div className="gis-lc-section">
            <div className="gis-lc-section-head">
              <span>Telemetry</span>
              <div className="gis-lc-bulk">
                <button onClick={(e) => { e.stopPropagation(); onAllAssets(true); }}>All</button>
                <button onClick={(e) => { e.stopPropagation(); onAllAssets(false); }}>None</button>
              </div>
            </div>
            {ASSET_KEYS.map((k) => (
              <LayerToggle
                key={k}
                label={ASSET_STYLE[k].label}
                count={counts.assetCounts[k]}
                on={layers[k]}
                swatch={<AssetSwatch kind={k} />}
                onClick={() => onToggle(k)}
              />
            ))}
          </div>
          <div className="gis-lc-section">
            <div className="gis-lc-section-head">
              <span>Incidents</span>
            </div>
            <LayerToggle
              label="Leaks"
              count={leakCount}
              on={showLeaks}
              swatch={
                <svg width={14} height={14} viewBox="0 0 24 24">
                  <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" fill={LEAK_SEVERITY_COLOR.critical} />
                </svg>
              }
              onClick={onToggleLeaks}
            />
          </div>
          <div className="gis-lc-section">
            <div className="gis-lc-section-head"><span>Link symbology</span></div>
            <select
              className="gis-symbology-select"
              value={linkBy}
              onChange={(e) => onLinkBy(e.target.value as LinkSymbology)}
            >
              {LINK_SYMBOLOGY.map((o) => (
                <option key={o.key} value={o.key} disabled={o.needsSim && !hasResults}>
                  {o.label}{o.needsSim && !hasResults ? ' · run simulation' : ''}
                </option>
              ))}
            </select>
            <RampLegend linkBy={linkBy} hasResults={hasResults} />
          </div>
          <div className="gis-lc-section">
            <div className="gis-lc-section-head"><span>Node symbology</span></div>
            <select
              className="gis-symbology-select"
              value={nodeBy}
              onChange={(e) => onNodeBy(e.target.value as NodeSymbology)}
            >
              {NODE_SYMBOLOGY.map((o) => (
                <option key={o.key} value={o.key} disabled={o.needsSim && !hasResults}>
                  {o.label}{o.needsSim && !hasResults ? ' · run simulation' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="gis-lc-section gis-lc-status">
            <div className="gis-lc-section-head"><span>Status</span></div>
            <div className="gis-lc-status-row">
              <span><span className="gis-status-dot" style={{ background: STATUS_COLOR.ok }} />Healthy</span>
              <span><span className="gis-status-dot" style={{ background: STATUS_COLOR.warn }} />Anomaly</span>
              <span><span className="gis-status-dot" style={{ background: STATUS_COLOR.alert }} />Critical</span>
            </div>
          </div>
          <div className="gis-lc-foot">
            <div><span>Total length</span><strong>{(meta.total_length_m / 1000).toFixed(1)} km</strong></div>
            <div><span>Zones</span><strong>{meta.top_zones.length}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

const RAMP_RANGES: Partial<Record<LinkSymbology, { lo: string; hi: string }>> = {
  diameter: { lo: '25 mm', hi: '≥400 mm' },
  flow: { lo: '0 L/s', hi: '60 L/s' },
  velocity: { lo: '0 m/s', hi: '2.5 m/s' },
  headloss: { lo: '0 m/km', hi: '12 m/km' }
};

/** EPANET-style gradient legend for the active scaled link symbology. */
function RampLegend({ linkBy, hasResults }: { linkBy: LinkSymbology; hasResults: boolean }) {
  const range = RAMP_RANGES[linkBy];
  if (!range) return null;
  const needsSim = linkBy !== 'diameter';
  if (needsSim && !hasResults) return null;
  return (
    <div className="gis-ramp-legend">
      <div className="gis-ramp-bar" style={{ background: `linear-gradient(90deg, ${RAMP.join(',')})` }} />
      <div className="gis-ramp-labels"><span>{range.lo}</span><span>{range.hi}</span></div>
    </div>
  );
}

function LayerToggle({ label, count, on, swatch, onClick }: {
  label: string; count: number; on: boolean; swatch: React.ReactNode; onClick: () => void;
}) {
  // Labelled legend row (GIS/EPANET style): checkbox · symbol · name · count.
  return (
    <button
      className={`gis-layer-toggle${on ? ' on' : ''}`}
      onClick={onClick}
      type="button"
      aria-pressed={on}
    >
      <span className="gis-lt-check" aria-hidden="true">{on ? '✓' : ''}</span>
      <span className="gis-lt-swatch">{swatch}</span>
      <span className="gis-lt-label">{label}</span>
      <span className="gis-lt-count">{count.toLocaleString()}</span>
    </button>
  );
}

function PipeSwatch({ cls }: { cls: PipeClass }) {
  const s = PIPE_STYLE[cls];
  return (
    <span
      className="gis-pipe-swatch"
      style={{
        background: s.color,
        backgroundImage: s.dashArray ? `repeating-linear-gradient(90deg, ${s.color} 0 6px, transparent 6px 10px)` : undefined,
        height: Math.min(5, Math.max(2, s.weight))
      }}
    />
  );
}

function AssetSwatch({ kind }: { kind: AssetKind }) {
  const c = ASSET_STYLE[kind].color;
  if (kind === 'tank') {
    // Reservoir / tank — cylinder with a waterline.
    return (
      <svg width={22} height={22} viewBox="0 0 22 22">
        <rect x={5} y={3} width={12} height={16} rx={2} fill={c} stroke="#fff" strokeWidth={1.6} />
        <rect x={5} y={11} width={12} height={8} rx={2} fill="#fff" opacity={0.3} />
        <line x1={5} y1={11} x2={17} y2={11} stroke="#fff" strokeWidth={1.4} opacity={0.8} />
      </svg>
    );
  }
  if (kind === 'pressure_valve') {
    // Valve (PRV) — standard hydraulic bowtie.
    return (
      <svg width={22} height={22} viewBox="0 0 22 22">
        <polygon points="3,4 3,18 11,11" fill={c} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
        <polygon points="19,4 19,18 11,11" fill={c} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'meter_valve') {
    // Pump / bulk meter — circle with drive wedge.
    return (
      <svg width={22} height={22} viewBox="0 0 22 22">
        <circle cx={10} cy={12} r={7} fill={c} stroke="#fff" strokeWidth={1.6} />
        <polygon points="10,12 19,3 19,12" fill={c} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    );
  }
  // Sensor — telemetry node with broadcast arcs.
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round">
      <circle cx={11} cy={15} r={2.6} fill={c} stroke="none" />
      <path d="M6.5 10.5a6 6 0 0 1 9 0" opacity={0.85} />
      <path d="M4 7.5a9.5 9.5 0 0 1 14 0" opacity={0.5} />
    </svg>
  );
}

/* Legend was merged into LayerControl — see status block + per-row swatches. */

/* ─────────────────────────────────────────
   Workspace toolbar (top) + simulation strip (bottom)
   ───────────────────────────────────────── */

const BASEMAP_TABS: Array<{ key: Basemap; label: string; title: string }> = [
  { key: 'satellite', label: 'Satellite', title: 'Aerial imagery — no labels' },
  { key: 'none', label: 'No basemap', title: 'Engineering canvas — model only' }
];

function WorkspaceToolbar({ basemap, onBasemap, onFit, sim, onSimulate }: {
  basemap: Basemap;
  onBasemap: (b: Basemap) => void;
  onFit: () => void;
  sim: SimState;
  onSimulate: () => void;
}) {
  return (
    <div className="gis-toolbar">
      <div className="gis-basemap-tabs" role="tablist" aria-label="Basemap">
        {BASEMAP_TABS.map((t) => (
          <button
            key={t.key}
            className={`gis-basemap-tab${basemap === t.key ? ' active' : ''}`}
            onClick={() => onBasemap(t.key)}
            title={t.title}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button type="button" className="gis-tool" onClick={onFit} title="Fit view" aria-label="Fit view">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5" />
        </svg>
      </button>
      <div className="gis-toolbar-spacer" />
      <button
        type="button"
        className={`gis-simulate-btn sim-${sim}`}
        onClick={onSimulate}
        disabled={sim === 'running'}
        title="Run hydraulic simulation"
      >
        <span className="gis-sim-dot" />
        {sim === 'running' ? 'Running…' : 'Run simulation'}
      </button>
    </div>
  );
}

function SimulationStrip({ sim, onRun, linkBy, nodeBy, hasResults }: {
  sim: SimState;
  onRun: () => void;
  linkBy: LinkSymbology;
  nodeBy: NodeSymbology;
  hasResults: boolean;
}) {
  const linkLabel = LINK_SYMBOLOGY.find((o) => o.key === linkBy)?.label ?? '—';
  const nodeLabel = NODE_SYMBOLOGY.find((o) => o.key === nodeBy)?.label ?? '—';
  return (
    <div className={`gis-sim-strip sim-${sim}`}>
      <div className="gis-sim-state">
        <span className="gis-sim-dot" />
        <strong>{SIM_LABEL[sim]}</strong>
      </div>
      <div className="gis-sim-fields">
        <div><span>Headloss formula</span><strong>Hazen-Williams</strong></div>
        <div><span>Demand multiplier</span><strong>1.0×</strong></div>
        <div><span>Links by</span><strong>{linkLabel}</strong></div>
        <div><span>Nodes by</span><strong>{nodeLabel}</strong></div>
        <div><span>Results</span><strong>{hasResults ? 'Available' : 'None'}</strong></div>
      </div>
      <button type="button" className="gis-sim-run" onClick={onRun} disabled={sim === 'running'}>
        {sim === 'running' ? 'Running…' : hasResults ? 'Re-run' : 'Run simulation'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────
   Side panels
   ───────────────────────────────────────── */

function PipePanel({ feature, onClose }: { feature: PipeFeature; onClose: () => void }) {
  const p = feature.properties;
  const style = PIPE_STYLE[p.ui_class];
  const flowDir =
    p.node_from && p.node_to ? `${p.node_from} → ${p.node_to}` : '—';
  const zoneName = p.zone ? zoneLabel(p.zone) : '—';

  return (
    <SidePanel
      open
      onClose={onClose}
      kind={style.label}
      title={p.id}
      pill={{
        tone: p.ui_class === 'backfeed' ? 'warn' : p.status === 'closed' ? 'muted' : 'safe',
        label: p.status === 'closed' ? 'Closed' : p.service === 'in-service' ? 'In service' : p.service === 'out-of-service' ? 'Out of service' : 'Open'
      }}
    >
      <SectionLabel>Geometry</SectionLabel>
      <SpRow label="Pipe type" value={style.label} />
      <SpRow label="Material" value={p.material || '—'} />
      <SpRow label="Diameter" value={p.diameter_mm ? `${p.diameter_mm} mm` : '—'} mono />
      <SpRow label="Length" value={p.length_m ? `${p.length_m.toFixed(0)} m` : '—'} mono />
      <SpRow label="Pressure class" value={p.diameter_mm && p.diameter_mm >= 200 ? 'PN16' : p.diameter_mm && p.diameter_mm >= 100 ? 'PN12.5' : 'PN10'} />

      <div style={{ height: 14 }} />
      <SectionLabel>Operations</SectionLabel>
      <SpRow label="Status" value={p.status} color={p.status === 'closed' ? '#f59e0b' : '#22c55e'} />
      <SpRow label="Service" value={p.service.replace('-', ' ')} />
      <SpRow label="Flow direction" value={flowDir} mono />
      <SpRow label="Zone" value={zoneName} />
      <SpRow label="Installed" value={p.installed || '—'} mono />
      <SpRow label="DC ID" value={p.id} mono />
      {p.remarks && p.remarks.toUpperCase() !== 'OK' && p.remarks.toUpperCase() !== 'N/A' && (
        <SpRow label="Field note" value={p.remarks} />
      )}

      <div style={{ height: 14 }} />
      <SectionLabel>Live telemetry</SectionLabel>
      <SpRow
        label="Pressure"
        value={p.ui_class === 'main' ? '3.4 bar' : p.ui_class === 'backfeed' ? '— (closed)' : '2.6 bar'}
        mono
        color={p.ui_class === 'backfeed' ? '#94a3b8' : '#22c55e'}
      />
      <SpRow label="Flow estimate" value={p.diameter_mm ? `${Math.round((p.diameter_mm / 25) ** 1.6 * 0.8)} L/s` : '—'} mono />
      <SpRow label="Anomaly score" value="0.04" mono />
    </SidePanel>
  );
}

function AssetPanel({ feature, onClose }: { feature: AssetFeature; onClose: () => void }) {
  const p = feature.properties;
  if (p.asset === 'tank') {
    const lvlColor = p.level_pct > 70 ? '#22c55e' : p.level_pct > 35 ? '#f59e0b' : '#ef4444';
    return (
      <SidePanel
        open
        onClose={onClose}
        kind="Reservoir · level sensor"
        title={p.name}
        pill={{ tone: p.status === 'ok' ? 'safe' : 'warn', label: p.status === 'ok' ? 'Operating' : 'Watch' }}
      >
        <SectionLabel>Live level sensor</SectionLabel>
        <SpRow label="Level reading" value={`${p.level_pct}%`} mono color={lvlColor} />
        <div className="aw-level-bar">
          <div className="aw-level-fill" style={{ width: `${p.level_pct}%`, background: lvlColor }} />
        </div>
        <SpRow label="Volume stored" value={`${Math.round(p.capacity_m3 * p.level_pct / 100).toLocaleString()} m³`} mono />
        <SpRow label="Capacity" value={`${p.capacity_m3.toLocaleString()} m³`} mono />
        <SpRow label="Hours to empty" value={`${Math.max(1, Math.round((p.level_pct * p.capacity_m3 / 100) / Math.max(0.5, p.outflow_lps * 3.6)))}h`} mono />
        <div style={{ height: 14 }} />
        <SectionLabel>Flow</SectionLabel>
        <SpRow label="Inflow" value={`${p.inflow_lps} L/s`} mono color="#0B5FFF" />
        <SpRow label="Outflow" value={`${p.outflow_lps} L/s`} mono color="#F59E0B" />
        <SpRow label="Net" value={`${p.inflow_lps - p.outflow_lps >= 0 ? '+' : ''}${p.inflow_lps - p.outflow_lps} L/s`} mono />
        <div style={{ height: 14 }} />
        <SectionLabel>Identifier</SectionLabel>
        <SpRow label="Tank ID" value={p.id} mono />
        <SpRow label="Connecting pipes" value={p.junction_degree} mono />
      </SidePanel>
    );
  }
  if (p.asset === 'pressure_valve') {
    const drift = p.live_bar - p.set_bar;
    return (
      <SidePanel
        open
        onClose={onClose}
        kind="Pressure reducing valve"
        title={p.name}
        pill={{
          tone: p.status === 'ok' ? 'safe' : p.status === 'warn' ? 'warn' : 'danger',
          label: p.status === 'ok' ? 'Within range' : p.status === 'warn' ? 'Drifting' : 'Alarm'
        }}
      >
        <SectionLabel>Pressure</SectionLabel>
        <SpRow label="Set point" value={`${p.set_bar} bar`} mono />
        <SpRow label="Live reading" value={`${p.live_bar} bar`} mono color={p.status === 'alert' ? '#ef4444' : p.status === 'warn' ? '#f59e0b' : '#22c55e'} />
        <SpRow label="Drift" value={`${drift >= 0 ? '+' : ''}${drift.toFixed(2)} bar`} mono />
        <div style={{ height: 14 }} />
        <SectionLabel>Thresholds</SectionLabel>
        <SpRow label="Min allowed" value={`${p.min_bar} bar`} mono />
        <SpRow label="Max allowed" value={`${p.max_bar} bar`} mono />
        <SpRow label="Health" value={p.status === 'alert' ? 'Investigate' : 'Nominal'} />
        <div style={{ height: 14 }} />
        <SectionLabel>Identifier</SectionLabel>
        <SpRow label="Valve ID" value={p.id} mono />
      </SidePanel>
    );
  }
  if (p.asset === 'meter_valve') {
    return (
      <SidePanel
        open
        onClose={onClose}
        kind="Meter valve"
        title={p.name}
        pill={{ tone: p.status === 'ok' ? 'safe' : 'warn', label: p.state === 'open' ? 'Open' : 'Throttled' }}
      >
        <SectionLabel>Configuration</SectionLabel>
        <SpRow label="Nominal size" value={`⌀${p.size_mm} mm`} mono />
        <SpRow label="State" value={p.state} />
        <div style={{ height: 14 }} />
        <SectionLabel>Consumption</SectionLabel>
        <SpRow label="Today" value={`${p.consumption_m3d.toLocaleString()} m³`} mono color="#0B5FFF" />
        <SpRow label="7-day avg" value={`${Math.round(p.consumption_m3d * 0.92).toLocaleString()} m³`} mono />
        <SpRow label="Trend" value={p.consumption_m3d > 700 ? '▲ rising' : '▬ steady'} />
        <div style={{ height: 14 }} />
        <SectionLabel>Identifier</SectionLabel>
        <SpRow label="Meter ID" value={p.id} mono />
      </SidePanel>
    );
  }
  return (
    <SidePanel
      open
      onClose={onClose}
      kind="Flow + pressure sensor"
      title={p.name}
      pill={{ tone: p.status === 'ok' ? 'safe' : 'danger', label: p.status === 'ok' ? 'Online' : 'Alert' }}
    >
      <SectionLabel>Live reading</SectionLabel>
      <SpRow label="Flow rate" value={`${p.flow_lps} L/s`} mono color="#0B5FFF" />
      <SpRow label="Pressure" value={`${p.pressure_bar} bar`} mono color="#22c55e" />
      <SpRow label="Sensor type" value={p.type} />
      <SpRow label="Last reading" value={p.last_seen} mono />
      <div style={{ height: 14 }} />
      <SectionLabel>Consumption trend</SectionLabel>
      <Sparkline base={p.flow_lps} />
      <SpRow label="24h volume" value={`${Math.round(p.flow_lps * 86.4).toLocaleString()} m³`} mono />
      <div style={{ height: 14 }} />
      <SectionLabel>Linkage</SectionLabel>
      <SpRow label="On pipe" value={p.pipe_id} mono />
      <SpRow label="Sensor ID" value={p.id} mono />
    </SidePanel>
  );
}

function LeakPanel({ leak, onClose }: { leak: Leak; onClose: () => void }) {
  const color = LEAK_SEVERITY_COLOR[leak.severity];
  const isFixed = leak.status === 'fixed';
  return (
    <SidePanel
      open
      onClose={onClose}
      kind={`${LEAK_SEVERITY_LABEL[leak.severity]} leak`}
      title={leak.id}
      pill={{
        tone: isFixed ? 'safe' : leak.status === 'reported' ? 'danger' : 'warn',
        label: LEAK_STATUS_LABEL[leak.status]
      }}
    >
      <SectionLabel>Incident</SectionLabel>
      <SpRow label="Severity" value={LEAK_SEVERITY_LABEL[leak.severity]} color={color} />
      <SpRow label="Zone" value={zoneLabel(leak.zone)} />
      <SpRow label="Address" value={leak.address} />
      <SpRow label="On pipe" value={leak.pipe || '—'} mono />
      <SpRow label="Coordinates" value={`${leak.lat.toFixed(4)}, ${leak.lng.toFixed(4)}`} mono />

      <div style={{ height: 14 }} />
      <SectionLabel>Report</SectionLabel>
      <SpRow label="Reported" value={leak.reported} mono />
      <SpRow label="Caller" value={leak.caller} />
      <SpRow label="Phone" value={leak.phone} mono />
      <SpRow label="Source" value={leak.source} />
      <SpRow label="Notes" value={leak.notes} />

      {(leak.crew || leak.leakType || leak.cause || leak.fixDescription || leak.materials || leak.cost) && (
        <>
          <div style={{ height: 14 }} />
          <SectionLabel>Resolution</SectionLabel>
          {leak.leakType && <SpRow label="Leak type" value={leak.leakType} />}
          {leak.cause && <SpRow label="Cause" value={leak.cause} />}
          {leak.fixDescription && <SpRow label="Fix" value={leak.fixDescription} />}
          {leak.crew && <SpRow label="Crew" value={leak.crew} />}
          {leak.materials && <SpRow label="Materials" value={leak.materials} />}
          {leak.cost && <SpRow label="Cost" value={leak.cost} mono />}
          {leak.timeStarted && <SpRow label="Started" value={leak.timeStarted} mono />}
          {leak.timeFixed && <SpRow label="Fixed" value={leak.timeFixed} mono />}
        </>
      )}
    </SidePanel>
  );
}

function Sparkline({ base }: { base: number }) {
  const points = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 24; i++) {
      arr.push(base + Math.sin((i / 24) * Math.PI * 2) * (base * 0.18) + Math.cos(i * 1.7) * (base * 0.08));
    }
    return arr;
  }, [base]);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 320;
  const h = 60;
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="aw-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`${path} L${w},${h} L0,${h} Z`} fill="rgba(11,95,255,0.12)" />
      <path d={path} fill="none" stroke="#0B5FFF" strokeWidth={2} />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="sp-section-label">{children}</div>;
}

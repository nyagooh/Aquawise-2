/**
 * GISMap — Erline Water supply network.
 *
 * Renders the raw water, transmission and distribution lines plus the
 * service-area outline from the converted Erline shapefiles, the surveyed
 * intakes / treatment plants / reservoirs, and a synthesized telemetry
 * overlay (pressure valves, meter valves, flow+pressure sensors). Click any asset to see its full operational
 * profile in the side panel.
 */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { Shell } from '../components/Shell';
import { SidePanel, SpRow } from '../components/SidePanel';
import { useOps, ago, zoneName, type Ops } from '../demo/model';
import { withState, useIncidentState } from '../demo/incidentState';
import { LineChart } from '../demo/charts';
import { series, rangeSpec, METRICS, toneFor, type Metric, type Tone } from '../demo/series';
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
  QUALITY_SENSOR_COLOR,
  assetGlyph,
  engSymbol,
  markerIcon,
  type MarkerKind,
  FACILITY_LABEL,
  zoneLabel
} from '../data/network';

const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/">OSM</a> · <a href="https://carto.com/">CARTO</a> · Erline Water';
// Google tiles — real imagery without a proxy. `lyrs=s` is pure satellite with
// NO labels/roads (clean backdrop for the network); `lyrs=m` is the street map.
const GOOGLE_KEY = (import.meta as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env?.VITE_GOOGLE_MAPS_API_KEY || '';
// apistyle hides points of interest and transit so only the network carries icons
const TILE_GOOGLE_SATELLITE = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const TILE_GOOGLE_ATTR = 'Imagery &copy; <a href="https://www.google.com/maps">Google</a> · Erline Water';

/** Basemap mode — satellite imagery, or the bare canvas for schematic (non-geographic) models. */
type Basemap = 'satellite' | 'none';

/** Build the basemap tile layer (none for schematic models). */
function makeTileLayer(basemap: Basemap): L.TileLayer | null {
  if (basemap === 'none') return null;
  // keepBuffer + updateWhenZooming:false keep already-loaded tiles painted while
  // panning/zooming, so the map doesn't flash grey between tile fetches.
  const common = { attribution: TILE_GOOGLE_ATTR, subdomains: '0123', maxZoom: 20, keepBuffer: 4, updateWhenZooming: false };
  return L.tileLayer(TILE_GOOGLE_SATELLITE, common);
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
  | null;

/** One map layer per map-key row: each drawn pipe class and each asset symbol. */
type KeyId = PipeClass | MarkerKind;
type LayerVis = Record<string, boolean>;

const PIPE_KEYS: PipeClass[] = PIPE_CLASS_ORDER;
const ASSET_KEYS: MarkerKind[] = ['plant', 'tank', 'pressure', 'quality', 'valve', 'meter'];
const KEY_IDS: KeyId[] = [...PIPE_KEYS, ...ASSET_KEYS];
const DEFAULT_LAYERS: LayerVis = Object.fromEntries(KEY_IDS.map((k) => [k, true]));

/** Map-key symbol an asset is drawn with (pressure and water-quality sensors are separate rows). */
function markerKindOf(p: AssetFeature['properties']): MarkerKind {
  if (p.asset === 'facility') return 'plant';
  if (p.asset === 'tank') return 'tank';
  if (p.asset === 'pressure_valve') return 'valve';
  if (p.asset === 'meter_valve') return 'meter';
  return p.subtype === 'ph' || p.subtype === 'turbidity' ? 'quality' : 'pressure';
}

export default function GISMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerVis>(DEFAULT_LAYERS);
  const [focus, setFocus] = useState<Focus>(null);
  const [basemap, setBasemap] = useState<Basemap>('satellite');
  const [sim, setSim] = useState<SimState>('idle');
  const [linkBy, setLinkBy] = useState<LinkSymbology>('class');
  const [nodeBy, setNodeBy] = useState<NodeSymbology>('asset');
  const hasResults = sim === 'success' || sim === 'warning' || sim === 'outdated';

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const opsData = useOps();
  const opsRef = useRef<Ops | null>(null);
  opsRef.current = opsData;
  const nav = useNavigate();
  const detailRef = useRef<L.Popup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const layerGroupsRef = useRef<Partial<Record<KeyId, L.LayerGroup>>>({});
  const focusOutlineRef = useRef<L.Layer | null>(null);
  // Read inside Leaflet event handlers (which close over init-time values).
  const linkByRef = useRef<LinkSymbology>(linkBy);
  const simHasResultsRef = useRef<boolean>(hasResults);
  linkByRef.current = linkBy;
  simHasResultsRef.current = hasResults;

  /* ── 1. fetch network — a user-uploaded network takes priority over the
        bundled Erline Water dataset ── */
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

    const tile = makeTileLayer(basemap);
    if (tile) { tile.addTo(map); tileRef.current = tile; }

    /* layer groups */
    const groups: Partial<Record<KeyId, L.LayerGroup>> = {};
    KEY_IDS.forEach((k) => {
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
      const scale = z >= 17 ? 1.4 : z >= 15 ? 1.2 : z >= 13 ? 1.05 : 0.95;
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
      // Only sensors and reservoirs open the detail panel; pipes, valves,
      // meters show their hover label only.
      if (props.asset === 'sensor' || props.asset === 'tank' || props.asset === 'meter_valve' || props.asset === 'pressure_valve') {
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          marker.closeTooltip();
          setFocus({ kind: 'asset', feature: feat });
        });
      }
      marker.bindTooltip(assetTooltip(feat), { direction: 'top', offset: [0, -10], opacity: 1 });
      const grp = groups[markerKindOf(props)];
      if (grp) marker.addTo(grp);
    });

    /* dismiss focus on empty click */
    map.on('click', () => setFocus(null));

    return () => {
      map.remove();
      leafletRef.current = null;
      layerGroupsRef.current = {};
      tileRef.current = null;
    };
    // basemap is read at init; subsequent changes handled by the tile-swap effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  /* ── 3. swap tiles on basemap change without recreating map ── */
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    const tile = makeTileLayer(basemap);
    if (tile) { tile.addTo(map); tileRef.current = tile; }
  }, [basemap]);

  /* ── 4. layer toggles ── */
  useEffect(() => {
    const map = leafletRef.current;
    const groups = layerGroupsRef.current;
    if (!map) return;
    KEY_IDS.forEach((k) => {
      const g = groups[k];
      if (!g) return;
      const on = layers[k];
      const has = map.hasLayer(g);
      if (on && !has) g.addTo(map);
      if (!on && has) map.removeLayer(g);
    });
  }, [layers]);

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
    }
    /* Details open on top of the map, anchored to the element (no side panel). */
    const prev = detailRef.current;
    detailRef.current = null; // detach first so its 'remove' handler doesn't clear the new focus
    prev?.remove();
    if (!focus) return;
    let at: L.LatLngExpression; let html: string;
    if (focus.kind === 'pipe') {
      const c = focus.feature.geometry.coordinates;
      const m = c[Math.floor(c.length / 2)];
      at = [m[1], m[0]]; html = pipePopupHtml(focus.feature);
    } else {
      const [lon, lat] = focus.feature.geometry.coordinates;
      at = [lat, lon]; html = detailPopupHtml(focus.feature, opsRef.current);
    }
    if (map.getZoom() < 15) map.setView(at, 15, { animate: false });
    const pop = L.popup({ className: 'aw-popup aw-detail', closeButton: true, maxWidth: 340, minWidth: 300, autoPanPadding: [40, 40], offset: [0, -10] })
      .setLatLng(at).setContent(html).openOn(map);
    pop.on('remove', () => { if (detailRef.current === pop) { detailRef.current = null; setFocus(null); } });
    detailRef.current = pop;
  }, [focus]);

  /* links inside popups navigate within the app */
  useEffect(() => {
    const map = leafletRef.current; if (!map) return;
    const el = map.getContainer();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('[data-nav]') as HTMLElement | null;
      if (a) { e.preventDefault(); nav(a.dataset.nav!); }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [nav, network]);

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
        setLayers((p) => ({ ...p, [markerKindOf(match.properties)]: true }));
        setFocus({ kind: 'asset', feature: match });
      }
    } else if (kind === 'pipe') {
      const match = network.pipes.find((p) => p.properties.id === id);
      if (match) {
        setLayers((p) => ({ ...p, [match.properties.ui_class]: true }));
        setFocus({ kind: 'pipe', feature: match });
      }
    }
    // consume the param so a refresh doesn't keep re-focusing
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [network, searchParams, setSearchParams]);

  /* Full view: put the whole map workspace into browser fullscreen. */
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void workspaceRef.current?.requestFullscreen();
  }, []);
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === workspaceRef.current);
      // Leaflet must re-measure once the container has resized.
      setTimeout(() => leafletRef.current?.invalidateSize(), 120);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

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


  return (
    <Shell active="network" title="Network" sub="GIS operational view · Erline Water supply network" pagePadding={false} hideRightRail>
      <div className="gis-workspace" ref={workspaceRef}>
      <WorkspaceToolbar
        onFit={fitView}
        fullscreen={fullscreen}
        onFullscreen={toggleFullscreen}
      />
      <div className={`gis-canvas gis-canvas--real${basemap === 'none' ? ' gis-canvas--nomap' : ' gis-canvas--sat'}`}>
        <div ref={mapRef} className="gis-leaflet" />

        {!network && !loadError && (
          <div className="map-loading">
            <div className="map-loading-spinner" />
            <div className="map-loading-text">Loading water network …</div>
            <div className="map-loading-sub">Erline Water · raw, transmission &amp; distribution lines</div>
          </div>
        )}
        {loadError && (
          <div className="map-loading map-loading--error">
            <div className="map-loading-text">Couldn't load network data</div>
            <div className="map-loading-sub">{loadError}</div>
          </div>
        )}

        {network && (
          <>
            <MapKey layers={layers} onToggle={(k) => setLayers((p) => ({ ...p, [k]: !p[k] }))} />
          </>
        )}
      </div>
      </div>

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
  const dashArray = p.status === 'closed' ? '6 5' : style.dashArray;
  let color = style.color;
  if (linkBy === 'diameter') {
    const d = p.diameter_mm || 0;
    color = rampColor((d - 25) / (400 - 25));
  } else if (linkBy === 'status') {
    color = p.status === 'closed' ? '#64748B' : p.service === 'out-of-service' ? '#F59E0B' : '#10B981';
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
  const ring = status !== 'ok' ? ` alert" style="--halo:${STATUS_COLOR[status]}` : '';
  if (kind === 'tank') {
    const level = (props as { level_pct: number }).level_pct;
    const lvlColor = level >= 35 ? '#10B981' : level >= 20 ? '#F59E0B' : '#EF4444';
    return L.divIcon({
      className: 'aw-marker',
      html: `<div class="eg-tank"><span class="eg-sym${ring}">${markerIcon('tank', palette.color, 24)}</span><span class="eg-tag"><i style="background:${lvlColor}"></i>${level}%</span></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }
  if (kind === 'facility') {
    return L.divIcon({
      className: 'aw-marker',
      html: `<span class="eg-sym${ring}">${markerIcon('plant', palette.color, 24)}</span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }
  const sub = (props as { subtype?: string }).subtype;
  const quality = sub === 'ph' || sub === 'turbidity';
  const mk = kind === 'pressure_valve' ? 'valve' : kind === 'meter_valve' ? 'meter' : quality ? 'quality' : 'pressure';
  const color = quality ? QUALITY_SENSOR_COLOR : palette.color;
  return L.divIcon({
    className: 'aw-marker',
    html: `<span class="eg-sym${ring}">${markerIcon(mk, color, 20)}</span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function assetTooltip(feat: AssetFeature): string {
  const p = feat.properties;
  if (p.asset === 'facility') return `${p.name} · ${FACILITY_LABEL[p.facility_type]}`;
  if (p.asset === 'tank') return `${p.name} · level sensor ${p.level_pct}%`;
  if (p.asset === 'pressure_valve') return `${p.name} · ${p.live_bar} bar`;
  if (p.asset === 'meter_valve') return `${p.name} · ⌀${p.size_mm} mm`;
  return `${p.name} · ${p.flow_lps} L/s`;
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
  if (p.asset === 'facility') {
    const util = Math.round((p.throughput_m3d / p.capacity_m3d) * 100);
    return `
      <div class="aw-pop">
        <div class="aw-pop-head">
          <span class="aw-pop-swatch sq" style="background:${ASSET_STYLE.facility.color}"></span>
          <div class="aw-pop-head-text">
            <div class="aw-pop-title">${escapeHtml(p.name)}</div>
            <div class="aw-pop-sub">${escapeHtml(p.id)} · ${escapeHtml(FACILITY_LABEL[p.facility_type].toLowerCase())}</div>
          </div>
          ${statusPill}
        </div>
        <div class="aw-pop-grid">
          <div><span>Design capacity</span><strong>${p.capacity_m3d.toLocaleString()} m³/d</strong></div>
          <div><span>Throughput</span><strong>${p.throughput_m3d.toLocaleString()} m³/d</strong></div>
          <div><span>Utilisation</span><strong>${util}%</strong></div>
          <div><span>Type</span><strong>${escapeHtml(p.facility_type.toUpperCase())}</strong></div>
        </div>
        <div class="aw-pop-foot">Click again for full facility record →</div>
      </div>`;
  }
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

/** Rich detail card for sensors and reservoirs: live reading, safe range, 24 h trend, recent alerts. */
function detailPopupHtml(feat: AssetFeature, ops: Ops | null): string {
  const p = feat.properties;
  if (!ops || p.asset === 'facility') return assetPopupHtml(feat);
  const day = rangeSpec('24H');
  let title = p.name; let kind = ''; let metric: Metric = 'pressure'; let entity = p.id; let base = 0;
  let rows: Array<[string, string]> = []; let href = '/monitoring'; let zone = '';
  if (p.asset === 'pressure_valve') {
    const v = ops.prvs.find(x => x.id === p.id);
    if (!v) return assetPopupHtml(feat);
    // Pressure downstream of the valve, trended around its live reading.
    metric = 'pressure'; base = v.live_bar; zone = v.zone; kind = 'Pressure-reducing valve'; title = `PRV ${v.id.replace('PV-', '')}`; href = '/assets';
    const drift = v.live_bar - v.set_bar;
    rows = [['Outlet pressure', `${v.live_bar.toFixed(2)} bar`], ['Set point', `${v.set_bar.toFixed(1)} bar`], ['Drift', `${drift >= 0 ? '+' : '−'}${Math.abs(drift).toFixed(2)} bar`], ['Allowed band', `${v.min_bar}–${v.max_bar} bar`]];
  } else if (p.asset === 'meter_valve') {
    const m = ops.meters.find(x => x.id === p.id);
    if (!m) return assetPopupHtml(feat);
    // Bulk meter: consumption expressed as an average flow so it can be trended.
    metric = 'flow'; base = m.consumption_m3d / 86.4; zone = m.zone; kind = 'Bulk meter'; title = m.name; href = '/assets';
    const today = Math.round(series('flow', m.id, base, day).reduce((a, x) => a + x.v, 0) / 97 * 86.4);
    rows = [['Today', `${today.toLocaleString()} m³`], ['Average', `${m.consumption_m3d.toLocaleString()} m³/day`], ['Size', `⌀ ${m.size_mm} mm`], ['Valve', m.state === 'throttled' ? 'Throttled' : 'Open']];
  } else if (p.asset === 'tank') {
    const t = ops.tanks.find(x => x.id === p.id);
    if (!t) return assetPopupHtml(feat);
    title = t.name; kind = 'Reservoir · level sensor'; metric = 'level'; base = t.base; zone = t.zone; href = '/monitoring/tank-levels';
    rows = [['Level', `${Math.round(t.level)} %`], ['Stored', `${Math.round(t.volume).toLocaleString()} m³`], ['Capacity', `${t.capacity.toLocaleString()} m³`], ['Last 6 h', `${t.change6h >= 0 ? '+' : '−'}${Math.abs(t.change6h).toFixed(0)} pts`]];
  } else if (p.subtype === 'ph' || p.subtype === 'turbidity') {
    const z = p.id.split('-').slice(1).join('-');
    const q = ops.quality.find(x => x.zone === z);
    if (!q) return assetPopupHtml(feat);
    metric = p.subtype === 'ph' ? 'ph' : 'turbidity'; entity = q.id; base = q.base[metric as 'ph' | 'turbidity']; zone = q.zone;
    title = q.name; kind = 'Water-quality monitoring point'; href = '/monitoring/water-quality';
    rows = (['turbidity', 'ph', 'chlorine', 'conductivity'] as Metric[]).map(m => [METRICS[m].label.replace('Residual chlorine', 'Chlorine'), `${q.values[m].toFixed(METRICS[m].decimals)}${METRICS[m].unit ? ` ${METRICS[m].unit}` : ''}`]);
  } else {
    const s = ops.pressure.find(x => x.id === p.id);
    if (!s) return assetPopupHtml(feat);
    base = s.base; zone = s.zone; kind = 'Pressure & flow logger'; title = `Logger ${s.id}`; href = '/monitoring/pressure';
    rows = [['Pressure', s.online ? `${s.value.toFixed(2)} bar` : '—'], ['Flow', s.online ? `${s.flow.toFixed(1)} L/s` : '—'], ['Safe range', METRICS.pressure.rangeText], ['On pipe', s.pipeId]];
  }
  const pts = series(metric, entity, base, day);
  const now = pts[pts.length - 1].v;
  const tone: Tone = p.asset === 'meter_valve' || p.asset === 'pressure_valve' ? (p.status === 'ok' ? 'ok' : p.status === 'warn' ? 'warn' : 'crit') : toneFor(metric, now);
  const toneLabel = { ok: 'Normal', warn: 'Warning', crit: 'Critical', off: 'Offline' }[tone];
  const W = 296, H = 54;
  const lo = Math.min(...pts.map(x => x.v)), hi = Math.max(...pts.map(x => x.v));
  const path = pts.map((x, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * W).toFixed(1)},${(H - 3 - ((x.v - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)}`).join('');
  const col = tone === 'ok' ? '#1769E8' : tone === 'warn' ? '#D97706' : '#DC2626';
  const alerts = withState(ops.incidents).filter(i => i.entityId === entity || i.focus === `asset:${p.id}`).filter(i => i.status !== 'resolved');
  return `
    <div class="aw-detail-card">
      <div class="dt-head">
        <div><div class="dt-kind">${escapeHtml(kind)}</div><div class="dt-title">${escapeHtml(title)}</div><div class="dt-sub">${escapeHtml(zoneName(zone))} · ${escapeHtml(p.id)}</div></div>
        <span class="dt-pill ${tone}">${toneLabel}</span>
      </div>
      <div class="dt-grid">${rows.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>
      <div class="dt-trend"><span>${p.asset === 'meter_valve' ? 'Consumption (flow)' : p.asset === 'pressure_valve' ? 'Outlet pressure' : escapeHtml(METRICS[metric].label)} · last 24 h</span>
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none"><path d="${path}L${W},${H}L0,${H}Z" fill="${col}" opacity="0.08"/><path d="${path}" fill="none" stroke="${col}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>
      </div>
      ${alerts.length ? `<div class="dt-alerts">${alerts.slice(0, 2).map(a => `<a href="#" data-nav="/alerts?id=${a.id}"><i class="${a.severity}"></i>${escapeHtml(a.title.split(' — ')[0])}<em>${escapeHtml(ago(a.startedAt))}</em></a>`).join('')}</div>` : ''}
      <a href="#" class="dt-link" data-nav="${href}">${p.asset === 'meter_valve' || p.asset === 'pressure_valve' ? 'Open in Assets →' : 'Open in Monitoring →'}</a>
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
   Map key — a plain legend, like a printed map
   ───────────────────────────────────────── */

const KEY_LABEL: Record<MarkerKind, string> = {
  plant: 'Intake / treatment plant',
  tank: 'Reservoir',
  pressure: 'Pressure sensor',
  quality: 'Water-quality sensor',
  valve: 'Pressure valve',
  meter: 'Bulk meter'
};

/** Map key: what the map can show, each row with a checkbox to show or hide it. */
function MapKey({ layers, onToggle }: { layers: LayerVis; onToggle: (k: KeyId) => void }) {
  const [open, setOpen] = useState(true);
  const row = (k: KeyId, symbol: React.ReactNode, label: string) => (
    <label key={k} className={`gis-key-row${layers[k] ? '' : ' off'}`}>
      <input type="checkbox" checked={!!layers[k]} onChange={() => onToggle(k)} />
      {symbol}
      <span>{label}</span>
    </label>
  );
  return (
    <div className={`gis-key${open ? '' : ' closed'}`}>
      <button type="button" className="gis-key-head" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        <span>Key</span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
      </button>
      {open && (
        <div className="gis-key-body">
          <div className="gis-key-group">
            {PIPE_KEYS.map((k) => row(k, <span className="gis-key-sq" style={{ background: PIPE_STYLE[k].color }} />, PIPE_STYLE[k].label))}
          </div>
          <div className="gis-key-group">
            {ASSET_KEYS.map((k) => row(k, <span dangerouslySetInnerHTML={{ __html: markerIcon(k, undefined, 16) }} />, KEY_LABEL[k]))}
          </div>
          <div className="gis-key-group">
            <div className="gis-key-row static"><span className="gis-key-ring" style={{ borderColor: STATUS_COLOR.warn }} />Needs attention</div>
            <div className="gis-key-row static"><span className="gis-key-ring" style={{ borderColor: STATUS_COLOR.alert }} />Critical</div>
          </div>
        </div>
      )}
    </div>
  );
}






/* ─────────────────────────────────────────
   Workspace toolbar (top) + simulation strip (bottom)
   ───────────────────────────────────────── */

function WorkspaceToolbar({ onFit, fullscreen, onFullscreen }: {
  onFit: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}) {
  return (
    <div className="gis-toolbar">
      <span className="gis-basemap-label">Satellite</span>
      <button type="button" className="gis-tool" onClick={onFit} title="Fit to network" aria-label="Fit to network">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={12} cy={12} r={7} /><circle cx={12} cy={12} r={2} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
      <button type="button" className="gis-tool" onClick={onFullscreen} title={fullscreen ? 'Exit full view' : 'Full view'} aria-label={fullscreen ? 'Exit full view' : 'Full view'}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d={fullscreen ? 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5' : 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5'} />
        </svg>
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
        <SpRow label="Route / note" value={p.remarks} />
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
      <NetworkInsights pipeId={p.id} />
    </SidePanel>
  );
}

function AssetPanel({ feature, onClose }: { feature: AssetFeature; onClose: () => void }) {
  const p = feature.properties;
  if (p.asset === 'facility') {
    const util = Math.round((p.throughput_m3d / p.capacity_m3d) * 100);
    return (
      <SidePanel
        open
        onClose={onClose}
        kind={FACILITY_LABEL[p.facility_type]}
        title={p.name}
        pill={{ tone: p.status === 'ok' ? 'safe' : 'warn', label: p.status === 'ok' ? 'Operating' : 'Watch' }}
      >
        <SectionLabel>Production</SectionLabel>
        <SpRow label="Design capacity" value={`${p.capacity_m3d.toLocaleString()} m³/d`} mono />
        <SpRow label="Throughput today" value={`${p.throughput_m3d.toLocaleString()} m³/d`} mono color="#0B5FFF" />
        <SpRow label="Utilisation" value={`${util}%`} mono color={util > 90 ? '#f59e0b' : '#22c55e'} />
        <div style={{ height: 14 }} />
        <SectionLabel>Identifier</SectionLabel>
        <SpRow label="Facility ID" value={p.id} mono />
        <SpRow label="Coordinates" value={`${feature.geometry.coordinates[1].toFixed(5)}, ${feature.geometry.coordinates[0].toFixed(5)}`} mono />
      </SidePanel>
    );
  }
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
        <SpRow label="Connecting pipes" value={p.junction_degree || '—'} mono />
        <NetworkInsights assetId={p.id} />
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
        <NetworkInsights assetId={p.id} />
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
        <NetworkInsights assetId={p.id} />
      </SidePanel>
    );
  }
  if (p.subtype === 'ph' || p.subtype === 'turbidity') {
    const isPh = p.subtype === 'ph';
    return (
      <SidePanel
        open
        onClose={onClose}
        kind="Water-quality monitoring point"
        title={p.name}
        pill={{ tone: p.status === 'ok' ? 'safe' : p.status === 'warn' ? 'warn' : 'danger', label: p.status === 'ok' ? 'Normal' : p.status === 'warn' ? 'Warning' : 'Critical' }}
      >
        <SectionLabel>Latest reading</SectionLabel>
        <SpRow label={isPh ? 'pH' : 'Turbidity'} value={isPh ? `${p.ph}` : `${p.turbidity_ntu} NTU`} mono />
        <SpRow label="Acceptable range" value={isPh ? '6.5 – 8.5' : '≤ 1.0 NTU'} mono />
        <SpRow label="Last reading" value={p.last_seen} mono />
        <SpRow label="Probe ID" value={p.id} mono />
        <NetworkInsights assetId={p.id} />
      </SidePanel>
    );
  }
  return (
    <SidePanel
      open
      onClose={onClose}
      kind="Flow + pressure sensor"
      title={p.name}
      pill={{ tone: p.status === 'ok' ? 'safe' : p.status === 'warn' ? 'warn' : 'danger', label: p.status === 'ok' ? 'Normal' : p.status === 'warn' ? 'Warning' : 'Critical' }}
    >
      <SectionLabel>Live reading</SectionLabel>
      <SpRow label="Flow rate" value={`${p.flow_lps} L/s`} mono color="#2563EB" />
      <SpRow label="Pressure" value={`${p.pressure_bar} bar`} mono color={STATUS_COLOR[p.status]} />
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
      <NetworkInsights assetId={p.id} />
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

/**
 * Operational context for any selected network element: 24 h trend from the
 * monitoring engine, recent alerts, and a jump to the full monitoring view.
 * Location → condition → data → incident.
 */
function NetworkInsights({ assetId, pipeId }: { assetId?: string; pipeId?: string }) {
  const ops = useOps();
  const navigate = useNavigate();
  useIncidentState();
  if (!ops) return null;
  const day = rangeSpec('24H');
  let trend: { metric: Metric; entity: string; base: number; label: string } | null = null;
  let link = '/assets';
  let linkLabel = 'View in Assets';
  const id = assetId ?? '';
  const pressure = ops.pressure.find(p => p.id === id || (pipeId && p.pipeId === pipeId));
  const tank = ops.tanks.find(t => t.id === id);
  const qZone = /^(PH|TB)-(.+)$/.exec(id)?.[2];
  const qp = qZone ? ops.quality.find(q => q.zone === qZone) : undefined;
  if (tank) { trend = { metric: 'level', entity: tank.id, base: tank.base, label: 'Tank level' }; link = '/monitoring/tank-levels'; linkLabel = 'View in Monitoring'; }
  else if (qp) { const m: Metric = id.startsWith('PH') ? 'ph' : 'turbidity'; trend = { metric: m, entity: qp.id, base: qp.base[m as 'ph' | 'turbidity'], label: m === 'ph' ? 'pH' : 'Turbidity' }; link = '/monitoring/water-quality'; linkLabel = 'View in Monitoring'; }
  else if (pressure) { trend = { metric: 'pressure', entity: pressure.id, base: pressure.base, label: pipeId ? `Pressure at ${pressure.id}` : 'Pressure' }; link = '/monitoring/pressure'; linkLabel = 'View in Monitoring'; }
  const entities = [id, pipeId, pressure?.id, tank?.id, qp?.id].filter(Boolean) as string[];
  const alerts = withState(ops.incidents)
    .filter(i => entities.includes(i.entityId) || (pipeId && i.focus === `pipe:${pipeId}`) || (assetId && i.focus === `asset:${assetId}`))
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 4);
  return (
    <>
      {trend && (
        <>
          <div style={{ height: 14 }} />
          <SectionLabel>Historical trend · {trend.label} · 24 h</SectionLabel>
          <LineChart series={[{ id: trend.entity, label: trend.label, points: series(trend.metric, trend.entity, trend.base, day) }]} metric={trend.metric} band={trend.metric === 'level' ? null : undefined} height={150} />
        </>
      )}
      <div style={{ height: 14 }} />
      <SectionLabel>Recent alerts</SectionLabel>
      {alerts.length ? alerts.map(a => (
        <SpRow key={a.id} label={`${a.title}`} value={a.status === 'resolved' ? `resolved · ${ago(a.startedAt)}` : ago(a.startedAt)} color={a.status === 'resolved' ? undefined : a.severity === 'critical' ? 'hsl(var(--danger))' : 'hsl(var(--warning))'} onClick={() => navigate(`/alerts?id=${a.id}`)} />
      )) : <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', margin: '6px 0' }}>No alerts in the last 30 days.</p>}
      <div style={{ height: 14 }} />
      <button className="dx-btn primary" style={{ width: '100%' }} onClick={() => navigate(link)}>{linkLabel} →</button>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="sp-section-label">{children}</div>;
}

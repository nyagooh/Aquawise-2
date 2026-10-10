/**
 * Compact operational map: the real Erline Water pipe network on a quiet basemap,
 * with status-coloured monitoring points. Used on Overview, Monitoring and NRW.
 * The full GIS workspace lives on the Network page.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '../theme';
import { markerIcon } from '../data/network';
import type { Ops, LatLng } from './model';
import type { Tone } from './series';

export interface MapPoint {
  id: string;
  pos: LatLng;
  tone: Tone;
  label: string;
  shape?: 'circle' | 'square' | 'diamond';
  size?: number;
}

const TONE_HEX: Record<Tone, string> = { ok: '#059669', warn: '#D97706', crit: '#DC2626', off: '#64748B' }; // map status palette
// Same basemap provider as the Network page; desaturated (and inverted in dark mode) via CSS.
const TILE = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t%3A2%7Cp.v%3Aoff%2Cs.t%3A4%7Cp.v%3Aoff';
const ATTR = 'Map data &copy; Google';

/** Canvas renderer that ignores redraws scheduled after the map was torn down (route change / StrictMode remount). */
const SafeCanvas = L.Canvas.extend({
  _redraw(this: L.Canvas & { _ctx?: CanvasRenderingContext2D; _map?: L.Map }) {
    if (!this._map || !this._ctx) return;
    (L.Canvas.prototype as unknown as { _redraw: () => void })._redraw.call(this);
  }
});

/** Bounds of the core network, trimming the outermost 1 % of vertices so stray segments don't zoom the map out. */
function coreBounds(ops: Ops, zone: string): L.LatLngBounds {
  const lats: number[] = []; const lngs: number[] = [];
  for (const p of ops.network.pipes) {
    if (zone !== 'ALL' && p.properties.zone !== zone) continue;
    for (const c of p.geometry.coordinates) { lngs.push(c[0]); lats.push(c[1]); }
  }
  if (!lats.length) { const [w, s, e, n] = ops.network.meta.bbox; return L.latLngBounds([s, w], [n, e]); }
  lats.sort((a, b) => a - b); lngs.sort((a, b) => a - b);
  const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * f)))];
  return L.latLngBounds([q(lats, 0.01), q(lngs, 0.01)], [q(lats, 0.99), q(lngs, 0.99)]);
}

export function NetworkMap({ ops, points, height = 360, zone = 'ALL', zoneColor, onSelect, selectedId }: {
  ops: Ops;
  points: MapPoint[];
  height?: number | string;
  zone?: string;
  /** Optional per-zone pipe colour (e.g. NRW heat). */
  zoneColor?: (zone: string) => string | null;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const { mode } = useTheme();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pipeLayer = useRef<L.LayerGroup | null>(null);
  const pointLayer = useRef<L.LayerGroup | null>(null);
  const renderer = useRef<L.Canvas | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /* init */
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    map.current = m;
    renderer.current = new (SafeCanvas as unknown as new (o: L.RendererOptions) => L.Canvas)({ padding: 0.3 });
    L.tileLayer(TILE, { attribution: ATTR, subdomains: '0123', maxZoom: 20, keepBuffer: 4 }).addTo(m);
    pipeLayer.current = L.layerGroup().addTo(m);
    pointLayer.current = L.layerGroup().addTo(m);
    m.fitBounds(coreBounds(ops, 'ALL'), { padding: [16, 16], animate: false });
    m.on('focus', () => m.scrollWheelZoom.enable());
    m.on('blur', () => m.scrollWheelZoom.disable());
    return () => {
      // Detach layers while the canvas renderer is still alive, otherwise their
      // removal schedules a redraw on a destroyed context.
      pipeLayer.current?.clearLayers();
      pointLayer.current?.clearLayers();
      m.remove();
      map.current = null; pipeLayer.current = null; pointLayer.current = null; renderer.current = null;
    };
  }, [ops]);

  /* pipes */
  useEffect(() => {
    const g = pipeLayer.current; const m = map.current; const canvas = renderer.current;
    if (!g || !m || !canvas) return;
    g.clearLayers();
    const dark = mode === 'dark';
    for (const p of ops.network.pipes) {
      const cls = p.properties.ui_class;
      if (cls !== 'main' && cls !== 'distribution' && cls !== 'backfeed') continue;
      const z = p.properties.zone ?? '';
      const inZone = zone === 'ALL' || z === zone;
      const custom = zoneColor?.(z);
      const color = custom ?? (cls === 'main' ? '#C2410C' : cls === 'backfeed' ? '#334155' : '#0369A1');
      L.polyline(p.geometry.coordinates.map(c => [c[1], c[0]] as LatLng), {
        renderer: canvas, interactive: false,
        color, weight: cls === 'main' ? 4.5 : cls === 'backfeed' ? 2.2 : 2.2, dashArray: cls === 'backfeed' && !custom ? '5 4' : undefined,
        opacity: inZone ? (cls === 'main' ? 1 : 0.85) : 0.15
      }).addTo(g);
    }
    m.fitBounds(coreBounds(ops, zone), { padding: [16, 16], maxZoom: 15, animate: false });
  }, [ops, zone, zoneColor, mode]);

  /* points */
  useEffect(() => {
    const g = pointLayer.current; if (!g) return;
    g.clearLayers();
    const order: Tone[] = ['ok', 'off', 'warn', 'crit'];
    [...points].sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone)).forEach(p => {
      const size = p.size ?? 12;
      const sel = p.id === selectedId;
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span class="eg-sym${p.tone === 'crit' ? ' alert' : ''}${sel ? ' sel' : ''}" style="--halo:${TONE_HEX[p.tone]}">${markerIcon(p.shape === 'square' ? 'tank' : p.shape === 'diamond' ? 'quality' : 'pressure', TONE_HEX[p.tone], size + 8)}</span>`
      });
      const mk = L.marker(p.pos, { icon, keyboard: false, zIndexOffset: order.indexOf(p.tone) * 100 + (sel ? 1000 : 0) });
      mk.bindTooltip(p.label, { direction: 'top', offset: [0, -size / 2], className: 'dx-maptip' });
      mk.on('click', () => onSelectRef.current?.(p.id));
      mk.addTo(g);
    });
  }, [points, selectedId]);

  return <div ref={el} className="dx-map" style={{ height }} />;
}

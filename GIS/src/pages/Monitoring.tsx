/**
 * Monitoring — the core monitoring centre.
 * Water quality, pressure and tank levels are what the utility monitors;
 * sensors are the device layer that collects some of that data.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Shell } from '../components/Shell';
import {
  useOps, ago, minsAgo, clock, zoneName,
  type Ops, type QualityPointOps, type SensorDevice, type TankOps, type Incident
} from '../demo/model';
import { useFilters, inZone } from '../demo/filters';
import { withState, useIncidentState } from '../demo/incidentState';
import { Card, Kpi, Status, Dot, Tabs, Segmented, Select, SearchInput, DataTable, Drawer, KV, Section, Loading, Insight, SevIcon, type Column } from '../demo/ui';
import { LineChart, ChartLegend, BarList, Sparkline, TankGauge, TONE_COLOR, SERIES_COLORS, type ChartSeries } from '../demo/charts';
import { NetworkMap, type MapPoint } from '../demo/NetworkMap';
import { markerIcon } from '../data/network';
import {
  series, sampleAt, meanSeries, eventWindows, toneFor, worstTone, fmt, METRICS, QUALITY_METRICS, NOW, HOURS,
  rangeSpec, type Metric, type Tone, type RangeSpec
} from '../demo/series';

type Tab = 'overview' | 'water-quality' | 'pressure' | 'tank-levels' | 'sensors';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'water-quality', label: 'Water Quality' },
  { key: 'pressure', label: 'Pressure' },
  { key: 'tank-levels', label: 'Tank Levels' },
  { key: 'sensors', label: 'Sensors' }
];

export default function Monitoring() {
  const ops = useOps();
  const { tab: raw } = useParams();
  const tab = (TABS.find(t => t.key === raw)?.key ?? 'overview') as Tab;
  const navigate = useNavigate();
  return (
    <Shell active="monitoring" title="Monitoring" sub="Current readings and trends over time" filters={{ zone: true, range: true }}>
      <div className="dx">
        <Tabs items={TABS} value={tab} onChange={k => navigate(k === 'overview' ? '/monitoring' : `/monitoring/${k}`)} />
        {!ops ? <Loading /> : (
          <>
            {tab === 'overview' && <MonitoringOverview ops={ops} />}
            {tab === 'water-quality' && <WaterQuality ops={ops} />}
            {tab === 'pressure' && <Pressure ops={ops} />}
            {tab === 'tank-levels' && <TankLevels ops={ops} />}
            {tab === 'sensors' && <Sensors ops={ops} />}
          </>
        )}
      </div>
    </Shell>
  );
}

/* ═════════════ helpers ═════════════ */
const change24 = (m: Metric, id: string, base: number) => sampleAt(m, id, base, NOW) - sampleAt(m, id, base, NOW - 24 * HOURS);
const signed = (v: number, d: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
function windowsFor(metric: Metric, ids: string[]) {
  return ids.flatMap(id => eventWindows(metric, id)).map(w => ({ ...w, tone: 'warn' as Tone }));
}
function useScoped(ops: Ops) {
  const { zone, spec } = useFilters();
  return {
    zone, spec,
    pressure: ops.pressure.filter(p => inZone(p.zone, zone)),
    tanks: ops.tanks.filter(t => inZone(t.zone, zone)),
    quality: ops.quality.filter(q => zone === 'ALL' || q.zone === zone),
    sensors: ops.sensors.filter(s => inZone(s.zone, zone)),
    incidents: withState(ops.incidents).filter(i => inZone(i.zone, zone))
  };
}
function RelatedAlerts({ list }: { list: Incident[] }) {
  const navigate = useNavigate();
  if (!list.length) return <p className="dx-muted">No alerts for this location in the last 30 days.</p>;
  return (
    <div className="dx-list" style={{ border: '1px solid hsl(var(--border))', borderRadius: 6 }}>
      {list.map(i => (
        <button key={i.id} type="button" className="dx-item" onClick={() => navigate(`/alerts?id=${i.id}`)}>
          <SevIcon severity={i.severity} />
          <div className="dx-item-main"><div className="dx-item-title">{i.title}</div><div className="dx-item-sub">{i.trigger}</div></div>
          <div className="dx-item-meta">{ago(i.startedAt)}<div>{i.status === 'resolved' ? 'Cleared' : 'Open'}</div></div>
        </button>
      ))}
    </div>
  );
}

/* ═════════════ Overview ═════════════ */
function MonitoringOverview({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const s = useScoped(ops);
  const online = s.pressure.filter(p => p.online);
  const avgP = online.length ? online.reduce((a, p) => a + p.value, 0) / online.length : 0;
  const anomalies = s.pressure.filter(p => p.tone === 'warn' || p.tone === 'crit');
  const avgLevel = s.tanks.length ? s.tanks.reduce((a, t) => a + t.level, 0) / s.tanks.length : 0;
  const pts = s.pressure.length + s.tanks.length + s.quality.length;
  const ptsOnline = online.length + s.tanks.length + s.quality.length;
  const sensorsOff = s.sensors.filter(x => x.health === 'off').length;
  const qBad = s.quality.filter(q => q.tone !== 'ok');
  const abnormal = s.incidents.filter(i => i.type !== 'Sensor offline' && NOW - i.startedAt < 7 * 24 * HOURS)
    .sort((a, b) => b.startedAt - a.startedAt);

  const mapPoints: MapPoint[] = [
    ...s.pressure.map(p => ({ id: `/monitoring/pressure`, pos: p.pos, tone: p.tone, label: `${p.id} · ${p.online ? fmt('pressure', p.value) : 'offline'}`, size: 10 })),
    ...s.tanks.map(t => ({ id: `/monitoring/tank-levels`, pos: t.pos, tone: t.tone, label: `${t.name} · ${Math.round(t.level)} %`, shape: 'square' as const, size: 13 })),
    ...s.quality.filter(q => q.zone !== 'WTW').map(q => ({ id: `/monitoring/water-quality`, pos: q.pos, tone: q.tone, label: `${q.name}`, shape: 'diamond' as const, size: 13 }))
  ];

  const okCount = <T extends { tone: Tone }>(l: T[]) => l.filter(x => x.tone === 'ok').length;
  const metricPage: Partial<Record<Metric, string>> = { pressure: '/monitoring/pressure', flow: '/monitoring/pressure', level: '/monitoring/tank-levels' };
  const groups = [
    { key: 'q', icon: 'quality' as const, color: '#0E7490', name: 'Water quality', what: 'Turbidity, pH, chlorine, conductivity, temperature', total: s.quality.length, ok: okCount(s.quality), href: '/monitoring/water-quality' },
    { key: 'p', icon: 'pressure' as const, color: '#1D4ED8', name: 'Pressure', what: `Average ${avgP.toFixed(2)} bar across ${online.length} loggers`, total: s.pressure.length, ok: okCount(s.pressure), href: '/monitoring/pressure' },
    { key: 't', icon: 'tank' as const, color: '#6D28D9', name: 'Tank levels', what: s.tanks.length ? `Average ${Math.round(avgLevel)} % across ${s.tanks.length} reservoirs` : 'No reservoirs in this zone', total: s.tanks.length, ok: okCount(s.tanks), href: '/monitoring/tank-levels' },
    { key: 's', icon: 'meter' as const, color: '#475467', name: 'Sensors', what: `${sensorsOff} offline · ${s.sensors.filter(x => x.health === 'warn').length} low battery or weak signal`, total: s.sensors.length, ok: s.sensors.filter(x => x.health === 'ok').length, href: '/monitoring/sensors' }
  ];

  return (
    <>
      <div className="dx-grid-kpi four">
        <Kpi label="Monitoring points reporting" value={ptsOnline} unit={`/ ${pts}`} tone={ptsOnline === pts ? 'ok' : 'warn'} sub="pressure, tank level and water quality" />
        <Kpi label="Water quality" tone={worstTone(s.quality.map(q => q.tone))} value={qBad.length ? `${qBad.length} of ${s.quality.length}` : 'All clear'} sub={qBad.length ? 'points outside their safe range' : `${s.quality.length} sampling points`} onClick={() => navigate('/monitoring/water-quality')} />
        <Kpi label="Pressure anomalies" tone={anomalies.some(a => a.tone === 'crit') ? 'crit' : anomalies.length ? 'warn' : 'ok'} value={anomalies.length} sub={anomalies.length ? [...new Set(anomalies.map(a => zoneName(a.zone)))].join(', ') : 'none right now'} onClick={() => navigate('/monitoring/pressure')} />
        <Kpi label="Sensors online" value={s.sensors.length - sensorsOff} unit={`/ ${s.sensors.length}`} tone={sensorsOff ? 'warn' : 'ok'} sub={`${sensorsOff} offline`} onClick={() => navigate('/monitoring/sensors')} />
      </div>
      <div className="dx-cols main-side">
        <Card title="Where we measure" sub="Click a point to open its readings" flush>
          <NetworkMap ops={ops} points={mapPoints} zone={s.zone} height={440} onSelect={id => navigate(id)} />
          <div className="dx-map-legend">
            <span className="mk-legend" dangerouslySetInnerHTML={{ __html: markerIcon('pressure', '#475467', 16) }} />Pressure
            <span className="mk-legend" dangerouslySetInnerHTML={{ __html: markerIcon('tank', '#475467', 16) }} />Reservoir
            <span className="mk-legend" dangerouslySetInnerHTML={{ __html: markerIcon('quality', '#475467', 16) }} />Water quality
            <span style={{ marginLeft: 'auto' }}><Dot tone="ok" />Normal</span><span><Dot tone="warn" />Warning</span><span><Dot tone="crit" />Critical</span><span><Dot tone="off" />Offline</span>
          </div>
        </Card>
        <Card title="By measurement" sub="How many points are within range" flush>
          <div className="dx-list">
            {groups.map(g => (
              <button key={g.key} type="button" className="dx-item mo-group" onClick={() => navigate(g.href)}>
                <span dangerouslySetInnerHTML={{ __html: markerIcon(g.icon, g.color, 28) }} />
                <div className="dx-item-main">
                  <div className="dx-item-title">{g.name}</div>
                  <div className="dx-item-sub">{g.what}</div>
                  <div className="mo-meter"><span style={{ width: `${(g.ok / Math.max(1, g.total)) * 100}%` }} /></div>
                </div>
                <div className="dx-item-val"><b>{g.ok}/{g.total}</b><span>normal</span></div>
              </button>
            ))}
          </div>
        </Card>
      </div>
      <Card title="Recent abnormal readings" sub="Last 7 days, newest first" flush>
        <div className="dx-list">
          {abnormal.map(i => (
            <button key={i.id} type="button" className="dx-item" onClick={() => navigate(i.status === 'resolved' ? (metricPage[i.metric] ?? '/monitoring/water-quality') : `/alerts?id=${i.id}`)}>
              <SevIcon severity={i.severity} />
              <div className="dx-item-main"><div className="dx-item-title">{i.title}</div><div className="dx-item-sub">{METRICS[i.metric].label} · {i.trigger}</div></div>
              <div className="dx-item-meta">{ago(i.startedAt)}<div>{i.status === 'resolved' ? 'Cleared' : 'Open'}</div></div>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

/* ═════════════ Water quality ═════════════ */
function WaterQuality({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const s = useScoped(ops);
  const worst = [...s.quality].sort((a, b) => toneRank(b.tone) - toneRank(a.tone))[0];
  const [pointId, setPointId] = useState<string>(worst?.id ?? 'WQ-WTW');
  const [param, setParam] = useState<Metric>(worst ? firstBad(worst) : 'turbidity');
  const [compare, setCompare] = useState(false);
  const [open, setOpen] = useState<QualityPointOps | null>(null);
  const point = s.quality.find(q => q.id === pointId) ?? s.quality[0];
  if (!point) return <Card><p className="dx-muted">No water-quality monitoring points in this zone.</p></Card>;

  const chartSeries: ChartSeries[] = compare
    ? s.quality.map((q, i) => ({ id: q.id, label: q.name, points: series(param, q.id, q.base[param as keyof typeof q.base], s.spec), color: SERIES_COLORS[i % SERIES_COLORS.length] }))
    : [{ id: point.id, label: point.name, points: series(param, point.id, point.base[param as keyof typeof point.base], s.spec) }];
  const events = s.incidents.filter(i => i.type === 'Water quality breach').sort((a, b) => b.startedAt - a.startedAt);

  const cols: Column<QualityPointOps>[] = [
    { key: 'loc', label: 'Location', render: q => <span className="strong">{q.name}</span>, sort: q => q.name },
    { key: 'zone', label: 'Zone', render: q => zoneName(q.zone), sort: q => zoneName(q.zone) },
    ...(['turbidity', 'ph', 'chlorine', 'conductivity'] as Metric[]).map(m => ({
      key: m, label: `${METRICS[m].label}${METRICS[m].unit ? ` (${METRICS[m].unit})` : ''}`, align: 'right' as const,
      render: (q: QualityPointOps) => <span className={q.tones[m] !== 'ok' ? `t-${q.tones[m]} strong` : ''}>{fmt(m, q.values[m], false)}</span>,
      sort: (q: QualityPointOps) => q.values[m]
    })),
    { key: 'last', label: 'Last reading', render: q => `${q.updatedMin} min ago`, sort: q => q.updatedMin },
    { key: 'st', label: 'Status', render: q => <Status tone={q.tone} />, sort: q => -toneRank(q.tone) }
  ];

  return (
    <>
      <Card title="Current readings" sub={`${point.name} · updated ${point.updatedMin} min ago`}
        actions={<Select label="Monitoring point" value={point.id} onChange={setPointId} options={s.quality.map(q => ({ value: q.id, label: q.name }))} />}>
        <div className="dx-grid-kpi">
          {QUALITY_METRICS.map(m => {
            const v = point.values[m]; const tone = point.tones[m]!; const d = METRICS[m];
            const ch = change24(m, point.id, point.base[m as keyof typeof point.base]);
            return (
              <Kpi key={m} label={d.label} tone={tone} value={fmt(m, v, false)} unit={d.unit || undefined} onClick={() => setParam(m)}
                sub={<>Range {d.rangeText} · {signed(ch, d.decimals)} in 24 h</>}>
                <div style={{ marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Status tone={tone} />
                  {param === m && <span className="dx-chip" style={{ background: 'hsl(var(--accent-bg))', color: 'hsl(var(--primary))' }}>Charted</span>}
                </div>
              </Kpi>
            );
          })}
        </div>
      </Card>

      <Card title={`Water quality over time · ${METRICS[param].label}`} sub={`${compare ? 'All monitoring points' : point.name} · ${s.spec.label}`}
        actions={<>
          <Segmented options={QUALITY_METRICS.map(m => ({ key: m, label: METRICS[m].label.replace('Residual chlorine', 'Chlorine') }))} value={param} onChange={setParam} size="sm" />
          <Segmented options={[{ key: 'one', label: 'This point' }, { key: 'all', label: 'Compare points' }]} value={compare ? 'all' : 'one'} onChange={k => setCompare(k === 'all')} size="sm" />
        </>}>
        <LineChart series={chartSeries} metric={param} height={300} windows={compare ? [] : windowsFor(param, [point.id])} />
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <ChartLegend items={[
            ...(compare ? [] : [{ label: METRICS[param].label, color: 'hsl(var(--primary))' }]),
            { label: `Acceptable range (${METRICS[param].rangeText})`, color: '', band: true },
            { label: 'Warning threshold', color: 'hsl(var(--warning))', dashed: true },
            { label: 'Critical threshold', color: 'hsl(var(--danger))', dashed: true }
          ]} />
          {compare && <ChartLegend items={chartSeries.map(c => ({ label: c.label, color: c.color! }))} />}
        </div>
      </Card>

      <Card title="Monitoring points" sub="Click a row for history and related alerts" flush>
        <DataTable columns={cols} rows={s.quality} rowKey={q => q.id} onRowClick={setOpen} selectedKey={open?.id} defaultSort={{ key: 'st', dir: 1 }} />
      </Card>

      <Card title="Quality events over time" sub="Threshold breaches over the last 30 days" flush>
        <DataTable columns={incidentCols()} rows={events} rowKey={i => i.id} onRowClick={i => navigate(`/alerts?id=${i.id}`)} empty="No quality events in this zone." />
      </Card>

      <QualityDrawer point={open} spec={s.spec} incidents={s.incidents} onClose={() => setOpen(null)} />
    </>
  );
}

function QualityDrawer({ point, spec, incidents, onClose }: { point: QualityPointOps | null; spec: RangeSpec; incidents: Incident[]; onClose: () => void }) {
  const navigate = useNavigate();
  const [m, setM] = useState<Metric>('turbidity');
  return (
    <Drawer open={!!point} onClose={onClose} kicker="Water-quality monitoring point" title={point?.name ?? ''}
      status={point && <><Status tone={point.tone} /><span className="dx-muted">{zoneName(point.zone)} · updated {point.updatedMin} min ago</span></>}
      footer={point && point.zone !== 'WTW' && <button className="dx-btn" onClick={() => navigate(`/network?focus=asset:TB-${point.zone}`)}>View on network</button>}>
      {point && (
        <>
          <Section title="Latest readings">
            <KV rows={QUALITY_METRICS.map(x => [`${METRICS[x].label} · ${METRICS[x].rangeText}`, <span key={x} className={point.tones[x] !== 'ok' ? `t-${point.tones[x]}` : ''}>{fmt(x, point.values[x])}</span>])} />
          </Section>
          <Section title={`History · ${spec.label}`} actions={<Segmented size="sm" options={QUALITY_METRICS.map(x => ({ key: x, label: METRICS[x].label.replace('Residual chlorine', 'Chlorine').replace('Conductivity', 'Cond.').replace('Temperature', 'Temp.') }))} value={m} onChange={setM} />}>
            <LineChart series={[{ id: point.id, label: point.name, points: series(m, point.id, point.base[m as keyof typeof point.base], spec) }]} metric={m} height={200} windows={windowsFor(m, [point.id])} />
          </Section>
          <Section title="Related alerts">
            <RelatedAlerts list={incidents.filter(i => i.entityId === point.id)} />
          </Section>
        </>
      )}
    </Drawer>
  );
}

/* ═════════════ Pressure ═════════════ */
function Pressure({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const s = useScoped(ops);
  const online = s.pressure.filter(p => p.online);
  const [selected, setSelected] = useState<string[]>([]);
  const day = rangeSpec('24H');

  const stats = useMemo(() => online.map(p => {
    const pts = series('pressure', p.id, p.base, s.spec);
    const vals = pts.map(x => x.v);
    return { p, min: Math.min(...vals), max: Math.max(...vals), minT: pts[vals.indexOf(Math.min(...vals))].t, maxT: pts[vals.indexOf(Math.max(...vals))].t };
  }), [online, s.spec]);

  const avg = online.length ? online.reduce((a, p) => a + p.value, 0) / online.length : 0;
  const zonesInScope = ops.zones.filter(z => inZone(z.code, s.zone));
  const lowZones = zonesInScope.filter(z => ops.pressure.some(p => p.zone === z.code && p.online && p.value < METRICS.pressure.normal[0]));
  const highZones = zonesInScope.filter(z => stats.some(x => x.p.zone === z.code && x.max > METRICS.pressure.normal[1]));
  const anomalies = s.incidents.filter(i => i.metric === 'pressure' || i.type === 'Possible leak');
  const activeAnoms = anomalies.filter(i => i.status !== 'resolved');

  const chart: ChartSeries[] = selected.length
    ? selected.map((id, i) => { const p = ops.pressure.find(x => x.id === id)!; return { id, label: `${p.id} · ${zoneName(p.zone)}`, points: series('pressure', p.id, p.base, s.spec), color: SERIES_COLORS[i % SERIES_COLORS.length] }; })
    : [{ id: 'avg', label: s.zone === 'ALL' ? 'Network average' : `${zoneName(s.zone)} average`, points: meanSeries(online.map(p => series('pressure', p.id, p.base, s.spec))) }];
  const toggle = (id: string) => setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id].slice(-5));
  const leak = activeAnoms.find(i => i.type === 'Possible leak');

  const cols: Column<typeof stats[number]>[] = [
    { key: 'cmp', label: 'Compare', render: r => <input type="checkbox" checked={selected.includes(r.p.id)} onChange={() => toggle(r.p.id)} onClick={e => e.stopPropagation()} aria-label={`Compare ${r.p.id}`} />, width: 64 },
    { key: 'id', label: 'Logger', render: r => <span className="strong">{r.p.id}</span>, sort: r => r.p.id },
    { key: 'zone', label: 'Zone', render: r => zoneName(r.p.zone), sort: r => zoneName(r.p.zone) },
    { key: 'cur', label: 'Current (bar)', align: 'right', render: r => <span className={r.p.tone !== 'ok' ? `t-${r.p.tone} strong` : ''}>{r.p.value.toFixed(2)}</span>, sort: r => r.p.value },
    { key: 'min', label: 'Min', align: 'right', render: r => r.min.toFixed(2), sort: r => r.min },
    { key: 'max', label: 'Max', align: 'right', render: r => r.max.toFixed(2), sort: r => r.max },
    { key: 'trend', label: '24 h', render: r => <Sparkline points={series('pressure', r.p.id, r.p.base, day)} tone={r.p.tone} width={80} height={20} /> },
    { key: 'flow', label: 'Flow (L/s)', align: 'right', render: r => r.p.flow.toFixed(1), sort: r => r.p.flow },
    { key: 'st', label: 'Status', render: r => <Status tone={r.p.tone} />, sort: r => -toneRank(r.p.tone) }
  ];

  return (
    <>
      <div className="dx-grid-kpi">
        <Kpi label={s.zone === 'ALL' ? 'Network average' : `${zoneName(s.zone)} average`} value={avg.toFixed(2)} unit="bar" tone={toneFor('pressure', avg)} sub={`${online.length} loggers reporting`} />
        <Kpi label="Normal range" value="1.5 – 4.2" unit="bar" sub="critical below 1.0 or above 5.0" />
        <Kpi label="Low-pressure zones" value={lowZones.length} tone={lowZones.length ? 'crit' : 'ok'} sub={lowZones.map(z => z.name).join(', ') || 'none right now'} />
        <Kpi label="High-pressure zones" value={highZones.length} tone={highZones.length ? 'warn' : 'ok'} sub={highZones.length ? `${highZones.map(z => z.name).join(', ')} · ${s.spec.label.toLowerCase()}` : 'none in range'} />
        <Kpi label="Pressure anomalies" value={activeAnoms.length} tone={activeAnoms.some(a => a.severity === 'critical') ? 'crit' : activeAnoms.length ? 'warn' : 'ok'} sub={`${anomalies.length - activeAnoms.length} cleared in the last 30 days`} onClick={() => navigate('/alerts')} />
      </div>

      {leak && (
        <Insight tone="crit">
          <span><b>Potential leak, {zoneName(leak.zone)}.</b> Pressure at SN-12 dropped by more than 2 bar while flow at the same logger rose. Neighbouring logger SN-24 is also low, which points to a main break rather than a sensor fault.{' '}
            <button className="dx-link" onClick={() => navigate(`/alerts?id=${leak.id}`)}>Open incident</button> · <button className="dx-link" onClick={() => navigate(`/network?focus=${leak.focus}`)}>View on network</button></span>
        </Insight>
      )}

      <Card title="Pressure over time" sub={`${selected.length ? `${selected.length} logger${selected.length > 1 ? 's' : ''} compared` : chart[0].label} · ${s.spec.label}. Shaded windows mark recorded anomalies.`}
        actions={selected.length ? <button className="dx-btn" onClick={() => setSelected([])}>Show average</button> : <span className="dx-muted">Tick loggers below to compare</span>}>
        <LineChart series={chart} metric="pressure" height={300} windows={windowsFor('pressure', selected.length ? selected : online.map(p => p.id))} />
        <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <ChartLegend items={[{ label: 'Acceptable range', color: '', band: true }, { label: 'Warning threshold', color: 'hsl(var(--warning))', dashed: true }, { label: 'Critical threshold', color: 'hsl(var(--danger))', dashed: true }]} />
          {selected.length > 0 && <ChartLegend items={chart.map(c => ({ label: c.label, color: c.color! }))} />}
        </div>
      </Card>

      <div className="dx-cols three">
        <Card title="Pressure by zone" sub="Current average">
          <BarList max={5} rows={zonesInScope.filter(z => ops.pressure.some(p => p.zone === z.code && p.online)).map(z => {
            const tone = worstTone(ops.pressure.filter(p => p.zone === z.code && p.online).map(p => p.tone));
            return { key: z.code, label: z.name, value: z.pressureAvg, display: `${z.pressureAvg.toFixed(2)} bar`, tone };
          }).sort((a, b) => a.value - b.value)} />
        </Card>
        <Card title="Lowest readings" sub={s.spec.label}>
          <div className="dx-rows">
            {[...stats].sort((a, b) => a.min - b.min).slice(0, 6).map(r => (
              <div key={r.p.id} className="dx-row"><Dot tone={toneFor('pressure', r.min)} /><span className="name">{r.p.id} · {zoneName(r.p.zone)}</span><span className="dx-muted">{clock(r.minT)}</span><span className="val">{r.min.toFixed(2)} bar</span></div>
            ))}
          </div>
        </Card>
        <Card title="Highest readings" sub={s.spec.label}>
          <div className="dx-rows">
            {[...stats].sort((a, b) => b.max - a.max).slice(0, 6).map(r => (
              <div key={r.p.id} className="dx-row"><Dot tone={toneFor('pressure', r.max)} /><span className="name">{r.p.id} · {zoneName(r.p.zone)}</span><span className="dx-muted">{clock(r.maxT)}</span><span className="val">{r.max.toFixed(2)} bar</span></div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Monitoring-point comparison" sub={`${s.pressure.length} pressure loggers · min/max over ${s.spec.label.toLowerCase()}`} flush>
        <DataTable columns={cols} rows={stats} rowKey={r => r.p.id} onRowClick={r => toggle(r.p.id)} defaultSort={{ key: 'st', dir: 1 }} />
      </Card>

      <Card title="Related alerts" sub="Pressure anomalies and possible leaks" flush>
        <DataTable columns={incidentCols()} rows={anomalies.sort((a, b) => b.startedAt - a.startedAt)} rowKey={i => i.id} onRowClick={i => navigate(`/alerts?id=${i.id}`)} />
      </Card>
    </>
  );
}

/* ═════════════ Tank levels ═════════════ */
function TankLevels({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const s = useScoped(ops);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [open, setOpen] = useState<TankOps | null>(null);
  if (!s.tanks.length) return <Card><p className="dx-muted">No reservoirs in this zone. All six reservoirs are in Riverside.</p></Card>;
  const shown = s.tanks.filter(t => !selected || selected.includes(t.id));
  const chart: ChartSeries[] = shown.map((t, i) => ({ id: t.id, label: t.name, points: series('level', t.id, t.base, s.spec), color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  const totalCap = s.tanks.reduce((a, t) => a + t.capacity, 0);
  const totalVol = s.tanks.reduce((a, t) => a + t.volume, 0);

  const cols: Column<TankOps>[] = [
    { key: 'n', label: 'Reservoir', render: t => <span className="strong">{t.name}</span>, sort: t => t.name },
    { key: 'z', label: 'Zone', render: t => zoneName(t.zone) },
    { key: 'l', label: 'Level', align: 'right', render: t => <span className={t.tone !== 'ok' ? `t-${t.tone} strong` : ''}>{Math.round(t.level)} %</span>, sort: t => t.level },
    { key: 'v', label: 'Volume (m³)', align: 'right', render: t => Math.round(t.volume).toLocaleString(), sort: t => t.volume },
    { key: 'c', label: 'Capacity (m³)', align: 'right', render: t => t.capacity.toLocaleString(), sort: t => t.capacity },
    { key: 'in', label: 'Inflow (L/s)', align: 'right', render: t => t.inflow.toFixed(1) },
    { key: 'out', label: 'Outflow (L/s)', align: 'right', render: t => t.outflow.toFixed(1) },
    { key: 'ch', label: 'Change 6 h', align: 'right', render: t => signed(t.change6h, 0) + ' pts', sort: t => t.change6h },
    { key: 'vy', label: 'vs same time yesterday', align: 'right', render: t => <span className={t.abnormal ? 't-warn strong' : 'dx-muted'}>{signed(t.vsYesterday, 0)} pts</span>, sort: t => t.vsYesterday },
    { key: 'ttl', label: 'Time to low level', align: 'right', render: t => t.level < 20 ? <span className="t-crit strong">At low level</span> : t.hoursToLow ? <span className="t-warn strong">{t.hoursToLow.toFixed(1)} h</span> : <span className="dx-muted">Normal pattern</span>, sort: t => t.hoursToLow ?? 999 },
    { key: 's', label: 'Status', render: t => <Status tone={t.tone} />, sort: t => -toneRank(t.tone) }
  ];

  return (
    <>
      <div className="dx-grid-kpi four">
        <Kpi label="Stored volume" value={Math.round(totalVol).toLocaleString()} unit="m³" sub={`of ${totalCap.toLocaleString()} m³ capacity`} />
        <Kpi label="Average level" value={Math.round((totalVol / totalCap) * 100)} unit="%" sub="volume-weighted" />
        <Kpi label="Below warning level" value={s.tanks.filter(t => t.level < 35).length} tone={s.tanks.some(t => t.level < 20) ? 'crit' : s.tanks.some(t => t.level < 35) ? 'warn' : 'ok'} sub="warning 35 % · low level 20 %" />
        <Kpi label="Abnormal drawdown" value={s.tanks.filter(t => t.abnormal).length} tone={s.tanks.some(t => t.abnormal) ? 'warn' : 'ok'} sub="falling faster than the same hours yesterday" />
      </div>

      <div className="dx-grid-kpi six">
        {s.tanks.map(t => (
          <button key={t.id} type="button" className="dx-kpi click" onClick={() => setOpen(t)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TankGauge level={t.level} tone={t.tone} />
            <div style={{ minWidth: 0 }}>
              <div className="dx-kpi-label"><Dot tone={t.tone} />{t.name}</div>
              <div className="dx-kpi-value" style={{ fontSize: '1.25rem' }}>{Math.round(t.level)}<span className="unit">%</span></div>
              <div className="dx-kpi-sub dx-muted" style={{ fontSize: '0.75rem' }}>{Math.round(t.volume).toLocaleString()} / {t.capacity.toLocaleString()} m³</div>
              <div style={{ fontSize: '0.75rem' }} className={t.abnormal ? 't-warn' : 'dx-muted'}>{t.abnormal ? `Draining ${Math.abs(t.vsYesterday).toFixed(0)} pts faster than usual` : `${signed(t.change6h, 0)} pts in 6 h · normal`}</div>
            </div>
          </button>
        ))}
      </div>

      <Card title="Tank level over time" sub={`${shown.length === s.tanks.length ? 'All reservoirs' : `${shown.length} selected`} · ${s.spec.label}. Night-time filling and daytime drawdown are visible on 24H and 7D.`}
        actions={<div className="dx-seg" role="group">
          <button className={!selected ? 'on' : ''} onClick={() => setSelected(null)}>All</button>
          {s.tanks.map(t => <button key={t.id} className={selected?.includes(t.id) ? 'on' : ''} onClick={() => setSelected(sel => { const cur = sel ?? []; const nx = cur.includes(t.id) ? cur.filter(x => x !== t.id) : [...cur, t.id]; return nx.length ? nx : null; })}>{t.name.replace('Reservoir ', 'R')}</button>)}
        </div>}>
        <LineChart series={chart} metric="level" height={300} band={null} yMin={0} />
        <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <ChartLegend items={chart.map(c => ({ label: c.label, color: c.color! }))} />
          <ChartLegend items={[{ label: 'Warning level (35 %)', color: 'hsl(var(--warning))', dashed: true }, { label: 'Low level (20 %)', color: 'hsl(var(--danger))', dashed: true }]} />
        </div>
      </Card>

      <Card title="Reservoirs" sub="Click a row for history and alerts" flush>
        <DataTable columns={cols} rows={s.tanks} rowKey={t => t.id} onRowClick={setOpen} selectedKey={open?.id} />
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} kicker="Reservoir" title={open?.name ?? ''}
        status={open && <><Status tone={open.tone} /><span className="dx-muted">{zoneName(open.zone)}</span></>}
        footer={open && <button className="dx-btn" onClick={() => navigate(`/network?focus=asset:${open.id}`)}>View on network</button>}>
        {open && (
          <>
            <KV rows={[
              ['Level', `${Math.round(open.level)} %`], ['Volume', `${Math.round(open.volume).toLocaleString()} m³`],
              ['Capacity', `${open.capacity.toLocaleString()} m³`], ['Change (6 h)', `${signed(open.change6h, 0)} pts`],
              ['vs same time yesterday', `${signed(open.vsYesterday, 0)} pts`], ['Inflow / outflow', `${open.inflow} / ${open.outflow} L/s`],
              ['Warning / low level', '35 % / 20 %'], ['Time to low level', open.level < 20 ? 'At low level' : open.hoursToLow ? `${open.hoursToLow.toFixed(1)} h` : 'Normal daily pattern']
            ]} />
            <Section title={`Level · ${s.spec.label}`}>
              <LineChart series={[{ id: open.id, label: open.name, points: series('level', open.id, open.base, s.spec) }]} metric="level" band={null} height={200} yMin={0} />
            </Section>
            <Section title="Related alerts"><RelatedAlerts list={s.incidents.filter(i => i.entityId === open.id)} /></Section>
          </>
        )}
      </Drawer>
    </>
  );
}

/* ═════════════ Sensors (device layer) ═════════════ */
function Sensors({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const s = useScoped(ops);
  const [kind, setKind] = useState('ALL');
  const [health, setHealth] = useState('ALL');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<SensorDevice | null>(null);
  const rows = s.sensors.filter(d =>
    (kind === 'ALL' || d.kind === kind) && (health === 'ALL' || d.health === health) &&
    (!q || `${d.id} ${d.name} ${zoneName(d.zone)}`.toLowerCase().includes(q.toLowerCase())));

  const cols: Column<SensorDevice>[] = [
    { key: 'id', label: 'Sensor', render: d => <span className="strong">{d.id}</span>, sort: d => d.id },
    { key: 'kind', label: 'Type', render: d => d.kind, sort: d => d.kind },
    { key: 'zone', label: 'Location', render: d => zoneName(d.zone), sort: d => zoneName(d.zone) },
    { key: 'm', label: 'Measures', render: d => <span className="dx-muted">{d.measures}</span> },
    { key: 'r', label: 'Current reading', render: d => d.reading, align: 'right' },
    { key: 'b', label: 'Battery', align: 'right', render: d => <span className={d.battery < 20 ? 't-warn strong' : ''}>{d.battery} %</span>, sort: d => d.battery },
    { key: 'sig', label: 'Signal', align: 'right', render: d => <span className={d.signal < -100 ? 't-warn strong' : ''}>{d.signal} dBm</span>, sort: d => d.signal },
    { key: 'lc', label: 'Last communication', render: d => <span className={d.health === 'off' ? 't-crit' : ''}>{minsAgo(d.lastCommMin)}</span>, sort: d => d.lastCommMin },
    { key: 'h', label: 'Status', render: d => <Status tone={d.health} label={d.health === 'ok' ? 'Online' : d.health === 'warn' ? 'Warning' : 'Offline'} />, sort: d => -toneRank(d.health) }
  ];

  return (
    <>
      <div className="dx-grid-kpi four">
        <Kpi label="Total sensors" value={s.sensors.length} sub={`${s.sensors.filter(d => d.kind === 'Pressure & flow').length} pressure · ${s.sensors.filter(d => d.kind === 'Tank level').length} level · ${s.sensors.filter(d => d.kind === 'Water quality').length} quality`} />
        <Kpi label="Online" tone="ok" value={s.sensors.filter(d => d.health === 'ok').length} onClick={() => setHealth('ok')} sub="reporting normally" />
        <Kpi label="Warning" tone="warn" value={s.sensors.filter(d => d.health === 'warn').length} onClick={() => setHealth('warn')} sub="low battery or weak signal" />
        <Kpi label="Offline" tone="off" value={s.sensors.filter(d => d.health === 'off').length} onClick={() => setHealth('off')} sub="no data received" />
      </div>
      <Card title="Devices" sub="The hardware layer that feeds Monitoring. Click a sensor for device details." flush>
        <div className="dx-filters">
          <SearchInput value={q} onChange={setQ} placeholder="Search sensor or location" />
          <Select label="Type" value={kind} onChange={setKind} options={[{ value: 'ALL', label: 'All types' }, { value: 'Pressure & flow', label: 'Pressure & flow' }, { value: 'Tank level', label: 'Tank level' }, { value: 'Water quality', label: 'Water quality' }]} />
          <Select label="Status" value={health} onChange={setHealth} options={[{ value: 'ALL', label: 'All' }, { value: 'ok', label: 'Online' }, { value: 'warn', label: 'Warning' }, { value: 'off', label: 'Offline' }]} />
          <span className="dx-muted" style={{ marginLeft: 'auto' }}>{rows.length} of {s.sensors.length}</span>
        </div>
        <DataTable columns={cols} rows={rows} rowKey={d => d.id} onRowClick={setOpen} selectedKey={open?.id} defaultSort={{ key: 'h', dir: 1 }} pageSize={15} />
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} kicker={open?.kind ?? 'Sensor'} title={open ? `${open.id} · ${open.name}` : ''}
        status={open && <><Status tone={open.health} label={open.health === 'ok' ? 'Online' : open.health === 'warn' ? 'Warning' : 'Offline'} /><span className="dx-muted">{open.healthNote}</span></>}
        footer={open && <button className="dx-btn" onClick={() => navigate(`/network?focus=asset:${open.kind === 'Water quality' ? (open.zone === 'WTW' ? '' : `TB-${open.zone}`) : open.kind === 'Tank level' ? open.entityId : open.id}`)}>View on network</button>}>
        {open && <SensorDetail d={open} spec={s.spec} incidents={s.incidents} />}
      </Drawer>
    </>
  );
}

function SensorDetail({ d, spec, incidents }: { d: SensorDevice; spec: RangeSpec; incidents: Incident[] }) {
  // connectivity: messages per hour over the last 24 h
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hAgo = 23 - i;
    const down = d.health === 'off' && hAgo * 60 < d.lastCommMin;
    const weak = d.health === 'warn' && d.signal < -100 && (hAgo % 5 === 1);
    return { hAgo, msgs: down ? 0 : weak ? 2 : 4 };
  });
  return (
    <>
      <Section title="Device">
        <KV rows={[
          ['Type', d.kind], ['Measures', d.measures], ['Location', zoneName(d.zone)], ['Coordinates', `${d.pos[0].toFixed(4)}, ${d.pos[1].toFixed(4)}`],
          ['Battery', `${d.battery} %`], ['Signal', `${d.signal} dBm`], ['Last communication', minsAgo(d.lastCommMin)], ['Installed', String(d.installed)]
        ]} />
      </Section>
      <Section title="Current reading"><p style={{ fontSize: '1rem', fontWeight: 600 }}>{d.reading}</p></Section>
      <Section title={`Reading history · ${METRICS[d.metric].label} · ${spec.label}`}>
        <LineChart series={[{ id: d.id, label: METRICS[d.metric].label, points: series(d.metric, d.entityId, d.base, spec).filter(p => d.health !== 'off' || p.t <= NOW - d.lastCommMin * 60_000) }]} metric={d.metric} band={d.metric === 'level' ? null : undefined} height={190} />
        {d.health === 'off' && <p className="dx-muted" style={{ fontSize: '0.75rem', marginTop: 6 }}>No readings since {minsAgo(d.lastCommMin)}.</p>}
      </Section>
      <Section title="Connectivity · messages per hour, last 24 h">
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 40 }}>
          {hours.map(h => <span key={h.hAgo} title={`${h.hAgo} h ago: ${h.msgs} messages`} style={{ flex: 1, height: `${(h.msgs / 4) * 100 || 6}%`, background: h.msgs === 0 ? TONE_COLOR.crit : h.msgs < 4 ? TONE_COLOR.warn : 'hsl(var(--primary) / 0.7)', borderRadius: 1 }} />)}
        </div>
        <div className="dx-legend" style={{ justifyContent: 'space-between', marginTop: 4 }}><span>24 h ago</span><span>now</span></div>
      </Section>
      <Section title="Related alerts"><RelatedAlerts list={incidents.filter(i => i.entityId === d.entityId || i.location.includes(d.id))} /></Section>
    </>
  );
}

/* ═════════════ shared ═════════════ */
function incidentCols(): Column<Incident>[] {
  return [
    { key: 'sev', label: 'Severity', render: i => <span className={`dx-sev ${i.severity}`}>{i.severity}</span>, sort: i => sevRank(i.severity), width: 90 },
    { key: 't', label: 'Event', render: i => <span className="strong">{i.title}</span> },
    { key: 'tr', label: 'Measurement', render: i => <span className="dx-muted">{i.trigger}</span> },
    { key: 'st', label: 'Started', render: i => clock(i.startedAt), sort: i => -i.startedAt },
    { key: 'du', label: 'Duration', render: i => duration((i.resolvedAt ?? NOW) - i.startedAt), sort: i => (i.resolvedAt ?? NOW) - i.startedAt },
    { key: 's', label: 'Status', render: i => <Status tone={i.status === 'resolved' ? 'ok' : i.severity === 'critical' ? 'crit' : 'warn'} label={i.status === 'resolved' ? 'Cleared' : 'Open'} /> }
  ];
}
export function duration(ms: number): ReactNode {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
}
const sevRank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
const toneRank = (t: Tone) => ['ok', 'off', 'warn', 'crit'].indexOf(t);
function firstBad(q: QualityPointOps): Metric {
  return (QUALITY_METRICS.find(m => q.tones[m] === 'crit') ?? QUALITY_METRICS.find(m => q.tones[m] === 'warn') ?? 'turbidity');
}

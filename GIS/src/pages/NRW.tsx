/**
 * NRW — non-revenue water outcome dashboard.
 * Built to answer: where should the utility investigate first?
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { useOps, type Ops, type ZoneOps } from '../demo/model';
import { useFilters } from '../demo/filters';
import { withState, useIncidentState } from '../demo/incidentState';
import { leaks } from '../data';
import { Card, Kpi, Status, Dot, DataTable, Loading, Insight, Segmented, type Column } from '../demo/ui';
import { LineChart, ChartLegend, BarList, StackedColumns, SERIES_COLORS, TONE_COLOR } from '../demo/charts';
import { NetworkMap, type MapPoint } from '../demo/NetworkMap';
import { NOW, HOURS, type Tone } from '../demo/series';

const nrwTone = (v: number): Tone => (v >= 35 ? 'crit' : v >= 25 ? 'warn' : 'ok');
const ZONE_HEX: Record<Tone, string> = { crit: '#E5484D', warn: '#E59A17', ok: '#16A66A', off: '#98A2B3' };

export default function NRW() {
  const ops = useOps();
  return (
    <Shell active="nrw" title="Non-revenue water" sub="Water supplied but not billed · where to investigate first" filters={{ zone: true }}>
      {ops ? <NrwBody ops={ops} /> : <Loading />}
    </Shell>
  );
}

function NrwBody({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const { zone, setZone } = useFilters();
  const [months, setMonths] = useState<'6' | '12'>('12');
  const incidents = withState(ops.incidents);
  const z = zone === 'ALL' ? null : ops.zones.find(x => x.code === zone)!;

  const supplied = z ? z.suppliedM3d : ops.nrw.supplied;
  const billed = z ? z.billedM3d : ops.nrw.billed;
  const loss = z ? z.lossM3d : ops.nrw.loss;
  const cur = z ? z.nrw : ops.nrw.current;
  const prev = z ? z.nrwPrev : ops.nrw.prev;
  const hist = ops.nrwMonthly.slice(months === '6' ? -6 : -12);

  const anomalies30 = (code: string) => incidents.filter(i => i.zone === code && (i.metric === 'pressure' || i.type === 'Possible leak') && NOW - i.startedAt < 30 * 24 * HOURS).length;
  const ranked = [...ops.zones].sort((a, b) => priority(b, anomalies30(b.code)) - priority(a, anomalies30(a.code)));
  const top = ranked[0];

  const overTime = [
    { id: 'all', label: 'Utility', points: hist.map(m => ({ t: m.t, v: m.nrw })), color: SERIES_COLORS[0] },
    ...(z ? [{ id: z.code, label: z.name, points: hist.map(m => ({ t: m.t, v: m.byZone[z.code] })), color: SERIES_COLORS[2] }] : [])
  ];

  const zoneColor = useMemo(() => (code: string) => {
    const zz = ops.zones.find(x => x.code === code);
    return zz ? ZONE_HEX[nrwTone(zz.nrw)] : '#98A2B3';
  }, [ops]);
  const suspected: MapPoint[] = [
    ...incidents.filter(i => i.type === 'Possible leak' && i.status !== 'resolved').flatMap((i): MapPoint[] => {
      const p = ops.pressure.find(x => x.id === i.entityId);
      return p ? [{ id: `/alerts?id=${i.id}`, pos: p.pos, tone: 'crit', label: i.title, size: 14 }] : [];
    }),
    ...leaks.filter(l => l.status !== 'fixed').map(l => ({ id: `/network?focus=leak:${l.id}`, pos: [l.lat, l.lng] as [number, number], tone: 'warn' as Tone, label: `Customer leak report ${l.id} · ${l.address}`, shape: 'diamond' as const, size: 12 }))
  ];

  const cols: Column<ZoneOps>[] = [
    { key: 'r', label: '#', width: 40, render: zz => ranked.indexOf(zz) + 1 },
    { key: 'n', label: 'Zone / DMA', render: zz => <span className="strong">{zz.name}</span>, sort: zz => zz.name },
    { key: 'nrw', label: 'NRW', align: 'right', render: zz => <span className={`strong t-${nrwTone(zz.nrw)}`}>{zz.nrw.toFixed(1)} %</span>, sort: zz => zz.nrw },
    { key: 'd', label: 'Change', align: 'right', render: zz => <span className={zz.nrw > zz.nrwPrev ? 't-crit' : 't-ok'}>{zz.nrw > zz.nrwPrev ? '▲' : '▼'} {Math.abs(zz.nrw - zz.nrwPrev).toFixed(1)} pts</span>, sort: zz => zz.nrw - zz.nrwPrev },
    { key: 's', label: 'Supplied (m³/d)', align: 'right', render: zz => zz.suppliedM3d.toLocaleString(), sort: zz => zz.suppliedM3d },
    { key: 'b', label: 'Billed (m³/d)', align: 'right', render: zz => zz.billedM3d.toLocaleString(), sort: zz => zz.billedM3d },
    { key: 'l', label: 'Est. loss (m³/d)', align: 'right', render: zz => <span className="strong">{zz.lossM3d.toLocaleString()}</span>, sort: zz => zz.lossM3d },
    { key: 'a', label: 'Anomalies · 30 d', align: 'right', render: zz => anomalies30(zz.code), sort: zz => anomalies30(zz.code) },
    { key: 'p', label: 'Priority', render: zz => { const i = ranked.indexOf(zz); return <Status tone={i < 2 ? 'crit' : i < 4 ? 'warn' : 'ok'} label={i < 2 ? 'Investigate first' : i < 4 ? 'Monitor' : 'Performing well'} />; } }
  ];

  return (
    <div className="dx">
      <div className="dx-grid-kpi">
        <Kpi label={z ? `NRW · ${z.name}` : 'Current NRW'} tone={nrwTone(cur)} value={cur.toFixed(1)} unit="%" sub="this month" />
        <Kpi label="Water supplied" value={supplied.toLocaleString()} unit="m³/day" sub="system input volume" />
        <Kpi label="Billed consumption" value={billed.toLocaleString()} unit="m³/day" sub="authorised, billed" />
        <Kpi label="Estimated water loss" value={loss.toLocaleString()} unit="m³/day" tone={nrwTone(cur)} sub={`≈ ${Math.round(loss * 30 / 1000).toLocaleString()} ML per month`} />
        <Kpi label="Change from last month" value={`${cur > prev ? '+' : '−'}${Math.abs(cur - prev).toFixed(1)}`} unit="pts" delta={{ text: cur < prev ? 'Improving' : 'Worsening', good: cur < prev }} sub={`was ${prev.toFixed(1)} %`} />
      </div>

      <div className="dx-cols">
        <Insight tone="crit"><span><b>{top.name} should be investigated first.</b> It has the highest estimated loss ({top.lossM3d.toLocaleString()} m³/day, {top.nrw.toFixed(1)} %), NRW rose {Math.abs(top.nrw - top.nrwPrev).toFixed(1)} pts this month, and it recorded {anomalies30(top.code)} pressure anomalies in the last 30 days.</span></Insight>
        <Insight tone="warn"><span><b>Northgate has an active suspected leak.</b> The pressure drop at SN-12 and a matching customer report put the likely location on the Kingsway main. <button className="dx-link" onClick={() => navigate('/alerts?id=INC-2317')}>Open incident</button></span></Insight>
      </div>

      <div className="dx-cols main-side">
        <Card title="NRW over time" sub={`Monthly NRW %${z ? `, ${z.name} against the utility` : ''}`}
          actions={<Segmented size="sm" value={months} onChange={setMonths} options={[{ key: '6', label: '6 months' }, { key: '12', label: '12 months' }]} />}>
          <LineChart series={overTime} height={260} band={null} format={v => `${v.toFixed(1)} %`} />
          <div style={{ marginTop: 8 }}><ChartLegend items={overTime.map(s => ({ label: s.label, color: s.color }))} /></div>
        </Card>
        <Card title="NRW by zone" sub="Highest loss first · click to focus">
          <BarList max={50} onRowClick={code => setZone(code)}
            rows={[...ops.zones].sort((a, b) => b.nrw - a.nrw).map(zz => ({
              key: zz.code, label: <><Dot tone={nrwTone(zz.nrw)} /> {zz.name}</>, value: zz.nrw, display: `${zz.nrw.toFixed(1)} %`, tone: nrwTone(zz.nrw),
              sub: `${zz.lossM3d.toLocaleString()} m³/day lost · ${zz.nrw > zz.nrwPrev ? 'rising' : 'falling'}`
            }))} />
        </Card>
      </div>

      <div className="dx-cols main-side">
        <Card title="High-loss zones and suspected leaks" sub="Pipes coloured by zone NRW. Markers are open leak incidents and customer leak reports." flush>
          <NetworkMap ops={ops} points={suspected} zone={zone} zoneColor={zoneColor} height={380} onSelect={id => navigate(id)} />
          <div className="dx-map-legend">
            <span><i style={{ width: 14, height: 3, background: ZONE_HEX.crit, display: 'inline-block' }} />NRW ≥ 35 %</span>
            <span><i style={{ width: 14, height: 3, background: ZONE_HEX.warn, display: 'inline-block' }} />25 – 35 %</span>
            <span><i style={{ width: 14, height: 3, background: ZONE_HEX.ok, display: 'inline-block' }} />&lt; 25 %</span>
            <span style={{ marginLeft: 'auto' }}>● Leak incident · ◆ Customer report</span>
          </div>
        </Card>
        <Card title="Water balance" sub="Monthly volume, billed vs lost (m³)">
          <StackedColumns height={300} data={hist.map(m => ({ label: m.month, values: [m.billed, m.supplied - m.billed] }))}
            keys={[{ label: 'Billed', color: 'hsl(var(--primary))' }, { label: 'Lost (NRW)', color: TONE_COLOR.warn }]} />
          <div style={{ marginTop: 8 }}><ChartLegend items={[{ label: 'Billed consumption', color: 'hsl(var(--primary))' }, { label: 'Non-revenue water', color: 'hsl(var(--warning))' }]} /></div>
        </Card>
      </div>

      <Card title="Zone ranking" sub="Ordered by investigation priority: loss volume, NRW trend and recent anomalies" flush>
        <DataTable columns={cols} rows={ranked} rowKey={zz => zz.code} />
      </Card>
      <p className="dx-muted" style={{ fontSize: '0.75rem' }}>NRW = (system input volume − billed authorised consumption) ÷ system input volume, per zone / DMA.</p>
    </div>
  );
}

function priority(z: ZoneOps, anomalies: number) {
  return z.lossM3d / 1000 + (z.nrw > z.nrwPrev ? 2 : 0) + anomalies * 0.6;
}

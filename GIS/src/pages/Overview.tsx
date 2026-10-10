/**
 * Overview — utility command centre (Tremor-style).
 * "What is happening across my utility right now?" Meaning first, raw readings second.
 * Every sparkline is computed from the same series as the numbers beside it.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { useOps, ago, zoneName, type Ops, type Incident, type IncidentType } from '../demo/model';
import { useFilters, inZone } from '../demo/filters';
import { withState, useIncidentState } from '../demo/incidentState';
import { Card, Kpi, Dot, Loading, IconTile, ICON, BadgeDelta, Segmented, type IconTone } from '../demo/ui';
import { LineChart, SparkArea, SparkBars, Donut, BarChart } from '../demo/charts';
import { NetworkMap, type MapPoint } from '../demo/NetworkMap';
import { series, rangeSpec, meanSeries, sampleAt, toneFor, worstTone, fmt, METRICS, QUALITY_METRICS, NOW, HOURS, type Tone, type Point } from '../demo/series';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Overview() {
  const ops = useOps();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Shell active="overview" title="Overview" greeting={greeting()} sub="Here’s what’s happening across your water network today."
      filters={{ zone: true }}
      headRight={<div className="ov-today"><span>{today}</span><b><i />All zones reporting · 15-min readings</b></div>}>
      {ops ? <OverviewBody ops={ops} /> : <Loading />}
    </Shell>
  );
}

const TYPE_ICON: Record<IncidentType, JSX.Element> = {
  'Pressure anomaly': ICON.alert,
  'Water quality breach': ICON.drop,
  'Low tank level': ICON.tank
};
const sevTone = (i: Incident): IconTone => (i.severity === 'critical' ? 'crit' : i.severity === 'warning' ? 'warn' : 'off');

function OverviewBody({ ops }: { ops: Ops }) {
  const { zone } = useFilters();
  const navigate = useNavigate();
  useIncidentState();
  const day = rangeSpec('24H');
  const [mapStatus, setMapStatus] = useState<'all' | 'issues'>('all');

  const incidents = withState(ops.incidents).filter(i => inZone(i.zone, zone));
  const active = incidents.filter(i => i.status === 'active');
  const open = incidents.filter(i => i.status !== 'resolved')
    .sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || b.startedAt - a.startedAt);
  const pressure = ops.pressure.filter(p => inZone(p.zone, zone));
  const tanks = ops.tanks.filter(t => inZone(t.zone, zone));
  const quality = ops.quality.filter(q => zone === 'ALL' || q.zone === zone);
  const sensors = ops.sensors.filter(s => inZone(s.zone, zone));
  const z = zone === 'ALL' ? null : ops.zones.find(x => x.code === zone)!;

  /* ── KPI series (hourly, last 24 h) ── */
  const k = useMemo(() => {
    const times = Array.from({ length: 25 }, (_, i) => NOW - (24 - i) * HOURS);
    const healthPts: Point[] = times.map(t => {
      const tones: Tone[] = [
        ...pressure.filter(p => p.online).map(p => toneFor('pressure', sampleAt('pressure', p.id, p.base, t))),
        ...tanks.map(tk => toneFor('level', sampleAt('level', tk.id, tk.base, t))),
        ...quality.map(q => worstTone(QUALITY_METRICS.map(m => toneFor(m, sampleAt(m, q.id, q.base[m as keyof typeof q.base], t)))))
      ];
      return { t, v: (tones.filter(x => x === 'ok').length / Math.max(1, tones.length)) * 100 };
    });
    const qPts: Point[] = times.map(t => {
      const tones = quality.flatMap(q => QUALITY_METRICS.map(m => toneFor(m, sampleAt(m, q.id, q.base[m as keyof typeof q.base], t))));
      return { t, v: (tones.filter(x => x === 'ok').length / Math.max(1, tones.length)) * 100 };
    });
    const alertsPerDay = Array.from({ length: 7 }, (_, i) => {
      const from = NOW - (7 - i) * 24 * HOURS; const to = from + 24 * HOURS;
      return incidents.filter(x => x.startedAt >= from && x.startedAt < to).length;
    });
    const sensorsOnline = Array.from({ length: 24 }, (_, i) => {
      const minsAgo = (23 - i) * 60;
      return sensors.filter(s => s.health !== 'off' || minsAgo >= s.lastCommMin).length;
    });
    return { healthPts, qPts, alertsPerDay, sensorsOnline };
  }, [pressure, tanks, quality, incidents, sensors]);

  const health = Math.round(k.healthPts[k.healthPts.length - 1].v);
  const health24 = Math.round(k.healthPts[0].v);
  const qNow = k.qPts[k.qPts.length - 1].v;
  const qBad = quality.filter(q => q.tone !== 'ok');
  const online = sensors.filter(s => s.health !== 'off').length;
  const raisedToday = k.alertsPerDay[6];
  const avgPts = meanSeries(pressure.filter(p => p.online).map(p => series('pressure', p.id, p.base, day)));
  const avgP = avgPts[avgPts.length - 1]?.v ?? 0;
  const avgP24 = avgPts[0]?.v ?? 0;

  const mapPoints: MapPoint[] = useMemo(() => [
    ...pressure.map(p => ({ id: `asset:${p.id}`, pos: p.pos, tone: p.tone, label: `${p.id} · ${p.online ? fmt('pressure', p.value) : 'offline'}`, size: 11 })),
    ...tanks.map(t => ({ id: `asset:${t.id}`, pos: t.pos, tone: t.tone, label: `${t.name} · ${Math.round(t.level)} %`, shape: 'square' as const, size: 14 })),
    ...quality.filter(q => q.zone !== 'WTW').map(q => ({ id: `asset:TB-${q.zone}`, pos: q.pos, tone: q.tone, label: `${q.name} · water quality`, shape: 'diamond' as const, size: 14 }))
  ].filter(p => mapStatus === 'all' || p.tone !== 'ok'), [pressure, tanks, quality, mapStatus]);

  /* ── bottom cards ── */
  const wq = [...quality].sort((a, b) => toneRank(b.tone) - toneRank(a.tone))[0];
  const pz = z ?? ops.zones.find(x => x.code === 'ZIWANI3')!;
  const pzLoggers = ops.pressure.filter(p => p.zone === pz.code && p.online);
  const pSeries = meanSeries(pzLoggers.map(p => series('pressure', p.id, p.base, day)));
  const pNow = pSeries[pSeries.length - 1]?.v ?? 0; const pThen = pSeries[0]?.v ?? 0;
  const flowLoggers = useMemo(() => pressure.filter(p => p.online), [pressure]);
  const flowHourly: Point[] = useMemo(() => {
    const s = flowLoggers.map(p => series('flow', p.id, p.flowBase, rangeSpec('24H')));
    if (!s.length) return [];
    return s[0].map((pt, i) => ({ t: pt.t, v: s.reduce((acc, l) => acc + l[i].v, 0) })).filter((_, i) => i % 4 === 0);
  }, [flowLoggers]);
  const flowNow = flowHourly[flowHourly.length - 1]?.v ?? 0;
  const flowAvg = flowHourly.reduce((a, p) => a + p.v, 0) / Math.max(1, flowHourly.length);
  const totalCap = tanks.reduce((a, t) => a + t.capacity, 0);
  const storagePts: Point[] = useMemo(() => {
    if (!tanks.length) return [];
    const per = tanks.map(t => series('level', t.id, t.base, rangeSpec('24H')).map(p => ({ t: p.t, v: (p.v / 100) * t.capacity })));
    return per[0].map((p, i) => ({ t: p.t, v: (per.reduce((a, l) => a + l[i].v, 0) / totalCap) * 100 }));
  }, [tanks, totalCap]);
  const storNow = storagePts[storagePts.length - 1]?.v ?? 0;

  return (
    <div className="dx">
      <div className="dx-grid-kpi">
        <Kpi label="Network health" icon={ICON.pulse} iconTone="blue" value={health} unit="%"
          delta={{ text: `${Math.abs(health - health24)} pts`, good: health >= health24, up: health >= health24 }} sub="vs 24 h ago"
          chart={<SparkArea points={k.healthPts} tone="blue" width={96} />} onClick={() => navigate('/monitoring')} />
        <Kpi label="Active alerts" icon={ICON.alert} iconTone={active.some(a => a.severity === 'critical') ? 'crit' : 'warn'} value={active.length}
          sub={`${raisedToday} raised in the last 24 h`}
          chart={<SparkBars values={k.alertsPerDay} tone="crit" width={80} highlightLast />} onClick={() => navigate('/alerts')} />
        <Kpi label="Water quality" icon={ICON.drop} iconTone="blue"
          value={<span className="ov-q">{qBad.length ? 'Attention' : 'Good'}<Dot tone={qBad.length ? 'warn' : 'ok'} /></span>}
          sub={`${qNow.toFixed(0)} % of readings within range`}
          chart={<SparkArea points={k.qPts} tone="blue" width={96} />} onClick={() => navigate('/monitoring/water-quality')} />
        <Kpi label="Average pressure" icon={ICON.gauge} value={avgP.toFixed(2)} unit="bar"
          delta={{ text: `${Math.abs(avgP - avgP24).toFixed(2)} bar`, good: avgP >= avgP24, up: avgP >= avgP24 }} sub="vs 24 h ago"
          chart={<SparkArea points={avgPts} tone="blue" width={96} />} onClick={() => navigate('/monitoring/pressure')} />
        <Kpi label="Sensors online" icon={ICON.signal} iconTone="ok" value={online} unit={`/ ${sensors.length}`}
          sub={`${Math.round((online / Math.max(1, sensors.length)) * 100)} % online`}
          chart={<SparkBars values={k.sensorsOnline.map(v => v - Math.min(...k.sensorsOnline) + 1)} tone="ok" width={80} />} onClick={() => navigate('/monitoring/sensors')} />
      </div>

      <div className="dx-cols main-side">
        <Card title="Network map" sub={z ? `${z.name} · ${z.lengthKm.toFixed(0)} km of pipe` : `Real-time view of ${ops.network.meta.total_length_km.toFixed(0)} km of pipe across ${ops.zones.length} zones`}
          actions={<>
            <Segmented size="sm" value={mapStatus} onChange={setMapStatus} options={[{ key: 'all', label: 'All points' }, { key: 'issues', label: 'Issues only' }]} />
            <Link className="dx-btn" to="/network">Open map</Link>
          </>} flush>
          <NetworkMap ops={ops} points={mapPoints} zone={zone} height={420} onSelect={id => navigate(`/network?focus=${id}`)} />
          <div className="dx-map-legend">
            <span><i className="ov-lg pipe main" />Transmission</span><span><i className="ov-lg pipe" />Distribution</span><span><i className="ov-lg sq" />Reservoirs</span><span><i className="ov-lg dia" />Water quality</span>
            <span style={{ marginLeft: 'auto' }}><Dot tone="ok" />Normal</span><span><Dot tone="warn" />Warning</span><span><Dot tone="crit" />Critical</span><span><Dot tone="off" />Offline</span>
          </div>
        </Card>

        <Card title="Needs attention" sub={`${open.length} open issue${open.length === 1 ? '' : 's'}, highest priority first`}
          actions={<Link className="dx-link" to="/alerts">View all →</Link>} flush>
          <div className="dx-list">
            {open.slice(0, 6).map(i => (
              <button key={i.id} type="button" className="dx-item" onClick={() => navigate(`/alerts?id=${i.id}`)}>
                <IconTile icon={TYPE_ICON[i.type]} tone={sevTone(i)} size={36} />
                <div className="dx-item-main">
                  <div className="dx-item-title">{i.title.split(' — ')[0]}</div>
                  <div className="dx-item-sub">{zoneName(i.zone)} · {i.location.split(' · ')[0]}</div>
                </div>
                <div className="dx-item-val">
                  <b>{headline(i)}</b>
                  <span>{ago(i.startedAt)}</span>
                </div>
                <span className="dx-item-chev">{ICON.chevron}</span>
              </button>
            ))}
            {!open.length && <div className="dx-item"><div className="dx-item-main dx-muted">Nothing needs attention in this zone.</div></div>}
          </div>
        </Card>
      </div>

      <div className="ov-five">
        <Card title="Water quality" sub={wq ? wq.name : '—'} actions={<Link className="dx-link" to="/monitoring/water-quality">View all →</Link>}>
          {wq && (
            <>
              <div className="dx-rows">
                {QUALITY_METRICS.map(m => (
                  <div key={m} className="dx-row">
                    <span className="name">{METRICS[m].label.replace('Residual chlorine', 'Chlorine')}</span>
                    <span className={`val ${wq.tones[m] !== 'ok' ? `t-${wq.tones[m]}` : ''}`}>{fmt(m, wq.values[m])}</span>
                    <Dot tone={wq.tones[m]!} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}><SparkArea points={series('turbidity', wq.id, wq.base.turbidity, day)} tone={wq.tones.turbidity === 'ok' ? 'blue' : wq.tones.turbidity} width={260} height={44} fluid /></div>
            </>
          )}
        </Card>

        <Card title="Pressure" sub={`${pz.name} · ${pzLoggers.length} loggers`} actions={<Link className="dx-link" to="/monitoring/pressure">View all →</Link>}>
          <div className="ov-big">
            <b className={toneFor('pressure', pNow) !== 'ok' ? `t-${toneFor('pressure', pNow)}` : ''}>{pNow.toFixed(2)}<small>bar</small></b>
            <BadgeDelta text={`${Math.abs(((pNow - pThen) / (pThen || 1)) * 100).toFixed(0)} %`} good={pNow >= pThen} up={pNow >= pThen} />
          </div>
          <p className="dx-muted ov-note">Normal range {METRICS.pressure.rangeText}</p>
          <LineChart series={[{ id: 'p', label: 'Average pressure', points: pSeries }]} metric="pressure" height={170} />
        </Card>

        <Card title="Flow" sub={`${flowLoggers.length} loggers, hourly`} actions={<Link className="dx-link" to="/monitoring/pressure">View all →</Link>}>
          <div className="ov-big">
            <b>{flowNow.toFixed(0)}<small>L/s</small></b>
            <BadgeDelta text={`${Math.abs(((flowNow - flowAvg) / (flowAvg || 1)) * 100).toFixed(0)} %`} good up={flowNow >= flowAvg} />
          </div>
          <p className="dx-muted ov-note">vs 24-hour average {flowAvg.toFixed(0)} L/s</p>
          {flowHourly.length > 0 && <BarChart points={flowHourly} height={170} format={v => v.toFixed(0)} />}
        </Card>

        <Card title="Tank levels" sub={`${tanks.length} reservoirs, combined`} actions={<Link className="dx-link" to="/monitoring/tank-levels">View all →</Link>}>
          {tanks.length ? (
            <>
              <div className="ov-big"><b>{Math.round(storNow)}<small>%</small></b></div>
              <p className="dx-muted ov-note">{Math.round(tanks.reduce((a, t) => a + t.volume, 0)).toLocaleString()} m³ of {totalCap.toLocaleString()} m³</p>
              <LineChart series={[{ id: 's', label: 'Combined storage', points: storagePts }]} metric="level" band={null} height={170} yMin={0} format={v => `${v.toFixed(0)} %`} />
            </>
          ) : <p className="dx-muted">No reservoirs in this zone.</p>}
        </Card>

      </div>
    </div>
  );
}

function headline(i: Incident): string {
  const m = /([−-]?[\d.,]+\s*(?:bar|NTU|mg\/L|%|L\/s|dBm))/.exec(i.trigger);
  return m ? m[1].trim() : i.type;
}
const sevRank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
const toneRank = (t: Tone) => ['ok', 'off', 'warn', 'crit'].indexOf(t);

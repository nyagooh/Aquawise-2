/**
 * Reports — outputs of everything AquaWise monitors.
 * Flow: choose report → date range → zone → points/parameters → generate → preview → export.
 */
import { useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import { useOps, clock, zoneName, ZONE_CODES, type Ops } from '../demo/model';
import { useFilters, inZone } from '../demo/filters';
import { withState } from '../demo/incidentState';
import { Card, Kpi, Select, DataTable, Loading, Status, type Column } from '../demo/ui';
import { LineChart } from '../demo/charts';
import { series, rangeSpec, meanSeries, toneFor, METRICS, QUALITY_METRICS, NOW, HOURS, type Metric, type RangeSpec } from '../demo/series';

type ReportType = 'quality' | 'nrw' | 'network' | 'pressure' | 'tanks' | 'incidents' | 'assets';
const REPORTS: Array<{ key: ReportType; title: string; desc: string; points?: 'quality' | 'pressure' | 'tanks' }> = [
  { key: 'quality',   title: 'Water Quality Report', desc: 'Compliance by monitoring point and parameter', points: 'quality' },
  { key: 'nrw',       title: 'NRW Report', desc: 'Water balance and losses by zone' },
  { key: 'network',   title: 'Network Performance Report', desc: 'Pressure, quality, incidents and NRW per zone' },
  { key: 'pressure',  title: 'Pressure Report', desc: 'Min / average / max and time below range per logger', points: 'pressure' },
  { key: 'tanks',     title: 'Tank Level Report', desc: 'Reservoir levels and time below threshold', points: 'tanks' },
  { key: 'incidents', title: 'Alerts & Incidents Report', desc: 'Every incident raised in the period' },
  { key: 'assets',    title: 'Asset Health Report', desc: 'Pipe material, age and condition' }
];

interface Generated {
  id: string; type: ReportType; title: string; period: string; zone: string; at: number;
  kpis: Array<[string, string]>; columns: string[]; rows: Array<Array<string | number>>;
  chart?: { metric: Metric; label: string; points: Array<{ t: number; v: number }> };
}

const RECENT_SEED = [
  { id: 'RPT-0412', title: 'NRW Report', period: 'Last month', zone: 'All zones', by: 'J. Mwangi', at: NOW - 3 * 24 * HOURS },
  { id: 'RPT-0411', title: 'Water Quality Report', period: 'Last 30 days', zone: 'All zones', by: 'Scheduled', at: NOW - 6 * 24 * HOURS },
  { id: 'RPT-0409', title: 'Pressure Report', period: 'Last 7 days', zone: 'Northgate', by: 'A. Otieno', at: NOW - 9 * 24 * HOURS },
  { id: 'RPT-0405', title: 'Alerts & Incidents Report', period: 'Last 30 days', zone: 'All zones', by: 'Scheduled', at: NOW - 13 * 24 * HOURS }
];
const SCHEDULED = [
  { name: 'Water Quality Report', freq: 'Weekly · Monday 07:00', to: 'Quality team, Regulator liaison', next: 'Monday' },
  { name: 'NRW Report', freq: 'Monthly · 1st, 08:00', to: 'Management', next: '1st of next month' },
  { name: 'Alerts & Incidents Report', freq: 'Daily · 06:00', to: 'Operations', next: 'Tomorrow 06:00' }
];

export default function Reports() {
  const ops = useOps();
  return (
    <Shell active="reports" title="Reports" sub="Generate, preview and export reports from monitored data">
      {ops ? <ReportsBody ops={ops} /> : <Loading />}
    </Shell>
  );
}

function ReportsBody({ ops }: { ops: Ops }) {
  const g = useFilters();
  const [type, setType] = useState<ReportType>('quality');
  const [days, setDays] = useState('30');
  const [zone, setZone] = useState(g.zone);
  const [params, setParams] = useState<Metric[]>(['turbidity', 'ph', 'chlorine']);
  const [points, setPoints] = useState<string[] | null>(null);
  const [report, setReport] = useState<Generated | null>(null);
  const [recent, setRecent] = useState(RECENT_SEED);
  const def = REPORTS.find(r => r.key === type)!;

  const pointOptions = useMemo(() => {
    if (def.points === 'quality') return ops.quality.filter(q => zone === 'ALL' || q.zone === zone).map(q => ({ id: q.id, label: q.name }));
    if (def.points === 'pressure') return ops.pressure.filter(p => inZone(p.zone, zone)).map(p => ({ id: p.id, label: `${p.id} · ${zoneName(p.zone)}` }));
    if (def.points === 'tanks') return ops.tanks.filter(t => inZone(t.zone, zone)).map(t => ({ id: t.id, label: t.name }));
    return [];
  }, [def, zone, ops]);
  const chosen = points ?? pointOptions.map(p => p.id);
  const step = report ? 4 : def.points ? 3 : 2;

  const generate = () => {
    const spec = rangeSpec('CUSTOM', Number(days));
    const r = build(ops, type, spec, zone, chosen, params);
    setReport(r);
    setRecent(list => [{ id: r.id, title: r.title, period: spec.label, zone: r.zone, by: 'You', at: r.at }, ...list]);
  };

  return (
    <div className="dx">
      <ol className="dx-steps dx-no-print">
        {['Choose report', 'Date range & zone', def.points ? 'Points & parameters' : 'Options', 'Generate', 'Preview & export'].map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''}><b>{i + 1}</b>{s}</li>
        ))}
      </ol>

      <div className="dx-cols main-side dx-no-print" style={{ gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 1.6fr)' }}>
        <Card title="1 · Choose report" flush>
          <div className="dx-list">
            {REPORTS.map(r => (
              <button key={r.key} type="button" className="dx-item" style={r.key === type ? { background: 'hsl(var(--accent-bg))' } : undefined} onClick={() => { setType(r.key); setPoints(null); setReport(null); }}>
                <div className="dx-item-main">
                  <div className="dx-item-title" style={r.key === type ? { color: 'hsl(var(--primary))' } : undefined}>{r.title}</div>
                  <div className="dx-item-sub">{r.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title={`2 · Configure · ${def.title}`} sub="Defaults follow the zone selected elsewhere in the platform"
          actions={<button className="dx-btn primary" onClick={generate} disabled={def.points ? !chosen.length : false}>Generate report</button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="dx-toolbar">
              <Select label="Date range" value={days} onChange={setDays} options={[{ value: '1', label: 'Last 24 hours' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 3 months' }]} />
              <Select label="Zone / DMA" value={zone} onChange={z => { setZone(z); setPoints(null); }} options={[{ value: 'ALL', label: 'All zones' }, ...ZONE_CODES.map(z => ({ value: z, label: zoneName(z) }))]} />
            </div>
            {def.points && (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="dx-kicker" style={{ marginBottom: 8 }}>Monitoring points ({chosen.length} of {pointOptions.length})</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
                  {pointOptions.map(p => (
                    <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => setPoints(chosen.includes(p.id) ? chosen.filter(x => x !== p.id) : [...chosen, p.id])} />{p.label}
                    </label>
                  ))}
                  {!pointOptions.length && <span className="dx-muted">No points in this zone.</span>}
                </div>
              </fieldset>
            )}
            {type === 'quality' && (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="dx-kicker" style={{ marginBottom: 8 }}>Parameters</legend>
                <div className="dx-toolbar">
                  {QUALITY_METRICS.map(m => (
                    <label key={m} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={params.includes(m)} onChange={() => setParams(params.includes(m) ? params.filter(x => x !== m) : [...params, m])} />{METRICS[m].label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </Card>
      </div>

      {report && (
        <Card title={`Preview · ${report.title}`} sub={`${report.period} · ${report.zone} · generated ${clock(report.at)}`} className="dx-print"
          actions={<span className="dx-no-print dx-toolbar">
            <button className="dx-btn" onClick={() => downloadCsv(report)}>Export CSV</button>
            <button className="dx-btn primary" onClick={() => window.print()}>Export PDF</button>
          </span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="dx-grid-kpi four">{report.kpis.map(([l, v]) => <Kpi key={l} label={l} value={v} />)}</div>
            {report.chart && <LineChart series={[{ id: 'r', label: report.chart.label, points: report.chart.points }]} metric={report.chart.metric} band={report.chart.metric === 'level' ? null : undefined} height={220} />}
            <div className="dx-table-wrap" style={{ border: '1px solid hsl(var(--border))', borderRadius: 6 }}>
              <table className="dx-table">
                <thead><tr>{report.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{report.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'num' : undefined}>{typeof c === 'number' ? c.toLocaleString() : c}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="dx-muted" style={{ fontSize: '0.75rem' }}>{report.id} · Riverton Water &amp; Sanitation Co. · Generated by AquaWise from monitored data.</p>
          </div>
        </Card>
      )}

      <div className="dx-cols dx-no-print">
        <Card title="Recent reports" flush>
          <DataTable rows={recent} rowKey={r => r.id} columns={[
            { key: 'id', label: 'ID', render: r => <span className="dx-mono">{r.id}</span> },
            { key: 't', label: 'Report', render: r => <span className="strong">{r.title}</span> },
            { key: 'p', label: 'Period', render: r => r.period },
            { key: 'z', label: 'Zone', render: r => r.zone },
            { key: 'b', label: 'By', render: r => r.by },
            { key: 'a', label: 'Created', render: r => clock(r.at), sort: r => -r.at }
          ] as Column<typeof recent[number]>[]} />
        </Card>
        <Card title="Scheduled reports" flush>
          <DataTable rows={SCHEDULED} rowKey={r => r.name} columns={[
            { key: 'n', label: 'Report', render: r => <span className="strong">{r.name}</span> },
            { key: 'f', label: 'Frequency', render: r => r.freq },
            { key: 'to', label: 'Recipients', render: r => <span className="dx-muted">{r.to}</span> },
            { key: 'nx', label: 'Next run', render: r => r.next },
            { key: 's', label: 'Status', render: () => <Status tone="ok" label="Active" /> }
          ] as Column<typeof SCHEDULED[number]>[]} />
        </Card>
      </div>
    </div>
  );
}

/* ── report builders ── */
const r2 = (v: number, d = 2) => Number(v.toFixed(d));
function stats(vals: number[]) {
  const min = Math.min(...vals); const max = Math.max(...vals); const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, max, avg };
}

function build(ops: Ops, type: ReportType, spec: RangeSpec, zone: string, chosen: string[], params: Metric[]): Generated {
  const zoneLbl = zone === 'ALL' ? 'All zones' : zoneName(zone);
  const base = { id: `RPT-${String(413 + Math.floor(Math.random() * 80)).padStart(4, '0')}`, type, title: REPORTS.find(r => r.key === type)!.title, period: spec.label, zone: zoneLbl, at: Date.now() };
  const incidents = withState(ops.incidents).filter(i => inZone(i.zone, zone) && NOW - i.startedAt <= spec.hours * HOURS);

  switch (type) {
    case 'quality': {
      const pts = ops.quality.filter(q => chosen.includes(q.id));
      const rows: Array<Array<string | number>> = []; let total = 0; let within = 0;
      pts.forEach(q => params.forEach(m => {
        const s = series(m, q.id, q.base[m as keyof typeof q.base], spec).map(p => p.v);
        const st = stats(s); const ok = s.filter(v => toneFor(m, v) === 'ok').length;
        total += s.length; within += ok;
        rows.push([q.name, METRICS[m].label, r2(st.min, METRICS[m].decimals), r2(st.avg, METRICS[m].decimals), r2(st.max, METRICS[m].decimals), METRICS[m].rangeText, s.length - ok, `${((ok / s.length) * 100).toFixed(1)} %`]);
      }));
      const first = pts[0]; const m0 = params[0] ?? 'turbidity';
      return { ...base, kpis: [['Monitoring points', String(pts.length)], ['Readings assessed', total.toLocaleString()], ['Compliance', `${((within / Math.max(1, total)) * 100).toFixed(1)} %`], ['Breach events', String(incidents.filter(i => i.type === 'Water quality breach').length)]],
        columns: ['Location', 'Parameter', 'Min', 'Average', 'Max', 'Acceptable range', 'Readings out of range', 'Compliance'], rows,
        chart: first ? { metric: m0, label: `${METRICS[m0].label} · ${first.name}`, points: series(m0, first.id, first.base[m0 as keyof typeof first.base], spec) } : undefined };
    }
    case 'pressure': {
      const pts = ops.pressure.filter(p => chosen.includes(p.id) && p.online);
      const ser = pts.map(p => series('pressure', p.id, p.base, spec));
      const rows = pts.map((p, i) => { const v = ser[i].map(x => x.v); const st = stats(v); return [p.id, zoneName(p.zone), r2(st.min), r2(st.avg), r2(st.max), `${((v.filter(x => x < 1.5).length / v.length) * 100).toFixed(1)} %`]; });
      return { ...base, kpis: [['Loggers', String(pts.length)], ['Average pressure', `${(ser.flat().reduce((a, p) => a + p.v, 0) / Math.max(1, ser.flat().length)).toFixed(2)} bar`], ['Lowest reading', `${Math.min(...ser.flat().map(p => p.v)).toFixed(2)} bar`], ['Anomalies', String(incidents.filter(i => i.metric === 'pressure').length)]],
        columns: ['Logger', 'Zone', 'Min (bar)', 'Average (bar)', 'Max (bar)', 'Time below 1.5 bar'], rows,
        chart: { metric: 'pressure', label: 'Average pressure', points: meanSeries(ser) } };
    }
    case 'tanks': {
      const ts = ops.tanks.filter(t => chosen.includes(t.id));
      const rows = ts.map(t => { const v = series('level', t.id, t.base, spec).map(p => p.v); const st = stats(v); return [t.name, t.capacity, Math.round(st.min), Math.round(st.avg), Math.round(st.max), `${((v.filter(x => x < 35).length / v.length) * 100).toFixed(1)} %`]; });
      return { ...base, kpis: [['Reservoirs', String(ts.length)], ['Capacity', `${ts.reduce((a, t) => a + t.capacity, 0).toLocaleString()} m³`], ['Current stored', `${Math.round(ts.reduce((a, t) => a + t.volume, 0)).toLocaleString()} m³`], ['Low-level alerts', String(incidents.filter(i => i.type === 'Low tank level').length)]],
        columns: ['Reservoir', 'Capacity (m³)', 'Min level %', 'Average level %', 'Max level %', 'Time below 35 %'], rows,
        chart: ts[0] ? { metric: 'level', label: ts[0].name, points: series('level', ts[0].id, ts[0].base, spec) } : undefined };
    }
    case 'nrw': {
      const zs = ops.zones.filter(z => inZone(z.code, zone));
      const sup = zs.reduce((a, z) => a + z.suppliedM3d, 0); const loss = zs.reduce((a, z) => a + z.lossM3d, 0);
      return { ...base, kpis: [['System input', `${sup.toLocaleString()} m³/day`], ['Billed', `${(sup - loss).toLocaleString()} m³/day`], ['Estimated loss', `${loss.toLocaleString()} m³/day`], ['NRW', `${((loss / sup) * 100).toFixed(1)} %`]],
        columns: ['Zone', 'Supplied (m³/d)', 'Billed (m³/d)', 'Loss (m³/d)', 'NRW %', 'Change (pts)'],
        rows: zs.map(z => [z.name, z.suppliedM3d, z.billedM3d, z.lossM3d, z.nrw, r2(z.nrw - z.nrwPrev, 1)]) };
    }
    case 'network': {
      const zs = ops.zones.filter(z => inZone(z.code, zone));
      return { ...base, kpis: [['Zones', String(zs.length)], ['Network health', `${ops.health.score} %`], ['Incidents', String(incidents.length)], ['NRW', `${ops.nrw.current.toFixed(1)} %`]],
        columns: ['Zone', 'Length (km)', 'Avg pressure (bar)', 'Water quality', 'Incidents', 'NRW %'],
        rows: zs.map(z => [z.name, r2(z.lengthKm, 1), r2(z.pressureAvg), ops.quality.find(q => q.zone === z.code)?.tone === 'ok' ? 'Normal' : 'Attention', incidents.filter(i => i.zone === z.code).length, z.nrw]) };
    }
    case 'incidents':
      return { ...base, kpis: [['Incidents', String(incidents.length)], ['Critical', String(incidents.filter(i => i.severity === 'critical').length)], ['Open', String(incidents.filter(i => i.status !== 'resolved').length)], ['Resolved', String(incidents.filter(i => i.status === 'resolved').length)]],
        columns: ['ID', 'Severity', 'Type', 'Title', 'Zone', 'Started', 'Status', 'Measurement'],
        rows: incidents.sort((a, b) => b.startedAt - a.startedAt).map(i => [i.id, i.severity, i.type, i.title, zoneName(i.zone), clock(i.startedAt), i.status, i.trigger]) };
    case 'assets': {
      const pipes = ops.network.pipes.filter(p => inZone(p.properties.zone ?? '', zone));
      const year = new Date(NOW).getFullYear();
      const mats = new Map<string, { km: number; n: number; ages: number[] }>();
      pipes.forEach(p => {
        const k = p.properties.material ?? 'Unknown'; const e = mats.get(k) ?? { km: 0, n: 0, ages: [] };
        e.km += (p.properties.length_m ?? 0) / 1000; e.n += 1; if (p.properties.installed) e.ages.push(year - p.properties.installed);
        mats.set(k, e);
      });
      return { ...base, kpis: [['Pipe segments', pipes.length.toLocaleString()], ['Length', `${Math.round([...mats.values()].reduce((a, m) => a + m.km, 0))} km`], ['Point assets', String(ops.tanks.length + ops.prvs.length + ops.meters.length + ops.sensors.length)], ['Unknown install year', pipes.filter(p => !p.properties.installed).length.toLocaleString()]],
        columns: ['Material', 'Segments', 'Length (km)', 'Average age (years)', 'Oldest (years)'],
        rows: [...mats.entries()].sort((a, b) => b[1].km - a[1].km).map(([m, e]) => [m, e.n, r2(e.km, 1), e.ages.length ? r2(e.ages.reduce((a, b) => a + b, 0) / e.ages.length, 1) : '—', e.ages.length ? Math.max(...e.ages) : '—']) };
    }
  }
}

function downloadCsv(r: Generated) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    [`${r.title}`], [`Period: ${r.period}`], [`Zone: ${r.zone}`], [`Generated: ${new Date(r.at).toISOString()}`], [],
    r.columns, ...r.rows
  ].map(l => l.map(esc).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date(r.at).toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

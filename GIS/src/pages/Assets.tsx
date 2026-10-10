/**
 * Assets — engineering inventory: pipes, reservoirs, valves, sensors, meters.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { useOps, ago, zoneName, type Ops } from '../demo/model';
import { useFilters, inZone } from '../demo/filters';
import { withState, useIncidentState } from '../demo/incidentState';
import { Card, Kpi, Status, Tabs, Select, SearchInput, DataTable, Drawer, KV, Section, Loading, SevIcon, type Column } from '../demo/ui';
import { SegmentBar, LineChart, TONE_COLOR } from '../demo/charts';
import { series, rangeSpec, stableRand, NOW, DAYS, type Metric, type Tone } from '../demo/series';

type Kind = 'Pipe' | 'Reservoir' | 'Valve' | 'Sensor' | 'Meter';
type Condition = 'Good' | 'Fair' | 'Poor' | 'Unknown';
const COND_TONE: Record<Condition, Tone> = { Good: 'ok', Fair: 'warn', Poor: 'crit', Unknown: 'off' };

interface AssetRow {
  id: string; kind: Kind; name: string; zone: string; pos: [number, number] | null;
  installed: number | null; condition: Condition; operational: boolean;
  material?: string | null; diameter?: number | null; lengthM?: number | null; pipeClass?: string;
  detail: string; focus: string;
  live?: { metric: Metric; entity: string; base: number; text: string };
  connected: string[];
}

const TAB_KIND: Record<string, Kind | null> = { all: null, pipes: 'Pipe', tanks: 'Reservoir', valves: 'Valve', sensors: 'Sensor', meters: 'Meter' };

function pipeCondition(material: string | null, installed: number | null): Condition {
  if (!installed) return 'Unknown';
  const age = new Date(NOW).getFullYear() - installed;
  if (material === 'AC' || material === 'GI') return age > 25 ? 'Poor' : 'Fair';
  return age < 15 ? 'Good' : age < 30 ? 'Fair' : 'Poor';
}

function buildRows(ops: Ops): AssetRow[] {
  const sensorsByPipe = new Map<string, string[]>();
  ops.pressure.forEach(p => sensorsByPipe.set(p.pipeId, [...(sensorsByPipe.get(p.pipeId) ?? []), p.id]));
  // The service-area outline is not a pipe.
  const rows: AssetRow[] = ops.network.pipes.filter(p => p.properties.ui_class !== 'boundary').map(p => {
    const pr = p.properties; const c = p.geometry.coordinates[Math.floor(p.geometry.coordinates.length / 2)];
    return {
      id: pr.id, kind: 'Pipe', name: `${pr.material ?? 'Unknown material'} ${pr.diameter_mm ? `${pr.diameter_mm} mm` : ''} ${pr.class}`.replace(/\s+/g, ' ').trim(),
      zone: pr.zone ?? '—', pos: [c[1], c[0]], installed: pr.installed, condition: pipeCondition(pr.material, pr.installed),
      operational: pr.service !== 'out-of-service' && pr.status !== 'closed',
      material: pr.material, diameter: pr.diameter_mm, lengthM: pr.length_m, pipeClass: pr.class,
      detail: `${pr.length_m ? `${Math.round(pr.length_m)} m` : '—'} · ${pr.status}`, focus: `pipe:${pr.id}`, connected: sensorsByPipe.get(pr.id) ?? []
    };
  });
  ops.tanks.forEach((t, i) => rows.push({
    id: t.id, kind: 'Reservoir', name: t.name, zone: t.zone, pos: t.pos, installed: 2008 + i * 2, condition: i === 5 ? 'Fair' : 'Good', operational: true,
    detail: `${t.capacity.toLocaleString()} m³`, focus: `asset:${t.id}`,
    live: { metric: 'level', entity: t.id, base: t.base, text: `${Math.round(t.level)} % · ${Math.round(t.volume).toLocaleString()} m³` }, connected: [`LV-${String(i + 1).padStart(2, '0')}`]
  }));
  ops.prvs.forEach(v => rows.push({
    id: v.id, kind: 'Valve', name: `Pressure-reducing valve ${v.id.replace('PV-', '')}`, zone: v.zone, pos: v.pos,
    installed: 2012 + Math.floor(stableRand(`yr:${v.id}`) * 12), condition: v.status === 'alert' ? 'Poor' : v.status === 'warn' ? 'Fair' : 'Good', operational: true,
    detail: `Set ${v.set_bar} bar · band ${v.min_bar}–${v.max_bar} bar`, focus: `asset:${v.id}`, connected: []
  }));
  ops.meters.forEach(m => rows.push({
    id: m.id, kind: 'Meter', name: `Bulk meter ${m.id.replace('MV-', '')}`, zone: m.zone, pos: m.pos,
    installed: 2015 + Math.floor(stableRand(`yr:${m.id}`) * 9), condition: m.state === 'throttled' ? 'Fair' : 'Good', operational: true,
    detail: `${m.size_mm} mm · ${m.consumption_m3d.toLocaleString()} m³/day · ${m.state}`, focus: `asset:${m.id}`, connected: []
  }));
  ops.sensors.forEach(s => rows.push({
    id: s.id, kind: 'Sensor', name: s.name, zone: s.zone, pos: s.pos, installed: s.installed,
    condition: s.health === 'off' ? 'Poor' : s.health === 'warn' ? 'Fair' : 'Good', operational: s.health !== 'off',
    detail: `${s.kind} · battery ${s.battery} %`,
    focus: s.kind === 'Water quality' ? (s.zone === 'WTW' ? '' : `asset:TB-${s.zone}`) : s.kind === 'Tank level' ? `asset:${s.entityId}` : `asset:${s.id}`,
    live: { metric: s.metric, entity: s.entityId, base: s.base, text: s.reading }, connected: []
  }));
  return rows;
}

export default function Assets() {
  const ops = useOps();
  return (
    <Shell active="assets" title="Assets" sub="Engineering inventory of the physical network" filters={{ zone: true }}>
      {ops ? <AssetsBody ops={ops} /> : <Loading />}
    </Shell>
  );
}

function AssetsBody({ ops }: { ops: Ops }) {
  useIncidentState();
  const { zone } = useFilters();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [cond, setCond] = useState('ALL');
  const [material, setMaterial] = useState('ALL');
  const [open, setOpen] = useState<AssetRow | null>(null);

  const all = useMemo(() => buildRows(ops), [ops]);
  const scoped = all.filter(r => inZone(r.zone, zone));
  const kind = TAB_KIND[tab];
  const rows = scoped.filter(r =>
    (!kind || r.kind === kind) && (cond === 'ALL' || r.condition === cond) &&
    (material === 'ALL' || r.material === material) &&
    (!q || `${r.id} ${r.name} ${zoneName(r.zone)}`.toLowerCase().includes(q.toLowerCase())));

  const pipes = scoped.filter(r => r.kind === 'Pipe');
  const lengthKm = pipes.reduce((s, p) => s + (p.lengthM ?? 0), 0) / 1000;
  const byMaterial = groupSum(pipes, p => p.material ?? 'Unknown', p => (p.lengthM ?? 0) / 1000);
  const year = new Date(NOW).getFullYear();
  const ageBands: Array<[string, (y: number | null) => boolean]> = [
    ['< 10 years', y => !!y && year - y < 10], ['10 – 19 years', y => !!y && year - y >= 10 && year - y < 20],
    ['20 – 29 years', y => !!y && year - y >= 20 && year - y < 30], ['30 + years', y => !!y && year - y >= 30], ['Unknown', y => !y]
  ];
  const conds: Condition[] = ['Good', 'Fair', 'Poor', 'Unknown'];
  const counts = (k: Kind | null) => scoped.filter(r => !k || r.kind === k).length;

  const cols: Column<AssetRow>[] = [
    { key: 'id', label: 'ID', render: r => <span className="strong">{r.id}</span>, sort: r => r.id },
    { key: 'k', label: 'Type', render: r => r.kind, sort: r => r.kind },
    { key: 'n', label: 'Description', render: r => r.name, sort: r => r.name },
    { key: 'z', label: 'Zone', render: r => zoneName(r.zone), sort: r => zoneName(r.zone) },
    { key: 'd', label: 'Details', render: r => <span className="dx-muted">{r.detail}</span> },
    { key: 'i', label: 'Installed', align: 'right', render: r => r.installed ?? '—', sort: r => r.installed ?? 0 },
    { key: 'c', label: 'Condition', render: r => <Status tone={COND_TONE[r.condition]} label={r.condition} />, sort: r => conds.indexOf(r.condition) },
    { key: 'o', label: 'Operational', render: r => r.operational ? 'Yes' : <span className="t-crit strong">No</span>, sort: r => (r.operational ? 1 : 0) }
  ];

  return (
    <div className="dx">
      <div className="dx-grid-kpi four">
        <Kpi label="Total assets" value={scoped.length.toLocaleString()} sub={`${pipes.length.toLocaleString()} pipe segments · ${scoped.length - pipes.length} point assets`} />
        <Kpi label="Network length" value={lengthKm.toFixed(0)} unit="km" sub={zone === 'ALL' ? 'transmission and distribution' : zoneName(zone)} />
        <Kpi label="Operational" value={`${Math.round((scoped.filter(r => r.operational).length / Math.max(1, scoped.length)) * 100)}`} unit="%" tone="ok" sub={`${scoped.filter(r => !r.operational).length} out of service or closed`} />
        <Kpi label="Poor or unknown condition" value={scoped.filter(r => r.condition === 'Poor' || r.condition === 'Unknown').length.toLocaleString()} tone="warn" sub="candidates for inspection" onClick={() => setCond('Poor')} />
      </div>

      <div className="dx-cols three">
        <Card title="Pipe material" sub="By length (km)">
          <BoxTiles rows={byMaterial.sort((a, b) => b[1] - a[1]).map(([m, km]) => ({ key: m, label: m, value: km, display: `${km.toFixed(1)} km`, tone: m === 'AC' ? 'warn' as Tone : m === 'Unknown' ? 'off' as Tone : undefined, sub: m === 'AC' ? 'Asbestos cement — replacement priority' : undefined }))} onRowClick={k => { setTab('pipes'); setMaterial(k); }} />
        </Card>
        <Card title="Pipe age" sub="Segments by installation year">
          <BoxTiles rows={ageBands.map(([label, f]) => { const n = pipes.filter(p => f(p.installed)).length; return { key: label, label, value: n, display: `${n.toLocaleString()} segments`, tone: label === '30 + years' ? 'warn' as Tone : label === 'Unknown' ? 'off' as Tone : undefined }; })} />
        </Card>
        <Card title="Asset condition" sub="All asset types">
          <SegmentBar parts={conds.map(c => ({ label: c, value: scoped.filter(r => r.condition === c).length, color: TONE_COLOR[COND_TONE[c]] }))} />
          <div className="dx-rows" style={{ marginTop: 12 }}>
            {conds.map(c => (
              <button key={c} type="button" className="dx-row" style={{ background: 'none', border: 0, borderBottom: '1px solid hsl(var(--border))', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => setCond(c)}>
                <Status tone={COND_TONE[c]} label={c} /><span className="name" />
                <span className="val">{scoped.filter(r => r.condition === c).length.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <p className="dx-muted" style={{ fontSize: '0.75rem', marginTop: 8 }}>Pipe condition is estimated from material and age until inspection data is recorded.</p>
        </Card>
      </div>

      <Card flush>
        <div style={{ padding: '0 16px' }}>
          <Tabs value={tab} onChange={k => { setTab(k); if (k !== 'pipes' && k !== 'all') setMaterial('ALL'); }} items={[
            { key: 'all', label: 'All', count: counts(null) }, { key: 'pipes', label: 'Pipes', count: counts('Pipe') },
            { key: 'tanks', label: 'Tanks', count: counts('Reservoir') }, { key: 'valves', label: 'Valves', count: counts('Valve') },
            { key: 'sensors', label: 'Sensors', count: counts('Sensor') }, { key: 'meters', label: 'Meters', count: counts('Meter') }
          ]} />
        </div>
        <div className="dx-filters">
          <SearchInput value={q} onChange={setQ} placeholder="Search ID, description or zone" />
          <Select label="Condition" value={cond} onChange={setCond} options={[{ value: 'ALL', label: 'All' }, ...conds.map(c => ({ value: c, label: c }))]} />
          {(tab === 'pipes' || tab === 'all') && <Select label="Material" value={material} onChange={setMaterial} options={[{ value: 'ALL', label: 'All' }, ...byMaterial.map(([m]) => ({ value: m, label: m }))]} />}
          <span className="dx-muted" style={{ marginLeft: 'auto' }}>{rows.length.toLocaleString()} assets</span>
          <Link className="dx-btn" to="/assets/attributes">Pipe attribute table</Link>
        </div>
        <DataTable columns={cols} rows={rows} rowKey={r => r.id} onRowClick={setOpen} selectedKey={open?.id} pageSize={15} />
      </Card>

      <AssetDrawer asset={open} ops={ops} onClose={() => setOpen(null)} />
    </div>
  );
}

function AssetDrawer({ asset: a, ops, onClose }: { asset: AssetRow | null; ops: Ops; onClose: () => void }) {
  const navigate = useNavigate();
  const incidents = withState(ops.incidents).filter(i => a && (i.entityId === a.id || i.focus.endsWith(`:${a.id}`) || a.connected.includes(i.entityId)));
  const history = a ? maintenance(a) : [];
  return (
    <Drawer open={!!a} onClose={onClose} kicker={a?.kind ?? 'Asset'} title={a ? `${a.id} · ${a.name}` : ''}
      status={a && <><Status tone={COND_TONE[a.condition]} label={`${a.condition} condition`} /><span className="dx-muted">{zoneName(a.zone)}</span></>}
      footer={a && a.focus && <button className="dx-btn primary" onClick={() => navigate(`/network?focus=${a.focus}`)}>Show on GIS map</button>}>
      {a && (
        <>
          <Section title="Asset">
            <KV rows={[
              ['ID', a.id], ['Type', a.kind], ['Zone', zoneName(a.zone)],
              ['Location', a.pos ? `${a.pos[0].toFixed(5)}, ${a.pos[1].toFixed(5)}` : '—'],
              ['Installed', a.installed ? `${a.installed} (${new Date(NOW).getFullYear() - a.installed} years)` : 'Unknown'],
              ['Condition', a.condition],
              ...(a.kind === 'Pipe' ? [['Material', a.material ?? 'Unknown'], ['Diameter', a.diameter ? `${a.diameter} mm` : '—'], ['Length', a.lengthM ? `${Math.round(a.lengthM)} m` : '—'], ['Class', a.pipeClass ?? '—']] as Array<[string, string]> : []),
              ['Operational', a.operational ? 'Yes' : 'No'], ['Details', a.detail]
            ]} />
          </Section>
          <Section title="Connected sensors">
            {a.connected.length ? <div className="dx-toolbar">{a.connected.map(c => <span key={c} className="dx-chip">{c}</span>)}</div> : <p className="dx-muted">No sensors connected to this asset.</p>}
          </Section>
          {a.live && (
            <Section title={`Monitoring data · last 7 days · ${a.live.text}`}>
              <LineChart series={[{ id: a.id, label: a.id, points: series(a.live.metric, a.live.entity, a.live.base, rangeSpec('7D')) }]} metric={a.live.metric} band={a.live.metric === 'level' ? null : undefined} height={180} />
            </Section>
          )}
          <Section title="Recent incidents">
            {incidents.length ? (
              <div className="dx-list" style={{ border: '1px solid hsl(var(--border))', borderRadius: 6 }}>
                {incidents.map(i => (
                  <button key={i.id} type="button" className="dx-item" onClick={() => navigate(`/alerts?id=${i.id}`)}>
                    <SevIcon severity={i.severity} /><div className="dx-item-main"><div className="dx-item-title">{i.title}</div><div className="dx-item-sub">{i.trigger}</div></div><div className="dx-item-meta">{ago(i.startedAt)}</div>
                  </button>
                ))}
              </div>
            ) : <p className="dx-muted">No incidents recorded for this asset.</p>}
          </Section>
          <Section title="Maintenance history">
            <div className="dx-rows">
              {history.map(h => <div key={h.t} className="dx-row"><span className="dx-muted" style={{ width: 92 }}>{new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="name">{h.what}</span></div>)}
            </div>
          </Section>
        </>
      )}
    </Drawer>
  );
}


function maintenance(a: AssetRow): Array<{ t: number; what: string }> {
  const out: Array<{ t: number; what: string }> = [];
  const r = (k: string) => stableRand(`${a.id}:${k}`);
  if (a.kind === 'Pipe') {
    if (a.condition === 'Poor') out.push({ t: NOW - Math.round(40 + r('a') * 200) * DAYS, what: 'Joint repair — clamp fitted' });
    out.push({ t: NOW - Math.round(250 + r('b') * 500) * DAYS, what: 'Condition survey (visual)' });
  } else if (a.kind === 'Sensor') {
    out.push({ t: NOW - Math.round(20 + r('a') * 90) * DAYS, what: 'Battery check and calibration' });
    out.push({ t: NOW - Math.round(200 + r('b') * 200) * DAYS, what: 'Firmware update' });
  } else {
    out.push({ t: NOW - Math.round(30 + r('a') * 120) * DAYS, what: a.kind === 'Reservoir' ? 'Level sensor calibration' : 'Routine service' });
    out.push({ t: NOW - Math.round(200 + r('b') * 300) * DAYS, what: a.kind === 'Reservoir' ? 'Structural inspection and cleaning' : 'Inspection' });
  }
  if (a.installed) out.push({ t: new Date(a.installed, 5, 1).getTime(), what: 'Installed / commissioned' });
  return out.sort((x, y) => y.t - x.t);
}

function groupSum<T>(rows: T[], key: (r: T) => string, val: (r: T) => number): Array<[string, number]> {
  const m = new Map<string, number>();
  rows.forEach(r => m.set(key(r), (m.get(key(r)) ?? 0) + val(r)));
  return [...m.entries()];
}

/** Proportions as a grid of boxes: each box holds the value, its share and a filled block. */
function BoxTiles({ rows, onRowClick }: {
  rows: Array<{ key: string; label: string; value: number; display: string; tone?: Tone; sub?: string }>;
  onRowClick?: (key: string) => void;
}) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <div className="bx-tiles">
      {rows.map(r => {
        const share = (r.value / total) * 100;
        const Tag = onRowClick ? 'button' : 'div';
        return (
          <Tag key={r.key} type={onRowClick ? 'button' : undefined} className={`bx-tile${onRowClick ? ' click' : ''}`} onClick={onRowClick ? () => onRowClick(r.key) : undefined} title={r.sub}>
            <span className="bx-tile-lbl">{r.label}{r.sub && <i className={`t-${r.tone ?? 'warn'}`}> ·  priority</i>}</span>
            <b>{r.display}</b>
            <span className="bx-tile-share">{share < 1 ? '< 1' : share.toFixed(0)} %</span>
            <span className="bx-tile-fill" style={{ height: `${Math.max(3, share)}%`, background: r.tone === 'warn' ? 'hsl(var(--warning) / 0.14)' : r.tone === 'off' ? 'hsl(var(--offline) / 0.18)' : 'hsl(var(--primary) / 0.1)' }} />
          </Tag>
        );
      })}
    </div>
  );
}

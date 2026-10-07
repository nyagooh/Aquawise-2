/**
 * Alerts & Incidents — operational incident centre.
 * Leakage is an incident type here (no separate Leaks page) and feeds NRW.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { useOps, ago, clock, zoneName, type Ops, type Incident, type IncidentStatus, type IncidentType } from '../demo/model';
import { useFilters, inZone } from '../demo/filters';
import { withState, useIncidentState, setIncidentStatus } from '../demo/incidentState';
import { Card, Kpi, Status, Tabs, Select, SearchInput, DataTable, Drawer, KV, Section, Loading, type Column } from '../demo/ui';
import { LineChart, ChartLegend } from '../demo/charts';
import { seriesWindow, eventWindows, METRICS, NOW, HOURS, type Tone } from '../demo/series';
import { duration } from './Monitoring';

const TYPES: IncidentType[] = ['Water quality breach', 'Pressure anomaly', 'Possible leak', 'Low tank level', 'Sensor offline', 'Abnormal reading'];

export default function Alerts() {
  const ops = useOps();
  return (
    <Shell active="alerts" title="Alerts & Incidents" sub="Operational incidents across the network" filters={{ zone: true }}>
      {ops ? <AlertsBody ops={ops} /> : <Loading />}
    </Shell>
  );
}

function AlertsBody({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const { zone } = useFilters();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<IncidentStatus>(() => withState(ops.incidents).find(x => x.id === params.get('id'))?.status ?? 'active');
  const [sev, setSev] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [when, setWhen] = useState('30');
  const [q, setQ] = useState('');

  const all = withState(ops.incidents).filter(i => inZone(i.zone, zone));
  const openId = params.get('id');
  const open = all.find(i => i.id === openId) ?? null;
  const setOpen = (i: Incident | null) => {
    const next = new URLSearchParams(params);
    if (i) next.set('id', i.id); else next.delete('id');
    setParams(next, { replace: true });
  };

  const filtered = all.filter(i =>
    (sev === 'ALL' || i.severity === sev) && (type === 'ALL' || i.type === type) &&
    (when === 'ALL' || NOW - i.startedAt <= Number(when) * 24 * HOURS) &&
    (!q || `${i.title} ${i.location} ${i.id}`.toLowerCase().includes(q.toLowerCase())));
  const rows = filtered.filter(i => i.status === tab)
    .sort((a, b) => tab === 'resolved' ? b.startedAt - a.startedAt : sevRank(a.severity) - sevRank(b.severity) || b.startedAt - a.startedAt);

  const active = all.filter(i => i.status === 'active');
  const resolved30 = all.filter(i => i.status === 'resolved' && NOW - i.startedAt < 30 * 24 * HOURS);
  const mttr = resolved30.length ? resolved30.reduce((s, i) => s + ((i.resolvedAt ?? NOW) - i.startedAt), 0) / resolved30.length : 0;

  const cols: Column<Incident>[] = [
    { key: 'sev', label: 'Severity', width: 92, render: i => <span className={`dx-sev ${i.severity}`}>{i.severity}</span>, sort: i => sevRank(i.severity) },
    { key: 'what', label: 'What happened', render: i => <div><div className="strong">{i.title}</div><div className="dx-muted" style={{ fontSize: '0.75rem' }}>{i.type} · {i.id}</div></div>, sort: i => i.title },
    { key: 'where', label: 'Where', render: i => <div><div>{zoneName(i.zone)}</div><div className="dx-muted" style={{ fontSize: '0.75rem' }}>{i.location}</div></div>, sort: i => zoneName(i.zone) },
    { key: 'trig', label: 'Triggering measurement', render: i => <span className="dx-muted">{i.trigger}</span> },
    { key: 'when', label: 'When', render: i => <div><div>{ago(i.startedAt)}</div><div className="dx-muted" style={{ fontSize: '0.75rem' }}>{clock(i.startedAt)}</div></div>, sort: i => -i.startedAt },
    ...(tab === 'resolved' ? [{ key: 'dur', label: 'Duration', render: (i: Incident) => duration((i.resolvedAt ?? NOW) - i.startedAt), sort: (i: Incident) => (i.resolvedAt ?? NOW) - i.startedAt }] : []),
    { key: 'st', label: 'Status', render: i => <StatusBadge i={i} /> }
  ];

  return (
    <div className="dx">
      <div className="dx-grid-kpi four">
        <Kpi label="Active" value={active.length} tone={active.some(a => a.severity === 'critical') ? 'crit' : active.length ? 'warn' : 'ok'} sub={`${active.filter(a => a.severity === 'critical').length} critical`} onClick={() => setTab('active')} />
        <Kpi label="Acknowledged" value={all.filter(i => i.status === 'acknowledged').length} sub="being handled" onClick={() => setTab('acknowledged')} />
        <Kpi label="Resolved · 30 days" value={resolved30.length} tone="ok" sub="closed incidents" onClick={() => setTab('resolved')} />
        <Kpi label="Mean time to resolve" value={mttr ? duration(mttr) : '—'} sub="last 30 days" />
      </div>

      <Card flush>
        <div style={{ padding: '0 16px' }}>
          <Tabs value={tab} onChange={setTab} items={[
            { key: 'active', label: 'Active', count: filtered.filter(i => i.status === 'active').length },
            { key: 'acknowledged', label: 'Acknowledged', count: filtered.filter(i => i.status === 'acknowledged').length },
            { key: 'resolved', label: 'Resolved', count: filtered.filter(i => i.status === 'resolved').length }
          ]} />
        </div>
        <div className="dx-filters">
          <SearchInput value={q} onChange={setQ} placeholder="Search incidents" />
          <Select label="Severity" value={sev} onChange={setSev} options={[{ value: 'ALL', label: 'All' }, { value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Info' }]} />
          <Select label="Type" value={type} onChange={setType} options={[{ value: 'ALL', label: 'All types' }, ...TYPES.map(t => ({ value: t, label: t }))]} />
          <Select label="Date" value={when} onChange={setWhen} options={[{ value: '1', label: 'Last 24 hours' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'ALL', label: 'All time' }]} />
          {zone !== 'ALL' && <span className="dx-chip">Zone: {zoneName(zone)}</span>}
        </div>
        <DataTable columns={cols} rows={rows} rowKey={i => i.id} onRowClick={setOpen} selectedKey={open?.id} empty={`No ${tab} incidents match these filters.`} />
      </Card>

      <IncidentDrawer incident={open} onClose={() => setOpen(null)} onView={i => navigate(`/network?focus=${i.focus}`)} />
    </div>
  );
}

function StatusBadge({ i }: { i: Incident }) {
  const tone: Tone = i.status === 'resolved' ? 'ok' : i.status === 'acknowledged' ? 'off' : i.severity === 'critical' ? 'crit' : i.severity === 'warning' ? 'warn' : 'off';
  return <Status tone={tone} label={i.status === 'resolved' ? 'Resolved' : i.status === 'acknowledged' ? 'Acknowledged' : 'Active'} />;
}

function IncidentDrawer({ incident: i, onClose, onView }: { incident: Incident | null; onClose: () => void; onView: (i: Incident) => void }) {
  const chart = useMemo(() => {
    if (!i) return null;
    const end = i.resolvedAt ?? NOW;
    const span = Math.max(end - i.startedAt, 2 * HOURS);
    const from = i.startedAt - Math.max(span * 1.5, 6 * HOURS);
    const to = Math.min(NOW, end + span);
    const pts = seriesWindow(i.metric, i.entityId, i.base, from, to, 160);
    const windows = eventWindows(i.metric, i.entityId)
      .filter(w => w.end >= from && w.start <= to)
      .map(w => ({ ...w, tone: (i.severity === 'critical' ? 'crit' : 'warn') as Tone }));
    return { pts, windows };
  }, [i]);

  return (
    <Drawer open={!!i} onClose={onClose} kicker={i ? `${i.type} · ${i.id}` : ''} title={i?.title ?? ''}
      status={i && <><span className={`dx-sev ${i.severity}`}>{i.severity}</span><StatusBadge i={i} /><span className="dx-muted">{ago(i.startedAt)}</span></>}
      footer={i && (
        <>
          <button className="dx-btn" onClick={() => onView(i)}>View on network</button>
          {i.status === 'active' && <button className="dx-btn" onClick={() => setIncidentStatus(i.id, 'acknowledged')}>Acknowledge</button>}
          {i.status !== 'resolved' && <button className="dx-btn primary" onClick={() => setIncidentStatus(i.id, 'resolved')}>Resolve</button>}
          {i.status === 'resolved' && <button className="dx-btn" onClick={() => setIncidentStatus(i.id, 'active')}>Reopen</button>}
        </>
      )}>
      {i && chart && (
        <>
          <p style={{ lineHeight: 1.6 }}>{i.summary}</p>
          <KV rows={[
            ['Where', `${zoneName(i.zone)} · ${i.location}`], ['When', clock(i.startedAt)],
            ['Triggering measurement', i.trigger], ['Current status', i.status === 'resolved' ? `Resolved ${i.resolvedAt ? ago(i.resolvedAt) : ''}` : i.status === 'acknowledged' ? 'Acknowledged' : 'Active'],
            ['Monitored value', METRICS[i.metric].label], ['Duration', duration((i.resolvedAt ?? NOW) - i.startedAt)]
          ]} />
          <Section title="Data around the event">
            <LineChart series={[{ id: i.entityId, label: `${METRICS[i.metric].label} · ${i.entityId}`, points: chart.pts }]}
              metric={i.metric} band={i.metric === 'level' || i.metric === 'flow' ? null : undefined} height={220}
              windows={chart.windows} marker={{ t: i.startedAt, label: 'Alert raised' }} showThresholds={i.metric !== 'flow'} />
            <div style={{ marginTop: 8 }}>
              <ChartLegend items={[
                { label: METRICS[i.metric].label, color: 'hsl(var(--primary))' },
                ...(i.metric !== 'flow' ? [{ label: 'Threshold', color: 'hsl(var(--warning))', dashed: true }] : []),
                { label: 'Alert raised', color: 'hsl(var(--danger))' }
              ]} />
            </div>
          </Section>
          {i.type === 'Possible leak' && (
            <Section title="Feeds into NRW">
              <p className="dx-muted" style={{ lineHeight: 1.6 }}>Estimated loss while unresolved is counted against {zoneName(i.zone)} in the NRW analysis.</p>
            </Section>
          )}
        </>
      )}
    </Drawer>
  );
}

const sevRank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);

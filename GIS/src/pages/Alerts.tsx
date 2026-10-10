/**
 * Alerts — a plain list of what is open right now. Each row states the alert:
 * what, where, the reading that triggered it and when. Opening one shows the
 * readings around the event.
 */
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { openIncidents } from '../components/AlertsMenu';
import { useOps, ago, clock, zoneName, type Ops, type Incident } from '../demo/model';
import { useFilters, inZone } from '../demo/filters';
import { useIncidentState } from '../demo/incidentState';
import { Drawer, KV, Section, Loading, SevIcon, Segmented } from '../demo/ui';
import { LineChart } from '../demo/charts';
import { seriesWindow, breachWindows, METRICS, NOW, HOURS, type Tone } from '../demo/series';
import { useState } from 'react';

export default function Alerts() {
  const ops = useOps();
  return (
    <Shell active="alerts" title="Alerts" sub="Everything that needs attention across the network, most urgent first" filters={{ zone: true }}>
      {ops ? <AlertsBody ops={ops} /> : <Loading />}
    </Shell>
  );
}

function AlertsBody({ ops }: { ops: Ops }) {
  useIncidentState();
  const navigate = useNavigate();
  const { zone } = useFilters();
  const [params, setParams] = useSearchParams();
  const [sev, setSev] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const list = openIncidents(ops.incidents).filter(i => inZone(i.zone, zone));
  const rows = list.filter(i => sev === 'all' || i.severity === sev);
  const open = list.find(i => i.id === params.get('id')) ?? null;
  const setOpen = (i: Incident | null) => {
    const next = new URLSearchParams(params);
    if (i) next.set('id', i.id); else next.delete('id');
    setParams(next, { replace: true });
  };
  const count = (s: string) => list.filter(i => i.severity === s).length;

  return (
    <div className="dx">
      <div className="al-box">
        <div className="al-head">
          <span className="al-count"><b>{list.length}</b> open</span>
          <Segmented size="sm" value={sev} onChange={setSev} options={[
            { key: 'all', label: `All ${list.length}` },
            { key: 'critical', label: `Critical ${count('critical')}` },
            { key: 'warning', label: `Warning ${count('warning')}` },
            { key: 'info', label: `Info ${count('info')}` }
          ]} />
        </div>
        <ul className="al-list">
          {rows.map(i => (
            <li key={i.id}>
              <button type="button" className={open?.id === i.id ? 'on' : ''} onClick={() => setOpen(i)}>
                <SevIcon severity={i.severity} />
                <span className="al-main">
                  <b>{i.title}</b>
                  <span>{i.trigger}</span>
                  <span className="al-meta">{zoneName(i.zone)} · {i.location} · {i.type}</span>
                </span>
                <time title={clock(i.startedAt)}>{ago(i.startedAt)}</time>
              </button>
            </li>
          ))}
          {!rows.length && <li className="al-empty">No open alerts here. Everything is within range.</li>}
        </ul>
      </div>
      <AlertDrawer incident={open} onClose={() => setOpen(null)} onView={i => navigate(`/network?focus=${i.focus}`)} />
    </div>
  );
}

function AlertDrawer({ incident: i, onClose, onView }: { incident: Incident | null; onClose: () => void; onView: (i: Incident) => void }) {
  const chart = useMemo(() => {
    if (!i) return null;
    const span = Math.max(NOW - i.startedAt, 2 * HOURS);
    const from = i.startedAt - Math.max(span * 1.5, 6 * HOURS);
    const pts = seriesWindow(i.metric, i.entityId, i.base, from, NOW, 160);
    const windows = breachWindows(i.metric, i.entityId, i.base, (NOW - from) / HOURS + 1).filter(w => w.end >= from)
      .map(w => ({ ...w, tone: (i.severity === 'critical' ? 'crit' : 'warn') as Tone }));
    return { pts, windows };
  }, [i]);
  return (
    <Drawer open={!!i} onClose={onClose} kicker={i ? `${i.type} · ${i.id}` : ''} title={i?.title ?? ''}
      status={i && <><SevIcon severity={i.severity} /><span className="dx-muted">Started {ago(i.startedAt)} · {clock(i.startedAt)}</span></>}
      footer={i && <button className="dx-btn primary" onClick={() => onView(i)}>View on network</button>}>
      {i && chart && (
        <>
          <p style={{ lineHeight: 1.6 }}>{i.summary}</p>
          <KV rows={[['Where', `${zoneName(i.zone)} · ${i.location}`], ['Reading', i.trigger], ['Measured', METRICS[i.metric].label], ['Started', clock(i.startedAt)]]} />
          <Section title="Readings around the event">
            <LineChart series={[{ id: i.entityId, label: `${METRICS[i.metric].label} · ${i.entityId}`, points: chart.pts }]}
              metric={i.metric} band={i.metric === 'level' || i.metric === 'flow' ? null : undefined} height={220}
              windows={chart.windows} marker={{ t: i.startedAt, label: 'Alert' }} showThresholds={i.metric !== 'flow'} />
          </Section>
        </>
      )}
    </Drawer>
  );
}

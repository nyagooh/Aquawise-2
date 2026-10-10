/**
 * Alerts live behind the bell in the top bar: a plain bordered list of what
 * is open right now. Clicking an alert opens its detail on the Alerts page.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOps, ago, zoneName, type Incident } from '../demo/model';
import { withState, useIncidentState } from '../demo/incidentState';
import { SevIcon } from '../demo/ui';

export function openIncidents(list: Incident[]): Incident[] {
  const rank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
  return withState(list).filter(i => i.status !== 'resolved')
    .sort((a, b) => rank(a.severity) - rank(b.severity) || b.startedAt - a.startedAt);
}

export function AlertsMenu() {
  const ops = useOps();
  useIncidentState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = ops ? openIncidents(ops.incidents) : [];
  const critical = list.filter(i => i.severity === 'critical').length;

  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div className="aw-alerts" ref={ref}>
      <button type="button" className={`aw-tb-icon aw-bell${open ? ' on' : ''}`} onClick={() => setOpen(o => !o)}
        aria-label={`Alerts, ${list.length} open`} aria-expanded={open} aria-haspopup="dialog">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" /><path d="M10 21h4" /></svg>
        {list.length > 0 && <span className="aw-bell-count">{list.length}</span>}
      </button>
      {open && (
        <div className="aw-alerts-pop" role="dialog" aria-label="Open alerts">
          <div className="aw-alerts-head">
            <b>Alerts</b>
            <span>{list.length} open{critical ? ` · ${critical} critical` : ''}</span>
          </div>
          <ul>
            {list.map(i => (
              <li key={i.id}>
                <button type="button" onClick={() => { setOpen(false); navigate(`/alerts?id=${i.id}`); }}>
                  <SevIcon severity={i.severity} />
                  <span className="aw-alerts-main">
                    <b>{i.title.split(' — ')[0]}</b>
                    <span>{zoneName(i.zone)} · {i.trigger}</span>
                  </span>
                  <time>{ago(i.startedAt).replace(' ago', '')}</time>
                </button>
              </li>
            ))}
            {!list.length && <li className="aw-alerts-empty">No open alerts. Everything is within range.</li>}
          </ul>
          <Link to="/alerts" className="aw-alerts-foot" onClick={() => setOpen(false)}>View all alerts</Link>
        </div>
      )}
    </div>
  );
}

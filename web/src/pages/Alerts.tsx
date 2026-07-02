import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertOctagon, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Card, CardHeader, Badge } from '../components/ui';
import { ALERTS, UTILITIES, paramByKey, utilityById, COUNTIES } from '../data/mockData';

type TabKey = 'all' | 'active' | 'resolved';

export default function Alerts() {
  const [tab, setTab] = useState<TabKey>('all');
  const [utility, setUtility] = useState<string>('all');
  const [param, setParam] = useState<string>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(ALERTS[0].id);

  const filtered = useMemo(() => ALERTS.filter(a => {
    if (tab === 'active' && a.resolved) return false;
    if (tab === 'resolved' && !a.resolved) return false;
    if (utility !== 'all' && a.utilityId !== utility) return false;
    if (param !== 'all' && a.parameter !== param) return false;
    if (q && !`${a.title} ${a.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tab, utility, param, q]);

  const current = ALERTS.find(a => a.id === selected) ?? ALERTS[0];
  const currentUtil = utilityById(current.utilityId);
  const currentParam = paramByKey(current.parameter);

  return (
    <>
      {/* Filter bar */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', padding: 'var(--s4) var(--s5)', borderBottom: '1px solid var(--border-default)', flexWrap: 'wrap' }}>
          <div className="tabs">
            {(['all', 'active', 'resolved'] as TabKey[]).map(t => (
              <button key={t} onClick={() => setTab(t)} className={'tab-btn' + (tab === t ? ' active' : '')}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <select className="form-control" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }} value={utility} onChange={e => setUtility(e.target.value)}>
            <option value="all">All Utilities</option>
            {UTILITIES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }} value={param} onChange={e => setParam(e.target.value)}>
            <option value="all">All Parameters</option>
            <option value="ph">pH</option>
            <option value="turbidity">Turbidity</option>
            <option value="ecoli">E. coli</option>
            <option value="totalColiforms">Total Coliforms</option>
            <option value="freeChlorine">Free Chlorine</option>
            <option value="nitrate">Nitrate (NO₃⁻)</option>
            <option value="fluoride">Fluoride</option>
            <option value="iron">Iron (Fe)</option>
            <option value="manganese">Manganese (Mn)</option>
            <option value="conductivity">Conductivity</option>
            <option value="tds">TDS</option>
            <option value="pressure">Mains Pressure</option>
            <option value="level">Reservoir Level</option>
          </select>
          <div className="search-box" style={{ flex: 1, maxWidth: 280 }}>
            <Search size={14} color="var(--text-muted)" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search alerts…" />
          </div>
        </div>
      </Card>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--s6)', alignItems: 'start' }}>
        {/* Alert list */}
        <Card>
          <CardHeader icon={<Bell size={16} />} title="Alert Feed" eyebrow={`${filtered.length} matching`} />
          {filtered.length === 0 && (
            <div style={{ padding: 'var(--s8)', textAlign: 'center', color: 'var(--text-muted)' }}>No alerts match your filters.</div>
          )}
          {filtered.map(a => {
            const util = utilityById(a.utilityId);
            const isActive = !a.resolved;
            const Icon = a.severity === 'danger' ? AlertOctagon : a.severity === 'warning' ? AlertTriangle : CheckCircle2;
            return (
              <div
                key={a.id}
                className="alert-item"
                style={{
                  cursor: 'pointer',
                  background: a.id === current.id ? 'var(--bg-hover)' : undefined,
                  opacity: isActive ? 1 : 0.65,
                  borderLeft: a.id === current.id ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onClick={() => setSelected(a.id)}
              >
                <div className={`alert-icon-wrap alert-icon-${a.severity === 'danger' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}`}>
                  <Icon size={16} />
                </div>
                <div className="alert-meta">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-desc">{util.name} — {a.description}</div>
                  <div className="alert-time">{a.triggered} · {a.id}</div>
                </div>
                <Badge tone={a.resolved ? 'neutral' : a.severity}>
                  {a.resolved ? 'Resolved' : a.severity === 'danger' ? 'Critical' : 'Warning'}
                </Badge>
              </div>
            );
          })}
        </Card>

        {/* Detail panel */}
        <Card>
          <div style={{ padding: 'var(--s5) var(--s6)', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--s2)' }}>
              <Badge tone={current.severity}>{current.severity === 'danger' ? 'Critical Alert' : 'Warning'}</Badge>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{current.id}</span>
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{current.title}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Triggered {current.triggered} {current.resolved ? `· Resolved ${current.resolved}` : '· unacknowledged'}
            </p>
          </div>
          <div style={{ padding: 'var(--s5) var(--s6)' }}>
            <div className="card-eyebrow" style={{ marginBottom: 'var(--s3)' }}>Measurement</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--s4)', marginBottom: 'var(--s5)' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Detected</div>
                <div className="mono" style={{ fontSize: '2rem', fontWeight: 700, color: current.severity === 'danger' ? 'var(--danger)' : 'var(--warning)' }}>{current.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentParam.unit}</div>
              </div>
              <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>vs</div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>WHO limit</div>
                <div className="mono" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{current.threshold}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentParam.unit}</div>
              </div>
            </div>

            <div className="card-eyebrow" style={{ marginBottom: 'var(--s3)' }}>Details</div>
            <DetailRow label="Utility"   value={<Link to={`/locations/${currentUtil.id}`} style={{ color: 'var(--accent)' }}>{currentUtil.name} →</Link>} />
            <DetailRow label="County"    value={currentUtil.county} />
            <DetailRow label="Parameter" value={currentParam.name} />
            <DetailRow label="Sensor"    value={<span className="mono">{currentUtil.sensorId}</span>} />
            <DetailRow label="Triggered" value={current.triggered} />

            <div style={{ display: 'flex', gap: 'var(--s2)', marginTop: 'var(--s5)' }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Acknowledge</button>
              <Link to={`/locations/${currentUtil.id}`} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Go to Location</Link>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function DetailRow(props: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{props.label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{props.value}</span>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, ShieldCheck, AlertTriangle, AlertOctagon, Bell,
  TrendingUp, Layers, Database, Download, Gauge,
} from 'lucide-react';
import { Card, CardHeader, CardBody, KpiCard, Badge, StatusDot } from '../components/ui';
import UtilityMap from '../components/UtilityMap';
import LocationFilter, { applyFilter, initialFilter } from '../components/LocationFilter';
import { ALERTS, UTILITIES, utilityById } from '../data/mockData';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const trend24h = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  value: 7.2 + 0.6 * Math.sin(i / 3) + 0.2 * Math.cos(i / 5),
}));

export default function Dashboard() {
  const [filter, setFilter] = useState(initialFilter);
  const filtered = useMemo(() => applyFilter(filter), [filter]);

  const safe    = UTILITIES.filter(u => u.status === 'safe').length;
  const warn    = UTILITIES.filter(u => u.status === 'warning').length;
  const danger  = UTILITIES.filter(u => u.status === 'danger').length;
  const counties = new Set(UTILITIES.map(u => u.county)).size;

  return (
    <>
      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard tone="accent" label="Utilities Online" value={UTILITIES.length} sub={`across ${counties} counties`} icon={<MapPin size={20} color="var(--accent)" />} />
        <KpiCard tone="safe"   label="Safe"             value={safe}            sub="within all WHO thresholds" icon={<ShieldCheck size={20} color="var(--safe)" />} />
        <KpiCard tone="warn"   label="Warnings"         value={warn}            sub="elevated readings"        icon={<AlertTriangle size={20} color="var(--warning)" />} />
        <KpiCard tone="danger" label="Critical"         value={danger}          sub="immediate attention"      icon={<AlertOctagon size={20} color="var(--danger)" />} />
      </div>

      {/* Map */}
      <Card>
        <CardHeader
          icon={<Layers size={16} />}
          title="Live Sensor Map"
          eyebrow="NETWORK"
          actions={<><button className="btn btn-sm btn-ghost">Satellite</button><button className="btn btn-sm btn-ghost">Terrain</button></>}
        />
        <UtilityMap height={380} utilities={filtered} />
      </Card>

      {/* Alerts + Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s6)' }}>
        <Card>
          <CardHeader
            icon={<Bell size={16} />}
            title="Active Alerts"
            actions={<Link to="/alerts" className="btn btn-sm btn-ghost">View all →</Link>}
          />
          {ALERTS.filter(a => !a.resolved).slice(0, 4).map(a => {
            const u = utilityById(a.utilityId);
            return (
              <div key={a.id} className="alert-item">
                <div className={`alert-icon-wrap alert-icon-${a.severity === 'danger' ? 'danger' : 'warning'}`}>
                  {a.severity === 'danger' ? <AlertOctagon size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div className="alert-meta">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-desc">{u.name} — {a.description}</div>
                  <div className="alert-time">{a.triggered}</div>
                </div>
                <Badge tone={a.severity}>{a.severity === 'danger' ? 'Critical' : 'Warning'}</Badge>
              </div>
            );
          })}
        </Card>

        <Card>
          <CardHeader
            icon={<TrendingUp size={16} />}
            title="Network pH Trend (24h)"
            eyebrow="NETWORK AVERAGE"
          />
          <CardBody>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend24h} margin={{ top: 10, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={3} />
                <YAxis domain={[6.8, 8.2]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Sensor Readings Table */}
      <Card>
        <CardHeader
          icon={<Database size={16} />}
          title="Latest Sensor Readings"
          eyebrow="ALL UTILITIES"
          actions={<button className="btn btn-sm btn-secondary"><Download size={14} /> Export</button>}
        />
        <LocationFilter value={filter} onChange={setFilter} total={UTILITIES.length} shown={filtered.length} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Utility</th>
                <th>Status</th>
                <th>pH</th>
                <th>Turbidity (NTU)</th>
                <th>E. coli (/100mL)</th>
                <th>Nitrate (mg/L)</th>
                <th>Free Cl (mg/L)</th>
                <th>Pressure (bar)</th>
                <th>Level (%)</th>
                <th>Last Update</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 'var(--s8)', color: 'var(--text-muted)' }}>No utilities match this filter.</td></tr>
              )}
              {filtered.map(u => {
                const r = u.readings;
                const tone = (val: number | undefined, max?: number, min?: number) => {
                  if (val == null) return '';
                  if (max != null && val > max) return 'var(--danger)';
                  if (min != null && val < min) return 'var(--warning)';
                  return 'var(--safe)';
                };
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                        <StatusDot status={u.status} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.county} County</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={u.status === 'safe' ? 'safe' : u.status === 'warning' ? 'warning' : 'danger'}>{u.status === 'safe' ? 'Safe' : u.status === 'warning' ? 'Warning' : 'Critical'}</Badge></td>
                    <td className="mono" style={{ color: tone(r.ph, 8.5, 6.5) }}>{r.ph}</td>
                    <td className="mono" style={{ color: tone(r.turbidity, 1) }}>{r.turbidity}</td>
                    <td className="mono" style={{ color: tone(r.ecoli, 0) }}>{r.ecoli}</td>
                    <td className="mono" style={{ color: tone(r.nitrate, 50) }}>{r.nitrate}</td>
                    <td className="mono" style={{ color: tone(r.freeChlorine, 1.0, 0.2) }}>{r.freeChlorine}</td>
                    <td className="mono" style={{ color: tone(r.pressure, 6, 2) }}>{r.pressure}</td>
                    <td className="mono" style={{ color: tone(r.level, 95, 20) }}>{r.level}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{u.lastUpdate}</td>
                    <td><Link to={`/locations/${u.id}`} className="btn btn-sm btn-secondary">View</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

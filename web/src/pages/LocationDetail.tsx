import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { TrendingUp, MapPin, Battery } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, MeterBar } from '../components/ui';
import UtilityMap from '../components/UtilityMap';
import { utilityById, ParameterKey, paramByKey, ALERTS } from '../data/mockData';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const seriesByParam: Record<string, number[]> = {
  nitrate:  [42, 45, 58, 71, 65, 72, 78],
  ph:       [7.4, 7.3, 7.2, 7.1, 7.3, 7.5, 7.1],
  ecoli:    [0, 0, 0, 1, 0, 0, 0],
  turbidity:[0.4, 0.5, 0.7, 0.9, 0.6, 0.8, 0.6],
  freeChlorine:[0.7, 0.6, 0.6, 0.5, 0.6, 0.7, 0.6],
  pressure: [4.1, 4.0, 4.2, 3.9, 4.3, 4.2, 4.2],
  level:    [82, 80, 79, 76, 78, 79, 78],
};

const tabs: { key: ParameterKey; label: string }[] = [
  { key: 'nitrate', label: 'Nitrate' },
  { key: 'ph', label: 'pH' },
  { key: 'ecoli', label: 'E. coli' },
  { key: 'turbidity', label: 'Turbidity' },
  { key: 'freeChlorine', label: 'Free Cl' },
  { key: 'pressure', label: 'Pressure' },
  { key: 'level', label: 'Level' },
];

export default function LocationDetail() {
  const { id } = useParams();
  const u = utilityById(id);
  const [activeTab, setActiveTab] = useState<ParameterKey>('nitrate');
  const param = paramByKey(activeTab);
  const data = useMemo(
    () => days.map((d, i) => ({ day: d, value: seriesByParam[activeTab][i] })),
    [activeTab],
  );

  const paramCards: { key: ParameterKey; status: 'safe' | 'warning' | 'danger' }[] = [
    { key: 'ph', status: 'safe' },
    { key: 'turbidity', status: 'safe' },
    { key: 'ecoli', status: 'safe' },
    { key: 'nitrate', status: 'danger' },
    { key: 'freeChlorine', status: 'safe' },
    { key: 'pressure', status: 'safe' },
    { key: 'level', status: 'safe' },
  ];

  const alerts = ALERTS.filter(a => a.utilityId === u.id);

  return (
    <>
      {/* Header strip */}
      <Card>
        <CardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{u.name}</h1>
              <Badge tone={u.status === 'safe' ? 'safe' : u.status === 'warning' ? 'warning' : 'danger'}>
                {u.status === 'safe' ? 'Safe' : u.status === 'warning' ? 'Warning' : 'Critical'}
              </Badge>
            </div>
            <div style={{ display: 'flex', gap: 'var(--s5)', marginTop: 6, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <span><MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />{u.county} County, Kenya</span>
              <span>{u.sensorId}</span>
              <span><Battery size={12} style={{ display: 'inline', marginRight: 4 }} />{u.battery}%</span>
              <span>Updated {u.lastUpdate}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s2)' }}>
            <button className="btn btn-secondary">Export Data</button>
            <button className="btn btn-primary">Acknowledge Alerts</button>
          </div>
        </CardBody>
      </Card>

      {/* Parameter cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--s4)' }}>
        {paramCards.map(p => {
          const def = paramByKey(p.key);
          const value = u.readings[p.key];
          const widthPct = Math.min(100, ((value ?? 0) / Math.max(def.whoMax ?? 100, 1)) * 100);
          return (
            <Card key={p.key} style={{ padding: 'var(--s5) var(--s6)' }}>
              <div className="kpi-label">{def.name}</div>
              <div className={`kpi-value ${p.status === 'danger' ? 'danger' : p.status === 'warning' ? 'warn' : 'safe'}`} style={{ marginTop: 6, fontSize: '1.5rem' }}>
                {value} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>{def.unit}</span>
              </div>
              <div style={{ margin: '8px 0' }}>
                <MeterBar value={widthPct} tone={p.status === 'danger' ? 'danger' : p.status === 'warning' ? 'warning' : 'safe'} />
              </div>
              <div style={{ fontSize: '0.75rem', color: p.status === 'danger' ? 'var(--danger)' : 'var(--text-muted)' }}>
                {p.status === 'danger' ? `⚠ Exceeds ${def.whoLabel}` : def.whoLabel}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader
          icon={<TrendingUp size={16} />}
          title="Parameter Trends"
          eyebrow="LAST 7 DAYS"
          actions={
            <div className="tabs">
              {tabs.map(t => (
                <button
                  key={t.key}
                  className={'tab-btn' + (activeTab === t.key ? ' active' : '')}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
              {param.whoMax != null && (
                <ReferenceLine y={param.whoMax} stroke="var(--danger)" strokeDasharray="4 3" label={{ value: param.whoLabel, fill: 'var(--danger)', fontSize: 10, position: 'right' }} />
              )}
              <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent)' }} />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--s6)' }}>
        {/* Alert history */}
        <Card>
          <CardHeader title="Alert History" eyebrow="THIS LOCATION" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Parameter</th><th>Value</th><th>Threshold</th><th>Severity</th><th>Triggered</th><th>Resolved</th></tr>
              </thead>
              <tbody>
                {alerts.map(a => {
                  const def = paramByKey(a.parameter);
                  return (
                    <tr key={a.id}>
                      <td>{def.name}</td>
                      <td className="mono" style={{ color: a.severity === 'danger' ? 'var(--danger)' : 'var(--warning)' }}>{a.value} {def.unit}</td>
                      <td className="mono">{a.threshold} {def.unit}</td>
                      <td><Badge tone={a.severity}>{a.severity === 'danger' ? 'Critical' : 'Warning'}</Badge></td>
                      <td style={{ color: 'var(--text-muted)' }}>{a.triggered}</td>
                      <td style={{ color: a.resolved ? 'var(--safe)' : 'var(--text-muted)' }}>{a.resolved ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mini map + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s6)' }}>
          <Card>
            <CardHeader title="Location Info" />
            <CardBody style={{ padding: 'var(--s4) var(--s5)' }}>
              <Info label="Utility" value={`${u.name} & Sewerage Co.`} />
              <Info label="County" value={u.county} />
              <Info label="Sensor" value={u.sensorId} mono />
              <Info label="Installed" value={u.installed} />
              <Info label="Update Rate" value="Every 15 min" />
              <Info label="Battery" value={`${u.battery}%`} accent={u.battery < 30 ? 'warning' : undefined} />
            </CardBody>
          </Card>
          <Card style={{ padding: 0 }}>
            <UtilityMap height={220} utilities={[u]} />
          </Card>
        </div>
      </div>

      <div style={{ paddingTop: 'var(--s4)' }}>
        <Link to="/dashboard" className="btn btn-ghost">← Back to Dashboard</Link>
      </div>
    </>
  );
}

function Info(props: { label: string; value: React.ReactNode; mono?: boolean; accent?: 'warning' | 'danger' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s2) 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{props.label}</span>
      <span className={props.mono ? 'mono' : ''} style={{ color: props.accent ? `var(--${props.accent})` : 'var(--text-primary)', fontWeight: 500 }}>{props.value}</span>
    </div>
  );
}

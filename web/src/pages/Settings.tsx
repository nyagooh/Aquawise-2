import { useState } from 'react';
import { Cog, Cpu, Bell as BellIcon, Database, Palette } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../components/ui';
import { UTILITIES, PARAMETERS } from '../data/mockData';

const tabs = [
  { id: 'thresholds', label: 'WHO Thresholds', icon: Cog },
  { id: 'sensors',    label: 'Sensors',         icon: Cpu },
  { id: 'alerts',     label: 'Alert Rules',     icon: BellIcon },
  { id: 'data',       label: 'Data & Export',   icon: Database },
  { id: 'display',    label: 'Display',         icon: Palette },
];

const thresholdRows = PARAMETERS.map(p => ({
  name: p.name,
  hint: p.whoLabel,
  warnMin: p.whoMin?.toString() ?? '—',
  warnMax: p.whoMax?.toString() ?? '—',
  critical: p.whoMax != null ? (p.whoMax * 1.4).toFixed(p.whoMax < 1 ? 2 : 0) : '—',
}));

export default function Settings() {
  const [tab, setTab] = useState('thresholds');

  return (
    <>
      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        {tabs.map(t => (
          <button key={t.id} className={'tab-btn' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            <t.icon size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'thresholds' && (
        <Card>
          <CardHeader title="WHO Parameter Thresholds" eyebrow="Drinking Water Guidelines" actions={<><button className="btn btn-secondary">Reset to WHO</button><button className="btn btn-primary">Save</button></>} />
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 'var(--s3) var(--s4)', alignItems: 'center' }}>
              <div className="card-eyebrow">Parameter</div>
              <div className="card-eyebrow" style={{ textAlign: 'right' }}>Warning Min</div>
              <div className="card-eyebrow" style={{ textAlign: 'right' }}>Warning Max</div>
              <div className="card-eyebrow" style={{ textAlign: 'right' }}>Critical</div>
              {thresholdRows.map(r => (
                <Row key={r.name} {...r} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'sensors' && (
        <Card>
          <CardHeader title="Sensor Management" actions={<button className="btn btn-primary">+ Add Sensor</button>} />
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            {UTILITIES.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)', padding: 'var(--s3) var(--s4)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', background: 'var(--bg-card)' }}>
                <span className={`status-dot dot-${u.status === 'safe' ? 'safe' : u.status === 'warning' ? 'warning' : 'danger'}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.sensorId} · {u.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.county} County · {u.lat.toFixed(3)}°, {u.lng.toFixed(3)}° · Battery {u.battery}%</div>
                </div>
                <select className="form-control" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8125rem' }}>
                  <option>15 min</option><option>5 min</option><option>1 hour</option>
                </select>
                <Badge tone={u.battery < 30 ? 'warning' : 'safe'}>{u.battery}% battery</Badge>
                <button className="btn btn-sm btn-ghost">Edit</button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === 'alerts' && (
        <Card>
          <CardHeader title="Alert Rules" />
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
            <Toggle label="Critical alerts (email)"   sub="Immediate email for critical threshold breaches" defaultOn />
            <Toggle label="Warning alerts (email)"    sub="Email for warning-level readings" defaultOn />
            <Toggle label="Push notifications"        sub="Browser push for all active alerts" defaultOn />
            <Toggle label="Daily digest"              sub="Daily summary email at 8:00 AM" />
            <Toggle label="Sensor offline alerts"     sub="Notify when sensor goes offline (> 30 min)" defaultOn />
            <Toggle label="Weekly report"             sub="Weekly PDF report via email" />
          </CardBody>
        </Card>
      )}

      {tab === 'data' && (
        <Card>
          <CardHeader title="Data & Export" />
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
            <Toggle label="Daily CSV export"  sub="Export all readings to email at midnight" />
            <Toggle label="Weekly PDF report" sub="Summary report every Monday 8 AM" defaultOn />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
              <label className="form-label">Keep readings for</label>
              <select className="form-control"><option>6 months</option><option>1 year</option><option>2 years</option><option>Forever</option></select>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'display' && (
        <Card>
          <CardHeader title="Display Preferences" />
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
            <Field label="Theme">
              <select className="form-control" style={{ maxWidth: 240 }}>
                <option>Auto (System)</option><option>Dark</option><option>Light</option>
              </select>
            </Field>
            <Field label="Unit System">
              <select className="form-control" style={{ maxWidth: 280 }}>
                <option>WHO (mg/L, NTU, µS/cm, CFU/100mL)</option>
                <option>Imperial (mg/L, NTU, °F)</option>
              </select>
            </Field>
            <Field label="Map Style">
              <select className="form-control" style={{ maxWidth: 240 }}>
                <option>Auto</option><option>Dark</option><option>Light</option>
              </select>
            </Field>
            <Toggle label="Show sensor pulse animations" defaultOn />
            <Toggle label="Auto-refresh dashboard"      sub="Update readings every 60 seconds" defaultOn />
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Row(props: { name: string; hint: string; warnMin: string; warnMax: string; critical: string }) {
  return (
    <>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{props.name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{props.hint}</div>
      </div>
      <input className="form-control" defaultValue={props.warnMin} style={{ textAlign: 'right' }} />
      <input className="form-control" defaultValue={props.warnMax} style={{ textAlign: 'right' }} />
      <input className="form-control" defaultValue={props.critical} style={{ textAlign: 'right', borderColor: 'rgba(239,68,68,0.4)' }} />
    </>
  );
}

function Toggle(props: { label: string; sub?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(props.defaultOn ?? false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--s3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{props.label}</div>
        {props.sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{props.sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => setOn(!on)}
        style={{
          width: 36, height: 20,
          borderRadius: 999,
          background: on ? 'var(--accent)' : 'var(--bg-input)',
          border: '1px solid ' + (on ? 'var(--accent-dim)' : 'var(--border-default)'),
          position: 'relative',
          transition: 'background 150ms ease',
          cursor: 'pointer',
        }}
        aria-pressed={on}
      >
        <span style={{ position: 'absolute', top: 1, left: on ? 17 : 1, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 150ms ease' }} />
      </button>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="form-label">{props.label}</label>
      {props.children}
    </div>
  );
}

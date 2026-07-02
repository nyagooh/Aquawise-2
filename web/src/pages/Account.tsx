import { Card, CardHeader, CardBody, Badge } from '../components/ui';
import { UTILITIES } from '../data/mockData';

export default function Account() {
  return (
    <>
      <Card>
        <CardHeader title="Profile" eyebrow="ACCOUNT" />
        <CardBody style={{ display: 'flex', alignItems: 'center', gap: 'var(--s5)' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>TL</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>Tlou Letshufi</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>tlou.letshufi@aquawatch.co.ke</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Utility Operator · Member since Jan 2024</div>
          </div>
          <button className="btn btn-secondary">Edit Profile</button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Assigned Utilities" actions={<button className="btn btn-sm btn-primary">+ Assign</button>} />
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          {UTILITIES.slice(0, 4).map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)', padding: 'var(--s3) var(--s4)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', background: 'var(--bg-card)' }}>
              <span className={`status-dot dot-${u.status === 'safe' ? 'safe' : u.status === 'warning' ? 'warning' : 'danger'}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.sensorId}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.name} · Last seen {u.lastUpdate}</div>
              </div>
              <Badge tone={u.status === 'safe' ? 'safe' : u.status === 'warning' ? 'warning' : 'danger'}>
                {u.status === 'safe' ? 'Safe' : u.status === 'warning' ? 'Warning' : 'Critical'}
              </Badge>
              <button className="btn btn-sm btn-ghost">Unassign</button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="API Access" eyebrow="INTEGRATIONS" />
        <CardBody>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--s4)' }}>
            Generate a personal API token for programmatic access to your utility data.
          </p>
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
            <input className="form-control mono" readOnly value="aw_live_•••••••••••••••••••••••••••••" style={{ flex: 1, maxWidth: 460 }} />
            <button className="btn btn-secondary">Reveal</button>
            <button className="btn btn-primary">Regenerate</button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

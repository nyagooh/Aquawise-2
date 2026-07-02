/**
 * Leaks — customer-support-fed leak feed + plumber resolution form.
 *
 * Tickets are *not* created here — they are pulled in from the utility's
 * customer-support system (CSR call/chat/email). A plumber dispatched to a
 * leak files the fix from the side panel here, capturing zone + pipe, leak
 * type, cause, materials, cost, timing, crew, and photo evidence.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { leaks as initialLeaks, type Leak, type LeakStatus, type LeakSeverity, pipes as allPipes, zones as allZones } from '../data';
import { zoneLabel as networkZoneLabel, isRealZone } from '../data/network';

type Filter = 'all' | LeakStatus;

const STATUS_LABEL: Record<LeakStatus, string> = {
  reported: 'Reported',
  dispatched: 'Dispatched',
  in_progress: 'In progress',
  fixed: 'Fixed'
};

const STATUS_PILL: Record<LeakStatus, 'safe' | 'warn' | 'danger' | 'info' | 'muted'> = {
  reported: 'danger',
  dispatched: 'warn',
  in_progress: 'info',
  fixed: 'safe'
};

const SEVERITY_COLOR: Record<LeakSeverity, string> = {
  minor: 'hsl(var(--info))',
  major: 'hsl(var(--warning))',
  critical: 'hsl(var(--danger))'
};

export default function Leaks() {
  const navigate = useNavigate();
  const [leaks, setLeaks] = useState<Leak[]>(initialLeaks);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => ({
    critical:   leaks.filter(l => l.severity === 'critical' && l.status !== 'fixed').length,
    pending:    leaks.filter(l => l.status === 'reported').length,
    inProgress: leaks.filter(l => l.status === 'in_progress' || l.status === 'dispatched').length,
    fixed:      leaks.filter(l => l.status === 'fixed').length
  }), [leaks]);

  const list = filter === 'all' ? leaks : leaks.filter(l => l.status === filter);
  const openLeak = openId ? leaks.find(l => l.id === openId) : null;

  const onSaveFix = (updated: Leak) => {
    setLeaks(prev => prev.map(l => l.id === updated.id ? updated : l));
    setOpenId(null);
  };

  return (
    <Shell active="leaks" title="Leaks" sub={`Customer-support feed · ${leaks.length} tickets · ${stats.pending} awaiting dispatch · ${stats.fixed} fixed`}>
      <div className="ops-card" style={{ padding: 0 }}>
        <div className="alerts-filter-bar">
          {(['all', 'reported', 'dispatched', 'in_progress', 'fixed'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`alerts-filter${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              <span style={{ textTransform: 'capitalize' }}>{f === 'all' ? 'All' : STATUS_LABEL[f as LeakStatus]}</span>
              <span className="alerts-filter-count">
                {f === 'all' ? leaks.length : leaks.filter(l => l.status === f).length}
              </span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span className="pill safe" title="Customer-support connector status"><span className="dot" />CSR feed · live</span>
          <button className="btn btn-ghost btn-sm" onClick={() => exportLeaksCsv(leaks)}>Export CSV</button>
        </div>

        <table className="alerts-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Caller</th>
              <th>Zone</th>
              <th>Pipe</th>
              <th>Severity</th>
              <th>Reported</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="alerts-empty">No leaks match this filter.</td>
              </tr>
            )}
            {list.map((l) => (
              <tr key={l.id} onClick={() => setOpenId(l.id)}>
                <td className="mono"><strong>{l.id}</strong></td>
                <td>
                  <strong>{l.caller}</strong>
                  <div className="alerts-detail">{l.phone} · {l.source}</div>
                </td>
                <td>{networkZoneLabelSafe(l.zone)}</td>
                <td className="mono">{l.pipe || '—'}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, textTransform: 'capitalize', color: SEVERITY_COLOR[l.severity] }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 6px currentColor' }} />
                    {l.severity}
                  </span>
                </td>
                <td className="mono" style={{ fontSize: '0.8125rem' }}>{l.reported}</td>
                <td>
                  <span className={`pill ${STATUS_PILL[l.status]}`}>
                    <span className="dot" />{STATUS_LABEL[l.status]}
                  </span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Show this leak on the GIS map"
                    onClick={(e) => { e.stopPropagation(); navigate(`/gis?focus=leak:${l.id}`); }}
                    style={{ marginRight: 6 }}
                  >
                    Map
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); setOpenId(l.id); }}
                  >
                    {l.status === 'fixed' ? 'View fix' : 'File fix'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openLeak && (
        <PlumberPanel
          leak={openLeak}
          onClose={() => setOpenId(null)}
          onSave={onSaveFix}
        />
      )}
    </Shell>
  );
}

function networkZoneLabelSafe(zone: string): string {
  const fromMock = allZones.find(z => z.id === zone);
  if (fromMock) return fromMock.name;
  return isRealZone(zone) ? networkZoneLabel(zone) : zone;
}

function PlumberPanel({ leak, onClose, onSave }: {
  leak: Leak;
  onClose: () => void;
  onSave: (l: Leak) => void;
}) {
  const isFixed = leak.status === 'fixed';
  const [form, setForm] = useState<Leak>(leak);

  const set = <K extends keyof Leak>(key: K, value: Leak[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const submit = () => {
    onSave({ ...form, status: 'fixed' });
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="leak-modal-backdrop" onClick={onClose}>
      <div className="leak-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="leak-modal-head">
          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'hsl(var(--muted-foreground))', fontWeight: 700 }}>
              Plumber resolution
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: 4 }}>
              {leak.id} · {leak.caller}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
              {networkZoneLabelSafe(leak.zone)} · Reported {leak.reported}
            </div>
            <div style={{ marginTop: 8 }}>
              <span className={`pill ${STATUS_PILL[leak.status]}`}>
                <span className="dot" />{STATUS_LABEL[leak.status]}
              </span>
            </div>
          </div>
          <button className="sp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="leak-modal-body">
          <div style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'hsl(var(--danger-bg))',
            border: '1px solid hsl(var(--danger) / 0.3)',
            fontSize: '0.8125rem',
            margin: '16px 0 18px'
          }}>
            <strong style={{ color: 'hsl(var(--foreground))' }}>Reported by {leak.caller}:</strong> {leak.notes}
          </div>

          <FormSection title="Location">
            <FormGrid>
              <FormField label="Zone">
                <select disabled={isFixed} value={form.zone} onChange={e => set('zone', e.target.value)}>
                  {allZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </FormField>
              <FormField label="Pipe / segment">
                <select disabled={isFixed} value={form.pipe || ''} onChange={e => set('pipe', e.target.value || undefined)}>
                  <option value="">—</option>
                  {allPipes.map(p => <option key={p.id} value={p.id}>{p.id} · {p.type} {p.diameter}</option>)}
                </select>
              </FormField>
            </FormGrid>
            <FormField label="Address">
              <input type="text" disabled={isFixed} value={form.address} onChange={e => set('address', e.target.value)} />
            </FormField>
          </FormSection>

          <FormSection title="Leak details">
            <FormGrid>
              <FormField label="Leak type">
                <select disabled={isFixed} value={form.leakType || ''} onChange={e => set('leakType', (e.target.value || undefined) as Leak['leakType'])}>
                  <option value="">—</option>
                  <option>Burst</option>
                  <option>Joint failure</option>
                  <option>Hairline crack</option>
                  <option>Meter leak</option>
                  <option>Valve leak</option>
                </select>
              </FormField>
              <FormField label="Severity">
                <select disabled={isFixed} value={form.severity} onChange={e => set('severity', e.target.value as LeakSeverity)}>
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </FormField>
            </FormGrid>
            <FormField label="Cause">
              <input type="text" disabled={isFixed} value={form.cause || ''} onChange={e => set('cause', e.target.value)} placeholder="e.g. old joint, third-party damage" />
            </FormField>
            <FormField label="Fix description">
              <textarea disabled={isFixed} value={form.fixDescription || ''} onChange={e => set('fixDescription', e.target.value)} placeholder="Describe what was done…" rows={3} />
            </FormField>
          </FormSection>

          <FormSection title="Materials & cost">
            <FormGrid>
              <FormField label="Materials used">
                <input type="text" disabled={isFixed} value={form.materials || ''} onChange={e => set('materials', e.target.value)} placeholder="e.g. 1m PVC, clamp, washers" />
              </FormField>
              <FormField label="Total cost">
                <input type="text" disabled={isFixed} value={form.cost || ''} onChange={e => set('cost', e.target.value)} placeholder="KES" />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Timing & crew">
            <FormGrid>
              <FormField label="Time started">
                <input type="text" disabled={isFixed} value={form.timeStarted || ''} onChange={e => set('timeStarted', e.target.value)} placeholder="HH:MM" />
              </FormField>
              <FormField label="Time fixed">
                <input type="text" disabled={isFixed} value={form.timeFixed || ''} onChange={e => set('timeFixed', e.target.value)} placeholder="HH:MM" />
              </FormField>
            </FormGrid>
            <FormField label="Plumber / crew">
              <input type="text" disabled={isFixed} value={form.crew || ''} onChange={e => set('crew', e.target.value)} placeholder="e.g. Crew A · Otieno" />
            </FormField>
            <FormField label="Photos (before / after)">
              <div style={{
                border: '1px dashed hsl(var(--border))',
                borderRadius: 8, padding: 14,
                textAlign: 'center',
                color: 'hsl(var(--muted-foreground))',
                fontSize: '0.8125rem',
                cursor: isFixed ? 'default' : 'pointer'
              }}>
                {isFixed ? 'Photos archived with ticket' : '+ Click to attach photos'}
              </div>
            </FormField>
          </FormSection>
        </div>

        <div className="leak-modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {isFixed ? 'Close' : 'Cancel'}
          </button>
          {!isFixed && (
            <button className="btn btn-primary btn-sm" onClick={submit}>Mark as fixed</button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid hsl(var(--border))' }}>
      <h4 style={{
        fontSize: '0.6875rem', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'hsl(var(--muted-foreground))',
        margin: '0 0 12px'
      }}>{title}</h4>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
      <span style={{
        fontSize: '0.75rem', fontWeight: 600,
        color: 'hsl(var(--muted-foreground))'
      }}>{label}</span>
      <span className="leak-field-control">{children}</span>
    </label>
  );
}

function exportLeaksCsv(rows: Leak[]) {
  const headers = ['Ticket', 'Reported', 'Caller', 'Phone', 'Source', 'Zone', 'Address', 'Pipe', 'Severity', 'Status', 'Notes', 'Leak type', 'Cause', 'Fix description', 'Materials', 'Cost', 'Time started', 'Time fixed', 'Crew'];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(l => [
      l.id, l.reported, l.caller, l.phone, l.source, l.zone, l.address, l.pipe || '',
      l.severity, l.status, l.notes,
      l.leakType || '', l.cause || '', l.fixDescription || '',
      l.materials || '', l.cost || '', l.timeStarted || '', l.timeFixed || '', l.crew || ''
    ].map(esc).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aquawise-leaks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

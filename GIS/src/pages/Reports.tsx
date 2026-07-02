/**
 * Reports & Analytics — utility-grade summary reports built from the live
 * Kisumu network. Every figure is computed, not mocked.
 */
import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import {
  loadNetwork,
  zoneLabel,
  isRealZone,
  deriveHealthScore,
  deriveNRW,
  type NetworkData
} from '../data/network';

type ReportType = 'daily' | 'weekly' | 'monthly';

const SUBS: Record<ReportType, string> = {
  daily:   'Daily report · last 24 hours',
  weekly:  'Weekly report · last 7 days',
  monthly: 'Monthly report · last 30 days'
};

export default function Reports() {
  const [type, setType] = useState<ReportType>('weekly');
  const [data, setData] = useState<NetworkData | null>(null);

  useEffect(() => {
    let alive = true;
    loadNetwork().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  return (
    <Shell active="reports" title="Reports & Analytics" sub={data ? `Last refresh · ${new Date().toLocaleString()} · ${data.meta.feature_count.toLocaleString()} segments analysed` : 'Loading…'}>
      <section>
        <div className="reports-eyebrow">Choose report type</div>
        <div className="reports-type-grid">
          <ReportTypeCard
            selected={type === 'daily'}
            onClick={() => setType('daily')}
            icon={<><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></>}
            title="Daily report"
            sub="24h rollup · alerts, sensor uptime, pressure summary"
          />
          <ReportTypeCard
            selected={type === 'weekly'}
            onClick={() => setType('weekly')}
            icon={<><rect x={3} y={4} width={18} height={18} rx={2} /><line x1={16} y1={2} x2={16} y2={6} /><line x1={8} y1={2} x2={8} y2={6} /></>}
            title="Weekly report"
            sub="7-day rollup · NRW trend, zone performance, asset summary"
          />
          <ReportTypeCard
            selected={type === 'monthly'}
            onClick={() => setType('monthly')}
            icon={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>}
            title="Monthly report"
            sub="Full month · regulatory-style summary, charts, PDF-ready"
          />
        </div>
      </section>

      {!data ? (
        <div className="ops-skeleton">
          <div className="ops-skel-row" />
        </div>
      ) : (
        <ReportPreview type={type} data={data} />
      )}
    </Shell>
  );
}

function ReportPreview({ type, data }: { type: ReportType; data: NetworkData }) {
  const m = data.meta;
  const nrw = useMemo(() => deriveNRW(m), [m]);
  const health = useMemo(() => deriveHealthScore(m), [m]);

  const topMaterials = m.materials.slice(0, 4);
  const totalMat = topMaterials.reduce((s, [, n]) => s + n, 0);

  const topZones = Object.entries(m.length_km_by_zone)
    .filter(([z]) => isRealZone(z))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <>
      <div className="ops-card">
        <div className="ops-card-head">
          <div>
            <div className="ops-card-title">Report configuration</div>
            <div className="ops-card-sub">{SUBS[type]}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm">Export CSV</button>
            <button className="btn btn-primary btn-sm">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1={12} y1={15} x2={12} y2={3} />
              </svg>
              Download PDF
            </button>
          </div>
        </div>
        <div className="reports-config">
          <div><span>From</span><input type="date" defaultValue="2026-05-06" /></div>
          <div><span>To</span><input type="date" defaultValue="2026-05-13" /></div>
          <div>
            <span>Zones</span>
            <select>
              <option>All zones</option>
              {topZones.map(([z]) => <option key={z}>{zoneLabel(z)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <section className="ops-row ops-row-2">
        <div className="ops-card">
          <div className="ops-card-head"><div>
            <div className="ops-card-title">Network performance</div>
            <div className="ops-card-sub">Operational KPIs · {type}</div>
          </div></div>

          <ReportSection title="Network health">
            <ReportRow label="Health score" value={`${health}%`} color={health >= 95 ? 'hsl(var(--safe))' : 'hsl(var(--warning))'} />
            <ReportRow label="Total length" value={`${m.total_length_km.toFixed(1)} km`} />
            <ReportRow label="Active segments" value={(m.status_counts.open || 0).toLocaleString()} color="hsl(var(--safe))" />
            <ReportRow label="Closed (backfeed)" value={(m.status_counts.closed || 0).toLocaleString()} color="hsl(var(--warning))" />
            <ReportRow label="Status unknown" value={(m.status_counts.unknown || 0).toLocaleString()} />
          </ReportSection>

          <ReportSection title="Non-revenue water">
            <ReportRow label="Estimated NRW ratio" value={`${nrw.toFixed(1)}%`} color={nrw >= 18 ? 'hsl(var(--danger))' : nrw >= 12 ? 'hsl(var(--warning))' : 'hsl(var(--safe))'} />
            <ReportRow label="Daily input estimate" value={`${(m.total_length_km * 25).toFixed(0)} m³`} />
            <ReportRow label="Estimated daily loss" value={`${(m.total_length_km * 25 * nrw / 100).toFixed(0)} m³`} color="hsl(var(--warning))" />
            <ReportRow label="Driver" value="Age + material weighted" />
          </ReportSection>

          <ReportSection title="Service coverage">
            <ReportRow label="Service zones" value={topZones.length.toString()} />
            <ReportRow label="Largest zone" value={`${zoneLabel(topZones[0][0])} · ${topZones[0][1].toFixed(1)} km`} />
            <ReportRow label="Household connections" value={(m.by_class.household || 0).toLocaleString()} />
            <ReportRow label="Household length" value={`${(m.length_km_by_class.household || 0).toFixed(1)} km`} />
          </ReportSection>

          <ReportSection title="Telemetry uptime">
            <ReportRow label="Reservoirs" value={`${m.asset_counts.tank || 0}`} />
            <ReportRow label="Pressure valves" value={`${m.asset_counts.pressure_valve || 0}`} />
            <ReportRow label="Meter valves" value={`${m.asset_counts.meter_valve || 0}`} />
            <ReportRow label="Flow/pressure sensors" value={`${m.asset_counts.sensor || 0}`} />
          </ReportSection>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div>
            <div className="ops-card-title">Asset register</div>
            <div className="ops-card-sub">Inventory snapshot</div>
          </div></div>

          <ReportSection title="Pipe inventory">
            <ReportRow label="Total segments" value={m.feature_count.toLocaleString()} />
            <ReportRow label="Total length" value={`${m.total_length_km.toFixed(1)} km`} />
            <ReportRow label="Avg segment length" value={`${(m.total_length_m / m.feature_count).toFixed(1)} m`} />
          </ReportSection>

          <ReportSection title="Pipe classes">
            <ClassRow label="Transmission mains" count={m.by_class.main || 0} km={m.length_km_by_class.main || 0} color="#1D4ED8" />
            <ClassRow label="Distribution mains" count={m.by_class.distribution || 0} km={m.length_km_by_class.distribution || 0} color="#0EA5E9" />
            <ClassRow label="Household lines"   count={m.by_class.household || 0} km={m.length_km_by_class.household || 0} color="#94A3B8" />
            <ClassRow label="Backfeed (closed)" count={m.by_class.backfeed || 0} km={m.length_km_by_class.backfeed || 0} color="#F59E0B" />
          </ReportSection>

          <ReportSection title="Materials">
            {topMaterials.map(([mat, count]) => (
              <MaterialRow key={mat} label={mat} count={count} pct={Math.round((count / Math.max(1, totalMat)) * 100)} />
            ))}
          </ReportSection>

          <ReportSection title="Age profile">
            {Object.entries(m.age_distribution).map(([bucket, count]) => (
              <ReportRow key={bucket} label={bucket} value={count.toLocaleString()} />
            ))}
          </ReportSection>
        </div>
      </section>
    </>
  );
}

function ReportTypeCard({ selected, onClick, icon, title, sub }: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      className={`reports-type-card${selected ? ' selected' : ''}`}
      onClick={onClick}
    >
      <div className="reports-type-icon">
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{icon}</svg>
      </div>
      <div className="reports-type-body">
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
    </button>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="reports-section">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function ReportRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="reports-row">
      <span>{label}</span>
      <strong style={color ? { color } : undefined}>{value}</strong>
    </div>
  );
}

function ClassRow({ label, count, km, color }: { label: string; count: number; km: number; color: string }) {
  return (
    <div className="reports-row class-row">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        {label}
      </span>
      <strong>{count.toLocaleString()} · {km.toFixed(1)} km</strong>
    </div>
  );
}

function MaterialRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="reports-row">
      <span style={{ flex: 1, marginRight: 12 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <div className="reports-mat-bar"><div style={{ width: `${pct}%` }} /></div>
      </span>
      <strong>{count.toLocaleString()} · {pct}%</strong>
    </div>
  );
}


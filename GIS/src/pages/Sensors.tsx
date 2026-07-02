/**
 * Sensors — every measuring device deployed across the Kisumu network.
 *
 * One filter bar, one table. Filter chips let the operator focus on a
 * specific sensor family (pressure, pH, turbidity, tank level, or valves).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell } from '../components/Shell';
import {
  loadNetwork,
  type NetworkData,
  type AssetFeature
} from '../data/network';

type Filter = 'all' | 'pressure' | 'ph' | 'turbidity' | 'level' | 'valve';

const FILTER_LABEL: Record<Filter, string> = {
  all:       'All sensors',
  pressure:  'Pressure (bar)',
  ph:        'pH probes',
  turbidity: 'Turbidity (NTU)',
  level:     'Tank level (%)',
  valve:     'Valves'
};

/** Map an asset to one of our filter families (or null to skip). */
function familyOf(a: AssetFeature): Exclude<Filter, 'all'> | null {
  const p = a.properties;
  if (p.asset === 'tank') return 'level';
  if (p.asset === 'pressure_valve' || p.asset === 'meter_valve') return 'valve';
  if (p.asset === 'sensor') {
    if (p.subtype === 'ph') return 'ph';
    if (p.subtype === 'turbidity') return 'turbidity';
    return 'pressure'; // flow + pressure node
  }
  return null;
}

function familyLabel(a: AssetFeature): string {
  const fam = familyOf(a);
  if (fam === 'pressure')  return 'Pressure sensor';
  if (fam === 'ph')        return 'pH probe';
  if (fam === 'turbidity') return 'Turbidity probe';
  if (fam === 'level')     return 'Tank level sensor';
  if (fam === 'valve')     return a.properties.asset === 'pressure_valve' ? 'Pressure valve' : 'Meter valve';
  return '—';
}

function familyDot(a: AssetFeature): string {
  const fam = familyOf(a);
  if (fam === 'pressure')  return '#EF4444';
  if (fam === 'ph')        return '#9333EA';
  if (fam === 'turbidity') return '#06B6D4';
  if (fam === 'level')     return '#1D4ED8';
  if (fam === 'valve')     return a.properties.asset === 'pressure_valve' ? '#10B981' : '#F97316';
  return '#94A3B8';
}

export default function Sensors() {
  const navigate = useNavigate();
  const [data, setData] = useState<NetworkData | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let alive = true;
    loadNetwork().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, pressure: 0, ph: 0, turbidity: 0, level: 0, valve: 0 };
    if (!data) return c;
    for (const a of data.assets) {
      const fam = familyOf(a);
      if (fam) { c[fam]++; c.all++; }
    }
    return c;
  }, [data]);

  const list = useMemo<AssetFeature[]>(() => {
    if (!data) return [];
    return data.assets.filter((a) => {
      const fam = familyOf(a);
      if (!fam) return false;
      return filter === 'all' || fam === filter;
    });
  }, [data, filter]);

  const sub = data
    ? `${counts.all} sensors · ${counts.pressure} pressure · ${counts.ph} pH · ${counts.turbidity} turbidity · ${counts.level} tank · ${counts.valve} valves`
    : 'Loading…';

  return (
    <Shell active="sensors" title="Sensors" sub={sub}>
      <div className="ops-card" style={{ padding: 0 }}>
        <div className="alerts-filter-bar">
          {(['all', 'pressure', 'ph', 'turbidity', 'level', 'valve'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`alerts-filter${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              <span>{FILTER_LABEL[f]}</span>
              <span className="alerts-filter-count">{counts[f]}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" onClick={() => exportSensorsCsv(list)}>Export CSV</button>
        </div>

        <table className="alerts-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Sensor type</th>
              <th>Name / location</th>
              <th>Latest reading</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6} className="alerts-empty">No sensors match this filter.</td></tr>
            )}
            {list.map((a) => {
              const p = a.properties;
              return (
                <tr key={p.id} onClick={() => navigate(`/gis?focus=asset:${p.id}`)}>
                  <td className="mono"><strong>{p.id}</strong></td>
                  <td>
                    <span className="sensors-kind">
                      <span className="sensors-kind-dot" style={{ background: familyDot(a) }} />
                      {familyLabel(a)}
                    </span>
                  </td>
                  <td>{p.name}</td>
                  <td>{renderReading(a)}</td>
                  <td>
                    <span className={`pill ${p.status === 'ok' ? 'safe' : p.status === 'warn' ? 'warn' : 'danger'}`}>
                      <span className="dot" />
                      {p.status === 'ok' ? 'Online' : p.status === 'warn' ? 'Anomaly' : 'Alarm'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/gis?focus=asset:${p.id}`); }}
                    >View on map</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function renderReading(a: AssetFeature) {
  const p = a.properties;
  if (p.asset === 'sensor') {
    if (p.subtype === 'ph' && p.ph != null)              return <span className="mono">pH {p.ph}</span>;
    if (p.subtype === 'turbidity' && p.turbidity_ntu != null) return <span className="mono">{p.turbidity_ntu} NTU</span>;
    return <span className="mono">{p.flow_lps} L/s · {p.pressure_bar} bar</span>;
  }
  if (p.asset === 'tank')           return <span className="mono">{p.level_pct}% · {p.inflow_lps}/{p.outflow_lps} L/s</span>;
  if (p.asset === 'pressure_valve') return <span className="mono">{p.live_bar} bar (set {p.set_bar})</span>;
  return <span className="mono">⌀{p.size_mm} mm · {p.state} · {p.consumption_m3d} m³/d</span>;
}

function readingText(a: AssetFeature): string {
  const p = a.properties;
  if (p.asset === 'sensor') {
    if (p.subtype === 'ph' && p.ph != null)              return `pH ${p.ph}`;
    if (p.subtype === 'turbidity' && p.turbidity_ntu != null) return `${p.turbidity_ntu} NTU`;
    return `${p.flow_lps} L/s · ${p.pressure_bar} bar`;
  }
  if (p.asset === 'tank')           return `${p.level_pct}% · ${p.inflow_lps}/${p.outflow_lps} L/s`;
  if (p.asset === 'pressure_valve') return `${p.live_bar} bar (set ${p.set_bar})`;
  return `${p.size_mm}mm · ${p.state} · ${p.consumption_m3d} m³/d`;
}

function exportSensorsCsv(rows: AssetFeature[]) {
  const headers = ['ID', 'Sensor type', 'Name', 'Latest reading', 'Status', 'Last seen'];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(a => [
      a.properties.id,
      familyLabel(a),
      a.properties.name,
      readingText(a),
      a.properties.status === 'ok' ? 'Online' : a.properties.status === 'warn' ? 'Anomaly' : 'Alarm',
      a.properties.asset === 'sensor' ? a.properties.last_seen : ''
    ].map(esc).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aquawise-sensors-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

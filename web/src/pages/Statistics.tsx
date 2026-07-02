import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { BarChart3, Database, Download } from 'lucide-react';
import { Card, CardHeader, CardBody, KpiCard, Badge } from '../components/ui';

const phHist = [
  { bin: '6.0–6.5', count: 45 },
  { bin: '6.5–7.0', count: 312 },
  { bin: '7.0–7.5', count: 1840 },
  { bin: '7.5–8.0', count: 2100 },
  { bin: '8.0–8.5', count: 980 },
  { bin: '8.5–9.0', count: 210 },
];

const nitrateByUtility = [
  { name: 'NRB', value: 61.2, fill: 'var(--danger)' },
  { name: 'THK', value: 18.4, fill: 'var(--warning)' },
  { name: 'KSM', value: 10.1, fill: 'var(--safe)' },
  { name: 'NYK', value: 7.8,  fill: 'var(--safe)' },
  { name: 'ELD', value: 9.3,  fill: 'var(--safe)' },
  { name: 'MSA', value: 12.0, fill: 'var(--safe)' },
  { name: 'NKR', value: 5.1,  fill: 'var(--safe)' },
  { name: 'GRS', value: 7.5,  fill: 'var(--safe)' },
];

const safetyOverTime = [
  { month: 'Jan', pH: 96, nitrate: 82, ecoli: 99 },
  { month: 'Feb', pH: 95, nitrate: 79, ecoli: 98 },
  { month: 'Mar', pH: 94, nitrate: 75, ecoli: 99 },
  { month: 'Apr', pH: 93, nitrate: 72, ecoli: 99 },
  { month: 'May', pH: 95, nitrate: 78, ecoli: 98 },
  { month: 'Jun', pH: 94, nitrate: 80, ecoli: 99 },
  { month: 'Jul', pH: 93, nitrate: 77, ecoli: 99 },
  { month: 'Aug', pH: 96, nitrate: 74, ecoli: 98 },
  { month: 'Sep', pH: 97, nitrate: 73, ecoli: 99 },
  { month: 'Oct', pH: 95, nitrate: 71, ecoli: 99 },
  { month: 'Nov', pH: 94, nitrate: 70, ecoli: 99 },
  { month: 'Dec', pH: 93, nitrate: 70, ecoli: 99 },
];

const scatter = Array.from({ length: 60 }, () => ({
  x: +(Math.random() * 3.4).toFixed(2),
  y: +(Math.random() * 80).toFixed(1),
}));

const summaryRows = [
  { name: 'pH',                unit: '—',           min: 6.2,  max: 9.1, mean: 7.5,  std: 0.42, threshold: '6.5 – 8.5',     exc: 89, comp: '93.1%', tone: 'safe' as const },
  { name: 'Turbidity',         unit: 'NTU',         min: 0.1,  max: 3.4, mean: 0.7,  std: 0.46, threshold: '≤ 1 (treated)', exc: 142, comp: '88.9%', tone: 'safe' as const },
  { name: 'E. coli',           unit: 'CFU/100 mL',  min: 0,    max: 14,  mean: 0.4,  std: 1.7,  threshold: '0 / 100 mL',    exc: 23, comp: '98.2%', tone: 'warning' as const },
  { name: 'Total Coliforms',   unit: 'CFU/100 mL',  min: 0,    max: 32,  mean: 1.1,  std: 3.2,  threshold: '0 / 100 mL',    exc: 41, comp: '96.8%', tone: 'warning' as const },
  { name: 'Free Chlorine',     unit: 'mg/L',        min: 0.05, max: 1.4, mean: 0.55, std: 0.21, threshold: '0.2 – 1.0',     exc: 68, comp: '94.7%', tone: 'safe' as const },
  { name: 'Nitrate (NO₃⁻)',    unit: 'mg/L',        min: 2.1,  max: 81.4,mean: 18.3, std: 14.7, threshold: '≤ 50',          exc: 387, comp: '69.9%', tone: 'danger' as const },
  { name: 'Fluoride (F⁻)',     unit: 'mg/L',        min: 0.10, max: 1.8, mean: 0.62, std: 0.31, threshold: '≤ 1.5',         exc: 12, comp: '99.1%', tone: 'safe' as const },
  { name: 'Iron (Fe)',         unit: 'mg/L',        min: 0.01, max: 0.42, mean: 0.11, std: 0.08, threshold: '≤ 0.3',        exc: 17, comp: '98.7%', tone: 'safe' as const },
  { name: 'Manganese (Mn)',    unit: 'mg/L',        min: 0.00, max: 0.12, mean: 0.03, std: 0.02, threshold: '≤ 0.08',       exc: 9,  comp: '99.3%', tone: 'safe' as const },
  { name: 'Conductivity',      unit: 'µS/cm',       min: 120,  max: 1840, mean: 620,  std: 240,  threshold: '≤ 2,500',      exc: 0,  comp: '100%',   tone: 'safe' as const },
  { name: 'TDS',               unit: 'mg/L',        min: 80,   max: 980,  mean: 340,  std: 140,  threshold: '≤ 1,000',      exc: 0,  comp: '100%',   tone: 'safe' as const },
  { name: 'Mains Pressure',    unit: 'bar',         min: 1.4,  max: 5.8, mean: 4.1,  std: 0.7,  threshold: '2 – 6',         exc: 18, comp: '97.4%', tone: 'safe' as const },
  { name: 'Reservoir Level',   unit: '%',           min: 28,   max: 96,  mean: 71,   std: 14,   threshold: '20 – 95',       exc: 7,  comp: '99.0%', tone: 'safe' as const },
];

const tooltip = { contentStyle: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 } };

export default function Statistics() {
  return (
    <>
      <div className="kpi-grid">
        <KpiCard tone="accent" label="Total Readings"   value="12,847" sub="last 90 days" />
        <KpiCard tone="safe"   label="WHO Compliance"   value="93.4%"  sub="all parameters combined" />
        <KpiCard tone="warn"   label="Alerts Generated" value="47"     sub="this period" />
        <KpiCard tone="danger" label="Critical Events"  value="8"      sub="exceeded WHO thresholds" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s6)' }}>
        <Card>
          <CardHeader title="pH Distribution" eyebrow="ALL UTILITIES · 90 DAYS" icon={<BarChart3 size={16} />} />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={phHist}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="bin" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip {...tooltip} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Nitrate by Utility" eyebrow="MEAN · WHO ≤ 50 mg/L" icon={<BarChart3 size={16} />} />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={nitrateByUtility}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip {...tooltip} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Compliance Over Time" eyebrow="% READINGS WITHIN WHO" />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={safetyOverTime}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[60, 100]} />
                <Tooltip {...tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="pH"      stroke="var(--accent-blue)"   strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="nitrate" stroke="var(--danger)"        strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="ecoli"   stroke="var(--safe)"          strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Parameter Correlation" eyebrow="TURBIDITY × NITRATE" />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Turbidity" unit=" NTU" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis dataKey="y" name="Nitrate"   unit=" mg/L" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <ZAxis range={[60, 60]} />
                <Tooltip {...tooltip} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatter} fill="var(--accent)" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<Database size={16} />}
          title="WHO Parameter Summary"
          eyebrow="ALL UTILITIES · 90 DAYS"
          actions={<button className="btn btn-sm btn-secondary"><Download size={14} /> Export CSV</button>}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Parameter</th><th>Unit</th><th>Min</th><th>Max</th><th>Mean</th><th>Std Dev</th><th>WHO Threshold</th><th>Exceedances</th><th>Compliance</th></tr>
            </thead>
            <tbody>
              {summaryRows.map(r => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{r.unit}</td>
                  <td>{r.min}</td>
                  <td>{r.max}</td>
                  <td>{r.mean}</td>
                  <td>{r.std}</td>
                  <td>{r.threshold}</td>
                  <td style={{ color: r.exc > 100 ? 'var(--danger)' : r.exc > 20 ? 'var(--warning)' : 'var(--text-muted)' }}>{r.exc}</td>
                  <td><Badge tone={r.tone}>{r.comp}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

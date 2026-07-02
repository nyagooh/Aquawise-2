import { useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, Brain, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../components/ui';
import { UTILITIES } from '../data/mockData';

const labels = ['Apr 14','Apr 15','Apr 16','Apr 17','Apr 18','Apr 19','Apr 20','Apr 21','Apr 22','Apr 23','Apr 24','Apr 25','Apr 26','Apr 27','Apr 28','Apr 29','Apr 30','May 1','May 2','May 3','May 4'];
const hist  = [42,45,58,71,65,72,78,null,null,null,null,null,null,null,null,null,null,null,null,null,null];
const fore  = [null,null,null,null,null,null,78,81,76,74,69,65,60,55,52,48,46,43,41,40,38];
const upper = [null,null,null,null,null,null,78,90,87,83,78,73,68,62,58,54,51,48,45,43,42];
const lower = [null,null,null,null,null,null,78,72,65,65,60,57,52,48,46,42,41,38,37,37,34];

const chartData = labels.map((d, i) => ({
  day: d, hist: hist[i] as number | null, fore: fore[i] as number | null,
  upper: upper[i] as number | null, lower: lower[i] as number | null,
}));

export default function Predictive() {
  const [utility, setUtility] = useState('nairobi');

  return (
    <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)', padding: 'var(--s4) var(--s5)', borderBottom: '1px solid var(--border-default)', flexWrap: 'wrap' }}>
          <Badge tone="info"><Brain size={11} style={{ marginRight: 4 }} />ML Forecast</Badge>
          <div className="tabs">
            <button className="tab-btn">7 days</button>
            <button className="tab-btn active">14 days</button>
            <button className="tab-btn">30 days</button>
          </div>
          <select className="form-control" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem', marginLeft: 'auto' }} value={utility} onChange={e => setUtility(e.target.value)}>
            {UTILITIES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<TrendingUp size={16} />}
          title="14-Day Nitrate Forecast"
          eyebrow={UTILITIES.find(u => u.id === utility)?.name ?? 'Utility'}
        />
        <CardBody>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 24, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[20, 100]} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={50} stroke="var(--danger)" strokeDasharray="4 3" label={{ value: 'WHO 50 mg/L', fill: 'var(--danger)', fontSize: 10, position: 'right' }} />
              <Area type="monotone" dataKey="upper" stroke="transparent" fill="rgba(139,92,246,0.15)" name="Upper 95%" />
              <Area type="monotone" dataKey="lower" stroke="transparent" fill="var(--bg-card)" name="Lower 95%" />
              <Line type="monotone" dataKey="hist"  stroke="var(--accent-blue)"   strokeWidth={2.5} dot={{ r: 3 }} name="Historical" />
              <Line type="monotone" dataKey="fore"  stroke="var(--accent-purple)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} name="Forecast" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--s4)' }}>
        <Insight tone="danger" title="Nitrate spike predicted" body="Nairobi Water nitrate likely to remain above WHO 50 mg/L for the next 4–7 days. Recommend immediate investigation." />
        <Insight tone="warning" title="E. coli clearance expected" body="Kisumu Water E. coli predicted to return to 0 CFU/100 mL within 3 days after Free Chlorine residual is restored above 0.2 mg/L." />
        <Insight tone="safe" title="Network stable" body="5 of 8 utilities forecast to remain within all WHO thresholds for the full 14-day period." />
        <Insight tone="info" title="Seasonal pattern detected" body="Model identifies PET (evapotranspiration) as the top seasonal predictor for nitrate levels across the Tana basin." />
      </div>
    </>
  );
}

function Insight(props: { tone: 'safe' | 'warning' | 'danger' | 'info'; title: string; body: string }) {
  const bg = `var(--${props.tone === 'safe' ? 'safe' : props.tone === 'warning' ? 'warning' : props.tone === 'danger' ? 'danger' : 'info'}-bg)`;
  const fg = `var(--${props.tone === 'safe' ? 'safe' : props.tone === 'warning' ? 'warning' : props.tone === 'danger' ? 'danger' : 'info'})`;
  return (
    <Card style={{ padding: 'var(--s5)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s3)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-lg)', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>{props.title}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{props.body}</div>
        </div>
      </div>
    </Card>
  );
}

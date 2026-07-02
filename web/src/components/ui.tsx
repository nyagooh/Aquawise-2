import { ReactNode } from 'react';
import type { Status } from '../data/mockData';

export function Card(props: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={'card' + (props.className ? ' ' + props.className : '')} style={props.style}>{props.children}</div>;
}

export function CardHeader(props: { title: ReactNode; eyebrow?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card-header">
      <div>
        {props.eyebrow && <div className="card-eyebrow">{props.eyebrow}</div>}
        <div className="card-title">
          {props.icon}
          <span>{props.title}</span>
        </div>
      </div>
      {props.actions && <div className="card-actions">{props.actions}</div>}
    </div>
  );
}

export function CardBody(props: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="card-body" style={props.style}>{props.children}</div>;
}

export function Badge(props: { tone?: 'safe' | 'warning' | 'danger' | 'info' | 'neutral'; children: ReactNode }) {
  const tone = props.tone ?? 'neutral';
  return <span className={`badge badge-${tone}`}>{props.children}</span>;
}

export function StatusDot(props: { status: Status | 'offline' }) {
  const cls =
    props.status === 'safe' ? 'dot-safe' :
    props.status === 'warning' ? 'dot-warning' :
    props.status === 'danger' ? 'dot-danger' : 'dot-offline';
  return <span className={`status-dot ${cls}`} />;
}

export function KpiCard(props: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'safe' | 'warn' | 'danger' | 'accent';
  icon?: ReactNode;
  featured?: boolean;
}) {
  const toneClass = props.tone ? ` kpi-${props.tone}` : '';
  const featured = props.featured ? ' featured' : '';
  return (
    <div className={`kpi-card${toneClass}${featured}`}>
      <div className="kpi-header">
        <div>
          <div className="kpi-label">{props.label}</div>
          <div className={'kpi-value' + (props.tone ? ` ${props.tone === 'warn' ? 'warn' : props.tone}` : '')}>{props.value}</div>
          {props.sub && <div className="kpi-sub">{props.sub}</div>}
        </div>
        {props.icon && <div className="kpi-icon">{props.icon}</div>}
      </div>
    </div>
  );
}

export function MeterBar(props: { value: number; tone?: 'safe' | 'warning' | 'danger' }) {
  const tone = props.tone ?? 'safe';
  return (
    <div className="meter-bar">
      <div className={`meter-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, props.value))}%` }} />
    </div>
  );
}

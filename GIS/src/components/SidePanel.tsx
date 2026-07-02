import { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  kind: string;
  title: string;
  pill?: { label: string; tone: 'safe' | 'warn' | 'danger' | 'info' | 'muted' };
  children: ReactNode;
};

export function SidePanel({ open, onClose, kind, title, pill, children }: Props) {
  return (
    <aside className={`side-panel${open ? ' open' : ''}`}>
      <div className="sp-head">
        <div>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'hsl(var(--muted-foreground))', fontWeight: 700 }}>
            {kind}
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.01em', marginTop: 4 }}>{title}</div>
          {pill && (
            <div style={{ marginTop: 8 }}>
              <span className={`pill ${pill.tone}`}>
                <span className="dot" />
                {pill.label}
              </span>
            </div>
          )}
        </div>
        <button className="sp-close" onClick={onClose}>✕</button>
      </div>
      <div className="sp-body">{children}</div>
    </aside>
  );
}

export function SpRow({ label, value, mono, color, onClick }: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div className="sp-row" style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      <span className="label">{label}</span>
      <span className={`value${mono ? ' mono' : ''}`} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

/** Shared UI building blocks for the operational pages (.dx-* in demo.css). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RANGE_KEYS, type RangeKey, type Tone } from './series';
import { useFilters } from './filters';
import {
  Badge, BadgeDelta as TBadgeDelta, Card as TCard, Metric, Table, TableBody, TableCell,
  TableHead, TableHeaderCell, TableRow, Text
} from '@tremor/react';

export const TONE_LABEL: Record<Tone, string> = { ok: 'Normal', warn: 'Warning', crit: 'Critical', off: 'Offline' };

const BADGE_COLOR: Record<Tone, string> = { ok: 'emerald', warn: 'amber', crit: 'red', off: 'gray' };
/** Status pill (Tremor Badge). */
export function Status({ tone, label }: { tone: Tone; label?: string }) {
  return <Badge color={BADGE_COLOR[tone] as never} size="xs" className="dx-badge">{label ?? TONE_LABEL[tone]}</Badge>;
}
export function Dot({ tone }: { tone: Tone }) {
  return <span className={`dx-dot ${tone}`} aria-label={TONE_LABEL[tone]} />;
}

export function Card({ title, sub, actions, children, flush, className }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string;
}) {
  return (
    <TCard className={`dx-card p-0${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <header className="dx-card-head">
          <div>
            {title && <h3 className="dx-card-title">{title}</h3>}
            {sub && <p className="dx-card-sub">{sub}</p>}
          </div>
          {actions && <div className="dx-card-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'dx-card-flush' : 'dx-card-body'}>{children}</div>
    </TCard>
  );
}

export type IconTone = 'blue' | Tone;
export function IconTile({ icon, tone = 'blue', size = 40 }: { icon: ReactNode; tone?: IconTone; size?: number }) {
  return <span className={`dx-icontile ${tone}`} style={{ width: size, height: size }}>{icon}</span>;
}

/** Delta badge (Tremor BadgeDelta). Colour follows whether the change is good. */
export function BadgeDelta({ text, good, up }: { text: string; good: boolean; up: boolean }) {
  return (
    <TBadgeDelta deltaType={up ? 'moderateIncrease' : 'moderateDecrease'} isIncreasePositive={good === up} size="xs">
      {text}
    </TBadgeDelta>
  );
}

export function Kpi({ label, value, unit, tone, sub, delta, onClick, children, icon, iconTone, chart, selected }: {
  label: string; value: ReactNode; unit?: string; tone?: Tone; sub?: ReactNode;
  delta?: { text: string; good: boolean; up?: boolean } | null; onClick?: () => void; children?: ReactNode;
  icon?: ReactNode; iconTone?: IconTone; chart?: ReactNode; selected?: boolean;
}) {
  const body = (
    <>
      {icon && <IconTile icon={icon} tone={iconTone ?? tone ?? 'blue'} />}
      <div className="dx-kpi-main">
        <Text className="dx-kpi-label">{!icon && tone && <Dot tone={tone} />}{label}</Text>
        <Metric className="dx-kpi-value">{value}{unit && <span className="unit">{unit}</span>}</Metric>
        <div className="dx-kpi-foot">
          {delta && <BadgeDelta text={delta.text} good={delta.good} up={delta.up ?? !delta.good} />}
          {sub && <span className="dx-kpi-sub">{sub}</span>}
        </div>
        {children}
      </div>
      {chart && <div className="dx-kpi-chart">{chart}</div>}
    </>
  );
  const cls = `dx-kpi p-4${onClick ? ' click' : ''}${icon ? ' has-icon' : ''}${selected ? ' selected' : ''}`;
  return onClick
    ? <TCard className={cls} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>{body}</TCard>
    : <TCard className={cls}>{body}</TCard>;
}

/** Severity glyph used in alert lists (octicon-like, 16px). */
export function SevIcon({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const c = severity === 'critical' ? 'hsl(var(--danger))' : severity === 'warning' ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground))';
  return (
    <svg className="aw-sev" width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-label={severity}>
      {severity === 'critical'
        ? <><path d="M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3l-3.8-3.8V5.3z" /><path d="M8 4.8v3.6M8 11h.01" /></>
        : severity === 'warning'
          ? <><path d="M7.1 2.2 1.4 12.3a1 1 0 0 0 .9 1.5h11.4a1 1 0 0 0 .9-1.5L8.9 2.2a1 1 0 0 0-1.8 0z" /><path d="M8 6v3M8 11.5h.01" /></>
          : <><circle cx={8} cy={8} r={6.5} /><path d="M8 7.2V11M8 5h.01" /></>}
    </svg>
  );
}

/** Small inline icons for KPI tiles and lists. */
const SI = (d: ReactNode) => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
export const ICON = {
  pulse: SI(<path d="M3 12h4l3-7 4 14 3-7h4" />),
  alert: SI(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>),
  drop: SI(<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />),
  pie: SI(<><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>),
  signal: SI(<><path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0" /><circle cx={12} cy={12} r={1} /><path d="M12 13v8" /></>),
  gauge: SI(<><path d="M4 18a8 8 0 1 1 16 0" /><path d="m12 14 4-4" /></>),
  tank: SI(<><rect x={5} y={3} width={14} height={18} rx={3} /><path d="M5 13h14" /></>),
  trend: SI(<path d="m3 17 6-6 4 4 8-8M15 7h6v6" />),
  wifiOff: SI(<><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.8M19 13a10 10 0 0 0-2.3-1.6M12 20h.01" /></>),
  layers: SI(<><path d="M12 3 3 7.5 12 12l9-4.5L12 3z" /><path d="m3 12 9 4.5 9-4.5" /></>),
  chevron: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
};

export function Tabs<K extends string>({ items, value, onChange }: {
  items: Array<{ key: K; label: string; count?: number }>; value: K; onChange: (k: K) => void;
}) {
  return (
    <div className="dx-tabs" role="tablist">
      {items.map(i => (
        <button key={i.key} role="tab" aria-selected={i.key === value} className={i.key === value ? 'on' : ''} onClick={() => onChange(i.key)} type="button">
          {i.label}{i.count !== undefined && <span className="dx-count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<K extends string>({ options, value, onChange, size }: {
  options: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void; size?: 'sm';
}) {
  return (
    <div className={`dx-seg${size ? ` ${size}` : ''}`} role="radiogroup">
      {options.map(o => (
        <button key={o.key} type="button" role="radio" aria-checked={o.key === value} className={o.key === value ? 'on' : ''} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

const RANGE_LABEL: Record<RangeKey, string> = { '24H': '24H', '7D': '7D', '30D': '30D', '3M': '3M', CUSTOM: 'Custom' };

/** Date-range control bound to the global filters. */
export function RangePicker() {
  const { range, setRange, customDays, setCustomDays } = useFilters();
  return (
    <div className="dx-range">
      <Segmented options={RANGE_KEYS.map(k => ({ key: k, label: RANGE_LABEL[k] }))} value={range} onChange={setRange} size="sm" />
      {range === 'CUSTOM' && (
        <label className="dx-custom">
          Last
          <input type="number" min={1} max={90} value={customDays} onChange={e => setCustomDays(Number(e.target.value) || 1)} />
          days
        </label>
      )}
    </div>
  );
}

export function Select({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; label: string;
}) {
  return (
    <label className="dx-select">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="dx-search">
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

/* ── sortable data table ── */
export interface Column<T> {
  key: string;
  label: string;
  render: (r: T) => ReactNode;
  sort?: (r: T) => number | string;
  align?: 'right' | 'left';
  width?: number | string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, selectedKey, pageSize = 0, empty = 'No results', defaultSort }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; selectedKey?: string | null;
  pageSize?: number; empty?: string; defaultSort?: { key: string; dir: 1 | -1 };
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(defaultSort ?? null);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length]);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sort!(a); const vb = col.sort!(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, columns]);
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const visible = pageSize ? sorted.slice(page * pageSize, page * pageSize + pageSize) : sorted;
  return (
    <div className="dx-table-wrap">
      <Table className="dx-table">
        <TableHead>
          <TableRow>
            {columns.map(c => (
              <TableHeaderCell key={c.key} style={{ width: c.width, textAlign: c.align }} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button type="button" onClick={() => setSort(s => ({ key: c.key, dir: s?.key === c.key ? (-s.dir as 1 | -1) : 1 }))}>
                    {c.label}<span className="dx-sort">{sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                  </button>
                ) : c.label}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map(r => {
            const k = rowKey(r);
            return (
              <TableRow key={k} className={`${onRowClick ? 'click' : ''}${selectedKey === k ? ' sel' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map(c => <TableCell key={c.key} style={{ textAlign: c.align }}>{c.render(r)}</TableCell>)}
              </TableRow>
            );
          })}
          {!visible.length && <TableRow><TableCell colSpan={columns.length} className="dx-empty">{empty}</TableCell></TableRow>}
        </TableBody>
      </Table>
      {pageSize > 0 && sorted.length > pageSize && (
        <div className="dx-pager">
          <span>{page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length.toLocaleString()}</span>
          <nav className="dx-pages" aria-label="Pages">
            <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page">‹</button>
            {pageList(page, pages).map((n, i) => n === null
              ? <span key={`gap${i}`} className="gap">…</span>
              : <button key={n} type="button" className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n + 1}</button>)}
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page">›</button>
          </nav>
        </div>
      )}
    </div>
  );
}

/** Page numbers to show: first, last, and a window around the current page, with gaps. */
export function pageList(page: number, pages: number): Array<number | null> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const keep = new Set([0, pages - 1, page - 1, page, page + 1].filter(n => n >= 0 && n < pages));
  const out: Array<number | null> = [];
  [...keep].sort((x, y) => x - y).forEach((n, i, arr) => { if (i && n - arr[i - 1] > 1) out.push(null); out.push(n); });
  return out;
}

/* ── drawer ── */
export function Drawer({ open, onClose, kicker, title, status, children, footer }: {
  open: boolean; onClose: () => void; kicker: string; title: ReactNode; status?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <>
      <div className={`dx-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`dx-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <header className="dx-drawer-head">
          <div>
            <div className="dx-kicker">{kicker}</div>
            <h2 className="dx-drawer-title">{title}</h2>
            {status && <div className="dx-drawer-status">{status}</div>}
          </div>
          <button type="button" className="dx-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="dx-drawer-body">{open && children}</div>
        {footer && open && <footer className="dx-drawer-foot">{footer}</footer>}
      </aside>
    </>
  );
}

export function KV({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="dx-kv">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="dx-section">
      <div className="dx-section-head"><h4>{title}</h4>{actions}</div>
      {children}
    </div>
  );
}

export function Loading() {
  return <div className="dx-loading"><span />Loading network data…</div>;
}

export function Insight({ tone = 'warn', children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`dx-insight ${tone}`}><i />{children}</div>;
}

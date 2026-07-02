import { Search } from 'lucide-react';
import { COUNTIES, Status, UTILITIES } from '../data/mockData';

export type FilterState = {
  search: string;
  status: 'all' | Status;
  county: 'all' | string;
};

export const initialFilter: FilterState = { search: '', status: 'all', county: 'all' };

export function applyFilter(f: FilterState) {
  const q = f.search.trim().toLowerCase();
  return UTILITIES.filter(u => {
    if (f.status !== 'all' && u.status !== f.status) return false;
    if (f.county !== 'all' && u.county !== f.county) return false;
    if (q && !`${u.name} ${u.county}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

const statusCounts = (() => {
  const c = { safe: 0, warning: 0, danger: 0 };
  UTILITIES.forEach(u => { c[u.status]++; });
  return c;
})();

export default function LocationFilter(props: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  total: number;
  shown: number;
}) {
  const { value, onChange } = props;
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) => onChange({ ...value, [key]: v });

  return (
    <>
      <div className="card-actions">
        <div className="search-box" style={{ width: 240 }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search utility or county…"
            value={value.search}
            onChange={e => set('search', e.target.value)}
          />
        </div>
      </div>
      <div className="loc-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', padding: 'var(--s3) var(--s5)', borderBottom: '1px solid var(--border-default)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Status</span>
        <Chip active={value.status === 'all'}     onClick={() => set('status', 'all')}>All <Count>{UTILITIES.length}</Count></Chip>
        <Chip active={value.status === 'safe'}    onClick={() => set('status', 'safe')}><span className="status-dot dot-safe"    style={{ marginRight: 4 }} />Safe <Count>{statusCounts.safe}</Count></Chip>
        <Chip active={value.status === 'warning'} onClick={() => set('status', 'warning')}><span className="status-dot dot-warning" style={{ marginRight: 4 }} />Warning <Count>{statusCounts.warning}</Count></Chip>
        <Chip active={value.status === 'danger'}  onClick={() => set('status', 'danger')}><span className="status-dot dot-danger"  style={{ marginRight: 4 }} />Critical <Count>{statusCounts.danger}</Count></Chip>

        <span style={{ width: 1, height: 18, background: 'var(--border-default)', margin: '0 var(--s2)' }} />
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>County</span>
        <Chip active={value.county === 'all'} onClick={() => set('county', 'all')}>All</Chip>
        {COUNTIES.map(c => (
          <Chip key={c} active={value.county === c} onClick={() => set('county', c)}>{c}</Chip>
        ))}

        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing {props.shown} of {props.total}
        </span>
      </div>
    </>
  );
}

function Chip(props: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={'loc-chip' + (props.active ? ' active' : '')} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
function Count(props: { children: React.ReactNode }) {
  return <span style={{ opacity: 0.6, marginLeft: 4 }}>{props.children}</span>;
}

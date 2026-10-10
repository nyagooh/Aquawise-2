import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { zones, sensors, pipes } from '../data';
import { useFilters } from '../demo/filters';
import { useTheme } from '../theme';
import { AlertsMenu } from './AlertsMenu';
import type { RangeKey } from '../demo/series';
import { ZONE_CODES, zoneName } from '../demo/model';

type Props = {
  title: string;
  sub?: string;
  onToggleNav?: () => void;
  filters?: { zone?: boolean; range?: boolean };
};

export function Topbar({ title, sub, onToggleNav, filters }: Props) {
  const f = useFilters();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const zoneHits = q ? zones.filter(z => z.name.toLowerCase().includes(q) || z.id.toLowerCase().includes(q)) : [];
  const sensorHits = q ? sensors.filter(s => s.id.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)) : [];
  const pipeHits = q ? pipes.filter(p => p.id.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)) : [];
  const hasResults = zoneHits.length + sensorHits.length + pipeHits.length > 0;

  const go = (kind: 'zone' | 'sensor' | 'pipe', id: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/network?focus=${kind}:${id}`);
  };

  const { mode, toggle } = useTheme();
  return (
    <header className="topbar aw-tb">
      {onToggleNav && (
        <button className="aw-tb-icon" onClick={onToggleNav} title="Collapse navigation" aria-label="Collapse navigation">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x={3} y={4} width={18} height={16} rx={2} /><path d="M9 4v16" /></svg>
        </button>
      )}
      <div className="search" ref={containerRef}>
        <svg className="search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={11} cy={11} r={8} />
          <line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
        <kbd className="aw-kbd">⌘ K</kbd>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Search network, sensors, assets…"
          autoComplete="off"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(!!e.target.value); }}
          onFocus={() => query && setOpen(true)}
        />
        {open && q && (
          <div className="search-results">
            {!hasResults && <div className="search-empty">No matches. Try "Zone B", "PR-03", or "HDPE".</div>}
            {zoneHits.length > 0 && (
              <>
                <div className="group-label">Zones</div>
                {zoneHits.map(z => (
                  <div key={z.id} className="search-result" onClick={() => go('zone', z.id)}>
                    <div className="search-result-icon">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx={12} cy={10} r={3} />
                      </svg>
                    </div>
                    <div className="search-result-meta">
                      <div className="search-result-title">{z.name}</div>
                      <div className="search-result-sub">{z.people.toLocaleString()} people · {z.pressure} bar</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {sensorHits.length > 0 && (
              <>
                <div className="group-label">Sensors</div>
                {sensorHits.map(s => (
                  <div key={s.id} className="search-result" onClick={() => go('sensor', s.id)}>
                    <div className="search-result-icon">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx={12} cy={12} r={3} />
                        <circle cx={12} cy={12} r={9} />
                      </svg>
                    </div>
                    <div className="search-result-meta">
                      <div className="search-result-title">{s.id}</div>
                      <div className="search-result-sub">{s.type} · {s.reading} · {s.zone}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {pipeHits.length > 0 && (
              <>
                <div className="group-label">Pipes</div>
                {pipeHits.map(p => (
                  <div key={p.id} className="search-result" onClick={() => go('pipe', p.id)}>
                    <div className="search-result-icon">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <line x1={4} y1={12} x2={20} y2={12} />
                      </svg>
                    </div>
                    <div className="search-result-meta">
                      <div className="search-result-title">{p.id}</div>
                      <div className="search-result-sub">{p.type} · {p.diameter} · {p.zone}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <div className="aw-tb-right">
        {filters?.range && (
          <label className="aw-pill-select">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
            <select value={f.range} onChange={e => f.setRange(e.target.value as RangeKey)} aria-label="Date range">
              <option value="24H">Last 24 hours</option><option value="7D">Last 7 days</option><option value="30D">Last 30 days</option><option value="3M">Last 3 months</option>
            </select>
          </label>
        )}
        {filters?.zone && (
          <label className="aw-pill-select">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path d="M4 21V9l5-3v15M9 21V4l6 3v14M15 21v-9l5 2v7" /></svg>
            <select value={f.zone} onChange={e => f.setZone(e.target.value)} aria-label="Zone">
              <option value="ALL">Riverton · all zones</option>
              {ZONE_CODES.map(z => <option key={z} value={z}>{zoneName(z)}</option>)}
            </select>
          </label>
        )}
        <button className="aw-tb-icon" onClick={toggle} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle theme">
          {mode === 'dark'
            ? <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx={12} cy={12} r={4} /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>}
        </button>
        <AlertsMenu />
        <span className="aw-avatar" title="Demo user · read-only">AM</span>
      </div>
    </header>
  );
}

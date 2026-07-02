import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { zones, sensors, pipes } from '../data';

type Props = {
  title: string;
  sub?: string;
  onToggleNav?: () => void;
};

export function Topbar({ title, sub, onToggleNav }: Props) {
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
    navigate(`/gis?focus=${kind}:${id}`);
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onToggleNav && (
          <button className="topbar-icon-btn" onClick={onToggleNav} title="Toggle navigation">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1={3} y1={6} x2={21} y2={6} />
              <line x1={3} y1={12} x2={21} y2={12} />
              <line x1={3} y1={18} x2={21} y2={18} />
            </svg>
          </button>
        )}
        <div>
        <div className="tb-title">{title}</div>
        {sub && <div className="tb-sub">{sub}</div>}
        </div>
      </div>
      <div className="search" ref={containerRef}>
        <svg className="search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={11} cy={11} r={8} />
          <line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Search zones, sensors, pipes…"
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
    </header>
  );
}

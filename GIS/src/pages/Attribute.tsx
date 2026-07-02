/**
 * Attribute Table — Excel-style view of the Riverton shapefile .dbf, served from
 * /data/riverton-pipes-attributes.csv. Row N matches polyline N in the .shp.
 */
import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';

type Row = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const out: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); out.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); out.push(cur); }
  if (!out.length) return { headers: [], rows: [] };
  const headers = out[0].map(h => h.replace(/^﻿/, ''));
  const rows: Row[] = [];
  for (let r = 1; r < out.length; r++) {
    const cells = out[r];
    if (cells.length === 1 && cells[0] === '') continue;
    const row: Row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

const PAGE_SIZE = 200;

export default function Attribute() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/data/riverton-pipes-attributes.csv')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => {
        if (!alive) return;
        const { headers, rows } = parseCsv(text);
        setHeaders(headers);
        setRows(rows);
      })
      .catch(e => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => headers.some(h => (r[h] ?? '').toLowerCase().includes(q)));
  }, [rows, headers, query]);

  useEffect(() => { setPage(0); }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const sub = err
    ? `Failed to load attribute table — ${err}`
    : rows.length
      ? `${rows.length.toLocaleString()} records · ${headers.length} fields · from Riverton water supply network.dbf`
      : 'Loading attribute table…';

  return (
    <Shell active="gis" title="Attribute Table" sub={sub}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter across all columns (e.g. HDPE, KREKAJ, Transmission Main)"
            style={{
              flex: 1, minWidth: 280, maxWidth: 480,
              padding: '8px 12px',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              fontSize: '0.875rem'
            }}
          />
          <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'}
            {query && rows.length !== filtered.length ? ` of ${rows.length.toLocaleString()}` : ''}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={btnStyle(page === 0)}
            >← Prev</button>
            <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', fontVariantNumeric: 'tabular-nums' }}>
              Page {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={btnStyle(page >= totalPages - 1)}
            >Next →</button>
            <a
              href="/data/riverton-pipes-attributes.csv"
              download="riverton-pipes-attributes.csv"
              style={{ ...btnStyle(false), textDecoration: 'none', display: 'inline-block' }}
            >Download CSV</a>
          </div>
        </div>

        <div
          style={{
            overflow: 'auto',
            maxHeight: 'calc(100vh - 220px)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            background: 'hsl(var(--card))'
          }}
        >
          <table className="table" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th style={{ ...stickyHead(), width: 60, textAlign: 'right' }}>#</th>
                {headers.map(h => (
                  <th key={h} style={stickyHead()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const absIdx = page * PAGE_SIZE + i;
                return (
                  <tr key={absIdx}>
                    <td style={{ textAlign: 'right', color: 'hsl(var(--muted-foreground))', fontVariantNumeric: 'tabular-nums' }}>
                      {absIdx + 1}
                    </td>
                    {headers.map(h => (
                      <td key={h} style={{ whiteSpace: 'nowrap', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row[h]}>
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={headers.length + 1} style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: 'var(--s4)' }}>
                    {err ? `Error: ${err}` : rows.length ? 'No matches' : 'Loading…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    background: 'hsl(var(--background))',
    color: disabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
    fontSize: '0.8125rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1
  };
}

function stickyHead(): React.CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: 'hsl(var(--card))',
    boxShadow: 'inset 0 -1px 0 hsl(var(--border))'
  };
}

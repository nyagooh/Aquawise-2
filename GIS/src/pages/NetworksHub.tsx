/**
 * Networks Hub — project and network selection page.
 *
 * Routes:
 *   /networks         → list available networks from the database and choose which one to view
 *   /networks/upload  → upload workflow to ingest new shapefile zip bundles or EPANET .inp files
 */
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../theme';
import { loadNetwork, type NetworkMeta, getAuthHeaders, clearNetworkCache } from '../data/network';

export default function NetworksHub() {
  const location = useLocation();
  const isUpload = location.pathname.endsWith('/upload');
  return isUpload ? <UploadView /> : <ChooserView />;
}

/* ════════════════════════════════════════════════════════════
   Shared layout shell
   ════════════════════════════════════════════════════════════ */

function DemoFrame({ children }: { children: React.ReactNode }) {
  const { mode, toggle } = useTheme();
  return (
    <div className="demo-hub">
      <nav className="demo-hub-nav">
        <Link to="/" className="demo-hub-brand">
          <BrandMark />
          <span>Aqua<b>wise</b></span>
        </Link>
        <div className="demo-hub-nav-meta">
          <span className="demo-hub-pill"><span className="live-dot" />Live · Water Intelligence Platform</span>
          <button className="theme-toggle" onClick={toggle} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'}`}>
            {mode === 'dark' ? '☀' : '☾'} {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Networks Chooser List
   ════════════════════════════════════════════════════════════ */

interface NetworkItem {
  id: string;
  name: string;
  total_pipes: number;
  total_nodes: number;
  total_length_km: number;
  source_crs: string;
  bbox: any;
  created_at: string;
}

type AssetKind = 'tank' | 'pressure_valve' | 'meter_valve' | 'sensor';

function ChooserView() {
  const navigate = useNavigate();
  const [networks, setNetworks] = useState<NetworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNetworksList = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/networks/', { headers });
      if (!res.ok) throw new Error('Failed to fetch networks list');
      const data = await res.json();
      setNetworks(data);
    } catch (err: any) {
      setError(err.message || 'Error loading networks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworksList();
  }, []);

  const selectNetwork = (id: string) => {
    localStorage.setItem('activeNetworkId', id);
    clearNetworkCache();
    navigate('/gis');
  };

  const deleteNetwork = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this network and all of its associated pipes, nodes, and assets?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/networks/${id}/`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Failed to delete network');
      
      // Clear localStorage if the active network is deleted
      if (localStorage.getItem('activeNetworkId') === id) {
        localStorage.removeItem('activeNetworkId');
      }

      fetchNetworksList();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const renameNetwork = async (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt('Enter a new name for this network:', currentName);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      alert('Network name cannot be empty.');
      return;
    }
    if (trimmed === currentName) return;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/networks/${id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: trimmed })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to rename network');
      }
      
      if (localStorage.getItem('activeNetworkId') === id) {
        clearNetworkCache();
      }

      fetchNetworksList();
    } catch (err: any) {
      alert(`Rename failed: ${err.message}`);
    }
  };

  return (
    <DemoFrame>
      <header className="demo-hub-head">
        <div className="demo-hub-eyebrow">Water Network Manager</div>
        <h1>Your Water Networks</h1>
        <p>Select a network to load on the live map, or upload a new geospatial GIS dataset.</p>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--muted-foreground))' }}>
          Loading networks from PostGIS...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--destructive))' }}>
          {error}
        </div>
      ) : (
        <section className="demo-hub-options" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
          {networks.map((net) => {
            const isActive = localStorage.getItem('activeNetworkId') === net.id;
            return (
              <div
                key={net.id}
                className={`demo-hub-card ${isActive ? 'primary' : ''}`}
                onClick={() => selectNetwork(net.id)}
                style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column' }}
              >
                <div className="demo-hub-card-inner" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                  <div className="demo-hub-card-head" style={{ justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div className="demo-hub-card-icon">
                      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx={12} cy={10} r={3} />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {isActive && <div className="demo-hub-card-tag" style={{ background: 'hsl(var(--primary))', color: '#fff' }}>Active</div>}
                      <button 
                        className="btn btn-ghost" 
                        onClick={(e) => renameNetwork(net.id, net.name, e)}
                        style={{ padding: '4px 8px', color: 'hsl(var(--primary))', height: 'auto', fontSize: '12px' }}
                        title="Rename Network"
                      >
                        Rename
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        onClick={(e) => deleteNetwork(net.id, e)}
                        style={{ padding: '4px 8px', color: 'hsl(var(--destructive))', height: 'auto', fontSize: '12px' }}
                        title="Delete Network"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px' }}>{net.name}</h2>
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', margin: '0 0 16px', flex: 1 }}>
                    CRS: {net.source_crs || 'WGS 84 (EPSG:4326)'}
                  </p>
                  
                  <ul className="demo-hub-card-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: 0, listStyle: 'none', margin: '0 0 16px' }}>
                    <li>
                      <strong>{net.total_pipes ? net.total_pipes.toLocaleString() : '0'}</strong>
                      <span>Pipes</span>
                    </li>
                    <li>
                      <strong>{net.total_length_km ? `${net.total_length_km.toFixed(1)} km` : '0 km'}</strong>
                      <span>Length</span>
                    </li>
                  </ul>
                  
                  <div className="demo-hub-card-cta" style={{ marginTop: 'auto' }}>
                    Load this network
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1={5} y1={12} x2={19} y2={12}/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Dotted Upload New Network Card */}
          <div
            className="demo-hub-card"
            onClick={() => navigate('/networks/upload')}
            style={{ 
              cursor: 'pointer', 
              border: '2px dashed hsl(var(--border))', 
              boxShadow: 'none', 
              background: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '40px 24px',
              textAlign: 'center',
              minHeight: '280px'
            }}
          >
            <div className="demo-upload-icon" style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1={12} y1={3} x2={12} y2={15} />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px' }}>Upload GIS Data</h2>
            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', margin: '0 0 16px' }}>
              Ingest a new shapefile (.zip) or EPANET model (.inp) to render on the map.
            </p>
            <div className="demo-hub-card-cta" style={{ color: 'hsl(var(--primary))' }}>
              Start the upload →
            </div>
          </div>
        </section>
      )}

      <footer className="demo-hub-foot">
        <div className="demo-hub-foot-cell">
          <span>Active Organization</span>
          <strong>KIWASCO — Kisumu Water & Sewerage</strong>
        </div>
        <div className="demo-hub-foot-cell">
          <span>Storage Backend</span>
          <strong>PostgreSQL 16 + PostGIS 3.4</strong>
        </div>
        <div className="demo-hub-foot-cell">
          <span>Access Scope</span>
          <strong>Multi-tenant isolated view</strong>
        </div>
      </footer>
    </DemoFrame>
  );
}

/* ════════════════════════════════════════════════════════════
   Upload workflow
   ════════════════════════════════════════════════════════════ */

function UploadView() {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);
  const [networkName, setNetworkName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    setStaged((s) => {
      const next = [...s];
      Array.from(files).forEach((f) => {
        if (!next.find((x) => x.name === f.name && x.size === f.size)) next.push(f);
      });
      return next;
    });
  };

  const submit = async () => {
    if (staged.length === 0) return;
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const authHeaders = { ...headers } as any;
      delete authHeaders['Content-Type'];

      const fileToUpload = staged[0];
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('name', networkName);

      const res = await fetch('/api/v1/networks/upload/', {
        method: 'POST',
        headers: authHeaders,
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed');
      }
      const data = await res.json();
      const uploadId = data.upload_id;

      // Poll status
      let complete = false;
      let retries = 30;
      while (!complete && retries > 0) {
        await new Promise((r) => setTimeout(r, 2000));
        const valRes = await fetch(`/api/v1/networks/${uploadId}/validate/`, { headers });
        if (!valRes.ok) throw new Error('Failed to fetch upload status');
        const valData = await valRes.json();
        if (valData.status === 'complete' || valData.status === 'complete_warnings') {
          complete = true;
          if (valData.network_id) {
            localStorage.setItem('activeNetworkId', valData.network_id);
          }
        } else if (valData.status === 'failed') {
          throw new Error(valData.validation_report?.error || 'Ingestion task failed');
        }
        retries--;
      }

      clearNetworkCache();
      navigate('/gis');
    } catch (err: any) {
      alert(`Ingestion error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DemoFrame>
      <header className="demo-hub-head">
        <div className="demo-hub-eyebrow">
          <Link to="/networks" className="demo-back-link">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to networks
          </Link>
        </div>
        <h1>Upload your GIS data.</h1>
        <p>Drop a shapefile bundle, GeoJSON, KML or EPANET export — we&apos;ll render it on the map.</p>
      </header>

      <section className="demo-upload-grid">
        <div className="demo-upload-main">
          <label
            className={`demo-upload-zone${hover ? ' hover' : ''}${staged.length ? ' has-files' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={(e) => { e.preventDefault(); setHover(false); onFiles(e.dataTransfer.files); }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".shp,.shx,.dbf,.prj,.cpg,.qmd,.geojson,.json,.kml,.kmz,.inp,.zip"
              onChange={(e) => onFiles(e.target.files)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
            <div className="demo-upload-zone-inner">
              <div className="demo-upload-icon">
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1={12} y1={3} x2={12} y2={15} />
                </svg>
              </div>
              <div className="demo-upload-headline">Drop your network files here</div>
              <div className="demo-upload-sub">or <span className="link">browse from your computer</span></div>
              <div className="demo-upload-formats">
                <span>.shp + .dbf + .shx + .prj</span>
                <span>.geojson</span>
                <span>.kml / .kmz</span>
                <span>EPANET .inp</span>
                <span>.zip bundle</span>
              </div>
            </div>
          </label>

          {staged.length > 0 && (
            <div className="demo-upload-staged">
              <div className="demo-upload-staged-head">
                <span>Staged · {staged.length} file{staged.length === 1 ? '' : 's'}</span>
                <button type="button" className="link" onClick={() => setStaged([])}>Clear all</button>
              </div>
              <ul>
                {staged.map((f) => (
                  <li key={f.name}>
                    <FileTypeBadge name={f.name} />
                    <span className="demo-upload-file-name">{f.name}</span>
                    <span className="demo-upload-file-size">{formatBytes(f.size)}</span>
                    <button
                      className="demo-upload-file-remove"
                      onClick={() => setStaged((s) => s.filter((x) => x !== f))}
                      aria-label={`Remove ${f.name}`}
                    >×</button>
                  </li>
                ))}
              </ul>
              
              <div style={{ marginTop: '20px', marginBottom: '24px', textAlign: 'left' }}>
                <label htmlFor="network-name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>
                  Network Label (Optional)
                </label>
                <input
                  id="network-name"
                  type="text"
                  placeholder="Enter a name for this network..."
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'hsl(var(--primary))';
                    e.target.style.boxShadow = '0 0 0 2px hsl(var(--primary) / 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'hsl(var(--border))';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '6px' }}>
                  If left blank, the system will name it &quot;Untitled&quot; (or &quot;Untitled1&quot;, &quot;Untitled2&quot;, etc.)
                </span>
              </div>

              <div className="demo-upload-staged-foot">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={submit}
                  disabled={busy}
                >
                  {busy ? 'Ingesting…' : 'Ingest & render on live map →'}
                </button>
                <button className="btn btn-ghost btn-lg" onClick={() => navigate('/gis')}>
                  Skip — use Kisumu sandbox
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="demo-upload-side">
          <div className="demo-upload-side-card">
            <h3>What we detect automatically</h3>
            <ul>
              <li><span className="bullet" />Transmission and distribution mains</li>
              <li><span className="bullet" />Household / service line connections</li>
              <li><span className="bullet" />Backfeed segments (closed status)</li>
              <li><span className="bullet" />DMA / pressure-zone boundaries</li>
              <li><span className="bullet" />Pipe attributes: material, diameter, age, length</li>
              <li><span className="bullet" />Service status: open · closed · in-service</li>
              <li><span className="bullet" />Topological junctions for valves &amp; tanks</li>
            </ul>
          </div>
          <div className="demo-upload-side-card subtle">
            <h3>Your data is yours</h3>
            <p>
              Uploads are securely isolated in your private organization namespace 
              and backed by PostGIS spatial database layers and asynchronous parsing workers.
            </p>
          </div>
        </aside>
      </section>
    </DemoFrame>
  );
}

function FileTypeBadge({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const tone =
    ext === 'shp' || ext === 'dbf' || ext === 'shx' || ext === 'prj' ? 'shp' :
    ext === 'geojson' || ext === 'json' ? 'geo' :
    ext === 'kml' || ext === 'kmz' ? 'kml' :
    ext === 'inp' ? 'inp' :
    ext === 'zip' ? 'zip' : 'gen';
  return <span className={`demo-upload-badge tone-${tone}`}>{ext.toUpperCase() || 'FILE'}</span>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function BrandMark() {
  return (
    <svg width={22} height={22} viewBox="0 0 64 64" fill="none" aria-label="Aquawise" style={{ color: 'hsl(var(--primary))' }}>
      <path d="M12 50 L32 14 L52 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 50 L32 14 L43 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      <path d="M29 50 L32 14 L35 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.22} />
    </svg>
  );
}

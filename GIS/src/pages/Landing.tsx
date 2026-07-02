/**
 * inspiration-note: Structure and alternating section rhythm inspired by
 * https://plane.so/ — adapted into an original experience for Aquawise.
 * Primary colour: TechBlue #2563EB. Alternating neutral / deep-navy-blue sections.
 * Layout: copy text centred at top, full-width product mockup below.
 */
import { useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../theme';
import { hasDemoAccess } from '../access';

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); }),
      { threshold: 0.08 }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  const { mode, toggle } = useTheme();
  const navigate = useNavigate();

  // Live demo is gated behind the lead form — unless this session already passed it.
  const openDemo = useCallback(() => {
    navigate(hasDemoAccess() ? '/demo' : '/request-demo');
  }, [navigate]);
  const bookWalkthrough = useCallback(() => navigate('/request-demo?mode=book'), [navigate]);
  useReveal();

  return (
    <div className="landing">

      {/* ── Nav ── */}
      <nav className="landing-nav">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, letterSpacing: '-0.015em', fontSize: '0.9375rem' }}>
          <LogoMark size={22} />
          Aqua<span style={{ color: 'hsl(var(--primary))' }}>wise</span>
        </Link>
        <div className="landing-nav-links">
          <a href="#network">Network</a>
          <a href="#sensors">Sensors</a>
          <a href="#assets">Assets</a>
          <a href="#how">How it works</a>
          <button type="button" className="nav-as-link" onClick={openDemo}>Live demo</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="theme-toggle" onClick={toggle} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
            {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>
            Explore Live Demo →
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════
          HERO — neutral background
      ════════════════════════════════════════ */}
      <section className="hero">
        <div className="reveal">
          <div className="hero-pill">
            <span className="live-dot" />
            Smart water grid · live demo available
          </div>
        </div>
        <h1 className="hero-title reveal reveal-delay-1">
          The smart water grid<br />
          <span className="hl">for water utilities.</span>
        </h1>
        <p className="hero-sub reveal reveal-delay-2">
          Map every pipe. Monitor every sensor. Locate every leak.
          Account for every asset — on one live platform.
        </p>
        <div className="hero-ctas reveal reveal-delay-3">
          <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>Explore Live Demo →</button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={bookWalkthrough}>Book a Walkthrough</button>
        </div>
        <div className="hero-meta reveal reveal-delay-3">
          <span><span className="dot" />Free 30-minute demo</span>
          <span><span className="dot" />No credit card required</span>
          <span><span className="dot" />Live Riverton network sandbox</span>
        </div>
      </section>

      {/* Hero product screenshot */}
      <div className="hero-preview reveal" style={{ marginBottom: 0 }}>
        <button type="button" onClick={openDemo} className="hero-preview-frame" style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
          <div className="hero-preview-bar">
            <span className="d" style={{ background: '#FF5F57' }} />
            <span className="d" style={{ background: '#FEBC2E' }} />
            <span className="d" style={{ background: '#28C840' }} />
            <span style={{ flex: 1, marginLeft: 12, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
              app.aquawise.io / gis — Riverton Water Supply Network
            </span>
            <span style={{ fontSize: 10, color: 'hsl(var(--primary))', fontFamily: 'var(--font-mono)', fontWeight: 600, marginRight: 4 }}>● LIVE</span>
          </div>
          <HeroPipeNetworkMockup />
        </button>
      </div>

      {/* Testimonials */}
      <div className="testimonial-row" style={{ marginTop: 56, marginBottom: 0 }}>
        {TESTIMONIALS.map((t, i) => (
          <div key={t.name} className={`testimonial reveal${i > 0 ? ` reveal-delay-${i}` : ''}`}>
            <q>{t.quote}</q>
            <div className="testimonial-author">
              <div className="testimonial-avatar">{t.initials}</div>
              <div>
                <div className="testimonial-name">{t.name}</div>
                <div className="testimonial-org">{t.org}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          STORY 1 — LIVE MAP (neutral)
      ════════════════════════════════════════ */}
      <section className="story-stacked" id="map" style={{ marginTop: 80 }}>
        <div className="story-stacked-inner">
          <div className="story-stacked-text reveal">
            <div className="story-tag"><span className="tag-dot" />Live Network Map</div>
            <h2>Your entire utility, on one live map.</h2>
            <p>
              Stop juggling paper drawings, scattered spreadsheets, and field photos.
              Aquawise puts every pipe, sensor, tank, and DMA boundary on a single
              aerial map — updated in real time, panned and zoomed by every team
              member that needs it.
            </p>
            <ul className="story-check-list" style={{ maxWidth: 480, margin: '0 auto var(--s6)' }}>
              <li>Aerial basemap with streets, buildings, and water features</li>
              <li>DMA, pressure zone, and service area boundaries overlaid live</li>
              <li>Search any pipe, valve, hydrant, or customer in one click</li>
              <li>One source of truth shared by operations, planning, and field crews</li>
            </ul>
            <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>Open the live map →</button>
          </div>
          <div className="story-stacked-visual reveal reveal-delay-1">
            <MockupBar url="Map · Riverton Service Area" />
            <MapScreen />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STORY 2 — GIS PIPE NETWORK (neutral)
      ════════════════════════════════════════ */}
      <section className="story-stacked" id="network">
        <div className="story-stacked-inner">
          <div className="story-stacked-text reveal">
            <div className="story-tag"><span className="tag-dot" />GIS Pipe Network</div>
            <h2>Every pipe, mapped — every attribute, captured.</h2>
            <p>
              Click any segment and you get the full GIS profile: diameter, material,
              install year, pressure class, condition grade, and live sensor feed.
              Import your existing shapefiles or draw directly on the aerial map —
              your network is data, not a memory.
            </p>
            <ul className="story-check-list" style={{ maxWidth: 480, margin: '0 auto var(--s6)' }}>
              <li>Import shapefiles, GeoJSON, or draw directly on the aerial map</li>
              <li>Each pipe carries: diameter, material, install year, pressure class</li>
              <li>Colour-code by status, rehabilitation priority, or risk score</li>
              <li>DMA and pressure zone boundaries overlaid on live imagery</li>
            </ul>
            <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>See the GIS network →</button>
          </div>
          <div className="story-stacked-visual reveal reveal-delay-1">
            <MockupBar url="GIS · Pipe Network Detail" />
            <GISScreen />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STORY 3 — ALERTS (BLUE — TechBlue)
      ════════════════════════════════════════ */}
      <section className="story-stacked section-blue" id="alerts">
        <div className="story-stacked-inner">
          <div className="story-stacked-text reveal">
            <div className="story-tag"><span className="tag-dot" />Real-time Alerts</div>
            <h2>Know about problems before your customers do.</h2>
            <p>
              Pressure drops, low tanks, flow anomalies, water quality breaches —
              Aquawise monitors every signal 24/7 and pings the right team the
              moment something goes wrong. Each alert ties straight to the pipe,
              sensor, or asset on the map — so action is one click away.
            </p>
            <ul className="story-check-list" style={{ maxWidth: 480, margin: '0 auto var(--s6)' }}>
              <li>Configurable thresholds for pressure, flow, level, and quality</li>
              <li>Severity-graded routing — critical alerts page on-call instantly</li>
              <li>Every alert links to the exact pipe segment or sensor on the map</li>
              <li>Acknowledge, escalate, and resolve — full audit trail per incident</li>
            </ul>
            <Link to="/alerts" className="btn btn-primary btn-lg">See live alerts →</Link>
          </div>
          <div className="story-stacked-visual reveal reveal-delay-1">
            <MockupBar url="Alerts · Live Incident Feed" />
            <AlertsScreen />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STORY 4 — ASSET REGISTER (NEUTRAL)
      ════════════════════════════════════════ */}
      <section className="story-stacked" id="assets">
        <div className="story-stacked-inner">
          <div className="story-stacked-text reveal">
            <div className="story-tag"><span className="tag-dot" />Asset Intelligence</div>
            <h2>Know every pipe by name, age, and condition.</h2>
            <p>
              Deferred maintenance becomes a crisis when you don't know what you have.
              Aquawise gives every pipe, valve, and meter a permanent profile —
              tied directly to its location on the map — so you can prioritise
              rehabilitation before the failures start.
            </p>
            <ul className="story-check-list" style={{ maxWidth: 480, margin: '0 auto var(--s6)' }}>
              <li>Full pipe registry: diameter, material, install year, pressure class</li>
              <li>Condition grades, maintenance history, and work order linkage</li>
              <li>Filter your whole network by age, risk, or material type</li>
              <li>Build replacement programmes from data — not guesswork</li>
            </ul>
            <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>Explore the asset register →</button>
          </div>
          <div className="story-stacked-visual reveal reveal-delay-1">
            <MockupBar url="Asset Register · Pipe Segments" />
            <AssetRegisterScreen />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STORY 5 — NRW ANALYTICS (neutral)
      ════════════════════════════════════════ */}
      <section className="story-stacked">
        <div className="story-stacked-inner">
          <div className="story-stacked-text reveal">
            <div className="story-tag"><span className="tag-dot" />NRW & Loss Analytics</div>
            <h2>See exactly where you're losing water. Act this week.</h2>
            <p>
              NRW reports that take two days to compile and arrive already stale
              aren't analytics — they're history. Aquawise calculates your water
              balance continuously, ranks every DMA by loss, and tells you where
              to send your team — updated every hour.
            </p>
            <ul className="story-check-list" style={{ maxWidth: 480, margin: '0 auto var(--s6)' }}>
              <li>Hourly NRW percentages by DMA — not monthly estimates</li>
              <li>Zone ranking puts your worst-performing areas front and centre</li>
              <li>Night minimum flow isolates background leakage from burst events</li>
              <li>Regulatory-ready reports exported in one click</li>
            </ul>
            <Link to="/nrw" className="btn btn-primary btn-lg">See NRW analytics →</Link>
          </div>
          <div className="story-stacked-visual reveal reveal-delay-1">
            <MockupBar url="NRW Analytics · DMA Zone Ranking" />
            <NRWScreen />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS — blue background
          (second blue: appears after 2 neutral story sections)
      ════════════════════════════════════════ */}
      <div className="hiw-outer section-blue">
      <section className="hiw-section" id="how">
        <div className="section-header reveal">
          <div className="section-tag">How it works</div>
          <h2>Up and running in three steps.</h2>
          <p>Go from your existing GIS files to a fully live monitored network in under a day — no specialist consultants, no months of configuration.</p>
        </div>
        <div className="hiw-steps">
          <div className="hiw-step reveal">
            <div className="hiw-step-num">1</div>
            <h3>Bring in your network</h3>
            <p>Upload your shapefiles or GeoJSON exports. Pipe segments, DMAs, pressure zones, tanks, and valves are placed on the live aerial map automatically.</p>
            <div className="hiw-mini-ui" style={{ position: 'relative', height: 66, padding: 8 }}>
              <svg width="100%" height="100%" viewBox="0 0 200 50" fill="none">
                <line x1="20" y1="25" x2="80" y2="13" stroke="hsl(var(--primary))" strokeWidth="2" />
                <line x1="80" y1="13" x2="140" y2="28" stroke="hsl(var(--primary))" strokeWidth="2" />
                <line x1="140" y1="28" x2="182" y2="16" stroke="hsl(var(--primary))" strokeWidth="2" />
                <line x1="80" y1="13" x2="92" y2="38" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.6" />
                <circle cx="20" cy="25" r="4" fill="hsl(var(--safe))" />
                <circle cx="80" cy="13" r="4" fill="hsl(var(--primary))" />
                <circle cx="140" cy="28" r="4" fill="hsl(var(--warning))" />
                <circle cx="182" cy="16" r="4" fill="hsl(var(--safe))" />
                <circle cx="92" cy="38" r="4" fill="hsl(var(--safe))" />
              </svg>
            </div>
          </div>
          <div className="hiw-step reveal reveal-delay-1">
            <div className="hiw-step-num">2</div>
            <h3>Connect your sensors</h3>
            <p>Link pressure transducers, flow meters, and tank level sensors via SCADA or direct IoT feed. Live readings appear on the map immediately — no custom middleware.</p>
            <div className="hiw-mini-ui">
              <div className="hiw-mini-row accent" />
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, height: 10, borderRadius: 4, background: 'hsl(var(--safe) / 0.45)' }} />
                <div style={{ flex: 1, height: 10, borderRadius: 4, background: 'hsl(var(--warning) / 0.45)' }} />
              </div>
              <div className="hiw-mini-row" style={{ width: '60%' }} />
            </div>
          </div>
          <div className="hiw-step reveal reveal-delay-2">
            <div className="hiw-step-num">3</div>
            <h3>Monitor live — and respond fast</h3>
            <p>Your network is live on the map from day one. Alerts fire automatically on threshold breaches. One click takes you from the alert to the exact pipe segment and sensor — no digging through reports.</p>
            <div className="hiw-mini-ui">
              <div style={{ padding: '4px 6px', borderRadius: 4, background: 'hsl(var(--danger) / 0.12)', border: '1px solid hsl(var(--danger) / 0.3)', marginBottom: 4 }}>
                <div style={{ height: 6, width: '70%', borderRadius: 3, background: 'hsl(var(--danger) / 0.5)' }} />
              </div>
              <div className="hiw-mini-row safe" />
              <div className="hiw-mini-row" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      </section>
      </div>{/* end hiw-outer */}

      {/* ═══════════════════════════════════════
          FEATURES — neutral background
          (two neutral sections before the next blue)
      ════════════════════════════════════════ */}
      <section className="feat-section" id="features" style={{ maxWidth: '100%', padding: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--s16) var(--s6)' }}>
          <div className="section-header reveal">
            <div className="section-tag">Platform</div>
            <h2>Every tool your utility needs. One platform.</h2>
            <p>From the control room to the field — Aquawise gives every person on your team the same live picture of the network.</p>
          </div>
          <div className="feat-deep-grid">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`feat-deep reveal reveal-delay-${(i % 3) + 1}`}>
                <div className="feat-deep-icon">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                {f.badge && <div className="feat-deep-badge">✦ {f.badge}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FINAL CTA — blue background
          (third blue: after features neutral section)
      ════════════════════════════════════════ */}
      <section className="final-cta-section section-blue">
        <div className="final-cta-inner reveal" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.30)', borderRadius: 'var(--r-xl)', backdropFilter: 'blur(4px)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
          <h2>The utilities winning on water loss<br />all made one change.</h2>
          <p>
            They stopped operating from reports and started operating from live data.
            Book a free 30-minute demo — see your pipe network, your sensors, and your
            assets the way they were meant to be seen.
          </p>
          <div className="final-cta-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>Explore Live Demo →</button>
            <button type="button" className="btn btn-ghost btn-lg" onClick={bookWalkthrough}>Book a Walkthrough</button>
          </div>
          <div className="final-trust">
            <span><span className="dot-safe" />Free 30-minute demo</span>
            <span><span className="dot-safe" />No credit card required</span>
            <span><span className="dot-safe" />Up and running in under a day</span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <LogoMark size={18} />
          <span style={{ fontWeight: 600 }}>Aquawise</span>
          <span style={{ color: 'hsl(var(--border-strong))' }}>·</span>
          <span>GIS-Powered Water Utility Platform</span>
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[['Dashboard','/dashboard'],['GIS Map','/gis'],['Alerts','/alerts'],['NRW','/nrw'],['Sensors','/sensors'],['Reports','/reports']].map(([label,to]) => (
            <Link key={to} to={to} style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

/* ════════════════════════════════════════
   SHARED MOCKUP CHROME
   ════════════════════════════════════════ */

function MockupBar({ url }: { url: string }) {
  return (
    <div className="sv-bar">
      <span className="d" style={{ background: '#FF5F57' }} />
      <span className="d" style={{ background: '#FEBC2E' }} />
      <span className="d" style={{ background: '#28C840' }} />
      <span className="url">{url}</span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'hsl(var(--primary))', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>● LIVE</span>
    </div>
  );
}

/* ════════════════════════════════════════
   SCREEN MOCKUPS  (all dark-themed inside
   so they pop on both blue and neutral bg)
   ════════════════════════════════════════ */

const DARK = {
  bg:       '#111318',
  card:     '#1a1d26',
  cardMut:  '#1e2130',
  border:   'rgba(255,255,255,0.08)',
  text:     '#f1f5f9',
  muted:    '#64748b',
  primary:  '#3b82f6',
};

function HeroPipeNetworkMockup() {
  return (
    <div style={{
      height: 390, background: DARK.bg,
      display: 'grid', gridTemplateColumns: '200px 1fr', overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <div style={{ background: DARK.card, borderRight: `1px solid ${DARK.border}`, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', marginBottom: 8 }}>
          <svg width={16} height={16} viewBox="0 0 28 28" fill="none">
            <circle cx={14} cy={14} r={14} fill="rgba(37,99,235,0.2)" />
            <path d="M14 4C14 4 6 12 6 18a8 8 0 0016 0c0-6-8-14-8-14z" fill="#3B82F6" />
          </svg>
          <div style={{ height: 7, width: 60, borderRadius: 4, background: DARK.border }} />
        </div>
        {['GIS Map','Dashboard','Alerts','NRW','Sensors','Reports'].map((item, i) => (
          <div key={item} style={{
            height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px',
            background: i === 0 ? 'rgba(37,99,235,0.18)' : 'transparent',
            border: i === 0 ? '1px solid rgba(59,130,246,0.35)' : '1px solid transparent',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: i === 0 ? 'rgba(59,130,246,0.6)' : DARK.border }} />
            <div style={{ fontSize: 11, color: i === 0 ? DARK.text : DARK.muted, fontWeight: i === 0 ? 600 : 400 }}>{item}</div>
          </div>
        ))}
      </div>
      {/* GIS canvas */}
      <div style={{
        position: 'relative', overflow: 'hidden', background: DARK.bg,
        backgroundImage: `repeating-linear-gradient(0deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 40px),repeating-linear-gradient(90deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 40px)`,
      }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="300" cy="210" rx="220" ry="150" fill="rgba(37,99,235,0.05)" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5" strokeDasharray="6 4" />
          {/* Mains */}
          <line x1="70" y1="210" x2="175" y2="150" stroke="#3b82f6" strokeWidth="3" opacity="0.75" />
          <line x1="175" y1="150" x2="300" y2="168" stroke="#3b82f6" strokeWidth="3" opacity="0.75" />
          <line x1="300" y1="168" x2="425" y2="138" stroke="#3b82f6" strokeWidth="3" opacity="0.7" />
          <line x1="425" y1="138" x2="528" y2="168" stroke="#3b82f6" strokeWidth="2.5" opacity="0.6" />
          {/* Secondaries */}
          <line x1="175" y1="150" x2="195" y2="265" stroke="#3b82f6" strokeWidth="2" opacity="0.5" />
          <line x1="300" y1="168" x2="308" y2="295" stroke="#3b82f6" strokeWidth="2" opacity="0.5" />
          <line x1="425" y1="138" x2="432" y2="282" stroke="#3b82f6" strokeWidth="2" opacity="0.45" />
          <line x1="195" y1="265" x2="308" y2="295" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" />
          <line x1="308" y1="295" x2="432" y2="282" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" />
          {/* Fault highlight */}
          <line x1="300" y1="168" x2="425" y2="138" stroke="#ef4444" strokeWidth="4" opacity="0.85" />
          {/* Nodes */}
          <GPin cx={70} cy={210} c="#22c55e" pulse />
          <GPin cx={175} cy={150} c="#22c55e" />
          <GPin cx={300} cy={168} c="#ef4444" pulse />
          <GPin cx={425} cy={138} c="#f59e0b" />
          <GPin cx={528} cy={168} c="#22c55e" />
          <GPin cx={195} cy={265} c="#22c55e" />
          <GPin cx={308} cy={295} c="#22c55e" />
          <GPin cx={432} cy={282} c="#f59e0b" />
          {/* Tank */}
          <rect x="52" y="188" width="36" height="22" rx="4" fill="#2563eb" opacity="0.9" />
          <text x="70" y="202" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">TANK</text>
          {/* Fault callout */}
          <rect x="314" y="106" width="138" height="40" rx="6" fill="#1a1d26" stroke="#ef4444" strokeWidth="1.5" />
          <text x="325" y="122" fill="#ef4444" fontSize="9" fontWeight="700">⚠ Pressure drop detected</text>
          <text x="325" y="137" fill="#64748b" fontSize="8">Pipe seg. 18 · Zone B3 · 2 min ago</text>
        </svg>
        {/* Chip row */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
          {[['Pipes','#3b82f6'],['Sensors','#94a3b8'],['Assets','#94a3b8']].map(([l,c]) => (
            <div key={l} style={{ padding: '4px 10px', borderRadius: 9999, background: DARK.card, border: `1px solid ${DARK.border}`, fontSize: 10, fontWeight: 600, color: c }}>{l}</div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 7, padding: '8px 12px', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[['#22c55e','Normal pressure'],['#f59e0b','Low pressure'],['#ef4444','Fault / leak risk']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'block' }} />
              <span style={{ color: DARK.text }}>{l}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ width: 16, height: 3, borderRadius: 2, background: '#ef4444', display: 'block' }} />
            <span style={{ color: DARK.text }}>Affected pipe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GPin({ cx, cy, c, pulse }: { cx: number; cy: number; c: string; pulse?: boolean }) {
  return (
    <g>
      {pulse && <circle cx={cx} cy={cy} r={12} fill={c} opacity={0.18} />}
      <circle cx={cx} cy={cy} r={5} fill={c} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
    </g>
  );
}

/* ─── MAP SCREEN — realistic aerial map look ─── */
function MapScreen() {
  return (
    <div style={{ background: '#0e1726', position: 'relative', height: 380, overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 900 380" preserveAspectRatio="xMidYMid slice">
        {/* Base land */}
        <rect width="900" height="380" fill="#15243a" />
        {/* Park / green spaces */}
        <ellipse cx="180" cy="120" rx="80" ry="40" fill="#1c3528" opacity="0.7" />
        <ellipse cx="720" cy="280" rx="90" ry="36" fill="#1c3528" opacity="0.7" />
        {/* Water body */}
        <path d="M0,310 Q160,295 320,308 T640,300 L640,380 L0,380 Z" fill="#0f2742" />
        <path d="M540,30 Q620,20 700,30 Q780,40 820,80 L820,140 Q780,150 720,140 Q660,128 600,130 Q540,128 540,90 Z" fill="#0f2742" opacity="0.85" />
        {/* Street grid — minor */}
        {[80, 160, 240, 320, 400, 480, 560, 640, 720, 800].map(x => (
          <line key={'v'+x} x1={x} y1={0} x2={x} y2={380} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        ))}
        {[60, 130, 200, 270].map(y => (
          <line key={'h'+y} x1={0} y1={y} x2={900} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        ))}
        {/* Major streets */}
        <path d="M0,180 L900,200" stroke="rgba(255,255,255,0.18)" strokeWidth={3} />
        <path d="M380,0 L420,380" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
        <path d="M0,90 L900,75" stroke="rgba(255,255,255,0.10)" strokeWidth={2} />
        <path d="M620,0 L640,380" stroke="rgba(255,255,255,0.10)" strokeWidth={2} />
        {/* Buildings (clusters) */}
        {[
          [80,140,22,16],[110,135,18,20],[135,148,20,14],[100,165,16,18],
          [440,55,28,18],[475,50,22,22],[500,60,24,16],[450,80,18,20],
          [680,180,24,16],[710,175,20,20],[735,185,22,14],
          [240,235,18,14],[265,240,22,16],[290,232,16,18],
          [780,110,20,18],[805,118,18,14],
        ].map(([x,y,w,h], i) => (
          <rect key={'b'+i} x={x as number} y={y as number} width={w as number} height={h as number} fill="rgba(255,255,255,0.10)" />
        ))}
        {/* DMA boundary */}
        <path d="M50,40 L860,40 L860,260 L50,260 Z" stroke="rgba(96,165,250,0.5)" strokeWidth={1.5} strokeDasharray="6 4" fill="none" />
        <text x="68" y="58" fill="rgba(147,197,253,0.85)" fontSize="10" fontWeight="700">DMA-North · 142 connections</text>
        {/* Pipe network */}
        <line x1="60" y1="180" x2="220" y2="120" stroke="#60a5fa" strokeWidth="2.5" />
        <line x1="220" y1="120" x2="400" y2="135" stroke="#60a5fa" strokeWidth="2.5" />
        <line x1="400" y1="135" x2="600" y2="115" stroke="#60a5fa" strokeWidth="2.5" />
        <line x1="600" y1="115" x2="820" y2="135" stroke="#60a5fa" strokeWidth="2" />
        <line x1="220" y1="120" x2="240" y2="240" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />
        <line x1="400" y1="135" x2="420" y2="245" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />
        <line x1="600" y1="115" x2="620" y2="240" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />
        <line x1="240" y1="240" x2="420" y2="245" stroke="#60a5fa" strokeWidth="1.2" opacity="0.45" />
        <line x1="420" y1="245" x2="620" y2="240" stroke="#60a5fa" strokeWidth="1.2" opacity="0.45" />
        {/* Tank icon */}
        <rect x="44" y="168" width="32" height="22" rx="3" fill="#2563eb" />
        <text x="60" y="183" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">TANK</text>
        {/* Pins */}
        <GPin cx={220} cy={120} c="#22c55e" />
        <GPin cx={400} cy={135} c="#f59e0b" />
        <GPin cx={600} cy={115} c="#22c55e" />
        <GPin cx={820} cy={135} c="#22c55e" />
        <GPin cx={240} cy={240} c="#22c55e" />
        <GPin cx={420} cy={245} c="#ef4444" pulse />
        <GPin cx={620} cy={240} c="#22c55e" />
      </svg>
      {/* Top layer chips */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
        {[['Network', true], ['Zones', false], ['Sensors', false], ['Alerts', false]].map(([l, active]) => (
          <div key={String(l)} style={{ padding: '5px 12px', borderRadius: 999, background: active ? 'rgba(37,99,235,0.85)' : DARK.card, border: `1px solid ${active ? 'rgba(96,165,250,0.6)' : DARK.border}`, fontSize: 10, fontWeight: 600, color: active ? '#fff' : DARK.muted }}>
            {String(l)}
          </div>
        ))}
      </div>
      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: 56, left: 12, display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 30, height: 30, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: DARK.text }}>+</div>
        <div style={{ width: 30, height: 30, background: DARK.card, borderLeft: `1px solid ${DARK.border}`, borderRight: `1px solid ${DARK.border}`, borderBottom: `1px solid ${DARK.border}`, borderRadius: '0 0 6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: DARK.text }}>−</div>
      </div>
      {/* Search bar */}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 6, padding: '6px 14px', fontSize: 11, color: DARK.muted, display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>Search pipe, sensor, valve…</span>
      </div>
      {/* Right info card */}
      <div style={{ position: 'absolute', top: 12, right: 12, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 9, padding: '12px 14px', fontSize: 11, minWidth: 200 }}>
        <div style={{ fontSize: 9, color: DARK.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>Live Network</div>
        {[
          ['Pipes monitored','142','#f1f5f9'],
          ['Active sensors','38','#f1f5f9'],
          ['Critical alerts','1','#ef4444'],
          ['Coverage','87%','#22c55e'],
        ].map(([k,v,c]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderTop: `1px solid ${DARK.border}` }}>
            <span style={{ color: DARK.muted }}>{k}</span>
            <span style={{ fontWeight: 700, color: c as string, fontFamily: 'var(--font-mono)' }}>{v}</span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 10, display: 'flex', gap: 12 }}>
        {[['#22c55e','Normal'],['#f59e0b','Warning'],['#ef4444','Critical']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'block' }} />
            <span style={{ color: DARK.text }}>{l}</span>
          </div>
        ))}
      </div>
      {/* Scale */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 5, padding: '4px 8px', fontSize: 9, color: DARK.muted, fontFamily: 'var(--font-mono)' }}>
        ── 500 m
      </div>
    </div>
  );
}

/* ─── GIS SCREEN — pipe network detail ─── */
function GISScreen() {
  return (
    <div style={{ background: DARK.bg, position: 'relative', height: 380, overflow: 'hidden',
      backgroundImage: `repeating-linear-gradient(0deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 28px)` }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 900 320" preserveAspectRatio="xMidYMid slice">
        <ellipse cx="450" cy="160" rx="340" ry="120" fill="rgba(37,99,235,0.05)" stroke="rgba(59,130,246,0.2)" strokeWidth="1" strokeDasharray="5 3" />
        <text x="120" y="50" fill="rgba(96,165,250,0.7)" fontSize="9" fontWeight="700">DMA-NORTH · Pressure Zone B</text>
        <line x1="80" y1="160" x2="220" y2="110" stroke="#3b82f6" strokeWidth="3.5" opacity="0.8" />
        <line x1="220" y1="110" x2="420" y2="130" stroke="#3b82f6" strokeWidth="3.5" opacity="0.8" />
        <line x1="420" y1="130" x2="620" y2="100" stroke="#3b82f6" strokeWidth="3" opacity="0.7" />
        <line x1="620" y1="100" x2="780" y2="125" stroke="#3b82f6" strokeWidth="3" opacity="0.65" />
        <line x1="220" y1="110" x2="240" y2="220" stroke="#3b82f6" strokeWidth="2" opacity="0.55" />
        <line x1="420" y1="130" x2="440" y2="230" stroke="#3b82f6" strokeWidth="2" opacity="0.55" />
        <line x1="620" y1="100" x2="640" y2="218" stroke="#3b82f6" strokeWidth="2" opacity="0.55" />
        <line x1="240" y1="220" x2="440" y2="230" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" />
        <line x1="440" y1="230" x2="640" y2="218" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" />
        {/* segment labels */}
        <text x="140" y="135" fill="rgba(147,197,253,0.6)" fontSize="8" fontFamily="monospace">SEG-018</text>
        <text x="310" y="115" fill="rgba(147,197,253,0.6)" fontSize="8" fontFamily="monospace">SEG-024</text>
        <text x="510" y="120" fill="rgba(255,255,255,0.95)" fontSize="9" fontWeight="700" fontFamily="monospace">SEG-034 ◀</text>
        <text x="690" y="110" fill="rgba(147,197,253,0.6)" fontSize="8" fontFamily="monospace">SEG-047</text>
        {/* highlighted selected segment */}
        <line x1="420" y1="130" x2="620" y2="100" stroke="#facc15" strokeWidth="4" opacity="0.85" />
        <GPin cx={80} cy={160} c="#22c55e" pulse />
        <GPin cx={220} cy={110} c="#22c55e" />
        <GPin cx={420} cy={130} c="#f59e0b" />
        <GPin cx={620} cy={100} c="#22c55e" />
        <GPin cx={780} cy={125} c="#22c55e" />
        <GPin cx={240} cy={220} c="#22c55e" />
        <GPin cx={440} cy={230} c="#22c55e" />
        <GPin cx={640} cy={218} c="#f59e0b" />
      </svg>
      {/* Pipe attribute panel */}
      <div style={{ position: 'absolute', top: 16, right: 16, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 9, padding: '12px 14px', fontSize: 11, minWidth: 180 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: DARK.text, fontSize: 12 }}>SEG-034</div>
          <span style={{ padding: '2px 7px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: 9, fontWeight: 700 }}>GOOD</span>
        </div>
        {[['Diameter','150 mm'],['Material','uPVC'],['Installed','2008'],['Length','187 m'],['Pressure class','PN16'],['Last inspect','Mar 2025']].map(([k,v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, borderTop: `1px solid ${DARK.border}`, paddingTop: 5, marginTop: 5 }}>
            <span style={{ color: DARK.muted }}>{k}</span>
            <span style={{ fontWeight: 600, color: DARK.text, fontFamily: 'var(--font-mono)' }}>{v}</span>
          </div>
        ))}
      </div>
      {/* Layer toggles */}
      <div style={{ position: 'absolute', top: 16, left: 16, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
        <div style={{ fontSize: 9, color: DARK.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 2 }}>Layers</div>
        {[['Mains', true], ['Service lines', true], ['DMAs', true], ['Valves', false]].map(([l, on]) => (
          <div key={String(l)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: on ? '#3b82f6' : 'transparent', border: `1px solid ${on ? '#3b82f6' : DARK.border}` }} />
            <span style={{ color: on ? DARK.text : DARK.muted }}>{String(l)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ALERTS SCREEN — incident feed ─── */
function AlertsScreen() {
  const alerts: Array<{ sev: 'CRITICAL' | 'WARNING' | 'RESOLVED'; title: string; loc: string; time: string; color: string }> = [
    { sev: 'CRITICAL', title: 'Pressure drop · Zone B3',       loc: 'Pipe SEG-018 · Milimani',       time: '2 min ago',  color: '#ef4444' },
    { sev: 'CRITICAL', title: 'Tank level critical',           loc: 'Industrial Tank · 3h to empty', time: '14 min ago', color: '#ef4444' },
    { sev: 'WARNING',  title: 'Flow anomaly detected',         loc: 'Flow M2 · DMA South',           time: '38 min ago', color: '#f59e0b' },
    { sev: 'WARNING',  title: 'Chlorine residual below 0.2',   loc: 'Node 21 · Zone C1',             time: '1h ago',     color: '#f59e0b' },
    { sev: 'RESOLVED', title: 'Pressure restored',             loc: 'Zone A2 · Resolved by team',    time: '2h ago',     color: '#22c55e' },
  ];
  return (
    <div style={{ background: DARK.bg, padding: 0 }}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px', borderBottom: `1px solid ${DARK.border}`, background: DARK.cardMut, alignItems: 'center' }}>
        {[['All','12',true],['Critical','2',false],['Warning','5',false],['Resolved','5',false]].map(([l,n,active]) => (
          <div key={String(l)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: active ? 'rgba(37,99,235,0.18)' : 'transparent', border: `1px solid ${active ? 'rgba(96,165,250,0.4)' : DARK.border}`, fontSize: 11, fontWeight: 600, color: active ? '#60a5fa' : DARK.muted }}>
            {String(l)}
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: active ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.06)', color: active ? '#60a5fa' : DARK.muted, fontFamily: 'var(--font-mono)' }}>{String(n)}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: DARK.muted, fontFamily: 'var(--font-mono)' }}>● Updated 12s ago</div>
      </div>
      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {alerts.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: i < alerts.length - 1 ? `1px solid ${DARK.border}` : 'none', borderLeft: `3px solid ${a.color}` }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: a.color, boxShadow: `0 0 0 4px ${a.color}22`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DARK.text, marginBottom: 3 }}>{a.title}</div>
              <div style={{ fontSize: 10, color: DARK.muted }}>{a.loc}</div>
            </div>
            <span style={{ padding: '3px 9px', borderRadius: 4, background: `${a.color}1A`, color: a.color, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', border: `1px solid ${a.color}44` }}>{a.sev}</span>
            <span style={{ fontSize: 10, color: DARK.muted, minWidth: 70, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{a.time}</span>
            <button style={{ background: 'transparent', border: `1px solid ${DARK.border}`, color: DARK.text, fontSize: 10, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>View</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetRegisterScreen() {
  return (
    <div className="sv-body" style={{ padding: 0 }}>
      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.7fr 0.9fr', gap: 8, padding: '8px 16px', background: DARK.cardMut, borderBottom: `1px solid ${DARK.border}`, fontSize: 10, fontWeight: 700, color: DARK.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span>Segment ID</span><span>Diameter</span><span>Material</span><span>Age</span><span>Condition</span>
      </div>
      {[
        { id: 'SEG-018', dia: '150 mm', mat: 'uPVC',      age: '16 yr', cond: 'Good',      c: '#22c55e' },
        { id: 'SEG-024', dia: '100 mm', mat: 'Cast Iron', age: '42 yr', cond: 'Poor',      c: '#ef4444' },
        { id: 'SEG-031', dia: '200 mm', mat: 'HDPE',      age: '8 yr',  cond: 'Excellent', c: '#22c55e' },
        { id: 'SEG-047', dia: '75 mm',  mat: 'GI',        age: '35 yr', cond: 'Fair',      c: '#f59e0b' },
        { id: 'SEG-052', dia: '150 mm', mat: 'uPVC',      age: '12 yr', cond: 'Good',      c: '#22c55e' },
        { id: 'SEG-061', dia: '250 mm', mat: 'Ductile CI',age: '28 yr', cond: 'Fair',      c: '#f59e0b' },
      ].map((row, i) => (
        <div key={row.id} style={{
          display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.7fr 0.9fr', gap: 8,
          padding: '10px 16px', borderBottom: `1px solid ${DARK.border}`,
          background: i % 2 === 0 ? 'transparent' : DARK.cardMut,
          fontSize: 11, alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 11, color: DARK.text }}>{row.id}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: DARK.text }}>{row.dia}</span>
          <span style={{ color: DARK.muted }}>{row.mat}</span>
          <span style={{ color: DARK.muted }}>{row.age}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 9999, background: `${row.c}1A`, color: row.c, fontSize: 10, fontWeight: 700, border: `1px solid ${row.c}44`, width: 'fit-content' }}>{row.cond}</span>
        </div>
      ))}
      {/* Summary */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 24, background: DARK.cardMut, borderTop: `1px solid ${DARK.border}` }}>
        {[['142','total segments'],['23%','need review'],['4','critical age']].map(([v,l]) => (
          <div key={l}>
            <span style={{ fontSize: 16, fontWeight: 700, color: DARK.text, fontFamily: 'var(--font-mono)' }}>{v} </span>
            <span style={{ fontSize: 11, color: DARK.muted }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NRWScreen() {
  const bars = [
    { zone: 'DMA North', pct: 18, c: '#ef4444' },
    { zone: 'DMA South', pct: 11, c: '#f59e0b' },
    { zone: 'Industrial', pct:  8, c: '#3b82f6' },
    { zone: 'CBD',        pct:  6, c: '#22c55e' },
    { zone: 'Residential E', pct: 5, c: '#22c55e' },
  ];
  return (
    <div className="sv-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>Loss by DMA Zone</div>
        <div style={{ fontSize: 11, color: DARK.muted }}>Last 30 days · updated hourly</div>
      </div>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[['Total NRW','12.4%','#ef4444'],['Billed Water','87.6%','#22c55e'],['Night Min Flow','1.8 L/s','#f59e0b']].map(([l,v,c]) => (
          <div key={l} style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: DARK.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-mono)' }}>{v}</div>
          </div>
        ))}
      </div>
      {/* Bar chart */}
      <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bars.map(b => (
          <div key={b.zone} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 100, fontSize: 11, color: DARK.text, flexShrink: 0 }}>{b.zone}</div>
            <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ width: `${(b.pct / 20) * 100}%`, height: '100%', background: b.c, borderRadius: 6 }} />
            </div>
            <div style={{ width: 38, fontSize: 12, fontWeight: 700, color: b.c, fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>{b.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Data ─── */
const TESTIMONIALS = [
  { quote: 'We can now see every pipe segment on the map with its diameter and material. Before, that data lived in spreadsheets nobody could find.', name: 'Michael Grant', org: 'Head of Operations · Riverton Water & Sanitation Co.', initials: 'MG' },
  { quote: 'The pressure sensor feeds caught a zone anomaly at 02:30 AM. We had a crew on site before the first customer complaint came in.', name: 'Amina Odhiambo', org: 'Network Engineer · Nakuru Urban Water', initials: 'AO' },
  { quote: 'Tank level alerts mean operations know a reservoir is getting low before it ever hits a service interruption. It changed our night shifts.', name: 'Samuel Kipchoge', org: 'Operations Director · Eldoret Water', initials: 'SK' },
];

const FEATURES = [
  { title: 'GIS Pipe Network Map', desc: 'Import shapefiles or draw your distribution network. Every pipe mapped with diameter, material, age, and pressure rating.', badge: 'Core module', icon: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></> },
  { title: 'Pressure & Flow Sensors', desc: 'Real-time readings from every sensor node. Pressure charts, flow meter feeds, and threshold monitoring across all DMAs.', badge: null, icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></> },
  { title: 'Leak Detection & Localisation', desc: 'Pressure-drop pattern analysis flags anomalies within seconds and highlights the probable pipe segment on the GIS map.', badge: 'Differentiator', icon: <><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></> },
  { title: 'Tank & Reservoir Levels', desc: 'Water level sensors on every tank stream live fill percentage, fill rate, drain rate, and estimated time-to-empty.', badge: null, icon: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></> },
  { title: 'Asset Register', desc: 'Click any asset on the map to see its full profile. Query your network by age, material, or condition to plan rehabilitation.', badge: null, icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></> },
  { title: 'NRW & Loss Analytics', desc: 'Hourly non-revenue water percentages by DMA. Night minimum flow analysis for background leakage baseline.', badge: null, icon: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
  { title: 'Water Quality Monitoring', desc: 'pH, chlorine residual, turbidity, and conductivity sensors tracked alongside pressure and flow in the same dashboard.', badge: null, icon: <><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></> },
  { title: 'Historical Replay', desc: 'Replay any sensor, zone, or network event over 90 days. Compare against baselines and seasonal patterns.', badge: null, icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
  { title: 'Operational Reports', desc: 'Daily, weekly, and monthly exports for regulators, board meetings, and internal reviews. Scheduled or on demand.', badge: null, icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></> },
];

/* ─── Icon helpers ─── */
/**
 * Aperture A — Aquawise primary mark.
 * Three nested chevrons sharing an apex at (32, 14), baseline y=50,
 * stroke 3.5u, round caps, layer opacities 1.0 / 0.50 / 0.22.
 */
function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="Aquawise">
      <path d="M12 50 L32 14 L52 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 50 L32 14 L43 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
      <path d="M29 50 L32 14 L35 50" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.22} />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx={12} cy={12} r={4} />
      <line x1={12} y1={2} x2={12} y2={4}/><line x1={12} y1={20} x2={12} y2={22}/>
      <line x1={4.93} y1={4.93} x2={6.34} y2={6.34}/><line x1={17.66} y1={17.66} x2={19.07} y2={19.07}/>
      <line x1={2} y1={12} x2={4} y2={12}/><line x1={20} y1={12} x2={22} y2={12}/>
      <line x1={4.93} y1={19.07} x2={6.34} y2={17.66}/><line x1={17.66} y1={6.34} x2={19.07} y2={4.93}/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

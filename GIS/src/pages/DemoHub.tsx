/**
 * Explore demo — a single short form (work email + company) that opens the
 * live demo. Returning visitors in the same session go straight in.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { submitDemoRequest } from '../api';
import { grantDemoAccess, hasDemoAccess } from '../access';
import '../landing.css';

export default function DemoHub() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hasDemoAccess()) navigate('/overview', { replace: true });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await submitDemoRequest({ name: '', email: email.trim(), company: company.trim(), reason: 'Explore demo', kind: 'demo' });
    } catch {
      // The demo stays open even if the lead service is unreachable; keep the
      // details locally so they aren't lost.
      try {
        const saved = JSON.parse(localStorage.getItem('aw:pending-leads') || '[]');
        saved.push({ email: email.trim(), company: company.trim(), at: new Date().toISOString() });
        localStorage.setItem('aw:pending-leads', JSON.stringify(saved));
      } catch { /* ignore */ }
    }
    grantDemoAccess();
    navigate('/overview');
  };

  return (
    <div className="landing ed xd">
      <header className="ed-nav scrolled">
        <div className="ed-wrap ed-nav-in">
          <Link to="/" className="ed-brand" aria-label="AquaWise home">
            <svg width={22} height={22} viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path d="M12 50 L32 14 L52 50" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 50 L32 14 L43 50" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
            </svg>
            <span>Aqua<b>Wise</b></span>
          </Link>
          <Link to="/" className="ed-link-btn" style={{ marginLeft: 'auto' }}>← Back to site</Link>
        </div>
      </header>

      <main className="ed-wrap xd-grid">
        <section className="xd-form-col">
          <p className="ed-eyebrow">Live demo · Erline Water network</p>
          <h1 className="xd-title">Explore the demo</h1>
          <p className="xd-sub">See a real utility network the way AquaWise sees it: live water quality, pressure and tank levels on one map. Tell us where to reach you and we’ll open it straight away.</p>
          <form className="xd-form" onSubmit={submit}>
            <label>
              <span>Work email</span>
              <input type="email" required autoComplete="email" placeholder="you@utility.co.ke" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label>
              <span>Company</span>
              <input type="text" required autoComplete="organization" placeholder="Your utility or organisation" value={company} onChange={e => setCompany(e.target.value)} />
            </label>
            <button type="submit" className="ed-btn ed-btn-blue" disabled={busy}>{busy ? 'Opening…' : 'Explore the demo'}</button>
          </form>
          <p className="xd-note">No password and no sales call. We’ll only use your email to follow up about AquaWise.</p>
        </section>
        <figure className="xd-shot">
          <img src="/img/ui/view-overview.webp" alt="AquaWise Overview showing network health, alerts, water quality, the network map and issues needing attention" />
        </figure>
      </main>
    </div>
  );
}

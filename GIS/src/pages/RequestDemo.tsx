/**
 * RequestDemo — full-page lead-capture form that gates the live demo and powers
 * the "Book a Walkthrough" CTA. Collects work email + company + why, posts it to
 * the backend (which emails the team), then unlocks the demo (mode=demo) or
 * shows a confirmation (mode=book).
 *
 * Routes:
 *   /request-demo            → demo-access gate
 *   /request-demo?mode=book  → walkthrough booking
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../theme';
import { submitDemoRequest } from '../api';
import { grantDemoAccess } from '../access';

const COPY = {
  demo: {
    eyebrow: 'Live demo access',
    title: 'See the live demo.',
    sub: 'Tell us who you are and we’ll open the live Riverton water network demo. No password needed.',
    cta: 'Open the live demo →',
    busy: 'Submitting…',
  },
  book: {
    eyebrow: 'Book a walkthrough',
    title: 'Book a walkthrough.',
    sub: 'Leave your details and a short note — we’ll email you to schedule a 30-minute walkthrough.',
    cta: 'Request walkthrough →',
    busy: 'Sending…',
  },
} as const;

export default function RequestDemo() {
  const { mode: theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'book' ? 'book' : 'demo';
  const copy = COPY[mode];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitDemoRequest({
        name: name.trim(), email: email.trim(), company: company.trim(),
        reason: reason.trim(), kind: mode,
      });
      if (mode === 'demo') {
        grantDemoAccess();
        navigate('/demo');
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demo-hub">
      <nav className="demo-hub-nav">
        <Link to="/" className="demo-hub-brand">
          <BrandMark />
          <span>Aqua<b>wise</b></span>
        </Link>
        <div className="demo-hub-nav-meta">
          <span className="demo-hub-pill"><span className="live-dot" />Live · Riverton Water Network</span>
          <button className="theme-toggle" onClick={toggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'}`}>
            {theme === 'dark' ? '☀' : '☾'} {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </nav>

      <header className="demo-hub-head">
        <div className="demo-hub-eyebrow">
          <Link to="/" className="demo-back-link">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to home
          </Link>
        </div>
        <h1>{copy.title}</h1>
        <p>{copy.sub}</p>
      </header>

      <section className="request-demo-wrap">
        {done ? (
          <div className="request-demo-card request-demo-done">
            <div className="demo-modal-check" aria-hidden>✓</div>
            <h2>Thanks, {name || 'we’ve got it'}.</h2>
            <p>Your request was sent to our team — we’ll be in touch at <strong>{email}</strong> shortly.</p>
            <Link to="/" className="btn btn-primary btn-lg">Back to home</Link>
          </div>
        ) : (
          <form className="request-demo-card demo-modal-form" onSubmit={submit}>
            <label>
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoFocus />
            </label>
            <label>
              <span>Work email <em>*</em></span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@utility.com" />
            </label>
            <label>
              <span>Company / utility <em>*</em></span>
              <input required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Riverton Water & Sanitation Co." />
            </label>
            <label>
              <span>What would you like to see? <em>*</em></span>
              <textarea required rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="We manage ~800 km of network and want to evaluate leak detection and NRW tracking." />
            </label>

            {error && <div className="demo-modal-error" role="alert">{error}</div>}

            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? copy.busy : copy.cta}
            </button>
            <p className="demo-modal-fine">We’ll only use this to contact you about Aquawise. No spam.</p>
          </form>
        )}
      </section>
    </div>
  );
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

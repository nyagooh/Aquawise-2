/**
 * API client for the AquaWise GIS backend (apps/parsing).
 *
 * The upload demo posts a single GIS file to the stateless parse endpoint and
 * receives the { pipes, assets, meta } GeoJSON payload the map renders. Point
 * the frontend at a backend with the VITE_API_URL env var (defaults to the
 * local Django dev server on :8000).
 */

const API_BASE = (
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'http://localhost:8000'
).replace(/\/$/, '');

/** Raw response shape from POST /api/v1/parse/ */
export interface ParseResponse {
  pipes: { type: 'FeatureCollection'; features: unknown[] };
  assets: { type: 'FeatureCollection'; features: unknown[] };
  meta: unknown;
}

export interface DemoRequest {
  name?: string;
  email: string;
  company: string;
  reason: string;
  kind: 'demo' | 'book';
}

/** Submit a demo-access / walkthrough request — emailed to the team by the backend. */
export async function submitDemoRequest(payload: DemoRequest): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/demo-request/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Could not reach the server at ${API_BASE}. Please try again shortly.`);
  }
  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status}).`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      else if (data?.email) message = `Email: ${data.email}`;
      else if (data?.company) message = `Company: ${data.company}`;
      else if (data?.reason) message = `Reason: ${data.reason}`;
    } catch { /* keep default */ }
    throw new Error(message);
  }
}

/** Upload a single GIS file and parse it into renderable network GeoJSON. */
export async function parseNetworkFile(file: File): Promise<ParseResponse> {
  const body = new FormData();
  body.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/parse/`, { method: 'POST', body });
  } catch {
    throw new Error(
      `Could not reach the GIS backend at ${API_BASE}. ` +
      'Start it with: cd GIS/backend && DJANGO_SETTINGS_MODULE=aquawise_gis.settings.demo venv/bin/python manage.py runserver'
    );
  }

  if (!res.ok) {
    let message = `Upload failed (HTTP ${res.status}).`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return res.json();
}

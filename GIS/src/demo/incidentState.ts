/**
 * Session-level incident workflow state (acknowledge / resolve) layered over
 * the model's seeded incidents, shared by the Alerts page, Overview and the
 * sidebar badge.
 */
import { useEffect, useState } from 'react';
import type { Incident, IncidentStatus } from './model';
import { NOW } from './series';

const KEY = 'aw:incident-status';
type Override = { status: IncidentStatus; at: number };
let overrides: Record<string, Override> = (() => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; }
})();
const listeners = new Set<() => void>();

export function setIncidentStatus(id: string, status: IncidentStatus) {
  overrides = { ...overrides, [id]: { status, at: Date.now() } };
  try { sessionStorage.setItem(KEY, JSON.stringify(overrides)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function withState(list: Incident[]): Incident[] {
  return list.map(i => {
    const o = overrides[i.id];
    if (!o) return i;
    return { ...i, status: o.status, resolvedAt: o.status === 'resolved' ? Math.max(NOW, o.at) : i.resolvedAt };
  });
}

/** Re-render on any acknowledge / resolve. */
export function useIncidentState(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const l = () => setV(x => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}

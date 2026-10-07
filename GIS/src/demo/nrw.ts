/**
 * Zone supply / NRW figures and 12-month NRW history. Pure data — no network
 * load — so the marketing page can show exactly the numbers the demo shows.
 */
import { stableRand, NOW } from './series';

export const ZONE_SEED: Array<{ code: string; connections: number; supplied: number; nrw: number; nrwPrev: number }> = [
  { code: 'MIL',    connections: 8470,  supplied: 9800,  nrw: 41.2, nrwPrev: 39.8 },
  { code: 'MYT',    connections: 7760,  supplied: 11200, nrw: 38.5, nrwPrev: 41.6 },
  { code: 'CBD',    connections: 6240,  supplied: 12600, nrw: 29.0, nrwPrev: 32.4 },
  { code: 'KREKAJ', connections: 5580,  supplied: 8400,  nrw: 27.9, nrwPrev: 30.7 },
  { code: 'ME',     connections: 2490,  supplied: 4100,  nrw: 22.4, nrwPrev: 25.1 },
  { code: 'OBA',    connections: 1530,  supplied: 2600,  nrw: 19.8, nrwPrev: 22.9 },
  { code: 'KRE',    connections: 1390,  supplied: 1900,  nrw: 17.5, nrwPrev: 19.6 }
];
export const ZONE_CODES = ZONE_SEED.map(z => z.code);

export interface NrwMonth { month: string; t: number; supplied: number; billed: number; nrw: number; byZone: Record<string, number> }

/** 12 months of NRW, oldest first. Riverside worsening, other zones improving. */
export function buildNrwMonthly(): NrwMonth[] {
  const out: NrwMonth[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(NOW); d.setDate(1); d.setMonth(d.getMonth() - i);
    const byZone: Record<string, number> = {};
    let supplied = 0; let loss = 0;
    for (const z of ZONE_SEED) {
      const drift = z.code === 'MIL' ? -0.55 : 0.42;
      const v = i === 0 ? z.nrw : i === 1 ? z.nrwPrev : z.nrwPrev + drift * (i - 1) + (stableRand(`nrw:${z.code}:${i}`) - 0.5) * 2.2;
      byZone[z.code] = Math.round(v * 10) / 10;
      const sup = z.supplied * 30 * (0.96 + stableRand(`sup:${z.code}:${i}`) * 0.08);
      supplied += sup; loss += sup * v / 100;
    }
    out.push({
      month: d.toLocaleString('en-US', { month: 'short' }), t: d.getTime(),
      supplied: Math.round(supplied), billed: Math.round(supplied - loss), nrw: Math.round((loss / supplied) * 1000) / 10, byZone
    });
  }
  return out;
}

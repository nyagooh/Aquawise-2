/**
 * Zone supply / NRW figures and 12-month NRW history. Pure data — no network
 * load — so the marketing page can show exactly the numbers the demo shows.
 */
import { stableRand, NOW } from './series';

export const ZONE_SEED: Array<{ code: string; connections: number; supplied: number; nrw: number; nrwPrev: number }> = [
  { code: 'SHAURI',   connections: 3120, supplied: 1650, nrw: 38.6, nrwPrev: 36.9 },
  { code: 'ZIWANI3',  connections: 2680, supplied: 1420, nrw: 35.2, nrwPrev: 38.1 },
  { code: 'ZIWANI2',  connections: 2150, supplied: 1080, nrw: 29.4, nrwPrev: 31.8 },
  { code: 'ZIWANI1',  connections: 1460, supplied: 760,  nrw: 24.7, nrwPrev: 27.3 },
  { code: 'KWANJORA', connections: 1090, supplied: 640,  nrw: 19.6, nrwPrev: 22.0 }
];
export const ZONE_CODES = ZONE_SEED.map(z => z.code);

export interface NrwMonth { month: string; t: number; supplied: number; billed: number; nrw: number; byZone: Record<string, number> }

/** 12 months of NRW, oldest first. Shauri worsening, other zones improving. */
export function buildNrwMonthly(): NrwMonth[] {
  const out: NrwMonth[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(NOW); d.setDate(1); d.setMonth(d.getMonth() - i);
    const byZone: Record<string, number> = {};
    let supplied = 0; let loss = 0;
    for (const z of ZONE_SEED) {
      const drift = z.code === 'SHAURI' ? -0.55 : 0.42;
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

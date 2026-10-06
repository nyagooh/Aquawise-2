/**
 * Global filters shared by every demo page: utility, zone/DMA and date range.
 * Persisted per tab so moving between pages keeps the operator's context.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { rangeSpec, type RangeKey, type RangeSpec } from './series';

interface Filters {
  zone: string;            // 'ALL' or zone code
  range: RangeKey;
  customDays: number;
  setZone: (z: string) => void;
  setRange: (r: RangeKey) => void;
  setCustomDays: (d: number) => void;
  spec: RangeSpec;
}

const Ctx = createContext<Filters | null>(null);
const KEY = 'aw:filters';

export function FiltersProvider({ children }: { children: ReactNode }) {
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; }
  })();
  const [zone, setZone] = useState<string>(saved.zone || 'ALL');
  const [range, setRange] = useState<RangeKey>(saved.range || '24H');
  const [customDays, setCustomDays] = useState<number>(saved.customDays || 14);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ zone, range, customDays })); } catch { /* ignore */ }
  }, [zone, range, customDays]);
  return (
    <Ctx.Provider value={{ zone, range, customDays, setZone, setRange, setCustomDays, spec: rangeSpec(range, customDays) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFilters(): Filters {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFilters must be used inside FiltersProvider');
  return v;
}

/** True when the item's zone passes the global zone filter. */
export const inZone = (zone: string, filter: string) => filter === 'ALL' || zone === filter;

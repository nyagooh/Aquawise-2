export type ZoneStatus = 'safe' | 'warn' | 'danger';
export type SensorStatus = ZoneStatus | 'offline';
export type Severity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'resolved';
export type LeakStatus = 'reported' | 'dispatched' | 'in_progress' | 'fixed';
export type LeakSeverity = 'minor' | 'major' | 'critical';

export interface Zone {
  id: string;
  name: string;
  people: number;
  alerts: number;
  pressure: number;
  status: ZoneStatus;
  loss: number;
  color: string;
}

export interface Sensor {
  id: string;
  type: 'Pressure' | 'Level' | 'pH' | 'Turbidity';
  zone: string;
  reading: string;
  status: SensorStatus;
  updated: string;
}

export interface Pipe {
  id: string;
  type: 'PVC' | 'HDPE' | 'DI';
  diameter: string;
  zone: string;
  pressure: string;
}

export interface Alert {
  id: string;
  type: string;
  zone: string;
  sensor: string;
  severity: Severity;
  time: string;
  status: AlertStatus;
}

export const zones: Zone[] = [
  { id: 'MIL', name: 'Riverside',        people: 16200, alerts: 1, pressure: 3.5, status: 'safe',   loss: 7,  color: '#22C55E' },
  { id: 'CBD', name: 'Downtown Central', people: 23400, alerts: 2, pressure: 2.0, status: 'warn',   loss: 19, color: '#F59E0B' },
  { id: 'KRE', name: 'Millwood',         people: 18100, alerts: 0, pressure: 3.1, status: 'safe',   loss: 10, color: '#22C55E' },
  { id: 'MYT', name: 'Northgate',        people: 26800, alerts: 1, pressure: 1.5, status: 'danger', loss: 25, color: '#EF4444' },
  { id: 'OBA', name: 'Westhaven',        people: 12750, alerts: 0, pressure: 3.7, status: 'safe',   loss: 6,  color: '#22C55E' }
];

export const sensors: Sensor[] = [
  { id: 'PR-01', type: 'Pressure',  zone: 'MIL', reading: '3.4 bar', status: 'safe',    updated: '12s ago' },
  { id: 'PR-02', type: 'Pressure',  zone: 'CBD', reading: '2.1 bar', status: 'warn',    updated: '8s ago' },
  { id: 'PR-03', type: 'Pressure',  zone: 'MYT', reading: '1.4 bar', status: 'danger',  updated: '4s ago' },
  { id: 'PR-04', type: 'Pressure',  zone: 'KRE', reading: '3.2 bar', status: 'safe',    updated: '11s ago' },
  { id: 'LV-01', type: 'Level',     zone: 'MIL', reading: '87%',     status: 'safe',    updated: '20s ago' },
  { id: 'LV-02', type: 'Level',     zone: 'MYT', reading: '34%',     status: 'warn',    updated: '15s ago' },
  { id: 'LV-03', type: 'Level',     zone: 'OBA', reading: '92%',     status: 'safe',    updated: '9s ago' },
  { id: 'PH-01', type: 'pH',        zone: 'MIL', reading: '7.2',     status: 'safe',    updated: '1m ago' },
  { id: 'PH-02', type: 'pH',        zone: 'CBD', reading: '6.9',     status: 'safe',    updated: '1m ago' },
  { id: 'PH-03', type: 'pH',        zone: 'KRE', reading: '—',       status: 'offline', updated: '2h ago' },
  { id: 'TB-01', type: 'Turbidity', zone: 'MIL', reading: '0.8 NTU', status: 'safe',    updated: '45s ago' },
  { id: 'TB-02', type: 'Turbidity', zone: 'CBD', reading: '1.2 NTU', status: 'safe',    updated: '40s ago' },
  { id: 'TB-03', type: 'Turbidity', zone: 'MYT', reading: '4.6 NTU', status: 'warn',    updated: '30s ago' },
  { id: 'TB-04', type: 'Turbidity', zone: 'OBA', reading: '6.1 NTU', status: 'danger',  updated: '25s ago' }
];

export const pipes: Pipe[] = [
  { id: 'P-101', type: 'PVC',  diameter: '150mm', zone: 'MIL', pressure: '3.4 bar' },
  { id: 'P-102', type: 'HDPE', diameter: '200mm', zone: 'CBD', pressure: '2.1 bar' },
  { id: 'P-103', type: 'HDPE', diameter: '250mm', zone: 'KRE', pressure: '3.2 bar' },
  { id: 'P-104', type: 'PVC',  diameter: '100mm', zone: 'MYT', pressure: '1.4 bar' },
  { id: 'P-105', type: 'DI',   diameter: '300mm', zone: 'OBA', pressure: '3.6 bar' }
];

export interface Leak {
  id: string;
  caller: string;
  phone: string;
  zone: string;
  address: string;
  reported: string;
  source: 'CSR call' | 'CSR chat' | 'CSR email';
  status: LeakStatus;
  severity: LeakSeverity;
  pipe?: string;
  notes: string;
  /* Georeference — WGS84 [lat, lng] so the leak can be plotted on the map */
  lat: number;
  lng: number;
  /* Plumber resolution — populated when status === 'fixed' or 'in_progress' */
  crew?: string;
  timeStarted?: string;
  timeFixed?: string;
  materials?: string;
  cost?: string;
  cause?: string;
  fixDescription?: string;
  leakType?: 'Burst' | 'Joint failure' | 'Hairline crack' | 'Meter leak' | 'Valve leak';
}

/* Leak tickets ingested from the customer-support system.
   Tickets are created in the CSR app when a caller reports a leak — the
   utility just pulls them in and lets a plumber log the fix here. */
export const leaks: Leak[] = [
  { id: 'LK-2041', caller: 'Maria Alvarez',  phone: '+1 (555) 014-2901', zone: 'MYT', address: 'Northgate Ave, near Riverside Mall', reported: '2026-05-25 08:14', source: 'CSR call',  status: 'reported',    severity: 'critical', pipe: 'P-104', notes: 'Water gushing from road surface, traffic affected.', lat: -0.0588, lng: 34.7861 },
  { id: 'LK-2040', caller: 'James Carter',   phone: '+1 (555) 044-2118', zone: 'CBD', address: 'Main St, opp. Central Plaza',  reported: '2026-05-25 07:32', source: 'CSR call',  status: 'dispatched',  severity: 'major',    pipe: 'P-102', notes: 'Wet patch on pavement, slow seepage for 2 days.', lat: -0.0917, lng: 34.7603 },
  { id: 'LK-2039', caller: 'Grace Bennett',  phone: '+1 (555) 059-0230', zone: 'MIL', address: 'Riverside, Elm Road',         reported: '2026-05-25 06:58', source: 'CSR chat',  status: 'in_progress', severity: 'minor',    pipe: 'P-101', notes: 'Visible joint leak on shared connection.', crew: 'Crew C · Diallo', timeStarted: '07:30', lat: -0.1018, lng: 34.7549 },
  { id: 'LK-2038', caller: 'David Osei',     phone: '+1 (555) 011-9660', zone: 'MYT', address: 'Northgate, Kingsway junction',         reported: '2026-05-24 21:11', source: 'CSR call',  status: 'fixed',       severity: 'major',    pipe: 'P-104', notes: 'Burst on 100mm line, isolated and patched.', crew: 'Crew A · Reyes',  timeStarted: '21:55', timeFixed: '23:40', materials: 'PVC sleeve, clamp, 0.8m pipe', cost: '$320', cause: 'Old joint failure', fixDescription: 'Replaced 0.8m segment, re-pressurised.', leakType: 'Burst', lat: -0.0552, lng: 34.8004 },
  { id: 'LK-2037', caller: 'Aisha Khan',     phone: '+1 (555) 000-8442', zone: 'KRE', address: 'Millwood Rd, near the old mill',       reported: '2026-05-24 18:42', source: 'CSR call',  status: 'fixed',       severity: 'minor',    pipe: 'P-103', notes: 'Meter-box leak, slow drip.',                  crew: 'Crew B · Novak', timeStarted: '19:30', timeFixed: '20:10', materials: 'Washers, thread tape',         cost: '$45',   cause: 'Worn washer',       fixDescription: 'Replaced inlet washer.',                  leakType: 'Meter leak', lat: -0.0701, lng: 34.8203 },
  { id: 'LK-2036', caller: 'Peter Nolan',    phone: '+1 (555) 077-6514', zone: 'OBA', address: 'Westhaven, Cedar lane',          reported: '2026-05-24 14:20', source: 'CSR email', status: 'reported',    severity: 'major',    pipe: 'P-105', notes: 'Reported on email; large pool by community tap.', lat: -0.0852, lng: 34.7307 }
];

export const alerts: Alert[] = [
  { id: 'A-1023', type: 'Low pressure',      zone: 'MYT', sensor: 'PR-03', severity: 'critical', time: '3 min ago',  status: 'active' },
  { id: 'A-1022', type: 'Tank level low',    zone: 'MYT', sensor: 'LV-02', severity: 'warning',  time: '14 min ago', status: 'active' },
  { id: 'A-1021', type: 'Pressure anomaly',  zone: 'CBD', sensor: 'PR-02', severity: 'warning',  time: '38 min ago', status: 'active' },
  { id: 'A-1020', type: 'Sensor offline',    zone: 'KRE', sensor: 'PH-03', severity: 'info',     time: '2h ago',     status: 'active' },
  { id: 'A-1019', type: 'NRW spike',         zone: 'CBD', sensor: '—',     severity: 'warning',  time: '4h ago',     status: 'resolved' },
  { id: 'A-1018', type: 'Pressure recovery', zone: 'MIL', sensor: 'PR-01', severity: 'info',     time: '6h ago',     status: 'resolved' }
];

/* ── Real Nairobi coordinates for the aerial map ── */
/* Lat/Lng polygons covering Westlands, Kileleshwa, Lavington, Karen, Industrial */
export type LatLng = [number, number];

export const zonePolys: Record<string, LatLng[]> = {
  ZA: [ /* Westlands */
    [-1.2540, 36.7920], [-1.2540, 36.8120], [-1.2700, 36.8160],
    [-1.2780, 36.8060], [-1.2740, 36.7900]
  ],
  ZB: [ /* Kileleshwa */
    [-1.2780, 36.7820], [-1.2780, 36.7950], [-1.2900, 36.7980],
    [-1.2960, 36.7860], [-1.2890, 36.7780]
  ],
  ZC: [ /* Lavington */
    [-1.2780, 36.7600], [-1.2780, 36.7800], [-1.2920, 36.7820],
    [-1.2980, 36.7700], [-1.2900, 36.7560]
  ],
  ZD: [ /* Karen (south-west, larger) */
    [-1.3050, 36.6800], [-1.3050, 36.7220], [-1.3380, 36.7280],
    [-1.3460, 36.7100], [-1.3360, 36.6800]
  ],
  ZE: [ /* Industrial Area (east) */
    [-1.2960, 36.8400], [-1.2940, 36.8620], [-1.3120, 36.8680],
    [-1.3200, 36.8560], [-1.3100, 36.8380]
  ]
};

export const zoneCenters: Record<string, LatLng> = {
  ZA: [-1.2670, 36.8050],
  ZB: [-1.2860, 36.7880],
  ZC: [-1.2870, 36.7700],
  ZD: [-1.3210, 36.7050],
  ZE: [-1.3050, 36.8520]
};

/* Pipes drawn between sensors / tanks along realistic routes */
export const pipeLatLng: Array<{ id: string; path: LatLng[]; main: boolean }> = [
  { id: 'P-101', main: true,  path: [[-1.2670, 36.8050], [-1.2860, 36.7880]] },
  { id: 'P-102', main: true,  path: [[-1.2860, 36.7880], [-1.2870, 36.7700]] },
  { id: 'P-103', main: true,  path: [[-1.2870, 36.7700], [-1.3210, 36.7050]] },
  { id: 'P-104', main: false, path: [[-1.2860, 36.7880], [-1.3210, 36.7050]] },
  { id: 'P-105', main: true,  path: [[-1.2870, 36.7700], [-1.3050, 36.8520]] },
  { id: 'P-106', main: false, path: [[-1.2670, 36.8050], [-1.2580, 36.8000]] },
  { id: 'P-107', main: false, path: [[-1.3210, 36.7050], [-1.3340, 36.7080]] },
  { id: 'P-108', main: false, path: [[-1.3050, 36.8520], [-1.3000, 36.8600]] }
];

export const tanksLatLng: Array<{ id: string; pos: LatLng; zone: string; level: number }> = [
  { id: 'T-01', pos: [-1.2580, 36.8000], zone: 'ZA', level: 87 },
  { id: 'T-02', pos: [-1.2820, 36.7720], zone: 'ZC', level: 62 },
  { id: 'T-03', pos: [-1.3000, 36.8600], zone: 'ZE', level: 92 }
];

export const sensorLatLng: Record<string, LatLng> = {
  'PR-01': [-1.2670, 36.8050],
  'PR-02': [-1.2860, 36.7880],
  'PR-03': [-1.3210, 36.7050],
  'PR-04': [-1.2870, 36.7700],
  'LV-01': [-1.2580, 36.8000],
  'LV-02': [-1.3340, 36.7080],
  'LV-03': [-1.3000, 36.8600],
  'PH-01': [-1.2700, 36.8000],
  'PH-02': [-1.2900, 36.7900],
  'PH-03': [-1.2880, 36.7720]
};

/* Map default view */
export const MAP_CENTER: LatLng = [-1.2920, 36.7820];
export const MAP_ZOOM = 12;

export const statusColor = (s: SensorStatus): string =>
  ({ safe: '#22C55E', warn: '#F59E0B', danger: '#EF4444', offline: '#64748B' }[s] || '#64748B');

export const statusLabel = (s: SensorStatus): string =>
  ({ safe: 'Online', warn: 'Anomaly', danger: 'Critical', offline: 'Offline' }[s] || s);

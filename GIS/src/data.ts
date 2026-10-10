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
  type: string;
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
  { id: 'SHAURI',    name: 'Shauri',    people: 14800, alerts: 1, pressure: 3.2, status: 'safe',   loss: 9,  color: '#22C55E' },
  { id: 'ZIWANI1',   name: 'Ziwani 1',  people: 6200,  alerts: 1, pressure: 1.9, status: 'warn',   loss: 17, color: '#F59E0B' },
  { id: 'ZIWANI2',   name: 'Ziwani 2',  people: 9100,  alerts: 1, pressure: 2.4, status: 'warn',   loss: 21, color: '#F59E0B' },
  { id: 'ZIWANI3',   name: 'Ziwani 3',  people: 11300, alerts: 1, pressure: 1.5, status: 'danger', loss: 26, color: '#EF4444' },
  { id: 'KWANJORA',  name: 'Kwa Njora', people: 4700,  alerts: 0, pressure: 3.6, status: 'safe',   loss: 7,  color: '#22C55E' }
];

export const sensors: Sensor[] = [
  { id: 'PR-01', type: 'Pressure',  zone: 'SHAURI',    reading: '3.3 bar', status: 'safe',    updated: '12s ago' },
  { id: 'PR-02', type: 'Pressure',  zone: 'ZIWANI2',   reading: '2.1 bar', status: 'warn',    updated: '8s ago' },
  { id: 'PR-03', type: 'Pressure',  zone: 'ZIWANI3',   reading: '1.4 bar', status: 'danger',  updated: '4s ago' },
  { id: 'PR-04', type: 'Pressure',  zone: 'KWANJORA',  reading: '3.5 bar', status: 'safe',    updated: '11s ago' },
  { id: 'LV-01', type: 'Level',     zone: 'SHAURI',    reading: '86%',     status: 'safe',    updated: '20s ago' },
  { id: 'LV-02', type: 'Level',     zone: 'KWANJORA',  reading: '32%',     status: 'warn',    updated: '15s ago' },
  { id: 'LV-03', type: 'Level',     zone: 'ZIWANI1',   reading: '78%',     status: 'safe',    updated: '9s ago' },
  { id: 'PH-01', type: 'pH',        zone: 'SHAURI',    reading: '7.2',     status: 'safe',    updated: '1m ago' },
  { id: 'PH-02', type: 'pH',        zone: 'ZIWANI2',   reading: '6.9',     status: 'safe',    updated: '1m ago' },
  { id: 'PH-03', type: 'pH',        zone: 'ZIWANI1',   reading: '—',       status: 'offline', updated: '2h ago' },
  { id: 'TB-01', type: 'Turbidity', zone: 'SHAURI',    reading: '0.8 NTU', status: 'safe',    updated: '45s ago' },
  { id: 'TB-02', type: 'Turbidity', zone: 'ZIWANI2',   reading: '1.2 NTU', status: 'safe',    updated: '40s ago' },
  { id: 'TB-03', type: 'Turbidity', zone: 'ZIWANI3',   reading: '4.6 NTU', status: 'warn',    updated: '30s ago' },
  { id: 'TB-04', type: 'Turbidity', zone: 'KWANJORA',  reading: '6.1 NTU', status: 'danger',  updated: '25s ago' }
];

/* Real distribution segments from erline-pipes.geojson (diameter not surveyed). */
export const pipes: Pipe[] = [
  { id: 'DL-017', type: 'HDPE', diameter: '—', zone: 'ZIWANI3',   pressure: '1.5 bar' },
  { id: 'DL-022', type: 'AC',   diameter: '—', zone: 'ZIWANI3',   pressure: '1.4 bar' },
  { id: 'DL-045', type: 'PVC',  diameter: '—', zone: 'ZIWANI2',   pressure: '2.1 bar' },
  { id: 'DL-065', type: 'uPVC', diameter: '—', zone: 'ZIWANI1',   pressure: '1.9 bar' },
  { id: 'DL-087', type: 'uPVC', diameter: '—', zone: 'SHAURI',    pressure: '3.2 bar' },
  { id: 'DL-096', type: 'AC',   diameter: '—', zone: 'SHAURI',    pressure: '3.0 bar' }
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
  { id: 'LK-2041', caller: 'Mary Wanjiru',   phone: '+254 712 000 401', zone: 'ZIWANI3',   address: 'Kahembe TC, near the market',        reported: '2026-10-09 08:14', source: 'CSR call',  status: 'reported',    severity: 'critical', pipe: 'DL-017', notes: 'Water gushing from road surface, matatu stage flooded.', lat: 0.01787, lng: 36.42639 },
  { id: 'LK-2040', caller: 'John Kamau',     phone: '+254 722 000 118', zone: 'ZIWANI2',   address: 'Shamata, opp. the primary school',   reported: '2026-10-09 07:32', source: 'CSR call',  status: 'dispatched',  severity: 'major',    pipe: 'DL-045', notes: 'Wet patch on the footpath, slow seepage for 2 days.', lat: 0.01158, lng: 36.40515 },
  { id: 'LK-2039', caller: 'Grace Njeri',    phone: '+254 733 000 230', zone: 'ZIWANI1',   address: 'Ngai Ndeithia, Harvesters Church road', reported: '2026-10-09 06:58', source: 'CSR chat',  status: 'in_progress', severity: 'minor',    pipe: 'DL-065', notes: 'Visible joint leak on shared connection.', crew: 'Crew C · Mwangi', timeStarted: '07:30', lat: 0.02731, lng: 36.40848 },
  { id: 'LK-2038', caller: 'David Kariuki',  phone: '+254 711 000 660', zone: 'ZIWANI3',   address: 'Kahembe, Gathanga junction',         reported: '2026-10-08 21:11', source: 'CSR call',  status: 'fixed',       severity: 'major',    pipe: 'DL-022', notes: 'Burst on AC line, isolated and patched.', crew: 'Crew A · Otieno', timeStarted: '21:55', timeFixed: '23:40', materials: 'AC repair collar, clamp, 0.8m pipe', cost: 'KSh 18,500', cause: 'Third-party damage', fixDescription: 'Replaced 0.8m segment, re-pressurised.', leakType: 'Burst', lat: 0.00567, lng: 36.43018 },
  { id: 'LK-2037', caller: 'Esther Wambui',  phone: '+254 700 000 442', zone: 'SHAURI',    address: 'Shauri, near the chief’s camp',   reported: '2026-10-08 18:42', source: 'CSR call',  status: 'fixed',       severity: 'minor',    pipe: 'DL-087', notes: 'Meter-box leak, slow drip.',                  crew: 'Crew B · Chege', timeStarted: '19:30', timeFixed: '20:10', materials: 'Washers, thread tape',           cost: 'KSh 1,200',  cause: 'Worn washer',        fixDescription: 'Replaced inlet washer.',                  leakType: 'Meter leak', lat: 0.05447, lng: 36.42046 },
  { id: 'LK-2036', caller: 'Peter Maina',    phone: '+254 720 000 514', zone: 'SHAURI',    address: 'Ndothua, community water kiosk',      reported: '2026-10-08 14:20', source: 'CSR email', status: 'reported',    severity: 'major',    pipe: 'DL-096', notes: 'Reported on email; large pool by the community kiosk.', lat: 0.06203, lng: 36.42503 }
];

export const alerts: Alert[] = [
  { id: 'A-1023', type: 'Low pressure',      zone: 'ZIWANI3',   sensor: 'PR-03', severity: 'critical', time: '3 min ago',  status: 'active' },
  { id: 'A-1022', type: 'Tank level low',    zone: 'KWANJORA',  sensor: 'LV-02', severity: 'warning',  time: '14 min ago', status: 'active' },
  { id: 'A-1021', type: 'Pressure anomaly',  zone: 'ZIWANI2',   sensor: 'PR-02', severity: 'warning',  time: '38 min ago', status: 'active' },
  { id: 'A-1020', type: 'Sensor offline',    zone: 'ZIWANI1',   sensor: 'PH-03', severity: 'info',     time: '2h ago',     status: 'active' },
  { id: 'A-1019', type: 'NRW spike',         zone: 'ZIWANI3',   sensor: '—',     severity: 'warning',  time: '4h ago',     status: 'resolved' },
  { id: 'A-1018', type: 'Pressure recovery', zone: 'SHAURI',    sensor: 'PR-01', severity: 'info',     time: '6h ago',     status: 'resolved' }
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

export type ZoneStatus = 'safe' | 'warn' | 'danger';
export type SensorStatus = ZoneStatus | 'offline';

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

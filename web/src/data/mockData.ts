export type Status = 'safe' | 'warning' | 'danger';
export type ParameterKey =
  | 'ph' | 'turbidity' | 'ecoli' | 'totalColiforms' | 'freeChlorine'
  | 'nitrate' | 'fluoride' | 'iron' | 'manganese' | 'conductivity' | 'tds'
  | 'pressure' | 'level' | 'temperature';

export type ParameterDef = {
  key: ParameterKey;
  name: string;
  unit: string;
  whoLabel: string;
  whoMin?: number;
  whoMax?: number;
  category: 'micro' | 'physical' | 'chemical' | 'operational';
};

export const PARAMETERS: ParameterDef[] = [
  { key: 'ph',             name: 'pH',                 unit: '',           whoLabel: 'WHO 6.5 – 8.5',    whoMin: 6.5, whoMax: 8.5, category: 'chemical' },
  { key: 'turbidity',      name: 'Turbidity',          unit: 'NTU',        whoLabel: 'WHO ≤ 1 (treated)', whoMax: 1,   category: 'physical' },
  { key: 'ecoli',          name: 'E. coli',            unit: 'CFU/100 mL', whoLabel: 'WHO 0 / 100 mL',   whoMax: 0,   category: 'micro' },
  { key: 'totalColiforms', name: 'Total Coliforms',    unit: 'CFU/100 mL', whoLabel: 'WHO 0 / 100 mL',   whoMax: 0,   category: 'micro' },
  { key: 'freeChlorine',   name: 'Free Chlorine',      unit: 'mg/L',       whoLabel: 'Residual 0.2 – 1.0', whoMin: 0.2, whoMax: 1.0, category: 'chemical' },
  { key: 'nitrate',        name: 'Nitrate (NO₃⁻)',     unit: 'mg/L',       whoLabel: 'WHO ≤ 50',         whoMax: 50,  category: 'chemical' },
  { key: 'fluoride',       name: 'Fluoride (F⁻)',      unit: 'mg/L',       whoLabel: 'WHO ≤ 1.5',        whoMax: 1.5, category: 'chemical' },
  { key: 'iron',           name: 'Iron (Fe)',          unit: 'mg/L',       whoLabel: 'WHO ≤ 0.3',        whoMax: 0.3, category: 'chemical' },
  { key: 'manganese',      name: 'Manganese (Mn)',     unit: 'mg/L',       whoLabel: 'WHO ≤ 0.08',       whoMax: 0.08, category: 'chemical' },
  { key: 'conductivity',   name: 'Conductivity',       unit: 'µS/cm',      whoLabel: 'WHO ≤ 2,500',      whoMax: 2500, category: 'physical' },
  { key: 'tds',            name: 'TDS',                unit: 'mg/L',       whoLabel: 'WHO ≤ 1,000',      whoMax: 1000, category: 'physical' },
  { key: 'pressure',       name: 'Mains Pressure',     unit: 'bar',        whoLabel: 'Network 2 – 6 bar', whoMin: 2,  whoMax: 6,    category: 'operational' },
  { key: 'level',          name: 'Reservoir Level',    unit: '%',          whoLabel: 'Operating 20 – 95%', whoMin: 20, whoMax: 95,  category: 'operational' },
  { key: 'temperature',    name: 'Temperature',        unit: '°C',         whoLabel: 'WHO < 25°C',       whoMax: 25,  category: 'physical' },
];

export type Reading = Partial<Record<ParameterKey, number>>;

export type Utility = {
  id: string;
  name: string;
  county: string;
  lat: number;
  lng: number;
  sensorId: string;
  battery: number;
  installed: string;
  lastUpdate: string;
  status: Status;
  readings: Reading;
};

export const UTILITIES: Utility[] = [
  {
    id: 'nairobi', name: 'Nairobi Water', county: 'Nairobi', lat: -1.286, lng: 36.817,
    sensorId: 'ESP32-NRB-004', battery: 23, installed: '12 Jan 2024', lastUpdate: '2 min ago',
    status: 'danger',
    readings: { ph: 7.1, turbidity: 0.6, ecoli: 0, totalColiforms: 0, freeChlorine: 0.6, nitrate: 78.3, fluoride: 0.7, iron: 0.12, manganese: 0.04, conductivity: 640, tds: 360, pressure: 4.2, level: 78, temperature: 22.4 },
  },
  {
    id: 'thika', name: 'Thika Water', county: 'Kiambu', lat: -1.040, lng: 37.090,
    sensorId: 'ESP32-THK-001', battery: 81, installed: '3 Mar 2024', lastUpdate: '5 min ago',
    status: 'warning',
    readings: { ph: 7.4, turbidity: 1.4, ecoli: 0, totalColiforms: 1, freeChlorine: 0.5, nitrate: 12.1, fluoride: 0.5, iron: 0.09, manganese: 0.02, conductivity: 520, tds: 290, pressure: 3.8, level: 64, temperature: 24.1 },
  },
  {
    id: 'kisumu', name: 'Kisumu Water', county: 'Kisumu', lat: -0.092, lng: 34.768,
    sensorId: 'ESP32-KSM-007', battery: 67, installed: '21 Feb 2024', lastUpdate: '18 min ago',
    status: 'warning',
    readings: { ph: 7.8, turbidity: 0.9, ecoli: 12, totalColiforms: 24, freeChlorine: 0.18, nitrate: 8.4, fluoride: 0.6, iron: 0.18, manganese: 0.05, conductivity: 580, tds: 320, pressure: 3.4, level: 52, temperature: 26.7 },
  },
  {
    id: 'nanyuki', name: 'Nanyuki Water', county: 'Laikipia', lat: 0.013, lng: 37.073,
    sensorId: 'ESP32-NYK-002', battery: 94, installed: '5 Apr 2024', lastUpdate: '12 min ago',
    status: 'safe',
    readings: { ph: 7.6, turbidity: 0.4, ecoli: 0, totalColiforms: 0, freeChlorine: 0.7, nitrate: 6.3, fluoride: 0.4, iron: 0.05, manganese: 0.01, conductivity: 410, tds: 240, pressure: 4.6, level: 88, temperature: 18.2 },
  },
  {
    id: 'eldoret', name: 'Eldoret Water', county: 'Uasin Gishu', lat: 0.520, lng: 35.270,
    sensorId: 'ESP32-ELD-003', battery: 88, installed: '14 Mar 2024', lastUpdate: '8 min ago',
    status: 'safe',
    readings: { ph: 8.1, turbidity: 0.5, ecoli: 0, totalColiforms: 0, freeChlorine: 0.6, nitrate: 9.0, fluoride: 0.5, iron: 0.08, manganese: 0.02, conductivity: 480, tds: 280, pressure: 4.4, level: 81, temperature: 19.8 },
  },
  {
    id: 'mombasa', name: 'Mombasa Water', county: 'Mombasa', lat: -4.043, lng: 39.668,
    sensorId: 'ESP32-MSA-005', battery: 76, installed: '28 Jan 2024', lastUpdate: '3 min ago',
    status: 'safe',
    readings: { ph: 7.3, turbidity: 0.7, ecoli: 0, totalColiforms: 0, freeChlorine: 0.8, nitrate: 11.2, fluoride: 0.8, iron: 0.10, manganese: 0.03, conductivity: 720, tds: 420, pressure: 5.1, level: 72, temperature: 21.5 },
  },
  {
    id: 'nakuru', name: 'Nakuru Water', county: 'Nakuru', lat: -0.303, lng: 36.080,
    sensorId: 'ESP32-NKR-006', battery: 91, installed: '7 Feb 2024', lastUpdate: '7 min ago',
    status: 'safe',
    readings: { ph: 7.9, turbidity: 0.3, ecoli: 0, totalColiforms: 0, freeChlorine: 0.5, nitrate: 4.8, fluoride: 0.4, iron: 0.04, manganese: 0.01, conductivity: 380, tds: 220, pressure: 4.9, level: 84, temperature: 15.3 },
  },
  {
    id: 'garissa', name: 'Garissa Water', county: 'Garissa', lat: -0.453, lng: 39.646,
    sensorId: 'ESP32-GRS-008', battery: 62, installed: '19 Mar 2024', lastUpdate: '15 min ago',
    status: 'safe',
    readings: { ph: 7.5, turbidity: 0.8, ecoli: 0, totalColiforms: 0, freeChlorine: 0.4, nitrate: 7.1, fluoride: 0.6, iron: 0.11, manganese: 0.02, conductivity: 540, tds: 310, pressure: 3.9, level: 56, temperature: 16.9 },
  },
];

export const COUNTIES = Array.from(new Set(UTILITIES.map(u => u.county))).sort();

export type Alert = {
  id: string;
  utilityId: string;
  parameter: ParameterKey;
  value: number;
  threshold: number;
  severity: Status;
  title: string;
  description: string;
  triggered: string;
  resolved: string | null;
};

export const ALERTS: Alert[] = [
  { id: 'ALT-2024-0187', utilityId: 'nairobi', parameter: 'nitrate', value: 78.3, threshold: 50,
    severity: 'danger', title: 'Nitrate exceeds WHO limit',
    description: '78.3 mg/L detected (WHO ≤ 50 mg/L)', triggered: '2 min ago', resolved: null },
  { id: 'ALT-2024-0186', utilityId: 'kisumu', parameter: 'ecoli', value: 12, threshold: 0,
    severity: 'warning', title: 'E. coli detected in distribution',
    description: '12 CFU/100 mL (WHO 0 / 100 mL)', triggered: '18 min ago', resolved: null },
  { id: 'ALT-2024-0185', utilityId: 'thika', parameter: 'turbidity', value: 1.4, threshold: 1,
    severity: 'warning', title: 'Turbidity above treated-water limit',
    description: '1.4 NTU (WHO ≤ 1 NTU treated)', triggered: '1 hr ago', resolved: null },
  { id: 'ALT-2024-0184', utilityId: 'nairobi', parameter: 'pressure', value: 1.6, threshold: 2,
    severity: 'warning', title: 'Low mains pressure',
    description: '1.6 bar (operating range 2 – 6 bar)', triggered: '4 hr ago', resolved: '2 hr ago' },
  { id: 'ALT-2024-0181', utilityId: 'nairobi', parameter: 'nitrate', value: 62.1, threshold: 50,
    severity: 'danger', title: 'Nitrate exceeded WHO limit',
    description: '62.1 mg/L (WHO ≤ 50 mg/L)', triggered: '3 days ago', resolved: '3 days ago' },
  { id: 'ALT-2024-0172', utilityId: 'nairobi', parameter: 'ph', value: 8.6, threshold: 8.5,
    severity: 'warning', title: 'pH slightly above WHO range',
    description: '8.6 pH (WHO 6.5 – 8.5)', triggered: '2 weeks ago', resolved: '2 weeks ago' },
];

export function utilityById(id: string | undefined) {
  return UTILITIES.find(u => u.id === id) ?? UTILITIES[0];
}
export function paramByKey(key: ParameterKey) {
  return PARAMETERS.find(p => p.key === key)!;
}

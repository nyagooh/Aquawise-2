import type {
  SensorReading,
  TimePoint,
  WaterSource,
  Alert,
  RegionPrediction,
  Region,
} from '../data/mockData';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchRegions = () => get<Region[]>('/regions/');
export const fetchSensorReadings = () => get<SensorReading[]>('/sensor-readings/');
export const fetchTimeSeries = () => get<TimePoint[]>('/timeseries/');
export const fetchWaterSources = (regionId?: string) =>
  get<WaterSource[]>(regionId ? `/water-sources/?region=${regionId}` : '/water-sources/');
export const fetchAlerts = (regionId?: string) =>
  get<Alert[]>(regionId ? `/alerts/?region=${regionId}` : '/alerts/');
export const fetchPredictions = (regionId?: string) =>
  get<RegionPrediction[]>(regionId ? `/predictions/?region=${regionId}` : '/predictions/');

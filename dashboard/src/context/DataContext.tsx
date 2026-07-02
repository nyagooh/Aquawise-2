import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { SensorReading, TimePoint, WaterSource, Alert, RegionPrediction, Region } from '../data/mockData';
import {
  fetchRegions,
  fetchSensorReadings,
  fetchTimeSeries,
  fetchWaterSources,
  fetchAlerts,
  fetchPredictions,
} from '../services/api';

// How often to re-fetch live sensor data (match the Arduino READ_INTERVAL_MS)
const LIVE_POLL_MS = 2000;
// How often to re-fetch slower-changing data (alerts, predictions, stations)
const SLOW_POLL_MS = 30000;

interface DataState {
  regions: Region[];
  currentReadings: SensorReading[];
  timeSeriesData: TimePoint[];
  waterSources: WaterSource[];
  recentAlerts: Alert[];
  regionPredictions: RegionPrediction[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const DataContext = createContext<DataState>({
  regions: [],
  currentReadings: [],
  timeSeriesData: [],
  waterSources: [],
  recentAlerts: [],
  regionPredictions: [],
  loading: true,
  error: null,
  lastUpdated: null,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    regions: [],
    currentReadings: [],
    timeSeriesData: [],
    waterSources: [],
    recentAlerts: [],
    regionPredictions: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch only the two fields that update with every sensor POST
  function fetchLive() {
    Promise.all([fetchSensorReadings(), fetchTimeSeries()])
      .then(([currentReadings, timeSeriesData]) => {
        setState(prev => ({ ...prev, currentReadings, timeSeriesData, lastUpdated: new Date() }));
      })
      .catch(() => {
        // silently ignore polling errors — stale data is better than a crash
      });
  }

  // Fetch everything else that changes less often
  function fetchSlow() {
    Promise.all([fetchRegions(), fetchWaterSources(), fetchAlerts(), fetchPredictions()])
      .then(([regions, waterSources, recentAlerts, regionPredictions]) => {
        setState(prev => ({ ...prev, regions, waterSources, recentAlerts, regionPredictions }));
      })
      .catch(() => {});
  }

  useEffect(() => {
    // Initial full load
    Promise.all([
      fetchRegions(),
      fetchSensorReadings(),
      fetchTimeSeries(),
      fetchWaterSources(),
      fetchAlerts(),
      fetchPredictions(),
    ])
      .then(([regions, currentReadings, timeSeriesData, waterSources, recentAlerts, regionPredictions]) => {
        setState({ regions, currentReadings, timeSeriesData, waterSources, recentAlerts, regionPredictions, loading: false, error: null, lastUpdated: new Date() });
      })
      .catch((err: Error) => {
        setState(prev => ({ ...prev, loading: false, error: err.message }));
      });

    // Start polling
    liveTimerRef.current = setInterval(fetchLive, LIVE_POLL_MS);
    slowTimerRef.current = setInterval(fetchSlow, SLOW_POLL_MS);

    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      if (slowTimerRef.current) clearInterval(slowTimerRef.current);
    };
  }, []);

  return <DataContext.Provider value={state}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}

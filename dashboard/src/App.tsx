import './index.css';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SensorCard from './components/SensorCard';
import WaterSourceMap from './components/WaterSourceMap';
import AlertsTable from './components/AlertsTable';
import RegionalPredictions from './components/RegionalPredictions';
import ParameterChart from './components/ParameterChart';
import { useEffect, useRef, useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { MapPin, Droplets, AlertTriangle, Shield, Map } from 'lucide-react';

function Dashboard() {
  const { theme } = useTheme();
  const { registerSection } = useNavigation();
  const { currentReadings, recentAlerts, waterSources, regionPredictions, lastUpdated } = useData();
  const mainRef = useRef<HTMLElement>(null);
  const sensorsRef = useRef<HTMLElement>(null);
  const stationsRef = useRef<HTMLElement>(null);
  const predictionsRef = useRef<HTMLElement>(null);
  const alertsRef = useRef<HTMLElement>(null);
  const [selectedRegion, setSelectedRegion] = useState('all');

  const alertCount = recentAlerts.filter(a => {
    if (selectedRegion !== 'all' && a.regionId !== selectedRegion) return false;
    return a.risk === 'danger' || a.risk === 'warning';
  }).length;

  const regionName = selectedRegion === 'all' ? null : regionPredictions.find(r => r.id === selectedRegion)?.region;

  // Overview stats for "All Regions" dashboard
  const totalRegions = regionPredictions.length;
  const dangerRegions = regionPredictions.filter(r => r.riskLevel === 'danger').length;
  const warningRegions = regionPredictions.filter(r => r.riskLevel === 'warning').length;
  const safeRegions = regionPredictions.filter(r => r.riskLevel === 'safe').length;
  const totalAlerts = recentAlerts.filter(a => a.risk === 'danger' || a.risk === 'warning').length;
  const safeStations = waterSources.filter(s => s.risk === 'safe').length;

  useEffect(() => {
    registerSection('main', mainRef.current);
    registerSection('sensors', sensorsRef.current);
    registerSection('stations', stationsRef.current);
    registerSection('predictions', predictionsRef.current);
    registerSection('alerts', alertsRef.current);
  }, [registerSection]);

  const bg = theme === 'dark' ? '#1A2332' : '#E8EEF8';

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`} style={{ background: bg }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header alertCount={alertCount} />

        <main ref={mainRef} className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-[1400px] mx-auto px-8 py-7 space-y-6">

            {/* Region selector */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary dark:text-primary-dark" />
                <span className="text-sm font-semibold text-txt dark:text-txt-dark">Region</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[{ id: 'all', label: 'All Regions' }, ...regionPredictions.map(r => ({ id: r.id, label: r.region }))].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRegion(r.id)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      selectedRegion === r.id
                        ? 'bg-primary dark:bg-primary-dark text-white shadow-lg shadow-primary/25'
                        : 'bg-white dark:bg-surface-dark border border-line dark:border-line-dark text-txt-secondary dark:text-txt-dark-secondary hover:border-primary/30 hover:text-txt dark:hover:text-txt-dark'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedRegion === 'all' ? (
              <>
                {/* Overview cards — dashboard only */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="card px-6 py-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/8 dark:bg-primary-dark/8 flex items-center justify-center">
                        <Map size={18} className="text-primary dark:text-primary-dark" />
                      </div>
                      <p className="text-sm text-txt-secondary dark:text-txt-dark-secondary">Regions Monitored</p>
                    </div>
                    <p className="text-2xl font-extrabold text-txt dark:text-txt-dark">{totalRegions}</p>
                    <p className="text-xs text-txt-muted dark:text-txt-dark-muted mt-1">Kisumu sub-regions</p>
                  </div>

                  <div className="card px-6 py-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-ok/8 flex items-center justify-center">
                        <Shield size={18} className="text-ok" />
                      </div>
                      <p className="text-sm text-txt-secondary dark:text-txt-dark-secondary">Risk Overview</p>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-extrabold text-ok">{safeRegions}</span>
                      <span className="text-xs text-txt-muted dark:text-txt-dark-muted">safe</span>
                      <span className="text-2xl font-extrabold text-warn">{warningRegions}</span>
                      <span className="text-xs text-txt-muted dark:text-txt-dark-muted">caution</span>
                      <span className="text-2xl font-extrabold text-err">{dangerRegions}</span>
                      <span className="text-xs text-txt-muted dark:text-txt-dark-muted">high</span>
                    </div>
                  </div>

                  <div className="card px-6 py-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-err/8 flex items-center justify-center">
                        <AlertTriangle size={18} className="text-err" />
                      </div>
                      <p className="text-sm text-txt-secondary dark:text-txt-dark-secondary">Active Alerts</p>
                    </div>
                    <p className="text-2xl font-extrabold text-txt dark:text-txt-dark">{totalAlerts}</p>
                    <p className="text-xs text-txt-muted dark:text-txt-dark-muted mt-1">{totalAlerts > 0 ? 'need attention' : 'all clear'}</p>
                  </div>

                  <div className="card px-6 py-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/8 dark:bg-primary-dark/8 flex items-center justify-center">
                        <Droplets size={18} className="text-primary dark:text-primary-dark" />
                      </div>
                      <p className="text-sm text-txt-secondary dark:text-txt-dark-secondary">Stations Safe</p>
                    </div>
                    <p className="text-2xl font-extrabold text-txt dark:text-txt-dark">{safeStations}/{waterSources.length}</p>
                    <p className="text-xs text-txt-muted dark:text-txt-dark-muted mt-1">monitoring stations</p>
                  </div>
                </div>

                {/* Alerts */}
                <section ref={alertsRef}>
                  <AlertsTable selectedRegion={selectedRegion} />
                </section>

                {/* Predictions */}
                <section ref={predictionsRef}>
                  <RegionalPredictions selectedRegion={selectedRegion} />
                </section>

                {/* Stations */}
                <section ref={stationsRef}>
                  <WaterSourceMap selectedRegion={selectedRegion} />
                </section>
              </>
            ) : (
              <>
                {/* Live sensor cards */}
                <section ref={sensorsRef}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-txt-secondary dark:text-txt-dark-secondary uppercase tracking-wide">Live Sensor Readings — {regionName}</h2>
                    <div className="flex items-center gap-3">
                      {lastUpdated && (
                        <span className="text-2xs text-txt-muted dark:text-txt-dark-muted">
                          Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-2xs font-bold text-ok px-2.5 py-1 rounded-full bg-ok/8">
                        <span className="w-1.5 h-1.5 rounded-full bg-ok live-dot" />
                        Live
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {currentReadings.map(r => <SensorCard key={r.id} reading={r} />)}
                  </div>
                </section>

                {/* Parameter trend chart */}
                <ParameterChart regionName={regionName!} />

                {/* Alerts */}
                <section ref={alertsRef}>
                  <AlertsTable selectedRegion={selectedRegion} />
                </section>

                {/* Predictions */}
                <section ref={predictionsRef}>
                  <RegionalPredictions selectedRegion={selectedRegion} />
                </section>

                {/* Stations */}
                <section ref={stationsRef}>
                  <WaterSourceMap selectedRegion={selectedRegion} />
                </section>
              </>
            )}

            <footer className="pb-6 text-center text-xs text-txt-muted dark:text-txt-dark-muted">
              Uhai WashWise · Water Quality Intelligence · Kisumu, Kenya
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NavigationProvider>
        <DataProvider>
          <Dashboard />
        </DataProvider>
      </NavigationProvider>
    </ThemeProvider>
  );
}

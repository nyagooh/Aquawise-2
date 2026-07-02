import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import DemoHub from './pages/DemoHub';
import Dashboard from './pages/Dashboard';
import GISMap from './pages/GISMap';
import Alerts from './pages/Alerts';
import Leaks from './pages/Leaks';
import NRW from './pages/NRW';
import Sensors from './pages/Sensors';
import Reports from './pages/Reports';
import Attribute from './pages/Attribute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* View-only demo: lead-capture gate and data upload are disabled — redirect to the open demo. */}
      <Route path="/request-demo" element={<Navigate to="/demo" replace />} />
      <Route path="/demo" element={<DemoHub />} />
      <Route path="/demo/upload" element={<Navigate to="/demo" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/gis" element={<GISMap />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/leaks" element={<Leaks />} />
      <Route path="/nrw" element={<NRW />} />
      <Route path="/sensors" element={<Sensors />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/attribute" element={<Attribute />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

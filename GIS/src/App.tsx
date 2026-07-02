import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import NetworksHub from './pages/NetworksHub';
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
      <Route path="/networks" element={<NetworksHub />} />
      <Route path="/networks/upload" element={<NetworksHub />} />
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

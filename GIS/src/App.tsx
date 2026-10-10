import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import DemoHub from './pages/DemoHub';
import RequestDemo from './pages/RequestDemo';
import Overview from './pages/Overview';
import GISMap from './pages/GISMap';
import Monitoring from './pages/Monitoring';
import Alerts from './pages/Alerts';
import Assets from './pages/Assets';
import Reports from './pages/Reports';
import Attribute from './pages/Attribute';

/** Redirect that keeps the query string (e.g. ?focus=asset:SN-12). */
function Moved({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/request-demo" element={<RequestDemo />} />
      <Route path="/demo" element={<DemoHub />} />
      <Route path="/demo/upload" element={<Navigate to="/demo" replace />} />
      <Route path="/overview" element={<Overview />} />
      <Route path="/network" element={<GISMap />} />
      <Route path="/monitoring" element={<Monitoring />} />
      <Route path="/monitoring/:tab" element={<Monitoring />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/assets" element={<Assets />} />
      <Route path="/assets/attributes" element={<Attribute />} />
      <Route path="/reports" element={<Reports />} />
      {/* Previous information architecture */}
      <Route path="/dashboard" element={<Moved to="/overview" />} />
      <Route path="/gis" element={<Moved to="/network" />} />
      <Route path="/sensors" element={<Moved to="/monitoring/sensors" />} />
      <Route path="/leaks" element={<Moved to="/alerts" />} />
      <Route path="/nrw" element={<Moved to="/overview" />} />
      <Route path="/attribute" element={<Moved to="/assets/attributes" />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

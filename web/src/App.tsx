import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LocationDetail from './pages/LocationDetail';
import Alerts from './pages/Alerts';
import Predictive from './pages/Predictive';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import Account from './pages/Account';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="locations/:id" element={<LocationDetail />} />
        <Route path="locations" element={<Navigate to="/dashboard" replace />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="predictive" element={<Predictive />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

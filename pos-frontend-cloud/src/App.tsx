import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Instances from './pages/Instances';
import InstanceDetail from './pages/InstanceDetail';
import Licenses from './pages/Licenses';
import Notifications from './pages/Notifications';

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* All admin routes are protected */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/"                    element={<Dashboard />} />
                    <Route path="/instances"           element={<Instances />} />
                    <Route path="/instances/:id"       element={<InstanceDetail />} />
                    <Route path="/licenses"            element={<Licenses />} />
                    <Route path="/notifications"       element={<Notifications />} />
                    <Route path="*"                    element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

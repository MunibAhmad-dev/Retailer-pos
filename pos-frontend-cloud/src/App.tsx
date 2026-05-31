import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Spinner } from './components/ui';

// Lazy-loaded pages
const Login          = React.lazy(() => import('./pages/Login'));
const Dashboard      = React.lazy(() => import('./pages/Dashboard'));
const Instances      = React.lazy(() => import('./pages/Instances'));
const InstanceDetail = React.lazy(() => import('./pages/InstanceDetail'));
const Licenses       = React.lazy(() => import('./pages/Licenses'));
const OfflineLicense = React.lazy(() => import('./pages/OfflineLicense'));
const Notifications  = React.lazy(() => import('./pages/Notifications'));
const Reports        = React.lazy(() => import('./pages/Reports'));
const Settings       = React.lazy(() => import('./pages/Settings'));
const Releases       = React.lazy(() => import('./pages/Releases'));

function PageFallback() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected — wrapped in Layout */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageFallback />}>
                      <Routes>
                        <Route path="/"                 element={<Dashboard />} />
                        <Route path="/instances"        element={<Instances />} />
                        <Route path="/instances/:id"    element={<InstanceDetail />} />
                        <Route path="/licenses"         element={<Licenses />} />
                        <Route path="/offline-license"  element={<OfflineLicense />} />
                        <Route path="/notifications"    element={<Notifications />} />
                        <Route path="/reports"          element={<Reports />} />
                        <Route path="/settings"         element={<Settings />} />
                        <Route path="/releases"         element={<Releases />} />
                        {/* /audit redirects to settings for now */}
                        <Route path="/audit"            element={<Navigate to="/settings" replace />} />
                        <Route path="*"                 element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

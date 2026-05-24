import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './components/ThemeProvider';
import { NotificationProvider } from './components/NotificationProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { subService } from './services/subscription';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Loans from './pages/Loans';
import Vendors from './pages/Vendors';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import BalanceSheet from './pages/BalanceSheet';
import About from './pages/About';
import Subscription from './pages/Subscription';
import RegisterHistory from './pages/RegisterHistory';
import RegisterStatus from './pages/RegisterStatus';
import Activation from './pages/Activation';
import Setup from './pages/Setup';
import Returns from './pages/Returns';
import Payments from './pages/Payments';
import { LanguageProvider } from './components/LanguageProvider';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(
    () => sessionStorage.getItem('pos_unlocked') === 'true'
  );
  const [isSystemLocked, setIsSystemLocked] = useState(false);

  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState<boolean>(true);

  React.useEffect(() => {
    checkActivation();
  }, []);

  const checkActivation = async () => {
    try {
      const setupRes = await (window as any).api.isSetupComplete?.();
      setSetupComplete(!!setupRes?.complete || !!setupRes?.data?.complete);
      const state = await subService.initialize();
      // License activation is optional; offline setup still allows local POS use.
      const res = await (window as any).api.isActivated();
      setIsActivated(res.success && res.activated);
      setIsSubscriptionActive(state.isActive || state.isGracePeriod || state.plan === 'lifetime');
    } catch {
      setIsActivated(false);
      setSetupComplete(false);
      setIsSubscriptionActive(false);
    }
  };

  const handleAuthenticated = () => {
    sessionStorage.setItem('pos_unlocked', 'true');
    setIsUnlocked(true);
  };

  const handleLock = () => {
    sessionStorage.removeItem('pos_unlocked');
    setIsUnlocked(false);
  };

  const handleLockSystem = () => setIsSystemLocked(true);
  const handleSystemUnlock = () => setIsSystemLocked(false);

  if (setupComplete === null || isActivated === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!setupComplete) {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="system" storageKey="pos-ui-theme">
          <LanguageProvider>
            <NotificationProvider>
              <Setup onComplete={() => {
                setSetupComplete(true);
                setIsActivated(false);
                subService.initialize().then((state) => {
                  setIsSubscriptionActive(state.isActive || state.isGracePeriod || state.plan === 'lifetime');
                });
              }} />
              <Toaster position="top-right" richColors closeButton />
            </NotificationProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="pos-ui-theme">
        <LanguageProvider>
          <NotificationProvider>
            <Router>
              {/* System lock — portals to document.body, covers everything */}
              {isSystemLocked && (
                <Login mode="system" onAuthenticated={handleSystemUnlock} />
              )}
              <Layout>
                <Routes>
                  <Route path="/" element={
                    !isUnlocked
                      ? <Login mode="dashboard" onAuthenticated={handleAuthenticated} />
                      : <ProtectedRoute routeName="dashboard"><Dashboard onLock={handleLock} onLockSystem={handleLockSystem} /></ProtectedRoute>
                  } />
                  <Route path="/sales" element={<ProtectedRoute routeName="sales"><Sales /></ProtectedRoute>} />
                  <Route path="/products" element={<ProtectedRoute routeName="products"><Products /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute routeName="inventory"><Inventory /></ProtectedRoute>} />
                  <Route path="/vendors" element={<ProtectedRoute routeName="vendors"><Vendors /></ProtectedRoute>} />
                  <Route path="/purchases" element={<ProtectedRoute routeName="purchases"><Purchases /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute routeName="customers"><Customers /></ProtectedRoute>} />
                  <Route path="/loans" element={<ProtectedRoute routeName="loans"><Loans /></ProtectedRoute>} />
                  <Route path="/transactions" element={<ProtectedRoute routeName="transactions"><Transactions /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute routeName="reports"><Reports /></ProtectedRoute>} />
                  <Route path="/balance-sheet" element={<ProtectedRoute routeName="balance-sheet"><BalanceSheet /></ProtectedRoute>} />
                  <Route path="/expenses" element={<ProtectedRoute routeName="expenses"><Expenses /></ProtectedRoute>} />
                  <Route path="/register-history" element={<ProtectedRoute routeName="register-history"><RegisterHistory /></ProtectedRoute>} />
                  <Route path="/register" element={<ProtectedRoute routeName="register"><RegisterStatus /></ProtectedRoute>} />
                  <Route path="/returns" element={<ProtectedRoute routeName="returns"><Returns /></ProtectedRoute>} />
                  <Route path="/payments" element={<ProtectedRoute routeName="payments"><Payments /></ProtectedRoute>} />
                  <Route path="/financials" element={<Navigate to="/reports" replace />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/subscription" element={<Subscription />} />
                  <Route path="/about" element={<About />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </Router>
            <Toaster position="top-right" richColors closeButton />
          </NotificationProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

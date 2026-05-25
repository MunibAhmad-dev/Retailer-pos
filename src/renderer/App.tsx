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
import PendingApproval from './components/PendingApproval';
import BlockedScreen from './components/BlockedScreen';
import Returns from './pages/Returns';
import Payments from './pages/Payments';
import { LanguageProvider } from './components/LanguageProvider';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { initPosSync, checkInstanceStatus } from './services/api/posSync';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(
    () => sessionStorage.getItem('pos_unlocked') === 'true'
  );
  const [isSystemLocked, setIsSystemLocked] = useState(false);

  const [isActivated, setIsActivated]     = useState<boolean | null>(null);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string>('approved');
  const [licenseMode, setLicenseMode]     = useState<string>('offline');
  const [blockReason, setBlockReason]     = useState<string>('');
  const [isSubscriptionActive, setIsSubscriptionActive] = useState<boolean>(true);

  React.useEffect(() => {
    checkActivation();

    // Start the cloud sync worker — safe to call even while blocked/pending.
    // This starts the 5-minute status poll that detects admin unblock/approve actions.
    initPosSync().catch(() => {});

    // When posSync detects a block (403 or status poll), update the UI immediately
    const onBlocked = () => checkActivation();
    window.addEventListener('pos-blocked', onBlocked);

    // When posSync detects the block has been lifted, re-run activation check
    const onApproved = () => checkActivation();
    window.addEventListener('pos-approved', onApproved);

    // Show admin-sent notifications as persistent toasts
    const onNotification = (e: Event) => {
      const { title, body } = (e as CustomEvent<{ title: string; body: string }>).detail;
      toast(title, {
        description: body,
        duration: 12000,
        icon: '🔔',
      });
    };
    window.addEventListener('pos-notification', onNotification);

    return () => {
      window.removeEventListener('pos-blocked', onBlocked);
      window.removeEventListener('pos-approved', onApproved);
      window.removeEventListener('pos-notification', onNotification);
    };
  }, []);

  const checkActivation = async () => {
    try {
      const setupRes = await (window as any).api.isSetupComplete?.();
      const complete = !!setupRes?.complete || !!setupRes?.data?.complete;
      setSetupComplete(complete);

      if (complete) {
        const settingsRes = await window.api.getSettings();
        const s = settingsRes?.data as any;
        const mode = s?.license_mode || 'offline';
        const status = s?.approval_status || 'approved';
        setLicenseMode(mode);
        setBlockReason(s?.block_reason || '');
        // 'blocked' is always honoured regardless of mode (covers license revocation).
        // 'pending' only gates users who opted into online mode.
        if (status === 'blocked') {
          setApprovalStatus('blocked');
        } else if (mode === 'online') {
          setApprovalStatus(status);
        } else {
          setApprovalStatus('approved');
        }
      }

      const state = await subService.initialize();
      const res = await (window as any).api.isActivated();
      setIsActivated(res.success && res.activated);
      setIsSubscriptionActive(state.isActive || state.isGracePeriod || state.plan === 'lifetime');
    } catch {
      setIsActivated(false);
      setSetupComplete(false);
      setIsSubscriptionActive(false);
    }
  };

  /**
   * Called by BlockedScreen's "Check Again" button and its 60-second auto-timer.
   * First polls the backend directly (so we detect an admin unblock immediately
   * without waiting for the 5-minute posSync interval), then re-reads local settings.
   */
  const handleBlockedRetry = async () => {
    try {
      // This polls /api/instances/status and updates local settings + fires pos-approved
      // if the backend says we're no longer blocked.
      await checkInstanceStatus();
    } catch {
      // Network offline or still blocked — ignore, checkActivation will show the correct state
    }
    // Re-read local settings regardless; if posSync just wrote 'approved' above,
    // this will pick it up and exit the blocked screen.
    await checkActivation();
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
                // Re-run full check so approvalStatus is set correctly
                checkActivation();
              }} />
              <Toaster position="top-right" richColors closeButton />
            </NotificationProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Online mode: waiting for admin approval
  if (setupComplete && licenseMode === 'online' && approvalStatus === 'pending') {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="system" storageKey="pos-ui-theme">
          <PendingApproval
            onApproved={() => {
              setApprovalStatus('approved');
              checkActivation();
            }}
            onRejected={() => {
              setApprovalStatus('rejected');
            }}
          />
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Blocked — applies to all modes (license revocation works offline too after next sync)
  if (setupComplete && approvalStatus === 'blocked') {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="system" storageKey="pos-ui-theme">
          <BlockedScreen reason={blockReason} onRetry={handleBlockedRetry} />
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Offline mode: require local license activation
  if (setupComplete && licenseMode === 'offline' && !isActivated) {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="system" storageKey="pos-ui-theme">
          <LanguageProvider>
            <NotificationProvider>
              <Activation onActivated={() => checkActivation()} />
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
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Users,
  CreditCard, BarChart3, Settings, Moon, Sun, Receipt,
  Bell, Menu, X, CheckCircle2, AlertCircle, Info, ChevronLeft, ChevronRight,
  Truck, Key, TrendingUp, Lock, ShieldAlert, History, Wallet, Undo2,
  CircleDollarSign, Zap
} from 'lucide-react';
import Logo from '../components/img/yasir_logo_transparent.png';
import { useTheme } from './ThemeProvider';
import { useNotifications } from './NotificationProvider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import ErrorBoundary from './ErrorBoundary';
import { subService } from '../services/subscription';
import { useLanguage } from './LanguageProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";

interface LayoutProps {
  children: React.ReactNode;
}

const navGroups = [
  {
    label: 'Core',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/sales', icon: ShoppingCart, label: 'Sales' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { path: '/products', icon: Package, label: 'Products' },
      { path: '/inventory', icon: Boxes, label: 'Inventory' },
      { path: '/vendors', icon: Truck, label: 'Vendors' },
      { path: '/purchases', icon: Package, label: 'Purchases / POs' },
      { path: '/returns', icon: Undo2, label: 'Returns' },
    ],
  },
  {
    label: 'People',
    items: [
      { path: '/customers', icon: Users, label: 'Customers' },
      { path: '/loans', icon: Wallet, label: 'Accounts (AP/AR)' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/transactions', icon: CreditCard, label: 'Transactions' },
      { path: '/payments', icon: CircleDollarSign, label: 'Payment Ledger' },
      { path: '/expenses', icon: Receipt, label: 'Expenses' },
      { path: '/register', icon: Wallet, label: 'Cash Register' },
      { path: '/register-history', icon: History, label: 'Register History' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { path: '/reports', icon: BarChart3, label: 'Reports' },
      { path: '/balance-sheet', icon: TrendingUp, label: 'Balance Sheet' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/settings', icon: Settings, label: 'Settings' },
      { path: '/subscription', icon: Key, label: 'Subscription' },
      { path: '/about', icon: Info, label: 'About' },
    ],
  },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { addNotification, notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const { t, language } = useLanguage();

  const [logoData, setLogoData] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    async function fetchLogo() {
      if (window.api && window.api.getLogo) {
        try {
          const res = await window.api.getLogo();
          if (res.success && res.data) setLogoData(res.data);
        } catch (e) {
          console.error("Failed to load dynamic logo", e);
        }
      }
    }
    fetchLogo();
  }, []);

  useEffect(() => {
    const subState = subService.getState();
    if (subState.isActive && !subState.isGracePeriod && subState.daysRemaining <= 5) {
      addNotification("Subscription Expiring Soon", `Your license expires in ${subState.daysRemaining} day(s). Please renew soon to avoid interruptions.`, "warning");
    }
    if ((subState as any).internetReminder) {
      addNotification("Internet Required", "Please connect to internet. Online license has not checked in for over 10 days.", "warning");
    }
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const subState = subService.getState();

  const isExpiredOrGrace = !subState.isActive || subState.isGracePeriod;

  return (
    <div className="flex bg-background min-h-screen font-sans text-foreground transition-colors overflow-hidden">
      {isMobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px] md:hidden"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 flex-shrink-0 flex flex-col transition-all duration-300 ease-out",
          "bg-card border-r border-border/60",
          isSidebarCollapsed ? "md:w-[72px]" : "md:w-60",
          "w-[86vw] max-w-[300px] md:max-w-none",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Collapse toggle */}
        <div className="absolute -right-3 top-6 z-50 hidden md:block">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="h-6 w-6 rounded-full border border-border bg-background shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Brand header */}
        <div className={cn(
          "h-[68px] border-b border-border/60 flex items-center shrink-0",
          isSidebarCollapsed ? "justify-center px-3" : "px-5 gap-3"
        )}>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <img src={logoData || Logo} className="w-5 h-5 object-contain" alt="Logo" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
          </div>
          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none truncate">
                <span className="text-primary">Osa</span>Tech POS
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                {subState.plan === 'lifetime'
                  ? '✦ Lifetime'
                  : subState.isActive && !subState.isGracePeriod
                  ? `${subState.daysRemaining}d remaining`
                  : subState.isGracePeriod
                  ? '⚠ Grace Period'
                  : 'Subscription Expired'}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border">
          {navGroups.map((group) => {
            const hasAccessibleItem = group.items.some(
              item => subService.canAccess(item.path.replace('/', '')) || item.path === '/'
            );

            return (
              <div key={group.label} className="mb-1">
                {/* Group label */}
                {!isSidebarCollapsed ? (
                  <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground/50 select-none">
                    {group.label}
                  </p>
                ) : (
                  <div className="mx-2 my-2 h-px bg-border/40" />
                )}

                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  const isAllowed = subService.canAccess(item.path.replace('/', '')) || item.path === '/';

                  if (!isAllowed) {
                    return (
                      <div
                        key={item.path}
                        title={isSidebarCollapsed ? item.label : "Access restricted — subscription expired"}
                        className={cn(
                          "relative flex items-center rounded-lg text-[11px] font-medium cursor-not-allowed select-none",
                          isSidebarCollapsed ? "justify-center py-2.5 px-2" : "px-3 py-2 gap-2.5",
                          "text-muted-foreground/30"
                        )}
                      >
                        <div className="relative shrink-0">
                          <Icon size={16} className="opacity-40" />
                          <Lock size={8} className="absolute -top-1 -right-1 text-destructive/70" />
                        </div>
                        {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "relative flex items-center rounded-lg text-[11px] font-medium transition-all duration-150 group",
                        isSidebarCollapsed ? "justify-center py-2.5 px-2" : "px-3 py-2 gap-2.5",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {/* Left pill indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                      )}
                      <Icon size={16} className={cn("shrink-0 transition-transform", isActive && "scale-110")} />
                      {!isSidebarCollapsed && (
                        <span className={cn("truncate", isActive && "font-semibold")}>{item.label}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Subscription warning (expanded only) */}
        {isExpiredOrGrace && !isSidebarCollapsed && (
          <div className={cn(
            "mx-3 mb-3 p-3 rounded-xl border text-[10px] leading-relaxed",
            subState.isGracePeriod
              ? "bg-amber-500/8 border-amber-500/20 text-amber-700 dark:text-amber-400"
              : "bg-destructive/8 border-destructive/20 text-destructive"
          )}>
            <div className="flex items-center gap-1.5 font-black uppercase tracking-widest mb-1">
              <ShieldAlert size={11} />
              {subState.isGracePeriod ? 'Grace Period' : 'Expired'}
            </div>
            <p className="text-muted-foreground mb-2">
              {subState.isGracePeriod
                ? `${subState.daysRemaining + 3}d grace left. Renew now.`
                : 'License ended. Features locked.'}
            </p>
            <Link to="/subscription">
              <Button
                size="sm"
                variant={subState.isGracePeriod ? "outline" : "destructive"}
                className="w-full h-7 text-[9px] uppercase font-black tracking-wider"
              >
                Renew License
              </Button>
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className={cn(
          "h-12 border-t border-border/60 flex items-center shrink-0",
          isSidebarCollapsed ? "justify-center" : "px-5"
        )}>
          {isSidebarCollapsed
            ? <span className="text-[9px] font-bold text-muted-foreground/40">v1</span>
            : <span className="text-[10px] text-muted-foreground/50">© 2025 OsaTech POS v1.0</span>
          }
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen transition-all relative overflow-hidden">
        {/* Top header */}
        <header className="h-16 md:h-[68px] bg-card/70 backdrop-blur-md border-b border-border/60 flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 relative z-20">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg md:hidden"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </Button>
            <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />
            <div>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate max-w-[58vw] sm:max-w-none leading-none">
                {navGroups.flatMap(g => g.items).find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </h1>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 hidden sm:block">
                {navGroups.find(g => g.items.some(i => i.path === location.pathname))?.label || 'Core'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-background/50 relative">
          <div className="mx-auto w-full max-w-screen-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </div>

        {/* Subscription banners */}
        {subState.isGracePeriod && (
          <div className="sticky bottom-0 z-50 bg-amber-500 text-white p-2.5 text-center shadow-[0_-4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2">
            <AlertCircle size={15} />
            <span className="font-medium text-xs">
              Subscription Expired — {subState.daysRemaining + 3}-day grace period active. Renew immediately.
            </span>
          </div>
        )}

        {subState.isExpired && !subState.isGracePeriod && subState.plan !== 'none' && (
          <div className="sticky bottom-0 z-50 bg-red-600 text-white p-2.5 text-center shadow-[0_-4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2">
            <AlertCircle size={15} />
            <span className="font-medium text-xs">
              Subscription EXPIRED — Access restricted to Sales only. Please renew to restore full access.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}

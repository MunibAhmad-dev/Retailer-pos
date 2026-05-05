import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Users,
  CreditCard, BarChart3, Settings, User, Moon, Sun, Receipt,
  Bell, Menu, X, CheckCircle2, AlertCircle, Info, ChevronLeft, ChevronRight, Truck, Key, TrendingUp, Lock, ShieldAlert, History, Landmark, Wallet, Undo2, CircleDollarSign
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

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { addNotification, notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const { t, language } = useLanguage();
  
  const [logoData, setLogoData] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    async function fetchLogo() { 
      if (window.api && window.api.getLogo) {
        try {
          const res = await window.api.getLogo();
          if (res.success && res.data) {
            setLogoData(res.data);
          }
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
  }, []);

  const subState = subService.getState();

  const navigationItems = [
    { path: '/', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/sales', icon: ShoppingCart, label: t('sales') },
    { path: '/products', icon: Package, label: t('products') },
    { path: '/vendors', icon: Truck, label: t('vendors') },
    { path: '/purchases', icon: Package, label: 'Purchases / POs' },
    { path: '/inventory', icon: Boxes, label: t('inventory') },
    { path: '/customers', icon: Users, label: t('customers') },
    { path: '/loans', icon: Wallet, label: 'Accounts (AP/AR)' },
    { path: '/transactions', icon: CreditCard, label: t('transactions') },
    { path: '/returns', icon: Undo2, label: 'Returns Management' },
    { path: '/payments', icon: CircleDollarSign, label: 'Payment Ledger' },
    { path: '/reports', icon: BarChart3, label: t('reports') },
    { path: '/balance-sheet', icon: TrendingUp, label: t('balance_sheet') },
    { path: '/expenses', icon: Receipt, label: t('expenses') },
    { path: '/register', icon: Wallet, label: 'Cash Register' },
    { path: '/register-history', icon: History, label: 'Register History' },
    { path: '/financials', icon: Landmark, label: 'Financial Management' },
    { path: '/settings', icon: Settings, label: t('settings') },
    { path: '/subscription', icon: Key, label: 'Subscription' },
    { path: '/about', icon: Info, label: 'About Software' }
  ];

  return (
    <div className="flex bg-background min-h-screen font-sans text-foreground transition-colors overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex-shrink-0 bg-card border-r border-border flex flex-col transition-all duration-300 relative",
          isSidebarCollapsed ? "w-[80px]" : "w-64"
        )}
      >
        <div className="absolute -right-3 top-6 z-50 rounded-full border border-border bg-background shadow-md">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 rounded-full" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        </div>

        {/* Sidebar Header */}
        <div className={cn("p-6 border-b border-border flex items-center h-20", isSidebarCollapsed ? "justify-center px-0" : "justify-center")}>
          <div className={cn("flex items-center space-x-3 transition-all", isSidebarCollapsed ? "flex-col space-x-0" : "")}>
            <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
              <img src={logoData || Logo} className="h-8 w-8 object-contain" alt="Logo" />
            </div>
            {!isSidebarCollapsed && (
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                <span className="text-primary">Osa</span>Tech
                <span className="text-muted-foreground font-normal text-sm block leading-none mt-0.5">Retailer POS</span>
              </h2>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isAllowed = subService.canAccess(item.path.replace('/', '')) || item.path === '/';
            
            if (!isAllowed) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/30 cursor-not-allowed group"
                  title="Access restricted due to expired subscription"
                >
                  <div className="relative">
                    <Icon size={18} className="opacity-40" />
                    <Lock size={10} className="absolute -top-1 -right-1 text-destructive" />
                  </div>
                  <span className={cn("transition-opacity duration-300", isSidebarCollapsed ? "opacity-0 w-0" : "opacity-100")}>
                    {item.label}
                  </span>
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isSidebarCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg transition-all duration-200 group text-muted-foreground",
                  isSidebarCollapsed ? "justify-center py-3" : "px-4 py-3",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" 
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("shrink-0", isSidebarCollapsed ? "w-5 h-5 mx-0" : "w-5 h-5 mr-3", isActive && !isSidebarCollapsed && "scale-110 transition-transform")} />
                {!isSidebarCollapsed && (
                  <span className={cn("font-medium text-sm transition-all", isActive ? "font-semibold" : "")}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Subscription Status Banner in Sidebar */}
        {!subState.isActive && subState.plan !== 'lifetime' && !isSidebarCollapsed && (
          <div className="mx-4 mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center gap-2 text-destructive mb-2">
                <ShieldAlert size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Expired</span>
             </div>
             <p className="text-[11px] text-muted-foreground leading-tight mb-3">Your license has ended. Most features are locked.</p>
             <Link to="/subscription">
               <Button size="sm" variant="destructive" className="w-full h-8 text-[10px] uppercase font-bold tracking-tighter">Renew Now</Button>
             </Link>
          </div>
        )}

        {/* User Profile */}
        <div className="p-4 border-t border-border mt-auto h-16 flex items-center justify-center">
          {!isSidebarCollapsed ? (
            <span className="text-xs font-medium text-muted-foreground">© 2025 OsaTech POS v1.0</span>
          ) : (
             <span className="text-xs font-bold text-muted-foreground">v1</span>
          )}
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-screen transition-all">
        {/* Top Header */}
        <header className="h-20 bg-card/60 backdrop-blur-md border-b border-border flex items-center justify-between px-8 shrink-0 relative z-20">
          <div className="flex items-center gap-4">
             <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
               {navigationItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
             </h1>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </header>

        {/* Dynamic Content Rendering Wrapper */}
        <div className="flex-1 p-8 overflow-y-auto bg-background/50 relative">
           <div className="mx-auto w-full max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
              <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </div>

        {/* SUBSCRIPTION WARNING BANNERS */}
        {subState.isGracePeriod && (
          <div className="sticky bottom-0 z-50 bg-amber-500 text-white p-3 text-center shadow-[0_-4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            <span className="font-medium text-sm">
              Subscription Expired. You are in a {subState.daysRemaining + 3}-day grace period. Please renew immediately to avoid losing access to all features.
            </span>
          </div>
        )}
        
        {subState.isExpired && !subState.isGracePeriod && subState.plan !== 'none' && (
          <div className="sticky bottom-0 z-50 bg-red-600 text-white p-3 text-center shadow-[0_-4px_12px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            <span className="font-medium text-sm">
              Subscription EXPIRED. Access is now restricted to the Sales module only. Please renew to restore full access.
            </span>
          </div>
        )}
      </main>
    </div>
  );
};

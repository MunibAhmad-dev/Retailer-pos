import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  Key,
  Bell,
  WifiOff,
  BarChart3,
  Settings,
  FileText,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  User,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from './ThemeProvider';

// ---------------------------------------------------------------------------
// Nav structure
// ---------------------------------------------------------------------------
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/',          label: 'Dashboard',  icon: LayoutDashboard },
      { to: '/instances', label: 'Instances',  icon: Monitor },
      { to: '/licenses',  label: 'Licenses',   icon: Key },
    ],
  },
  {
    label: 'Communicate',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/offline-license', label: 'Offline License', icon: WifiOff },
      { to: '/reports',         label: 'Reports',          icon: BarChart3 },
      { to: '/releases',        label: 'App Releases',     icon: Key },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings',  label: 'Settings',   icon: Settings },
      { to: '/audit',     label: 'Audit Logs', icon: FileText },
    ],
  },
];

// Map route paths to page titles for the header breadcrumb
const ROUTE_TITLES: Record<string, string> = {
  '/':                 'Dashboard',
  '/instances':        'Instances',
  '/licenses':         'Licenses',
  '/notifications':    'Notifications',
  '/offline-license':  'Offline License Generator',
  '/reports':          'Reports',
  '/settings':         'Settings',
  '/releases':         'App Releases',
  '/audit':            'Audit Logs',
};

// ---------------------------------------------------------------------------
// Helper: decode username from JWT stored in localStorage
// ---------------------------------------------------------------------------
function getUsernameFromToken(): string {
  try {
    const token = localStorage.getItem('admin_token');
    if (!token) return 'Admin';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username || payload.email || payload.sub || 'Admin';
  } catch {
    return 'Admin';
  }
}

function getInitials(name: string): string {
  return name
    .split(/[\s._@-]/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// ---------------------------------------------------------------------------
// Sidebar nav item
// ---------------------------------------------------------------------------
function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 select-none',
          isActive
            ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
            : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={17}
            className={cn(
              'shrink-0 transition-colors',
              isActive ? 'text-blue-400' : 'text-slate-500'
            )}
          />
          <span className="flex-1 leading-none">{label}</span>
          {isActive && (
            <ChevronRight size={13} className="text-blue-500 shrink-0" />
          )}
        </>
      )}
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------
function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const username = getUsernameFromToken();
  const initials = getInitials(username);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-[#0f172a] border-r border-white/10 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shrink-0">
            <span className="text-xs font-bold text-white tracking-tight">OT</span>
          </div>
          <div className="leading-none">
            <p className="text-sm font-semibold text-white">OsaTech</p>
            <p className="text-[11px] text-blue-400 mt-0.5 font-medium tracking-wide">POS Cloud</p>
          </div>
          {/* Close button – mobile only */}
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    end={item.to === '/'}
                    onClick={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: user info + actions */}
        <div className="shrink-0 border-t border-white/10 p-3 flex flex-col gap-0.5">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold uppercase">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-none">{username}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Administrator</p>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            {theme === 'dark' ? <Sun size={17} className="shrink-0" /> : <Moon size={17} className="shrink-0" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut size={17} className="shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [search, setSearch] = useState('');

  // Dynamic breadcrumb: find best-matching route title
  const pageTitle = (() => {
    // exact match first
    if (ROUTE_TITLES[location.pathname]) return ROUTE_TITLES[location.pathname];
    // prefix match for detail pages e.g. /instances/123
    const match = Object.keys(ROUTE_TITLES)
      .filter((k) => k !== '/')
      .find((k) => location.pathname.startsWith(k));
    return match ? ROUTE_TITLES[match] : 'Dashboard';
  })();

  const username = getUsernameFromToken();
  const initials = getInitials(username);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#0a0f1a]/80 backdrop-blur-md px-4 shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Page title / breadcrumb */}
      <h1 className="text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap mr-2 hidden sm:block">
        {pageTitle}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search */}
      <div className="relative hidden md:block">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-56 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
        />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Notification bell */}
      <button
        onClick={() => navigate('/notifications')}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
        aria-label="Notifications"
      >
        <Bell size={16} />
      </button>

      {/* User avatar */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase hover:bg-blue-600/25 transition-all"
        aria-label="User menu"
      >
        {initials || <User size={14} />}
      </button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Layout (default export)
// ---------------------------------------------------------------------------
export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0a0f1a]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

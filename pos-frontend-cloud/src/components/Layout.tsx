import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  Key,
  Bell,
  LogOut,
  Zap,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from './ThemeProvider';

const NAV = [
  { to: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/instances',     label: 'POS Instances', icon: Monitor },
  { to: '/licenses',      label: 'Licenses',      icon: Key },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200 dark:border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">OsaTech</p>
            <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-0.5">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-800'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={clsx(
                      'w-4.5 h-4.5',
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-gray-500'
                    )}
                    size={18}
                  />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-slate-200 dark:border-gray-800 flex flex-col gap-0.5">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0 bg-slate-50 dark:bg-[#0a0f1e]">
        {children}
      </main>
    </div>
  );
}

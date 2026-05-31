import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Key,
  BarChart3,
} from 'lucide-react';
import { authApi } from '../api';

const features = [
  {
    icon: RefreshCw,
    title: 'Real-time sync',
    desc: 'Instant data sync across all registered POS instances.',
  },
  {
    icon: Key,
    title: 'License management',
    desc: 'Issue, revoke and monitor licenses from a single panel.',
  },
  {
    icon: BarChart3,
    title: 'Multi-store analytics',
    desc: 'Aggregate sales and performance across every outlet.',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(username.trim(), password);
      if (res.success && res.token) {
        localStorage.setItem('admin_token', res.token);
        navigate('/', { replace: true });
      } else {
        setError('Invalid credentials');
      }
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot reach the server. Check your internet connection and try again.');
      } else {
        setError(err.response?.data?.error || 'Invalid username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a0f1a]">
      {/* ── Left panel (60%) ── */}
      <div className="hidden lg:flex lg:w-[60%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px]" />
        </div>

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Top: brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-white leading-tight tracking-tight">OsaTech</div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400/80 -mt-0.5">
                POS Cloud
              </div>
            </div>
          </div>
        </div>

        {/* Center: tagline + features */}
        <div className="relative z-10 flex-1 flex flex-col justify-center gap-10">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight max-w-sm">
              Manage your retail empire from one powerful dashboard
            </h2>
            <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-xs">
              Everything you need to run, monitor and scale your point-of-sale network — in one place.
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-4">
                <div className="mt-0.5 w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-sm font-semibold text-white">{title}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: footer */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500">Powered by OsaTech Technologies</span>
          </div>
        </div>
      </div>

      {/* ── Right panel (40%) ── */}
      <div className="flex-1 lg:w-[40%] flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Faint glow behind card */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-blue-600/5 blur-[80px]" />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">OsaTech</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400/80">POS Cloud</div>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Admin Login</h1>
            <p className="text-sm text-slate-400 mt-1">Sign in to access the control panel.</p>
          </div>

          {/* Card */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-7 shadow-2xl backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                    placeholder="admin"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-rose-400 leading-relaxed">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-600 mt-6">
            Forgot access?{' '}
            <span className="text-slate-500 hover:text-slate-400 cursor-default transition-colors">
              Contact support
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

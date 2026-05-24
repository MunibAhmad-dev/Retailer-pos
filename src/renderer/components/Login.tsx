import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, Shield, Store } from 'lucide-react';

interface LoginProps {
  onAuthenticated: () => void;
  mode?: 'dashboard' | 'system';
}

/* ── Theme tokens ────────────────────────────────────────────────────── */
const dark = {
  bg:          'radial-gradient(ellipse at 28% 18%, #0c1628 0%, #060912 55%, #020408 100%)',
  gridColor:   'rgba(59,130,246,0.028)',
  orbColors:   ['rgba(59,130,246,0.17)', 'rgba(139,92,246,0.13)', 'rgba(6,182,212,0.08)', 'rgba(99,102,241,0.07)'],
  ptColors:    ['rgba(139,92,246,0.5)', 'rgba(59,130,246,0.5)', 'rgba(6,182,212,0.35)'],
  scan:        'linear-gradient(90deg,transparent 5%,rgba(59,130,246,0.38) 40%,rgba(139,92,246,0.28) 60%,transparent 95%)',
  corner:      'rgba(59,130,246,0.22)',
  timeBig:     'rgba(255,255,255,0.9)',
  timeSec:     'rgba(255,255,255,0.35)',
  timeAmpm:    'rgba(147,197,253,0.7)',
  dateText:    'rgba(147,197,253,0.4)',
  cardBg:      'linear-gradient(148deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.03) 100%)',
  cardBorder:  '1px solid rgba(255,255,255,0.1)',
  cardShadow:  '0 52px 100px rgba(0,0,0,0.55),0 0 0 1px rgba(59,130,246,0.06),inset 0 1px 0 rgba(255,255,255,0.13),inset 0 -1px 0 rgba(0,0,0,0.18)',
  shimmer:     'linear-gradient(90deg,transparent,rgba(99,102,241,0.65),rgba(59,130,246,0.65),transparent)',
  footerBg:    'rgba(0,0,0,0.22)',
  footerLine:  '1px solid rgba(255,255,255,0.055)',
  logoBoxBg:   'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.15))',
  logoBoxBdr:  '1px solid rgba(255,255,255,0.14)',
  logoGlow:    'rgba(59,130,246,0.22)',
  storeName:   'rgba(255,255,255,0.88)',
  secureTxt:   'rgba(147,197,253,0.45)',
  inputBg:     'rgba(255,255,255,0.07)',
  inputBdr:    '1px solid rgba(255,255,255,0.11)',
  inputTxt:    'rgba(255,255,255,0.88)',
  inputIcon:   'rgba(96,165,250,0.55)',
  inputToggle: 'rgba(255,255,255,0.3)',
  phClass:     'placeholder:text-white/20',
  footerTxt:   'rgba(255,255,255,0.22)',
  footerVer:   'rgba(255,255,255,0.14)',
  hintTxt:     'rgba(255,255,255,0.11)',
  badgeDash:   { bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.2)',   text: 'rgba(147,197,253,0.7)' },
  badgeSys:    { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',  text: 'rgba(252,165,165,0.8)' },
  dotPulse:    '#4ade80',
};

const light = {
  bg:          'radial-gradient(ellipse at 30% 20%, #dbeafe 0%, #ede9fe 35%, #f0f9ff 65%, #f8fafc 100%)',
  gridColor:   'rgba(59,130,246,0.055)',
  orbColors:   ['rgba(59,130,246,0.13)', 'rgba(139,92,246,0.1)', 'rgba(6,182,212,0.07)', 'rgba(99,102,241,0.06)'],
  ptColors:    ['rgba(139,92,246,0.35)', 'rgba(59,130,246,0.35)', 'rgba(6,182,212,0.28)'],
  scan:        'linear-gradient(90deg,transparent 5%,rgba(59,130,246,0.18) 40%,rgba(139,92,246,0.12) 60%,transparent 95%)',
  corner:      'rgba(59,130,246,0.3)',
  timeBig:     'rgba(15,23,42,0.88)',
  timeSec:     'rgba(15,23,42,0.28)',
  timeAmpm:    'rgba(37,99,235,0.7)',
  dateText:    'rgba(29,78,216,0.5)',
  cardBg:      'linear-gradient(148deg,rgba(255,255,255,0.88) 0%,rgba(255,255,255,0.78) 100%)',
  cardBorder:  '1px solid rgba(0,0,0,0.08)',
  cardShadow:  '0 32px 80px rgba(59,130,246,0.12),0 0 0 1px rgba(59,130,246,0.08),inset 0 1px 0 rgba(255,255,255,0.95)',
  shimmer:     'linear-gradient(90deg,transparent,rgba(99,102,241,0.25),rgba(59,130,246,0.22),transparent)',
  footerBg:    'rgba(241,245,249,0.85)',
  footerLine:  '1px solid rgba(0,0,0,0.07)',
  logoBoxBg:   'linear-gradient(135deg,rgba(59,130,246,0.14),rgba(139,92,246,0.1))',
  logoBoxBdr:  '1px solid rgba(0,0,0,0.08)',
  logoGlow:    'rgba(59,130,246,0.16)',
  storeName:   'rgba(15,23,42,0.85)',
  secureTxt:   'rgba(29,78,216,0.5)',
  inputBg:     'rgba(0,0,0,0.04)',
  inputBdr:    '1px solid rgba(0,0,0,0.1)',
  inputTxt:    'rgba(15,23,42,0.88)',
  inputIcon:   'rgba(37,99,235,0.5)',
  inputToggle: 'rgba(15,23,42,0.35)',
  phClass:     'placeholder:text-slate-400',
  footerTxt:   'rgba(0,0,0,0.38)',
  footerVer:   'rgba(0,0,0,0.25)',
  hintTxt:     'rgba(0,0,0,0.2)',
  badgeDash:   { bg: 'rgba(59,130,246,0.09)',   border: 'rgba(59,130,246,0.2)',   text: 'rgba(29,78,216,0.8)' },
  badgeSys:    { bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)',    text: 'rgba(185,28,28,0.85)' },
  dotPulse:    '#16a34a',
};

export default function Login({ onAuthenticated, mode = 'dashboard' }: LoginProps) {
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPass] = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [shake, setShake]           = useState(false);
  const [logoData, setLogoData]     = useState<string | null>(null);
  const [storeName, setStoreName]   = useState('OsaTech POS');
  const [time, setTime]             = useState(new Date());
  const [isDark, setIsDark]         = useState(() =>
    document.documentElement.classList.contains('dark'));
  const inputRef = useRef<HTMLInputElement>(null);

  const T = isDark ? dark : light;

  /* stable particles */
  const particles = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      x:     (i * 37 + 11) % 97,
      y:     (i * 61 +  7) % 99,
      size:  (i % 3) + 1.5,
      dur:   ((i * 7) % 8) + 9,
      delay: -((i * 13) % 7),
      ci:    i % 3,
    })), []);

  useEffect(() => {
    /* watch theme class on <html> */
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    window.api?.getLogo?.().then((res: any) => {
      if (res?.success && res.data) setLogoData(res.data);
    }).catch(() => {});

    window.api?.getSettings?.().then((res: any) => {
      const n = res?.data?.store_name || res?.data?.owner_full_name || '';
      if (n) setStoreName(n);
    }).catch(() => {});

    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => { obs.disconnect(); clearInterval(tick); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');
    try {
      const res   = await window.api.verifyPassword(password);
      const valid = typeof res === 'boolean'
        ? res
        : res?.success ? (res.data?.isValid ?? false) : false;

      if (valid) {
        setSuccess(true);
        setTimeout(onAuthenticated, 950);
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
        setShake(true);
        setTimeout(() => setShake(false), 620);
        inputRef.current?.focus();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const rawH    = time.getHours();
  const hours   = String(rawH % 12 || 12).padStart(2, '0');
  const mins    = String(time.getMinutes()).padStart(2, '0');
  const secs    = String(time.getSeconds()).padStart(2, '0');
  const ampm    = rawH >= 12 ? 'PM' : 'AM';
  const dateStr = time.toLocaleDateString('en', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const isSystem = mode === 'system';
  const badge    = isSystem ? T.badgeSys : T.badgeDash;

  const overlayStyle: React.CSSProperties = isSystem
    ? { position: 'fixed',    inset: 0, zIndex: 9999 }
    : { position: 'absolute', inset: 0, zIndex: 90   };

  const content = (
    <div style={{
      ...overlayStyle,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      background: T.bg,
      userSelect: 'none',
      transition: 'background 0.5s ease',
    }}>

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          `linear-gradient(${T.gridColor} 1px,transparent 1px),` +
          `linear-gradient(90deg,${T.gridColor} 1px,transparent 1px)`,
        backgroundSize: '72px 72px',
      }} />

      {/* Orbs */}
      {[
        { s: { top: '-18%',    left:  '-8%'  }, w: '62vw', ci: 0, a: 'lo1 16s' },
        { s: { bottom: '-22%', right: '-12%' }, w: '56vw', ci: 1, a: 'lo2 20s' },
        { s: { top: '38%',     right: '6%'   }, w: '28vw', ci: 2, a: 'lo3 25s' },
        { s: { bottom: '10%',  left:  '5%'   }, w: '20vw', ci: 3, a: 'lo3 30s reverse' },
      ].map((o, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
          ...o.s, width: o.w, height: o.w,
          background: `radial-gradient(circle,${T.orbColors[o.ci]} 0%,transparent 65%)`,
          animation: `${o.a} ease-in-out infinite`,
        }} />
      ))}

      {/* Particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          background: T.ptColors[p.ci],
          animation: `lp ${p.dur}s ease-in-out ${p.delay}s infinite`,
        }} />
      ))}

      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1, pointerEvents: 'none',
        background: T.scan,
        animation: 'lscan 11s linear infinite',
      }} />

      {/* Corner brackets */}
      {[
        { top: 20,    left:  20,  borderTop: '1.5px solid', borderLeft:  '1.5px solid' },
        { top: 20,    right: 20,  borderTop: '1.5px solid', borderRight: '1.5px solid' },
        { bottom: 20, left:  20,  borderBottom: '1.5px solid', borderLeft:  '1.5px solid' },
        { bottom: 20, right: 20,  borderBottom: '1.5px solid', borderRight: '1.5px solid' },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: 28, height: 28, pointerEvents: 'none',
          borderColor: T.corner, borderRadius: 2, ...s,
        }} />
      ))}

      {/* Mode badge */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 99,
        background: badge.bg,
        border: `1px solid ${badge.border}`,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSystem ? '#f87171' : T.dotPulse }} className="animate-pulse" />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: badge.text }}>
          {isSystem ? 'System Locked' : 'Dashboard Locked'}
        </span>
      </div>

      {/* ── Main panel ── */}
      <motion.div
        animate={shake ? { x: [-13, 13, -10, 10, -6, 6, -2, 2, 0] } : {}}
        transition={{ duration: 0.58 }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 390, padding: '0 20px' }}
      >
        {/* Success ripple */}
        <AnimatePresence>
          {success && (
            <motion.div key="ripple"
              initial={{ scale: 0, opacity: 0.55 }}
              animate={{ scale: 45, opacity: 0 }}
              transition={{ duration: 1.05, ease: 'easeOut' }}
              style={{
                position: isSystem ? 'fixed' : 'absolute',
                borderRadius: '50%',
                top: '50%', left: '50%',
                width: 48, height: 48, marginTop: -24, marginLeft: -24,
                background: 'radial-gradient(circle,rgba(59,130,246,0.45),rgba(99,102,241,0.2) 50%,transparent 70%)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Clock ── */}
        <motion.div
          initial={{ opacity: 0, y: -22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.72, ease: [0.23, 1, 0.32, 1] }}
          style={{ textAlign: 'center', marginBottom: 28 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
            <span style={{
              fontSize: 58, fontWeight: 200, lineHeight: 1, whiteSpace: 'nowrap',
              color: T.timeBig,
              fontFamily: "'SF Mono','Fira Mono','Consolas',monospace",
              letterSpacing: '-0.02em',
            }}>
              {hours}:{mins}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8, gap: 1 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, lineHeight: 1,
                color: T.timeAmpm,
                letterSpacing: '0.1em', fontFamily: 'monospace',
              }}>{ampm}</span>
              <span style={{
                fontSize: 20, fontWeight: 200, lineHeight: 1,
                color: T.timeSec,
                fontFamily: "'SF Mono','Fira Mono','Consolas',monospace",
              }}>:{secs}</span>
            </div>
          </div>
          <p style={{ marginTop: 10, fontSize: 11, color: T.dateText, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            {dateStr}
          </p>
        </motion.div>

        {/* ── Glass card ── */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.14, duration: 0.68, ease: [0.23, 1, 0.32, 1] }}
          style={{
            borderRadius: 28,
            background: T.cardBg,
            border: T.cardBorder,
            backdropFilter: 'blur(64px)',
            WebkitBackdropFilter: 'blur(64px)',
            overflow: 'hidden',
            boxShadow: T.cardShadow,
            transition: 'background 0.4s ease, border 0.4s ease, box-shadow 0.4s ease',
          }}
        >
          {/* Top shimmer */}
          <div style={{ height: 1, marginLeft: '14%', marginRight: '14%', background: T.shimmer }} />

          <div style={{ padding: '28px 32px 0' }}>
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.28, duration: 0.52, ease: [0.23, 1, 0.32, 1] }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}
            >
              <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 14 }}>
                <div style={{
                  position: 'absolute', inset: -16, borderRadius: '50%', pointerEvents: 'none',
                  background: `radial-gradient(circle,${T.logoGlow},transparent 68%)`,
                  filter: 'blur(14px)', animation: 'lglow 3.5s ease-in-out infinite alternate',
                }} />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
                  background: 'rgba(59,130,246,0.14)', animation: 'lping 2.8s ease-out infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: -3, borderRadius: 23, pointerEvents: 'none', padding: 1.5,
                  background: 'conic-gradient(from 0deg,#3b82f6 0%,#8b5cf6 35%,#06b6d4 65%,#3b82f6 100%)',
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'destination-out', maskComposite: 'exclude',
                  animation: 'lring 5s linear infinite', opacity: 0.75,
                }} />
                <div style={{
                  position: 'relative', width: 80, height: 80, borderRadius: 20,
                  background: T.logoBoxBg, border: T.logoBoxBdr,
                  boxShadow: `0 8px 32px ${T.logoGlow},inset 0 1px 0 rgba(255,255,255,0.15)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {logoData
                    ? <img src={logoData} alt="Logo" style={{ width: 46, height: 46, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.55))' }} />
                    : <Store size={30} style={{ color: '#3b82f6', filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))' }} />
                  }
                </div>
              </div>

              <h1 style={{ fontSize: 18, fontWeight: 700, color: T.storeName, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                {storeName}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.dotPulse }} className="animate-pulse" />
                <Shield size={10} style={{ color: T.secureTxt }} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.secureTxt }}>
                  Secure Terminal
                </span>
              </div>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.45 }}
              >
                {/* Input */}
                <div className="group" style={{ position: 'relative', marginBottom: 10 }}>
                  <div className="group-focus-within:opacity-100" style={{
                    position: 'absolute', inset: -1, borderRadius: 14, pointerEvents: 'none',
                    background: 'linear-gradient(135deg,rgba(59,130,246,0.55),rgba(139,92,246,0.45))',
                    filter: 'blur(5px)', opacity: 0, transition: 'opacity 0.3s',
                  }} />
                  <div style={{
                    position: 'relative', display: 'flex', alignItems: 'center',
                    background: T.inputBg, border: T.inputBdr,
                    borderRadius: 14, overflow: 'hidden',
                    transition: 'background 0.3s, border 0.3s',
                  }}>
                    <Lock size={14} style={{ position: 'absolute', left: 16, color: T.inputIcon, flexShrink: 0, pointerEvents: 'none' }} />
                    <input
                      ref={inputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoFocus
                      required
                      className={T.phClass}
                      style={{
                        flex: 1, height: 54, background: 'transparent',
                        paddingLeft: 44, paddingRight: 48,
                        color: T.inputTxt,
                        fontSize: 14, fontWeight: 500,
                        letterSpacing: '0.1em', outline: 'none',
                        caretColor: '#3b82f6',
                      }}
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowPass(v => !v)}
                      style={{
                        position: 'absolute', right: 14,
                        color: T.inputToggle,
                        background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4,
                      }}
                      className="hover:!text-blue-500 transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div key="err"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', marginBottom: 10 }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 14px', borderRadius: 12,
                        background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${isDark ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.18)'}`,
                        color: isDark ? 'rgba(252,165,165,0.9)' : 'rgba(185,28,28,0.85)',
                        fontSize: 12, fontWeight: 500,
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} className="animate-pulse" />
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button type="submit"
                  disabled={loading || !password || success}
                  className="group"
                  style={{
                    position: 'relative', width: '100%', height: 54,
                    borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 45%,#7c3aed 100%)',
                    boxShadow: '0 4px 24px rgba(59,130,246,0.28)',
                    color: 'white', fontWeight: 600, fontSize: 14,
                    cursor: 'pointer', overflow: 'hidden',
                    transition: 'opacity 0.2s',
                    opacity: (loading || !password || success) ? 0.45 : 1,
                  }}>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5,#8b5cf6)' }} />
                  <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-y-0 w-28 -skew-x-12"
                      style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', animation: 'lshim 2.2s ease-in-out infinite' }} />
                  </div>
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                    {loading ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                        <span>Verifying…</span>
                      </>
                    ) : success ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={14} style={{ color: '#86efac' }} />
                        <span style={{ color: '#86efac' }}>Access Granted</span>
                      </motion.span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lock size={13} /> Unlock Terminal
                      </span>
                    )}
                  </div>
                </button>
              </motion.div>
            </form>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 28px', marginTop: 24,
            borderTop: T.footerLine, background: T.footerBg,
            transition: 'background 0.3s, border 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.dotPulse }} className="animate-pulse" />
              <span style={{ fontSize: 10, color: T.footerTxt, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                System Online
              </span>
            </div>
            <span style={{ fontSize: 10, color: T.footerVer, fontFamily: 'monospace' }}>OsaTech POS v1.0</span>
          </div>
        </motion.div>

        {/* Hint */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}
          style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: T.hintTxt, letterSpacing: '0.2em', textTransform: 'uppercase' }}
        >
          Protected · Authorized access only
        </motion.p>
      </motion.div>

      <style>{`
        @keyframes lo1   { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(3vw,2.5vh) scale(1.07)} 66%{transform:translate(-2.5vw,3.5vh) scale(0.94)} }
        @keyframes lo2   { 0%,100%{transform:translate(0,0) scale(1)} 38%{transform:translate(-3.5vw,-2.5vh) scale(1.09)} 72%{transform:translate(2.5vw,-4vh) scale(0.92)} }
        @keyframes lo3   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-2.5vw,2.5vh)} }
        @keyframes lp    { 0%,100%{transform:translateY(0) translateX(0);opacity:.18} 25%{transform:translateY(-20px) translateX(6px);opacity:.6} 50%{transform:translateY(-38px) translateX(-5px);opacity:.12} 75%{transform:translateY(-20px) translateX(3px);opacity:.44} }
        @keyframes lscan { 0%{top:-1px;opacity:0} 4%{opacity:1} 94%{opacity:.45} 100%{top:100%;opacity:0} }
        @keyframes lglow { 0%{opacity:.5;transform:scale(1)} 100%{opacity:1;transform:scale(1.06)} }
        @keyframes lping { 0%{transform:scale(1);opacity:.28} 100%{transform:scale(1.7);opacity:0} }
        @keyframes lring { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes lshim { 0%{left:-120px} 100%{left:calc(100% + 120px)} }
      `}</style>
    </div>
  );

  const target = isSystem
    ? document.body
    : (document.querySelector('main') ?? document.body);

  return createPortal(content, target);
}

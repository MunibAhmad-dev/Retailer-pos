import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ShieldCheck, Key, Loader2, CheckCircle2, Fingerprint, Copy,
  Wifi, WifiOff, Clock, RefreshCw, ArrowLeft, Send, AlertCircle,
  MessageCircle, KeyRound,
} from 'lucide-react';
import { useNotifications } from '../components/NotificationProvider';
import { submitRegistration, checkApprovalStatus } from '../services/api/authApi';

interface ActivationProps {
  onActivated: () => void;
}

const DEFAULT_BACKEND_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUD_BACKEND_URL) ||
  'http://localhost:4000';

/* ── theme tokens (mirrors Setup.tsx) ───────────────────────────────── */
const dark = {
  bg: 'radial-gradient(ellipse at 28% 18%, #0c1628 0%, #060912 55%, #020408 100%)',
  orb1: 'rgba(59,130,246,0.16)', orb2: 'rgba(139,92,246,0.11)',
  cardBg: 'linear-gradient(148deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.03) 100%)',
  cardBorder: 'rgba(255,255,255,0.09)',
  inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.13)',
  inputText: 'rgba(255,255,255,0.88)',
  labelCol: 'rgba(255,255,255,0.60)',
  heading: 'rgba(255,255,255,0.95)', sub: 'rgba(255,255,255,0.48)',
  divider: 'rgba(255,255,255,0.07)',
  skipBg: 'rgba(255,255,255,0.07)', skipBorder: 'rgba(255,255,255,0.13)',
  fpBg: 'rgba(99,102,241,0.08)', fpBorder: 'rgba(99,102,241,0.22)',
  particle: 'rgba(255,255,255,0.45)',
  methodActiveBg: 'rgba(59,130,246,0.12)', methodActiveBorder: 'rgba(59,130,246,0.35)',
  methodIdleBg: 'rgba(255,255,255,0.04)', methodIdleBorder: 'rgba(255,255,255,0.10)',
};
const light = {
  bg: 'radial-gradient(ellipse at 30% 20%, #dbeafe 0%, #ede9fe 35%, #f0f9ff 65%, #f8fafc 100%)',
  orb1: 'rgba(59,130,246,0.12)', orb2: 'rgba(139,92,246,0.09)',
  cardBg: 'linear-gradient(148deg,rgba(255,255,255,0.94) 0%,rgba(255,255,255,0.86) 100%)',
  cardBorder: 'rgba(0,0,0,0.07)',
  inputBg: 'rgba(0,0,0,0.04)', inputBorder: 'rgba(0,0,0,0.14)',
  inputText: 'rgba(15,23,42,0.88)',
  labelCol: 'rgba(15,23,42,0.58)',
  heading: 'rgba(15,23,42,0.95)', sub: 'rgba(15,23,42,0.46)',
  divider: 'rgba(0,0,0,0.07)',
  skipBg: 'rgba(0,0,0,0.04)', skipBorder: 'rgba(0,0,0,0.12)',
  fpBg: 'rgba(99,102,241,0.06)', fpBorder: 'rgba(99,102,241,0.20)',
  particle: 'rgba(59,130,246,0.45)',
  methodActiveBg: 'rgba(59,130,246,0.08)', methodActiveBorder: 'rgba(59,130,246,0.32)',
  methodIdleBg: 'rgba(0,0,0,0.02)', methodIdleBorder: 'rgba(0,0,0,0.10)',
};

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 43 + 9) % 100, y: (i * 31 + 15) % 100,
  size: 1.5 + ((i * 17) % 3),
  delay: (i * 0.24) % 4, dur: 3 + ((i * 0.43) % 4),
}));

type Phase = 'choose' | 'waiting' | 'approved';

export default function Activation({ onActivated }: ActivationProps) {
  const [phase, setPhase]   = useState<Phase>('choose');
  const [method, setMethod] = useState<'online' | 'offline' | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Loaded from existing settings
  const [storeName, setStoreName]     = useState('');
  const [ownerName, setOwnerName]     = useState('');
  const [mobile, setMobile]           = useState('');
  const [email, setEmail]             = useState('');
  const [address, setAddress]         = useState('');
  const [backendUrl, setBackendUrl]   = useState(DEFAULT_BACKEND_URL);

  // Offline mode
  const [activationKey, setActKey] = useState('');
  const [fingerprint, setFp]       = useState('');
  const [fpCopied, setFpCopied]    = useState(false);
  const [saving, setSaving]        = useState(false);

  // Online waiting
  const [regApiKey, setRegApiKey]       = useState('');
  const [pollCount, setPollCount]       = useState(0);
  const [lastChecked, setLastChecked]   = useState<Date | null>(null);
  const [pollError, setPollError]       = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { addNotification } = useNotifications();

  /* ── load settings + fingerprint ───────────────────────────── */
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    window.api?.getFingerprint?.().then((res: any) => {
      if (res?.success && res.data) setFp(res.data);
    });

    window.api?.getSettings?.().then((res: any) => {
      const s = res?.data;
      if (!s) return;
      setStoreName(s.store_name || s.business_name || '');
      setOwnerName(s.owner_full_name || '');
      setMobile(s.owner_mobile || s.store_phone || '');
      setEmail(s.owner_email || '');
      setAddress(s.store_address || '');
      if (s.cloud_backend_url) setBackendUrl(s.cloud_backend_url);
      // If already registered + pending, jump straight to waiting
      if (s.cloud_backend_token && s.approval_status === 'pending' && (s.owner_mobile || s.store_phone)) {
        setRegApiKey(s.cloud_backend_token);
        setMethod('online');
        setPhase('waiting');
      }
    });

    return () => obs.disconnect();
  }, []);

  /* ── approval polling ───────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'waiting' || !mobile) return;

    const poll = async () => {
      try {
        const result = await checkApprovalStatus(mobile, backendUrl);
        setLastChecked(new Date());
        setPollCount(c => c + 1);
        setPollError('');

        if (result.status === 'approved') {
          await window.api.updateSettings({
            approval_status: 'approved',
            cloud_backend_token: regApiKey || '',
            cloud_connected: 1,
          } as any);
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('approved');
          setTimeout(() => onActivated(), 2000);
        }
      } catch {
        setPollCount(c => c + 1);
        setPollError('Could not reach server — will retry automatically.');
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, mobile, regApiKey, backendUrl]);

  const T = isDark ? dark : light;

  /* ── Online submit ──────────────────────────────────────────── */
  const handleOnlineSubmit = async () => {
    if (!mobile) {
      addNotification('No Mobile', 'Mobile number is missing from your profile. Go to Settings to update it.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const result = await submitRegistration(
        { businessName: storeName, ownerName, mobile, email: email || undefined, address: address || undefined },
        backendUrl,
      );
      if (result.api_key) {
        await window.api.updateSettings({
          cloud_backend_token: result.api_key,
          approval_status: result.approval_status || 'pending',
          cloud_connected: 1,
          license_mode: 'online',
        } as any);
        setRegApiKey(result.api_key);
      }
      setPollCount(0);
      setLastChecked(null);
      setPollError('');
      setPhase('waiting');
    } catch (err: any) {
      addNotification('Registration Failed', err?.message || 'Could not reach server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Offline activate ───────────────────────────────────────── */
  const handleOfflineActivate = async () => {
    const key = activationKey.trim();
    if (!key) return;
    setSaving(true);
    try {
      const res = await window.api.activateAppV2(key);
      if (res.success) {
        await window.api.updateSettings({
          activation_key: key,
          approval_status: 'approved',
          license_mode: 'offline',
        } as any);
        addNotification('Activated', 'License key accepted.', 'success');
        setPhase('approved');
        setTimeout(() => onActivated(), 1500);
      } else {
        addNotification('Key Invalid', res.error || 'License key not recognised.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err?.message || 'Activation failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // No skip — license is required for all users

  /* ── Switch back from waiting ───────────────────────────────── */
  const handleBackFromWaiting = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('choose');
    setMethod('offline');
  };

  const copyFp = async () => {
    if (!fingerprint) return;
    await navigator.clipboard.writeText(fingerprint);
    setFpCopied(true);
    setTimeout(() => setFpCopied(false), 2500);
  };

  const inp: React.CSSProperties = {
    width: '100%', height: 42, paddingLeft: 38, paddingRight: 12,
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 10, color: T.inputText, fontSize: 13,
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };
  const ico: React.CSSProperties = {
    position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
    color: T.sub, pointerEvents: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: '100vh', overflowY: 'auto' }}>
      <style>{`
        @keyframes act2-orb   { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.1) translate(14px,-9px)} }
        @keyframes act2-float { 0%,100%{transform:translateY(0);opacity:.5} 50%{transform:translateY(-15px);opacity:.85} }
        @keyframes act2-spin  { to{transform:rotate(360deg)} }
        .act2-inp:focus { border-color:rgba(59,130,246,0.55)!important; box-shadow:0 0 0 3px rgba(59,130,246,0.12)!important; }
      `}</style>

      {/* Orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-8%', left: '-5%', width: '42%', height: '42%', borderRadius: '50%', background: T.orb1, filter: 'blur(80px)', animation: 'act2-orb 9s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-8%', right: '-5%', width: '38%', height: '38%', borderRadius: '50%', background: T.orb2, filter: 'blur(80px)', animation: 'act2-orb 12s ease-in-out infinite reverse' }} />
      </div>
      {/* Particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {PARTICLES.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: '50%', background: T.particle, animation: `act2-float ${p.dur}s ${p.delay}s ease-in-out infinite` }} />
        ))}
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 520, background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', padding: '32px 36px', position: 'relative', zIndex: 1, boxShadow: isDark ? '0 28px 80px rgba(0,0,0,0.65)' : '0 28px 80px rgba(0,0,0,0.10)' }}>

        <AnimatePresence mode="wait">

          {/* ══ APPROVED ══════════════════════════════════════════ */}
          {phase === 'approved' && (
            <motion.div key="approved"
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <CheckCircle2 size={38} color="#10b981" />
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#10b981' }}>Activated!</h2>
                <p style={{ margin: 0, fontSize: 13, color: T.sub, textAlign: 'center' }}>
                  Your POS is now activated. Starting up…
                </p>
              </div>
            </motion.div>
          )}

          {/* ══ WAITING ═══════════════════════════════════════════ */}
          {phase === 'waiting' && (
            <motion.div key="waiting"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 16 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.25)' }} />
                  <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#3b82f6', animation: 'act2-spin 1.2s linear infinite' }} />
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(59,130,246,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={28} color="#3b82f6" />
                  </div>
                </div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.heading }}>Waiting for Approval</h2>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: T.sub, textAlign: 'center', lineHeight: 1.5 }}>
                  Your registration has been submitted.<br />
                  The administrator will review and approve it shortly.
                </p>
              </div>

              {/* Info summary */}
              <div style={{ padding: '12px 15px', borderRadius: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Store',  value: storeName || '—' },
                    { label: 'Owner',  value: ownerName || '—' },
                    { label: 'Mobile', value: mobile || '—', mono: true, highlight: true },
                    { label: 'Status', value: 'Pending Approval', highlight: true },
                  ].map(({ label, value, mono, highlight }) => (
                    <div key={label}>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: T.sub, display: 'block', marginBottom: 2 }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: highlight ? '#f59e0b' : T.heading, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Poll status */}
              <div style={{ padding: '10px 14px', borderRadius: 10, background: pollError ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.04)', border: `1px solid ${pollError ? 'rgba(239,68,68,0.20)' : T.cardBorder}`, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={13} color={pollError ? '#f87171' : T.sub} style={{ flexShrink: 0, animation: pollError ? 'none' : 'act2-spin 3s linear infinite' }} />
                <div>
                  {pollError
                    ? <p style={{ margin: 0, fontSize: 11, color: '#f87171' }}>{pollError}</p>
                    : <p style={{ margin: 0, fontSize: 11, color: T.sub }}>
                        Checking every 5 seconds…
                        {lastChecked && <span style={{ marginLeft: 6, opacity: 0.6 }}>Last: {lastChecked.toLocaleTimeString()}</span>}
                        {pollCount > 0 && <span style={{ marginLeft: 6, opacity: 0.5 }}>({pollCount} checks)</span>}
                      </p>
                  }
                </div>
              </div>

              <button type="button" onClick={handleBackFromWaiting}
                style={{ width: '100%', height: 44, background: T.skipBg, border: `1px solid ${T.skipBorder}`, borderRadius: 12, color: T.heading, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ArrowLeft size={14} />
                Switch to Offline Mode Instead
              </button>

              <p style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: T.sub, opacity: 0.5 }}>
                You can close the app and come back — your registration is saved.
              </p>
            </motion.div>
          )}

          {/* ══ CHOOSE MODE ═══════════════════════════════════════ */}
          {phase === 'choose' && (
            <motion.div key="choose"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(99,102,241,0.13)', border: '1.5px solid rgba(99,102,241,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={22} color="#6366f1" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: T.heading, lineHeight: 1.2 }}>Activate License</h2>
                  <p style={{ margin: 0, marginTop: 3, fontSize: 12, color: T.sub }}>Choose how to activate your POS</p>
                </div>
              </div>

              {/* Mode cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {([
                  { id: 'online',  icon: Wifi,    iconColor: '#3b82f6', label: 'Online Verify', desc: 'Submit details for admin approval' },
                  { id: 'offline', icon: WifiOff, iconColor: '#6366f1', label: 'Offline Key',   desc: 'Paste a license key from admin' },
                ] as const).map(({ id, icon: Icon, iconColor, label, desc }) => (
                  <button key={id} type="button" onClick={() => setMethod(id)}
                    style={{ padding: '14px 16px', borderRadius: 13, background: method === id ? T.methodActiveBg : T.methodIdleBg, border: `${method === id ? '1.5' : '1'}px solid ${method === id ? T.methodActiveBorder : T.methodIdleBorder}`, cursor: 'pointer', position: 'relative', textAlign: 'left', transition: 'all 0.2s' }}>
                    {method === id && (
                      <div style={{ position: 'absolute', top: 7, right: 8, fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(59,130,246,0.18)', color: '#3b82f6', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={9} /> Selected
                      </div>
                    )}
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: id === 'online' ? 'rgba(59,130,246,0.10)' : 'rgba(99,102,241,0.12)', border: `1px solid ${id === 'online' ? 'rgba(59,130,246,0.20)' : 'rgba(99,102,241,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      <Icon size={17} color={iconColor} />
                    </div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.heading }}>{label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: T.sub, lineHeight: 1.4 }}>{desc}</p>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">

                {/* ── Online panel ─────────────────────────────── */}
                {method === 'online' && (
                  <motion.div key="online"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}>

                    {/* What will be submitted */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ flex: 1, height: 1, background: T.divider }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.sub }}>What will be submitted</span>
                      <div style={{ flex: 1, height: 1, background: T.divider }} />
                    </div>

                    <div style={{ padding: '12px 14px', borderRadius: 11, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)', marginBottom: 14 }}>
                      {mobile ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {[
                            { label: 'Store',     value: storeName || '—' },
                            { label: 'Owner',     value: ownerName || '—' },
                            { label: 'Mobile ID', value: mobile, mono: true, highlight: true },
                            { label: 'Email',     value: email || 'Not provided' },
                          ].map(({ label, value, mono, highlight }) => (
                            <div key={label}>
                              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: T.sub, display: 'block', marginBottom: 2 }}>{label}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: highlight ? '#10b981' : T.heading, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertCircle size={14} color="#f59e0b" />
                          <p style={{ margin: 0, fontSize: 12, color: '#f59e0b' }}>
                            Mobile number not found in profile. Please update it in <strong>Settings → Store</strong> first.
                          </p>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <MessageCircle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 11, color: T.sub, lineHeight: 1.5 }}>
                        After submitting, a <strong style={{ color: T.heading }}>waiting screen</strong> appears and auto-checks every 5 seconds. The app unlocks once the admin approves you.
                      </p>
                    </div>

                    <button type="button" onClick={handleOnlineSubmit} disabled={saving || !mobile}
                      style={{ width: '100%', height: 46, background: (saving || !mobile) ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (saving || !mobile) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {saving ? <><Loader2 size={14} style={{ animation: 'act2-spin 1s linear infinite' }} />Submitting…</> : <><Send size={14} />Submit for Approval</>}
                    </button>
                  </motion.div>
                )}

                {/* ── Offline panel ────────────────────────────── */}
                {method === 'offline' && (
                  <motion.div key="offline"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ flex: 1, height: 1, background: T.divider }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.sub }}>Offline Activation</span>
                      <div style={{ flex: 1, height: 1, background: T.divider }} />
                    </div>

                    {/* Fingerprint */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Fingerprint size={12} color="#6366f1" />
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.sub }}>Device Fingerprint</span>
                      </div>
                      <div style={{ padding: '10px 13px', borderRadius: 10, background: T.fpBg, border: `1px solid ${T.fpBorder}` }}>
                        <p style={{ fontFamily: 'monospace', fontSize: 10, color: T.inputText, opacity: 0.8, wordBreak: 'break-all', lineHeight: 1.5, margin: '0 0 8px', userSelect: 'all' }}>
                          {fingerprint || 'Loading…'}
                        </p>
                        <button type="button" onClick={copyFp} disabled={!fingerprint}
                          style={{ fontSize: 10, fontWeight: 700, color: fpCopied ? '#10b981' : '#6366f1', background: 'transparent', border: `1px solid ${fpCopied ? 'rgba(16,185,129,0.35)' : 'rgba(99,102,241,0.35)'}`, borderRadius: 6, padding: '3px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {fpCopied ? <><CheckCircle2 size={10} />Copied!</> : <><Copy size={10} />Copy</>}
                        </button>
                      </div>
                    </div>

                    {/* Key input */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.labelCol, marginBottom: 6 }}>
                        License Key <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <KeyRound size={14} style={ico} />
                        <input className="act2-inp" style={{ ...inp, fontFamily: 'monospace', fontSize: 12 }}
                          value={activationKey} onChange={e => setActKey(e.target.value)}
                          placeholder="Paste license key here…" />
                      </div>
                    </div>

                    {/* License required notice */}
                    <div style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <KeyRound size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 11, color: T.sub, lineHeight: 1.5 }}>
                        A license key is <strong style={{ color: T.heading }}>required</strong>. Contact OsaTech at{' '}
                        <button
                          type="button"
                          onClick={async () => {
                            if (fingerprint) {
                              try { await navigator.clipboard.writeText(fingerprint); } catch {}
                            }
                            const msg = encodeURIComponent(
                              `Hi OsaTech! I need a license key for my POS system.\n\nDevice Fingerprint:\n${fingerprint || 'Loading...'}`
                            );
                            (window.api as any).openExternalUrl(`https://wa.me/923298748232?text=${msg}`);
                          }}
                          style={{
                            color: '#25d366',
                            background: 'transparent',
                            border: '1px solid rgba(37,211,102,0.35)',
                            borderRadius: 5,
                            padding: '1px 7px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            verticalAlign: 'middle',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(37,211,102,0.12)';
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(37,211,102,0.6)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(37,211,102,0.35)';
                          }}
                        >
                          +923298748232 ↗
                        </button>{' '}
                        (WhatsApp) — clicking will copy your fingerprint &amp; open a pre-filled message.
                      </p>
                    </div>

                    <button type="button" onClick={handleOfflineActivate} disabled={saving || !activationKey.trim()}
                      style={{ width: '100%', height: 46, background: (saving || !activationKey.trim()) ? 'rgba(16,185,129,0.25)' : 'linear-gradient(135deg,#10b981,#3b82f6)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (saving || !activationKey.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {saving ? <><Loader2 size={14} style={{ animation: 'act2-spin 1s linear infinite' }} />Activating…</> : <><ShieldCheck size={14} />Activate & Start</>}
                    </button>
                  </motion.div>
                )}

                {/* Nothing selected */}
                {method === null && (
                  <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    <p style={{ textAlign: 'center', fontSize: 12, color: T.sub, margin: '4px 0 12px', opacity: 0.7 }}>
                      Select an activation method above to continue.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <p style={{ marginTop: 20, fontSize: 11, color: T.sub, opacity: 0.5, position: 'relative', zIndex: 1 }}>
        OsaTech POS · Online mode requires admin approval · Offline mode is always free
      </p>
    </div>
  );
}

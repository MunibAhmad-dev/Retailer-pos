import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle2, XCircle, RefreshCw, Phone,
  Store, Wifi, Loader2, AlertCircle, User, Edit2, Check,
} from 'lucide-react';
import { checkApprovalStatus } from '../services/api/authApi';

const FALLBACK_BACKEND_URL = 'http://localhost:4000';

interface PendingApprovalProps {
  onApproved: () => void;
  onRejected?: () => void;
}

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 47 + 11) % 100, y: (i * 31 + 17) % 100,
  size: 1.4 + ((i * 13) % 2.5),
  delay: (i * 0.28) % 5, dur: 4 + ((i * 0.47) % 3),
}));

const POLL_INTERVAL_MS = 30000;

export default function PendingApproval({ onApproved, onRejected }: PendingApprovalProps) {
  const [isDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [settings, setSettings] = useState<any>(null);
  const [status, setStatus] = useState<'polling' | 'approved' | 'rejected'>('polling');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef<any>(null);

  useEffect(() => {
    window.api.getSettings().then((res: any) => {
      if (res?.success && res.data) {
        const s = res.data;
        // Fix stale/empty backend URL
        if (!s.cloud_backend_url || s.cloud_backend_url === 'http://localhost:5000') {
          s.cloud_backend_url = FALLBACK_BACKEND_URL;
          window.api.updateSettings({ cloud_backend_url: FALLBACK_BACKEND_URL } as any);
        }
        setSettings(s);
        setUrlInput(s.cloud_backend_url);
        settingsRef.current = s;
      }
    });
  }, []);

  const saveUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    const updated = { ...settingsRef.current, cloud_backend_url: url };
    settingsRef.current = updated;
    setSettings(updated);
    await window.api.updateSettings({ cloud_backend_url: url } as any);
    setEditingUrl(false);
    setErrorMsg('');
    doCheck(updated);
  };

  const doCheck = async (s: any) => {
    if (!s) return;
    const mobile = (s.owner_mobile || s.store_phone || '').trim();
    const backendUrl = (s.cloud_backend_url || '').trim();
    if (!mobile || !backendUrl) {
      setErrorMsg('Mobile number or server URL not configured.');
      return;
    }
    setChecking(true);
    setErrorMsg('');
    try {
      const result = await checkApprovalStatus(mobile, backendUrl);
      setLastChecked(new Date());
      if (result.status === 'approved') {
        setStatus('approved');
        if (result.licenseKey) {
          await (window as any).api.activateAppV2?.(result.licenseKey);
        }
        await window.api.updateSettings({ approval_status: 'approved' } as any);
        setTimeout(() => onApproved(), 1800);
      } else if (result.status === 'rejected') {
        setStatus('rejected');
        await window.api.updateSettings({ approval_status: 'rejected' } as any);
        if (onRejected) setTimeout(() => onRejected(), 2200);
      }
    } catch (err: any) {
      const detail = err?.response?.status
        ? `Server returned ${err.response.status}`
        : err?.code === 'ECONNREFUSED' || err?.message?.includes('Network')
          ? `Cannot connect to ${backendUrl} — is the server running?`
          : err?.message || 'Unknown error';
      setErrorMsg(`${detail} — will retry automatically.`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!settings) return;
    doCheck(settings);

    pollRef.current = setInterval(() => {
      setCountdown(POLL_INTERVAL_MS / 1000);
      doCheck(settingsRef.current);
    }, POLL_INTERVAL_MS);

    cdRef.current = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cdRef.current) clearInterval(cdRef.current);
    };
  }, [settings]);

  const T = isDark ? {
    bg: 'radial-gradient(ellipse at 30% 20%, #0c1628 0%, #060912 55%, #020408 100%)',
    orb1: 'rgba(59,130,246,0.14)', orb2: 'rgba(99,102,241,0.09)',
    card: 'linear-gradient(148deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.02) 100%)',
    border: 'rgba(255,255,255,0.08)', heading: 'rgba(255,255,255,0.92)',
    sub: 'rgba(255,255,255,0.46)', pill: 'rgba(255,255,255,0.04)',
    pillBorder: 'rgba(255,255,255,0.09)', particle: 'rgba(255,255,255,0.38)',
    shadow: '0 28px 80px rgba(0,0,0,0.62)',
  } : {
    bg: 'radial-gradient(ellipse at 30% 20%, #dbeafe 0%, #ede9fe 35%, #f8fafc 100%)',
    orb1: 'rgba(59,130,246,0.10)', orb2: 'rgba(99,102,241,0.07)',
    card: 'linear-gradient(148deg,rgba(255,255,255,0.94) 0%,rgba(255,255,255,0.84) 100%)',
    border: 'rgba(0,0,0,0.07)', heading: 'rgba(15,23,42,0.92)',
    sub: 'rgba(15,23,42,0.48)', pill: 'rgba(0,0,0,0.03)',
    pillBorder: 'rgba(0,0,0,0.09)', particle: 'rgba(59,130,246,0.32)',
    shadow: '0 28px 80px rgba(0,0,0,0.08)',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', padding: 24, overflowY: 'auto',
    }}>
      <style>{`
        @keyframes pa-orb   { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.08) translate(12px,-8px)} }
        @keyframes pa-float { 0%,100%{transform:translateY(0);opacity:.38} 50%{transform:translateY(-14px);opacity:.75} }
        @keyframes pa-pulse { 0%,100%{opacity:.65;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes pa-ring  { 0%{transform:scale(0.82);opacity:0.85} 100%{transform:scale(2.4);opacity:0} }
        @keyframes pa-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-8%', width: '46%', height: '46%', borderRadius: '50%', background: T.orb1, filter: 'blur(90px)', animation: 'pa-orb 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-8%', width: '42%', height: '42%', borderRadius: '50%', background: T.orb2, filter: 'blur(90px)', animation: 'pa-orb 13s ease-in-out infinite reverse' }} />
      </div>

      {/* Particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {PARTICLES.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: '50%', background: T.particle, animation: `pa-float ${p.dur}s ${p.delay}s ease-in-out infinite` }} />
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Approved ── */}
        {status === 'approved' && (
          <motion.div key="approved"
            initial={{ opacity: 0, scale: 0.78 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.45)', animation: 'pa-ring 2s ease-out 1' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(16,185,129,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={42} color="#10b981" />
              </div>
            </div>
            <h2 style={{ color: '#10b981', fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>Approved!</h2>
            <p style={{ color: T.sub, fontSize: 14, lineHeight: 1.5 }}>Your account has been approved.<br />Loading your POS system…</p>
          </motion.div>
        )}

        {/* ── Rejected ── */}
        {status === 'rejected' && (
          <motion.div key="rejected"
            initial={{ opacity: 0, scale: 0.78 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 380 }}>
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <XCircle size={42} color="#ef4444" />
            </div>
            <h2 style={{ color: '#ef4444', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Registration Rejected</h2>
            <p style={{ color: T.sub, fontSize: 13, lineHeight: 1.6 }}>
              Your registration was not approved by the administrator.<br />
              Please contact support for assistance.
            </p>
          </motion.div>
        )}

        {/* ── Polling / Waiting ── */}
        {status === 'polling' && (
          <motion.div key="polling"
            initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: '100%', maxWidth: 468, position: 'relative', zIndex: 1,
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 22, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
              padding: '38px 32px', boxShadow: T.shadow,
            }}>

            {/* Animated clock icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
              <div style={{ position: 'relative', width: 88, height: 88 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.28)', animation: 'pa-ring 2.6s ease-out infinite' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.20)', animation: 'pa-ring 2.6s 1.3s ease-out infinite' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(251,191,36,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={38} color="#fbbf24" style={{ animation: 'pa-pulse 2.2s ease-in-out infinite' }} />
                </div>
              </div>
            </div>

            <h2 style={{ textAlign: 'center', fontSize: 21, fontWeight: 800, color: T.heading, margin: '0 0 10px' }}>
              Waiting for Admin Approval
            </h2>
            <p style={{ textAlign: 'center', fontSize: 13, color: T.sub, margin: '0 0 26px', lineHeight: 1.65 }}>
              Your registration has been submitted. The admin will review your account and approve it shortly.
            </p>

            {/* User info */}
            {settings && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {settings.store_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 11, background: T.pill, border: `1px solid ${T.pillBorder}` }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Store size={14} color="#6366f1" />
                    </div>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: T.sub, display: 'block', marginBottom: 1 }}>Store</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.heading }}>{settings.store_name}</span>
                    </div>
                  </div>
                )}
                {settings.owner_full_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 11, background: T.pill, border: `1px solid ${T.pillBorder}` }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={14} color="#3b82f6" />
                    </div>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: T.sub, display: 'block', marginBottom: 1 }}>Owner</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.heading }}>{settings.owner_full_name}</span>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 11, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.16)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={14} color="#10b981" />
                  </div>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: T.sub, display: 'block', marginBottom: 1 }}>Mobile (Your Unique ID)</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                      {settings.owner_mobile || settings.store_phone || '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Editable server URL */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: T.sub }}>Server URL</span>
                {!editingUrl && (
                  <button onClick={() => setEditingUrl(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: '#3b82f6', fontSize: 10, fontWeight: 700, padding: 0 }}>
                    <Edit2 size={10} /> Edit
                  </button>
                )}
              </div>
              {editingUrl ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveUrl()}
                    style={{ flex: 1, height: 34, padding: '0 10px', background: T.pill, border: `1px solid rgba(59,130,246,0.35)`, borderRadius: 8, color: T.heading, fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
                    placeholder="http://localhost:4000"
                    autoFocus
                  />
                  <button onClick={saveUrl} style={{ height: 34, padding: '0 12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 8, color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                    <Check size={12} /> Save
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: T.sub, wordBreak: 'break-all' }}>
                  {settings?.cloud_backend_url || FALLBACK_BACKEND_URL}
                </p>
              )}
            </div>

            {/* Error */}
            {errorMsg && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 9, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', marginBottom: 14 }}>
                <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: '#f87171', lineHeight: 1.5 }}>{errorMsg}</span>
              </div>
            )}

            {/* Poll status bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.13)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {checking
                  ? <Loader2 size={13} color="#3b82f6" style={{ animation: 'pa-spin 1s linear infinite' }} />
                  : <Wifi size={13} color="#3b82f6" />}
                <span style={{ fontSize: 11, color: T.sub }}>
                  {checking ? 'Checking status…' : lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Waiting for first check…'}
                </span>
              </div>
              {!checking && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>
                  Next in {countdown}s
                </span>
              )}
            </div>

            {/* Manual refresh */}
            <button
              onClick={() => { setCountdown(POLL_INTERVAL_MS / 1000); doCheck(settingsRef.current); }}
              disabled={checking}
              style={{
                width: '100%', height: 44, borderRadius: 12,
                background: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.22)',
                color: '#3b82f6', fontSize: 13, fontWeight: 700,
                cursor: checking ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: checking ? 0.55 : 1, transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => { if (!checking) e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.09)'; }}
            >
              {checking ? <Loader2 size={14} style={{ animation: 'pa-spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {checking ? 'Checking…' : 'Check Now'}
            </button>

            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 11, color: T.sub, opacity: 0.5 }}>
              Contact <strong style={{ color: T.sub, opacity: 1 }}>OsaTech</strong> at +923298748232 if you need assistance.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <p style={{ marginTop: 22, fontSize: 11, color: T.sub, opacity: 0.42, position: 'relative', zIndex: 1, textAlign: 'center' }}>
        OsaTech POS · Contact your administrator if you need assistance
      </p>
    </div>
  );
}
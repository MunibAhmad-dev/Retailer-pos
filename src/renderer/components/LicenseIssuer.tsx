import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound, X, Copy, Check, RefreshCw, Lock,
  ShieldCheck, User, Fingerprint, Clock, Cpu, ChevronDown,
} from 'lucide-react';

const ISSUER_PASSWORD = 'Khan@123';

interface Props {
  onClose: () => void;
}

type Screen = 'auth' | 'generator';
type DurationUnit = 'days' | 'months' | 'years';

const overlay = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};
const modal = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.16 } },
};

export default function LicenseIssuer({ onClose }: Props) {
  const [screen, setScreen] = useState<Screen>('auth');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authShake, setAuthShake] = useState(false);

  // Generator state
  const [issuedTo, setIssuedTo] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [durationValue, setDurationValue] = useState(30);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [maxDevices, setMaxDevices] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState('');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ISSUER_PASSWORD) {
      setScreen('generator');
      setAuthError('');
    } else {
      setAuthError('Incorrect password.');
      setAuthShake(true);
      setTimeout(() => setAuthShake(false), 500);
      setPassword('');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuedTo.trim()) { setGenError('Business name is required.'); return; }
    setGenError('');
    setGenerating(true);
    setGeneratedKey('');
    try {
      const res = await window.api.generateLicenseKey({
        issuedTo: issuedTo.trim(),
        fingerprint: fingerprint.trim() || undefined,
        issuedForFingerprint: fingerprint.trim() || undefined,
        durationValue,
        durationUnit,
        maxDevices,
      });
      if (res.success && res.data) {
        setGeneratedKey(res.data as string);
      } else {
        setGenError(res.error || 'License generation failed.');
      }
    } catch (err: any) {
      setGenError(err?.message || 'Unexpected error.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = useCallback(async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = generatedKey;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }, [generatedKey]);

  const handleReset = () => {
    setGeneratedKey('');
    setGenError('');
    setIssuedTo('');
    setFingerprint('');
    setDurationValue(30);
    setDurationUnit('days');
    setMaxDevices(1);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="li-overlay"
        variants={overlay} initial="hidden" animate="show" exit="exit"
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="li-modal"
          variants={modal} initial="hidden" animate="show" exit="exit"
          style={{
            width: '100%',
            maxWidth: screen === 'auth' ? 400 : 540,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '28px 32px',
            position: 'relative',
            boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(139,92,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <KeyRound size={17} color="#8b5cf6" />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                License Issuer
              </h2>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>
                {screen === 'auth' ? 'Enter issuer password to continue' : 'Generate offline license keys'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', padding: 4, borderRadius: 6, lineHeight: 1,
                color: 'var(--muted-foreground)',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Auth Screen ── */}
          {screen === 'auth' && (
            <motion.form
              onSubmit={handleAuth}
              animate={authShake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.42 }}
            >
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Issuer Password
              </label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', height: 42, paddingLeft: 36, paddingRight: 14,
                    background: 'var(--muted)', border: authError ? '1.5px solid #ef4444' : '1.5px solid var(--border)',
                    borderRadius: 10, fontSize: 14, color: 'var(--foreground)',
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'monospace', letterSpacing: 3,
                  }}
                />
              </div>
              {authError && (
                <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 14, marginTop: -8 }}>{authError}</p>
              )}
              <button
                type="submit"
                disabled={!password.length}
                style={{
                  width: '100%', height: 42,
                  background: password.length ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'rgba(139,92,246,0.25)',
                  border: 'none', borderRadius: 10, color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: password.length ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <ShieldCheck size={15} /> Unlock License Issuer
              </button>
            </motion.form>
          )}

          {/* ── Generator Screen ── */}
          {screen === 'generator' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {generatedKey ? (
                /* ── Result ── */
                <div>
                  <div style={{
                    background: 'rgba(16,185,129,0.07)',
                    border: '1.5px solid rgba(16,185,129,0.3)',
                    borderRadius: 12, padding: '14px 16px', marginBottom: 18,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                      <Check size={14} color="#10b981" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>License Key Generated</span>
                    </div>
                    <code style={{
                      display: 'block', wordBreak: 'break-all', fontSize: 11,
                      fontFamily: 'monospace', color: 'var(--foreground)',
                      background: 'var(--muted)', borderRadius: 8,
                      padding: '10px 12px', lineHeight: 1.7, letterSpacing: 0.5,
                    }}>
                      {generatedKey}
                    </code>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleCopy}
                      style={{
                        flex: 1, height: 40,
                        background: copied ? 'rgba(16,185,129,0.12)' : 'var(--muted)',
                        border: copied ? '1.5px solid rgba(16,185,129,0.4)' : '1.5px solid var(--border)',
                        borderRadius: 9, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', color: copied ? '#10b981' : 'var(--foreground)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        transition: 'all 0.2s',
                      }}
                    >
                      {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Key</>}
                    </button>
                    <button
                      onClick={handleReset}
                      style={{
                        flex: 1, height: 40,
                        background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
                        border: 'none', borderRadius: 9,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      }}
                    >
                      <RefreshCw size={13} /> Generate Another
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Form ── */
                <form onSubmit={handleGenerate}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Business Name */}
                    <div>
                      <label style={labelStyle}>
                        <User size={11} /> Business / Issued To <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        autoFocus
                        value={issuedTo}
                        onChange={e => setIssuedTo(e.target.value)}
                        placeholder="e.g. Khan General Store"
                        style={inputStyle}
                      />
                    </div>

                    {/* Fingerprint */}
                    <div>
                      <label style={labelStyle}>
                        <Fingerprint size={11} /> Device Fingerprint <span style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}>(optional)</span>
                      </label>
                      <input
                        value={fingerprint}
                        onChange={e => setFingerprint(e.target.value)}
                        placeholder="Leave blank to skip fingerprint lock"
                        style={inputStyle}
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <label style={labelStyle}>
                        <Clock size={11} /> Duration
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={durationValue}
                          onChange={e => setDurationValue(Math.max(1, Number(e.target.value)))}
                          style={{ ...inputStyle, width: 90, textAlign: 'center' }}
                        />
                        <div style={{ position: 'relative', flex: 1 }}>
                          <select
                            value={durationUnit}
                            onChange={e => setDurationUnit(e.target.value as DurationUnit)}
                            style={{ ...inputStyle, width: '100%', appearance: 'none', paddingRight: 28, cursor: 'pointer' }}
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                          </select>
                          <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted-foreground)' }} />
                        </div>
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>
                        {durationUnit === 'years' && durationValue === 999 ? 'Lifetime license' :
                          `Expires after ${durationValue} ${durationUnit}`}
                      </p>
                    </div>

                    {/* Max Devices */}
                    <div>
                      <label style={labelStyle}>
                        <Cpu size={11} /> Max Devices
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={maxDevices}
                        onChange={e => setMaxDevices(Math.max(1, Number(e.target.value)))}
                        style={{ ...inputStyle, width: 90, textAlign: 'center' }}
                      />
                    </div>

                    {/* Preset buttons */}
                    <div>
                      <label style={labelStyle}>Quick Presets</label>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {[
                          { label: '30 Days', v: 30, u: 'days' as DurationUnit },
                          { label: '3 Months', v: 3, u: 'months' as DurationUnit },
                          { label: '1 Year', v: 1, u: 'years' as DurationUnit },
                          { label: 'Lifetime', v: 999, u: 'years' as DurationUnit },
                        ].map(p => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => { setDurationValue(p.v); setDurationUnit(p.u); }}
                            style={{
                              height: 28, padding: '0 11px',
                              background: durationValue === p.v && durationUnit === p.u
                                ? 'rgba(139,92,246,0.18)' : 'var(--muted)',
                              border: durationValue === p.v && durationUnit === p.u
                                ? '1.5px solid rgba(139,92,246,0.45)' : '1.5px solid var(--border)',
                              borderRadius: 7, fontSize: 11, fontWeight: 700,
                              cursor: 'pointer',
                              color: durationValue === p.v && durationUnit === p.u
                                ? '#8b5cf6' : 'var(--muted-foreground)',
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {genError && (
                      <p style={{ fontSize: 11, color: '#ef4444', marginTop: -4 }}>{genError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={generating || !issuedTo.trim()}
                      style={{
                        height: 44, marginTop: 4,
                        background: generating || !issuedTo.trim()
                          ? 'rgba(139,92,246,0.25)'
                          : 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
                        border: 'none', borderRadius: 10,
                        fontSize: 13, fontWeight: 700, cursor: generating || !issuedTo.trim() ? 'not-allowed' : 'pointer',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      {generating
                        ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                        : <><KeyRound size={14} /> Generate License Key</>}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 10, fontWeight: 700, marginBottom: 6,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px',
  background: 'var(--muted)', border: '1.5px solid var(--border)',
  borderRadius: 9, fontSize: 13, color: 'var(--foreground)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

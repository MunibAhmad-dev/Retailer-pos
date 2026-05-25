import React, { useEffect, useState } from 'react';
import { ShieldX, MessageCircle, RefreshCw } from 'lucide-react';

interface BlockedScreenProps {
  /** Reason string stored in local settings (may be empty) */
  reason?: string;
  /** Called when the user clicks "Check Again" — triggers checkActivation in App.tsx */
  onRetry: () => void;
}

const WHATSAPP = '+923298748232';
const AUTO_POLL_SECONDS = 60;

/**
 * Shown when approval_status === 'blocked'.
 * Replaces the main app view until the block is lifted and onRetry detects the change.
 * Auto-polls every 60 seconds so the user doesn't need to click manually.
 */
export default function BlockedScreen({ reason, onRetry }: BlockedScreenProps) {
  const [countdown, setCountdown] = useState(AUTO_POLL_SECONDS);
  const [checking, setChecking] = useState(false);

  // Auto-retry countdown
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleRetry();
          return AUTO_POLL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    try {
      onRetry();
    } finally {
      setTimeout(() => setChecking(false), 2000);
    }
  };

  const manualRetry = () => {
    setCountdown(AUTO_POLL_SECONDS);
    handleRetry();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at 30% 20%, #1a0a0a 0%, #0a0306 60%, #020102 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center',
        fontFamily: 'inherit',
      }}
    >
      {/* Red glow orb */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '60%', height: '40%', borderRadius: '50%',
        background: 'rgba(239,68,68,0.12)', filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, position: 'relative', zIndex: 1,
      }}>
        <ShieldX size={40} color="#ef4444" />
      </div>

      <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 800, color: '#f87171', position: 'relative', zIndex: 1 }}>
        Access Blocked
      </h1>

      <p style={{ margin: '0 0 8px', fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 380, lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
        Your POS has been blocked by the administrator.
        {reason ? (
          <>
            {' '}Reason: <span style={{ color: 'rgba(255,255,255,0.80)', fontWeight: 600 }}>{reason}</span>
          </>
        ) : (
          <> Please contact OsaTech to resolve the issue.</>
        )}
      </p>

      {/* Contact card */}
      <div style={{
        marginTop: 20, padding: '14px 20px', borderRadius: 14,
        background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.20)',
        display: 'flex', alignItems: 'center', gap: 12, maxWidth: 360, width: '100%',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageCircle size={18} color="#25d366" />
        </div>
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Contact OsaTech Support</p>
          <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 800, color: '#25d366', fontFamily: 'monospace' }}>
            {WHATSAPP}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>WhatsApp · Available 9 am – 9 pm</p>
        </div>
      </div>

      {/* Retry */}
      <button
        type="button"
        onClick={manualRetry}
        disabled={checking}
        style={{
          marginTop: 22, display: 'flex', alignItems: 'center', gap: 7,
          padding: '10px 22px', borderRadius: 10, cursor: checking ? 'not-allowed' : 'pointer',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.60)', fontSize: 12, fontWeight: 600,
          position: 'relative', zIndex: 1, transition: 'all 0.2s',
          opacity: checking ? 0.7 : 1,
        }}
        onMouseEnter={e => { if (!checking) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
      >
        <RefreshCw size={13} style={{ animation: checking ? 'spin 1s linear infinite' : undefined }} />
        {checking ? 'Checking…' : 'Check Again'}
      </button>

      {/* Auto-poll countdown */}
      <p style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.28)', position: 'relative', zIndex: 1 }}>
        Auto-checking in <span style={{ color: 'rgba(255,255,255,0.50)', fontWeight: 700 }}>{countdown}s</span>
        {' '}— no manual action needed if the block has been lifted.
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

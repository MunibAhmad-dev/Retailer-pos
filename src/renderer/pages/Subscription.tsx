import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, Key, Clock, Calendar, Wallet,
  Copy, Fingerprint, Zap, Mail, Phone, CheckCircle2,
  AlertCircle, ArrowRight, Sparkles, Lock, Infinity
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { subService, SubscriptionState } from '../services/subscription';

/* ── animation helpers ─────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

/* ── plan catalogue ─────────────────────────────────────────── */
const PLANS = [
  { id: 'weekly',   label: 'Weekly',   days: 7,    icon: Zap,        accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)' },
  { id: 'monthly',  label: 'Monthly',  days: 30,   icon: Clock,      accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.22)' },
  { id: 'yearly',   label: 'Yearly',   days: 365,  icon: Calendar,   accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.22)' },
  { id: 'lifetime', label: 'Lifetime', days: null, icon: ShieldCheck, accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.22)' },
];

export default function Subscription() {
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const [fpCopied, setFpCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadSubscription();
    window.api.getFingerprint().then((res: any) => {
      if (res.success && res.data) setFingerprint(res.data);
    });
    const timer = setInterval(() => {
      const state = subService.getState();
      if (state.expiryDate) {
        const diff = new Date(state.expiryDate).getTime() - Date.now();
        if (diff > 0) {
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
        } else {
          setTimeLeft('Expired');
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSubscription = async () => {
    const state = await subService.initialize();
    setSubState(state);
    try {
      const settings = await window.api.getSettings();
      if (settings.success && settings.data?.business_name) {
        setBusinessName(settings.data.business_name);
      }
    } catch {}
  };

  const handleCopyFingerprint = async () => {
    if (!fingerprint) return;
    await navigator.clipboard.writeText(fingerprint);
    setFpCopied(true);
    addNotification('Copied', 'Device fingerprint copied to clipboard', 'success');
    setTimeout(() => setFpCopied(false), 2000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKey) return;
    setIsActivating(true);
    try {
      const res = await window.api.activateAppV2(activationKey.trim());
      if (res.success) {
        addNotification('Subscription Renewed', 'Your license key has been successfully applied.', 'success');
        setActivationKey('');
        await loadSubscription();
      } else {
        addNotification('Activation Failed', res.error || 'Invalid license key', 'error');
      }
    } catch (err: any) {
      addNotification('Activation Error', err.message, 'error');
    } finally {
      setIsActivating(false);
    }
  };

  if (!subState) return null;

  const isLifetime = subState.plan === 'lifetime';
  const isActive   = subState.isActive && !subState.isGracePeriod;
  const isGrace    = subState.isGracePeriod;
  const isExpired  = subState.isExpired && !subState.isGracePeriod;

  const activePlan = PLANS.find(p => p.id === subState.plan) ?? PLANS[1];

  /* ── status colour tokens ───────────────────────────────── */
  const statusCfg = isLifetime
    ? { label: 'Lifetime', badge: 'bg-emerald-500', icon: ShieldCheck, glow: 'rgba(16,185,129,0.18)', ring: '#10b981' }
    : isActive
    ? { label: 'Active',   badge: 'bg-emerald-500', icon: ShieldCheck, glow: 'rgba(16,185,129,0.12)', ring: '#10b981' }
    : isGrace
    ? { label: 'Grace Period', badge: 'bg-amber-500', icon: AlertCircle, glow: 'rgba(245,158,11,0.14)', ring: '#f59e0b' }
    : { label: 'Expired', badge: 'bg-red-600', icon: ShieldAlert, glow: 'rgba(239,68,68,0.14)', ring: '#ef4444' };

  const StatusIcon = statusCfg.icon;

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-7">

      {/* ── HERO STATUS CARD ─────────────────────────────── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={0}
        style={{ background: `radial-gradient(ellipse at 60% 0%, ${statusCfg.glow} 0%, transparent 65%)` }}
        className="relative rounded-2xl border border-border/60 bg-card overflow-hidden p-6 md:p-8"
      >
        {/* decorative grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.6) 1px,transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          {/* Icon ring */}
          <div className="shrink-0 relative">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${statusCfg.glow} 0%, rgba(255,255,255,0.04) 100%)`, border: `1.5px solid ${statusCfg.ring}40` }}
            >
              <StatusIcon size={36} style={{ color: statusCfg.ring }} />
            </div>
            <div
              className="absolute inset-0 rounded-2xl animate-pulse"
              style={{ boxShadow: `0 0 28px 4px ${statusCfg.glow}` }}
            />
          </div>

          {/* Days / status */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full text-white", statusCfg.badge)}>
                {statusCfg.label}
              </span>
              {businessName && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {businessName}
                </span>
              )}
            </div>

            <div className="flex items-end gap-3 mt-2">
              <span className="text-6xl md:text-7xl font-black leading-none tracking-tight" style={{ color: statusCfg.ring }}>
                {isLifetime ? '∞' : Math.max(0, subState.daysRemaining)}
              </span>
              {!isLifetime && (
                <div className="mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">Days</p>
                  <p className="text-xs text-muted-foreground leading-none mt-1">Remaining</p>
                </div>
              )}
              {isLifetime && (
                <div className="mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Lifetime</p>
                  <p className="text-xs text-muted-foreground">Never expires</p>
                </div>
              )}
            </div>

            {timeLeft && !isLifetime && timeLeft !== 'Expired' && (
              <p className="text-xs font-mono text-muted-foreground mt-2 tabular-nums">{timeLeft}</p>
            )}
          </div>

          {/* Expiry date */}
          {subState.expiryDate && !isLifetime && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Expires</p>
              <p className="text-sm font-semibold mt-1">
                {new Date(subState.expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 capitalize font-medium">
                {subState.plan} plan
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── URGENT EXPIRY BANNER ─────────────────────────── */}
      {!isLifetime && subState.daysRemaining <= 5 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={1}
          className="rounded-xl border border-red-500/30 bg-red-500/8 p-4 flex items-center gap-4"
        >
          <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <ShieldAlert size={20} className="text-red-500 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">Urgent: License Expiring</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Time remaining: <span className="font-mono font-bold text-foreground">{timeLeft || `${subState.daysRemaining} days`}</span>
            </p>
          </div>
          <p className="text-[10px] font-mono font-bold text-muted-foreground shrink-0">
            {new Date(subState.expiryDate || 0).toLocaleDateString()}
          </p>
        </motion.div>
      )}

      {/* ── PLAN CARDS ───────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2}>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/60 mb-3">Available Plans</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = subState.plan === plan.id;
            return (
              <div
                key={plan.id}
                style={{
                  background: isCurrent ? plan.bg : undefined,
                  borderColor: isCurrent ? plan.border : undefined,
                }}
                className={cn(
                  "relative p-4 rounded-xl border flex flex-col items-center text-center gap-2 transition-all duration-200",
                  isCurrent
                    ? "shadow-md"
                    : "border-border/50 bg-card hover:border-border hover:-translate-y-0.5"
                )}
              >
                {isCurrent && (
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                    style={{ background: plan.accent }}
                  >
                    Current
                  </span>
                )}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${plan.accent}18`, border: `1px solid ${plan.accent}30` }}
                >
                  <Icon size={18} style={{ color: plan.accent }} />
                </div>
                <p className="text-xs font-bold">{plan.label}</p>
                <p className="text-[10px] text-muted-foreground font-semibold">
                  {plan.days === null ? '∞ Unlimited' : `${plan.days} Days`}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── FINGERPRINT ─────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3}
        className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/5 via-card to-violet-500/5 p-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Fingerprint size={18} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black mb-1">Device Fingerprint</p>
              <p className="font-mono text-[11px] break-all text-foreground/85 leading-relaxed select-all">
                {fingerprint || 'Loading...'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "shrink-0 h-8 px-3 text-[11px] font-bold gap-1.5 rounded-lg transition-all active:scale-95",
              fpCopied
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                : "hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
            )}
            onClick={handleCopyFingerprint}
            disabled={!fingerprint}
          >
            {fpCopied ? <><CheckCircle2 size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 ml-12 italic">
          Share this fingerprint with the developer when requesting a license key.
        </p>
      </motion.div>

      {/* ── STATUS + RENEWAL GRID ────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}
        className="grid gap-4 md:grid-cols-2"
      >
        {/* Status */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/50">
            <Calendar size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-bold">Current Status</h3>
          </div>

          {[
            {
              label: 'Status',
              value: (
                <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white", statusCfg.badge)}>
                  {statusCfg.label}
                </span>
              )
            },
            {
              label: 'Plan',
              value: <span className="text-sm font-semibold capitalize">{subState.plan}</span>
            },
            {
              label: 'Days Remaining',
              value: (
                <span className={cn("text-2xl font-black tabular-nums", subState.daysRemaining <= 5 ? 'text-red-500' : 'text-primary')}>
                  {isLifetime ? '∞' : Math.max(0, subState.daysRemaining)}
                </span>
              )
            },
            ...(subState.expiryDate && !isLifetime ? [{
              label: 'Expiry Date',
              value: (
                <span className="text-xs font-medium text-right">
                  {new Date(subState.expiryDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )
            }] : []),
          ].map((row, i, arr) => (
            <div key={row.label} className={cn("flex items-center justify-between", i < arr.length - 1 && "pb-3 border-b border-border/40")}>
              <span className="text-xs text-muted-foreground">{row.label}</span>
              {row.value}
            </div>
          ))}
        </div>

        {/* Renewal */}
        <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col">
          <div className="flex items-center gap-2 pb-3 border-b border-border/50 mb-4">
            <Key size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-bold">Renew License</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            Enter your encrypted fingerprint-locked key below.
          </p>

          <form onSubmit={handleActivate} className="space-y-3 flex-1 flex flex-col">
            <Input
              type="text"
              placeholder="Paste license key here..."
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              className="font-mono text-xs h-10"
            />
            <Button
              type="submit"
              disabled={!activationKey || isActivating}
              className="w-full h-10 font-bold gap-2"
            >
              {isActivating
                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                : <><Key size={14} /> Apply License Key</>}
            </Button>
          </form>

          <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/40">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              <AlertCircle size={11} /> How it works
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              New days are <strong className="text-foreground">added</strong> to existing remaining days. Renewing early never loses you time.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── PAYMENT + SUPPORT ────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}
        className="rounded-2xl border border-border/60 bg-card overflow-hidden"
      >
        <div className="grid md:grid-cols-2">

          {/* Payment methods */}
          <div className="p-6 border-b md:border-b-0 md:border-r border-border/50">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Wallet size={17} className="text-primary" />
              </div>
              <h3 className="text-sm font-bold">Payment Methods</h3>
            </div>

            <div className="space-y-3">
              {/* Easypaisa */}
              <div className="flex items-center gap-4 p-3.5 rounded-xl border border-border/50 bg-background/50 hover:border-emerald-500/30 transition-colors">
                <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-[9px] text-center leading-tight tracking-tighter">EASY<br/>PAISA</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">Easypaisa Transfer</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Account: —</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>

              {/* JazzCash */}
              <div className="flex items-center gap-4 p-3.5 rounded-xl border border-border/50 bg-background/50 hover:border-red-500/30 transition-colors">
                <div className="w-11 h-11 bg-red-600 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-[9px] text-center leading-tight tracking-tighter">JAZZ<br/>CASH</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">JazzCash Transfer</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Account: 0329-8748232</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  Active
                </span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-4 italic leading-relaxed">
              * Send a screenshot of the payment receipt to the developer after transfer to receive your key.
            </p>
          </div>

          {/* Support */}
          <div className="p-6 bg-background/30">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Mail size={17} className="text-primary" />
              </div>
              <h3 className="text-sm font-bold">Contact Support</h3>
            </div>

            <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
              Issues with activation? Need a custom plan? Reach out directly.
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/60">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Email</span>
                <span className="font-mono text-[11px] font-bold text-primary select-all">munibahmad4735@gmail.com</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/60">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">WhatsApp</span>
                <span className="font-mono text-[11px] font-bold text-primary select-all">03298748232</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg border border-primary/15 bg-primary/5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground">Response time:</span> Usually within a few hours during business hours (PKT).
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

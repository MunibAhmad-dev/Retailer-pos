import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2, Mail, MapPin, Phone, ShieldCheck, User,
  Store, Key, Loader2, CheckCircle2, ArrowRight,
  Fingerprint, Copy, Wifi, WifiOff, MessageCircle, Sparkles
} from 'lucide-react';
import { useNotifications } from '../components/NotificationProvider';

interface SetupProps {
  onComplete: () => void;
}

/* ── theme tokens ──────────────────────────────────────────────── */
const dark = {
  bg: 'radial-gradient(ellipse at 28% 18%, #0c1628 0%, #060912 55%, #020408 100%)',
  orb1: 'rgba(59,130,246,0.16)', orb2: 'rgba(139,92,246,0.11)',
  cardBg: 'linear-gradient(148deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.03) 100%)',
  cardBorder: 'rgba(255,255,255,0.09)',
  innerCard: 'rgba(255,255,255,0.05)',
  innerBorder: 'rgba(255,255,255,0.10)',
  inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.13)',
  inputText: 'rgba(255,255,255,0.88)', inputPh: 'placeholder-white/25',
  labelCol: 'rgba(255,255,255,0.60)',
  heading: 'rgba(255,255,255,0.95)', sub: 'rgba(255,255,255,0.48)',
  divider: 'rgba(255,255,255,0.07)',
  stepDone: '#10b981', stepActive: '#3b82f6', stepIdle: 'rgba(255,255,255,0.10)',
  backBtn: 'rgba(255,255,255,0.32)',
  skipBg: 'rgba(255,255,255,0.07)', skipBorder: 'rgba(255,255,255,0.13)',
  fpBg: 'rgba(99,102,241,0.08)', fpBorder: 'rgba(99,102,241,0.22)',
  waBg: 'rgba(37,211,102,0.10)', waBorder: 'rgba(37,211,102,0.25)',
  particle: 'rgba(255,255,255,0.45)',
  methodActiveBg: 'rgba(59,130,246,0.12)', methodActiveBorder: 'rgba(59,130,246,0.35)',
  methodIdleBg: 'rgba(255,255,255,0.04)', methodIdleBorder: 'rgba(255,255,255,0.10)',
  methodDisabledBg: 'rgba(255,255,255,0.02)', methodDisabledBorder: 'rgba(255,255,255,0.06)',
};
const light = {
  bg: 'radial-gradient(ellipse at 30% 20%, #dbeafe 0%, #ede9fe 35%, #f0f9ff 65%, #f8fafc 100%)',
  orb1: 'rgba(59,130,246,0.12)', orb2: 'rgba(139,92,246,0.09)',
  cardBg: 'linear-gradient(148deg,rgba(255,255,255,0.94) 0%,rgba(255,255,255,0.86) 100%)',
  cardBorder: 'rgba(0,0,0,0.07)',
  innerCard: 'rgba(0,0,0,0.025)',
  innerBorder: 'rgba(0,0,0,0.09)',
  inputBg: 'rgba(0,0,0,0.04)', inputBorder: 'rgba(0,0,0,0.14)',
  inputText: 'rgba(15,23,42,0.88)', inputPh: 'placeholder-slate-400',
  labelCol: 'rgba(15,23,42,0.58)',
  heading: 'rgba(15,23,42,0.95)', sub: 'rgba(15,23,42,0.46)',
  divider: 'rgba(0,0,0,0.07)',
  stepDone: '#10b981', stepActive: '#3b82f6', stepIdle: 'rgba(0,0,0,0.08)',
  backBtn: 'rgba(15,23,42,0.36)',
  skipBg: 'rgba(0,0,0,0.04)', skipBorder: 'rgba(0,0,0,0.12)',
  fpBg: 'rgba(99,102,241,0.06)', fpBorder: 'rgba(99,102,241,0.20)',
  waBg: 'rgba(37,211,102,0.08)', waBorder: 'rgba(37,211,102,0.22)',
  particle: 'rgba(59,130,246,0.45)',
  methodActiveBg: 'rgba(59,130,246,0.08)', methodActiveBorder: 'rgba(59,130,246,0.32)',
  methodIdleBg: 'rgba(0,0,0,0.02)', methodIdleBorder: 'rgba(0,0,0,0.10)',
  methodDisabledBg: 'rgba(0,0,0,0.02)', methodDisabledBorder: 'rgba(0,0,0,0.06)',
};

/* deterministic particles */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 41 + 7) % 100, y: (i * 29 + 13) % 100,
  size: 1.5 + ((i * 17) % 3),
  delay: (i * 0.22) % 4, dur: 3 + ((i * 0.41) % 4),
}));

/* ── Developer contact ─────────────────────────────────────────── */
const DEV_WHATSAPP = '+923298748232';

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [fingerprint, setFingerprint] = useState('');
  const [fpCopied, setFpCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activationKey, setActivationKey] = useState('');
  const [form, setForm] = useState({
    store_name: '', owner_full_name: '', store_phone: '',
    owner_email: '', store_address: '',
  });
  const { addNotification } = useNotifications();

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.api?.getFingerprint?.().then((res: any) => {
      if (res?.success && res.data) setFingerprint(res.data);
    });
    return () => obs.disconnect();
  }, []);

  const T = isDark ? dark : light;
  const upd = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  /* ── step 1 → step 2 ────────────────────────────────────────── */
  const handleNext = () => {
    if (!form.store_name.trim() || !form.owner_full_name.trim() || !form.store_phone.trim()) {
      addNotification('Missing Details', 'Store name, owner name, and mobile are required.', 'warning');
      return;
    }
    setStep(1);
  };

  /* ── final submit ───────────────────────────────────────────── */
  const handleComplete = async (withKey: boolean) => {
    setSaving(true);
    try {
      const key = withKey ? activationKey.trim() : '';
      const payload = {
        store_name: form.store_name.trim(),
        business_name: form.store_name.trim(),
        owner_full_name: form.owner_full_name.trim(),
        store_phone: form.store_phone.trim(),
        owner_mobile: form.store_phone.trim(),
        owner_email: form.owner_email.trim(),
        store_address: form.store_address.trim(),
        activation_key: key,
        license_mode: key ? 'online' : 'offline',
        setup_completed: true,
      };
      const res = await window.api.updateSettings(payload as any);
      if (!res.success) throw new Error(res.error || 'Could not save setup');
      if (key) {
        const lic = await window.api.activateAppV2(key);
        if (!lic.success)
          addNotification('Offline Mode', lic.error || 'License not activated — setup saved for offline use.', 'warning');
      }
      addNotification('Setup Complete', 'Your POS is ready to use.', 'success');
      onComplete();
    } catch (err: any) {
      addNotification('Setup Failed', err?.message || 'Could not complete setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyFp = async () => {
    if (!fingerprint) return;
    await navigator.clipboard.writeText(fingerprint);
    setFpCopied(true);
    setTimeout(() => setFpCopied(false), 2500);
  };

  /* ── shared inline styles ─────────────────────────────────── */
  const inp: React.CSSProperties = {
    width: '100%', height: 42, paddingLeft: 38, paddingRight: 12,
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 10, color: T.inputText, fontSize: 13,
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
    textTransform: 'uppercase', color: T.labelCol, marginBottom: 6,
  };
  const ico: React.CSSProperties = {
    position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
    color: T.sub, pointerEvents: 'none',
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:T.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, minHeight:'100vh', overflowY:'auto' }}>
      <style>{`
        @keyframes sup-orb   { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.1) translate(16px,-10px)} }
        @keyframes sup-float { 0%,100%{transform:translateY(0);opacity:.5} 50%{transform:translateY(-16px);opacity:.85} }
        .sup-inp:focus { border-color: rgba(59,130,246,0.55) !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important; }
      `}</style>

      {/* Orbs */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-8%', left:'-5%', width:'42%', height:'42%', borderRadius:'50%', background:T.orb1, filter:'blur(80px)', animation:'sup-orb 9s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:'-8%', right:'-5%', width:'38%', height:'38%', borderRadius:'50%', background:T.orb2, filter:'blur(80px)', animation:'sup-orb 12s ease-in-out infinite reverse' }} />
      </div>

      {/* Particles */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        {PARTICLES.map((p, i) => (
          <div key={i} style={{ position:'absolute', left:`${p.x}%`, top:`${p.y}%`, width:p.size, height:p.size, borderRadius:'50%', background:T.particle, animation:`sup-float ${p.dur}s ${p.delay}s ease-in-out infinite` }} />
        ))}
      </div>

      {/* Step progress */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24, position:'relative', zIndex:1 }}>
        {['Business Info', 'Verification'].map((label, idx) => {
          const isActive = step === idx;
          const isDone = step > idx;
          return (
            <React.Fragment key={label}>
              {idx > 0 && <div style={{ width:36, height:1, background: isDone ? T.stepDone : T.divider, transition:'background 0.4s' }} />}
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background: isDone?T.stepDone:isActive?T.stepActive:T.stepIdle, color:(isActive||isDone)?'#fff':T.sub, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, transition:'all 0.3s', flexShrink:0 }}>
                  {isDone ? '✓' : idx+1}
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:isActive?T.heading:T.sub, transition:'color 0.3s', whiteSpace:'nowrap' }}>{label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Card */}
      <div style={{ width:'100%', maxWidth: step === 1 ? 560 : 520, background:T.cardBg, border:`1px solid ${T.cardBorder}`, borderRadius:20, backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', padding:'32px 36px', position:'relative', zIndex:1, boxShadow: isDark?'0 28px 80px rgba(0,0,0,0.65)':'0 28px 80px rgba(0,0,0,0.10)', transition:'max-width 0.35s ease' }}>
        <AnimatePresence mode="wait">

          {/* ── STEP 0: Business info ─────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity:0, x:-18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:18 }} transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <div style={{ width:44, height:44, borderRadius:13, background:'rgba(59,130,246,0.14)', border:'1.5px solid rgba(59,130,246,0.28)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Store size={22} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:T.heading, lineHeight:1.2 }}>Business Setup</h2>
                  <p style={{ margin:0, marginTop:3, fontSize:12, color:T.sub }}>Tell us about your store — this takes 30 seconds</p>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={lbl}>Store Name <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <Building2 size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.store_name} onChange={e => upd('store_name', e.target.value)} placeholder="e.g. OsaTech Retail Shop" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Owner Name <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <User size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.owner_full_name} onChange={e => upd('owner_full_name', e.target.value)} placeholder="Full name" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Mobile Number <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <Phone size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.store_phone} onChange={e => upd('store_phone', e.target.value)} placeholder="+92 300 1234567" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Email <span style={{ opacity:.4, fontSize:9 }}>Optional</span></label>
                  <div style={{ position:'relative' }}>
                    <Mail size={15} style={ico} />
                    <input className="sup-inp" style={inp} type="email" value={form.owner_email} onChange={e => upd('owner_email', e.target.value)} placeholder="owner@example.com" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Address <span style={{ opacity:.4, fontSize:9 }}>Optional</span></label>
                  <div style={{ position:'relative' }}>
                    <MapPin size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.store_address} onChange={e => upd('store_address', e.target.value)} placeholder="Shop address, city" />
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleNext}
                style={{ marginTop:22, width:'100%', height:46, background:'linear-gradient(135deg,#3b82f6,#6366f1)', border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                onMouseEnter={e => (e.currentTarget.style.opacity='0.87')}
                onMouseLeave={e => (e.currentTarget.style.opacity='1')}
              >
                Continue to Verification <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ── STEP 1: Verification ──────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }} transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}>

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
                <div style={{ width:44, height:44, borderRadius:13, background:'rgba(99,102,241,0.13)', border:'1.5px solid rgba(99,102,241,0.28)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <ShieldCheck size={22} color="#6366f1" />
                </div>
                <div>
                  <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:T.heading, lineHeight:1.2 }}>Verification</h2>
                  <p style={{ margin:0, marginTop:3, fontSize:12, color:T.sub }}>Choose how to verify your license</p>
                </div>
              </div>

              {/* ── Two method cards ───────────────────────────────────── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>

                {/* Online — coming soon */}
                <div style={{ padding:'14px 16px', borderRadius:13, background:T.methodDisabledBg, border:`1px solid ${T.methodDisabledBorder}`, opacity:0.5, cursor:'not-allowed', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:7, right:8, fontSize:8, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', background:'rgba(245,158,11,0.2)', color:'#f59e0b', borderRadius:4, padding:'2px 6px' }}>
                    Coming Soon
                  </div>
                  <div style={{ width:34, height:34, borderRadius:10, background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.20)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                    <Wifi size={17} color="#3b82f6" />
                  </div>
                  <p style={{ margin:0, fontSize:12, fontWeight:700, color:T.heading }}>Online Verify</p>
                  <p style={{ margin:'4px 0 0', fontSize:11, color:T.sub, lineHeight:1.4 }}>Auto-submit your details for instant activation</p>
                </div>

                {/* Offline — active */}
                <div style={{ padding:'14px 16px', borderRadius:13, background:T.methodActiveBg, border:`1.5px solid ${T.methodActiveBorder}`, cursor:'default', position:'relative' }}>
                  {/* Active indicator */}
                  <div style={{ position:'absolute', top:7, right:8, fontSize:8, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', background:'rgba(59,130,246,0.18)', color:'#3b82f6', borderRadius:4, padding:'2px 6px', display:'flex', alignItems:'center', gap:3 }}>
                    <CheckCircle2 size={9} /> Selected
                  </div>
                  <div style={{ width:34, height:34, borderRadius:10, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                    <WifiOff size={17} color="#6366f1" />
                  </div>
                  <p style={{ margin:0, fontSize:12, fontWeight:700, color:T.heading }}>Offline Verify</p>
                  <p style={{ margin:'4px 0 0', fontSize:11, color:T.sub, lineHeight:1.4 }}>Share fingerprint with developer to get a key</p>
                </div>
              </div>

              {/* ── Divider ────────────────────────────────────────────── */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                <div style={{ flex:1, height:1, background:T.divider }} />
                <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:T.sub }}>Offline Verification Steps</span>
                <div style={{ flex:1, height:1, background:T.divider }} />
              </div>

              {/* ── Step 1: Device fingerprint ─────────────────────────── */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(99,102,241,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:10, fontWeight:800, color:'#6366f1' }}>1</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:T.heading }}>Copy your device fingerprint</span>
                </div>
                <div style={{ padding:'12px 14px', borderRadius:11, background:T.fpBg, border:`1px solid ${T.fpBorder}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                    <Fingerprint size={13} color="#6366f1" />
                    <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.12em', color:T.sub }}>Your Device Fingerprint</span>
                  </div>
                  <p style={{ fontFamily:'monospace', fontSize:11, color:T.inputText, opacity:0.85, wordBreak:'break-all', lineHeight:1.6, margin:'0 0 10px', userSelect:'all' }}>
                    {fingerprint || 'Loading...'}
                  </p>
                  <button type="button" onClick={copyFp} disabled={!fingerprint}
                    style={{ fontSize:10, fontWeight:700, color:fpCopied?'#10b981':'#6366f1', background:'transparent', border:`1px solid ${fpCopied?'rgba(16,185,129,0.35)':'rgba(99,102,241,0.35)'}`, borderRadius:7, padding:'3px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                    {fpCopied ? <><CheckCircle2 size={11} />Copied!</> : <><Copy size={11} />Copy Fingerprint</>}
                  </button>
                </div>
              </div>

              {/* ── Step 2: Send to developer ──────────────────────────── */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(37,211,102,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:10, fontWeight:800, color:'#25d366' }}>2</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:T.heading }}>Send fingerprint to the developer</span>
                </div>
                <div style={{ padding:'12px 14px', borderRadius:11, background:T.waBg, border:`1px solid ${T.waBorder}`, display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(37,211,102,0.18)', border:'1px solid rgba(37,211,102,0.30)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <MessageCircle size={18} color="#25d366" />
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:11, color:T.sub, lineHeight:1.5 }}>
                      Send the fingerprint above via <strong style={{ color:T.heading }}>WhatsApp or call</strong> to:
                    </p>
                    <p style={{ margin:'4px 0 0', fontSize:15, fontWeight:800, color:'#25d366', letterSpacing:'0.04em', fontFamily:'monospace' }}>
                      {DEV_WHATSAPP}
                    </p>
                    <p style={{ margin:'3px 0 0', fontSize:10, color:T.sub, opacity:0.8 }}>
                      The developer will generate a license key tied to your device.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Step 3: Paste the key ──────────────────────────────── */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(16,185,129,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:10, fontWeight:800, color:'#10b981' }}>3</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:T.heading }}>Paste the license key you receive</span>
                </div>
                <div style={{ position:'relative' }}>
                  <Key size={14} style={{ ...ico, top:'50%' }} />
                  <input className="sup-inp" style={{ ...inp, fontFamily:'monospace', fontSize:12 }}
                    value={activationKey} onChange={e => setActivationKey(e.target.value)}
                    placeholder="Paste your license key here..." />
                </div>
              </div>

              {/* ── Action buttons ─────────────────────────────────────── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <button type="button" onClick={() => handleComplete(false)} disabled={saving}
                  style={{ height:44, background:T.skipBg, border:`1px solid ${T.skipBorder}`, borderRadius:12, color:T.heading, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, opacity:saving?0.5:1 }}>
                  Skip — Start Offline
                </button>
                <button type="button" onClick={() => handleComplete(true)} disabled={saving || !activationKey.trim()}
                  style={{ height:44, background:(saving||!activationKey.trim())?'rgba(16,185,129,0.25)':'linear-gradient(135deg,#10b981,#3b82f6)', border:'none', borderRadius:12, color:'#fff', fontSize:12, fontWeight:700, cursor:(saving||!activationKey.trim())?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  {saving
                    ? <><Loader2 size={14} className="animate-spin" />Saving...</>
                    : <><ShieldCheck size={14} />Activate & Start</>}
                </button>
              </div>

              <button type="button" onClick={() => setStep(0)}
                style={{ marginTop:14, width:'100%', background:'transparent', border:'none', color:T.backBtn, fontSize:12, cursor:'pointer', padding:'6px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                ← Back to business info
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <p style={{ marginTop:20, fontSize:11, color:T.sub, opacity:0.5, position:'relative', zIndex:1 }}>
        OsaTech POS v1.0 · Offline use is always free · License unlocks cloud features
      </p>
    </div>
  );
}

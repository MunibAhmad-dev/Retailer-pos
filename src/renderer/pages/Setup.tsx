import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2, Mail, MapPin, Phone, ShieldCheck, User,
  Store, Key, Loader2, CheckCircle2, ArrowRight,
  Fingerprint, Copy, Wifi, WifiOff, MessageCircle, Send,
  Clock, RefreshCw, ArrowLeft, GitBranch,
} from 'lucide-react';
import { useNotifications } from '../components/NotificationProvider';
import { submitRegistration, checkApprovalStatus } from '../services/api/authApi';

const DEFAULT_BACKEND_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUD_BACKEND_URL) ||
  'http://localhost:4000';

interface SetupProps { onComplete: () => void; }

/* ── theme tokens ──────────────────────────────────────────────── */
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
  stepDone: '#10b981', stepActive: '#3b82f6', stepIdle: 'rgba(255,255,255,0.10)',
  backBtn: 'rgba(255,255,255,0.32)',
  skipBg: 'rgba(255,255,255,0.07)', skipBorder: 'rgba(255,255,255,0.13)',
  fpBg: 'rgba(99,102,241,0.08)', fpBorder: 'rgba(99,102,241,0.22)',
  waBg: 'rgba(37,211,102,0.10)', waBorder: 'rgba(37,211,102,0.25)',
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
  stepDone: '#10b981', stepActive: '#3b82f6', stepIdle: 'rgba(0,0,0,0.08)',
  backBtn: 'rgba(15,23,42,0.36)',
  skipBg: 'rgba(0,0,0,0.04)', skipBorder: 'rgba(0,0,0,0.12)',
  fpBg: 'rgba(99,102,241,0.06)', fpBorder: 'rgba(99,102,241,0.20)',
  waBg: 'rgba(37,211,102,0.08)', waBorder: 'rgba(37,211,102,0.22)',
  particle: 'rgba(59,130,246,0.45)',
  methodActiveBg: 'rgba(59,130,246,0.08)', methodActiveBorder: 'rgba(59,130,246,0.32)',
  methodIdleBg: 'rgba(0,0,0,0.02)', methodIdleBorder: 'rgba(0,0,0,0.10)',
};

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 41 + 7) % 100, y: (i * 29 + 13) % 100,
  size: 1.5 + ((i * 17) % 3),
  delay: (i * 0.22) % 4, dur: 3 + ((i * 0.41) % 4),
}));

const DEV_WHATSAPP = '+923298748232';

// ── phase: 'setup' = steps 0-1, 'waiting' = polling screen, 'approved' = done ──
type Phase = 'setup' | 'waiting' | 'approved';
// ── mode: landing choice, new registration, or returning sign-in ──
type Mode = 'choose' | 'new' | 'existing';

export default function Setup({ onComplete }: SetupProps) {
  const [mode, setMode]           = useState<Mode>('choose');
  const [step, setStep]           = useState<0 | 1>(0);
  const [phase, setPhase]         = useState<Phase>('setup');
  const [isDark, setIsDark]       = useState(() => document.documentElement.classList.contains('dark'));
  const [fingerprint, setFp]      = useState('');
  const [fpCopied, setFpCopied]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [activationKey, setActKey]= useState('');
  const [verificationMethod, setMethod] = useState<'online' | 'offline' | null>(null);
  const [signInMobile, setSignInMobile] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);

  // waiting-phase state
  const [regMobile, setRegMobile]   = useState('');
  const [regApiKey, setRegApiKey]   = useState('');
  const [pollCount, setPollCount]   = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [pollError, setPollError]   = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState({
    store_name: '', owner_full_name: '', store_phone: '',
    owner_email: '', store_address: '', branch_name: 'Main Branch',
  });
  // UUID returned by register-business — used for polling (multi-branch safe)
  const [cloudInstanceId, setCloudInstanceId] = useState('');
  const { addNotification } = useNotifications();

  /* ── dark-mode observer ─────────────────────────────────────── */
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.api?.getFingerprint?.().then((res: any) => {
      if (res?.success && res.data) setFp(res.data);
    });
    return () => obs.disconnect();
  }, []);

  /* ── approval polling ───────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'waiting' || !regMobile) return;

    const poll = async () => {
      try {
        // Use UUID instance_id when available (new multi-branch flow), else fall back to mobile
        const result = await checkApprovalStatus(regMobile, DEFAULT_BACKEND_URL, cloudInstanceId || undefined);
        setLastChecked(new Date());
        setPollCount(c => c + 1);
        setPollError('');

        if (result.status === 'approved') {
          // Activate cloud-issued license key locally so Subscription page shows countdown
          if (result.licenseKey) {
            await window.api.activateAppV2(result.licenseKey).catch(() => {});
            await window.api.updateSettings({ activation_key: result.licenseKey } as any);
          }
          // Save approval status + api_key locally
          await window.api.updateSettings({
            approval_status: 'approved',
            cloud_backend_token: regApiKey || '',
            cloud_connected: 1,
          } as any);
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('approved');
          // Brief "approved" flash, then complete
          setTimeout(() => onComplete(), 2000);
        }
      } catch {
        setPollCount(c => c + 1);
        setPollError('Could not reach server — will retry automatically.');
      }
    };

    poll(); // immediate first check
    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, regMobile, regApiKey, cloudInstanceId]);

  /* ── offline auto-push: when internet becomes available, register ─ */
  useEffect(() => {
    const tryPush = async () => {
      if (!navigator.onLine) return;
      const settingsRes = await window.api.getSettings().catch(() => null);
      const s = settingsRes?.data;
      // Only auto-push if setup done, license_mode is offline but cloud_backend_url set
      // and NOT already registered (no cloud_backend_token)
      if (!s?.setup_completed || s.cloud_backend_token || !s.cloud_backend_url) return;
      if (!s.owner_mobile) return;
      try {
        const result = await submitRegistration({
          businessName: s.store_name || '',
          ownerName: s.owner_full_name || '',
          mobile: s.owner_mobile,
          email: s.owner_email || undefined,
          address: s.store_address || undefined,
        }, s.cloud_backend_url);
        if (result.success && result.api_key) {
          await window.api.updateSettings({
            cloud_backend_token: result.api_key,
            approval_status: result.approval_status || 'pending',
            cloud_connected: 1,
          } as any);
        }
      } catch { /* silent — will retry on next online event */ }
    };
    window.addEventListener('online', tryPush);
    return () => window.removeEventListener('online', tryPush);
  }, []);

  const T = isDark ? dark : light;
  const upd = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  /* ── step 0 → 1 ─────────────────────────────────────────────── */
  const handleNext = () => {
    if (!form.store_name.trim() || !form.owner_full_name.trim() || !form.store_phone.trim()) {
      addNotification('Missing Details', 'Store name, owner name, and mobile are required.', 'warning');
      return;
    }
    setStep(1);
  };

  /* ── Online: register → waiting screen ─────────────────────── */
  const handleOnlineSubmit = async () => {
    setSaving(true);
    try {
      const mobile = form.store_phone.trim();
      const backendUrl = DEFAULT_BACKEND_URL;

      // 1. Save settings locally
      await window.api.updateSettings({
        store_name:     form.store_name.trim(),
        business_name:  form.store_name.trim(),
        owner_full_name:form.owner_full_name.trim(),
        store_phone:    mobile,
        owner_mobile:   mobile,
        owner_email:    form.owner_email.trim(),
        store_address:  form.store_address.trim(),
        branch_name:    form.branch_name.trim() || 'Main Branch',
        license_mode:   'online',
        approval_status:'pending',
        cloud_backend_url: backendUrl,
        setup_completed: true,
      } as any);

      // 2. POST to backend (include fingerprint + branch_name)
      try {
        const result = await submitRegistration({
          businessName: form.store_name.trim(),
          ownerName:    form.owner_full_name.trim(),
          mobile,
          email:        form.owner_email.trim() || undefined,
          address:      form.store_address.trim() || undefined,
          fingerprint:  fingerprint || undefined,
          branchName:   form.branch_name.trim() || 'Main Branch',
        }, backendUrl);

        // 3. Store api_key + instance_id (UUID) for multi-branch polling
        if (result.api_key) {
          await window.api.updateSettings({
            cloud_backend_token: result.api_key,
            cloud_instance_id:   result.instance_id || mobile,
            cloud_connected: 1,
          } as any);
          setRegApiKey(result.api_key);
          if (result.instance_id) setCloudInstanceId(result.instance_id);
        }
      } catch {
        addNotification('Offline', 'Could not reach server — will auto-register when connected.', 'warning');
      }

      // 4. Show waiting screen and start polling
      setRegMobile(mobile);
      setPollCount(0);
      setLastChecked(null);
      setPollError('');
      setPhase('waiting');
    } catch (err: any) {
      addNotification('Setup Failed', err?.message || 'Could not save setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Switch from waiting back to offline ───────────────────── */
  const handleSwitchToOffline = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('setup');
    setMode('new');
    setStep(1);
    setMethod('offline');
  };

  /* ── Offline: activate with license key (required) ─────────── */
  const handleComplete = async () => {
    const key = activationKey.trim();
    if (!key) {
      addNotification('License Required', 'Please enter your license key to continue.', 'warning');
      return;
    }
    setSaving(true);
    try {
      // Validate key first
      const lic = await window.api.activateAppV2(key);
      if (!lic.success) {
        addNotification('Key Invalid', lic.error || 'License key not recognised. Contact OsaTech.', 'error');
        return;
      }

      await window.api.updateSettings({
        store_name:     form.store_name.trim(),
        business_name:  form.store_name.trim(),
        owner_full_name:form.owner_full_name.trim(),
        store_phone:    form.store_phone.trim(),
        owner_mobile:   form.store_phone.trim(),
        owner_email:    form.owner_email.trim(),
        store_address:  form.store_address.trim(),
        activation_key: key,
        license_mode:   'offline',
        approval_status:'approved',
        cloud_backend_url: DEFAULT_BACKEND_URL,
        setup_completed: true,
      } as any);

      addNotification('Activated!', 'License key accepted. Welcome to OsaTech POS.', 'success');
      onComplete();
    } catch (err: any) {
      addNotification('Setup Failed', err?.message || 'Could not complete setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Sign-in: returning user ────────────────────────────────── */
  const handleSignIn = async () => {
    const mobile = signInMobile.trim();
    if (!mobile) {
      addNotification('Mobile Required', 'Enter the mobile number you registered with.', 'warning');
      return;
    }
    setSignInLoading(true);
    try {
      // Mark setup as started (idempotent — won't break fresh installs)
      await window.api.updateSettings({
        store_phone: mobile, owner_mobile: mobile,
        license_mode: 'online', approval_status: 'pending',
        cloud_backend_url: DEFAULT_BACKEND_URL,
        setup_completed: true,
      } as any);

      try {
        const result = await submitRegistration({
          businessName: 'Restored Shop',
          ownerName: 'Owner',
          mobile,
          fingerprint: fingerprint || undefined,
        }, DEFAULT_BACKEND_URL);

        if (result.api_key) {
          await window.api.updateSettings({
            cloud_backend_token: result.api_key,
            cloud_instance_id: result.instance_id || mobile,
            cloud_connected: 1,
          } as any);
          setRegApiKey(result.api_key);
          if (result.instance_id) setCloudInstanceId(result.instance_id);
        }

        // Already approved — finish immediately
        if (result.approval_status === 'approved') {
          if (result.licenseKey) {
            await window.api.activateAppV2(result.licenseKey).catch(() => {});
            await window.api.updateSettings({ activation_key: result.licenseKey } as any);
          }
          await window.api.updateSettings({ approval_status: 'approved' } as any);
          addNotification('Welcome Back!', 'Your account has been restored.', 'success');
          setTimeout(() => onComplete(), 1200);
          return;
        }
      } catch {
        addNotification('Offline', 'Could not reach server. Try again when connected.', 'warning');
        setSignInLoading(false);
        return;
      }

      // Go to waiting screen (will poll every 5 s)
      setRegMobile(mobile);
      setPollCount(0);
      setLastChecked(null);
      setPollError('');
      setPhase('waiting');
    } catch (err: any) {
      addNotification('Error', err?.message || 'Sign-in failed.', 'error');
    } finally {
      setSignInLoading(false);
    }
  };

  const copyFp = async () => {
    if (!fingerprint) return;
    await navigator.clipboard.writeText(fingerprint);
    setFpCopied(true);
    setTimeout(() => setFpCopied(false), 2500);
  };

  /* ── shared styles ──────────────────────────────────────────── */
  const inp: React.CSSProperties = {
    width:'100%', height:42, paddingLeft:38, paddingRight:12,
    background:T.inputBg, border:`1px solid ${T.inputBorder}`,
    borderRadius:10, color:T.inputText, fontSize:13,
    outline:'none', fontFamily:'inherit', transition:'border-color 0.2s',
    boxSizing:'border-box',
  };
  const lbl: React.CSSProperties = {
    display:'block', fontSize:10, fontWeight:700, letterSpacing:'0.09em',
    textTransform:'uppercase', color:T.labelCol, marginBottom:6,
  };
  const ico: React.CSSProperties = {
    position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
    color:T.sub, pointerEvents:'none',
  };

  /* ── step indicators (only for new-shop setup flow) ─────────── */
  const showSteps = mode === 'new' && phase === 'setup';

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:T.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, minHeight:'100vh', overflowY:'auto' }}>
      <style>{`
        @keyframes sup-orb   { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.1) translate(16px,-10px)} }
        @keyframes sup-float { 0%,100%{transform:translateY(0);opacity:.5} 50%{transform:translateY(-16px);opacity:.85} }
        @keyframes sup-pulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
        @keyframes sup-spin  { to{transform:rotate(360deg)} }
        .sup-inp:focus { border-color:rgba(59,130,246,0.55)!important; box-shadow:0 0 0 3px rgba(59,130,246,0.12)!important; }
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

      {/* Step progress — only during setup phase */}
      {showSteps && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24, position:'relative', zIndex:1 }}>
          {['Business Info','Verification'].map((label, idx) => {
            const isActive = step === idx, isDone = step > idx;
            return (
              <React.Fragment key={label}>
                {idx > 0 && <div style={{ width:36, height:1, background:isDone?T.stepDone:T.divider, transition:'background 0.4s' }} />}
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:isDone?T.stepDone:isActive?T.stepActive:T.stepIdle, color:(isActive||isDone)?'#fff':T.sub, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, transition:'all 0.3s', flexShrink:0 }}>
                    {isDone ? '✓' : idx+1}
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color:isActive?T.heading:T.sub, transition:'color 0.3s', whiteSpace:'nowrap' }}>{label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Card */}
      <div style={{ width:'100%', maxWidth: mode === 'choose' ? 560 : (phase !== 'setup' || step === 1) ? 560 : 520, background:T.cardBg, border:`1px solid ${T.cardBorder}`, borderRadius:20, backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', padding:'32px 36px', position:'relative', zIndex:1, boxShadow:isDark?'0 28px 80px rgba(0,0,0,0.65)':'0 28px 80px rgba(0,0,0,0.10)', transition:'max-width 0.35s ease' }}>
        <AnimatePresence mode="wait">

          {/* ══ CHOOSE SCREEN ═══════════════════════════════════════ */}
          {mode === 'choose' && (
            <motion.div key="choose"
              initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.97 }}
              transition={{ duration:0.3, ease:[0.22,1,0.36,1] }}>

              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28 }}>
                <div style={{ width:52, height:52, borderRadius:15, background:'rgba(59,130,246,0.12)', border:'1.5px solid rgba(59,130,246,0.25)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <Store size={26} color="#3b82f6" />
                </div>
                <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:T.heading, textAlign:'center' }}>Welcome to OsaTech POS</h2>
                <p style={{ margin:'6px 0 0', fontSize:12, color:T.sub, textAlign:'center', lineHeight:1.6, maxWidth:320 }}>
                  New setup? Register your shop in 2 minutes.<br />Already registered? Sign in to restore access.
                </p>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                {/* New Shop */}
                <button type="button" onClick={() => setMode('new')}
                  style={{ padding:'20px 18px', borderRadius:16, background:'linear-gradient(145deg,rgba(59,130,246,0.10),rgba(59,130,246,0.05))', border:'1.5px solid rgba(59,130,246,0.30)', cursor:'pointer', textAlign:'left', transition:'all 0.2s', display:'flex', flexDirection:'column', gap:10 }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(59,130,246,0.55)')} onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(59,130,246,0.30)')}>
                  <div style={{ width:38, height:38, borderRadius:11, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Store size={18} color="#3b82f6" />
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:13, fontWeight:800, color:T.heading }}>New Shop</p>
                    <p style={{ margin:'4px 0 0', fontSize:11, color:T.sub, lineHeight:1.45 }}>First-time setup.<br />Register your business.</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:'#3b82f6', marginTop:2 }}>
                    Get started <ArrowRight size={11} />
                  </div>
                </button>

                {/* Sign In */}
                <button type="button" onClick={() => setMode('existing')}
                  style={{ padding:'20px 18px', borderRadius:16, background:'linear-gradient(145deg,rgba(16,185,129,0.10),rgba(16,185,129,0.05))', border:'1.5px solid rgba(16,185,129,0.28)', cursor:'pointer', textAlign:'left', transition:'all 0.2s', display:'flex', flexDirection:'column', gap:10 }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(16,185,129,0.55)')} onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(16,185,129,0.28)')}>
                  <div style={{ width:38, height:38, borderRadius:11, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <ShieldCheck size={18} color="#10b981" />
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:13, fontWeight:800, color:T.heading }}>Sign In</p>
                    <p style={{ margin:'4px 0 0', fontSize:11, color:T.sub, lineHeight:1.45 }}>Already registered.<br />Restore your account.</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:'#10b981', marginTop:2 }}>
                    Recover access <ArrowRight size={11} />
                  </div>
                </button>
              </div>

              <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:`1px solid ${T.cardBorder}`, display:'flex', alignItems:'center', gap:8 }}>
                <MessageCircle size={12} color={T.sub} style={{ flexShrink:0 }} />
                <p style={{ margin:0, fontSize:11, color:T.sub, lineHeight:1.5 }}>
                  Need help? WhatsApp <strong style={{ color:'#25d366' }}>{DEV_WHATSAPP}</strong>
                </p>
              </div>
            </motion.div>
          )}

          {/* ══ SIGN IN SCREEN ══════════════════════════════════════ */}
          {mode === 'existing' && phase === 'setup' && (
            <motion.div key="signin"
              initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }}
              transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}>

              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <div style={{ width:44, height:44, borderRadius:13, background:'rgba(16,185,129,0.12)', border:'1.5px solid rgba(16,185,129,0.28)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <ShieldCheck size={22} color="#10b981" />
                </div>
                <div>
                  <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:T.heading, lineHeight:1.2 }}>Sign In</h2>
                  <p style={{ margin:0, marginTop:3, fontSize:12, color:T.sub }}>Enter your registered mobile number to restore access</p>
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={lbl}>Registered Mobile <span style={{ color:'#ef4444' }}>*</span></label>
                <div style={{ position:'relative' }}>
                  <Phone size={15} style={ico} />
                  <input className="sup-inp" style={inp}
                    value={signInMobile} onChange={e=>setSignInMobile(e.target.value)}
                    placeholder="03001234567" />
                </div>
              </div>

              <div style={{ padding:'10px 13px', borderRadius:10, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.18)', marginBottom:18, display:'flex', alignItems:'flex-start', gap:8 }}>
                <CheckCircle2 size={13} color="#10b981" style={{ flexShrink:0, marginTop:1 }} />
                <p style={{ margin:0, fontSize:11, color:T.sub, lineHeight:1.5 }}>
                  We'll look up your account using your mobile number. If already approved, you'll be signed in immediately. Otherwise, you'll see the approval screen.
                </p>
              </div>

              <div style={{ padding:'9px 12px', borderRadius:9, background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.18)', marginBottom:18, display:'flex', alignItems:'flex-start', gap:7 }}>
                <Wifi size={13} color="#fbbf24" style={{ flexShrink:0, marginTop:1 }} />
                <p style={{ margin:0, fontSize:11, color:T.sub, lineHeight:1.5 }}>
                  <strong style={{ color:T.heading }}>Internet required.</strong> Your device must be online to restore access. For offline use, contact admin for a license key.
                </p>
              </div>

              <button type="button" onClick={handleSignIn} disabled={signInLoading || !signInMobile.trim()}
                style={{ width:'100%', height:46, background:(signInLoading||!signInMobile.trim())?'rgba(16,185,129,0.25)':'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:(signInLoading||!signInMobile.trim())?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {signInLoading ? <><Loader2 size={14} className="animate-spin" />Checking…</> : <><ShieldCheck size={14} />Restore Access</>}
              </button>

              <button type="button" onClick={() => setMode('choose')}
                style={{ marginTop:12, width:'100%', background:'transparent', border:'none', color:T.backBtn, fontSize:12, cursor:'pointer', padding:'6px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                ← Back to start
              </button>
            </motion.div>
          )}

          {/* ══ WAITING SCREEN ══════════════════════════════════════ */}
          {phase === 'waiting' && (
            <motion.div key="waiting"
              initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.96 }}
              transition={{ duration:0.3, ease:[0.22,1,0.36,1] }}>

              {/* Icon */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:24 }}>
                <div style={{ position:'relative', width:72, height:72, marginBottom:16 }}>
                  {/* Outer ring */}
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(59,130,246,0.25)' }} />
                  {/* Spinning arc */}
                  <div style={{ position:'absolute', inset:-2, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#3b82f6', animation:'sup-spin 1.2s linear infinite' }} />
                  <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'rgba(59,130,246,0.10)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Clock size={28} color="#3b82f6" />
                  </div>
                </div>
                <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:T.heading }}>
                  Waiting for Approval
                </h2>
                <p style={{ margin:'6px 0 0', fontSize:12, color:T.sub, textAlign:'center', lineHeight:1.5 }}>
                  Your registration has been submitted.<br />
                  The administrator will review and approve it shortly.
                </p>
              </div>

              {/* Store summary */}
              <div style={{ padding:'12px 15px', borderRadius:12, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.14)', marginBottom:16 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { label:'Store',    value: form.store_name || '—' },
                    { label:'Owner',    value: form.owner_full_name || '—' },
                    { label:'Mobile',   value: regMobile, mono:true, highlight:true },
                    { label:'Status',   value: 'Pending Approval', highlight:true },
                  ].map(({ label, value, mono, highlight }) => (
                    <div key={label}>
                      <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.09em', color:T.sub, display:'block', marginBottom:2 }}>{label}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:highlight?'#f59e0b':T.heading, fontFamily:mono?'monospace':'inherit' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Poll status */}
              <div style={{ padding:'10px 14px', borderRadius:10, background: pollError ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.04)', border:`1px solid ${pollError ? 'rgba(239,68,68,0.20)' : T.cardBorder}`, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
                <RefreshCw size={13} color={pollError ? '#f87171' : T.sub} style={{ flexShrink:0, animation: pollError ? 'none' : 'sup-spin 3s linear infinite' }} />
                <div>
                  {pollError
                    ? <p style={{ margin:0, fontSize:11, color:'#f87171' }}>{pollError}</p>
                    : <p style={{ margin:0, fontSize:11, color:T.sub }}>
                        Checking every 5 seconds…
                        {lastChecked && <span style={{ marginLeft:6, opacity:0.6 }}>Last: {lastChecked.toLocaleTimeString()}</span>}
                        {pollCount > 0 && <span style={{ marginLeft:6, opacity:0.5 }}>({pollCount} checks)</span>}
                      </p>
                  }
                </div>
              </div>

              {/* Switch to offline button */}
              <button type="button" onClick={handleSwitchToOffline}
                style={{ width:'100%', height:44, background:T.skipBg, border:`1px solid ${T.skipBorder}`, borderRadius:12, color:T.heading, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <ArrowLeft size={14} />
                Switch to Offline Mode Instead
              </button>

              <p style={{ marginTop:12, textAlign:'center', fontSize:11, color:T.sub, opacity:0.5 }}>
                You can close the app and come back — your registration is saved.
              </p>
            </motion.div>
          )}

          {/* ══ APPROVED SCREEN ═════════════════════════════════════ */}
          {phase === 'approved' && (
            <motion.div key="approved"
              initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.4, ease:[0.22,1,0.36,1] }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 0' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(16,185,129,0.12)', border:'2px solid rgba(16,185,129,0.3)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                  <CheckCircle2 size={38} color="#10b981" />
                </div>
                <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:700, color:'#10b981' }}>Approved!</h2>
                <p style={{ margin:0, fontSize:13, color:T.sub, textAlign:'center' }}>
                  Your POS is now activated. Starting up…
                </p>
              </div>
            </motion.div>
          )}

          {/* ══ STEP 0: Business info ════════════════════════════════ */}
          {mode === 'new' && phase === 'setup' && step === 0 && (
            <motion.div key="s0" initial={{ opacity:0, x:-18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:18 }} transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <div style={{ width:44, height:44, borderRadius:13, background:'rgba(59,130,246,0.14)', border:'1.5px solid rgba(59,130,246,0.28)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Store size={22} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:T.heading, lineHeight:1.2 }}>Business Setup</h2>
                  <p style={{ margin:0, marginTop:3, fontSize:12, color:T.sub }}>Tell us about your store — takes 30 seconds</p>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={lbl}>Store Name <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <Building2 size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.store_name} onChange={e=>upd('store_name',e.target.value)} placeholder="e.g. Ahmed Electronics" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Owner Name <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <User size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.owner_full_name} onChange={e=>upd('owner_full_name',e.target.value)} placeholder="Full name" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Mobile Number <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <Phone size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.store_phone} onChange={e=>upd('store_phone',e.target.value)} placeholder="03001234567" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Email <span style={{ opacity:.4, fontSize:9 }}>Optional</span></label>
                  <div style={{ position:'relative' }}>
                    <Mail size={15} style={ico} />
                    <input className="sup-inp" style={inp} type="email" value={form.owner_email} onChange={e=>upd('owner_email',e.target.value)} placeholder="owner@example.com" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Address <span style={{ opacity:.4, fontSize:9 }}>Optional</span></label>
                  <div style={{ position:'relative' }}>
                    <MapPin size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.store_address} onChange={e=>upd('store_address',e.target.value)} placeholder="Shop address, city" />
                  </div>
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={lbl}>Branch Name <span style={{ opacity:.4, fontSize:9 }}>e.g. Main Branch · Saddar Branch · Branch 2</span></label>
                  <div style={{ position:'relative' }}>
                    <GitBranch size={15} style={ico} />
                    <input className="sup-inp" style={inp} value={form.branch_name} onChange={e=>upd('branch_name',e.target.value)} placeholder="Main Branch" />
                  </div>
                  <p style={{ margin:'5px 0 0', fontSize:10, color:T.sub, opacity:0.65, paddingLeft:2 }}>
                    If you have multiple shops, give each a unique name. Same owner mobile links all branches in the admin.
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleNext}
                style={{ marginTop:22, width:'100%', height:46, background:'linear-gradient(135deg,#3b82f6,#6366f1)', border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                onMouseEnter={e=>(e.currentTarget.style.opacity='0.87')} onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
                Continue to Verification <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ══ STEP 1: Verification ════════════════════════════════ */}
          {mode === 'new' && phase === 'setup' && step === 1 && (
            <motion.div key="s1" initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }} transition={{ duration:0.28, ease:[0.22,1,0.36,1] }}>

              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
                <div style={{ width:44, height:44, borderRadius:13, background:'rgba(99,102,241,0.13)', border:'1.5px solid rgba(99,102,241,0.28)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <ShieldCheck size={22} color="#6366f1" />
                </div>
                <div>
                  <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:T.heading, lineHeight:1.2 }}>Verification</h2>
                  <p style={{ margin:0, marginTop:3, fontSize:12, color:T.sub }}>Choose how to activate your license</p>
                </div>
              </div>

              {/* Method cards */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                {([
                  { id:'online',  icon:Wifi,    iconColor:'#3b82f6', label:'Online Verify',  desc:'Submit details for admin approval' },
                  { id:'offline', icon:WifiOff, iconColor:'#6366f1', label:'Offline Key',     desc:'Paste a license key from admin' },
                ] as const).map(({ id, icon: Icon, iconColor, label, desc }) => (
                  <button key={id} type="button" onClick={() => setMethod(id)}
                    style={{ padding:'14px 16px', borderRadius:13, background:verificationMethod===id?T.methodActiveBg:T.methodIdleBg, border:`${verificationMethod===id?'1.5':'1'}px solid ${verificationMethod===id?T.methodActiveBorder:T.methodIdleBorder}`, cursor:'pointer', position:'relative', textAlign:'left', transition:'all 0.2s' }}>
                    {verificationMethod === id && (
                      <div style={{ position:'absolute', top:7, right:8, fontSize:8, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', background:'rgba(59,130,246,0.18)', color:'#3b82f6', borderRadius:4, padding:'2px 6px', display:'flex', alignItems:'center', gap:3 }}>
                        <CheckCircle2 size={9} /> Selected
                      </div>
                    )}
                    <div style={{ width:34, height:34, borderRadius:10, background: id==='online'?'rgba(59,130,246,0.10)':'rgba(99,102,241,0.12)', border:`1px solid ${id==='online'?'rgba(59,130,246,0.20)':'rgba(99,102,241,0.25)'}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                      <Icon size={17} color={iconColor} />
                    </div>
                    <p style={{ margin:0, fontSize:12, fontWeight:700, color:T.heading }}>{label}</p>
                    <p style={{ margin:'4px 0 0', fontSize:11, color:T.sub, lineHeight:1.4 }}>{desc}</p>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">

                {/* ── Online content ───────────────────────────────── */}
                {verificationMethod === 'online' && (
                  <motion.div key="online"
                    initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                    transition={{ duration:0.22 }}>

                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ flex:1, height:1, background:T.divider }} />
                      <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:T.sub }}>What will be submitted</span>
                      <div style={{ flex:1, height:1, background:T.divider }} />
                    </div>

                    <div style={{ padding:'12px 14px', borderRadius:11, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.14)', marginBottom:14 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        {[
                          { label:'Store',     value: form.store_name      || '—' },
                          { label:'Owner',     value: form.owner_full_name || '—' },
                          { label:'Mobile ID', value: form.store_phone     || '—', mono:true, highlight:true },
                          { label:'Email',     value: form.owner_email     || 'Not provided' },
                        ].map(({ label, value, mono, highlight }) => (
                          <div key={label}>
                            <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.09em', color:T.sub, display:'block', marginBottom:2 }}>{label}</span>
                            <span style={{ fontSize:12, fontWeight:600, color:highlight?'#10b981':T.heading, fontFamily:mono?'monospace':'inherit' }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding:'9px 12px', borderRadius:9, background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.18)', marginBottom:14, display:'flex', alignItems:'flex-start', gap:7 }}>
                      <MessageCircle size={13} color="#fbbf24" style={{ flexShrink:0, marginTop:1 }} />
                      <p style={{ margin:0, fontSize:11, color:T.sub, lineHeight:1.5 }}>
                        After submitting, a <strong style={{ color:T.heading }}>waiting screen</strong> appears and auto-checks every 5 seconds. The app unlocks once the admin approves you.
                      </p>
                    </div>

                    <button type="button" onClick={handleOnlineSubmit} disabled={saving}
                      style={{ width:'100%', height:46, background:saving?'rgba(59,130,246,0.3)':'linear-gradient(135deg,#3b82f6,#6366f1)', border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      {saving ? <><Loader2 size={14} className="animate-spin" />Submitting…</> : <><Send size={14} />Submit for Approval</>}
                    </button>
                  </motion.div>
                )}

                {/* ── Offline content ──────────────────────────────── */}
                {verificationMethod === 'offline' && (
                  <motion.div key="offline"
                    initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                    transition={{ duration:0.22 }}>

                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ flex:1, height:1, background:T.divider }} />
                      <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:T.sub }}>Offline Activation Steps</span>
                      <div style={{ flex:1, height:1, background:T.divider }} />
                    </div>

                    {/* Step 1: Contact */}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(37,211,102,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#25d366' }}>1</span>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:T.heading }}>Contact admin with your mobile number</span>
                      </div>
                      <div style={{ padding:'11px 13px', borderRadius:10, background:T.waBg, border:`1px solid ${T.waBorder}`, display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:32, height:32, borderRadius:9, background:'rgba(37,211,102,0.16)', border:'1px solid rgba(37,211,102,0.28)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <MessageCircle size={15} color="#25d366" />
                        </div>
                        <div>
                          <p style={{ margin:0, fontSize:11, color:T.sub }}>Your unique ID (mobile):</p>
                          <p style={{ margin:'3px 0 0', fontSize:14, fontWeight:800, color:'#25d366', fontFamily:'monospace' }}>
                            {form.store_phone || '(not entered)'}
                          </p>
                          <p style={{ margin:'2px 0 0', fontSize:10, color:T.sub, opacity:0.75 }}>Share with {DEV_WHATSAPP}</p>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Fingerprint */}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(99,102,241,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#6366f1' }}>2</span>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:T.heading }}>Share device fingerprint (optional)</span>
                      </div>
                      <div style={{ padding:'10px 13px', borderRadius:10, background:T.fpBg, border:`1px solid ${T.fpBorder}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                          <Fingerprint size={12} color="#6366f1" />
                          <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.12em', color:T.sub }}>Device Fingerprint</span>
                        </div>
                        <p style={{ fontFamily:'monospace', fontSize:10, color:T.inputText, opacity:0.8, wordBreak:'break-all', lineHeight:1.5, margin:'0 0 8px', userSelect:'all' }}>
                          {fingerprint || 'Loading…'}
                        </p>
                        <button type="button" onClick={copyFp} disabled={!fingerprint}
                          style={{ fontSize:10, fontWeight:700, color:fpCopied?'#10b981':'#6366f1', background:'transparent', border:`1px solid ${fpCopied?'rgba(16,185,129,0.35)':'rgba(99,102,241,0.35)'}`, borderRadius:6, padding:'3px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                          {fpCopied ? <><CheckCircle2 size={10} />Copied!</> : <><Copy size={10} />Copy</>}
                        </button>
                      </div>
                    </div>

                    {/* Step 3: Key */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(16,185,129,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#10b981' }}>3</span>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:T.heading }}>Paste the license key you receive</span>
                      </div>
                      <div style={{ position:'relative' }}>
                        <Key size={14} style={{ ...ico, top:'50%' }} />
                        <input className="sup-inp" style={{ ...inp, fontFamily:'monospace', fontSize:12 }}
                          value={activationKey} onChange={e=>setActKey(e.target.value)}
                          placeholder="Paste license key here…" />
                      </div>
                    </div>

                    {/* License required notice */}
                    <div style={{ padding:'9px 12px', borderRadius:9, background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.18)', marginBottom:14, display:'flex', alignItems:'flex-start', gap:7 }}>
                      <Key size={13} color="#fbbf24" style={{ flexShrink:0, marginTop:1 }} />
                      <p style={{ margin:0, fontSize:11, color:T.sub, lineHeight:1.5 }}>
                        A license key is <strong style={{ color:T.heading }}>required</strong> to use this POS. Don't have one yet?{' '}
                        Contact OsaTech at <strong style={{ color:'#25d366' }}>+923298748232</strong> (WhatsApp) with your mobile number and fingerprint.
                      </p>
                    </div>

                    <button type="button" onClick={handleComplete} disabled={saving || !activationKey.trim()}
                      style={{ width:'100%', height:46, background:(saving||!activationKey.trim())?'rgba(16,185,129,0.25)':'linear-gradient(135deg,#10b981,#3b82f6)', border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:(saving||!activationKey.trim())?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      {saving ? <><Loader2 size={14} className="animate-spin" />Activating…</> : <><ShieldCheck size={14} />Activate & Start</>}
                    </button>
                  </motion.div>
                )}

                {/* Nothing selected */}
                {verificationMethod === null && (
                  <motion.div key="pick" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.18 }}>
                    <p style={{ textAlign:'center', fontSize:12, color:T.sub, margin:'4px 0 12px', opacity:0.7 }}>
                      Select a verification method above to continue.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="button" onClick={() => setStep(0)}
                style={{ marginTop:14, width:'100%', background:'transparent', border:'none', color:T.backBtn, fontSize:12, cursor:'pointer', padding:'6px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                ← Back to business info
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <p style={{ marginTop:20, fontSize:11, color:T.sub, opacity:0.5, position:'relative', zIndex:1 }}>
        OsaTech POS v1.0 · A license is required · Contact +923298748232 for activation
      </p>
    </div>
  );
}

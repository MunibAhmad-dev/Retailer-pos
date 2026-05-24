import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, AlertCircle, Copy, KeyRound, CheckCircle2, Fingerprint } from 'lucide-react';
import { useNotifications } from '../components/NotificationProvider';

interface ActivationProps {
  onActivated: () => void;
}

/* deterministic particles — no Math.random() */
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 37 + 11) % 97, y: (i * 53 + 7) % 97,
  size: 1.5 + ((i * 19) % 3),
  delay: (i * 0.28) % 5, dur: 4 + ((i * 0.37) % 4),
  opacity: 0.15 + ((i * 0.07) % 0.35),
}));

const ORBS = [
  { top:'-12%', left:'-8%',  w:'42%', h:'42%', color:'rgba(59,130,246,0.22)',  dur:'9s'  },
  { top:'auto', left:'auto', bottom:'-12%', right:'-8%', w:'38%', h:'38%', color:'rgba(139,92,246,0.17)', dur:'12s' },
  { top:'30%',  left:'55%',  w:'25%', h:'25%', color:'rgba(6,182,212,0.12)',   dur:'14s' },
];

export default function Activation({ onActivated }: ActivationProps) {
  const [activationKey, setActivationKey] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [fpCopied, setFpCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* issuer panel (hidden dev tool) */
  const [issuerOpen, setIssuerOpen] = useState(false);
  const [issuedTo, setIssuedTo] = useState('');
  const [targetFingerprint, setTargetFingerprint] = useState('');
  const [durationValue, setDurationValue] = useState('30');
  const [durationUnit, setDurationUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('days');
  const [maxDevices, setMaxDevices] = useState('1');
  const [generatedKey, setGeneratedKey] = useState('');
  const [issuerError, setIssuerError] = useState<string | null>(null);

  const { addNotification } = useNotifications();

  useEffect(() => {
    window.api.getFingerprint().then((res: any) => {
      if (res.success && res.data) {
        setFingerprint(res.data);
        setTargetFingerprint(res.data);
      }
    });
    const off = typeof (window.api as any).onToggleLicenseIssuer === 'function'
      ? (window.api as any).onToggleLicenseIssuer(() => {
          setIssuerOpen(prev => !prev);
          setIssuerError(null);
        })
      : null;
    return () => { if (off) off(); };
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKey.trim()) return;
    setIsActivating(true);
    setError(null);
    try {
      const result = await window.api.activateAppV2(activationKey.trim());
      if (result.success) {
        addNotification('App Activated', 'Thank you for choosing our software!', 'success');
        onActivated();
      } else {
        setError(result.error || 'Invalid activation key');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during activation');
    } finally {
      setIsActivating(false);
    }
  };

  const handleCopyFingerprint = async () => {
    if (!fingerprint) return;
    await navigator.clipboard.writeText(fingerprint);
    setFpCopied(true);
    addNotification('Copied', 'Fingerprint copied to clipboard', 'success');
    setTimeout(() => setFpCopied(false), 2000);
  };

  const handleGenerateLicense = async () => {
    setIssuerError(null);
    setGeneratedKey('');
    try {
      const res = await window.api.generateLicenseKey({
        issuedTo, issuedForFingerprint: targetFingerprint.trim(),
        durationValue: Number(durationValue), durationUnit,
        maxDevices: Number(maxDevices),
      });
      if (!res.success || !res.data) { setIssuerError(res.error || 'Failed to generate'); return; }
      setGeneratedKey(res.data);
    } catch (e: any) {
      setIssuerError(e.message || 'Failed to generate license');
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflow:'hidden', background:'radial-gradient(ellipse at 28% 18%,#0a1628 0%,#060912 55%,#020408 100%)' }}>
      <style>{`
        @keyframes act-orb { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.08) translate(14px,-10px)} }
        @keyframes act-float { 0%,100%{transform:translateY(0);opacity:.5} 50%{transform:translateY(-14px);opacity:.9} }
        @keyframes act-scan { 0%{top:-4px} 100%{top:calc(100% + 4px)} }
        .act-key:focus { border-color: rgba(99,102,241,0.6) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important; }
      `}</style>

      {/* Orbs */}
      {ORBS.map((o, i) => (
        <div key={i} style={{ position:'fixed', top:o.top, left:o.left, bottom:(o as any).bottom, right:(o as any).right, width:o.w, height:o.h, borderRadius:'50%', background:o.color, filter:'blur(80px)', animation:`act-orb ${o.dur} ease-in-out infinite ${i%2===0?'':'reverse'}`, pointerEvents:'none' }} />
      ))}

      {/* Grid overlay */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(59,130,246,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.025) 1px,transparent 1px)', backgroundSize:'36px 36px', opacity:1 }} />

      {/* Particles */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        {PARTICLES.map((p, i) => (
          <div key={i} style={{ position:'absolute', left:`${p.x}%`, top:`${p.y}%`, width:p.size, height:p.size, borderRadius:'50%', background:`rgba(255,255,255,${p.opacity})`, animation:`act-float ${p.dur}s ${p.delay}s ease-in-out infinite` }} />
        ))}
      </div>

      {/* Main card */}
      <div style={{ width:'100%', maxWidth:440, position:'relative', zIndex:10, background:'linear-gradient(148deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.03) 100%)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:22, backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', boxShadow:'0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset', overflow:'hidden' }}>
        {/* Scan line */}
        <div style={{ position:'absolute', left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(59,130,246,0.5),transparent)', animation:'act-scan 4s linear infinite', pointerEvents:'none', zIndex:20 }} />

        <div style={{ padding:'36px 36px 32px' }}>
          {/* Logo mark */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28 }}>
            <div style={{ position:'relative', width:68, height:68 }}>
              <div style={{ width:68, height:68, borderRadius:18, background:'rgba(59,130,246,0.12)', border:'1.5px solid rgba(59,130,246,0.28)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ShieldCheck size={32} color="#3b82f6" />
              </div>
              {/* glow */}
              <div style={{ position:'absolute', inset:0, borderRadius:18, boxShadow:'0 0 32px 6px rgba(59,130,246,0.22)', pointerEvents:'none' }} />
            </div>
            <h1 style={{ margin:'16px 0 4px', fontSize:22, fontWeight:700, color:'rgba(255,255,255,0.95)', letterSpacing:'-0.02em' }}>
              License Activation
            </h1>
            <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,0.45)', textAlign:'center', lineHeight:1.5 }}>
              Copy your device fingerprint and send it to the developer.<br />Then paste the license key below.
            </p>
          </div>

          <form onSubmit={handleActivate} style={{ display:'flex', flexDirection:'column', gap:18 }}>
            {/* Fingerprint */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <Fingerprint size={13} color="#6366f1" />
                <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.12em', color:'rgba(255,255,255,0.45)' }}>
                  Device Fingerprint
                </span>
              </div>
              <div style={{ borderRadius:12, border:'1px solid rgba(99,102,241,0.22)', background:'rgba(99,102,241,0.07)', padding:'14px 16px', position:'relative', overflow:'hidden' }}>
                <p style={{ fontFamily:'monospace', fontSize:11.5, color:'rgba(255,255,255,0.82)', wordBreak:'break-all', lineHeight:1.65, margin:'0 0 12px', userSelect:'all' }}>
                  {fingerprint || 'Loading fingerprint...'}
                </p>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:9.5, color:'rgba(255,255,255,0.35)', fontStyle:'italic' }}>
                    Send to developer to receive a key
                  </span>
                  <button type="button" onClick={handleCopyFingerprint} disabled={!fingerprint} style={{ fontSize:10, fontWeight:700, color: fpCopied?'#10b981':'#6366f1', background:'transparent', border:`1px solid ${fpCopied?'rgba(16,185,129,0.35)':'rgba(99,102,241,0.35)'}`, borderRadius:7, padding:'3px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, transition:'all 0.2s' }}>
                    {fpCopied ? <><CheckCircle2 size={11} />Copied!</> : <><Copy size={11} />Copy</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Key input */}
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:6 }}>
                Activation Key
              </label>
              <input
                required
                className="act-key"
                value={activationKey}
                onChange={e => setActivationKey(e.target.value)}
                placeholder="Paste your encrypted license key"
                style={{ width:'100%', height:46, padding:'0 14px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, color:'rgba(255,255,255,0.88)', fontFamily:'monospace', fontSize:12, outline:'none', boxSizing:'border-box', transition:'border-color 0.2s, box-shadow 0.2s' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.22)', color:'rgba(255,100,100,0.95)', fontSize:12 }}>
                <AlertCircle size={15} style={{ flexShrink:0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isActivating || !activationKey.trim()}
              style={{ width:'100%', height:48, background: (isActivating||!activationKey.trim()) ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#3b82f6 0%,#6366f1 100%)', border:'none', borderRadius:14, color:'#fff', fontSize:15, fontWeight:700, cursor:(isActivating||!activationKey.trim())?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'opacity 0.15s', boxShadow: (!isActivating&&activationKey.trim()) ? '0 8px 24px rgba(59,130,246,0.3)' : 'none' }}
              onMouseEnter={e => { if (!isActivating && activationKey.trim()) e.currentTarget.style.opacity='0.88'; }}
              onMouseLeave={e => (e.currentTarget.style.opacity='1')}
            >
              {isActivating ? <><Loader2 size={18} className="animate-spin" />Verifying...</> : <>Activate Now<ArrowRight size={18} /></>}
            </button>
          </form>
        </div>
      </div>

      {/* Issuer modal (hidden dev tool) */}
      {issuerOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:120, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.65)', padding:20 }}>
          <div style={{ width:'100%', maxWidth:580, background:'#0d1117', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:'28px 32px', boxShadow:'0 32px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
              <KeyRound size={18} color="#6366f1" />
              <h3 style={{ margin:0, color:'rgba(255,255,255,0.9)', fontSize:15, fontWeight:700 }}>License Issuer</h3>
              <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:4 }}>Dev Tool</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { val:issuedTo, set:setIssuedTo, ph:'Business name (optional)', mono:false },
                { val:targetFingerprint, set:setTargetFingerprint, ph:'Target fingerprint', mono:true },
              ].map((f, i) => (
                <input key={i} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ width:'100%', height:38, padding:'0 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, color:'rgba(255,255,255,0.85)', fontSize: f.mono?11:13, fontFamily:f.mono?'monospace':'inherit', outline:'none', boxSizing:'border-box' }} />
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                <input value={durationValue} onChange={e => setDurationValue(e.target.value)} placeholder="Duration" style={{ height:38, padding:'0 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, color:'rgba(255,255,255,0.85)', fontSize:13, outline:'none', boxSizing:'border-box', width:'100%' }} />
                <select value={durationUnit} onChange={e => setDurationUnit(e.target.value as any)} style={{ height:38, padding:'0 10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, color:'rgba(255,255,255,0.85)', fontSize:13, outline:'none' }}>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
                <input value={maxDevices} onChange={e => setMaxDevices(e.target.value)} placeholder="Max devices" style={{ height:38, padding:'0 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, color:'rgba(255,255,255,0.85)', fontSize:13, outline:'none', boxSizing:'border-box', width:'100%' }} />
              </div>
              <button type="button" onClick={handleGenerateLicense} style={{ height:40, background:'linear-gradient(135deg,#6366f1,#3b82f6)', border:'none', borderRadius:9, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Generate License
              </button>
              {issuerError && <p style={{ margin:0, fontSize:12, color:'#f87171' }}>{issuerError}</p>}
              {generatedKey && (
                <textarea readOnly value={generatedKey} style={{ width:'100%', minHeight:100, padding:10, background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, color:'rgba(255,255,255,0.85)', fontFamily:'monospace', fontSize:11, resize:'vertical', outline:'none', boxSizing:'border-box' }} />
              )}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={() => setIssuerOpen(false)} style={{ height:36, padding:'0 20px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'rgba(255,255,255,0.7)', fontSize:13, cursor:'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

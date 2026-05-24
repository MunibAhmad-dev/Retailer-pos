import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, AlertCircle, Copy, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';

interface ActivationProps {
  onActivated: () => void;
}

export default function Activation({ onActivated }: ActivationProps) {
  const [activationKey, setActivationKey] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const loadFingerprint = async () => {
      const res = await window.api.getFingerprint();
      if (res.success && res.data) {
        setFingerprint(res.data);
        setTargetFingerprint(res.data);
      }
    };

    loadFingerprint();

    const off = typeof (window.api as any).onToggleLicenseIssuer === 'function'
      ? (window.api as any).onToggleLicenseIssuer(() => {
        setIssuerOpen((prev) => !prev);
        setIssuerError(null);
      })
      : null;

    return () => {
      if (off) off();
    };
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
    addNotification('Copied', 'Fingerprint copied to clipboard', 'success');
  };

  const handleGenerateLicense = async () => {
    setIssuerError(null);
    setGeneratedKey('');
    try {
      const res = await window.api.generateLicenseKey({
        issuedTo,
        issuedForFingerprint: targetFingerprint.trim(),
        durationValue: Number(durationValue),
        durationUnit,
        maxDevices: Number(maxDevices)
      });
      if (!res.success || !res.data) {
        setIssuerError(res.error || 'Failed to generate license');
        return;
      }
      setGeneratedKey(res.data);
    } catch (e: any) {
      setIssuerError(e.message || 'Failed to generate license');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />

      <Card className="w-full max-w-md bg-background/40 backdrop-blur-xl border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/20 p-4 rounded-2xl w-fit mb-4 border border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <ShieldCheck className="text-primary h-10 w-10" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-white">License Activation</CardTitle>
          <CardDescription className="text-slate-400 text-base mt-2">
            Copy this device fingerprint and send it to your license issuer. Then paste your encrypted license key.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleActivate}>
          <CardContent className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-200 ml-1 flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" />
                Device Fingerprint
              </label>
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-black/30 to-purple-900/20 p-4 backdrop-blur-sm shadow-inner">
                <p className="text-[10px] text-slate-400 mb-3 uppercase tracking-widest font-bold">Your unique device identifier</p>
                <div className="bg-black/40 rounded-lg p-3 border border-white/10 shadow-lg">
                  <p className="font-mono text-[13px] break-all text-slate-50 tracking-wider leading-relaxed select-all">{fingerprint || 'Loading fingerprint...'}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[10px] text-slate-500 italic">Send this to the developer to get your license key</p>
                  <Button type="button" variant="secondary" className="h-8 px-4 text-xs font-bold gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all active:scale-95" onClick={handleCopyFingerprint} disabled={!fingerprint}>
                    <Copy size={12} />
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 group">
              <label className="text-sm font-medium text-slate-300 ml-1">Activation Key</label>
              <Input
                required
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value)}
                placeholder="Paste encrypted license key"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-12 font-mono tracking-wider focus:ring-primary focus:border-primary transition-all rounded-xl"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in slide-in-from-top-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button
              type="submit"
              disabled={isActivating || !activationKey.trim()}
              className="w-full h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-xl active:scale-[0.98]"
            >
              {isActivating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Verifying License...
                </>
              ) : (
                <>
                  Activate Now
                  <ArrowRight size={20} />
                </>
              )}
            </Button>

          </CardFooter>
        </form>
      </Card>

      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 4 + 'px',
              height: Math.random() * 4 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animationDelay: Math.random() * 5 + 's',
              animationDuration: Math.random() * 5 + 5 + 's'
            }}
          />
        ))}
      </div>

      {issuerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-2xl bg-slate-950 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><KeyRound size={18} /> License Issuer</CardTitle>
              <CardDescription>Hidden tool. Generate a signed key for the provided fingerprint.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Business name (optional)" className="bg-white/5 border-white/10 text-white" />
              <Input value={targetFingerprint} onChange={(e) => setTargetFingerprint(e.target.value)} placeholder="Target fingerprint" className="bg-white/5 border-white/10 text-white font-mono text-xs" />
              <div className="grid grid-cols-3 gap-2">
                <Input value={durationValue} onChange={(e) => setDurationValue(e.target.value)} placeholder="Duration value" className="bg-white/5 border-white/10 text-white" />
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as 'days' | 'weeks' | 'months' | 'years')}
                  className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
                <Input value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} placeholder="Max devices (1-5)" className="bg-white/5 border-white/10 text-white" />
              </div>
              <Button type="button" onClick={handleGenerateLicense} className="w-full">Generate License</Button>
              {issuerError && <p className="text-sm text-red-400">{issuerError}</p>}
              {generatedKey && (
                <div className="space-y-2">
                  <label className="text-xs text-slate-300">Generated Key</label>
                  <textarea className="w-full min-h-[120px] rounded-md border border-white/10 bg-black/30 p-2 text-xs text-slate-100 font-mono" value={generatedKey} readOnly />
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="button" variant="secondary" onClick={() => setIssuerOpen(false)}>Close</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

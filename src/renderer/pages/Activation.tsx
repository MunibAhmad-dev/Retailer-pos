import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';

interface ActivationProps {
  onActivated: () => void;
}

export default function Activation({ onActivated }: ActivationProps) {
  const [businessName, setBusinessName] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !activationKey.trim()) return;

    setIsActivating(true);
    setError(null);

    try {
      const result = await window.api.activateApp({ businessName, activationKey });
      if (result.success) {
        addNotification("App Activated", "Thank you for choosing our software!", "success");
        onActivated();
      } else {
        setError(result.error || "Invalid activation key");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during activation");
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      
      <Card className="w-full max-w-md bg-background/40 backdrop-blur-xl border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/20 p-4 rounded-2xl w-fit mb-4 border border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <ShieldCheck className="text-primary h-10 w-10" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-white">License Activation</CardTitle>
          <CardDescription className="text-slate-400 text-base mt-2">
            Please enter your business details and activation key to unlock the POS system.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleActivate}>
          <CardContent className="space-y-5 pt-4">
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-slate-300 ml-1">Business Name</label>
              <Input
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Khan Restaurant"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-12 focus:ring-primary focus:border-primary transition-all rounded-xl"
              />
            </div>
            
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-slate-300 ml-1">Activation Key</label>
              <Input
                required
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value)}
                placeholder="XXXX-YYYY-ZZZZ"
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
              disabled={isActivating || !businessName.trim() || !activationKey.trim()}
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
            <p className="text-[10px] text-center text-slate-500 uppercase tracking-widest font-semibold">
              Trusted by 10,000+ businesses globally
            </p>
          </CardFooter>
        </form>
      </Card>
      
      {/* Floating particles or something subtle */}
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
    </div>
  );
}

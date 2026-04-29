import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Save, Upload, Store, Phone, MapPin, FileText, Lock, Mail, Image as ImageIcon, Database, Download, Trash2, ShieldCheck, Eye, EyeOff, Zap, Key, ShieldAlert, Clock, Calendar } from 'lucide-react';
import { useNotifications } from '../components/NotificationProvider';
import { subService, SubscriptionState } from '../services/subscription';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

export default function Subscription() {
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [inputBusinessName, setInputBusinessName] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const { addNotification } = useNotifications();

  const [timeLeft, setTimeLeft] = useState<string>('');
  useEffect(() => {
    loadSubscription();
    
    const timer = setInterval(() => {
      const state = subService.getState();
      if (state.expiryDate) {
        const diff = new Date(state.expiryDate).getTime() - Date.now();
        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${days}d ${hours}h ${mins}m ${secs}s`);
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
      if (settings.success && settings.data && settings.data.business_name) {
        setBusinessName(settings.data.business_name);
        setInputBusinessName(settings.data.business_name);
      }
    } catch (e) {
      console.error("Failed to load business name for subscription view");
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKey || !inputBusinessName) return;
    
    setIsActivating(true);
    try {
      const res = await window.api.activateApp({ businessName: inputBusinessName, activationKey });
      if (res.success) {
        addNotification("Subscription Renewed", "Your license key has been successfully applied.", "success");
        setActivationKey('');
        await loadSubscription();
      } else {
        addNotification("Activation Failed", res.error || "Invalid license key", "error");
      }
    } catch (err: any) {
      addNotification("Activation Error", err.message, "error");
    } finally {
      setIsActivating(false);
    }
  };

  if (!subState) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Subscription Management</h1>
        <p className="text-muted-foreground mt-2">Manage your license and activate premium features.</p>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { name: 'Weekly', days: 7, icon: <Zap size={20} className="text-yellow-600" />, color: 'bg-yellow-500/5 border-yellow-500/20' },
          { name: 'Monthly', days: 30, icon: <Clock size={20} className="text-blue-600" />, color: 'bg-blue-500/5 border-blue-500/20' },
          { name: 'Yearly', days: 365, icon: <Calendar size={20} className="text-purple-600" />, color: 'bg-purple-500/5 border-purple-500/20' },
          { name: 'Lifetime', days: '∞ Unlimited', icon: <ShieldCheck size={20} className="text-emerald-600" />, color: 'bg-emerald-500/5 border-emerald-500/20' },
        ].map(plan => (
          <div key={plan.name} className={cn("p-5 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all hover:shadow-md hover:-translate-y-1", plan.color)}>
             <div className="p-3 rounded-xl bg-white/80 shadow-sm mb-1">{plan.icon}</div>
             <h3 className="font-bold text-sm">{plan.name}</h3>
             <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{plan.days} {typeof plan.days === 'number' ? 'Days' : ''}</p>
          </div>
        ))}
      </div>

      {subState.plan !== 'lifetime' && subState.daysRemaining <= 5 && (
        <div className="bg-destructive border border-destructive rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top duration-500 shadow-xl shadow-destructive/20 text-white">
           <div className="flex items-center gap-4">
             <div className="bg-white/20 p-3 rounded-2xl text-white backdrop-blur-md shadow-inner animate-pulse">
               <ShieldAlert size={28} />
             </div>
             <div>
               <h3 className="text-xl font-black uppercase tracking-tight">Urgent: License Expiring</h3>
               <p className="text-white/80 text-sm font-medium mt-1">
                 Remaining Time: <span className="font-black text-white underline underline-offset-4 decoration-2">{timeLeft || `${subState.daysRemaining} days`}</span>
               </p>
             </div>
           </div>
           <div className="font-mono text-sm font-bold bg-black/20 px-4 py-2 rounded-lg border border-white/20 backdrop-blur-md">
             EXPIRES ON: {new Date(subState.expiryDate || 0).toLocaleDateString()}
           </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
        <p className="text-muted-foreground text-sm">Your Current Status</p>
        {businessName && (
          <Badge variant="secondary" className="px-4 py-1.5 text-sm font-bold bg-primary/10 text-primary border-primary/20">
            {businessName}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Card */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar size={20} className="text-muted-foreground" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-muted-foreground text-sm">Status</span>
              {subState.isActive && !subState.isGracePeriod && <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>}
              {subState.isGracePeriod && <Badge className="bg-amber-500 hover:bg-amber-600">Grace Period</Badge>}
              {subState.isExpired && !subState.isGracePeriod && <Badge variant="destructive">Expired</Badge>}
            </div>
            
            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-muted-foreground text-sm">Current Plan</span>
              <span className="font-medium capitalize">{subState.plan}</span>
            </div>

            <div className="flex items-center justify-between border-b pb-4">
              <span className="text-muted-foreground text-sm">Days Remaining</span>
              <span className={`text-2xl font-bold ${subState.daysRemaining <= 5 ? 'text-destructive' : 'text-primary'}`}>
                {subState.plan === 'lifetime' ? '∞' : Math.max(0, subState.daysRemaining)}
              </span>
            </div>

            {subState.expiryDate && subState.plan !== 'lifetime' && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground text-sm">Expiration Date</span>
                <span className="font-medium text-sm">
                  {new Date(subState.expiryDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renewal Card */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key size={20} className="text-muted-foreground" />
              Renew License
            </CardTitle>
            <CardDescription>Enter your new license key to add days to your subscription.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Business Name (must match license)"
                  value={inputBusinessName}
                  onChange={(e) => setInputBusinessName(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Paste license key here..."
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <Button type="submit" disabled={!activationKey || !inputBusinessName || isActivating} className="w-full">
                {isActivating ? 'Verifying...' : 'Apply License Key'}
              </Button>
            </form>

            <div className="mt-8 bg-muted/50 p-4 rounded-lg border text-sm space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert size={16} className="text-primary" />
                How renewals work
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                When you enter a new license key, the purchased days are <strong>added</strong> to your current remaining days. You will not lose any existing time if you renew early.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Card */}
      <Card className="border-border shadow-sm bg-primary/5 border-primary/20">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="bg-background p-4 rounded-full shadow-sm">
            <Mail size={32} className="text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold mb-1">Need a new license?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Contact the developer to purchase a new Weekly, Monthly, Yearly, Custom or Lifetime license.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <div className="inline-flex items-center gap-2 bg-background border px-4 py-2 rounded-md font-mono text-sm text-primary shadow-sm font-semibold select-all">
                munibahmad4735@gmail.com
              </div>
              <div className="inline-flex items-center gap-2 bg-background border px-4 py-2 rounded-md font-mono text-sm text-primary shadow-sm font-semibold select-all">
                032988748232
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

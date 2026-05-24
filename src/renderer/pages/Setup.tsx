import React, { useState } from 'react';
import { Building2, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useNotifications } from '../components/NotificationProvider';

interface SetupProps {
  onComplete: () => void;
}

// First-run setup stores business identity in local SQLite so the POS can work offline immediately.
export default function Setup({ onComplete }: SetupProps) {
  const [form, setForm] = useState({
    store_name: '',
    owner_full_name: '',
    store_phone: '',
    owner_email: '',
    store_address: '',
    activation_key: ''
  });
  const [saving, setSaving] = useState(false);
  const { addNotification } = useNotifications();

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  // Saves setup locally first. A license key can be applied, but it never blocks offline use.
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.store_name.trim() || !form.owner_full_name.trim() || !form.store_phone.trim()) {
      addNotification('Missing Details', 'Business name, owner name, and mobile number are required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        store_name: form.store_name.trim(),
        business_name: form.store_name.trim(),
        owner_full_name: form.owner_full_name.trim(),
        store_phone: form.store_phone.trim(),
        owner_mobile: form.store_phone.trim(),
        owner_email: form.owner_email.trim(),
        store_address: form.store_address.trim(),
        activation_key: form.activation_key.trim(),
        license_mode: form.activation_key.trim() ? 'online' : 'offline',
        setup_completed: true
      };

      const res = await window.api.updateSettings(payload as any);
      if (!res.success) throw new Error(res.error || 'Could not save setup');

      if (form.activation_key.trim()) {
        const licenseRes = await window.api.activateAppV2(form.activation_key.trim());
        if (!licenseRes.success) {
          addNotification('Offline Mode Enabled', licenseRes.error || 'License was not activated, but setup was saved for offline use.', 'warning');
        }
      }

      addNotification('Setup Complete', 'Your POS is ready to use.', 'success');
      onComplete();
    } catch (error: any) {
      addNotification('Setup Failed', error?.message || 'Could not complete setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="text-primary" /> Business Setup
          </CardTitle>
          <CardDescription>
            Enter your business details once. The POS stores them locally and works offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={form.store_name} onChange={(e) => update('store_name', e.target.value)} placeholder="Retail Shop" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={form.owner_full_name} onChange={(e) => update('owner_full_name', e.target.value)} placeholder="Owner full name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={form.store_phone} onChange={(e) => update('store_phone', e.target.value)} placeholder="+92 300 1234567" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" type="email" value={form.owner_email} onChange={(e) => update('owner_email', e.target.value)} placeholder="owner@example.com" />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Business Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={form.store_address} onChange={(e) => update('store_address', e.target.value)} placeholder="Shop address" />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>License Key (Optional)</Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={form.activation_key} onChange={(e) => update('activation_key', e.target.value)} placeholder="Leave empty for offline mode" />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="min-w-40">
                {saving ? 'Saving...' : 'Start POS'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

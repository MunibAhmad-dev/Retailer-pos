import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, Building2, CheckCircle2, Cloud, CloudOff,
  Database, Download, Eye, EyeOff, FileText, Globe, Image as ImageIcon,
  KeyRound, Loader2, Lock, Mail, MapPin, Phone, Printer,
  RefreshCw, Save, ShieldCheck, Store, Trash2, Upload, User,
  Zap, Upload as UploadIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useNotifications } from '../components/NotificationProvider';
import { useLanguage } from '../components/LanguageProvider';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { subService } from '../services/subscription';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
  // Business info
  store_name: string;
  store_phone: string;
  store_address: string;
  store_logo: string;
  owner_full_name: string;
  owner_mobile: string;
  owner_email: string;
  owner_username: string;
  owner_password: string;
  // Receipt / print
  receipt_footer: string;
  receipt_size: string;
  invoice_style: string;
  invoice_notes: string;
  // Security
  pos_password: string;
  low_stock_threshold: number;
  // Auto-export
  auto_export_path: string;
  auto_export_enabled: boolean;
  // Cloud / API
  cloud_backend_url: string;
  cloud_backend_token: string;
  cloud_connected: boolean;
  cloud_last_sync: string | null;
  // License
  license_mode: 'offline' | 'online';
  approval_status: 'approved' | 'pending' | 'blocked';
  activation_key: string;
  setup_completed: boolean;
}

const defaultSettings: SettingsData = {
  store_name: '', store_phone: '', store_address: '', store_logo: '',
  owner_full_name: '', owner_mobile: '', owner_email: '',
  owner_username: 'admin', owner_password: '',
  receipt_footer: 'Thank you for visiting!',
  receipt_size: 'thermal', invoice_style: 'thermal', invoice_notes: '',
  pos_password: '1234', low_stock_threshold: 10,
  auto_export_path: '', auto_export_enabled: false,
  cloud_backend_url: '', cloud_backend_token: '',
  cloud_connected: false, cloud_last_sync: null,
  license_mode: 'offline', approval_status: 'approved',
  activation_key: '', setup_completed: true,
};

const BACKUPS_PAGE_SIZE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLastBackup(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return (isToday ? 'Today, ' : '') + date.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ icon, label, value, onChange, placeholder, type = 'text' }: {
  icon: React.ReactNode; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <div className="absolute left-3 top-3 h-4 w-4 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
        <Input className="pl-9" type={type} value={value || ''} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const colors = { success: 'bg-emerald-600 text-white', warning: 'bg-amber-500 text-white', danger: 'bg-rose-600 text-white', neutral: 'bg-slate-600 text-white' };
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase">{label}</div>
      <Badge className={`mt-2 ${colors[tone]}`}>{value}</Badge>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [previewLogo, setPreviewLogo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validating, setValidating] = useState(false);

  // Google Drive state
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; lastBackup: string | null }>({ connected: false, lastBackup: null });
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<any[]>([]);
  const [backupPage, setBackupPage] = useState(1);
  const [isFetchingBackups, setIsFetchingBackups] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ status: string; progress: number } | null>(null);

  // Sync status (for cloud/API section)
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0, cloudConnected: false, lastSync: null as string | null });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useNotifications();
  const { language, setLanguage, t } = useLanguage();

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSettings();
    loadSyncStatus();

    const cleanup = window.api.onAutoExportComplete?.((data: any) => {
      if (data.success) addNotification('Auto-Saved', `Database backed up to ${data.path}`, 'success');
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const fetchDriveStatus = async () => {
      const status = await window.api.getGoogleDriveStatus();
      setDriveStatus(status);
    };
    fetchDriveStatus();
    subService.initialize().then((s) => setSubscriptionInfo(s)).catch(() => setSubscriptionInfo(subService.getState()));
    const interval = setInterval(fetchDriveStatus, 10000);

    const unsubscribe = window.api.onRestoreProgress?.((data: any) => setRestoreProgress(data));
    return () => { clearInterval(interval); unsubscribe?.(); };
  }, []);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) {
        const data = res.data as any;
        setSettings({
          ...defaultSettings,
          ...data,
          pos_password: data.pos_password || '1234',
          low_stock_threshold: data.low_stock_threshold ?? 10,
          receipt_size: data.receipt_size || 'thermal',
          invoice_style: data.invoice_style || 'thermal',
          invoice_notes: data.invoice_notes || '',
          auto_export_path: data.auto_export_path || '',
          auto_export_enabled: !!data.auto_export_enabled,
          owner_mobile: data.owner_mobile || data.store_phone || '',
          cloud_connected: !!data.cloud_connected,
          license_mode: data.license_mode === 'online' ? 'online' : 'offline',
          approval_status: data.approval_status === 'blocked' ? 'blocked' : data.approval_status === 'pending' ? 'pending' : 'approved',
          setup_completed: !!data.setup_completed,
        });
        if (data.store_logo) setPreviewLogo(data.store_logo);
      }
    } catch {
      addNotification('Error', 'Could not load settings from database.', 'error');
    }
  };

  const loadSyncStatus = async () => {
    const res = await window.api.getSyncStatus?.();
    if (res?.success && res.data) setSyncStatus(res.data);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const update = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...settings,
        business_name: settings.store_name,
        owner_mobile: settings.owner_mobile || settings.store_phone,
        setup_completed: true,
        cloud_connected: !!settings.cloud_backend_url && !!settings.cloud_backend_token,
      };
      const res = await window.api.updateSettings(payload as any);
      if (res.success) {
        addNotification('Settings Saved', 'Your preferences have been updated.', 'success');
        await loadSettings();
        await loadSyncStatus();
      } else {
        addNotification('Save Failed', res.error || 'A database error occurred.', 'error');
      }
    } catch {
      addNotification('Error', 'Critical fault saving settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPreviewLogo(url);
      update('store_logo', url);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectDirectory = async () => {
    try {
      const path = await window.api.selectDirectory();
      if (path) {
        update('auto_export_path', path);
        addNotification('Backup Path Set', 'Please save settings to apply.', 'info');
      }
    } catch {
      addNotification('Error', 'Could not open folder picker.', 'error');
    }
  };

  const handleManualExport = async () => {
    if (!settings.auto_export_path) { addNotification('Missing Path', 'Please set a backup folder first.', 'warning'); return; }
    try {
      await window.api.performAutoExport();
      addNotification('Export Success', 'Manual backup performed successfully.', 'success');
    } catch {
      addNotification('Export Failed', 'Could not perform manual export.', 'error');
    }
  };

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    try {
      const res = await window.api.connectGoogleDrive();
      if (res.success) {
        addNotification('Google Drive Connected', 'Your account has been linked successfully.', 'success');
        setDriveStatus(await window.api.getGoogleDriveStatus());
      } else {
        addNotification('Connection Failed', res.message || 'Failed to link Google Drive.', 'error');
      }
    } finally { setIsConnecting(false); }
  };

  const handleDriveBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await window.api.triggerGoogleDriveBackup();
      if (res.success) {
        addNotification('Backup Complete', res.message, 'success');
        setDriveStatus(await window.api.getGoogleDriveStatus());
      } else {
        addNotification('Backup Failed', res.message, 'error');
      }
    } finally { setIsBackingUp(false); }
  };

  const handleFetchBackups = async () => {
    setIsFetchingBackups(true);
    try {
      const res = await window.api.getAvailableBackups();
      const isArray = Array.isArray(res);
      const success = isArray ? true : !!res?.success;
      const backups = isArray ? res : (res?.backups || []);
      if (success) {
        setAvailableBackups(backups);
        setBackupPage(1);
        if (backups.length === 0) addNotification('No Backups Found', 'No POS backups were found in your Google Drive.', 'info');
      } else {
        addNotification('Fetch Failed', res?.message || 'Could not list backups.', 'error');
      }
    } catch (err: any) {
      addNotification('Fetch Failed', err?.message || 'Could not list backups.', 'error');
    } finally { setIsFetchingBackups(false); }
  };

  const handleRestoreCloudBackup = async (fileId: string) => {
    if (!window.confirm('CRITICAL WARNING:\n\nThis will completely replace your current local data with the selected cloud backup. Continue?')) return;
    try {
      setRestoreProgress({ status: 'starting', progress: 0 });
      const res = await window.api.restoreCloudBackup(fileId);
      if (res.success) {
        addNotification('Restore Successful', 'Your data has been restored. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        addNotification('Restore Failed', res.message || 'Failed to restore.', 'error');
        setRestoreProgress(null);
      }
    } catch (err: any) {
      addNotification('Error', 'Critical restoration error: ' + err.message, 'error');
      setRestoreProgress(null);
    }
  };

  const handleExportData = async () => {
    try {
      addNotification('Exporting Data', 'Compiling system records...', 'info');
      const res = await window.api.exportData();
      if (res.success) {
        const dataStr = JSON.stringify(res.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const a = document.createElement('a');
        a.setAttribute('href', dataUri);
        a.setAttribute('download', `pos_backup_${new Date().toISOString().split('T')[0]}.json`);
        a.click();
        addNotification('Export Complete', 'Data backup downloaded.', 'success');
      } else {
        addNotification('Export Failed', res.error || 'Export blocked.', 'error');
      }
    } catch { addNotification('Error', 'Failed exporting JSON.', 'error'); }
  };

  const handleExportExcel = async () => {
    try {
      addNotification('Exporting Data', 'Compiling to Excel...', 'info');
      const res = await window.api.exportData();
      if (res.success) {
        const { products, customers, sales, sale_items, vendors, purchases, inventory_batches, customer_payments } = res.data;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products || []), 'Products');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers || []), 'Customers');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales || []), 'Sales');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sale_items || []), 'SaleItems');
        if (vendors) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendors), 'Vendors');
        if (purchases) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchases), 'Purchases');
        if (inventory_batches) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventory_batches), 'Batches');
        if (customer_payments) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customer_payments), 'Payments');
        XLSX.writeFile(wb, `pos_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
        addNotification('Export Complete', 'Excel backup downloaded.', 'success');
      } else {
        addNotification('Export Failed', res.error || 'Export blocked.', 'error');
      }
    } catch { addNotification('Error', 'Failed exporting Excel.', 'error'); }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('Warning: Importing will OVERWRITE your current database. Continue?')) { e.target.value = ''; return; }
    try {
      addNotification('Importing Data', 'Restoring system records...', 'info');
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const res = await window.api.importData(data);
          if (res.success) window.location.reload();
          else addNotification('Import Failed', res.error || 'Validation failed.', 'error');
        } catch { addNotification('Import Error', 'Invalid JSON file structure.', 'error'); }
      };
      reader.readAsText(file);
    } catch { addNotification('Error', 'Failed to read file.', 'error'); }
  };

  const handleImportDb = async () => {
    if (!window.confirm('CRITICAL WARNING:\n\nRestoring a .db file will completely replace your current database. Continue?')) return;
    try {
      const filePath = await window.api.selectDbFile();
      if (!filePath) return;
      addNotification('Importing Database', 'Replacing system database...', 'info');
      const res = await window.api.importDb(filePath);
      if (res.success) {
        addNotification('Import Successful', 'Database restored. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        addNotification('Import Failed', res.error || 'Could not replace database.', 'error');
      }
    } catch (err: any) {
      addNotification('Error', 'Critical error during DB import: ' + err.message, 'error');
    }
  };

  const handleDeleteAllData = async () => {
    if (!window.confirm('CRITICAL WARNING:\n\nThis will permanently delete ALL data. This CANNOT be undone. Are you absolutely sure?')) return;
    if (!window.confirm('FINAL CONFIRMATION:\n\nType OK to confirm the complete wipe.')) return;
    try {
      addNotification('Wiping Data', 'Clearing all records...', 'warning');
      const res = await window.api.deleteAllData();
      if (res.success) window.location.reload();
      else addNotification('Wipe Failed', 'Error deleting data: ' + res.error, 'error');
    } catch { addNotification('Error', 'Critical execution error.', 'error'); }
  };

  const handleSeedDatabase = async () => {
    if (!window.confirm('Seed the database with 1,000+ records (100 customers, 200 products, 500 sales)?')) return;
    setIsSaving(true);
    try {
      addNotification('Seeding Started', 'Populating database with demo data...', 'info');
      const res = await window.api.seedDatabase();
      if (res.success) {
        addNotification('Seeding Complete', 'Database populated with demo data.', 'success');
        window.location.reload();
      } else {
        addNotification('Seeding Failed', res.error || 'Unknown error.', 'error');
      }
    } catch (err: any) {
      addNotification('Seeding Error', err.message, 'error');
    } finally { setIsSaving(false); }
  };

  const handleStressTest = async () => {
    if (!window.confirm('Simulate 1,000 rapid checkouts for performance benchmarking?')) return;
    setIsSaving(true);
    addNotification('Benchmarking', 'Commencing 1,000 extreme rapid checkouts...', 'info');
    try {
      const start = performance.now();
      const stressItems = [{ product_name: 'Engine Benchmark Test', quantity: Math.floor(Math.random() * 5) + 1, price: 100, is_custom: true }];
      const promises = Array.from({ length: 1000 }, (_, i) =>
        window.api.createSale({
          total: 100 * stressItems[0].quantity, subtotal: 100 * stressItems[0].quantity,
          discount: 0, tax: 0, payment_method: i % 2 === 0 ? 'online' : 'cash', items: stressItems,
        })
      );
      const results = await Promise.all(promises);
      const failed = results.filter((r) => !r.success);
      const end = performance.now();
      if (failed.length > 0) {
        addNotification('Stress Test Yield', `${failed.length} failures out of 1000.`, 'error');
      } else {
        addNotification('Benchmark Passed ✅', `1,000 checkouts in ${((end - start) / 1000).toFixed(2)}s. Zero UI blocks.`, 'success');
      }
    } catch { addNotification('Error', 'Stress test interrupted.', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleValidateLicense = async () => {
    if (!settings.activation_key.trim()) { addNotification('No License Key', 'Enter a license key first, or keep offline mode.', 'info'); return; }
    setValidating(true);
    try {
      const res = await window.api.activateAppV2(settings.activation_key.trim());
      if (res.success) {
        addNotification('License Validated', 'License key saved and activated.', 'success');
        update('license_mode', 'online');
      } else {
        addNotification('Validation Failed', res.error || 'Could not validate.', 'error');
      }
    } finally { setValidating(false); }
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalBackupPages = Math.max(1, Math.ceil(availableBackups.length / BACKUPS_PAGE_SIZE));
  const currentBackupPage = Math.min(backupPage, totalBackupPages);
  const pagedBackups = availableBackups.slice((currentBackupPage - 1) * BACKUPS_PAGE_SIZE, currentBackupPage * BACKUPS_PAGE_SIZE);
  const cloudReady = !!settings.cloud_backend_url && !!settings.cloud_backend_token;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-4xl pb-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your store, cloud, and operational parameters</p>
        </div>
        <Button type="button" onClick={handleSave} disabled={isSaving} className="gap-2 self-start">
          {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Language ──────────────────────────────────────────────────────── */}
        <Card className="shadow-sm border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Zap size={20} /> {t('language')}
            </CardTitle>
            <CardDescription>Select your preferred interface language / اپنی پسندیدہ زبان منتخب کریں۔</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button type="button" variant={language === 'en' ? 'default' : 'outline'} className="flex-1 gap-2 h-14 text-lg" onClick={() => setLanguage('en')}>
                🇺🇸 {t('english')}
              </Button>
              <Button type="button" variant={language === 'ur' ? 'default' : 'outline'} className="flex-1 gap-2 h-14 text-lg font-urdu" onClick={() => setLanguage('ur')}>
                🇵🇰 {t('urdu')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Branding / Logo ───────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon size={18} className="text-primary" /> Company Branding
            </CardTitle>
            <CardDescription>Logo used on UI and printed receipts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start sm:items-center gap-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-colors bg-muted/20 shrink-0 group relative',
                  previewLogo ? 'border-transparent' : 'border-border hover:border-primary hover:bg-muted/50',
                )}
              >
                {previewLogo ? (
                  <>
                    <img src={previewLogo} alt="Logo" className="w-full h-full object-contain p-2 group-hover:opacity-30 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <UploadIcon size={20} className="text-foreground" />
                    </div>
                  </>
                ) : (
                  <Store size={32} className="text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all" />
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-fit">
                  <Upload size={14} className="mr-2" /> Upload Image
                </Button>
                <p className="text-xs text-muted-foreground">Recommended: Square PNG or JPG, max 1MB.</p>
                {previewLogo && (
                  <Button type="button" variant="link" size="sm" onClick={() => { setPreviewLogo(''); update('store_logo', ''); }} className="h-auto p-0 text-destructive justify-start w-fit">
                    Remove current logo
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </CardContent>
        </Card>

        {/* ── Business Information ──────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={18} className="text-primary" /> Business Information
            </CardTitle>
            <CardDescription>Used on receipts, statements, and cloud registration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field icon={<User />} label="Full Name" value={settings.owner_full_name} onChange={(v) => update('owner_full_name', v)} placeholder="e.g. Munib Ahmad" />
              <div className="space-y-2">
                <Label>Username (Locked)</Label>
                <div className="relative">
                  <div className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"><User size={16} /></div>
                  <Input className="pl-9" value={settings.owner_username} disabled placeholder="admin" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Retailer Shop Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" size={16} />
                <Input required value={settings.store_name} onChange={(e) => update('store_name', e.target.value)} placeholder="e.g. OsaTech Retail Shop" className="pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field icon={<Phone />} label="Contact Phone" value={settings.store_phone} onChange={(v) => update('store_phone', v)} placeholder="+92 300 1234567" />
              <Field icon={<Phone />} label="Mobile Number" value={settings.owner_mobile} onChange={(v) => { update('owner_mobile', v); update('store_phone', v); }} placeholder="+92 300 1234567" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field icon={<Mail />} label="Email (Optional)" value={settings.owner_email} onChange={(v) => update('owner_email', v)} placeholder="owner@example.com" type="email" />
              {/* Receipt header mini-preview */}
              <div className="space-y-2 border border-dashed rounded-lg p-3 bg-muted/10 relative overflow-hidden">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase absolute top-2 left-3">Receipt Preview Header</p>
                <div className="mt-4 text-center">
                  <p className="font-bold text-sm text-foreground">{settings.store_name || 'Retailer Shop Name'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{settings.store_phone || 'Phone Number'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Street Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-muted-foreground opacity-50" size={16} />
                <textarea
                  value={settings.store_address} rows={2}
                  onChange={(e) => update('store_address', e.target.value)}
                  placeholder="123 Main Street, Karachi"
                  className="w-full flex rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9 resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Receipt Footer ────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={18} className="text-primary" /> Receipt Footer
            </CardTitle>
            <CardDescription>Custom message shown at the end of each print</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-muted-foreground opacity-50" size={16} />
              <textarea
                value={settings.receipt_footer} rows={2}
                onChange={(e) => update('receipt_footer', e.target.value)}
                placeholder="Thank you for visiting!"
                className="w-full flex rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9 resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Security & Access ─────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" /> Security & Access
            </CardTitle>
            <CardDescription>Protect application launch with a secure PIN</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-sm">
              <Label>Terminal Login Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" size={16} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.pos_password}
                  onChange={(e) => update('pos_password', e.target.value)}
                  placeholder="Enter numeric PIN"
                  className="pl-9 pr-10 font-mono"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2 max-w-sm">
              <Label>Low Stock Alert Threshold</Label>
              <Input
                type="number" min="0"
                value={settings.low_stock_threshold}
                onChange={(e) => update('low_stock_threshold', parseInt(e.target.value) || 0)}
                placeholder="e.g. 10"
              />
              <p className="text-[10px] text-muted-foreground">Items below this quantity will trigger a warning in Inventory.</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Print & Receipt Settings ──────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer size={18} className="text-primary" /> Print & Receipt Settings
            </CardTitle>
            <CardDescription>Choose default paper size and invoice style. Live preview shown below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Paper size */}
            <div className="space-y-3">
              <Label>Default Receipt / Invoice Size</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'thermal', label: 'Thermal (80mm)', desc: 'Standard receipt roll' },
                  { value: 'a5', label: 'A5 Paper', desc: '148 × 210 mm' },
                  { value: 'a4', label: 'A4 Paper', desc: '210 × 297 mm' },
                ].map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => update('receipt_size', opt.value)}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${settings.receipt_size === opt.value ? 'border-primary bg-primary/5 shadow-md' : 'border-border/50 hover:border-primary/40 hover:bg-muted/30'}`}>
                    <div className={`mb-2 rounded border-2 flex items-center justify-center text-xs font-bold ${settings.receipt_size === opt.value ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'} ${opt.value === 'thermal' ? 'w-6 h-12' : opt.value === 'a5' ? 'w-8 h-11' : 'w-8 h-12'}`}>
                      {opt.value === 'thermal' ? '80' : opt.value === 'a5' ? 'A5' : 'A4'}
                    </div>
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Invoice style */}
            <div className="space-y-3 border-t pt-5">
              <div>
                <Label>Invoice Style / Layout</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Compact thermal receipt or a structured formal A4 invoice.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'thermal', label: '🧾 Thermal Receipt', desc: 'Compact scrollable receipt — great for cash registers & quick sales' },
                  { value: 'formal', label: '📄 Formal Invoice', desc: 'Structured A4 table invoice with S.No, Qty, Unit Price, Amount & balance rows' },
                ].map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => update('invoice_style', opt.value)}
                    className={`flex flex-col p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${settings.invoice_style === opt.value ? 'border-primary bg-primary/5 shadow-md' : 'border-border/50 hover:border-primary/40 hover:bg-muted/30'}`}>
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Invoice notes */}
            <div className="space-y-2 border-t pt-5">
              <Label>Invoice Notes / Terms (printed on every invoice)</Label>
              <p className="text-xs text-muted-foreground">e.g. return policy, warranty, contact info.</p>
              <textarea
                value={settings.invoice_notes || ''} rows={3}
                onChange={(e) => update('invoice_notes', e.target.value)}
                placeholder={'• Warranty is 3 days only\n• No returns on software\n• Goods once sold cannot be returned'}
                className="w-full flex rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Live preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Live Print Preview</Label>
                <Button type="button" variant="outline" size="sm" className="gap-2"
                  onClick={() => {
                    const previewEl = document.getElementById('receipt-preview');
                    if (!previewEl) return;
                    const win = window.open('', '_blank', 'width=900,height=700');
                    if (!win) return;
                    win.document.write(`<!DOCTYPE html><html><head><title>Print Preview</title>
                      <style>@media print{body{margin:0;}}body{font-family:monospace;background:#f5f5f5;display:flex;justify-content:center;padding:20px;}
                      .page{background:white;padding:24px;${settings.receipt_size === 'thermal' ? 'width:302px;' : settings.receipt_size === 'a5' ? 'width:559px;' : 'width:794px;'}box-shadow:0 2px 8px rgba(0,0,0,0.15);}
                      </style></head><body><div class="page">${previewEl.innerHTML}</div></body>
                      <script>window.onload=function(){window.print();}<\/script></html>`);
                    win.document.close();
                  }}>
                  <Printer size={14} /> Print Preview
                </Button>
              </div>
              <div className="border-2 border-dashed rounded-xl overflow-hidden bg-white dark:bg-neutral-900 flex justify-center p-4">
                <div id="receipt-preview" className={`font-mono text-[11px] leading-relaxed bg-white text-black transition-all ${settings.receipt_size === 'thermal' ? 'w-[280px]' : settings.receipt_size === 'a5' ? 'w-[480px]' : 'w-[680px]'}`}>
                  <div className="text-center border-b pb-2 mb-2">
                    {previewLogo && <img src={previewLogo} alt="logo" className="h-12 mx-auto mb-1 object-contain" />}
                    <div className="font-bold text-base">{settings.store_name || 'Store Name'}</div>
                    {settings.store_phone && <div>{settings.store_phone}</div>}
                    {settings.store_address && <div className="text-[10px]">{settings.store_address}</div>}
                  </div>
                  <div className="flex justify-between border-b pb-1 mb-1"><span>Date:</span><span>{new Date().toLocaleDateString('en-PK')}</span></div>
                  <div className="flex justify-between border-b pb-1 mb-1"><span>Invoice #:</span><span>#0001-SAMPLE</span></div>
                  <div className="border-b pb-2 mb-2">
                    <div className="flex justify-between font-bold">
                      <span className="flex-1">Item</span><span className="w-10 text-right">Qty</span>
                      <span className="w-20 text-right">Price</span><span className="w-20 text-right">Total</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex-1">Sample Product</span><span className="w-10 text-right">2</span>
                      <span className="w-20 text-right">PKR 500</span><span className="w-20 text-right">PKR 1,000</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t pt-1"><span>TOTAL</span><span>PKR 1,000</span></div>
                  <div className="text-center mt-3 pt-2 border-t text-[10px] text-gray-500">{settings.receipt_footer || 'Thank you for your purchase!'}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Preview updates live. Click "Print Preview" to open a printable window.</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Cloud / API Configuration ─────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {cloudReady ? <Cloud size={18} className="text-emerald-600" /> : <CloudOff size={18} className="text-muted-foreground" />}
              Cloud / API Configuration
            </CardTitle>
            <CardDescription>SQLite remains primary. Cloud APIs sync only when internet and credentials are available.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field icon={<Cloud />} label="API Base URL" value={settings.cloud_backend_url} onChange={(v) => update('cloud_backend_url', v)} placeholder="https://api.example.com" />
              <Field icon={<ShieldCheck />} label="Auth Token" value={settings.cloud_backend_token} onChange={(v) => update('cloud_backend_token', v)} placeholder="Bearer token" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <StatusTile label="Cloud" value={cloudReady ? 'Configured' : 'Offline'} tone={cloudReady ? 'success' : 'neutral'} />
              <StatusTile label="Queue" value={`${syncStatus.pending} pending`} tone={syncStatus.pending > 0 ? 'warning' : 'success'} />
              <StatusTile label="Failed" value={`${syncStatus.failed} failed`} tone={syncStatus.failed > 0 ? 'danger' : 'success'} />
              <StatusTile label="Last Sync" value={syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'} tone="neutral" />
            </div>
          </CardContent>
        </Card>

        {/* ── Google Drive Backup ───────────────────────────────────────────── */}
        <Card className="shadow-lg border-blue-500/20 bg-blue-500/5 overflow-hidden">
          <div className="h-1.5 w-full bg-blue-500" />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Cloud size={20} className="text-blue-500" /> Google Drive Backup
                </CardTitle>
                <CardDescription>Secure your data in the cloud automatically</CardDescription>
              </div>
              <Badge variant={driveStatus.connected ? 'default' : 'outline'} className={cn('px-3 py-1 text-xs font-bold gap-1.5', driveStatus.connected ? 'bg-emerald-500 hover:bg-emerald-600 border-none' : 'text-muted-foreground border-border')}>
                {driveStatus.connected ? <><CheckCircle2 size={12} /> Connected</> : <><CloudOff size={12} /> Not Linked</>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: <Globe size={20} />, bg: 'bg-blue-100 text-blue-600', label: 'Network Mode', value: 'Cloud Sync Enabled' },
                { icon: <ShieldCheck size={20} />, bg: 'bg-emerald-100 text-emerald-600', label: 'Security', value: 'AES-256 Local Encryption' },
                { icon: <Activity size={20} />, bg: 'bg-amber-100 text-amber-600', label: 'Last Backup', value: formatLastBackup(driveStatus.lastBackup) },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl bg-card/70 border border-border shadow-sm flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${item.bg}`}>{item.icon}</div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</p>
                    <p className="text-sm font-bold text-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Cloud Connected', value: driveStatus.connected ? 'Yes' : 'No (Offline/Not Linked)', tone: driveStatus.connected ? 'text-emerald-600' : 'text-amber-600' },
                { label: 'Last Sync', value: subscriptionInfo?.lastSync ? new Date(subscriptionInfo.lastSync).toLocaleString() : 'Not synced yet', tone: 'text-foreground' },
                { label: 'Subscription Plan', value: subscriptionInfo?.plan || 'none', tone: 'text-foreground capitalize' },
                { label: 'Expiry Remaining', value: subscriptionInfo?.plan === 'lifetime' ? 'Unlimited' : `${Math.max(0, subscriptionInfo?.daysRemaining || 0)} day(s)`, tone: 'text-foreground' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-card/70 p-3">
                  <p className="text-muted-foreground uppercase tracking-widest font-black text-[10px] mb-1">{item.label}</p>
                  <p className={`font-bold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-card/70 p-3 sm:col-span-2">
                <p className="text-muted-foreground uppercase tracking-widest font-black text-[10px] mb-1">Backup Status</p>
                <p className="font-bold text-foreground">{driveStatus.lastBackup ? `Last backup: ${formatLastBackup(driveStatus.lastBackup)}` : 'No backup recorded yet'}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              {!driveStatus.connected ? (
                <Button type="button" onClick={handleConnectDrive} disabled={isConnecting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 gap-2 h-11 px-8 font-bold">
                  {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}
                  {isConnecting ? 'Linking Account...' : 'Link Google Drive'}
                </Button>
              ) : (
                <>
                  <Button type="button" onClick={handleDriveBackup} disabled={isBackingUp} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 gap-2 h-11 px-8 font-bold">
                    {isBackingUp ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    {isBackingUp ? 'Syncing...' : 'Backup Now'}
                  </Button>
                  <p className="text-xs text-blue-600/70 font-semibold flex items-center gap-1.5 bg-blue-100/50 px-4 py-2.5 rounded-lg border border-blue-200">
                    <CheckCircle2 size={14} /> Automatic weekly backups are enabled.
                  </p>
                </>
              )}
            </div>

            {!driveStatus.connected && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider mb-1">Backup Recommendation</p>
                  <p className="text-xs font-medium leading-relaxed">Your business data is currently stored only on this computer. Link Google Drive to protect against hardware failure, fire, or theft.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Cloud Backup List ─────────────────────────────────────────────── */}
        {driveStatus.connected && (
          <Card className="shadow-sm border-blue-200">
            <CardHeader className="pb-3 bg-blue-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Download size={16} className="text-blue-600" /> Available Cloud Backups
                  </CardTitle>
                  <CardDescription className="text-[10px]">Recent snapshots found on your Google Drive</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleFetchBackups} disabled={isFetchingBackups} className="h-8 text-xs gap-1.5">
                  {isFetchingBackups ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Refresh List
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {availableBackups.length > 0 ? (
                <div className="divide-y divide-border">
                  {pagedBackups.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">{b.name}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Database size={10} /> {formatSize(b.size)}</span>
                          <span className="flex items-center gap-1"><Zap size={10} /> {new Date(b.date).toLocaleString()}</span>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="secondary" className="h-8 text-xs px-4" onClick={() => handleRestoreCloudBackup(b.id)}>
                        Restore
                      </Button>
                    </div>
                  ))}
                  {availableBackups.length > BACKUPS_PAGE_SIZE && (
                    <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/10">
                      <p className="text-xs text-muted-foreground">
                        Showing {Math.min((currentBackupPage - 1) * BACKUPS_PAGE_SIZE + 1, availableBackups.length)}–{Math.min(currentBackupPage * BACKUPS_PAGE_SIZE, availableBackups.length)} of {availableBackups.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={currentBackupPage <= 1} onClick={() => setBackupPage((p) => Math.max(1, p - 1))}>Prev</Button>
                        <span className="text-xs font-medium text-muted-foreground px-2">Page {currentBackupPage} / {totalBackupPages}</span>
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={currentBackupPage >= totalBackupPages} onClick={() => setBackupPage((p) => Math.min(totalBackupPages, p + 1))}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <Cloud size={24} className="mx-auto text-muted-foreground opacity-20" />
                  <p className="text-xs text-muted-foreground font-medium">No backups listed. Click Refresh to scan Drive.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── License ───────────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound size={18} className="text-primary" /> License Information
            </CardTitle>
            <CardDescription>License is optional for offline POS use and can be validated later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={settings.license_mode} onValueChange={(v: 'offline' | 'online') => update('license_mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="online">Online License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field icon={<KeyRound />} label="License Key" value={settings.activation_key} onChange={(v) => update('activation_key', v)} placeholder="Optional" />
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={handleValidateLicense} disabled={validating} className="w-full">
                  {validating ? 'Checking...' : 'Validate'}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={settings.license_mode === 'offline' ? 'bg-slate-600 text-white' : 'bg-blue-600 text-white'}>
                {settings.license_mode === 'offline' ? 'Offline-first' : 'Online license'}
              </Badge>
              <Badge className={settings.approval_status === 'blocked' ? 'bg-rose-600 text-white' : settings.approval_status === 'pending' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}>
                {settings.approval_status}
              </Badge>
              <Badge className="bg-emerald-600 text-white">
                <CheckCircle2 size={12} className="mr-1" /> Local SQLite active
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ── Data Management ───────────────────────────────────────────────── */}
        <Card className="shadow-sm border-destructive/30 overflow-hidden">
          <div className="h-1 w-full bg-destructive" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Database size={18} /> Data Management
            </CardTitle>
            <CardDescription>Backup, restore, or manage your system database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 border rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Download size={16} className="text-primary" /> Export Data</h4>
                <p className="text-xs text-muted-foreground mt-1">Export your complete database to JSON or Excel format.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <Button type="button" variant="outline" onClick={handleExportData} className="w-full sm:w-auto shadow-sm">JSON</Button>
                <Button type="button" variant="outline" onClick={handleExportExcel} className="w-full sm:w-auto shadow-sm">Excel</Button>
              </div>
            </div>

            {/* Auto JSON Backup */}
            <div className="flex flex-col sm:flex-row items-start justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-primary"><ShieldCheck size={16} /> Automated JSON Backup</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Auto-save to a folder every 5 hours and after settings changes.</p>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Backup Location</span>
                    <div className="flex gap-2">
                      <Input value={settings.auto_export_path} readOnly placeholder="No folder selected..." className="h-9 bg-background/50 text-xs font-mono" />
                      <Button type="button" size="sm" variant="outline" onClick={handleSelectDirectory}>Browse</Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={settings.auto_export_enabled} onChange={(e) => update('auto_export_enabled', e.target.checked)} className="w-4 h-4 accent-primary" />
                      <span className="text-xs font-medium">Enable Auto-Backup</span>
                    </label>
                    <Button type="button" variant="ghost" size="sm" className="text-[10px] h-7 text-primary hover:bg-primary/10" onClick={handleManualExport} disabled={!settings.auto_export_path}>
                      Save & Export Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Restore DB */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 border rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Upload size={16} className="text-emerald-500" /> Restore Database (.db)</h4>
                <p className="text-xs text-muted-foreground mt-1">Import a raw SQLite database file (pos.db). Best way to restore full backups.</p>
              </div>
              <Button type="button" variant="outline" onClick={handleImportDb} className="w-full sm:w-auto shrink-0 shadow-sm gap-2">
                <Database size={14} /> Select DB File
              </Button>
            </div>

            {/* Restore JSON */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 border rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Upload size={16} className="text-blue-500" /> Restore JSON Backup</h4>
                <p className="text-xs text-muted-foreground mt-1">Import a JSON payload to completely restore the database.</p>
              </div>
              <div className="w-full sm:w-auto shrink-0">
                <Button type="button" variant="outline" onClick={() => document.getElementById('import-file')?.click()} className="w-full shadow-sm gap-2">
                  <Upload size={14} /> Import File
                </Button>
                <input id="import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </div>
            </div>

            {/* Seed (commented out in original, kept hidden) */}
            {/* <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-blue-600 flex items-center gap-2"><Activity size={16} /> Fill with Demo Data</h4>
                <p className="text-xs text-muted-foreground mt-1">Populate the app with 100 customers, 200 products, 150 vendors, and 500 sales for testing.</p>
              </div>
              <Button type="button" variant="outline" onClick={handleSeedDatabase} disabled={isSaving} className="w-full sm:w-auto shrink-0 shadow-sm gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                <Database size={14} /> Seed 1,000+ Records
              </Button>
            </div> */}

            {/* Stress test (commented out in original, kept hidden) */}
            {/* <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 border border-purple-500/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-purple-600"><Zap size={16} className="text-purple-500" /> System Stress Test</h4>
                <p className="text-xs text-muted-foreground mt-1">Simulate 1,000 extreme concurrent checkouts to benchmark engine payload throughput.</p>
              </div>
              <Button type="button" variant="outline" onClick={handleStressTest} disabled={isSaving} className="w-full sm:w-auto shrink-0 shadow-sm gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                <Zap size={14} /> Run Benchmark
              </Button>
            </div> */}

            {/* Delete all (commented out in original, kept hidden) */}
            {/* <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-destructive/5 border border-destructive/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-destructive flex items-center gap-2"><Trash2 size={16} /> Wipe System</h4>
                <p className="text-xs text-destructive/80 mt-1">Permanently delete all sales, products, and customers.</p>
              </div>
              <Button type="button" variant="destructive" onClick={handleDeleteAllData} className="w-full sm:w-auto shrink-0 shadow-md gap-2 font-bold">
                <Trash2 size={15} /> Terminate Data
              </Button>
            </div> */}
          </CardContent>
        </Card>

        {/* ── Save Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end pt-6 border-t mt-6">
          <Button type="submit" disabled={isSaving} className="gap-2 px-8 shadow-lg shadow-primary/20">
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? 'Saving Changes...' : 'Save All Settings'}
          </Button>
        </div>
      </form>

      {/* ── Restore Progress Overlay ───────────────────────────────────────── */}
      {restoreProgress && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <Card className="w-full max-w-md shadow-2xl border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-lg font-bold flex items-center justify-center gap-3">
                <Loader2 className="animate-spin text-primary" size={24} />
                {restoreProgress.status === 'downloading' ? 'Downloading from Cloud...' : 'Restoring Database...'}
              </CardTitle>
              <CardDescription>Please do not close the application during this process.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{restoreProgress.status}</span>
                  <span>{restoreProgress.progress}%</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden border">
                  <div className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${restoreProgress.progress}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-center text-muted-foreground font-medium animate-pulse">
                Finalizing local file operations... This may take a moment.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
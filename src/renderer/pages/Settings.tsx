import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, Building2, CheckCircle2, Cloud, CloudOff,
  Database, Download, Eye, EyeOff, FileText, Globe, Image as ImageIcon,
  KeyRound, Loader2, Lock, Mail, MapPin, Phone, Printer,
  RefreshCw, Save, ShieldCheck, Store, Trash2, Upload, User,
  Zap, Upload as UploadIcon, Languages, HardDrive, Settings2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface SettingsData {
  store_name: string; store_phone: string; store_address: string; store_logo: string;
  owner_full_name: string; owner_mobile: string; owner_email: string;
  owner_username: string; owner_password: string;
  receipt_footer: string; receipt_size: string; invoice_style: string; invoice_notes: string;
  pos_password: string; low_stock_threshold: number;
  auto_export_path: string; auto_export_enabled: boolean;
  cloud_backend_url: string; cloud_backend_token: string;
  cloud_connected: boolean; cloud_last_sync: string | null;
  license_mode: 'offline' | 'online'; approval_status: 'approved' | 'pending' | 'blocked';
  activation_key: string; setup_completed: boolean;
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
  const isToday = date.toDateString() === new Date().toDateString();
  return (isToday ? 'Today, ' : '') + date.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'], i = Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

type Tab = 'general' | 'receipt' | 'security' | 'backup' | 'license';

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'general',  label: 'General',       icon: Building2,   desc: 'Business & branding'  },
  { id: 'receipt',  label: 'Print & Receipt',icon: Printer,     desc: 'Paper & invoice style'},
  { id: 'security', label: 'Security',       icon: ShieldCheck, desc: 'PIN & thresholds'     },
  { id: 'backup',   label: 'Backup & Data',  icon: Database,    desc: 'Cloud & exports'      },
  { id: 'license',  label: 'License',        icon: KeyRound,    desc: 'Activation & API'     },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, desc, icon: Icon, children, accent }: {
  title: string; desc?: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {accent && <div className="h-0.5 w-full" style={{ background: accent }} />}
      <div className="px-5 pt-5 pb-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-none">{title}</h3>
            {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ icon, label, value, onChange, placeholder, type = 'text', required }: {
  icon: React.ReactNode; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</div>
        <Input className="pl-8 h-9 text-sm" type={type} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'success'|'warning'|'danger'|'neutral' }) {
  const color = { success:'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', warning:'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', danger:'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', neutral:'bg-muted/50 text-muted-foreground border-border/60' }[tone];
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">{label}</p>
      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', color)}>{value}</span>
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
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; lastBackup: string | null }>({ connected: false, lastBackup: null });
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<any[]>([]);
  const [backupPage, setBackupPage] = useState(1);
  const [isFetchingBackups, setIsFetchingBackups] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ status: string; progress: number } | null>(null);
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
    subService.initialize().then(s => setSubscriptionInfo(s)).catch(() => setSubscriptionInfo(subService.getState()));
    const interval = setInterval(fetchDriveStatus, 10000);
    const unsubscribe = window.api.onRestoreProgress?.((data: any) => setRestoreProgress(data));
    return () => { clearInterval(interval); unsubscribe?.(); };
  }, []);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) {
        const d = res.data as any;
        setSettings({
          ...defaultSettings, ...d,
          pos_password: d.pos_password || '1234',
          low_stock_threshold: d.low_stock_threshold ?? 10,
          receipt_size: d.receipt_size || 'thermal',
          invoice_style: d.invoice_style || 'thermal',
          invoice_notes: d.invoice_notes || '',
          auto_export_path: d.auto_export_path || '',
          auto_export_enabled: !!d.auto_export_enabled,
          owner_mobile: d.owner_mobile || d.store_phone || '',
          cloud_connected: !!d.cloud_connected,
          license_mode: d.license_mode === 'online' ? 'online' : 'offline',
          approval_status: d.approval_status === 'blocked' ? 'blocked' : d.approval_status === 'pending' ? 'pending' : 'approved',
          setup_completed: !!d.setup_completed,
        });
        if (d.store_logo) setPreviewLogo(d.store_logo);
      }
    } catch {
      addNotification('Error', 'Could not load settings.', 'error');
    }
  };

  const loadSyncStatus = async () => {
    const res = await window.api.getSyncStatus?.();
    if (res?.success && res.data) setSyncStatus(res.data);
  };

  const update = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      if (path) { update('auto_export_path', path); addNotification('Path Set', 'Save settings to apply.', 'info'); }
    } catch { addNotification('Error', 'Could not open folder picker.', 'error'); }
  };

  const handleManualExport = async () => {
    if (!settings.auto_export_path) { addNotification('Missing Path', 'Set a backup folder first.', 'warning'); return; }
    try {
      await window.api.performAutoExport();
      addNotification('Export Success', 'Manual backup performed.', 'success');
    } catch { addNotification('Export Failed', 'Could not perform export.', 'error'); }
  };

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    try {
      const res = await window.api.connectGoogleDrive();
      if (res.success) {
        addNotification('Google Drive Connected', 'Account linked successfully.', 'success');
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
      const backups = isArray ? res : (res?.backups || []);
      setAvailableBackups(backups);
      setBackupPage(1);
      if (backups.length === 0) addNotification('No Backups', 'No POS backups found in Google Drive.', 'info');
    } catch (err: any) {
      addNotification('Fetch Failed', err?.message || 'Could not list backups.', 'error');
    } finally { setIsFetchingBackups(false); }
  };

  const handleRestoreCloudBackup = async (fileId: string) => {
    if (!window.confirm('CRITICAL WARNING:\n\nThis will replace your current local data with the cloud backup. Continue?')) return;
    try {
      setRestoreProgress({ status: 'starting', progress: 0 });
      const res = await window.api.restoreCloudBackup(fileId);
      if (res.success) {
        addNotification('Restore Successful', 'Data restored. Reloading...', 'success');
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
      addNotification('Exporting', 'Compiling records...', 'info');
      const res = await window.api.exportData();
      if (res.success) {
        const a = document.createElement('a');
        a.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2)));
        a.setAttribute('download', `pos_backup_${new Date().toISOString().split('T')[0]}.json`);
        a.click();
        addNotification('Export Complete', 'JSON backup downloaded.', 'success');
      } else { addNotification('Export Failed', res.error || 'Export blocked.', 'error'); }
    } catch { addNotification('Error', 'Failed exporting JSON.', 'error'); }
  };

  const handleExportExcel = async () => {
    try {
      addNotification('Exporting', 'Compiling to Excel...', 'info');
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
      } else { addNotification('Export Failed', res.error || 'Export blocked.', 'error'); }
    } catch { addNotification('Error', 'Failed exporting Excel.', 'error'); }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('Warning: Importing will OVERWRITE your current database. Continue?')) { e.target.value = ''; return; }
    try {
      addNotification('Importing', 'Restoring records...', 'info');
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          const res = await window.api.importData(data);
          if (res.success) window.location.reload();
          else addNotification('Import Failed', res.error || 'Validation failed.', 'error');
        } catch { addNotification('Import Error', 'Invalid JSON structure.', 'error'); }
      };
      reader.readAsText(file);
    } catch { addNotification('Error', 'Failed to read file.', 'error'); }
  };

  const handleImportDb = async () => {
    if (!window.confirm('CRITICAL WARNING:\n\nRestoring a .db file will replace your current database. Continue?')) return;
    try {
      const filePath = await window.api.selectDbFile();
      if (!filePath) return;
      addNotification('Importing DB', 'Replacing database...', 'info');
      const res = await window.api.importDb(filePath);
      if (res.success) {
        addNotification('Import Successful', 'Database restored. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } else { addNotification('Import Failed', res.error || 'Could not replace database.', 'error'); }
    } catch (err: any) { addNotification('Error', 'Critical DB import error: ' + err.message, 'error'); }
  };

  const handleValidateLicense = async () => {
    if (!settings.activation_key.trim()) { addNotification('No Key', 'Enter a license key first.', 'info'); return; }
    setValidating(true);
    try {
      const res = await window.api.activateAppV2(settings.activation_key.trim());
      if (res.success) {
        addNotification('License Validated', 'License key activated.', 'success');
        update('license_mode', 'online');
      } else { addNotification('Validation Failed', res.error || 'Could not validate.', 'error'); }
    } finally { setValidating(false); }
  };

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalBackupPages = Math.max(1, Math.ceil(availableBackups.length / BACKUPS_PAGE_SIZE));
  const currentBackupPage = Math.min(backupPage, totalBackupPages);
  const pagedBackups = availableBackups.slice((currentBackupPage - 1) * BACKUPS_PAGE_SIZE, currentBackupPage * BACKUPS_PAGE_SIZE);
  const cloudReady = !!settings.cloud_backend_url && !!settings.cloud_backend_token;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-5xl pb-10">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your store, receipts, and data preferences</p>
        </div>
        <Button onClick={() => handleSave()} disabled={isSaving} className="gap-2 shrink-0 shadow-md shadow-primary/15">
          {isSaving ? <><RefreshCw size={15} className="animate-spin" />Saving...</> : <><Save size={15} />Save Settings</>}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Sidebar tabs ─────────────────────────────────────────────────── */}
        <nav className="lg:w-[196px] shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 lg:sticky lg:top-4 lg:self-start">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 whitespace-nowrap lg:whitespace-normal group',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-transparent'
                )}
              >
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors', isActive ? 'bg-primary/15' : 'bg-muted/60 group-hover:bg-accent')}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0 hidden lg:block">
                  <p className={cn('text-xs font-semibold leading-none', isActive && 'font-bold')}>{tab.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-none">{tab.desc}</p>
                </div>
                <span className="lg:hidden text-xs font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Tab content ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSave} className="space-y-5">

            {/* ══ GENERAL ════════════════════════════════════════════════════ */}
            {activeTab === 'general' && (
              <>
                {/* Language */}
                <SectionCard title={t('language')} desc="Select interface language / اپنی پسندیدہ زبان منتخب کریں" icon={Languages}>
                  <div className="flex gap-3">
                    <Button type="button" variant={language === 'en' ? 'default' : 'outline'} className="flex-1 h-12 gap-2 text-base" onClick={() => setLanguage('en')}>
                      🇺🇸 {t('english')}
                    </Button>
                    <Button type="button" variant={language === 'ur' ? 'default' : 'outline'} className="flex-1 h-12 gap-2 text-base font-urdu" onClick={() => setLanguage('ur')}>
                      🇵🇰 {t('urdu')}
                    </Button>
                  </div>
                </SectionCard>

                {/* Branding */}
                <SectionCard title="Company Branding" desc="Logo shown in the UI and on printed receipts" icon={ImageIcon}>
                  <div className="flex items-start gap-5">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn('w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-all bg-muted/20 shrink-0 group relative', previewLogo ? 'border-transparent' : 'border-border/50 hover:border-primary/40 hover:bg-muted/40')}
                    >
                      {previewLogo ? (
                        <>
                          <img src={previewLogo} alt="Logo" className="w-full h-full object-contain p-2 group-hover:opacity-30 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <UploadIcon size={18} className="text-foreground" />
                          </div>
                        </>
                      ) : (
                        <Store size={28} className="text-muted-foreground/30 group-hover:text-primary group-hover:opacity-100 transition-all" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-fit gap-1.5">
                        <Upload size={13} /> Upload Image
                      </Button>
                      <p className="text-xs text-muted-foreground">Square PNG or JPG, max 1 MB.</p>
                      {previewLogo && (
                        <button type="button" onClick={() => { setPreviewLogo(''); update('store_logo', ''); }} className="text-[11px] text-destructive hover:underline text-left w-fit">
                          Remove logo
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                </SectionCard>

                {/* Business info */}
                <SectionCard title="Business Information" desc="Appears on receipts, statements, and registration" icon={Building2}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field icon={<User />} label="Owner Full Name" value={settings.owner_full_name} onChange={v => update('owner_full_name', v)} placeholder="e.g. Munib Ahmad" />
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Username (Locked)</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" size={14} />
                          <Input className="pl-8 h-9 text-sm opacity-60" value={settings.owner_username} disabled placeholder="admin" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Store Name <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
                        <Input required value={settings.store_name} onChange={e => update('store_name', e.target.value)} placeholder="e.g. OsaTech Retail Shop" className="pl-8 h-9 text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field icon={<Phone />} label="Contact Phone" value={settings.store_phone} onChange={v => update('store_phone', v)} placeholder="+92 300 1234567" />
                      <Field icon={<Phone />} label="Mobile Number" value={settings.owner_mobile} onChange={v => { update('owner_mobile', v); update('store_phone', v); }} placeholder="+92 300 1234567" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field icon={<Mail />} label="Email (Optional)" value={settings.owner_email} onChange={v => update('owner_email', v)} placeholder="owner@example.com" type="email" />
                      {/* Receipt mini-preview */}
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3 relative">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Receipt Header Preview</p>
                        <div className="text-center">
                          <p className="font-bold text-sm">{settings.store_name || 'Store Name'}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{settings.store_phone || 'Phone'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Street Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-muted-foreground/60" size={14} />
                        <textarea
                          value={settings.store_address} rows={2}
                          onChange={e => update('store_address', e.target.value)}
                          placeholder="123 Main Street, Karachi"
                          className="w-full flex rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pl-9 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ══ RECEIPT ════════════════════════════════════════════════════ */}
            {activeTab === 'receipt' && (
              <>
                <SectionCard title="Receipt Footer" desc="Custom message printed at the bottom of every receipt" icon={FileText}>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-muted-foreground/50" size={14} />
                    <textarea
                      value={settings.receipt_footer} rows={2}
                      onChange={e => update('receipt_footer', e.target.value)}
                      placeholder="Thank you for visiting!"
                      className="w-full flex rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pl-9 resize-none"
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Print & Receipt Settings" desc="Choose paper size and invoice layout" icon={Printer}>
                  <div className="space-y-6">
                    {/* Paper size */}
                    <div className="space-y-3">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Default Paper Size</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'thermal', label: 'Thermal (80mm)', desc: 'Receipt roll' },
                          { value: 'a5',      label: 'A5 Paper',       desc: '148 × 210mm'  },
                          { value: 'a4',      label: 'A4 Paper',       desc: '210 × 297mm'  },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => update('receipt_size', opt.value)}
                            className={cn('flex flex-col items-center p-4 rounded-xl border-2 transition-all text-left cursor-pointer', settings.receipt_size === opt.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:border-primary/30 hover:bg-muted/30')}>
                            <div className={cn('mb-2 rounded border-2 flex items-center justify-center text-[10px] font-bold', settings.receipt_size === opt.value ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground', opt.value === 'thermal' ? 'w-5 h-10' : opt.value === 'a5' ? 'w-7 h-9' : 'w-7 h-10')}>
                              {opt.value === 'thermal' ? '80' : opt.value === 'a5' ? 'A5' : 'A4'}
                            </div>
                            <span className="text-xs font-semibold">{opt.label}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Invoice style */}
                    <div className="space-y-3 border-t border-border/50 pt-5">
                      <div>
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Invoice Style</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Compact receipt or structured formal invoice.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { value: 'thermal', label: '🧾 Thermal Receipt', desc: 'Compact scrollable — great for cash registers & quick sales' },
                          { value: 'formal',  label: '📄 Formal Invoice',  desc: 'Structured A4 with S.No, Qty, Unit Price, Amount & balance' },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => update('invoice_style', opt.value)}
                            className={cn('flex flex-col p-4 rounded-xl border-2 text-left transition-all cursor-pointer', settings.invoice_style === opt.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:border-primary/30 hover:bg-muted/30')}>
                            <span className="text-sm font-bold">{opt.label}</span>
                            <span className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Invoice notes */}
                    <div className="space-y-2 border-t border-border/50 pt-5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Invoice Notes / Terms</Label>
                      <p className="text-[11px] text-muted-foreground">Printed on every invoice (return policy, warranty, etc.)</p>
                      <textarea
                        value={settings.invoice_notes || ''} rows={3}
                        onChange={e => update('invoice_notes', e.target.value)}
                        placeholder={'• Warranty is 3 days only\n• No returns on software\n• Goods once sold cannot be returned'}
                        className="w-full flex rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                      />
                    </div>

                    {/* Live preview */}
                    <div className="space-y-3 border-t border-border/50 pt-5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Print Preview</Label>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                          onClick={() => {
                            const el = document.getElementById('receipt-preview');
                            if (!el) return;
                            const win = window.open('', '_blank', 'width=900,height=700');
                            if (!win) return;
                            win.document.write(`<!DOCTYPE html><html><head><title>Print Preview</title><style>@media print{body{margin:0;}}body{font-family:monospace;background:#f5f5f5;display:flex;justify-content:center;padding:20px;}.page{background:white;padding:24px;${settings.receipt_size === 'thermal' ? 'width:302px;' : settings.receipt_size === 'a5' ? 'width:559px;' : 'width:794px;'}box-shadow:0 2px 8px rgba(0,0,0,0.15);}</style></head><body><div class="page">${el.innerHTML}</div></body><script>window.onload=function(){window.print();}<\/script></html>`);
                            win.document.close();
                          }}>
                          <Printer size={13} /> Print Preview
                        </Button>
                      </div>
                      <div className="border-2 border-dashed border-border/50 rounded-xl overflow-hidden bg-white dark:bg-neutral-900 flex justify-center p-4">
                        <div id="receipt-preview" className={cn('font-mono text-[11px] leading-relaxed bg-white text-black transition-all', settings.receipt_size === 'thermal' ? 'w-[280px]' : settings.receipt_size === 'a5' ? 'w-[480px]' : 'w-[680px]')}>
                          <div className="text-center border-b pb-2 mb-2">
                            {previewLogo && <img src={previewLogo} alt="logo" className="h-10 mx-auto mb-1 object-contain" />}
                            <div className="font-bold text-sm">{settings.store_name || 'Store Name'}</div>
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
                          <div className="text-center mt-3 pt-2 border-t text-[10px] text-gray-500">{settings.receipt_footer || 'Thank you!'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ══ SECURITY ═══════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <SectionCard title="Security & Access" desc="Terminal PIN and inventory alert thresholds" icon={ShieldCheck}>
                <div className="space-y-6">
                  <div className="max-w-sm space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Terminal Login Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={14} />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={settings.pos_password}
                        onChange={e => update('pos_password', e.target.value)}
                        placeholder="Enter numeric PIN"
                        className="pl-8 pr-10 h-9 font-mono text-sm"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Used to unlock the dashboard and system lock screens.</p>
                  </div>

                  <div className="border-t border-border/50 pt-5 max-w-sm space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Low Stock Alert Threshold</Label>
                    <Input
                      type="number" min="0"
                      value={settings.low_stock_threshold}
                      onChange={e => update('low_stock_threshold', parseInt(e.target.value) || 0)}
                      placeholder="e.g. 10"
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">Items below this quantity trigger a warning in Inventory.</p>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ══ BACKUP ═════════════════════════════════════════════════════ */}
            {activeTab === 'backup' && (
              <>
                {/* Auto JSON backup */}
                <SectionCard title="Automated JSON Backup" desc="Auto-save to a local folder every 5 hours" icon={HardDrive}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Backup Folder</Label>
                      <div className="flex gap-2">
                        <Input value={settings.auto_export_path} readOnly placeholder="No folder selected..." className="h-9 bg-muted/30 text-xs font-mono flex-1" />
                        <Button type="button" size="sm" variant="outline" onClick={handleSelectDirectory} className="h-9 shrink-0">Browse</Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={settings.auto_export_enabled} onChange={e => update('auto_export_enabled', e.target.checked)} className="w-4 h-4 accent-primary" />
                        <span className="text-xs font-medium">Enable Auto-Backup</span>
                      </label>
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-7 text-primary hover:bg-primary/10 gap-1" onClick={handleManualExport} disabled={!settings.auto_export_path}>
                        <Save size={12} /> Export Now
                      </Button>
                    </div>
                  </div>
                </SectionCard>

                {/* Google Drive */}
                <SectionCard title="Google Drive Backup" desc="Secure cloud backup with automatic weekly sync" icon={Cloud} accent="linear-gradient(90deg,#3b82f6,#6366f1)">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {driveStatus.connected
                          ? <><CheckCircle2 size={15} className="text-emerald-500" /><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Connected to Google Drive</span></>
                          : <><CloudOff size={15} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">Not linked</span></>}
                      </div>
                      <span className={cn('text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border', driveStatus.connected ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border/60')}>
                        {driveStatus.connected ? 'Active' : 'Offline'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { icon: Globe, bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Mode', value: 'Cloud Sync' },
                        { icon: ShieldCheck, bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Security', value: 'AES-256' },
                        { icon: Activity, bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Last Backup', value: formatLastBackup(driveStatus.lastBackup) },
                      ].map(item => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-3">
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.bg)}><Icon size={15} /></div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
                              <p className="text-xs font-bold">{item.value}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {!driveStatus.connected ? (
                        <>
                          <Button type="button" onClick={handleConnectDrive} disabled={isConnecting} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
                            {isConnecting ? <><Loader2 size={15} className="animate-spin" />Linking...</> : <><Globe size={15} />Link Google Drive</>}
                          </Button>
                          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex-1">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <p className="text-[11px] font-medium leading-relaxed">Your data is stored only on this machine. Link Drive to protect against hardware failure.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Button type="button" onClick={handleDriveBackup} disabled={isBackingUp} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                            {isBackingUp ? <><Loader2 size={15} className="animate-spin" />Syncing...</> : <><RefreshCw size={15} />Backup Now</>}
                          </Button>
                          <div className="flex items-center gap-2 text-[11px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/8 border border-blue-500/15 px-3 py-2 rounded-lg">
                            <CheckCircle2 size={13} /> Weekly automatic backups enabled.
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Cloud backup list */}
                {driveStatus.connected && (
                  <SectionCard title="Available Cloud Backups" desc="Recent snapshots found in your Google Drive" icon={Download}>
                    <div className="flex justify-end mb-3">
                      <Button type="button" variant="outline" size="sm" onClick={handleFetchBackups} disabled={isFetchingBackups} className="h-8 text-xs gap-1.5">
                        {isFetchingBackups ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh List
                      </Button>
                    </div>
                    {availableBackups.length > 0 ? (
                      <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/50">
                        {pagedBackups.map(b => (
                          <div key={b.id} className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors">
                            <div>
                              <p className="text-xs font-semibold">{b.name}</p>
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1"><Database size={9} />{formatSize(b.size)}</span>
                                <span>{new Date(b.date).toLocaleString()}</span>
                              </div>
                            </div>
                            <Button type="button" size="sm" variant="secondary" className="h-7 text-xs px-3" onClick={() => handleRestoreCloudBackup(b.id)}>
                              Restore
                            </Button>
                          </div>
                        ))}
                        {availableBackups.length > BACKUPS_PAGE_SIZE && (
                          <div className="p-3 flex items-center justify-between bg-muted/10">
                            <p className="text-[10px] text-muted-foreground">
                              {Math.min((currentBackupPage-1)*BACKUPS_PAGE_SIZE+1, availableBackups.length)}–{Math.min(currentBackupPage*BACKUPS_PAGE_SIZE, availableBackups.length)} of {availableBackups.length}
                            </p>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={currentBackupPage<=1} onClick={() => setBackupPage(p => Math.max(1,p-1))}>Prev</Button>
                              <span className="text-[11px] font-medium text-muted-foreground">Page {currentBackupPage}/{totalBackupPages}</span>
                              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={currentBackupPage>=totalBackupPages} onClick={() => setBackupPage(p => Math.min(totalBackupPages,p+1))}>Next</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <Cloud size={22} className="mx-auto text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground">No backups listed. Click Refresh to scan Drive.</p>
                      </div>
                    )}
                  </SectionCard>
                )}

                {/* Data management */}
                <SectionCard title="Data Management" desc="Export, import, or restore your database" icon={Database} accent="linear-gradient(90deg,#ef4444,#f97316)">
                  <div className="space-y-3">
                    {[
                      {
                        icon: Download, color: 'text-primary', bg: 'bg-primary/8',
                        title: 'Export Data', desc: 'Download a full backup in JSON or Excel format.',
                        action: <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={handleExportData} className="text-xs h-8">JSON</Button>
                          <Button type="button" variant="outline" onClick={handleExportExcel} className="text-xs h-8">Excel</Button>
                        </div>
                      },
                      {
                        icon: Upload, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8',
                        title: 'Restore Database (.db)', desc: 'Import a raw SQLite database file. Best for full restores.',
                        action: <Button type="button" variant="outline" onClick={handleImportDb} className="text-xs h-8 gap-1.5"><Database size={12} />Select DB File</Button>
                      },
                      {
                        icon: Upload, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/8',
                        title: 'Restore JSON Backup', desc: 'Import a JSON payload to restore the database.',
                        action: (
                          <>
                            <Button type="button" variant="outline" onClick={() => document.getElementById('import-file')?.click()} className="text-xs h-8 gap-1.5"><Upload size={12} />Import File</Button>
                            <input id="import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
                          </>
                        )
                      },
                    ].map((row, i) => {
                      const Icon = row.icon;
                      return (
                        <div key={i} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card/50">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', row.bg)}>
                              <Icon size={15} className={row.color} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold">{row.title}</h4>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{row.desc}</p>
                            </div>
                          </div>
                          <div className="shrink-0">{row.action}</div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ══ LICENSE ════════════════════════════════════════════════════ */}
            {activeTab === 'license' && (
              <>
                <SectionCard title="License Information" desc="License is optional for offline POS use" icon={KeyRound}>
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mode</Label>
                        <Select value={settings.license_mode} onValueChange={(v: 'offline'|'online') => update('license_mode', v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="offline">Offline</SelectItem>
                            <SelectItem value="online">Online License</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">License Key</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
                          <Input className="pl-8 h-9 text-sm font-mono" value={settings.activation_key} onChange={e => update('activation_key', e.target.value)} placeholder="Optional" />
                        </div>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="outline" onClick={handleValidateLicense} disabled={validating} className="h-9 text-xs whitespace-nowrap gap-1.5">
                          {validating ? <><Loader2 size={12} className="animate-spin" />Checking...</> : <><CheckCircle2 size={12} />Validate</>}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className={cn('text-[10px] font-black px-2.5 py-1 rounded-full border', settings.license_mode === 'offline' ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20')}>
                        {settings.license_mode === 'offline' ? 'Offline-first' : 'Online license'}
                      </span>
                      <span className={cn('text-[10px] font-black px-2.5 py-1 rounded-full border', settings.approval_status === 'blocked' ? 'bg-red-500/10 text-red-600 border-red-500/20' : settings.approval_status === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20')}>
                        {settings.approval_status}
                      </span>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Local SQLite active
                      </span>
                    </div>
                  </div>
                </SectionCard>

                {/* Cloud / API */}
                <SectionCard title="Cloud / API Configuration" desc="Optional sync endpoint — SQLite remains primary" icon={cloudReady ? Cloud : CloudOff}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field icon={<Cloud />} label="API Base URL" value={settings.cloud_backend_url} onChange={v => update('cloud_backend_url', v)} placeholder="https://api.example.com" />
                      <Field icon={<ShieldCheck />} label="Auth Token" value={settings.cloud_backend_token} onChange={v => update('cloud_backend_token', v)} placeholder="Bearer token" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatusPill label="Cloud" value={cloudReady ? 'Configured' : 'Offline'} tone={cloudReady ? 'success' : 'neutral'} />
                      <StatusPill label="Pending" value={`${syncStatus.pending}`} tone={syncStatus.pending > 0 ? 'warning' : 'success'} />
                      <StatusPill label="Failed" value={`${syncStatus.failed}`} tone={syncStatus.failed > 0 ? 'danger' : 'success'} />
                      <StatusPill label="Last Sync" value={syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString('en-PK',{hour:'2-digit',minute:'2-digit',hour12:true}) : 'Never'} tone="neutral" />
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── Save footer ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-end pt-4 border-t border-border/50">
              <Button type="submit" disabled={isSaving} className="gap-2 px-8 shadow-md shadow-primary/15">
                {isSaving ? <><RefreshCw size={15} className="animate-spin" />Saving...</> : <><Save size={15} />Save Settings</>}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Restore progress overlay */}
      {restoreProgress && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <Loader2 className="animate-spin text-primary mx-auto mb-3" size={28} />
              <h3 className="font-bold text-sm">
                {restoreProgress.status === 'downloading' ? 'Downloading from Cloud...' : 'Restoring Database...'}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">Do not close the application.</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>{restoreProgress.status}</span>
                <span>{restoreProgress.progress}%</span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.4)]" style={{ width: `${restoreProgress.progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Upload, Store, Phone, MapPin, FileText, Lock,
  Image as ImageIcon, Database, Download, Trash2, ShieldCheck, Eye, EyeOff, Zap, Activity, RefreshCw, Printer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useNotifications } from '../components/NotificationProvider';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

interface SettingsData {
  store_name: string;
  store_phone: string;
  store_address: string;
  store_logo: string;
  receipt_footer: string;
  pos_password: string;
  low_stock_threshold: number;
  receipt_size: string; // 'thermal' | 'a4' | 'a5'
  auto_export_path: string;
  auto_export_enabled: boolean;
}

const defaultSettings: SettingsData = {
  store_name: '', store_phone: '', store_address: '',
  store_logo: '', receipt_footer: 'Thank you for visiting!', pos_password: '1234',
  low_stock_threshold: 10,
  receipt_size: 'thermal',
  auto_export_path: '',
  auto_export_enabled: false,
};

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [previewLogo, setPreviewLogo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addNotification } = useNotifications();

  useEffect(() => {
    loadSettings();

    // Listen for auto-export notifications from the main process
    const cleanup = window.api.onAutoExportComplete((data: any) => {
      if (data.success) {
        addNotification("Auto-Saved", `Database backed up to ${data.path}`, "success");
      }
    });

    return cleanup;
  }, []);

  const loadSettings = async () => {
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) {
        setSettings({
          ...(res.data as any),
          pos_password: res.data.pos_password || '1234',
          low_stock_threshold: res.data.low_stock_threshold ?? 10,
          receipt_size: (res.data as any).receipt_size || 'thermal',
          auto_export_path: res.data.auto_export_path || '',
          auto_export_enabled: !!res.data.auto_export_enabled,
        });
        if (res.data.store_logo) setPreviewLogo(res.data.store_logo);
      }
    } catch {
      addNotification("Error", "Could not load settings payload from database.", "error");
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPreviewLogo(url);
      setSettings({ ...settings, store_logo: url });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectDirectory = async () => {
    try {
      const path = await window.api.selectDirectory();
      if (path) {
        setSettings({ ...settings, auto_export_path: path });
        addNotification("Backup Path Set", `Path updated. Please save settings to apply.`, "info");
      }
    } catch (e) {
      addNotification("Error", "Could not open folder picker", "error");
    }
  };

  const handleManualExport = async () => {
    if (!settings.auto_export_path) {
      addNotification("Missing Path", "Please set a backup folder first.", "warning");
      return;
    }
    try {
      await window.api.performAutoExport();
      addNotification("Export Success", "Manual backup performed successfully.", "success");
    } catch (e) {
      addNotification("Export Failed", "Could not perform manual export.", "error");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await window.api.updateSettings(settings);
      if (res.success) {
        addNotification("Settings Saved", "Your operational preferences have been updated.", "success");
      } else {
        addNotification("Save Failed", res.error || "A database error occurred.", "error");
      }
    } catch {
      addNotification("Error", "Critical fault saving settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!window.confirm('CRITICAL WARNING:\n\nThis will permanently delete ALL data (products, sales, customers, analytics) and reset settings to default.\n\nThis action CANNOT be undone. Are you absolutely sure?')) {
      return;
    }

    if (!window.confirm('FINAL CONFIRMATION:\n\nType OK to confirm the complete wipe.')) return;

    try {
      addNotification("Wiping Data", "Clearing all records...", "warning");
      const res = await window.api.deleteAllData();
      if (res.success) {
        window.location.reload();
      } else {
        addNotification("Wipe Failed", "Error deleting data: " + res.error, "error");
      }
    } catch (err) {
      addNotification("Error", "Critical execution error deleting data.", "error");
    }
  };

  const handleSeedDatabase = async () => {
    if (!window.confirm("Are you sure you want to seed the database with 1,000+ records? This will add 100 customers, 200 products, and 500 sales. It might take a moment.")) return;

    setIsSaving(true);
    try {
      addNotification("Seeding Started", "Populating database with demo data...", "info");
      const res = await window.api.seedDatabase();
      if (res.success) {
        addNotification("Seeding Complete", "Database successfully populated with demo data.", "success");
        window.location.reload(); // Reload to show new data
      } else {
        addNotification("Seeding Failed", res.error || "Unknown error", "error");
      }
    } catch (err: any) {
      addNotification("Seeding Error", err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      addNotification("Exporting Data", "Compiling system records...", "info");
      const res = await window.api.exportData();
      if (res.success) {
        const dataStr = JSON.stringify(res.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        addNotification("Export Complete", "Data backup downloaded successfully.", "success");
      } else {
        addNotification("Export Failed", res.error || "System constraints blocked export.", "error");
      }
    } catch (err) {
      addNotification("Error", "Failed exporting JSON blob.", "error");
    }
  };

  const handleExportExcel = async () => {
    try {
      addNotification("Exporting Data", "Compiling system records to Excel...", "info");
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
        addNotification("Export Complete", "Data backup downloaded successfully.", "success");
      } else {
        addNotification("Export Failed", res.error || "System constraints blocked export.", "error");
      }
    } catch (err) {
      addNotification("Error", "Failed exporting Excel file.", "error");
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Warning: Importing data will OVERWRITE your current database. Make sure you have a backup. Continue?')) {
      e.target.value = '';
      return;
    }

    try {
      addNotification("Importing Data", "Restoring system records...", "info");
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const res = await window.api.importData(data);
          if (res.success) {
            window.location.reload();
          } else {
            addNotification("Import Failed", res.error || "JSON constraints validation failed.", "error");
          }
        } catch (err) {
          addNotification("Import Error", "Invalid JSON file structure.", "error");
        }
      };
      reader.readAsText(file);
    } catch (err) {
      addNotification("Error", "Failed to read file buffer.", "error");
    }
  };

  const handleStressTest = async () => {
    if (!window.confirm('Simulate 1,000 rapid checkouts directly into your database? This will pad your statistics for performance benchmarking but proves system scale.')) return;

    setIsSaving(true);
    addNotification("Benchmarking", "Commencing 1,000 extreme rapid checkouts via IPC...", "info");

    try {
      const start = performance.now();
      const promises = [];
      const stressItems = [{ product_name: 'Engine Benchmark Test', quantity: Math.floor(Math.random() * 5) + 1, price: 100, is_custom: true }];

      for (let i = 0; i < 1000; i++) {
        promises.push(window.api.createSale({
          total: 100 * stressItems[0].quantity,
          subtotal: 100 * stressItems[0].quantity,
          discount: 0,
          tax: 0,
          payment_method: i % 2 === 0 ? 'online' : 'cash',
          items: stressItems
        }));
      }

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.success);
      const end = performance.now();

      if (failed.length > 0) {
        addNotification("Stress Test Yield", `Processed with ${failed.length} failures out of 1000. Check logs.`, "error");
      } else {
        addNotification(
          "Benchmark Passed ✅",
          `Flawlessly wrote 1,000 simulated checkouts to disk in ${((end - start) / 1000).toFixed(2)} seconds! Zero UI blocks.`,
          "success"
        );
      }
    } catch (e) {
      addNotification("Error", "Stress test was tragically interrupted.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-4xl pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your restaurant defaults and operational parameters</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

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
                  "w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-colors bg-muted/20 shrink-0 group relative",
                  previewLogo ? "border-transparent" : "border-border hover:border-primary hover:bg-muted/50"
                )}
              >
                {previewLogo ? (
                  <>
                    <img src={previewLogo} alt="Logo" className="w-full h-full object-contain p-2 group-hover:opacity-30 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload size={20} className="text-foreground" />
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
                <p className="text-xs text-muted-foreground">Recommended format: Square PNG or JPG, max 1MB.</p>
                {previewLogo && (
                  <Button type="button" variant="link" size="sm" onClick={() => { setPreviewLogo(''); setSettings({ ...settings, store_logo: '' }); }} className="h-auto p-0 text-destructive justify-start w-fit">
                    Remove current logo
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store size={18} className="text-primary" /> Store Information
            </CardTitle>
            <CardDescription>Details printed externally</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Restaurant Name <span className="text-destructive">*</span></label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" size={16} />
                <Input required value={settings.store_name} onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} placeholder="e.g. The Golden Fork" className="pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" size={16} />
                  <Input type="tel" value={settings.store_phone} onChange={(e) => setSettings({ ...settings, store_phone: e.target.value })} placeholder="+92 300 1234567" className="pl-9" />
                </div>
              </div>
              <div className="space-y-2 border border-dashed rounded-lg p-3 bg-muted/10 relative overflow-hidden group">
                {/* Mini Invoice Preview within form */}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase absolute top-2 left-3">Receipt Preview Header</p>
                <div className="mt-4 text-center">
                  <p className="font-bold text-sm text-foreground">{settings.store_name || 'Restaurant Name'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{settings.store_phone || 'Phone Number'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Street Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-muted-foreground opacity-50" size={16} />
                <textarea
                  value={settings.store_address} rows={2}
                  onChange={(e) => setSettings({ ...settings, store_address: e.target.value })}
                  placeholder="123 Main Street, Karachi"
                  className="w-full flex rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9 resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={18} className="text-primary" /> Receipt Footer
            </CardTitle>
            <CardDescription>Custom message shown at the end of each print</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-muted-foreground opacity-50" size={16} />
                <textarea
                  value={settings.receipt_footer} rows={2}
                  onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                  placeholder="Thank you for visiting!"
                  className="w-full flex rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-9 resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" /> Security & Access
            </CardTitle>
            <CardDescription>Protect application launch with a secure PIN</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-sm">
              <label className="text-sm font-semibold">Terminal Login Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" size={16} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.pos_password}
                  onChange={(e) => setSettings({ ...settings, pos_password: e.target.value })}
                  placeholder="Enter numeric PIN"
                  className="pl-9 pr-10 font-mono"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-2 max-w-sm mt-4">
              <label className="text-sm font-semibold">Low Stock Alert Threshold</label>
              <div className="relative group">
                <Input
                  type="number"
                  min="0"
                  value={settings.low_stock_threshold}
                  onChange={(e) => setSettings({ ...settings, low_stock_threshold: parseInt(e.target.value) || 0 })}
                  placeholder="e.g. 10"
                  className="pl-3"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Items falling below this quantity will trigger a warning in the Inventory.</p>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t flex items-center justify-between p-4">
            <div />
            <Button type="submit" disabled={isSaving} className="shadow-md transition-all gap-2">
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </Card>

        {/* Print & Receipt Settings */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer size={18} className="text-primary" /> Print & Receipt Settings
            </CardTitle>
            <CardDescription>Choose default paper size for invoices and reports. A live preview is shown below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Size selector */}
            <div className="space-y-3">
              <label className="text-sm font-semibold">Default Receipt / Invoice Size</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'thermal', label: 'Thermal (80mm)', desc: 'Standard receipt roll' },
                  { value: 'a5', label: 'A5 Paper', desc: '148 × 210 mm' },
                  { value: 'a4', label: 'A4 Paper', desc: '210 × 297 mm' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSettings({ ...settings, receipt_size: opt.value })}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${settings.receipt_size === opt.value
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border/50 hover:border-primary/40 hover:bg-muted/30'
                      }`}
                  >
                    {/* Paper icon */}
                    <div className={`mb-2 rounded border-2 flex items-center justify-center text-xs font-bold ${settings.receipt_size === opt.value ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground'
                      } ${opt.value === 'thermal' ? 'w-6 h-12' : opt.value === 'a5' ? 'w-8 h-11' : 'w-8 h-12'}`}>
                      {opt.value === 'thermal' ? '80' : opt.value === 'a5' ? 'A5' : 'A4'}
                    </div>
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Live Print Preview</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const previewEl = document.getElementById('receipt-preview');
                    if (!previewEl) return;
                    const win = window.open('', '_blank', 'width=900,height=700');
                    if (!win) return;
                    win.document.write(`
                      <!DOCTYPE html><html><head>
                      <title>Print Preview — ${settings.store_name || 'Receipt'}</title>
                      <style>
                        @media print { body { margin: 0; } }
                        body { font-family: monospace; background: #f5f5f5; display:flex; justify-content:center; padding: 20px; }
                        .page { background: white; padding: 24px; ${settings.receipt_size === 'thermal' ? 'width:302px;' :
                        settings.receipt_size === 'a5' ? 'width:559px;' : 'width:794px;'
                      } box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
                      </style></head>
                      <body><div class="page">${previewEl.innerHTML}</div></body>
                      <script>window.onload=function(){window.print();}</script>
                      </html>
                    `);
                    win.document.close();
                  }}
                >
                  <Printer size={14} /> Print Preview
                </Button>
              </div>

              <div className={`border-2 border-dashed rounded-xl overflow-hidden bg-white dark:bg-neutral-900 flex justify-center p-4 transition-all`}>
                <div
                  id="receipt-preview"
                  className={`font-mono text-[11px] leading-relaxed bg-white text-black transition-all ${settings.receipt_size === 'thermal' ? 'w-[280px]' :
                    settings.receipt_size === 'a5' ? 'w-[480px]' : 'w-[680px]'
                    }`}
                >
                  <div className="text-center border-b pb-2 mb-2">
                    {previewLogo && <img src={previewLogo} alt="logo" className="h-12 mx-auto mb-1 object-contain" />}
                    <div className="font-bold text-base">{settings.store_name || 'Store Name'}</div>
                    {settings.store_phone && <div>{settings.store_phone}</div>}
                    {settings.store_address && <div className="text-[10px]">{settings.store_address}</div>}
                  </div>
                  <div className="flex justify-between border-b pb-1 mb-1">
                    <span>Date:</span><span>{new Date().toLocaleDateString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1 mb-1">
                    <span>Invoice #:</span><span>#0001-SAMPLE</span>
                  </div>
                  <div className="border-b pb-2 mb-2">
                    <div className="flex justify-between font-bold">
                      <span className="flex-1">Item</span>
                      <span className="w-10 text-right">Qty</span>
                      <span className="w-20 text-right">Price</span>
                      <span className="w-20 text-right">Total</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex-1">Sample Product</span>
                      <span className="w-10 text-right">2</span>
                      <span className="w-20 text-right">PKR 500</span>
                      <span className="w-20 text-right">PKR 1,000</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t pt-1">
                    <span>TOTAL</span><span>PKR 1,000</span>
                  </div>
                  <div className="text-center mt-3 pt-2 border-t text-[10px] text-gray-500">
                    {settings.receipt_footer || 'Thank you for your purchase!'}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Preview updates live. Click "Print Preview" to open in a printable window.</p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-sm border-destructive/30 overflow-hidden">
          <div className="h-1 w-full bg-destructive" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Database size={18} /> Data Management
            </CardTitle>
            <CardDescription>Backup your database or permanently erase limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 border rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Download size={16} className="text-primary" /> Export Data</h4>
                <p className="text-xs text-muted-foreground mt-1">Export your complete database to JSON or Excel format for backups or reporting.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <Button type="button" variant="outline" onClick={handleExportData} className="w-full sm:w-auto shadow-sm gap-2">
                  JSON
                </Button>
                <Button type="button" variant="outline" onClick={handleExportExcel} className="w-full sm:w-auto shadow-sm gap-2">
                  Excel
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-primary"><ShieldCheck size={16} /> Automated JSON Backup</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Save a copy of your whole data automatically to a folder of your choice every 5 hours (and after settings changes).</p>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Backup Location</span>
                    <div className="flex gap-2">
                      <Input
                        value={settings.auto_export_path}
                        readOnly
                        placeholder="No folder selected..."
                        className="h-9 bg-background/50 text-xs font-mono"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={handleSelectDirectory}>
                        Browse
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settings.auto_export_enabled}
                        onChange={(e) => setSettings({ ...settings, auto_export_enabled: e.target.checked })}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-xs font-medium">Enable Auto-Backup</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-7 text-primary hover:bg-primary/10"
                      onClick={handleManualExport}
                      disabled={!settings.auto_export_path}
                    >
                      Save & Export Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 border rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Upload size={16} className="text-blue-500" /> Restore Backup</h4>
                <p className="text-xs text-muted-foreground mt-1">Import a JSON payload to completely restore the database. This replaces current data.</p>
              </div>
              <div className="w-full sm:w-auto shrink-0">
                <Button type="button" variant="outline" onClick={() => document.getElementById('import-file')?.click()} className="w-full shadow-sm gap-2">
                  <Upload size={14} /> Import File
                </Button>
                <input id="import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 border border-purple-500/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-purple-600"><Zap size={16} className="text-purple-500" /> System Stress Test</h4>
                <p className="text-xs text-muted-foreground mt-1">Simulate 1,000 extreme concurrent checkouts instantaneously to benchmark engine payload throughput.</p>
              </div>
              <Button type="button" variant="outline"
                onClick={handleStressTest}
                disabled={isSaving} className="w-full sm:w-auto shrink-0 shadow-sm gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                <Zap size={14} /> Run Benchmark
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-blue-600 flex items-center gap-2"><Activity size={16} /> Fill with Demo Data</h4>
                <p className="text-xs text-muted-foreground mt-1">Populate the app with 100 customers, 200 products, 150 vendors, and 500 sales for testing.</p>
              </div>
              <Button type="button" variant="outline"
                onClick={handleSeedDatabase}
                disabled={isSaving} className="w-full sm:w-auto shrink-0 shadow-sm gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                <Database size={14} /> Seed 1,000+ Records
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-destructive/5 border border-destructive/20 rounded-xl gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-destructive flex items-center gap-2"><Trash2 size={16} /> Wipe System</h4>
                <p className="text-xs text-destructive/80 mt-1">Permanently delete all sales, products, and customers. Factory resets the system.</p>
              </div>
              <Button type="button" variant="destructive"
                onClick={handleDeleteAllData}
                className="w-full sm:w-auto shrink-0 shadow-md gap-2 font-bold">
                <Trash2 size={15} /> Terminate Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end pt-6 border-t mt-6">
          <Button type="submit" disabled={isSaving} className="gap-2 px-8 shadow-lg shadow-primary/20">
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? 'Saving Changes...' : 'Save All Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}

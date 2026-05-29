import React from 'react';
import { motion } from 'framer-motion';
import {
  Code2, Phone, ShieldCheck, CheckCircle2, AlertTriangle, Database,
  GitBranch, Cpu, WifiOff, Mail, Layers, Lock, Globe,
  ShoppingCart, Users, Package, BarChart3, CreditCard, Wallet,
  FileText, Settings, RefreshCw, Truck, Receipt, Calculator,
  Building2, UserCheck, ArrowLeftRight, ClipboardList,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: 'easeOut' },
  }),
};

const LICENSE_ITEMS = [
  { num: '01', title: 'Single-Device License', desc: 'This software is licensed for use on a single device per activation key. Installing or using this software on multiple devices simultaneously is not permitted without purchasing additional licenses.' },
  { num: '02', title: 'No Redistribution', desc: 'You may not copy, share, sell, sublicense, or distribute this software or your activation key to any third party. Unauthorized distribution is a violation of this agreement.' },
  { num: '03', title: 'Ownership', desc: 'This software and all its associated intellectual property remain the exclusive property of Munib Ahmad (OsaTech). This license grants you the right to use the software, not ownership of the software itself.' },
  { num: '04', title: 'Support & Updates', desc: 'Technical support and software updates may be provided at the sole discretion of the developer. Contact OsaTech at 0329-8748232 (WhatsApp) or munibahmad4735@gmail.com for assistance or renewals.' },
  { num: '05', title: 'Limitation of Liability', desc: 'The developer is not liable for any data loss, business interruption, or damages arising from the use of this software. Always maintain regular backups using the Export / Backup feature in Settings.' },
  { num: '06', title: 'Acceptance', desc: 'By activating and using this software, you agree to all the terms and conditions outlined in this license agreement.' },
];

const TECH_LAYERS = [
  { layer: 'UI', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.18)', items: ['React 19', 'TypeScript 5', 'Tailwind CSS', 'Framer Motion', 'shadcn/ui'] },
  { layer: 'Desktop', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.18)', items: ['Electron 41', 'Node.js', 'Chromium Engine', 'IPC Bridge'] },
  { layer: 'Database', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', items: ['SQLite 3', 'better-sqlite3', 'Atomic Transactions', 'JSON Export', 'XLSX Export'] },
  { layer: 'Storage', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)', items: ['Local AppData', 'Encrypted Keys', 'Auto Backups', 'PDF Invoices', 'Google Drive'] },
];

const MODULES = [
  { icon: ShoppingCart, label: 'Point of Sale', desc: 'Barcode scan, cart management, discounts, multiple payment methods, receipt printing', color: 'emerald' },
  { icon: Package, label: 'Inventory', desc: 'Stock tracking, category management, low-stock alerts, batch inventory, analytics', color: 'blue' },
  { icon: Users, label: 'Customer Ledger', desc: 'AR tracking, payment history, credit management, WhatsApp receipts, account statements', color: 'violet' },
  { icon: Truck, label: 'Vendor Management', desc: 'AP tracking, purchase orders, vendor payments, purchase returns, vendor statements', color: 'amber' },
  { icon: BarChart3, label: 'Balance Sheet', desc: 'T-account format, Assets/Liabilities/Equity, financial ratios, Excel export, Zakat calculator', color: 'indigo' },
  { icon: Receipt, label: 'Expenses & Payroll', desc: 'Expense categories, employee records, salary management, payroll history', color: 'rose' },
  { icon: CreditCard, label: 'Cash Register', desc: 'Opening/closing balance, session tracking, cash reconciliation, register history', color: 'teal' },
  { icon: Wallet, label: 'Accounts Module', desc: 'Cash & bank accounts, deposits/withdrawals, transfers, running balances', color: 'cyan' },
  { icon: ArrowLeftRight, label: 'Returns & Adjustments', desc: 'Sale returns, purchase returns, stock adjustments, credit notes', color: 'orange' },
  { icon: ClipboardList, label: 'Reports', desc: 'Profit & Loss, daily close, payment ledger, transaction history, custom date ranges', color: 'fuchsia' },
  { icon: UserCheck, label: 'Employee Management', desc: 'Staff records, roles, monthly salary, phone contact, payroll integration', color: 'lime' },
  { icon: Calculator, label: 'Zakat Calculator', desc: 'Auto-calculates Zakat on net zakatable assets (inventory + receivables − payables) at 2.5%', color: 'green' },
  { icon: FileText, label: 'Invoice System', desc: 'Thermal receipt & formal A4 invoice, custom footer, logo, PDF save, WhatsApp share', color: 'sky' },
  { icon: Settings, label: 'Settings & Backup', desc: 'Store profile, password lock, auto-export, Google Drive backup, data import/export', color: 'slate' },
];

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  blue: 'bg-blue-500/10 text-blue-600 border-blue-200',
  violet: 'bg-violet-500/10 text-violet-600 border-violet-200',
  amber: 'bg-amber-500/10 text-amber-600 border-amber-200',
  indigo: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  rose: 'bg-rose-500/10 text-rose-600 border-rose-200',
  teal: 'bg-teal-500/10 text-teal-600 border-teal-200',
  cyan: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  orange: 'bg-orange-500/10 text-orange-600 border-orange-200',
  fuchsia: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-200',
  lime: 'bg-lime-500/10 text-lime-600 border-lime-200',
  green: 'bg-green-500/10 text-green-600 border-green-200',
  sky: 'bg-sky-500/10 text-sky-600 border-sky-200',
  slate: 'bg-slate-500/10 text-slate-600 border-slate-200',
};

export default function About() {
  return (
    <div className="flex flex-col gap-5 max-w-3xl pb-12 mx-auto w-full">

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #0b0f1a 0%, #131836 45%, #0d1117 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute -top-28 right-0 w-[360px] h-[360px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 -left-8 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 65%)' }} />
        <div className="absolute top-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent 5%, rgba(99,102,241,0.6) 40%, rgba(139,92,246,0.5) 60%, transparent 95%)' }} />

        <div className="relative z-10 p-8">
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 border"
              style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-[0.15em]">Active Development</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 border"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <GitBranch size={10} className="text-white/40" />
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">v2.0 Stable</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 border"
              style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }}>
              <Building2 size={10} className="text-indigo-400" />
              <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider">OsaTech</span>
            </div>
          </div>

          <div className="flex items-center gap-5 mb-8">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-2xl blur-xl"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center border"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  borderColor: 'rgba(255,255,255,0.15)',
                  boxShadow: '0 0 0 4px rgba(99,102,241,0.15), 0 8px 32px rgba(99,102,241,0.3)',
                }}>
                <Code2 size={26} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Software Developer · OsaTech
              </p>
              <h1 className="text-[28px] font-black text-white tracking-tight leading-none">Munib Ahmad</h1>
              <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                OsaTech Retailer POS · Complete Business Management for Pakistani Shops
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-7">
            {[
              { Icon: Phone, text: '0329-8748232 (WhatsApp)', rgb: '16,185,129' },
              { Icon: Mail, text: 'munibahmad4735@gmail.com', rgb: '59,130,246' },
            ].map(({ Icon, text, rgb }) => (
              <div key={text}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium select-all cursor-text"
                style={{ background: `rgba(${rgb},0.1)`, borderColor: `rgba(${rgb},0.22)`, color: `rgba(${rgb},1)`, filter: 'brightness(1.6)' }}
              >
                <Icon size={12} className="opacity-70 shrink-0" />
                {text}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Electron 41', rgb: '59,130,246' },
              { label: 'React 19', rgb: '6,182,212' },
              { label: 'TypeScript 5', rgb: '99,102,241' },
              { label: 'SQLite 3', rgb: '245,158,11' },
              { label: 'Tailwind CSS', rgb: '20,184,166' },
              { label: 'Framer Motion', rgb: '236,72,153' },
              { label: 'better-sqlite3', rgb: '245,158,11' },
              { label: 'xlsx', rgb: '16,185,129' },
            ].map(t => (
              <span key={t.label}
                className="text-[10px] px-2.5 py-1 rounded-lg border font-semibold"
                style={{ background: `rgba(${t.rgb},0.12)`, borderColor: `rgba(${t.rgb},0.28)`, color: `rgb(${t.rgb})` }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent 10%, rgba(99,102,241,0.2) 50%, transparent 90%)' }} />
      </motion.div>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Version', value: 'v2.0', sub: 'Stable Release', Icon: GitBranch, cls: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Modules', value: '14+', sub: 'Business Modules', Icon: Layers, cls: 'text-violet-500', bg: 'bg-violet-500/10' },
          { label: 'Database', value: 'SQLite', sub: 'Local · No Cloud', Icon: Database, cls: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Platform', value: 'Windows', sub: 'Electron Desktop', Icon: Cpu, cls: 'text-blue-500', bg: 'bg-blue-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} custom={i} variants={fadeUp} initial="hidden" animate="show"
            className="rounded-xl border border-border/60 bg-card p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2.5', s.bg)}>
              <s.Icon size={15} className={s.cls} />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{s.label}</p>
            <p className={cn('text-[15px] font-black mt-0.5', s.cls)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── All Modules ── */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show"
        className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/60">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckCircle2 size={15} className="text-primary" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wide">All Business Modules</h3>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Complete feature set included in your license</p>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {MODULES.map((m, i) => (
            <motion.div key={m.label} custom={i * 0.3} variants={fadeUp} initial="hidden" animate="show"
              className="flex items-start gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/20 transition-colors">
              <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5', colorMap[m.color])}>
                <m.icon size={14} />
              </div>
              <div>
                <p className="text-xs font-bold">{m.label}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{m.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Technical Architecture ── */}
      <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show"
        className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/60">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Layers size={15} className="text-violet-500" />
          </div>
          <h3 className="font-black text-sm uppercase tracking-wide">Technical Architecture</h3>
        </div>
        <div className="p-4 space-y-2.5">
          {TECH_LAYERS.map(layer => (
            <div key={layer.layer} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: layer.bg, border: `1px solid ${layer.border}` }}>
              <div className="w-16 shrink-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: layer.color }}>{layer.layer}</p>
              </div>
              <div className="w-px h-4 shrink-0 rounded-full" style={{ background: layer.color, opacity: 0.3 }} />
              <div className="flex flex-wrap gap-1.5">
                {layer.items.map(item => (
                  <span key={item} className="text-[10px] px-2 py-0.5 rounded-md font-semibold text-foreground/75 bg-background/50 border border-border/50">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Offline / Privacy ── */}
      <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <WifiOff size={16} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-black text-sm text-emerald-700 dark:text-emerald-400 mb-1.5">100% Offline — Your Data Stays Here</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All data is stored locally on this Windows PC. No internet connection is required for normal operation. Your business data never leaves this machine unless you explicitly export it.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <Globe size={16} className="text-blue-500" />
          </div>
          <div>
            <h3 className="font-black text-sm text-blue-700 dark:text-blue-400 mb-1.5">Optional Cloud Backup</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Supports Google Drive backup for disaster recovery. Manual export to any location. Full database import/export in JSON or SQLite format.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Data Loss Disclaimer ── */}
      <motion.div custom={8} variants={fadeUp} initial="hidden" animate="show"
        className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-5 flex gap-4">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle size={16} className="text-orange-500" />
        </div>
        <div>
          <h3 className="font-black text-sm text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
            <Database size={13} /> Offline Software — Data Loss Disclaimer
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This is a fully <strong>offline desktop application</strong>. All data is stored locally on this device only.
            The developer is <strong>not responsible for any data loss</strong> caused by hardware failure, accidental
            deletion, system crashes, or Windows reinstallation. We strongly recommend using the{' '}
            <strong>Export / Backup</strong> feature in Settings regularly to keep a safe copy on an external drive or Google Drive.
          </p>
        </div>
      </motion.div>

      {/* ── Concerns & Edge Cases ── */}
      <motion.div custom={9} variants={fadeUp} initial="hidden" animate="show"
        className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle size={15} className="text-destructive" />
          </div>
          <h3 className="font-black text-sm text-destructive uppercase tracking-wide">Concerns & Edge Cases</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">Known Concerns</p>
            <ul className="space-y-3">
              {[
                { t: 'Hardware Loss', d: 'If your PC is stolen or breaks, your data goes with it unless backed up to Google Drive or external storage.' },
                { t: 'Manual Exports', d: 'Use weekly auto-export (Settings) for safety. Google Drive backup adds automatic protection.' },
                { t: 'Single Device', d: 'Designed for one POS terminal. Multi-device LAN syncing is a future paid add-on.' },
              ].map(item => (
                <li key={item.t} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-destructive/10 flex items-center justify-center mt-0.5 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  </div>
                  <p className="text-xs leading-relaxed">
                    <span className="font-bold">{item.t}: </span>
                    <span className="text-muted-foreground">{item.d}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">Reliability Guarantees</p>
            <ul className="space-y-3">
              {[
                { t: 'Power Cut Safety', d: 'All transactions are atomic — if power fails mid-sale, the SQLite database stays uncorrupted.' },
                { t: 'Fast Performance', d: 'State isolation prevents input lag. Large datasets (10k+ records) perform smoothly.' },
                { t: 'Partial Returns', d: 'Handles partial sale/purchase returns and credit adjustments with full history.' },
              ].map(item => (
                <li key={item.t} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-xs leading-relaxed">
                    <span className="font-bold">{item.t}: </span>
                    <span className="text-muted-foreground">{item.d}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* ── License Agreement ── */}
      <motion.div custom={10} variants={fadeUp} initial="hidden" animate="show"
        className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck size={15} className="text-primary" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide">License Agreement</h3>
          </div>
          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider px-2.5 border-primary/25 text-primary">
            EULA v2.0
          </Badge>
        </div>
        <div className="divide-y divide-border/40">
          {LICENSE_ITEMS.map((item) => (
            <div key={item.num} className="flex gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center transition-colors mt-0.5">
                <span className="text-[10px] font-black text-muted-foreground/50 group-hover:text-primary transition-colors tabular-nums">{item.num}</span>
              </div>
              <div>
                <p className="text-sm font-bold mb-0.5">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-muted/5 border-t border-border/40 flex items-center gap-2">
          <Lock size={11} className="text-muted-foreground/35 shrink-0" />
          <p className="text-[10px] text-muted-foreground/45">
            © 2026 Munib Ahmad · OsaTech. All rights reserved. OsaTech Retailer POS v2.0 — Complete Business Management for Pakistan.
          </p>
        </div>
      </motion.div>

    </div>
  );
}

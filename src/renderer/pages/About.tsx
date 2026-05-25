import React from 'react';
import { motion } from 'framer-motion';
import {
  Code2, Phone, ShieldCheck, CheckCircle2, AlertTriangle, Database,
  GitBranch, Cpu, WifiOff, Mail, Layers, Lock, Globe,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

// ── Animation helpers ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: 'easeOut' },
  }),
};

// ── Static data ──────────────────────────────────────────────────────────────
const LICENSE_ITEMS = [
  { num: '01', title: 'Single-Device License', desc: 'This software is licensed for use on a single device per activation key. Installing or using this software on multiple devices simultaneously is not permitted without purchasing additional licenses.' },
  { num: '02', title: 'No Redistribution', desc: 'You may not copy, share, sell, sublicense, or distribute this software or your activation key to any third party. Unauthorized distribution is a violation of this agreement.' },
  { num: '03', title: 'Ownership', desc: 'This software and all its associated intellectual property remain the exclusive property of Munib Ahmad. This license grants you the right to use the software, not ownership of the software itself.' },
  { num: '04', title: 'Support & Updates', desc: 'Technical support and software updates may be provided at the sole discretion of the developer. Contact the developer at 0329-8748232 or via email at munibahmad4735@gmail.com for assistance or subscription renewals.' },
  { num: '05', title: 'Limitation of Liability', desc: 'The developer is not liable for any data loss, business interruption, or damages arising from the use of this software. Always maintain regular backups of your data using the export feature in Settings.' },
  { num: '06', title: 'Acceptance', desc: 'By activating and using this software, you agree to all the terms and conditions outlined in this license agreement.' },
];

const TECH_LAYERS = [
  { layer: 'UI', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.18)', items: ['React 19', 'TypeScript 5', 'Tailwind CSS', 'Framer Motion', 'shadcn/ui'] },
  { layer: 'Desktop', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.18)', items: ['Electron 41', 'Node.js', 'Chromium Engine', 'IPC Bridge'] },
  { layer: 'Database', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', items: ['SQLite 3', 'better-sqlite3', 'Atomic Transactions', 'JSON Exports'] },
  { layer: 'Storage', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)', items: ['Local AppData', 'Encrypted Keys', 'Auto Backups', 'PDF Invoices'] },
];

export default function About() {
  return (
    <div className="flex flex-col gap-5 max-w-3xl pb-12 mx-auto w-full">

      {/* ══════════════════════════════════════════════════════════════════
          HERO CARD — always dark, independent of app theme
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #0b0f1a 0%, #131836 45%, #0d1117 100%)' }}
      >
        {/* Fine grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Atmospheric glow orbs */}
        <div className="absolute -top-28 right-0 w-[360px] h-[360px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 -left-8 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 65%)' }} />
        <div className="absolute top-1/2 right-1/3 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.13) 0%, transparent 65%)' }} />

        {/* Top shimmer line */}
        <div className="absolute top-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent 5%, rgba(99,102,241,0.6) 40%, rgba(139,92,246,0.5) 60%, transparent 95%)' }} />

        <div className="relative z-10 p-8">
          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 border"
              style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-[0.15em]">Active Development</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 border"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <GitBranch size={10} className="text-white/40" />
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">v1.0 Stable</span>
            </div>
          </div>

          {/* Developer identity */}
          <div className="flex items-center gap-5 mb-8">
            {/* Glowing avatar */}
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
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Software Developer
              </p>
              <h1 className="text-[28px] font-black text-white tracking-tight leading-none">Munib Ahmad</h1>
              <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                OsaTech Retailer POS · Built for Pakistani Retail Shops
              </p>
            </div>
          </div>

          {/* Contact badges */}
          <div className="flex flex-wrap gap-2 mb-7">
            {[
              { Icon: Phone, text: '0329-8748232', rgb: '16,185,129' },
              { Icon: Mail, text: 'munibahmad4735@gmail.com', rgb: '59,130,246' },
            ].map(({ Icon, text, rgb }) => (
              <div key={text}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium select-all cursor-text"
                style={{
                  background: `rgba(${rgb},0.1)`,
                  borderColor: `rgba(${rgb},0.22)`,
                  color: `rgba(${rgb},1)`,
                  filter: 'brightness(1.6)',
                }}
              >
                <Icon size={12} className="opacity-70 shrink-0" />
                {text}
              </div>
            ))}
          </div>

          {/* Tech stack pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Electron 41', rgb: '59,130,246' },
              { label: 'React 19', rgb: '6,182,212' },
              { label: 'TypeScript 5', rgb: '99,102,241' },
              { label: 'SQLite 3', rgb: '245,158,11' },
              { label: 'Tailwind CSS', rgb: '20,184,166' },
              { label: 'Framer Motion', rgb: '236,72,153' },
            ].map(t => (
              <span key={t.label}
                className="text-[10px] px-2.5 py-1 rounded-lg border font-semibold"
                style={{
                  background: `rgba(${t.rgb},0.12)`,
                  borderColor: `rgba(${t.rgb},0.28)`,
                  color: `rgb(${t.rgb})`,
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom shimmer line */}
        <div className="absolute bottom-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent 10%, rgba(99,102,241,0.2) 50%, transparent 90%)' }} />
      </motion.div>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Version', value: 'v1.0', sub: 'Stable Release', Icon: GitBranch, cls: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Database', value: 'SQLite', sub: 'Local · No Cloud', Icon: Database, cls: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Connectivity', value: 'Offline', sub: '100% Local', Icon: WifiOff, cls: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Runtime', value: 'Electron', sub: 'Windows Desktop', Icon: Cpu, cls: 'text-blue-500', bg: 'bg-blue-500/10' },
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

      {/* ── Features cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckCircle2 size={15} className="text-primary" />
            </div>
            <h3 className="font-black text-sm text-primary uppercase tracking-wide">Core Features</h3>
          </div>
          <ul className="space-y-3">
            {[
              { t: 'Sales & Inventory', d: 'Category-based styling, barcode support, real-time stock alerts' },
              { t: 'Ledger Management', d: 'Full AP/AR debt tracking for customers & vendors with payment history' },
              { t: 'Smart Analytics', d: 'Weekly, Monthly, Yearly balance sheets with profit tracking' },
              { t: 'Privacy First', d: 'No data ever leaves your device — high-speed local SQLite database' },
            ].map(f => (
              <li key={f.t} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center mt-0.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <p className="text-xs leading-relaxed">
                  <span className="font-bold text-foreground">{f.t}: </span>
                  <span className="text-muted-foreground">{f.d}</span>
                </p>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Globe size={15} className="text-blue-500" />
            </div>
            <h3 className="font-black text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wide">Cloud & Connectivity</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Primarily offline POS with optional edge-syncing:</p>
          <ul className="space-y-3">
            {[
              { t: 'Cloud Backup', d: 'Manual export to Google Drive or Dropbox supported' },
              { t: 'Multi-Device', d: 'Future: local network syncing for multiple registers' },
              { t: 'Remote Access', d: 'Optional add-on for cloud-based reporting via secure API' },
            ].map(f => (
              <li key={f.t} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-blue-500/15 flex items-center justify-center mt-0.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                </div>
                <p className="text-xs leading-relaxed">
                  <span className="font-bold text-foreground">{f.t}: </span>
                  <span className="text-muted-foreground">{f.d}</span>
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

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
            <div key={layer.layer}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: layer.bg, border: `1px solid ${layer.border}` }}
            >
              {/* Layer label */}
              <div className="w-16 shrink-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: layer.color }}>
                  {layer.layer}
                </p>
              </div>
              {/* Separator */}
              <div className="w-px h-4 shrink-0 rounded-full" style={{ background: layer.color, opacity: 0.3 }} />
              {/* Items */}
              <div className="flex flex-wrap gap-1.5">
                {layer.items.map(item => (
                  <span key={item}
                    className="text-[10px] px-2 py-0.5 rounded-md font-semibold text-foreground/75 bg-background/50 border border-border/50"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Data Loss Disclaimer ── */}
      <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show"
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
            <strong>Export / Backup</strong> feature in Settings regularly to keep a safe copy on an external drive.
          </p>
        </div>
      </motion.div>

      {/* ── Concerns & Edge Cases ── */}
      <motion.div custom={8} variants={fadeUp} initial="hidden" animate="show"
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
                { t: 'Hardware Loss', d: 'If your PC is stolen or breaks, your data goes with it unless backed up.' },
                { t: 'Manual Exports', d: 'We rely on users to perform weekly exports for data safety.' },
                { t: 'Offline Limits', d: 'Real-time syncing between different locations is not available by default.' },
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
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">Edge Case Handling</p>
            <ul className="space-y-3">
              {[
                { t: 'Power Cut', d: 'Transactions are atomic — if power fails mid-sale, the database stays uncorrupted.' },
                { t: 'Invalid Input', d: 'Advanced sanitization prevents freezes with thousands of records.' },
                { t: 'Complex Returns', d: 'Handles partial returns and credit adjustments automatically.' },
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
      <motion.div custom={9} variants={fadeUp} initial="hidden" animate="show"
        className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck size={15} className="text-primary" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide">License Agreement</h3>
          </div>
          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider px-2.5 border-primary/25 text-primary">
            EULA v1.0
          </Badge>
        </div>

        {/* Items */}
        <div className="divide-y divide-border/40">
          {LICENSE_ITEMS.map((item) => (
            <div key={item.num} className="flex gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
              {/* Number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center transition-colors mt-0.5">
                <span className="text-[10px] font-black text-muted-foreground/50 group-hover:text-primary transition-colors tabular-nums">
                  {item.num}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold mb-0.5">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-muted/5 border-t border-border/40 flex items-center gap-2">
          <Lock size={11} className="text-muted-foreground/35 shrink-0" />
          <p className="text-[10px] text-muted-foreground/45">
            © 2026 Munib Ahmad. All rights reserved. OsaTech Retailer POS v1.0 — Built for professional retail management in Pakistan.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

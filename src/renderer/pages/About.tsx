import React from 'react';
import { Code2, Phone, ShieldCheck, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { Badge } from '../components/ui/badge';

const LICENSE_ITEMS = [
  {
    title: 'Single-Device License',
    desc: 'This software is licensed for use on a single device per activation key. Installing or using this software on multiple devices simultaneously is not permitted without purchasing additional licenses.',
  },
  {
    title: 'No Redistribution',
    desc: 'You may not copy, share, sell, sublicense, or distribute this software or your activation key to any third party. Unauthorized distribution is a violation of this agreement.',
  },
  {
    title: 'Ownership',
    desc: 'This software and all its associated intellectual property remain the exclusive property of Munib Ahmad. This license grants you the right to use the software, not ownership of the software itself.',
  },
  {
    title: 'Support & Updates',
    desc: 'Technical support and software updates may be provided at the sole discretion of the developer. Contact the developer at 0329-8748232 or via email at munibahmad4735@gmail.com for assistance or subscription renewals.',
  },
  {
    title: 'Limitation of Liability',
    desc: 'The developer is not liable for any data loss, business interruption, or damages arising from the use of this software. Always maintain regular backups of your data using the export feature in Settings.',
  },
  {
    title: 'Acceptance',
    desc: 'By activating and using this software, you agree to all the terms and conditions outlined in this license agreement.',
  },
];

export default function About() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-3xl pb-10 mx-auto w-full">
      {/* Hero Card – dark gradient matching the screenshot */}
      <div className="relative overflow-hidden rounded-2xl shadow-xl"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-indigo-600/20" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 w-36 h-36 rounded-full bg-blue-700/10" />

        <div className="relative z-10 p-8">
          {/* Developer row */}
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-indigo-600 rounded-xl w-14 h-14 flex items-center justify-center shadow-lg flex-shrink-0">
              <Code2 size={28} className="text-white" />
            </div>
            <div>
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-0.5">Software Developer</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Munib Ahmad</h1>
            </div>
          </div>

          {/* Pills row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-white/90 text-sm font-medium backdrop-blur-sm select-all">
              <Phone size={14} className="opacity-70" />
              032988748232
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-white/90 text-sm font-medium backdrop-blur-sm select-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              munibahmad4735@gmail.com
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-white/90 text-sm font-medium backdrop-blur-sm">
              <Code2 size={14} className="opacity-70" />
              OsaTech Retailer POS v1.0
            </div>
          </div>

          {/* Support blurb */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/70 text-sm leading-relaxed">
              For technical support, bug reports, or feature requests, please contact the developer directly via the phone
              number above. This software was built specifically for retail shops to manage sales, customers, inventory,
              and revenue — fully offline with no cloud dependency.
            </p>
          </div>
        </div>
      </div>

      {/* Data Loss Disclaimer */}
      <div className="rounded-xl border border-orange-400/30 bg-orange-500/5 p-5 flex gap-4">
        <div className="mt-0.5 flex-shrink-0">
          <div className="bg-orange-100 dark:bg-orange-900/40 rounded-full p-2">
            <AlertTriangle size={20} className="text-orange-500" />
          </div>
        </div>
        <div>
          <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-1.5 flex items-center gap-2">
            <Database size={15} /> Offline Software — Data Loss Disclaimer
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This is a fully <strong>offline desktop application</strong>. All your data is stored locally on this device only.
            The developer is <strong>not responsible for any data loss</strong> caused by hardware failure, accidental deletion,
            system crashes, or Windows reinstallation. We strongly recommend using the <strong>Export / Backup</strong> feature
            in Settings regularly to keep a safe copy of your records on an external drive or cloud storage.
          </p>
        </div>
      </div>

      {/* License Agreement Card */}
      <div className="rounded-2xl border border-border shadow-sm bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
          <div className="flex items-center gap-2 font-bold text-base">
            <ShieldCheck size={18} className="text-primary" />
            License Agreement
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 border-primary/30 text-primary">
            End-User License
          </Badge>
        </div>

        <div className="divide-y divide-border">
          {LICENSE_ITEMS.map((item) => (
            <div key={item.title} className="flex gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
              <div className="mt-0.5 flex-shrink-0">
                <CheckCircle2 size={18} className="text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-0.5">{item.title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-muted/10 border-t flex items-center gap-2 text-[11px] text-muted-foreground">
          <Database size={13} className="opacity-60" />
          © 2026 Munib Ahmad. All rights reserved. OsaTech Retailer POS v1.0 — Developed for professional retail management.
        </div>
      </div>
    </div>
  );
}

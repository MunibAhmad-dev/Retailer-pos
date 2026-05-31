import React, { useState, useEffect, useRef, useCallback } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {
  Barcode, Wand2, Printer, Copy, Check, Download, Package,
  RefreshCw, ScanLine, X, Settings2, Info, FileDown,
  Hash, Loader2, Tag, CheckSquare, Square, Save, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNotifications } from './NotificationProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  price: number;
  barcode?: string;
  category?: string;
}

type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'CODE39' | 'ITF14' | 'QR';

interface LabelOptions {
  size: 'small' | 'medium' | 'large';
  showPrice: boolean;
  showName: boolean;
  copies: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMATS: { id: BarcodeFormat; label: string; desc: string; digits?: number }[] = [
  { id: 'CODE128', label: 'Code 128', desc: 'All characters, most flexible'   },
  { id: 'EAN13',   label: 'EAN-13',   desc: 'Retail standard (13 digits)',  digits: 13 },
  { id: 'EAN8',    label: 'EAN-8',    desc: 'Compact retail (8 digits)',    digits: 8  },
  { id: 'UPCA',    label: 'UPC-A',    desc: 'US retail standard (12 digits)', digits: 12 },
  { id: 'CODE39',  label: 'Code 39',  desc: 'Alphanumeric, industrial'        },
  { id: 'ITF14',   label: 'ITF-14',   desc: 'Shipping/logistics (14 digits)', digits: 14 },
  { id: 'QR',      label: 'QR Code',  desc: 'Scannable with any phone'        },
];

const LABEL_SIZES = {
  small:  { w: 38,  h: 25,  bh: 30, fs: 7  },
  medium: { w: 57,  h: 32,  bh: 40, fs: 8  },
  large:  { w: 100, h: 50,  bh: 60, fs: 10 },
};

// ─── EAN helpers ──────────────────────────────────────────────────────────────

function eanCheckDigit(digits12: string): string {
  const d = digits12.padStart(12, '0').slice(0, 12).split('').map(Number);
  const sum = d.reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}
function generateEAN13(id: number, prefix = '200'): string {
  const base12 = (prefix + String(id).padStart(9, '0')).slice(0, 12).padStart(12, '0');
  return base12 + eanCheckDigit(base12);
}
function generateEAN8(id: number): string {
  const base7 = String(id % 10000000).padStart(7, '0');
  return base7 + eanCheckDigit(base7.padStart(12, '0'));
}
function generateCode128(id: number, prefix = 'PKR'): string {
  return `${prefix}${String(id).padStart(6, '0')}`;
}

// ─── SVG / QR rendering ──────────────────────────────────────────────────────

function renderBarcodeSVG(
  value: string,
  format: BarcodeFormat,
  opts: { height?: number; displayValue?: boolean; fontSize?: number } = {},
): string | null {
  try {
    if (!value) return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, value, {
      format: format === 'QR' ? 'CODE128' : format,
      height:       opts.height       ?? 50,
      displayValue: opts.displayValue ?? true,
      fontSize:     opts.fontSize     ?? 12,
      width: 1.8, margin: 4,
      background: '#ffffff', lineColor: '#000000',
    });
    return svg.outerHTML;
  } catch { return null; }
}

async function renderQRDataURL(value: string, size = 120): Promise<string> {
  return QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'M' });
}

// ─── Label HTML builder ───────────────────────────────────────────────────────

async function buildLabelHTML(
  items: { name: string; barcode: string; price: number }[],
  format: BarcodeFormat,
  opts: LabelOptions,
): Promise<string> {
  const sz = LABEL_SIZES[opts.size];
  const pxW = Math.round(sz.w * 3.78);
  const pxH = Math.round(sz.h * 3.78);

  const labels: string[] = [];
  for (const item of items) {
    for (let c = 0; c < opts.copies; c++) {
      let barcodeHtml = '';
      if (format === 'QR') {
        const url = await renderQRDataURL(item.barcode, sz.bh * 2);
        barcodeHtml = `<img src="${url}" style="height:${sz.bh}px;width:${sz.bh}px;display:block;margin:0 auto"/>`;
      } else {
        const svgStr = renderBarcodeSVG(item.barcode, format, { height: sz.bh, fontSize: sz.fs });
        barcodeHtml = svgStr
          ? `<div style="line-height:0;text-align:center">${svgStr}</div>`
          : `<div style="font-size:${sz.fs}px;text-align:center;font-family:monospace">${item.barcode}</div>`;
      }
      labels.push(`
        <div class="label">
          ${opts.showName ? `<div class="pname">${item.name.slice(0, 26)}</div>` : ''}
          ${barcodeHtml}
          ${opts.showPrice ? `<div class="price">Rs. ${Math.round(item.price).toLocaleString()}</div>` : ''}
        </div>`);
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page{margin:6mm}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;background:#fff;color:#000}
  .grid{display:flex;flex-wrap:wrap;gap:3px}
  .label{width:${pxW}px;height:${pxH}px;border:1px dashed #ccc;border-radius:3px;
    padding:2px;display:flex;flex-direction:column;align-items:center;
    justify-content:center;overflow:hidden}
  .pname{font-size:${sz.fs}px;font-weight:700;text-align:center;line-height:1.2;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;margin-bottom:1px}
  .price{font-size:${sz.fs + 1}px;font-weight:900;margin-top:1px}
  svg{max-width:100%}
</style></head><body>
<div class="grid">${labels.join('')}</div>
</body></html>`;
}

// ─── BarcodePreview ───────────────────────────────────────────────────────────

function BarcodePreview({
  value, format, height = 60, className,
}: { value: string; format: BarcodeFormat; height?: number; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) { setError(false); return; }
    if (format === 'QR') {
      setError(false);
      renderQRDataURL(value, height * 2).then(url => {
        if (imgRef.current) imgRef.current.src = url;
      }).catch(() => setError(true));
      return;
    }
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format, height, displayValue: true, fontSize: 11,
          width: 1.8, margin: 6, background: 'transparent', lineColor: 'currentColor',
        });
        setError(false);
      } catch { setError(true); }
    }
  }, [value, format, height]);

  if (!value) return (
    <div className={cn('flex items-center justify-center rounded-lg bg-muted/30 border border-dashed border-border/60 text-muted-foreground/30', className)} style={{ height }}>
      <ScanLine size={20} />
    </div>
  );
  if (error) return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg bg-red-50 border border-red-200 text-red-400 text-xs gap-1', className)} style={{ height }}>
      <X size={14} /><span>Invalid</span>
    </div>
  );
  if (format === 'QR') return (
    <div className={cn('flex items-center justify-center', className)} style={{ height }}>
      <img ref={imgRef} alt="QR" style={{ height, width: height }} />
    </div>
  );
  return (
    <div className={cn('overflow-hidden', className)}>
      <svg ref={svgRef} className="w-full text-foreground" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type StudioTab = 'generator' | 'batch' | 'labels';

export default function BarcodeStudio() {
  const { addNotification } = useNotifications();
  const [studioTab, setStudioTab] = useState<StudioTab>('generator');

  // raw full product objects (needed for updateProduct so we don't wipe fields)
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ── Generator state
  const [genValue,  setGenValue]  = useState('');
  const [genFormat, setGenFormat] = useState<BarcodeFormat>('CODE128');
  const [copied,    setCopied]    = useState(false);

  // ── Batch state
  const [batchValues,  setBatchValues]  = useState<Record<number, string>>({});
  const [batchFormat,  setBatchFormat]  = useState<BarcodeFormat>('CODE128');
  const [batchPrefix,  setBatchPrefix]  = useState('200');
  const [savingBatch,  setSavingBatch]  = useState(false);
  const [savingIds,    setSavingIds]    = useState<Set<number>>(new Set());
  // track which products were saved this session (so they appear highlighted)
  const [savedThisSession, setSavedThisSession] = useState<Set<number>>(new Set());
  // selected for bulk print in "has barcode" section
  const [printSelected, setPrintSelected] = useState<Set<number>>(new Set());
  const [printingBatch,  setPrintingBatch]  = useState(false);

  // label print options (shared with Labels tab)
  const [labelOpts, setLabelOpts] = useState<LabelOptions>({
    size: 'medium', showPrice: true, showName: true, copies: 1,
  });
  const [labelFormat, setLabelFormat] = useState<BarcodeFormat>('CODE128');

  // ── Label tab state
  const [labelProducts,  setLabelProducts]  = useState<Set<number>>(new Set());
  const [printingLabels, setPrintingLabels] = useState(false);

  // ── Search + pagination
  const [batchSearch,    setBatchSearch]    = useState('');  // Section C search
  const [batchShowCount, setBatchShowCount] = useState(30);  // Section C page size
  const [labelSearch,    setLabelSearch]    = useState('');  // Labels tab search
  const [labelShowCount, setLabelShowCount] = useState(30);  // Labels tab page size

  // ── Load products
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await window.api.getProducts();
      if (res?.success && Array.isArray(res.data)) {
        setRawProducts(res.data);
        setProducts(res.data.map((p: any) => ({
          id: p.id, name: p.name, price: p.price,
          barcode: p.barcode || '', category: p.category || '',
        })));
      }
    } finally { setLoadingProducts(false); }
  }, []);

  useEffect(() => { loadProducts(); }, []);

  // Derived
  const productsNoBarcodes   = products.filter(p => !batchValues[p.id] && !p.barcode?.trim());
  const productsWithBarcodes = products.filter(p => !!p.barcode?.trim() && !batchValues[p.id]);
  const pendingGenerated     = Object.entries(batchValues).filter(([, v]) => v.trim());

  // Filtered + paginated for Section C
  const batchQ = batchSearch.toLowerCase().trim();
  const batchFiltered = batchQ
    ? productsWithBarcodes.filter(p =>
        p.name.toLowerCase().includes(batchQ) ||
        (p.barcode || '').toLowerCase().includes(batchQ) ||
        (p.category || '').toLowerCase().includes(batchQ))
    : productsWithBarcodes;
  const batchVisible = batchFiltered.slice(0, batchShowCount);
  const batchHasMore = batchFiltered.length > batchShowCount;

  // Filtered + paginated for Labels tab
  const labelQ = labelSearch.toLowerCase().trim();
  const labelAllWithBarcode = products.filter(p => p.barcode?.trim());
  const labelFiltered = labelQ
    ? labelAllWithBarcode.filter(p =>
        p.name.toLowerCase().includes(labelQ) ||
        (p.barcode || '').toLowerCase().includes(labelQ) ||
        (p.category || '').toLowerCase().includes(labelQ))
    : labelAllWithBarcode;
  const labelVisible = labelFiltered.slice(0, labelShowCount);
  const labelHasMore = labelFiltered.length > labelShowCount;

  // ── Auto-generate one barcode
  const autoGenFor = (id: number): string => {
    if (batchFormat === 'EAN13') return generateEAN13(id, batchPrefix);
    if (batchFormat === 'EAN8')  return generateEAN8(id);
    return generateCode128(id, batchPrefix || 'PKR');
  };

  const generateAllMissing = () => {
    const map: Record<number, string> = {};
    for (const p of productsNoBarcodes) map[p.id] = autoGenFor(p.id);
    setBatchValues(prev => ({ ...prev, ...map }));
  };

  // ── Save ONE product's barcode
  const saveSingle = async (productId: number, barcode: string) => {
    const full = rawProducts.find(p => p.id === productId);
    if (!full) { addNotification('Error', 'Product data not found.', 'error'); return; }
    setSavingIds(prev => new Set(prev).add(productId));
    try {
      const res = await window.api.updateProduct(productId, { ...full, barcode: barcode.trim() });
      if (res?.success) {
        addNotification('Saved', `Barcode assigned to ${full.name}.`, 'success');
        setBatchValues(prev => { const n = { ...prev }; delete n[productId]; return n; });
        setSavedThisSession(prev => new Set(prev).add(productId));
        await loadProducts();
      } else {
        addNotification('Error', res?.error || 'Save failed.', 'error');
      }
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
    }
  };

  // ── Save ALL pending
  const saveAllPending = async () => {
    if (!pendingGenerated.length) return;
    setSavingBatch(true);
    let saved = 0;
    const newSaved = new Set<number>(savedThisSession);
    try {
      for (const [idStr, barcode] of pendingGenerated) {
        const id   = Number(idStr);
        const full = rawProducts.find(p => p.id === id);
        if (!full) continue;
        const res = await window.api.updateProduct(id, { ...full, barcode: barcode.trim() });
        if (res?.success) { saved++; newSaved.add(id); }
      }
      addNotification('Saved', `${saved} barcode(s) assigned.`, 'success');
      setBatchValues({});
      setSavedThisSession(newSaved);
      await loadProducts();
    } finally { setSavingBatch(false); }
  };

  // ── Copy value
  const copyValue = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addNotification('Copied!', 'Barcode value copied.', 'success');
    } catch { addNotification('Error', 'Could not copy.', 'error'); }
  };

  // ── Print single label from batch
  const printOne = async (barcode: string, name: string, price: number) => {
    try {
      const html = await buildLabelHTML(
        [{ barcode, name, price }],
        batchFormat === 'QR' ? 'QR' : batchFormat,
        { ...labelOpts, copies: 1 },
      );
      await window.api.printInvoice(html);
      addNotification('Sent to printer', '1 label queued.', 'success');
    } catch { addNotification('Print Error', 'Could not print label.', 'error'); }
  };

  // ── Print selected from "has barcode" section
  const printSelected_ = async () => {
    const items = productsWithBarcodes
      .filter(p => printSelected.has(p.id))
      .map(p => ({ barcode: p.barcode!, name: p.name, price: p.price }));
    if (!items.length) { addNotification('Nothing selected', 'Select products to print.', 'info'); return; }
    setPrintingBatch(true);
    try {
      const html = await buildLabelHTML(items, labelFormat, labelOpts);
      await window.api.printInvoice(html);
      addNotification('Sent to printer', `${items.length * labelOpts.copies} label(s) queued.`, 'success');
    } catch { addNotification('Print Error', 'Could not print.', 'error'); }
    finally { setPrintingBatch(false); }
  };

  // ── Export CSV
  const exportCSV = () => {
    const rows = products.filter(p => p.barcode)
      .map(p => `"${p.id}","${p.name.replace(/"/g, '""')}","${p.barcode}","${p.category}"`);
    const csv = `"ID","Name","Barcode","Category"\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'barcodes.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Labels tab print
  const printLabels = async () => {
    const items = products
      .filter(p => labelProducts.has(p.id) && p.barcode?.trim())
      .map(p => ({ barcode: p.barcode!, name: p.name, price: p.price }));
    if (!items.length) { addNotification('No products', 'Select products with barcodes first.', 'info'); return; }
    setPrintingLabels(true);
    try {
      const html = await buildLabelHTML(items, labelFormat, labelOpts);
      await window.api.printInvoice(html);
      addNotification('Sent to printer', `${items.length * labelOpts.copies} label(s) queued.`, 'success');
    } catch (err: any) { addNotification('Print failed', err?.message || 'Error.', 'error'); }
    finally { setPrintingLabels(false); }
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Sub-tabs ── */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border/50 w-fit">
        {([
          { id: 'generator', label: 'Generator',   icon: Barcode  },
          { id: 'batch',     label: 'Batch Assign', icon: Wand2    },
          { id: 'labels',    label: 'Print Labels', icon: Printer  },
        ] as { id: StudioTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setStudioTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              studioTab === id
                ? 'bg-background shadow text-foreground border border-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ══ GENERATOR ══════════════════════════════════════════════════════════ */}
      {studioTab === 'generator' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Inputs */}
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/50">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Hash size={13} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Barcode Value</h3>
                <p className="text-[10px] text-muted-foreground">Type or paste any value</p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Value</label>
              <input type="text" value={genValue} onChange={e => setGenValue(e.target.value)}
                placeholder="e.g. 6901234567890 or PROD-001"
                className="w-full h-10 px-3 rounded-lg border border-border/60 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition" />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Format</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setGenFormat(f.id)}
                    className={cn(
                      'text-left px-3 py-2 rounded-lg border text-xs transition-all',
                      genFormat === f.id
                        ? 'border-primary/50 bg-primary/8 text-primary font-bold'
                        : 'border-border/50 hover:border-border text-muted-foreground hover:text-foreground',
                    )}>
                    <div className="font-bold">{f.label}</div>
                    <div className="text-[9px] opacity-60 mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {['EAN13', 'EAN8', 'UPCA', 'ITF14'].includes(genFormat) && (
              <div className="flex gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
                <Info size={12} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  {genFormat} requires exactly {FORMATS.find(f => f.id === genFormat)?.digits} digits.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => copyValue(genValue)} disabled={!genValue}
                className={cn('flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all',
                  genValue ? 'border-border/60 hover:bg-muted/40' : 'border-border/30 text-muted-foreground/40 cursor-not-allowed')}>
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={async () => {
                if (!genValue || genFormat === 'QR') return;
                const svgEl = document.querySelector('#gen-preview-svg');
                if (!svgEl) return;
                const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `barcode-${genValue}.svg`;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
              }} disabled={!genValue || genFormat === 'QR'}
                className={cn('flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all',
                  genValue && genFormat !== 'QR' ? 'border-border/60 hover:bg-muted/40' : 'border-border/30 text-muted-foreground/40 cursor-not-allowed')}>
                <FileDown size={13} /> SVG
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/50">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ScanLine size={13} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Live Preview</h3>
                <p className="text-[10px] text-muted-foreground">Updates as you type</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-white rounded-xl border border-border/40 p-6 min-h-[160px]">
              <div id="gen-preview-svg" className="w-full">
                <BarcodePreview value={genValue} format={genFormat} height={genFormat === 'QR' ? 130 : 70} />
              </div>
              {genValue && (
                <p className="mt-3 text-[10px] font-mono text-muted-foreground text-center">{genValue} · {genFormat}</p>
              )}
            </div>
            <div className="rounded-lg bg-muted/30 p-3 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Tips</p>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                • <strong>Code 128</strong> — any product text or SKU<br/>
                • <strong>EAN-13 prefix 200–299</strong> — private / in-store use<br/>
                • <strong>QR</strong> — scannable with phones
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══ BATCH ASSIGN ═══════════════════════════════════════════════════════ */}
      {studioTab === 'batch' && (
        <div className="space-y-5">

          {/* Options bar */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Format</label>
                <div className="flex gap-1">
                  {(['CODE128','EAN13','EAN8'] as BarcodeFormat[]).map(f => (
                    <button key={f} onClick={() => setBatchFormat(f)}
                      className={cn('px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                        batchFormat === f ? 'border-primary/50 bg-primary/8 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground')}>
                      {f === 'CODE128' ? 'Code 128' : f}
                    </button>
                  ))}
                </div>
              </div>

              {(batchFormat === 'EAN13' || batchFormat === 'CODE128') && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">
                    {batchFormat === 'EAN13' ? 'EAN Prefix (3 digits)' : 'Code Prefix'}
                  </label>
                  <input type="text" value={batchPrefix} maxLength={batchFormat === 'EAN13' ? 3 : 6}
                    onChange={e => setBatchPrefix(e.target.value.replace(/\D/g, '').slice(0, batchFormat === 'EAN13' ? 3 : 6))}
                    className="h-9 w-24 px-3 rounded-lg border border-border/60 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={batchFormat === 'EAN13' ? '200' : 'PKR'} />
                </div>
              )}

              <div className="flex gap-2 ml-auto flex-wrap">
                <button onClick={exportCSV}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/40 transition-all">
                  <Download size={13} /> Export CSV
                </button>
                <button onClick={loadProducts} disabled={loadingProducts}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/40 transition-all">
                  <RefreshCw size={13} className={loadingProducts ? 'animate-spin' : ''} /> Refresh
                </button>
                <button onClick={generateAllMissing} disabled={!productsNoBarcodes.length}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-all">
                  <Wand2 size={13} /> Generate for {productsNoBarcodes.length} Products
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Products',   value: products.length,           color: 'blue'    },
              { label: 'Pending Save',     value: pendingGenerated.length,   color: 'amber'   },
              { label: 'Have Barcodes',    value: productsWithBarcodes.length + pendingGenerated.length, color: 'emerald' },
            ].map(({ label, value, color }) => (
              <div key={label} className={cn('rounded-xl border p-3',
                color === 'blue'    && 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800',
                color === 'amber'   && 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800',
                color === 'emerald' && 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800',
              )}>
                <p className={cn('text-xl font-black',
                  color === 'blue'    && 'text-blue-700 dark:text-blue-400',
                  color === 'amber'   && 'text-amber-700 dark:text-amber-400',
                  color === 'emerald' && 'text-emerald-700 dark:text-emerald-400',
                )}>{value}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── SECTION A: Generated / Pending Save ── */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
                  <Wand2 size={11} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">
                  Generated — Not Yet Saved ({pendingGenerated.length})
                </h3>
              </div>
              {pendingGenerated.length > 0 && (
                <button onClick={saveAllPending} disabled={savingBatch}
                  className="h-8 px-4 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50">
                  {savingBatch
                    ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                    : <><Save size={12} /> Save All {pendingGenerated.length}</>}
                </button>
              )}
            </div>

            {pendingGenerated.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Wand2 size={24} className="mx-auto mb-2 opacity-20" />
                <p>No pending barcodes — click "Generate for X Products" above</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {pendingGenerated.map(([idStr, barcode]) => {
                  const id = Number(idStr);
                  const p  = products.find(x => x.id === id);
                  if (!p) return null;
                  const isSaving = savingIds.has(id);
                  return (
                    <div key={id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground/60">{p.category} · ID #{p.id}</p>
                      </div>
                      <input
                        type="text"
                        value={barcode}
                        onChange={e => setBatchValues(prev => ({ ...prev, [id]: e.target.value }))}
                        className="h-8 w-40 px-2 rounded-lg border border-border/60 bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {/* mini preview */}
                      <div className="w-28 h-8 hidden sm:flex items-center overflow-hidden bg-white rounded border border-border/30">
                        <BarcodePreview value={barcode} format={batchFormat} height={30} />
                      </div>
                      {/* actions */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => printOne(barcode, p.name, p.price)}
                          title="Print 1 label"
                          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/50 hover:bg-primary/8 hover:border-primary/40 text-primary transition-all">
                          <Printer size={12} />
                        </button>
                        <button onClick={() => saveSingle(id, barcode)} disabled={isSaving}
                          title="Save this barcode"
                          className="h-7 w-7 flex items-center justify-center rounded-lg border border-emerald-300 hover:bg-emerald-50 text-emerald-600 transition-all disabled:opacity-50">
                          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        </button>
                        <button onClick={() => setBatchValues(prev => { const n = { ...prev }; delete n[id]; return n; })}
                          title="Discard generated barcode"
                          className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/40 hover:border-red-300 hover:text-red-500 text-muted-foreground/40 transition-all">
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SECTION B: Products Without Barcodes ── */}
          {productsNoBarcodes.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground">
                  Products Without Barcodes ({productsNoBarcodes.length})
                </h3>
              </div>
              <div className="divide-y divide-border/40">
                {productsNoBarcodes.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10">
                    <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      <Package size={13} className="text-muted-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground/50">{p.category} · ID #{p.id}</p>
                    </div>
                    <button onClick={() => setBatchValues(prev => ({ ...prev, [p.id]: autoGenFor(p.id) }))}
                      className="h-7 px-3 rounded-lg border border-primary/30 text-primary hover:bg-primary/8 text-xs font-semibold transition-all">
                      <Wand2 size={11} className="inline mr-1" />Generate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SECTION C: Products with Barcodes — Print from here ── */}
          {productsWithBarcodes.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              {/* Header */}
              <div className="px-4 pt-3 pb-0 border-b border-border/50">
                {/* Title row */}
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                    <h3 className="text-sm font-bold">
                      Products with Barcodes ({batchFiltered.length}{batchSearch ? ` of ${productsWithBarcodes.length}` : ''})
                    </h3>
                  </div>
                  {/* Print button */}
                  <button onClick={printSelected_} disabled={printingBatch || printSelected.size === 0}
                    className="h-8 px-4 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40 transition-all">
                    {printingBatch
                      ? <><Loader2 size={12} className="animate-spin" /> Printing…</>
                      : <><Printer size={12} /> Print {printSelected.size > 0 ? `${printSelected.size * labelOpts.copies} ` : ''}Label(s)</>}
                  </button>
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-2 pb-2.5 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[160px]">
                    <ScanLine size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                    <input
                      type="text"
                      placeholder="Search name, barcode, category…"
                      value={batchSearch}
                      onChange={e => { setBatchSearch(e.target.value); setBatchShowCount(30); }}
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                    {batchSearch && (
                      <button onClick={() => setBatchSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  {/* Size */}
                  <div className="flex gap-1">
                    {(['small','medium','large'] as LabelOptions['size'][]).map(s => (
                      <button key={s} onClick={() => setLabelOpts(o => ({ ...o, size: s }))}
                        className={cn('h-7 px-2 rounded-md border text-[11px] font-semibold capitalize transition-all',
                          labelOpts.size === s
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border')}>
                        {s}
                      </button>
                    ))}
                  </div>
                  {/* Format */}
                  <div className="flex gap-1">
                    {(['CODE128','EAN13','QR'] as BarcodeFormat[]).map(f => (
                      <button key={f} onClick={() => setLabelFormat(f)}
                        className={cn('h-7 px-2 rounded-md border text-[11px] font-semibold transition-all',
                          labelFormat === f
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border')}>
                        {f === 'CODE128' ? '128' : f}
                      </button>
                    ))}
                  </div>
                  {/* Copies */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium">×</span>
                    <input type="number" min={1} max={99} value={labelOpts.copies}
                      onChange={e => setLabelOpts(o => ({ ...o, copies: Math.max(1, Number(e.target.value)) }))}
                      className="h-7 w-11 px-1.5 rounded-md border border-border/60 bg-background text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  {/* Select all/none */}
                  <button onClick={() => {
                      if (printSelected.size === batchFiltered.length && batchFiltered.length > 0)
                        setPrintSelected(new Set());
                      else setPrintSelected(new Set(batchFiltered.map(p => p.id)));
                    }}
                    className="h-7 px-2.5 rounded-md border border-border/60 text-[11px] font-semibold hover:bg-muted/40 transition-all text-muted-foreground hover:text-foreground">
                    {printSelected.size === batchFiltered.length && batchFiltered.length > 0 ? 'None' : 'All'}
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="divide-y divide-border/30">
                {batchFiltered.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No products match "{batchSearch}"
                  </div>
                ) : (
                  <>
                    {batchVisible.map(p => {
                      const isSelected = printSelected.has(p.id);
                      const justSaved  = savedThisSession.has(p.id);
                      return (
                        <div key={p.id}
                          onClick={() => setPrintSelected(prev => {
                            const n = new Set(prev);
                            isSelected ? n.delete(p.id) : n.add(p.id);
                            return n;
                          })}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/10',
                          )}>
                          <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                            isSelected ? 'bg-primary border-primary' : 'border-border/60')}>
                            {isSelected && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold truncate">{p.name}</p>
                              {justSaved && (
                                <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full shrink-0">NEW</span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-muted-foreground/50">{p.barcode}</p>
                          </div>
                          <div className="w-36 h-9 hidden md:flex items-center overflow-hidden bg-white rounded border border-border/20">
                            <BarcodePreview value={p.barcode!} format={labelFormat} height={34} />
                          </div>
                          <p className="text-xs font-bold text-muted-foreground shrink-0">
                            Rs. {Math.round(p.price).toLocaleString()}
                          </p>
                          <button onClick={e => { e.stopPropagation(); printOne(p.barcode!, p.name, p.price); }}
                            title="Print 1 label"
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/50 hover:bg-primary/8 hover:border-primary/40 text-primary transition-all shrink-0">
                            <Printer size={12} />
                          </button>
                        </div>
                      );
                    })}
                    {batchHasMore && (
                      <div className="flex justify-center py-3 bg-muted/5">
                        <button
                          onClick={() => setBatchShowCount(c => c + 30)}
                          className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/40 transition-all text-muted-foreground hover:text-foreground">
                          <RefreshCw size={12} />
                          Load more ({batchFiltered.length - batchShowCount} remaining)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══ PRINT LABELS ════════════════════════════════════════════════════════ */}
      {studioTab === 'labels' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Product selection */}
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card overflow-hidden">
            {/* Header with search */}
            <div className="px-4 py-3 border-b border-border/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">
                  Select Products ({labelFiltered.length}{labelSearch ? ` of ${labelAllWithBarcode.length}` : ''})
                </h3>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setLabelProducts(new Set(labelFiltered.map(p => p.id)))}
                    className="h-7 px-2.5 text-[11px] font-semibold border border-border/60 rounded-lg hover:bg-muted/40 transition-all text-muted-foreground hover:text-foreground">
                    All
                  </button>
                  <button
                    onClick={() => setLabelProducts(new Set())}
                    className="h-7 px-2.5 text-[11px] font-semibold border border-border/60 rounded-lg hover:bg-muted/40 transition-all text-muted-foreground hover:text-foreground">
                    None
                  </button>
                </div>
              </div>
              {/* Search bar */}
              <div className="relative">
                <ScanLine size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  type="text"
                  placeholder="Search by name, barcode or category…"
                  value={labelSearch}
                  onChange={e => { setLabelSearch(e.target.value); setLabelShowCount(30); }}
                  className="w-full h-9 pl-8 pr-8 rounded-lg border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
                />
                {labelSearch && (
                  <button onClick={() => setLabelSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="divide-y divide-border/30">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 size={18} className="animate-spin mr-2" /> Loading…
                </div>
              ) : labelAllWithBarcode.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No products with barcodes. Use Batch Assign first.
                </div>
              ) : labelFiltered.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No products match "{labelSearch}"
                </div>
              ) : (
                <>
                  {labelVisible.map(p => {
                    const sel = labelProducts.has(p.id);
                    return (
                      <div key={p.id}
                        onClick={() => setLabelProducts(prev => { const n = new Set(prev); sel ? n.delete(p.id) : n.add(p.id); return n; })}
                        className={cn('flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                          sel ? 'bg-primary/5' : 'hover:bg-muted/10')}>
                        <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                          sel ? 'bg-primary border-primary' : 'border-border/60')}>
                          {sel && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{p.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/50">{p.barcode}</p>
                        </div>
                        <div className="w-28 h-8 hidden sm:flex items-center overflow-hidden bg-white rounded border border-border/20">
                          <BarcodePreview value={p.barcode!} format={labelFormat} height={32} />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground shrink-0">Rs. {Math.round(p.price).toLocaleString()}</p>
                      </div>
                    );
                  })}
                  {labelHasMore && (
                    <div className="flex justify-center py-3 bg-muted/5">
                      <button
                        onClick={() => setLabelShowCount(c => c + 30)}
                        className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/40 transition-all text-muted-foreground hover:text-foreground">
                        <RefreshCw size={12} />
                        Load more ({labelFiltered.length - labelShowCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10">
              <p className="text-[11px] text-muted-foreground">
                {labelProducts.size} selected · {labelProducts.size * labelOpts.copies} label(s) to print
              </p>
            </div>
          </div>

          {/* Label options */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><Settings2 size={14} /> Label Options</h3>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Label Size</label>
                <div className="space-y-1">
                  {([['small','Small','38 × 25 mm'],['medium','Medium','57 × 32 mm'],['large','Large','100 × 50 mm']] as [LabelOptions['size'],string,string][]).map(([id, lbl, sub]) => (
                    <button key={id} onClick={() => setLabelOpts(o => ({ ...o, size: id }))}
                      className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
                        labelOpts.size === id
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'border-border/60 hover:border-border text-muted-foreground hover:text-foreground')}>
                      <span>{lbl}</span>
                      <span className={cn('text-[10px]', labelOpts.size === id ? 'opacity-70' : 'opacity-50')}>{sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Format</label>
                <div className="flex flex-wrap gap-1">
                  {(['CODE128','EAN13','QR'] as BarcodeFormat[]).map(f => (
                    <button key={f} onClick={() => setLabelFormat(f)}
                      className={cn('px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all',
                        labelFormat === f
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'border-border/60 text-muted-foreground hover:text-foreground')}>
                      {f === 'CODE128' ? 'Code 128' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Copies per Product</label>
                <input type="number" min={1} max={100} value={labelOpts.copies}
                  onChange={e => setLabelOpts(o => ({ ...o, copies: Math.max(1, Number(e.target.value)) }))}
                  className="h-9 w-full px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div className="space-y-2">
                {([['showName','Show product name'],['showPrice','Show price']] as [keyof LabelOptions, string][]).map(([key, lbl]) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-muted-foreground">{lbl}</span>
                    <button onClick={() => setLabelOpts(o => ({ ...o, [key]: !o[key as keyof LabelOptions] }))}
                      className={cn('w-9 h-5 rounded-full transition-all relative', labelOpts[key] ? 'bg-primary' : 'bg-muted')}>
                      <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                        labelOpts[key] ? 'left-[18px]' : 'left-0.5')} />
                    </button>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={printLabels} disabled={printingLabels || labelProducts.size === 0}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-all shadow">
              {printingLabels
                ? <><Loader2 size={15} className="animate-spin" /> Preparing…</>
                : <><Printer size={15} /> Print {labelProducts.size * labelOpts.copies} Label(s)</>}
            </button>
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Opens system print dialog · Use a label printer for best results
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

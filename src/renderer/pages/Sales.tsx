import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Minus, Search, ShoppingCart as CartIcon, X,
  CreditCard, Printer, RefreshCw, PenLine, CheckCircle, Loader2,
  AlertTriangle, Package, Users, Sparkles, Tag, Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn, formatInvoiceId } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useLocation } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton } from '../components/Pagination';
import AnimatedList from '../components/AnimatedList';
import { useModules } from '../contexts/ModulesContext';

interface CartItem {
  id: string;
  product_id: number | null;
  name: string;
  price: number;
  quantity: number;
  is_custom: boolean;
  stock?: number;
  metadata?: any;
  product_type?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock?: number;
  unit?: string;
  metadata?: any;
  product_type?: string;
  barcode?: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface Settings {
  store_name: string; store_phone: string; store_address: string;
  receipt_footer: string; store_logo: string;
  invoice_style?: string;
  invoice_notes?: string;
}

interface ReceiptData {
  saleId: number | bigint;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  settings: Settings;
  date: string;
  customerPhone?: string;
  amountPaid?: number;
  balance?: number;
}

import RegisterManager from '../components/RegisterManager';

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

// ─── Receipt Modal (unchanged logic) ─────────────────────────────────────────
function ReceiptModal({ data, onPrint, onSavePdf, onClose }: {
  data: ReceiptData; onPrint: () => void; onSavePdf: () => void; onClose: () => void;
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { addNotification } = useNotifications();

  const handlePrint = async () => {
    setIsPrinting(true);
    await onPrint();
    setIsPrinting(false);
    addNotification("Printed successfully", "The receipt was queued to the printer.", "success");
  };

  const handleSavePdf = async () => {
    await onSavePdf();
    addNotification("Saved PDF successfully", "The receipt was saved as a PDF file.", "success");
  };

  const handleWhatsApp = () => {
    if (!data.customerPhone) return;
    const paidAmt = data.amountPaid ?? data.total;
    const balance = data.balance ?? 0;
    const storeName = data.settings.store_name || 'Store';
    const invoiceId = formatInvoiceId(data.saleId, data.date);
    let msg = `🧾 *Invoice: ${invoiceId}*\n*${storeName}*\n`;
    msg += `📅 ${data.date}\n───────────────────\n`;
    data.items.forEach(i => { msg += `▪ ${i.name} x${i.quantity} = ${fmtPKR(i.price * i.quantity)}\n`; });
    msg += `───────────────────\n`;
    if (data.discount > 0) msg += `🏷️ Discount: -${fmtPKR(data.discount)}\n`;
    msg += `💰 *Total: ${fmtPKR(data.total)}*\n✅ *Paid: ${fmtPKR(paidAmt)}*\n`;
    if (balance < 0) msg += `🔴 *Remaining Balance: ${fmtPKR(Math.abs(balance))}*\n`;
    else if (balance > 0) msg += `🟢 *Change Due: ${fmtPKR(balance)}*\n`;
    else msg += `🟢 *Fully Paid*\n`;
    msg += `\n━━━━━━━━━━━━━━━━━━━\n🧾 *بل نمبر: ${invoiceId}*\n🏪 *${storeName}*\n━━━━━━━━━━━━━━━━━━━\n`;
    data.items.forEach(i => { msg += `▪ ${i.name} × ${i.quantity} = ${fmtPKR(i.price * i.quantity)}\n`; });
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    if (data.discount > 0) msg += `🏷️ رعایت: -${fmtPKR(data.discount)}\n`;
    msg += `💰 *کل رقم: ${fmtPKR(data.total)}*\n✅ *ادا شدہ: ${fmtPKR(paidAmt)}*\n`;
    if (balance < 0) msg += `🔴 *باقی رقم (ادھار): ${fmtPKR(Math.abs(balance))}*\n`;
    else if (balance > 0) msg += `🟢 *واپسی: ${fmtPKR(balance)}*\n`;
    else msg += `🟢 *مکمل ادائیگی ہو گئی*\n`;
    msg += `\n🙏 شکریہ! آپ کا دوبارہ خیرمقدم ہے۔`;
    let phone = data.customerPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-sm flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-500" />
            </div>
            <CardTitle className="text-lg">Sale Complete!</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2">
            <X size={18} />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div className="bg-background border border-dashed border-border rounded-xl p-5 font-mono text-xs text-foreground shadow-sm">
            {data.settings.store_logo && (
              <img src={data.settings.store_logo} alt="Logo" className="h-10 mx-auto mb-2 object-contain" />
            )}
            <p className="text-center font-bold text-sm mb-0.5">{data.settings.store_name}</p>
            {data.settings.store_address && <p className="text-center text-muted-foreground leading-tight">{data.settings.store_address}</p>}
            {data.settings.store_phone && <p className="text-center text-muted-foreground">Tel: {data.settings.store_phone}</p>}
            <div className="border-b border-dashed border-border my-3" />
            <p className="text-center text-muted-foreground font-semibold">Invoice: {formatInvoiceId(data.saleId, data.date)}</p>
            <p className="text-center text-muted-foreground/70 text-[10px]">{data.date}</p>
            <div className="border-b border-dashed border-border my-3" />
            <div className="space-y-1.5">
              {data.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="flex-1 mr-2 truncate">
                    {item.name}{item.is_custom && <span className="text-purple-500 ml-1">(custom)</span>} x{item.quantity}
                  </span>
                  <span className="font-semibold flex-shrink-0">{fmtPKR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-b border-dashed border-border my-3" />
            <div className="flex justify-between text-muted-foreground text-[10px] mt-1"><span>Subtotal</span><span>{fmtPKR(data.subtotal)}</span></div>
            {data.discount > 0 && <div className="flex justify-between text-destructive text-[10px] mt-0.5"><span>Discount</span><span>-{fmtPKR(data.discount)}</span></div>}
            <div className="flex justify-between font-bold text-sm mt-1"><span>Total</span><span>{fmtPKR(data.total)}</span></div>
            {data.amountPaid !== undefined && <div className="flex justify-between text-muted-foreground text-[10px] mt-1"><span>Amount Paid</span><span>{fmtPKR(data.amountPaid)}</span></div>}
            {data.balance !== undefined && data.balance !== 0 && (
              <div className="flex justify-between text-muted-foreground text-[10px] mt-0.5">
                <span>{data.balance > 0 ? 'Remaining Balance (Qaraz)' : 'Change Due'}</span>
                <span className={data.balance > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>{fmtPKR(Math.abs(data.balance))}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground text-[10px] mt-1"><span>Payment</span><span className="uppercase">{data.paymentMethod === 'online' ? 'Online Payment' : data.paymentMethod}</span></div>
            {data.settings.receipt_footer && (
              <><div className="border-b border-dashed border-border my-3" /><p className="text-center text-muted-foreground">{data.settings.receipt_footer}</p></>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4 border-t">
          <div className="flex w-full gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
            <Button onClick={handlePrint} disabled={isPrinting} className="flex-1 gap-2 shadow-md">
              {isPrinting ? <RefreshCw size={15} className="animate-spin" /> : <Printer size={15} />}
              {isPrinting ? 'Printing...' : 'Print'}
            </Button>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="secondary" onClick={handleSavePdf} disabled={isPrinting} className="flex-1 gap-2 text-xs">
              Save as PDF
            </Button>
            {data.customerPhone && (
              <Button onClick={handleWhatsApp} className="flex-1 gap-2 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                WhatsApp
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Invoice builders (unchanged) ────────────────────────────────────────────
function buildReceiptHtml(data: ReceiptData) {
  const itemsHtml = data.items.map((item) =>
    `<div class="item"><span>${item.name} x${item.quantity}</span><span>${fmtPKR(item.price * item.quantity)}</span></div>`
  ).join('');
  return `
    ${data.settings.store_logo ? `<img src="${data.settings.store_logo}" style="max-height:48px;display:block;margin:0 auto 4px"/>` : ''}
    <h2>${data.settings.store_name}</h2>
    ${data.settings.store_address ? `<p class="center">${data.settings.store_address}</p>` : ''}
    ${data.settings.store_phone ? `<p class="center">Tel: ${data.settings.store_phone}</p>` : ''}
    <div class="divider"></div>
    <p class="center" style="font-weight:bold;font-size:12px;">Invoice: ${formatInvoiceId(data.saleId, data.date)}</p>
    <p class="center" style="font-size:10px;margin-top:2px;color:#555;">${data.date}</p>
    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>
    <div class="total-row" style="font-weight:normal;font-size:11px"><span>Subtotal</span><span>${fmtPKR(data.subtotal)}</span></div>
    ${Number(data.discount) > 0 ? `<div class="total-row" style="font-weight:normal;font-size:11px;color:red"><span>Discount</span><span>-${fmtPKR(Number(data.discount))}</span></div>` : ''}
    <div class="total-row"><span>Total</span><span>${fmtPKR(data.total)}</span></div>
    ${data.amountPaid !== undefined ? `<div class="total-row" style="font-weight:normal;font-size:10px;margin-top:1px"><span>Amount Paid</span><span>${fmtPKR(data.amountPaid)}</span></div>` : ''}
    ${data.balance !== undefined && data.balance !== 0 ? `<div class="total-row" style="font-weight:normal;font-size:10px;margin-top:1px"><span>${data.balance > 0 ? 'Remaining Balance' : 'Change Due'}</span><span>${fmtPKR(Math.abs(data.balance))}</span></div>` : ''}
    <div class="total-row" style="font-weight:normal;font-size:10px;margin-top:2px"><span>Payment</span><span>${data.paymentMethod === 'online' ? 'ONLINE PAYMENT' : data.paymentMethod.toUpperCase()}</span></div>
    <div class="divider"></div>
    <div style="text-align: center; margin-top: 6px;">
      <div style="font-size: 11px; font-weight: bold;">${data.settings.receipt_footer}</div>
      <div style="font-size: 9px; margin-top: 6px; color: #555;">Software made by +923298748232</div>
    </div>
  `;
}

function buildFormalInvoiceHtml(data: ReceiptData) {
  const fmt2 = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');
  const pkrNum = (n: number) => Math.round(n).toLocaleString('en-PK');
  const paidAmt = data.amountPaid !== undefined ? data.amountPaid : data.total;
  const balAmt = data.balance !== undefined ? data.balance : 0;
  let balanceRow = '';
  if (balAmt > 0) balanceRow = `<tr><td class="label">BALANCE (CREDIT)</td><td class="value">PKR ${pkrNum(balAmt)}</td></tr>`;
  else if (balAmt < 0) balanceRow = `<tr><td class="label">CHANGE DUE</td><td class="value">PKR ${pkrNum(Math.abs(balAmt))}</td></tr>`;
  else balanceRow = `<tr><td class="label">BALANCE</td><td class="value">PKR 0</td></tr>`;
  const rowsHtml = data.items.map((item, idx) => `
    <tr class="item-row">
      <td class="center">${idx + 1}</td>
      <td>${item.name}</td>
      <td class="center warranty-cell">—</td>
      <td class="center">${item.quantity}</td>
      <td class="right">PKR ${pkrNum(item.price)}</td>
      <td class="right amount-col">PKR ${pkrNum(item.price * item.quantity)}</td>
    </tr>
  `).join('');
  const emptyCount = Math.max(0, 10 - data.items.length);
  const emptyRowsHtml = Array(emptyCount).fill(`<tr class="item-row empty-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('');
  const notesLines = (data.settings.invoice_notes || data.settings.receipt_footer || '')
    .split('\n').filter(Boolean)
    .map(l => `<div class="note-line">${l.replace(/^[•\-]\s*/, '')}</div>`).join('');
  const logoHtml = data.settings.store_logo ? `<img src="${data.settings.store_logo}" class="logo" alt="logo"/>` : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Invoice ${formatInvoiceId(data.saleId, data.date)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 210mm; background: #fff; color: #1a1a1a; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; }
  .page { width: 210mm; min-height: 297mm; padding: 12mm 14mm 10mm; display: flex; flex-direction: column; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 3px solid #cc0000; margin-bottom: 10px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { height: 52px; object-fit: contain; }
  .store-name { font-size: 20pt; font-weight: 900; color: #cc0000; line-height: 1.1; }
  .store-sub { font-size: 8pt; color: #555; margin-top: 3px; line-height: 1.5; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 18pt; font-weight: 900; color: #1a1a1a; letter-spacing: 2px; }
  .meta-row { font-size: 9pt; color: #333; margin-top: 4px; }
  .meta-row span { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  thead tr { background: #cc0000; color: #fff; }
  thead th { padding: 7px 6px; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #aaa; white-space: nowrap; }
  .item-row td { border: 1px solid #ccc; padding: 6px 6px; font-size: 9.5pt; vertical-align: middle; }
  .item-row:nth-child(even) { background: #fafafa; }
  .empty-row td { height: 22px; }
  .center { text-align: center; } .right { text-align: right; } .amount-col { font-weight: 700; }
  .warranty-cell { color: #888; font-size: 8pt; }
  .bottom { display: flex; justify-content: space-between; gap: 16px; margin-top: 10px; align-items: flex-start; }
  .notes-box { flex: 1; border: 1px solid #e0e0e0; border-radius: 4px; padding: 9px 11px; background: #fffbf8; }
  .notes-title { font-size: 8pt; font-weight: 700; color: #cc0000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
  .note-line { font-size: 8pt; color: #c00; line-height: 1.7; padding-left: 8px; position: relative; }
  .note-line::before { content: "•"; position: absolute; left: 0; }
  .summary { min-width: 200px; }
  .summary table { width: 100%; }
  .summary td { border: 1px solid #ccc; padding: 5px 9px; font-size: 9.5pt; }
  .summary .label { color: #333; } .summary .value { text-align: right; font-weight: 600; }
  .summary .discount-row td { color: #cc0000; }
  .summary .grand-row td { font-weight: 800; font-size: 10.5pt; background: #f5f5f5; }
  .footer { margin-top: 14px; border-top: 2px solid #cc0000; padding-top: 8px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 8pt; color: #555; }
  .footer .sign-line { border-bottom: 1px solid #999; width: 160px; margin-top: 14px; }
  .footer .contact { text-align: right; line-height: 1.7; }
</style></head><body><div class="page">
  <div class="header">
    <div class="brand">${logoHtml}<div><div class="store-name">${data.settings.store_name || 'Store Name'}</div><div class="store-sub">${data.settings.store_address ? data.settings.store_address + '<br/>' : ''}${data.settings.store_phone ? 'Tel: ' + data.settings.store_phone : ''}</div></div></div>
    <div class="invoice-meta"><div class="invoice-title">INVOICE</div><div class="meta-row"><span>No:</span> ${formatInvoiceId(data.saleId, data.date)}</div><div class="meta-row"><span>Date:</span> ${data.date}</div></div>
  </div>
  <table><thead><tr><th style="width:36px">S.No</th><th style="text-align:left">Description</th><th style="width:68px">Warranty</th><th style="width:40px">Qty</th><th style="width:96px">U-Price</th><th style="width:104px">Amount</th></tr></thead><tbody>${rowsHtml}${emptyRowsHtml}</tbody></table>
  <div class="bottom">
    <div class="notes-box"><div class="notes-title">Terms &amp; Notes</div>${notesLines || '<div class="note-line" style="color:#aaa;padding-left:0">No notes set.</div>'}</div>
    <div class="summary"><table>
      <tr><td class="label">AMOUNT</td><td class="value">PKR ${pkrNum(data.subtotal)}</td></tr>
      <tr class="discount-row"><td class="label">DISCOUNT</td><td class="value">${Number(data.discount) > 0 ? '- PKR ' + pkrNum(Number(data.discount)) : '—'}</td></tr>
      <tr class="grand-row"><td class="label">GRAND TOTAL</td><td class="value">PKR ${pkrNum(data.total)}</td></tr>
      <tr><td class="label">PAID</td><td class="value">PKR ${pkrNum(paidAmt)}</td></tr>
      ${balanceRow}
    </table></div>
  </div>
  <div class="footer">
    <div><div style="font-size:8pt;color:#888;margin-bottom:2px">Authorized Signature</div><div class="sign-line"></div></div>
    <div class="contact">${data.settings.store_name || ''}<br/>${data.settings.store_address ? data.settings.store_address + '<br/>' : ''}${data.settings.store_phone ? 'Tel: ' + data.settings.store_phone : ''}</div>
  </div>
</div></body></html>`;
}

function buildInvoiceHtml(data: ReceiptData) {
  return data.settings.invoice_style === 'formal' ? buildFormalInvoiceHtml(data) : buildReceiptHtml(data);
}

// ─── Category colour palette ──────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { from: string; to: string; text: string }> = {
  'chicken':  { from: '#ea580c', to: '#d97706', text: '#fff' },
  'bottle':   { from: '#16a34a', to: '#059669', text: '#fff' },
  'rice':     { from: '#ca8a04', to: '#d97706', text: '#fff' },
  'chawal':   { from: '#ca8a04', to: '#d97706', text: '#fff' },
  'chargha':  { from: '#dc2626', to: '#e11d48', text: '#fff' },
  'channy':   { from: '#92400e', to: '#b45309', text: '#fff' },
  'glass':    { from: '#0891b2', to: '#0284c7', text: '#fff' },
  'drinks':   { from: '#2563eb', to: '#4f46e5', text: '#fff' },
};
const CARD_GRADIENTS = [
  { from: '#7c3aed', to: '#6d28d9', text: '#fff' },
  { from: '#0d9488', to: '#0891b2', text: '#fff' },
  { from: '#db2777', to: '#be185d', text: '#fff' },
  { from: '#1d4ed8', to: '#2563eb', text: '#fff' },
  { from: '#059669', to: '#047857', text: '#fff' },
  { from: '#b45309', to: '#92400e', text: '#fff' },
];

function colorForProduct(product: Product) {
  const cat = (product.category || '').toLowerCase().trim();
  if (cat && CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  return CARD_GRADIENTS[product.id % CARD_GRADIENTS.length];
}

// ─── Main Sales Component ─────────────────────────────────────────────────────
export default function Sales() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'udhaar'>('cash');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [settings, setSettings] = useState<Settings>({
    store_name: 'My Store', store_phone: '', store_address: '', receipt_footer: 'Thank you!', store_logo: ''
  });
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const customNameRef = useRef<HTMLInputElement>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');

  const { addNotification } = useNotifications();
  const { modules } = useModules();
  const location = useLocation();

  useEffect(() => {
    loadProducts(); loadCustomers(); loadSettings(); checkRegister();
  }, []);

  // Reload (or clear) accounts whenever the accounting module is toggled
  useEffect(() => {
    if (modules.accounting) {
      window.api.getAccounts?.().then((res: any) => {
        if (res?.success && res.data?.accounts) setAccounts(res.data.accounts);
      }).catch(() => {});
    } else {
      setAccounts([]);
      setSelectedAccountId('');
    }
  }, [modules.accounting]);

  const checkRegister = async () => {
    try { const res = await window.api.getCurrentRegister(); if (res.success) setCurrentRegister(res.data); } catch { }
  };

  const loadCustomers = async () => {
    try {
      const res = await window.api.getCustomers();
      if (res?.success) {
        setCustomers(res.data);
        const params = new URLSearchParams(location.search);
        const cid = params.get('customer_id');
        if (cid) {
          setSelectedCustomerId(Number(cid));
        } else {
          const walkin = res.data.find((c: any) => c.name.toLowerCase().includes('walk-in'));
          if (walkin) { setSelectedCustomerId(walkin.id); setCustomerSearch(walkin.name); }
        }
      }
    } catch { }
  };

  useEffect(() => {
    if (showCustom) {
      setCustomName(''); setCustomPrice(''); setCustomQty('1');
      setTimeout(() => customNameRef.current?.focus(), 100);
    }
  }, [showCustom]);

  const loadProducts = async () => {
    try { const res = await window.api.getProducts(); setProducts((res?.success && res.data) ? res.data as any : []); } catch { }
  };
  const loadSettings = async () => {
    try { const res = await window.api.getSettings(); if (res?.success && res.data) setSettings(res.data); } catch { }
  };

  const handleSearch = (v: string) => {
    setIsSearching(true); setSearchTerm(v); setActiveCategory('');
    setTimeout(() => setIsSearching(false), 250);
  };

  const handleCategoryFilter = (cat: string) => {
    setActiveCategory(cat); setSearchTerm('');
  };

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (activeCategory) return p.category?.toLowerCase() === activeCategory.toLowerCase();
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q);
  }), [products, searchTerm, activeCategory]);

  const filteredCustomers = useMemo(() => customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(customerSearch.toLowerCase())
  ), [customers, customerSearch]);

  const { visible: visibleProducts, hasMore, loadMore, total: prodTotal, showing: prodShowing } = usePagination(filteredProducts, 12, 1);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))), [products]);

  const addProductToCart = (product: Product) => {
    const key = String(product.id);
    const existing = cart.find((i) => i.id === key);
    if (existing) {
      if (product.stock !== undefined && existing.quantity + 1 > product.stock) {
        addNotification("Stock Limit", `Only ${product.stock} units available.`, "warning"); return;
      }
      setCart(cart.map((i) => i.id === key ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      if (product.stock !== undefined && product.stock <= 0) {
        addNotification("Out of Stock", `${product.name} is out of stock.`, "error"); return;
      }
      setCart([...cart, { id: key, product_id: product.id, name: product.name, price: product.price, quantity: 1, is_custom: false, stock: product.stock, metadata: product.metadata, product_type: product.product_type }]);
    }
  };

  const addCustomToCart = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(customPrice);
    const qty = parseInt(customQty) || 1;
    if (!customName.trim() || isNaN(price) || price <= 0) return;
    setCart([...cart, { id: `custom-${Date.now()}`, product_id: null, name: customName.trim(), price, quantity: qty, is_custom: true }]);
    setShowCustom(false);
  };

  const updateQty = (id: string, rawValue: string) => {
    const qty = parseInt(rawValue.replace(/[^0-9]/g, '')) || 0;
    const item = cart.find(i => i.id === id);
    if (item && item.stock !== undefined && qty > item.stock) {
      addNotification("Stock Limit", `Only ${item.stock} units available.`, "warning");
      setCart(cart.map((i) => i.id === id ? { ...i, quantity: item.stock } : i)); return;
    }
    setCart(cart.map((i) => i.id === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id: string, rawValue: string) => {
    const price = parseFloat(rawValue.replace(/[^0-9.]/g, '')) || 0;
    setCart(cart.map((i) => i.id === id ? { ...i, price } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = discountType === 'percentage'
    ? (subtotal * (parseFloat(discountValue) || 0)) / 100
    : (parseFloat(discountValue) || 0);
  const total = Math.max(0, subtotal - discountAmount);

  const handleAddCustomerInline = async () => {
    if (!newCustomerName.trim()) { addNotification("Error", "Customer name is required", "error"); return; }
    try {
      setIsProcessing(true);
      const res = await window.api.addCustomer({ name: newCustomerName, phone: newCustomerPhone });
      if (res.success) {
        await loadCustomers(); setSelectedCustomerId(res.data.id); setShowAddCustomer(false);
        setNewCustomerName(''); setNewCustomerPhone('');
        addNotification("Success", "Customer added successfully", "success");
      } else { addNotification("Error", res.error || "Failed to add customer", "error"); }
    } catch { addNotification("Error", "Network or database error", "error"); }
    finally { setIsProcessing(false); }
  };

  const processPayment = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    const parsedAmountPaid = Number(amountPaid);
    const fallbackAmountPaid = selectedCustomerId ? 0 : total;
    const amtPaid = paymentMethod === 'udhaar' ? 0
      : (amountPaid === "" || !Number.isFinite(parsedAmountPaid) ? fallbackAmountPaid : parsedAmountPaid);
    if (amtPaid > total) {
      addNotification("Invalid Payment", "Amount paid cannot exceed the sale total.", "error");
      setIsProcessing(false); return;
    }
    let paymentStatus = 'Paid';
    if (paymentMethod === 'udhaar') paymentStatus = 'Pending';
    else if (!isNaN(amtPaid) && amtPaid < total) paymentStatus = 'Partial';
    else if (!isNaN(amtPaid) && amtPaid <= 0 && total > 0) paymentStatus = 'Pending';
    const storedMethod = paymentMethod === 'udhaar' ? 'credit' : paymentMethod;
    try {
      const result = await window.api.createSale({
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : undefined,
        subtotal, discount: discountAmount, total, payment_method: storedMethod,
        payment_status: paymentStatus,
        amount_paid: isNaN(amtPaid) ? (selectedCustomerId ? 0 : total) : amtPaid,
        register_id: currentRegister?.id || null,
        account_id: selectedAccountId ? Number(selectedAccountId) : undefined,
        items: cart.map((c) => ({ product_id: c.product_id || undefined, product_name: c.name || 'Unknown Item', quantity: c.quantity, price: c.price, is_custom: c.is_custom })),
      });
      if (result.success) {
        addNotification("Sale Processed", `Transaction completed via ${paymentMethod} payment.`, "success");
        const cust = customers.find(c => c.id === Number(selectedCustomerId));
        const finalAmtPaid = isNaN(amtPaid) ? (selectedCustomerId ? 0 : total) : amtPaid;
        setReceiptData({
          saleId: result.data?.saleId || Date.now(), items: [...cart], subtotal, discount: discountAmount, total,
          paymentMethod, settings: { ...settings }, date: new Date().toLocaleString('en-PK', { timeZoneName: 'short' }),
          customerPhone: cust?.phone, amountPaid: finalAmtPaid, balance: finalAmtPaid - total,
        });
        loadProducts(); setDiscountValue(''); setAmountPaid(''); setSelectedCustomerId(''); setPaymentMethod('cash'); setSelectedAccountId('');
        // Refresh account balances so picker shows updated balance for next sale
        if (modules.accounting) {
          window.api.getAccounts?.().then((r: any) => {
            if (r?.success && r.data?.accounts) setAccounts(r.data.accounts);
          }).catch(() => {});
        }
        setTimeout(() => { setShowCheckoutModal(false); setIsProcessing(false); }, 800);
      } else { addNotification("Transaction Failed", result.error || "A processing error occurred.", "error"); setIsProcessing(false); }
    } catch { addNotification("Error", "Critical error processing sale.", "error"); setIsProcessing(false); }
  };

  const handlePrintReceipt = async () => {
    if (!receiptData) return;
    let freshSettings = receiptData.settings;
    try { const res = await window.api.getSettings(); if (res?.success && res.data) freshSettings = res.data; } catch { }
    await window.api.printInvoice(buildInvoiceHtml({ ...receiptData, settings: freshSettings }));
  };

  const handleSavePdf = async () => {
    if (!receiptData) return;
    let freshSettings = receiptData.settings;
    try { const res = await window.api.getSettings(); if (res?.success && res.data) freshSettings = res.data; } catch { }
    await window.api.saveInvoicePdf(buildInvoiceHtml({ ...receiptData, settings: freshSettings }));
  };

  const handleCloseReceipt = () => { setReceiptData(null); setCart([]); };

  const hasAmountPaidValue = amountPaid.trim() !== '';
  const enteredAmountPaid = hasAmountPaidValue ? Number(amountPaid) : NaN;
  const normalizedAmountPaid = Number.isFinite(enteredAmountPaid) ? enteredAmountPaid : 0;
  const effectiveAmountPaid = paymentMethod === 'udhaar' ? 0
    : hasAmountPaidValue ? normalizedAmountPaid : (selectedCustomerId ? 0 : total);
  const isOverPayment = effectiveAmountPaid > total;
  const isWalkInPartial = paymentMethod !== 'udhaar' && !selectedCustomerId && effectiveAmountPaid < total;
  const isUdhaarWithoutCustomer = paymentMethod === 'udhaar' && !selectedCustomerId;
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between px-1 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <CreditCard size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Point of Sale</h1>
            <p className="text-xs text-muted-foreground">
              {products.length} products · {cart.length > 0 ? `${cartItemCount} item${cartItemCount !== 1 ? 's' : ''} in cart` : 'Cart empty'}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCustom(true)}
          variant="outline"
          size="sm"
          className="gap-2 font-semibold border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
        >
          <Sparkles size={14} className="text-primary" /> Custom Item
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Left: Product Catalog ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">

          {/* Search bar */}
          <div className="p-3 border-b border-border/40 bg-muted/20 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              {isSearching
                ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary/60" />
                : searchTerm && <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>
              }
              <Input
                placeholder="Search by name, category or barcode…"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 pr-9 h-10 bg-background shadow-none border-border/50"
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="px-3 py-2 border-b border-border/30 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { setActiveCategory(''); setSearchTerm(''); }}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
                !activeCategory && !searchTerm
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
              )}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryFilter(cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all capitalize',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_68px_90px_36px] px-4 py-2 bg-muted/30 border-b border-border/30 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Product</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 text-center">Category</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 text-center">Stock</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 text-right">Price</span>
            <span />
          </div>

          {/* Product list */}
          <AnimatedList
            items={visibleProducts}
            className="flex-1"
            maxHeight="none"
            renderItem={(product: any) => {
              const isOutOfStock = (product.stock ?? 999) <= 0;
              const lowStock = !isOutOfStock && (product.stock ?? 999) < 10;
              const colors = colorForProduct(product);
              const inCart = cart.find(i => i.id === String(product.id));

              return (
                <div className={cn(
                  'grid grid-cols-[1fr_80px_68px_90px_36px] items-center px-4 py-3 border-b border-border/20 transition-all duration-150',
                  isOutOfStock
                    ? 'opacity-50 bg-muted/5'
                    : 'hover:bg-primary/[0.03] cursor-pointer',
                  inCart && !isOutOfStock && 'bg-primary/[0.05] border-primary/10',
                )}>
                  {/* Product info */}
                  <div className="min-w-0 flex items-center gap-2.5">
                    {/* Color dot / initial */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0 shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`, color: colors.text }}
                    >
                      {product.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={cn('text-sm font-semibold truncate', inCart ? 'text-primary' : 'text-foreground')}>
                        {product.name}
                        {inCart && <span className="ml-1.5 text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">×{inCart.quantity}</span>}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                        {product.barcode && (
                          <span className="text-[9px] text-muted-foreground font-mono bg-muted/60 px-1 rounded shrink-0">{product.barcode}</span>
                        )}
                        {product.unit && (
                          <span className="text-[9px] text-primary/70 font-bold shrink-0">{product.unit}</span>
                        )}
                        {(() => {
                          const entries = product.metadata ? Object.entries(product.metadata).filter(([k, v]: any) => k !== 'tags' && v).map(([k, v]: any) => `${k.replace('_',' ')}: ${v}`) : [];
                          const tags = product.metadata?.tags && Array.isArray(product.metadata.tags) ? product.metadata.tags : [];
                          const str = [...entries, ...tags].join(' • ');
                          if (!str) return null;
                          return <span className="text-[9px] text-muted-foreground truncate capitalize">{str}</span>;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex justify-center">
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md truncate max-w-[70px]">
                      {product.category || 'General'}
                    </span>
                  </div>

                  {/* Stock */}
                  <div className="flex justify-center">
                    <div className={cn(
                      'w-12 h-8 rounded-lg flex flex-col items-center justify-center border',
                      isOutOfStock ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                        : lowStock ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                    )}>
                      <span className="text-[11px] font-black leading-none">{isOutOfStock ? 'OUT' : product.stock}</span>
                      {!isOutOfStock && <span className="text-[7px] uppercase font-semibold opacity-60 leading-none mt-0.5">units</span>}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right pr-1">
                    <span className="text-sm font-black text-foreground">{fmtPKR(product.price)}</span>
                  </div>

                  {/* Add button */}
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!isOutOfStock) addProductToCart(product); }}
                      disabled={isOutOfStock}
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                        isOutOfStock
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:scale-110 shadow-sm hover:shadow-md hover:shadow-primary/25'
                      )}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            }}
            onItemSelect={(product) => {
              if ((product.stock ?? 999) > 0) addProductToCart(product);
              else addNotification("Out of Stock", "This item is currently unavailable.", "error");
            }}
          />

          {visibleProducts.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package size={40} className="opacity-10 mb-3" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs opacity-60 mt-1">Try adjusting your search or category</p>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border/30 bg-muted/10 flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-foreground">
              Showing <strong className="text-foreground">{prodShowing}</strong> of <strong className="text-foreground">{prodTotal}</strong>
            </span>
            {hasMore && (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); loadMore(); }}
                className="h-7 text-xs gap-1.5 font-semibold">
                <RefreshCw size={12} /> Load more
              </Button>
            )}
          </div>
        </div>

        {/* ── Right: Cart Panel ── */}
        <div className="w-[360px] shrink-0 flex flex-col bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">

          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <CartIcon size={18} className="text-foreground" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold ring-2 ring-background">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className="font-bold text-sm text-foreground">Current Order</span>
              {cart.length > 0 && (
                <span className="text-xs text-muted-foreground">({cart.length} line{cart.length !== 1 ? 's' : ''})</span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-destructive/70 hover:text-destructive font-medium transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <CartIcon size={28} className="text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tap a product to add it</p>
              </div>
            ) : cart.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-2.5 p-2.5 rounded-xl border transition-all',
                  item.is_custom
                    ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-900/10'
                    : 'border-border/50 bg-background hover:border-primary/20'
                )}
              >
                {/* Color indicator */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                  style={item.is_custom
                    ? { background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff' }
                    : (() => { const c = colorForProduct({ id: item.product_id ?? 0, name: item.name, price: item.price, category: '', ...item } as any); return { background: `linear-gradient(135deg,${c.from},${c.to})`, color: c.text }; })()
                  }
                >
                  {item.is_custom ? <Sparkles size={12} /> : item.name[0]?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate leading-tight">{item.name}</p>
                      {item.is_custom && <span className="text-[9px] text-purple-600 dark:text-purple-400 font-medium">Custom item</span>}
                    </div>
                    <button onClick={() => setCart(cart.filter((i) => i.id !== item.id))}
                      className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0 mt-0.5">
                      <X size={13} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Qty control */}
                    <div className="flex items-center bg-muted/60 rounded-lg overflow-hidden border border-border/40">
                      <button onClick={() => updateQty(item.id, String(item.quantity - 1))}
                        className="w-6 h-6 flex items-center justify-center hover:bg-muted transition-colors">
                        <Minus size={10} className="text-muted-foreground" />
                      </button>
                      <input
                        type="text"
                        value={item.quantity || ''}
                        onChange={(e) => updateQty(item.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-8 text-center text-xs font-bold bg-transparent outline-none"
                      />
                      <button onClick={() => updateQty(item.id, String(item.quantity + 1))}
                        className="w-6 h-6 flex items-center justify-center hover:bg-muted transition-colors">
                        <Plus size={10} className="text-muted-foreground" />
                      </button>
                    </div>

                    {/* Price input */}
                    <div className="flex items-center gap-1 flex-1 justify-end">
                      <span className="text-[9px] text-muted-foreground font-bold">Rs</span>
                      <input
                        type="text"
                        value={item.price || ''}
                        onChange={(e) => updatePrice(item.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-16 text-xs font-black text-primary text-right bg-transparent border-b border-primary/20 focus:border-primary outline-none"
                      />
                    </div>

                    {/* Line total */}
                    <span className="text-xs font-black text-foreground tabular-nums shrink-0">
                      {fmtPKR(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cart footer */}
          <div className="border-t border-border/40 bg-muted/10 p-3 space-y-3 shrink-0">

            {/* Discount */}
            {cart.length > 0 && (
              <div className="bg-background rounded-xl border border-border/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Tag size={10} /> Discount
                  </span>
                  <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
                    {(['percentage', 'fixed'] as const).map(t => (
                      <button key={t} onClick={() => setDiscountType(t)}
                        className={cn('px-2 py-0.5 text-[10px] font-bold rounded transition-colors',
                          discountType === t ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}>
                        {t === 'percentage' ? '%' : 'Rs'}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  type="number" min="0"
                  max={discountType === 'percentage' ? '100' : subtotal}
                  placeholder={discountType === 'percentage' ? '0%' : '0.00'}
                  value={discountValue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val < 0) return;
                    if (discountType === 'percentage' && val > 100) return;
                    if (discountType === 'fixed' && val > subtotal) return;
                    setDiscountValue(e.target.value);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Payment method */}
            <div className="grid grid-cols-3 gap-1.5">
              {(['cash', 'online'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    'py-2 rounded-xl text-xs font-bold border transition-all',
                    paymentMethod === m
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {m === 'online' ? 'Online' : 'Cash'}
                </button>
              ))}
              <button
                onClick={() => { setPaymentMethod('udhaar'); setAmountPaid('0'); }}
                className={cn(
                  'py-2 rounded-xl text-xs font-bold border transition-all',
                  paymentMethod === 'udhaar'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-background border-rose-400/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                )}
              >
                Udhaar
              </button>
            </div>

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{fmtPKR(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Discount {discountType === 'percentage' && `(${discountValue}%)`}</span>
                  <span className="tabular-nums font-semibold">−{fmtPKR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border/30 mt-1">
                <span className="font-bold text-foreground">Total</span>
                <span className="text-2xl font-black text-primary tabular-nums">{fmtPKR(total)}</span>
              </div>
            </div>

            {/* Checkout button */}
            <Button
              onClick={() => { setAmountPaid(String(total)); setShowCheckoutModal(true); }}
              disabled={cart.length === 0 || isProcessing}
              size="lg"
              className="w-full h-11 font-bold gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            >
              <CreditCard size={17} />
              {cart.length === 0 ? 'Add items to checkout' : `Checkout · ${fmtPKR(total)}`}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Custom Item Modal ── */}
      {showCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Custom Item</CardTitle>
                  <CardDescription className="text-xs">Add an unlisted product</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCustom(false)} className="h-8 w-8 -mr-2">
                <X size={16} />
              </Button>
            </CardHeader>
            <form onSubmit={addCustomToCart}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Name *</label>
                  <Input ref={customNameRef} required value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Special Platter" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price (PKR) *</label>
                    <Input type="text" required value={customPrice} onChange={(e) => setCustomPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantity *</label>
                    <Input type="text" required value={customQty} onChange={(e) => setCustomQty(e.target.value.replace(/[^0-9]/g, ''))} />
                  </div>
                </div>
                {customName && customPrice && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3 text-sm">
                    <span className="text-purple-700 dark:text-purple-300 font-medium">{customName} <span className="opacity-60">×{customQty || 1}</span></span>
                    <span className="float-right font-bold text-purple-700 dark:text-purple-300">{fmtPKR((parseFloat(customPrice) || 0) * (parseInt(customQty) || 1))}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-3 pt-0">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCustom(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-transparent">Add to Cart</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* ── Checkout Modal ── */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle className="text-lg">Checkout</CardTitle>
                <CardDescription className="text-xs">{cart.length} item(s) · {fmtPKR(total)}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setShowCheckoutModal(false); setPaymentMethod('cash'); }} className="-mr-2">
                <X size={18} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">

              {/* Customer selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold flex items-center gap-1.5">
                    <Users size={14} className="text-muted-foreground" /> Customer
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </label>
                  {!showAddCustomer && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowAddCustomer(true)}>
                      + New
                    </Button>
                  )}
                </div>

                {showAddCustomer ? (
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/50 space-y-2 animate-in fade-in">
                    <Input placeholder="Customer Name *" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="h-8 text-sm" />
                    <Input placeholder="Phone Number" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} className="h-8 text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleAddCustomerInline} disabled={isProcessing}>Add & Select</Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                      <Input
                        placeholder="Type customer name or phone…"
                        value={customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); if (!e.target.value) setSelectedCustomerId(''); }}
                        className="pl-9 h-10 text-sm"
                      />
                      {selectedCustomerId && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }}>
                          <X size={14} />
                        </Button>
                      )}
                    </div>

                    {customerSearch && !selectedCustomerId && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-[200px] overflow-y-auto">
                        <div className="p-2.5 text-xs hover:bg-accent cursor-pointer flex items-center justify-between border-b border-border/50"
                          onClick={() => { setSelectedCustomerId(''); setCustomerSearch('Walk-in Customer'); }}>
                          <span className="font-semibold">Walk-in Customer</span>
                          <Badge variant="outline" className="text-[10px]">Guest</Badge>
                        </div>
                        {filteredCustomers.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground italic">No customers found.</div>
                        ) : filteredCustomers.map(c => (
                          <div key={c.id} className="p-2.5 hover:bg-accent cursor-pointer border-b border-border/30 last:border-0 transition-colors"
                            onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); }}>
                            <div className="font-semibold text-sm">{c.name}</div>
                            {c.phone && <div className="text-[10px] text-muted-foreground">{c.phone}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedCustomerId && (
                      <div className="flex items-center gap-2 p-2.5 bg-primary/5 rounded-xl border border-primary/15">
                        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                          <Users size={13} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{customers.find(c => c.id === selectedCustomerId)?.name}</p>
                          <p className="text-[10px] text-muted-foreground">Linked to this sale</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment summary */}
              <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold text-lg">{fmtPKR(total)}</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Amount Paid (PKR)
                    {paymentMethod === 'udhaar' && <span className="ml-2 text-rose-500 normal-case font-normal">— Full credit (PKR 0)</span>}
                  </label>
                  <Input
                    type="text"
                    value={paymentMethod === 'udhaar' ? '0' : amountPaid}
                    disabled={paymentMethod === 'udhaar'}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                      if (!digitsOnly) { setAmountPaid(''); return; }
                      const numericValue = Number(digitsOnly);
                      if (!Number.isFinite(numericValue)) { setAmountPaid(''); return; }
                      setAmountPaid(String(Math.min(numericValue, Math.max(0, total))));
                    }}
                    className={cn('text-lg font-bold', paymentMethod === 'udhaar' && 'opacity-50 cursor-not-allowed')}
                  />
                  {isOverPayment && <p className="text-xs text-destructive font-medium">Amount paid cannot exceed total.</p>}
                  {isUdhaarWithoutCustomer && <p className="text-xs text-destructive font-medium">⚠ Udhaar requires a customer — select one above.</p>}
                  {!isUdhaarWithoutCustomer && selectedCustomerId && paymentMethod === 'udhaar' && (
                    <p className="text-xs text-rose-500">{fmtPKR(total)} will be added to customer's Qaraz.</p>
                  )}
                  {!isUdhaarWithoutCustomer && selectedCustomerId && paymentMethod !== 'udhaar' && effectiveAmountPaid < total && (
                    <p className="text-xs text-muted-foreground">Remaining {fmtPKR(total - effectiveAmountPaid)} → customer's Qaraz.</p>
                  )}
                  {isWalkInPartial && <p className="text-xs text-destructive font-medium">Walk-in customers can't have partial payments. Select a customer or use Udhaar.</p>}
                </div>
              </div>

              {/* Account selector — only when accounting module is ON and not udhaar */}
              {modules.accounting && paymentMethod !== 'udhaar' && accounts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Received Into Account
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {accounts.map((acc: any) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(selectedAccountId === acc.id ? '' : acc.id)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-sm',
                          selectedAccountId === acc.id
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                            : 'bg-muted/30 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50'
                        )}
                      >
                        <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', acc.type === 'cash' ? 'bg-emerald-500' : 'bg-blue-500')} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{acc.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">PKR {Math.round(Number(acc.current_balance) || 0).toLocaleString('en-PK')}</p>
                        </div>
                        {selectedAccountId === acc.id && (
                          <span className="text-emerald-500 flex-shrink-0">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {!selectedAccountId && (
                    <p className="text-[10px] text-muted-foreground/70 italic">No account selected — payment won't be tracked</p>
                  )}
                  {(() => {
                    if (!selectedAccountId || paymentMethod === 'udhaar') return null;
                    const selAcc = accounts.find((a: any) => a.id === selectedAccountId);
                    const paid = effectiveAmountPaid;
                    if (!selAcc || paid <= 0) return null;
                    const bal = Number(selAcc.current_balance) || 0;
                    if (paid <= bal) return (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Balance after receipt: {fmtPKR(bal + paid)}
                      </p>
                    );
                    return null;
                  })()}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-2 pt-0">
              {modules.accounting && accounts.length > 0 && !selectedAccountId && paymentMethod !== 'udhaar' && (
                <p className="w-full text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  Please select which account receives this payment
                </p>
              )}
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={() => { setShowCheckoutModal(false); setPaymentMethod('cash'); }}>Cancel</Button>
                <Button
                  onClick={processPayment}
                  disabled={isProcessing || isWalkInPartial || isOverPayment || isUdhaarWithoutCustomer || (modules.accounting && accounts.length > 0 && !selectedAccountId && paymentMethod !== 'udhaar')}
                  className="flex-1 gap-2"
                >
                  {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Complete Sale
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {receiptData && (
        <ReceiptModal data={receiptData} onPrint={handlePrintReceipt} onSavePdf={handleSavePdf} onClose={handleCloseReceipt} />
      )}

      <RegisterManager
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegisterStatusChange={setCurrentRegister}
      />
    </div>
  );
}

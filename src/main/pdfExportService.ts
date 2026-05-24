import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const fmtPKR = (n: any) => 'PKR ' + (Math.round(Number(n) || 0)).toLocaleString('en-PK');
const fmtDate = (d: Date) => d.toLocaleDateString('en-PK', { 
  day: '2-digit', 
  month: '2-digit', 
  year: 'numeric' 
});
const fmtDateTime = (d: Date) => d.toLocaleString('en-PK', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

interface TransactionRecord {
  type: 'SALE' | 'PURCHASE' | 'PAYMENT' | 'RETURN' | 'VENDOR_RETURN';
  date: Date;
  ref: string;
  amount: number;
  paid?: number;
  returned?: number;
  balance?: number;
  items?: any[];
  status: string;
}

interface PdfOptions {
  type: 'CUSTOMER' | 'VENDOR';
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  totalTaken: number;
  totalPaid: number;
  totalReturned: number;
  transactions: TransactionRecord[];
}

/**
 * Generate a beautiful cell-invoice style PDF for customer/vendor details
 */
export function generateDetailsExportPDF(options: PdfOptions): Promise<string> {
  const {
    type,
    name,
    phone,
    email,
    address,
    balance,
    totalTaken,
    totalPaid,
    totalReturned,
    transactions
  } = options;

  // Create document
  const doc = new PDFDocument({
    size: [595, 842], // A4
    margin: 30,
    bufferPages: true
  });

  // Generate filename
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${type.toLowerCase()}_${sanitized}_${timestamp}.pdf`;
  const filepath = path.join(app.getPath('downloads'), filename);

  // Create write stream
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  // Colors and fonts
  const primaryColor = '#1e40af'; // blue-700
  const successColor = '#059669'; // emerald-600
  const warningColor = '#d97706'; // amber-600
  const dangerColor = '#dc2626'; // red-600

  // Title
  doc.fontSize(20).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text(`${type === 'CUSTOMER' ? 'CUSTOMER' : 'VENDOR'} ACCOUNT STATEMENT`, {
    align: 'center'
  });

  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#666666');
  doc.text(`Generated on ${fmtDateTime(new Date())}`, {
    align: 'center'
  });

  // Divider
  doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);

  // Customer/Vendor Info Block
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
  doc.text(name, { width: 500 });

  doc.fontSize(10).font('Helvetica').fillColor('#666666');
  if (phone) doc.text(`Phone: ${phone}`);
  if (email) doc.text(`Email: ${email}`);
  if (address) doc.text(`Address: ${address}`);

  doc.moveDown(0.3);

  // Summary Cards
  const summaryY = doc.y;
  const cardWidth = 130;
  const cardHeight = 60;
  const cardGap = 10;

  // Helper to draw summary card
  const drawSummaryCard = (x: number, label: string, value: string, color: string) => {
    // Background
    doc.rect(x, summaryY, cardWidth, cardHeight).fillAndStroke(color + '15', color);

    // Label
    doc.fontSize(9).font('Helvetica').fillColor('#666666');
    doc.text(label, x + 10, summaryY + 8, { width: cardWidth - 20, height: 15 });

    // Value
    doc.fontSize(11).font('Helvetica-Bold').fillColor(color);
    doc.text(value, x + 10, summaryY + 25, { width: cardWidth - 20, height: 30 });
  };

  drawSummaryCard(30, 'TOTAL BILLED', fmtPKR(totalTaken), primaryColor);
  drawSummaryCard(30 + cardWidth + cardGap, 'PAID', fmtPKR(totalPaid), successColor);
  drawSummaryCard(30 + (cardWidth + cardGap) * 2, 'RETURNED', fmtPKR(totalReturned), warningColor);
  drawSummaryCard(30 + (cardWidth + cardGap) * 3, 'BALANCE', fmtPKR(balance), balance > 0 ? dangerColor : successColor);

  doc.y = summaryY + cardHeight + 20;

  // Divider
  doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);

  // Transaction History Header
  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('TRANSACTION HISTORY', { underline: true });
  doc.moveDown(0.3);

  // Table Header
  const tableY = doc.y;
  const col1 = 30;     // Date
  const col2 = 120;    // Reference
  const col3 = 240;    // Description
  const col4 = 380;    // Amount
  const col5 = 470;    // Balance

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
  doc.rect(col1 - 5, tableY - 2, 540, 20).fill(primaryColor);

  doc.text('DATE', col1, tableY + 4, { width: 80 });
  doc.text('REF', col2, tableY + 4, { width: 110 });
  doc.text('TYPE', col3, tableY + 4, { width: 130 });
  doc.text('AMOUNT', col4, tableY + 4, { width: 80, align: 'right' });
  doc.text('BALANCE', col5, tableY + 4, { width: 85, align: 'right' });

  let currentY = tableY + 24;
  let runningBalance = balance; // Start from current balance

  // Reverse transactions to show chronologically (oldest first for running balance)
  const reversedTransactions = [...transactions].reverse();
  const startingBalance = reversedTransactions.length > 0 
    ? balance + reversedTransactions.reduce((sum, t) => {
        if (t.type === 'SALE' || t.type === 'PURCHASE') return sum + (t.amount || 0) - (t.paid || 0);
        if (t.type === 'PAYMENT') return sum - (t.paid || 0);
        if (t.type === 'RETURN' || t.type === 'VENDOR_RETURN') return sum - (t.returned || 0);
        return sum;
      }, 0)
    : balance;

  runningBalance = startingBalance;

  // Draw transactions (reverse order to show newest first again for display)
  transactions.forEach((tx: TransactionRecord, idx: number) => {
    if (currentY > 750) {
      doc.addPage();
      currentY = 30;
    }

    // Determine transaction color
    let txColor = '#666666';
    let typeLabel = '';
    let txAmount = 0;

    if (tx.type === 'SALE') {
      txColor = primaryColor;
      typeLabel = `Sale ${tx.status}`;
      txAmount = tx.amount || 0;
      runningBalance -= txAmount - (tx.paid || 0);
    } else if (tx.type === 'PURCHASE') {
      txColor = primaryColor;
      typeLabel = `Purchase ${tx.status}`;
      txAmount = tx.amount || 0;
      runningBalance -= txAmount - (tx.paid || 0);
    } else if (tx.type === 'PAYMENT') {
      txColor = successColor;
      typeLabel = 'Payment Received';
      runningBalance += (tx.paid || 0);
    } else if (tx.type === 'RETURN' || tx.type === 'VENDOR_RETURN') {
      txColor = warningColor;
      typeLabel = 'Return';
      runningBalance += (tx.returned || 0);
    }

    // Alternate background
    if (idx % 2 === 0) {
      doc.rect(30, currentY - 2, 540, 18).fill('#f9fafb');
    }

    // Content
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    doc.text(fmtDate(tx.date), col1, currentY, { width: 80 });
    doc.text(tx.ref, col2, currentY, { width: 110 });
    doc.fillColor(txColor);
    doc.text(typeLabel, col3, currentY, { width: 130 });
    doc.fillColor('#000000');
    
    const amountStr = tx.type === 'PAYMENT' || tx.type === 'RETURN' || tx.type === 'VENDOR_RETURN'
      ? `+${fmtPKR(tx.paid || tx.returned || 0)}`
      : fmtPKR(txAmount);
    
    doc.text(amountStr, col4, currentY, { width: 80, align: 'right' });
    doc.text(fmtPKR(runningBalance), col5, currentY, { width: 85, align: 'right' });

    currentY += 20;
  });

  doc.moveDown(1);

  // Footer
  doc.fontSize(9).fillColor('#999999');
  doc.text('---', 30, doc.y);
  doc.fontSize(8);
  doc.text(`This is an auto-generated statement for ${type.toLowerCase()} ${name}.`, 30, doc.y, {
    width: 500
  });
  doc.text(`For inquiries, please contact us. Thank you for your business!`, 30, doc.y, {
    width: 500
  });

  // Finalize PDF
  doc.end();

  return new Promise<string>((resolve, reject) => {
    stream.on('finish', () => resolve(filepath));
    stream.on('error', (err: Error) => reject(err));
    doc.on('error', (err: Error) => reject(err));
  });
}

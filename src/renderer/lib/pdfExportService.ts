/**
 * PDF Export Service for Customer/Vendor Details
 * Generates beautiful HTML invoices that can be printed to PDF
 */
import { formatInvoiceId } from './utils';

const formatPurchaseRef = (id: number | string, dateString?: string) => {
  const d = dateString ? new Date(dateString) : new Date();
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const datePart = `${safeDate.getFullYear()}${String(safeDate.getMonth() + 1).padStart(2, '0')}${String(safeDate.getDate()).padStart(2, '0')}`;
  const numericId = Number(id);
  const idPart = Number.isFinite(numericId) ? String(Math.max(0, Math.trunc(numericId))).padStart(5, '0') : String(id || '').trim();
  return `PO-${datePart}-${idPart || '00000'}`;
};

export interface CustomerData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  totalTaken: number;
  totalPaid: number;
  totalReturned: number;
  sales: any[];
  payments: any[];
  returns: any[];
}

export interface VendorData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  totalTaken: number;
  totalPaid: number;
  totalReturned: number;
  purchases: any[];
  payments: any[];
  returns: any[];
}

export interface TransactionRecord {
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

const fmtPKR = (n: any) => 'PKR ' + (Math.round(Number(n) || 0)).toLocaleString('en-PK');
const fmtDate = (d: any) => new Date(d).toLocaleDateString('en-PK', { 
  day: '2-digit', 
  month: '2-digit', 
  year: 'numeric' 
});
const fmtDateTime = (d: any) => new Date(d).toLocaleString('en-PK', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

/**
 * Format customer data for PDF export
 * Combines all sales, payments, and returns into transaction history
 */
export function formatCustomerDataForPDF(customerDetails: any): {
  customer: any;
  transactions: TransactionRecord[];
  summary: any;
} {
  const transactions: TransactionRecord[] = [];
  const saleRefById = new Map<number, string>(
    (customerDetails.sales || []).map((s: any) => [Number(s.id), formatInvoiceId(s.id, s.date_created)])
  );

  // Add sales
  (customerDetails.sales || []).forEach((s: any) => {
    transactions.push({
      type: 'SALE',
      date: new Date(s.date_created),
      ref: formatInvoiceId(s.id, s.date_created),
      amount: Number(s.total) || 0,
      paid: Number(s.amountPaid) || 0,
      returned: Number(s.amountReturned) || 0,
      balance: Math.max(0, Number(s.remaining) || 0),
      status: s.status === 'Cancelled' ? 'Cancelled' : (Number(s.amountReturned) || 0) > 0 ? 'Returned' : Math.max(0, Number(s.remaining) || 0) <= 0.5 ? 'Settled' : 'Pending',
      items: s.items || []
    });
  });

  // Add payments
  (customerDetails.payments || []).forEach((p: any) => {
    transactions.push({
      type: 'PAYMENT',
      date: new Date(p.date_added || p.date_created),
      ref: p.sale_id ? saleRefById.get(Number(p.sale_id)) || formatInvoiceId(p.sale_id, p.date_added || p.date_created) : `Payment #${p.id}`,
      amount: 0,
      paid: Number(p.amount) || 0,
      returned: 0,
      balance: 0,
      status: 'Settled'
    });
  });

  // Add returns
  (customerDetails.returns || []).forEach((r: any) => {
    transactions.push({
      type: 'RETURN',
      date: new Date(r.date_returned || r.date_created),
      ref: r.sale_id ? saleRefById.get(Number(r.sale_id)) || formatInvoiceId(r.sale_id, r.date_returned || r.date_created) : `Return #${r.id}`,
      amount: 0,
      paid: 0,
      returned: Number(r.total_returned) || 0,
      balance: 0,
      status: 'Returned'
    });
  });

  // Sort by date descending
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    customer: {
      name: customerDetails.customer?.name || 'Unknown',
      phone: customerDetails.customer?.phone,
      email: customerDetails.customer?.email,
      address: customerDetails.customer?.address,
      balance: Number(customerDetails.balance) || 0
    },
    transactions,
    summary: {
      totalTaken: Number(customerDetails.total_taken) || 0,
      totalPaid: Number(customerDetails.total_paid) || 0,
      totalReturned: Number(customerDetails.total_returned) || 0,
      balance: Number(customerDetails.balance) || 0
    }
  };
}

/**
 * Format vendor data for PDF export
 * Combines all purchases, payments, and returns into transaction history
 */
export function formatVendorDataForPDF(vendorDetails: any): {
  vendor: any;
  transactions: TransactionRecord[];
  summary: any;
} {
  const transactions: TransactionRecord[] = [];
  const purchaseRefById = new Map<number, string>(
    (vendorDetails.purchases || []).map((p: any) => [Number(p.id), formatPurchaseRef(p.id, p.date_created)])
  );

  // Add purchases
  (vendorDetails.purchases || []).forEach((p: any) => {
    transactions.push({
      type: 'PURCHASE',
      date: new Date(p.date_created),
      ref: formatPurchaseRef(p.id, p.date_created),
      amount: Number(p.total) || 0,
      paid: Number(p.amountPaid) || 0,
      returned: Number(p.amountReturned) || 0,
      balance: Math.max(0, Number(p.remaining) || 0),
      status: p.status === 'Cancelled' ? 'Cancelled' : (Number(p.amountReturned) || 0) > 0 ? 'Returned' : Math.max(0, Number(p.remaining) || 0) <= 0.5 ? 'Settled' : 'Pending',
      items: p.items || []
    });
  });

  // Add payments
  (vendorDetails.payments || []).forEach((p: any) => {
    transactions.push({
      type: 'PAYMENT',
      date: new Date(p.date_added || p.date_created),
      ref: p.purchase_id ? purchaseRefById.get(Number(p.purchase_id)) || formatPurchaseRef(p.purchase_id, p.date_added || p.date_created) : `Payment #${p.id}`,
      amount: 0,
      paid: Number(p.amount) || 0,
      returned: 0,
      balance: 0,
      status: 'Settled'
    });
  });

  // Add returns
  (vendorDetails.returns || []).forEach((r: any) => {
    transactions.push({
      type: 'VENDOR_RETURN',
      date: new Date(r.date_returned || r.date_created),
      ref: r.purchase_id ? purchaseRefById.get(Number(r.purchase_id)) || formatPurchaseRef(r.purchase_id, r.date_returned || r.date_created) : `Return #${r.id}`,
      amount: 0,
      paid: 0,
      returned: Number(r.total_returned) || 0,
      balance: 0,
      status: 'Returned'
    });
  });

  // Sort by date descending
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    vendor: {
      name: vendorDetails.vendor?.name || 'Unknown',
      phone: vendorDetails.vendor?.phone,
      email: vendorDetails.vendor?.email,
      address: vendorDetails.vendor?.address,
      balance: Number(vendorDetails.balance) || 0
    },
    transactions,
    summary: {
      totalTaken: Number(vendorDetails.total_taken) || 0,
      totalPaid: Number(vendorDetails.total_paid) || 0,
      totalReturned: Number(vendorDetails.total_returned) || 0,
      balance: Number(vendorDetails.balance) || 0
    }
  };
}

/**
 * Generate beautiful HTML for customer details PDF
 */
export function generateCustomerPDFHTML(data: {
  customer: any;
  transactions: TransactionRecord[];
  summary: any;
}): string {
  const { customer, transactions, summary } = data;
  const balance = Number(customer.balance) || 0;
  const balanceColor = balance > 0 ? '#dc2626' : '#059669';
  const balanceLabel = balance > 0 ? 'AMOUNT OWED (Qaraz)' : 'FULLY SETTLED';

  let transactionRows = '';
  transactions.forEach((tx, idx) => {
    const isAlt = idx % 2 === 0;
    const bgColor = isAlt ? '#f9fafb' : 'transparent';
    let txColor = '#1e40af';
    let typeLabel = '';
    let amountStr = '';

    if (tx.type === 'SALE') {
      txColor = '#1e40af';
      typeLabel = `Sale (${tx.status})`;
      amountStr = fmtPKR(tx.amount || 0);
    } else if (tx.type === 'PAYMENT') {
      txColor = '#059669';
      typeLabel = 'Payment';
      amountStr = `+ ${fmtPKR(tx.paid || 0)}`;
    } else if (tx.type === 'RETURN') {
      txColor = '#d97706';
      typeLabel = 'Return';
      amountStr = `+ ${fmtPKR(tx.returned || 0)}`;
    }

    transactionRows += `
      <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; font-size: 12px;">${fmtDate(tx.date)}</td>
        <td style="padding: 10px; font-size: 12px;">${tx.ref}</td>
        <td style="padding: 10px; font-size: 12px; color: ${txColor}; font-weight: 500;">${typeLabel}</td>
        <td style="padding: 10px; font-size: 12px; text-align: right;">${amountStr}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Customer Statement - ${customer.name}</title>
      <style>
        @page {
          size: 210mm 297mm;
          margin: 12mm;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f3f4f6;
          padding: 20px;
          color: #111827;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          background-color: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 28px;
          color: #1e40af;
          margin-bottom: 10px;
        }
        .header p {
          font-size: 14px;
          color: #6b7280;
          margin: 5px 0;
        }
        .customer-info {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 6px;
          margin-bottom: 30px;
          border-left: 4px solid #1e40af;
        }
        .customer-info h2 {
          font-size: 20px;
          margin-bottom: 10px;
          color: #111827;
        }
        .customer-info p {
          font-size: 13px;
          color: #4b5563;
          margin: 5px 0;
          line-height: 1.6;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }
        .card {
          padding: 20px;
          border-radius: 6px;
          text-align: center;
          border: 1px solid #e5e7eb;
        }
        .card.primary {
          background-color: #1e40af15;
          border-color: #1e40af;
        }
        .card.success {
          background-color: #05966915;
          border-color: #059669;
        }
        .card.warning {
          background-color: #d9770615;
          border-color: #d97706;
        }
        .card.danger {
          background-color: #dc262615;
          border-color: #dc2626;
        }
        .card-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .card-value {
          font-size: 22px;
          font-weight: bold;
        }
        .card.primary .card-value {
          color: #1e40af;
        }
        .card.success .card-value {
          color: #059669;
        }
        .card.warning .card-value {
          color: #d97706;
        }
        .card.danger .card-value {
          color: #dc2626;
        }
        .transactions {
          margin-bottom: 30px;
        }
        .transactions h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #111827;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        table thead {
          background-color: #1e40af;
          color: white;
        }
        table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table td {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.6;
        }
        @media print {
          body {
            background-color: white;
            padding: 0;
          }
          .container {
            box-shadow: none;
            max-width: 100%;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CUSTOMER ACCOUNT STATEMENT</h1>
          <p>Generated on ${fmtDateTime(new Date())}</p>
        </div>

        <div class="customer-info">
          <h2>${customer.name}</h2>
          ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
          ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ''}
          ${customer.address ? `<p><strong>Address:</strong> ${customer.address}</p>` : ''}
        </div>

        <div class="summary-cards">
          <div class="card primary">
            <div class="card-label">Total Billed</div>
            <div class="card-value">${fmtPKR(summary.totalTaken)}</div>
          </div>
          <div class="card success">
            <div class="card-label">Amount Paid</div>
            <div class="card-value">${fmtPKR(summary.totalPaid)}</div>
          </div>
          <div class="card warning">
            <div class="card-label">Items Returned</div>
            <div class="card-value">${fmtPKR(summary.totalReturned)}</div>
          </div>
          <div class="card ${balance > 0 ? 'danger' : 'success'}">
            <div class="card-label">${balanceLabel}</div>
            <div class="card-value">${fmtPKR(balance)}</div>
          </div>
        </div>

        <div class="transactions">
          <h3>TRANSACTION HISTORY</h3>
          ${transactions.length === 0 ? '<p style="text-align: center; color: #6b7280; padding: 20px;">No transactions found.</p>' : `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${transactionRows}
              </tbody>
            </table>
          `}
        </div>

        <div class="footer">
          <p>This is an auto-generated statement for customer <strong>${customer.name}</strong>.</p>
          <p>For inquiries, please contact us. Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate beautiful HTML for vendor details PDF
 */
export function generateVendorPDFHTML(data: {
  vendor: any;
  transactions: TransactionRecord[];
  summary: any;
}): string {
  const { vendor, transactions, summary } = data;
  const balance = Number(vendor.balance) || 0;
  const balanceColor = balance > 0 ? '#dc2626' : '#059669';
  const balanceLabel = balance > 0 ? 'AMOUNT PAYABLE' : 'FULLY SETTLED';

  let transactionRows = '';
  transactions.forEach((tx, idx) => {
    const isAlt = idx % 2 === 0;
    const bgColor = isAlt ? '#f9fafb' : 'transparent';
    let txColor = '#1e40af';
    let typeLabel = '';
    let amountStr = '';

    if (tx.type === 'PURCHASE') {
      txColor = '#1e40af';
      typeLabel = `Purchase (${tx.status})`;
      amountStr = fmtPKR(tx.amount || 0);
    } else if (tx.type === 'PAYMENT') {
      txColor = '#059669';
      typeLabel = 'Payment Sent';
      amountStr = `- ${fmtPKR(tx.paid || 0)}`;
    } else if (tx.type === 'VENDOR_RETURN') {
      txColor = '#d97706';
      typeLabel = 'Return';
      amountStr = `- ${fmtPKR(tx.returned || 0)}`;
    }

    transactionRows += `
      <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; font-size: 12px;">${fmtDate(tx.date)}</td>
        <td style="padding: 10px; font-size: 12px;">${tx.ref}</td>
        <td style="padding: 10px; font-size: 12px; color: ${txColor}; font-weight: 500;">${typeLabel}</td>
        <td style="padding: 10px; font-size: 12px; text-align: right;">${amountStr}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vendor Statement - ${vendor.name}</title>
      <style>
        @page {
          size: 210mm 297mm;
          margin: 12mm;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f3f4f6;
          padding: 20px;
          color: #111827;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          background-color: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 28px;
          color: #1e40af;
          margin-bottom: 10px;
        }
        .header p {
          font-size: 14px;
          color: #6b7280;
          margin: 5px 0;
        }
        .vendor-info {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 6px;
          margin-bottom: 30px;
          border-left: 4px solid #1e40af;
        }
        .vendor-info h2 {
          font-size: 20px;
          margin-bottom: 10px;
          color: #111827;
        }
        .vendor-info p {
          font-size: 13px;
          color: #4b5563;
          margin: 5px 0;
          line-height: 1.6;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }
        .card {
          padding: 20px;
          border-radius: 6px;
          text-align: center;
          border: 1px solid #e5e7eb;
        }
        .card.primary {
          background-color: #1e40af15;
          border-color: #1e40af;
        }
        .card.success {
          background-color: #05966915;
          border-color: #059669;
        }
        .card.warning {
          background-color: #d9770615;
          border-color: #d97706;
        }
        .card.danger {
          background-color: #dc262615;
          border-color: #dc2626;
        }
        .card-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .card-value {
          font-size: 22px;
          font-weight: bold;
        }
        .card.primary .card-value {
          color: #1e40af;
        }
        .card.success .card-value {
          color: #059669;
        }
        .card.warning .card-value {
          color: #d97706;
        }
        .card.danger .card-value {
          color: #dc2626;
        }
        .transactions {
          margin-bottom: 30px;
        }
        .transactions h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #111827;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        table thead {
          background-color: #1e40af;
          color: white;
        }
        table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table td {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.6;
        }
        @media print {
          body {
            background-color: white;
            padding: 0;
          }
          .container {
            box-shadow: none;
            max-width: 100%;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>VENDOR ACCOUNT STATEMENT</h1>
          <p>Generated on ${fmtDateTime(new Date())}</p>
        </div>

        <div class="vendor-info">
          <h2>${vendor.name}</h2>
          ${vendor.phone ? `<p><strong>Phone:</strong> ${vendor.phone}</p>` : ''}
          ${vendor.email ? `<p><strong>Email:</strong> ${vendor.email}</p>` : ''}
          ${vendor.address ? `<p><strong>Address:</strong> ${vendor.address}</p>` : ''}
        </div>

        <div class="summary-cards">
          <div class="card primary">
            <div class="card-label">Total Purchased</div>
            <div class="card-value">${fmtPKR(summary.totalTaken)}</div>
          </div>
          <div class="card success">
            <div class="card-label">Amount Paid</div>
            <div class="card-value">${fmtPKR(summary.totalPaid)}</div>
          </div>
          <div class="card warning">
            <div class="card-label">Items Returned</div>
            <div class="card-value">${fmtPKR(summary.totalReturned)}</div>
          </div>
          <div class="card ${balance > 0 ? 'danger' : 'success'}">
            <div class="card-label">${balanceLabel}</div>
            <div class="card-value">${fmtPKR(balance)}</div>
          </div>
        </div>

        <div class="transactions">
          <h3>TRANSACTION HISTORY</h3>
          ${transactions.length === 0 ? '<p style="text-align: center; color: #6b7280; padding: 20px;">No transactions found.</p>' : `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${transactionRows}
              </tbody>
            </table>
          `}
        </div>

        <div class="footer">
          <p>This is an auto-generated statement for vendor <strong>${vendor.name}</strong>.</p>
          <p>For inquiries, please contact us. Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export { fmtPKR, fmtDate, fmtDateTime };


import { BrowserWindow } from 'electron'
import { getInvoiceById } from './invoices'
import { getCompanyInfo } from './settings'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

let currentPrintWindow: BrowserWindow | null = null

export function printInvoice(_window: BrowserWindow, invoiceId: number): void {
  if (currentPrintWindow && !currentPrintWindow.isDestroyed()) {
    currentPrintWindow.close()
    currentPrintWindow = null
  }

  const filePath = generateInvoicePDF(invoiceId)

  const printWindow = new BrowserWindow({
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  currentPrintWindow = printWindow

  printWindow.on('closed', () => {
    if (currentPrintWindow === printWindow) {
      currentPrintWindow = null
    }
  })

  printWindow.loadFile(filePath)

  printWindow.webContents.once('did-finish-load', () => {
    printWindow.focus()

    const timeout = setTimeout(() => {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close()
      }
    }, 30000)

    setTimeout(() => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          deviceName: ''
        },
        (_success, error) => {
          clearTimeout(timeout)
          if (printWindow && !printWindow.isDestroyed()) {
            printWindow.close()
          }
          if (error) {
            console.error('Print error:', error)
          }
        }
      )
    }, 100)
  })

  printWindow.webContents.once('did-fail-load', () => {
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close()
    }
  })
}

export function generateInvoicePDF(invoiceId: number): string {
  const invoice = getInvoiceById(invoiceId)
  if (!invoice) {
    throw new Error('Invoice not found')
  }

  const company = getCompanyInfo()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_no}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 20px; 
      max-width: 350px; 
      margin: 0 auto;
      box-sizing: border-box;
    }
    * {
      box-sizing: border-box;
    }
    .header { margin-bottom: 20px; text-align: center; }
    .logo { max-width: 65px; max-height: 65px; object-fit: contain; margin: 0 auto 10px auto; display: block; }
    .company-name { font-size: 26px; font-weight: bold; margin: 0 0 8px 0; }
    .company-info { font-size: 12px; margin: 0; }
    .company-address { margin-bottom: 6px; }
    .company-mobile { margin-top: 6px; }
    .invoice-info { margin-bottom: 20px; }
    .invoice-info div { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000; }
    thead { background-color: #e8e8e8; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px dotted #000; word-wrap: break-word; }
    th:last-child, td:last-child { border-right: 1px solid #000; }
    th { background-color: #e8e8e8; font-weight: bold; }
    tbody tr:last-child td { border-bottom: none; }
    .total { font-size: 18px; font-weight: bold; text-align: left; margin-top: 20px; }
    .footer { margin-top: 15px; padding-top: 11px; border-top: 1px dotted #000; text-align: center; font-size: 12px; color: #000; font-weight: 600; font-style: italic; line-height: 1.3; }
    .footer a { color: #000; text-decoration: none; font-weight: 600; font-style: italic; }
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        padding: 5.5px;
        margin: 0;
        max-width: 100%;
        width: 100%;
      }
      .header { margin-bottom: 12px; }
      .logo { max-width: 65px; max-height: 65px; margin-bottom: 8px; }
      .company-name { font-size: 26px; margin-bottom: 6px; }
      .company-info { font-size: 11px; margin-bottom: 1px; }
      .company-address { margin-bottom: 4px; }
      .company-mobile { margin-top: 4px; }
      .invoice-info { margin-bottom: 15px; }
      .invoice-info div { margin: 4px 0; font-size: 12px; }
      table { margin-bottom: 15px; border: 1px solid #000; }
      thead { background-color: #e8e8e8; }
      th, td { padding: 6px 4px; font-size: 12px; border-bottom: 1px dotted #000; }
      th:last-child, td:last-child { border-right: 1px solid #000; }
      th { font-size: 11px; background-color: #e8e8e8; font-weight: bold; }
      tbody tr:last-child td { border-bottom: none; }
      .total { font-size: 16px; margin-top: 15px; text-align: left; }
      .footer { margin-top: 10px; padding-top: 11px; border-top: 1px dotted #000; text-align: center; font-size: 11px; color: #000; font-weight: 600; font-style: italic; line-height: 1.2; }
      .footer a { color: #000; text-decoration: none; font-weight: 600; font-style: italic; }
    }
  </style>
</head>
<body>
  <div class="header">
      ${company.logo_path ? `<img src="file://${company.logo_path}" class="logo" alt="Logo">` : ''}
        <div class="company-name">${company.name}</div>

        <div class="company-info">
      ${company.address ? `<div class="company-address">${company.address}</div>` : ''}
      ${company.mobile ? `<div class="company-mobile">Mobile: ${company.mobile}</div>` : ''}
    </div>
  </div>
  
  <div class="invoice-info">
    <div><strong>Invoice No:</strong> ${invoice.invoice_no}</div>
    <div><strong>Date:</strong> ${new Date(invoice.created_at * 1000).toLocaleString()}</div>
    <div><strong>Customer:</strong> ${invoice.customer_name}</div>
    ${
      invoice.customer_type === 'dine-in' &&
      invoice.table_number &&
      typeof invoice.table_number === 'string' &&
      invoice.table_number.trim() !== ''
        ? `<div><strong>Table Number:</strong> ${invoice.table_number}</div>`
        : ''
    }
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items
        .map(
          (item) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price.toFixed(2)}</td>
          <td>${item.subtotal.toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  
  ${
    (invoice.discount_type && invoice.discount_value > 0) || invoice.delivery_charges > 0
      ? (() => {
          const deliveryCharges = invoice.delivery_charges || 0
          const discountType = invoice.discount_type || null
          const discountValue = invoice.discount_value || 0

          let itemsSubtotal = invoice.total - deliveryCharges
          if (discountType && discountValue > 0) {
            itemsSubtotal =
              discountType === 'percentage'
                ? Math.round((itemsSubtotal / (1 - discountValue / 100)) * 100) / 100
                : itemsSubtotal + discountValue
          }

          const discountAmount =
            discountType === 'percentage' ? (itemsSubtotal * discountValue) / 100 : discountValue

          return `
  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dotted #000;">
    ${
      discountType && discountValue > 0
        ? `
   <!-- <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
         <span><strong>Subtotal:</strong></span>
         <span>Rs ${itemsSubtotal.toFixed(2)}</span>
       </div>
    -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
      <span><strong>Discount${discountType === 'percentage' ? ` (${discountValue}%)` : ''}:</strong></span>
      <span>-Rs ${discountAmount.toFixed(2)}</span>
    </div>
    `
        : ''
    }
    ${
      deliveryCharges > 0
        ? `
    <div style="display: flex; justify-content: space-between;">
      <span><strong>Delivery Charges:</strong></span>
      <span>Rs ${deliveryCharges.toFixed(2)}</span>
    </div>
    `
        : ''
    }
  </div>
  `
        })()
      : ''
  }
  
  <div class="total">Total: Rs ${invoice.total.toFixed(2)}</div>
  
  <div class="footer">
    Software by ShopFlow <a href="tel:03118114805">0311-8114805</a>
  </div>
</body>
</html>
  `

  const filePath = path.join(app.getPath('downloads'), `invoice_${invoice.invoice_no}.html`)
  fs.writeFileSync(filePath, html, 'utf-8')
  return filePath
}

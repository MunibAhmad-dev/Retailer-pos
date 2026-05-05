const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData/Roaming/retail-pos/pos.db');
const db = new Database(dbPath);

const vendorId = 1; // Change this to the problematic vendor ID if known

try {
    const purchases = db.prepare('SELECT * FROM purchases WHERE vendor_id = ?').all(vendorId);
    const payments = db.prepare('SELECT * FROM vendor_payments WHERE vendor_id = ?').all(vendorId);
    const returns = db.prepare(`
      SELECT pr.*, p.date_created as purchase_date
      FROM purchase_returns pr
      JOIN purchases p ON pr.purchase_id = p.id
      WHERE p.vendor_id = ?
    `).all(vendorId);

    console.log('Purchases:', JSON.stringify(purchases, null, 2));
    console.log('Payments:', JSON.stringify(payments, null, 2));
    console.log('Returns:', JSON.stringify(returns, null, 2));

    const enhancedPurchases = purchases.map((p) => {
      const linkedPayments = payments.filter((pay) => pay.purchase_id === p.id);
      const linkedReturns = returns.filter((ret) => ret.purchase_id === p.id);
      
      const amountPaid = linkedPayments.reduce((acc, pay) => acc + (pay.amount || 0), 0);
      const amountReturned = linkedReturns.reduce((acc, ret) => acc + (ret.total_returned || 0), 0);
      
      return {
        id: p.id,
        total: p.total,
        amountPaid,
        amountReturned,
        remaining: (p.total || 0) - amountPaid - amountReturned
      };
    });

    console.log('Enhanced Purchases:', JSON.stringify(enhancedPurchases, null, 2));
} catch (e) {
    console.error(e);
} finally {
    db.close();
}

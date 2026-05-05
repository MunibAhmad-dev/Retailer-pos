const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retail-pos', 'pos.db');
console.log('Opening database at:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchases').get();
  console.log('Total Purchases:', purchaseCount.count);
  
  const purchaseSum = db.prepare('SELECT SUM(total) as sum FROM purchases').get();
  console.log('Sum of Purchase Totals:', purchaseSum.sum);
  
  const purchaseStatuses = db.prepare('SELECT status, COUNT(*) as count FROM purchases GROUP BY status').all();
  console.log('Purchase Statuses:', purchaseStatuses);
  
  const vendorCount = db.prepare('SELECT COUNT(*) as count FROM vendors').get();
  console.log('Total Vendors:', vendorCount.count);
  
  const firstPurchases = db.prepare('SELECT * FROM purchases LIMIT 5').all();
  console.log('First 5 Purchases:', firstPurchases);

  const paymentSum = db.prepare('SELECT SUM(amount) as sum FROM vendor_payments').get();
  console.log('Total Payments:', paymentSum.sum);

  db.close();
} catch (err) {
  console.error('Error:', err.message);
}

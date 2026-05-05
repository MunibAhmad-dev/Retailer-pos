const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData/Roaming/retail-pos/pos.db');
const db = new Database(dbPath);

try {
    const userVersion = db.pragma('user_version', { simple: true });
    console.log('User Version:', userVersion);

    const vendorPaymentsSchema = db.prepare("PRAGMA table_info(vendor_payments)").all();
    console.log('vendor_payments Schema:', JSON.stringify(vendorPaymentsSchema, null, 2));

    const customerPaymentsSchema = db.prepare("PRAGMA table_info(customer_payments)").all();
    console.log('customer_payments Schema:', JSON.stringify(customerPaymentsSchema, null, 2));
} catch (e) {
    console.error(e);
} finally {
    db.close();
}

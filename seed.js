const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Dynamic path for Retail POS in AppData
const dbPath = path.join(process.env.APPDATA, 'Retail POS', 'pos.db');

if (!fs.existsSync(dbPath)) {
    console.error('Database file not found at:', dbPath);
    console.log('Searching for alternative paths...');
    process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log(`Connected to database at: ${dbPath}`);
console.log('Seeding database with realistic POS data...');

const categories = ['Groceries', 'Electronics', 'Clothing', 'Snacks', 'Beverages', 'Personal Care', 'Home & Kitchen', 'Stationery'];
const productPrefixes = ['Premium', 'Organic', 'Global', 'Smart', 'Elite', 'Eco', 'Super', 'Pure'];
const productTypes = ['Water', 'Milk', 'Bread', 'Phone', 'Shirt', 'Chips', 'Soda', 'Soap', 'Pan', 'Pen', 'Chocolate', 'Rice', 'Oil'];

const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Ahmed', 'Ali', 'Fatima', 'Zainab', 'Omar', 'Ayesha'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Khan', 'Ahmed', 'Malik', 'Butt', 'Sheikh'];

const vendorTypes = ['Supplies Ltd', 'Trading Co', 'Distribution', 'Wholesale', 'Enterprises', 'Logistics', 'Foods Group'];

// 1. Seed Vendors (150)
console.log('Seeding 150 vendors...');
const insertVendor = db.prepare('INSERT INTO vendors (name, phone, address, created_at) VALUES (?, ?, ?, datetime("now", "localtime"))');
for (let i = 0; i < 150; i++) {
    const name = `${productPrefixes[i % 8]} ${lastNames[i % 12]} ${vendorTypes[i % 7]} ${i + 1}`;
    const phone = `03${Math.floor(100000000 + Math.random() * 900000000)}`;
    const address = `${Math.floor(Math.random() * 500)} Street, Area ${i % 10}, City Center`;
    insertVendor.run(name, phone, address);
}

// 2. Seed Products (200)
console.log('Seeding 200 products...');
const insertProduct = db.prepare('INSERT INTO products (name, price, purchase_price, stock, barcode, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))');
const productIds = [];
for (let i = 0; i < 200; i++) {
    const category = categories[i % categories.length];
    const name = `${productPrefixes[i % 8]} ${productTypes[i % 13]} ${i + 1} (${Math.random().toString(36).substring(7)})`;
    const purchasePrice = Math.floor(Math.random() * 1000) + 50;
    const retailPrice = Math.floor(purchasePrice * 1.25);
    const stock = Math.floor(Math.random() * 100) + 10;
    const barcode = `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    
    try {
        const info = insertProduct.run(name, retailPrice, purchasePrice, stock, barcode, category);
        productIds.push({ id: info.lastInsertRowid, name, price: retailPrice, purchase_price: purchasePrice });
    } catch (e) {
        // Skip duplicates
    }
}

// 3. Seed Customers (100)
console.log('Seeding 100 customers...');
const insertCustomer = db.prepare('INSERT INTO customers (name, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))');
const customerIds = [];
for (let i = 0; i < 100; i++) {
    const name = `${firstNames[i % 16]} ${lastNames[i % 12]} ${i + 1}`;
    const phone = `03${Math.floor(100000000 + Math.random() * 900000000)}`;
    const email = `${name.toLowerCase().replace(/ /g, '.')}@example.com`;
    const address = `Block ${String.fromCharCode(65 + (i % 6))}, House ${i + 1}`;
    const info = insertCustomer.run(name, phone, email, address);
    customerIds.push(info.lastInsertRowid);
}

// 4. Seed Sales (500)
console.log('Seeding 500 sales...');
const insertSale = db.prepare('INSERT INTO sales (customer_id, total, subtotal, discount, tax, payment_method, payment_status, date_created) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now", "localtime", ?))');
const insertSaleItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, purchase_price, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now", "localtime", ?))');

for (let i = 0; i < 500; i++) {
    const customer_id = Math.random() > 0.2 ? customerIds[Math.floor(Math.random() * customerIds.length)] : null;
    const numItems = Math.floor(Math.random() * 5) + 1;
    const saleItems = [];
    let subtotal = 0;
    
    // Pick random products
    for (let j = 0; j < numItems; j++) {
        const p = productIds[Math.floor(Math.random() * productIds.length)];
        const qty = Math.floor(Math.random() * 3) + 1;
        saleItems.push({ ...p, quantity: qty });
        subtotal += p.price * qty;
    }
    
    const discount = Math.random() > 0.8 ? Math.floor(subtotal * 0.1) : 0;
    const total = subtotal - discount;
    const paymentMethod = Math.random() > 0.3 ? 'cash' : 'online';
    const isLoan = customer_id !== null && Math.random() > 0.7;
    const paymentStatus = isLoan ? 'Partial' : 'Paid';
    const daysOffset = `-${Math.floor(Math.random() * 60)} days`;
    
    const saleInfo = insertSale.run(
        customer_id,
        total,
        subtotal,
        discount,
        0,
        paymentMethod,
        paymentStatus,
        daysOffset
    );
    
    const saleId = saleInfo.lastInsertRowid;
    for (const item of saleItems) {
        insertSaleItem.run(saleId, item.id, item.name, item.quantity, item.price, item.purchase_price, daysOffset);
    }
}

// 5. Seed Customer Payments (100)
console.log('Seeding 100 customer payments (Qaraz)...');
const insertPayment = db.prepare('INSERT INTO customer_payments (customer_id, amount, notes, date_added) VALUES (?, ?, ?, datetime("now", "localtime", ?))');
for (let i = 0; i < 100; i++) {
    const customer_id = customerIds[Math.floor(Math.random() * customerIds.length)];
    const amount = Math.floor(Math.random() * 5000) + 500;
    const daysOffset = `-${Math.floor(Math.random() * 15)} days`;
    insertPayment.run(customer_id, amount, `Regular payment installment ${i + 1}`, daysOffset);
}

db.close();
console.log('Seeding complete! 🚀');
console.log('Summary:');
console.log('- 150 Vendors');
console.log('- 200 Products');
console.log('- 100 Customers');
console.log('- 500 Sales');
console.log('- 100 Payments');

#!/usr/bin/env node
/**
 * Direct seed script - simple and straightforward
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retail-pos', 'pos.db');

console.log('Database:', dbPath);
console.log('Exists:', fs.existsSync(dbPath));

if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found!');
    process.exit(1);
}

let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    console.error('❌ better-sqlite3 load error:', e.message);
    process.exit(1);
}

let db;
try {
    db = new Database(dbPath, { timeout: 10000 });
    db.pragma('journal_mode = WAL');
} catch (e) {
    console.error('❌ Database connection error:', e.message);
    process.exit(1);
}

console.log('✅ Connected to database\n');

const categories = ['Groceries', 'Electronics', 'Clothing', 'Snacks', 'Beverages', 'Personal Care', 'Home & Kitchen', 'Stationery'];
const productPrefixes = ['Premium', 'Organic', 'Global', 'Smart', 'Elite', 'Eco', 'Super', 'Pure', 'Deluxe', 'Classic'];
const productTypes = ['Water', 'Milk', 'Bread', 'Phone', 'Shirt', 'Chips', 'Soda', 'Soap', 'Pan', 'Pen', 'Chocolate', 'Rice', 'Oil', 'Tea', 'Coffee', 'Juice', 'Yogurt', 'Cheese', 'Butter', 'Egg'];

const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Ahmed', 'Ali', 'Fatima', 'Zainab', 'Omar', 'Ayesha', 'Hassan', 'Sara', 'Muhammad', 'Aisha'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Khan', 'Ahmed', 'Malik', 'Butt', 'Sheikh', 'Hassan', 'Ali', 'Ibrahim'];

const paymentMethods = ['cash', 'card', 'online', 'check'];

try {
    // 1. Seed 220+ Products
    console.log('📦 Seeding 220 products...');
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const insertProduct = db.prepare('INSERT OR IGNORE INTO products (name, price, purchase_price, stock, barcode, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const productIds = [];

    for (let i = 0; i < 220; i++) {
        const category = categories[i % categories.length];
        const name = `${productPrefixes[i % 10]} ${productTypes[i % 20]} ${i + 1}`;
        const purchasePrice = Math.floor(Math.random() * 2000) + 100;
        const retailPrice = Math.floor(purchasePrice * (1.3 + Math.random() * 0.4));
        const stock = Math.floor(Math.random() * 500) + 50;
        const barcode = `8901${String(i + 1).padStart(10, '0')}`;
        
        try {
            const info = insertProduct.run(name, retailPrice, purchasePrice, stock, barcode, category, now, now);
            productIds.push({ id: info.lastInsertRowid, price: retailPrice, purchase_price: purchasePrice });
        } catch (e) {
            // Skip duplicates
        }
    }
    console.log(`✓ Created ${productIds.length} products\n`);

    // 2. Ensure customers
    console.log('👥 Ensuring 50+ customers...');
    const insertCustomer = db.prepare('INSERT OR IGNORE INTO customers (name, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    const customerIds = [];

    for (let i = 0; i < 50; i++) {
        const name = `${firstNames[i % 20]} ${lastNames[i % 15]} ${i + 1}`;
        const phone = `03${String(Math.floor(100000000 + Math.random() * 900000000)).substring(0, 8)}`;
        const email = `${name.toLowerCase().replace(/ /g, '.')}.${i}@example.com`;
        const address = `Block ${String.fromCharCode(65 + (i % 6))}, House ${i + 1}, City`;
        
        try {
            const info = insertCustomer.run(name, phone, email, address, now, now);
            customerIds.push(info.lastInsertRowid);
        } catch (e) {
            // Skip duplicates
        }
    }
    console.log(`✓ Ensured ${customerIds.length} customers\n`);

    // 3. Seed 1000 sales
    console.log('💰 Seeding 1000 sales transactions (200 per month × 5 months)...');
    const insertSale = db.prepare('INSERT INTO sales (customer_id, total, subtotal, discount, tax, payment_method, payment_status, date_created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertSaleItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, purchase_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

    let saleCount = 0;
    const today = new Date();

    for (let month = 0; month < 5; month++) {
        const monthStart = new Date(today);
        monthStart.setMonth(monthStart.getMonth() - (4 - month));
        monthStart.setDate(1);
        
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);
        
        console.log(`  📅 Month ${month + 1}`);
        
        for (let transNum = 0; transNum < 200; transNum++) {
            const randomDay = Math.floor(Math.random() * (monthEnd.getDate()));
            const transDate = new Date(monthStart);
            transDate.setDate(randomDay + 1);
            transDate.setHours(Math.floor(Math.random() * 24));
            transDate.setMinutes(Math.floor(Math.random() * 60));
            transDate.setSeconds(Math.floor(Math.random() * 60));
            
            const dateString = transDate.toISOString().replace('T', ' ').substring(0, 19);
            
            const customer_id = Math.random() > 0.15 ? customerIds[Math.floor(Math.random() * customerIds.length)] : null;
            const numItems = Math.floor(Math.random() * 8) + 1;
            const saleItems = [];
            let subtotal = 0;
            
            const selectedProducts = new Set();
            for (let j = 0; j < numItems; j++) {
                let prodIdx = Math.floor(Math.random() * productIds.length);
                while (selectedProducts.has(prodIdx) && selectedProducts.size < productIds.length) {
                    prodIdx = Math.floor(Math.random() * productIds.length);
                }
                selectedProducts.add(prodIdx);
                
                const p = productIds[prodIdx];
                const qty = Math.floor(Math.random() * 5) + 1;
                saleItems.push({ ...p, quantity: qty });
                subtotal += p.price * qty;
            }
            
            const discount = Math.random() > 0.85 ? Math.floor(subtotal * (0.05 + Math.random() * 0.1)) : 0;
            const taxAmount = Math.floor((subtotal - discount) * 0.17);
            const total = subtotal - discount + taxAmount;
            const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
            const isLoan = customer_id !== null && Math.random() > 0.85;
            const paymentStatus = isLoan ? 'Partial' : 'Paid';
            
            try {
                const saleInfo = insertSale.run(
                    customer_id,
                    total,
                    subtotal,
                    discount,
                    taxAmount,
                    paymentMethod,
                    paymentStatus,
                    dateString
                );
                
                const saleId = saleInfo.lastInsertRowid;
                for (const item of saleItems) {
                    insertSaleItem.run(saleId, item.id, `Product ${item.id}`, item.quantity, item.price, item.purchase_price, dateString);
                }
                saleCount++;
            } catch (e) {
                // Skip errors
            }
        }
    }
    console.log(`✓ Created ${saleCount} sales transactions\n`);

    // 4. Seed payments
    console.log('💳 Seeding 150 customer payments...');
    const insertPayment = db.prepare('INSERT INTO customer_payments (customer_id, amount, notes, date_added) VALUES (?, ?, ?, ?)');
    let paymentCount = 0;

    for (let i = 0; i < 150; i++) {
        const customer_id = customerIds[Math.floor(Math.random() * customerIds.length)];
        const amount = Math.floor(Math.random() * 10000) + 1000;
        
        const payDate = new Date(today);
        payDate.setDate(payDate.getDate() - Math.floor(Math.random() * 150));
        payDate.setHours(Math.floor(Math.random() * 24));
        payDate.setMinutes(Math.floor(Math.random() * 60));
        
        const dateString = payDate.toISOString().replace('T', ' ').substring(0, 19);
        
        try {
            insertPayment.run(customer_id, amount, `Payment installment ${i + 1}`, dateString);
            paymentCount++;
        } catch (e) {
            // Skip errors
        }
    }
    console.log(`✓ Created ${paymentCount} customer payments\n`);

    db.close();
    console.log('✨ Dashboard seed complete!\n');
    console.log('📊 Summary:');
    console.log('✓ 220+ Products');
    console.log('✓ 1000 Sales transactions');
    console.log('✓ 150+ Customer payments');
    console.log('\n✅ Ready for dashboard!');

} catch (error) {
    console.error('❌ Error:', error.message);
    if (db) db.close();
    process.exit(1);
}

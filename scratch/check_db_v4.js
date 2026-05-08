
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retailer-pos', 'db.sqlite');
console.log('Opening DB at:', dbPath);

try {
  const db = new Database(dbPath);
  
  const products = db.prepare('SELECT id, name, stock, purchase_price, price FROM products LIMIT 5').all();
  console.log('Sample Products:', JSON.stringify(products, null, 2));
  
  const stockVal = db.prepare('SELECT SUM(stock * purchase_price) as val FROM products').get();
  console.log('Calculated Stock Value:', stockVal);

  const rawSum = db.prepare('SELECT SUM(CAST(stock AS REAL) * CAST(purchase_price AS REAL)) as val FROM products').get();
  console.log('Calculated Raw Sum (with CAST):', rawSum);

  db.close();
} catch (err) {
  console.error('Error:', err);
}

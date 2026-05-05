const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Assuming standard Windows path for Electron userData
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Retailer-pos', 'pos.db');
console.log('Checking database at:', dbPath);

try {
  const db = new Database(dbPath);
  const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger'").all();
  console.log('Triggers found:', JSON.stringify(triggers, null, 2));
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables found:', JSON.stringify(tables, null, 2));
  
  const productsCols = db.prepare("PRAGMA table_info(products)").all();
  console.log('Products columns:', JSON.stringify(productsCols, null, 2));
  
} catch (e) {
  console.error('Error checking database:', e);
}

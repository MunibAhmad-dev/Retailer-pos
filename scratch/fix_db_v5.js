
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retailer-pos', 'pos.db');
console.log('Opening DB at:', dbPath);

try {
  const db = new Database(dbPath);
  
  // 1. Check sale_return_items columns
  const columns = db.prepare("PRAGMA table_info(sale_return_items)").all();
  console.log('Columns in sale_return_items:', columns.map(c => c.name).join(', '));
  
  const hasCol = columns.some(c => c.name === 'sale_item_id');
  if (!hasCol) {
    console.log('Adding missing column sale_item_id...');
    db.prepare("ALTER TABLE sale_return_items ADD COLUMN sale_item_id INTEGER").run();
    console.log('Column added successfully.');
  } else {
    console.log('Column sale_item_id already exists.');
  }

  // 2. Check for zombie tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('All tables:', tables.map(t => t.name).join(', '));

  db.close();
} catch (err) {
  console.error('Error during diagnostic:', err);
}

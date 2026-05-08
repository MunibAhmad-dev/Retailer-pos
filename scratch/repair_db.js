
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retailer-pos', 'pos.db');
console.log('Attempting to repair DB at:', dbPath);

try {
  const db = new Database(dbPath);
  
  console.log('Running Integrity Check...');
  const integrity = db.prepare("PRAGMA integrity_check").get();
  console.log('Integrity Result:', integrity);

  console.log('Running Foreign Key Check...');
  const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
  console.log('FK Check Result:', fkCheck);

  console.log('Cleaning up ghost tables (VACUUM)...');
  db.exec("VACUUM");
  
  console.log('Rebuilding indexes (REINDEX)...');
  db.exec("REINDEX");

  // Force add the column if missing, using a more robust check
  const columns = db.prepare("PRAGMA table_info(sale_return_items)").all();
  if (!columns.some(c => c.name === 'sale_item_id')) {
    console.log('Forcing addition of sale_item_id...');
    db.exec("ALTER TABLE sale_return_items ADD COLUMN sale_item_id INTEGER");
    console.log('Success!');
  } else {
    console.log('Column already exists.');
  }

  db.close();
  console.log('Repair completed successfully.');
} catch (err) {
  console.error('CRITICAL ERROR DURING REPAIR:', err);
}

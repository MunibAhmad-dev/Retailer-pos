
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retailer-pos', 'pos.db');
console.log('Checking for triggers at:', dbPath);

try {
  const db = new Database(dbPath);
  
  const triggers = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'").all();
  console.log('Found triggers:', JSON.stringify(triggers, null, 2));

  const indices = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index'").all();
  console.log('Found indices:', JSON.stringify(indices, null, 2));

  db.close();
} catch (err) {
  console.error('Error during diagnostic:', err);
}

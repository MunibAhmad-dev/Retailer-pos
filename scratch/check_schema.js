const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Path to the DB
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retail-pos', 'pos.db');
const db = new Database(dbPath);

console.log('--- CUSTOMERS TABLE ---');
const cols = db.prepare('PRAGMA table_info(customers)').all();
console.log(cols.map(c => `${c.name} (${c.type})`).join(', '));

console.log('\n--- VENDORS TABLE ---');
const vcols = db.prepare('PRAGMA table_info(vendors)').all();
console.log(vcols.map(c => `${c.name} (${c.type})`).join(', '));

db.close();

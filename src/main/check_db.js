const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'retail-pos', 'pos.db');
console.log('DB Path:', dbPath);
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (const table of tables) {
    console.log(`\nTable: ${table.name}`);
    const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
    console.log(columns.map(c => `${c.name} ${c.type}`).join(', '));
}

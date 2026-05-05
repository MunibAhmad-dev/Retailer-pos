const Database = require('better-sqlite3');
const db = new Database('C:/Users/Munib Ahmad/AppData/Roaming/retail-pos/pos.db');
const tables = ['sales', 'purchases', 'sale_returns', 'purchase_returns', 'sale_return_items', 'expenses'];
for (const table of tables) {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    console.log(`Table: ${table}`, info.map(i => i.name));
  } catch (e) {
    console.log(`Table: ${table} NOT FOUND`);
  }
}

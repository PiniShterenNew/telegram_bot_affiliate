const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sent_deals (
    item_id TEXT PRIMARY KEY,
    title TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// פונקציה בודקת האם פריט כבר נשלח
// מוחזר false תמיד כדי שכל המוצרים יישלחו בכל פעם
function isDealSent(itemId) {
  // תמיד מחזיר false - כלומר המוצר לא נשלח בעבר
  return Promise.resolve(false);
  
  // הקוד המקורי למטה מוערפל - אפשר להחזיר לשימוש אם רוצים לחזור לבדיקה מול מסד הנתונים
  /*
  return new Promise((resolve, reject) => {
    db.get('SELECT item_id FROM sent_deals WHERE item_id = ?', [itemId], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
  */
}

function markDealAsSent(itemId, title) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO sent_deals (item_id, title) VALUES (?, ?)', [itemId, title], err => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

module.exports = { isDealSent, markDealAsSent };

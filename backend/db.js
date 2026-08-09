const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS months (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    UNIQUE(name, year)
  );

  CREATE TABLE IF NOT EXISTS contributions (
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'na', -- 'paid' | 'pending' | 'na' | 'extra'
    amount INTEGER,
    PRIMARY KEY (member_id, month_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

module.exports = db;

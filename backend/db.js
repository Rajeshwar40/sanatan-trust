const path = require('path');
const { createClient } = require('@libsql/client');

// Defaults to a local file (no account needed) for local dev.
// Set DATABASE_URL (+ DATABASE_AUTH_TOKEN) to a Turso database in production
// so data survives Render's ephemeral disk / free-tier restarts.
const url = process.env.DATABASE_URL || `file:${path.join(__dirname, 'data.sqlite')}`;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const db = createClient(authToken ? { url, authToken } : { url });

const SCHEMA = `
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

  CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL
  );
`;

async function initSchema() {
  await db.execute('PRAGMA foreign_keys = ON');
  await db.executeMultiple(SCHEMA);
}

module.exports = { db, initSchema };

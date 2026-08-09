require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const db = require('./db');
require('./seed'); // no-op if already seeded
const { signToken, requireAdmin, isAdminRequest } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5500';
const isProd = process.env.NODE_ENV === 'production';

if (isProd) app.set('trust proxy', 1); // behind Render's proxy: use X-Forwarded-For for req.ip

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.static(path.join(__dirname, '..')));

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}
function touchLastUpdated() {
  setSetting('last_updated', new Date().toISOString());
}

// ---- simple in-memory login rate limit (per IP) ----
const loginAttempts = new Map(); // ip -> { count, resetAt }
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 10;
}

// ============================================================
// AUTH
// ============================================================
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  const { username, password } = req.body || {};
  const adminUser = getSetting('admin_user');
  const adminHash = getSetting('admin_pass_hash');
  if (!username || !password || username !== adminUser || !bcrypt.compareSync(password, adminHash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  const token = signToken();
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ isAdmin: isAdminRequest(req) });
});

app.post('/api/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const adminHash = getSetting('admin_pass_hash');
  if (!currentPassword || !bcrypt.compareSync(currentPassword, adminHash)) {
    return res.status(400).json({ error: 'Current password incorrect.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  setSetting('admin_pass_hash', bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
});

// ============================================================
// READ DATA (public)
// ============================================================
app.get('/api/data', (req, res) => {
  const members = db.prepare('SELECT id, name FROM members ORDER BY sort_order').all();
  const months = db.prepare('SELECT id, name, year FROM months ORDER BY year, sort_order').all();
  const rows = db.prepare(`
    SELECT c.member_id, c.month_id, c.status, c.amount
    FROM contributions c
  `).all();

  // contributions keyed by member id -> month id (both as strings, since JSON object keys are strings)
  const contributions = {};
  members.forEach(m => { contributions[m.id] = {}; });
  rows.forEach(r => {
    if (!contributions[r.member_id]) return;
    if (r.status === 'paid' || r.status === 'extra') {
      contributions[r.member_id][r.month_id] = r.amount;
    } else {
      contributions[r.member_id][r.month_id] = r.status; // 'pending' | 'na'
    }
  });

  res.json({
    members,
    months,
    contributions,
    lastUpdated: getSetting('last_updated'),
    isAdmin: isAdminRequest(req),
  });
});

// ============================================================
// MEMBERS (admin)
// ============================================================
app.post('/api/members', requireAdmin, (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const exists = db.prepare('SELECT 1 FROM members WHERE name = ?').get(name);
  if (exists) return res.status(409).json({ error: 'Member already exists.' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) o FROM members').get().o;
  const info = db.prepare('INSERT INTO members (name, sort_order) VALUES (?, ?)').run(name, maxOrder + 1);
  const months = db.prepare('SELECT id FROM months').all();
  const insertContrib = db.prepare('INSERT INTO contributions (member_id, month_id, status, amount) VALUES (?, ?, ?, NULL)');
  months.forEach(mo => insertContrib.run(info.lastInsertRowid, mo.id, 'pending'));

  touchLastUpdated();
  res.json({ ok: true });
});

app.delete('/api/members/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
  touchLastUpdated();
  res.json({ ok: true });
});

// ============================================================
// MONTHS (admin)
// ============================================================
app.post('/api/months', requireAdmin, (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  const year = parseInt(req.body && req.body.year, 10);
  if (!name) return res.status(400).json({ error: 'Month name is required.' });
  if (!year || year < 2000 || year > 2100) return res.status(400).json({ error: 'A valid year is required.' });
  const exists = db.prepare('SELECT 1 FROM months WHERE name = ? AND year = ?').get(name, year);
  if (exists) return res.status(409).json({ error: 'That month already exists for that year.' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) o FROM months').get().o;
  const info = db.prepare('INSERT INTO months (name, year, sort_order) VALUES (?, ?, ?)').run(name, year, maxOrder + 1);
  const members = db.prepare('SELECT id FROM members').all();
  const insertContrib = db.prepare('INSERT INTO contributions (member_id, month_id, status, amount) VALUES (?, ?, ?, NULL)');
  members.forEach(m => insertContrib.run(m.id, info.lastInsertRowid, 'pending'));

  touchLastUpdated();
  res.json({ ok: true });
});

app.delete('/api/months/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM months WHERE id = ?').run(id);
  touchLastUpdated();
  res.json({ ok: true });
});

// ============================================================
// CONTRIBUTIONS (admin)
// ============================================================
app.put('/api/contributions', requireAdmin, (req, res) => {
  const { memberId, monthId, status, amount } = req.body || {};
  const mId = parseInt(memberId, 10);
  const moId = parseInt(monthId, 10);
  const member = db.prepare('SELECT id FROM members WHERE id = ?').get(mId);
  const month = db.prepare('SELECT id FROM months WHERE id = ?').get(moId);
  if (!member || !month) return res.status(404).json({ error: 'Unknown member or month.' });
  if (!['paid', 'pending', 'na', 'extra'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const finalAmount = status === 'paid' ? 500 : status === 'extra' ? (parseInt(amount, 10) || 500) : null;
  db.prepare(`
    INSERT INTO contributions (member_id, month_id, status, amount)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(member_id, month_id) DO UPDATE SET status = excluded.status, amount = excluded.amount
  `).run(mId, moId, status, finalAmount);
  touchLastUpdated();
  res.json({ ok: true });
});

app.post('/api/contributions/bulk', requireAdmin, (req, res) => {
  const { monthId, status } = req.body || {};
  const moId = parseInt(monthId, 10);
  const month = db.prepare('SELECT id FROM months WHERE id = ?').get(moId);
  if (!month) return res.status(404).json({ error: 'Unknown month.' });
  if (!['paid', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const amount = status === 'paid' ? 500 : null;
  const members = db.prepare('SELECT id FROM members').all();
  const upsert = db.prepare(`
    INSERT INTO contributions (member_id, month_id, status, amount)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(member_id, month_id) DO UPDATE SET status = excluded.status, amount = excluded.amount
  `);
  const tx = db.transaction(() => {
    members.forEach(m => upsert.run(m.id, moId, status, amount));
  });
  tx();
  touchLastUpdated();
  res.json({ ok: true });
});

// Bulk entry: set a (possibly different) status/amount per member for one month in a single save.
// Works for any month, past or future — lets an admin fill in a whole month's contributions at once.
app.put('/api/contributions/batch', requireAdmin, (req, res) => {
  const { monthId, entries } = req.body || {};
  const moId = parseInt(monthId, 10);
  const month = db.prepare('SELECT id FROM months WHERE id = ?').get(moId);
  if (!month) return res.status(404).json({ error: 'Unknown month.' });
  if (!Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ error: 'entries must be a non-empty array.' });
  }

  const memberIds = new Set(db.prepare('SELECT id FROM members').all().map(m => m.id));
  const upsert = db.prepare(`
    INSERT INTO contributions (member_id, month_id, status, amount)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(member_id, month_id) DO UPDATE SET status = excluded.status, amount = excluded.amount
  `);

  const tx = db.transaction(() => {
    entries.forEach(e => {
      const mId = parseInt(e.memberId, 10);
      if (!memberIds.has(mId) || !['paid', 'pending', 'na', 'extra'].includes(e.status)) return;
      const amount = e.status === 'paid' ? 500 : e.status === 'extra' ? (parseInt(e.amount, 10) || 500) : null;
      upsert.run(mId, moId, e.status, amount);
    });
  });
  tx();
  touchLastUpdated();
  res.json({ ok: true });
});

// ============================================================
// DANGER ZONE
// ============================================================
app.post('/api/reset', requireAdmin, (req, res) => {
  db.exec('DELETE FROM contributions; DELETE FROM members; DELETE FROM months;');
  delete require.cache[require.resolve('./seed')];
  require('./seed');
  touchLastUpdated();
  res.json({ ok: true });
});

// ============================================================
// CONTACT FORM
// ============================================================
app.post('/api/contact', (req, res) => {
  const { name, phone, message } = req.body || {};
  if (!name || !/^\d{10}$/.test(String(phone || '').trim())) {
    return res.status(400).json({ error: 'Valid name and 10-digit phone are required.' });
  }
  db.prepare(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL
    )
  `).run();
  db.prepare('INSERT INTO contact_submissions (name, phone, message, created_at) VALUES (?, ?, ?, ?)')
    .run(name.trim(), phone.trim(), (message || '').trim(), new Date().toISOString());
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Sanatan Trust API listening on http://localhost:${PORT}`);
});

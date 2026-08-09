require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const { db, initSchema } = require('./db');
const seed = require('./seed');
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

async function getSetting(key) {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return result.rows[0] ? result.rows[0].value : null;
}
async function setSetting(key, value) {
  await db.execute({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', args: [key, value] });
}
async function touchLastUpdated() {
  await setSetting('last_updated', new Date().toISOString());
}

// Wraps an async route handler so rejected promises reach Express's error handler.
function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
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
app.post('/api/login', asyncRoute(async (req, res) => {
  const ip = req.ip;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  const { username, password } = req.body || {};
  const adminUser = await getSetting('admin_user');
  const adminHash = await getSetting('admin_pass_hash');
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
}));

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ isAdmin: isAdminRequest(req) });
});

app.post('/api/change-password', requireAdmin, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const adminHash = await getSetting('admin_pass_hash');
  if (!currentPassword || !bcrypt.compareSync(currentPassword, adminHash)) {
    return res.status(400).json({ error: 'Current password incorrect.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  await setSetting('admin_pass_hash', bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
}));

// ============================================================
// READ DATA (public)
// ============================================================
app.get('/api/data', asyncRoute(async (req, res) => {
  const members = (await db.execute('SELECT id, name FROM members ORDER BY sort_order')).rows;
  const months = (await db.execute('SELECT id, name, year FROM months ORDER BY year, sort_order')).rows;
  const rows = (await db.execute('SELECT member_id, month_id, status, amount FROM contributions')).rows;

  // contributions keyed by member id -> month id (both as strings, since JSON object keys are strings)
  const contributions = {};
  members.forEach(m => { contributions[m.id] = {}; });
  rows.forEach(r => {
    if (!contributions[r.member_id]) return;
    if (r.status === 'paid' || r.status === 'extra') {
      contributions[r.member_id][r.month_id] = Number(r.amount);
    } else {
      contributions[r.member_id][r.month_id] = r.status; // 'pending' | 'na'
    }
  });

  res.json({
    members,
    months,
    contributions,
    lastUpdated: await getSetting('last_updated'),
    isAdmin: isAdminRequest(req),
  });
}));

// ============================================================
// MEMBERS (admin)
// ============================================================
app.post('/api/members', requireAdmin, asyncRoute(async (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const exists = (await db.execute({ sql: 'SELECT 1 FROM members WHERE name = ?', args: [name] })).rows[0];
  if (exists) return res.status(409).json({ error: 'Member already exists.' });

  const maxOrder = (await db.execute('SELECT COALESCE(MAX(sort_order), -1) o FROM members')).rows[0].o;
  const info = await db.execute({ sql: 'INSERT INTO members (name, sort_order) VALUES (?, ?)', args: [name, Number(maxOrder) + 1] });
  const memberId = Number(info.lastInsertRowid);
  const months = (await db.execute('SELECT id FROM months')).rows;
  for (const mo of months) {
    await db.execute({
      sql: 'INSERT INTO contributions (member_id, month_id, status, amount) VALUES (?, ?, ?, NULL)',
      args: [memberId, mo.id, 'pending'],
    });
  }

  await touchLastUpdated();
  res.json({ ok: true });
}));

app.delete('/api/members/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [id] });
  await touchLastUpdated();
  res.json({ ok: true });
}));

// ============================================================
// MONTHS (admin)
// ============================================================
app.post('/api/months', requireAdmin, asyncRoute(async (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  const year = parseInt(req.body && req.body.year, 10);
  if (!name) return res.status(400).json({ error: 'Month name is required.' });
  if (!year || year < 2000 || year > 2100) return res.status(400).json({ error: 'A valid year is required.' });
  const exists = (await db.execute({ sql: 'SELECT 1 FROM months WHERE name = ? AND year = ?', args: [name, year] })).rows[0];
  if (exists) return res.status(409).json({ error: 'That month already exists for that year.' });

  const maxOrder = (await db.execute('SELECT COALESCE(MAX(sort_order), -1) o FROM months')).rows[0].o;
  const info = await db.execute({ sql: 'INSERT INTO months (name, year, sort_order) VALUES (?, ?, ?)', args: [name, year, Number(maxOrder) + 1] });
  const monthId = Number(info.lastInsertRowid);
  const members = (await db.execute('SELECT id FROM members')).rows;
  for (const m of members) {
    await db.execute({
      sql: 'INSERT INTO contributions (member_id, month_id, status, amount) VALUES (?, ?, ?, NULL)',
      args: [m.id, monthId, 'pending'],
    });
  }

  await touchLastUpdated();
  res.json({ ok: true });
}));

app.delete('/api/months/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.execute({ sql: 'DELETE FROM months WHERE id = ?', args: [id] });
  await touchLastUpdated();
  res.json({ ok: true });
}));

// ============================================================
// CONTRIBUTIONS (admin)
// ============================================================
app.put('/api/contributions', requireAdmin, asyncRoute(async (req, res) => {
  const { memberId, monthId, status, amount } = req.body || {};
  const mId = parseInt(memberId, 10);
  const moId = parseInt(monthId, 10);
  const member = (await db.execute({ sql: 'SELECT id FROM members WHERE id = ?', args: [mId] })).rows[0];
  const month = (await db.execute({ sql: 'SELECT id FROM months WHERE id = ?', args: [moId] })).rows[0];
  if (!member || !month) return res.status(404).json({ error: 'Unknown member or month.' });
  if (!['paid', 'pending', 'na', 'extra'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const finalAmount = status === 'paid' ? 500 : status === 'extra' ? (parseInt(amount, 10) || 500) : null;
  await db.execute({
    sql: `INSERT INTO contributions (member_id, month_id, status, amount)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(member_id, month_id) DO UPDATE SET status = excluded.status, amount = excluded.amount`,
    args: [mId, moId, status, finalAmount],
  });
  await touchLastUpdated();
  res.json({ ok: true });
}));

app.post('/api/contributions/bulk', requireAdmin, asyncRoute(async (req, res) => {
  const { monthId, status } = req.body || {};
  const moId = parseInt(monthId, 10);
  const month = (await db.execute({ sql: 'SELECT id FROM months WHERE id = ?', args: [moId] })).rows[0];
  if (!month) return res.status(404).json({ error: 'Unknown month.' });
  if (!['paid', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const amount = status === 'paid' ? 500 : null;
  const members = (await db.execute('SELECT id FROM members')).rows;

  const tx = await db.transaction('write');
  try {
    for (const m of members) {
      await tx.execute({
        sql: `INSERT INTO contributions (member_id, month_id, status, amount)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(member_id, month_id) DO UPDATE SET status = excluded.status, amount = excluded.amount`,
        args: [m.id, moId, status, amount],
      });
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  await touchLastUpdated();
  res.json({ ok: true });
}));

// Bulk entry: set a (possibly different) status/amount per member for one month in a single save.
// Works for any month, past or future — lets an admin fill in a whole month's contributions at once.
app.put('/api/contributions/batch', requireAdmin, asyncRoute(async (req, res) => {
  const { monthId, entries } = req.body || {};
  const moId = parseInt(monthId, 10);
  const month = (await db.execute({ sql: 'SELECT id FROM months WHERE id = ?', args: [moId] })).rows[0];
  if (!month) return res.status(404).json({ error: 'Unknown month.' });
  if (!Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ error: 'entries must be a non-empty array.' });
  }

  const memberIds = new Set((await db.execute('SELECT id FROM members')).rows.map(m => Number(m.id)));

  const tx = await db.transaction('write');
  try {
    for (const e of entries) {
      const mId = parseInt(e.memberId, 10);
      if (!memberIds.has(mId) || !['paid', 'pending', 'na', 'extra'].includes(e.status)) continue;
      const amount = e.status === 'paid' ? 500 : e.status === 'extra' ? (parseInt(e.amount, 10) || 500) : null;
      await tx.execute({
        sql: `INSERT INTO contributions (member_id, month_id, status, amount)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(member_id, month_id) DO UPDATE SET status = excluded.status, amount = excluded.amount`,
        args: [mId, moId, e.status, amount],
      });
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  await touchLastUpdated();
  res.json({ ok: true });
}));

// ============================================================
// DANGER ZONE
// ============================================================
app.post('/api/reset', requireAdmin, asyncRoute(async (req, res) => {
  await db.executeMultiple('DELETE FROM contributions; DELETE FROM members; DELETE FROM months;');
  await seed();
  await touchLastUpdated();
  res.json({ ok: true });
}));

// ============================================================
// CONTACT FORM
// ============================================================
app.post('/api/contact', asyncRoute(async (req, res) => {
  const { name, phone, message } = req.body || {};
  if (!name || !/^\d{10}$/.test(String(phone || '').trim())) {
    return res.status(400).json({ error: 'Valid name and 10-digit phone are required.' });
  }
  await db.execute({
    sql: 'INSERT INTO contact_submissions (name, phone, message, created_at) VALUES (?, ?, ?, ?)',
    args: [name.trim(), phone.trim(), (message || '').trim(), new Date().toISOString()],
  });
  res.json({ ok: true });
}));

async function main() {
  await initSchema();
  await seed(); // no-op if already seeded
  app.listen(PORT, () => {
    console.log(`Sanatan Trust API listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

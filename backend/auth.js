const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a real secret.');
}

function signToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('bad role');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function isAdminRequest(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return false;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.role === 'admin';
  } catch (e) {
    return false;
  }
}

module.exports = { signToken, requireAdmin, isAdminRequest };

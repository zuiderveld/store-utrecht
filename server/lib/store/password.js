const crypto = require('crypto');

function pepper() {
  return process.env.STORE_SESSION_SECRET || '';
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt + pepper(), 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  if (!password || !salt || !storedHash) return false;
  const hash = crypto.scryptSync(password, salt + pepper(), 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { hashPassword, verifyPassword, normalizeEmail, isValidEmail };

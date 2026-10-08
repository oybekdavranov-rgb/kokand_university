'use strict';
const db = require('./db');
const log = require('./logger');
const { clientIp } = require('./security/rateLimit');

/** Admin amalini audit jurnaliga yozadi (kim / nima / qachon / IP). */
async function record(req, user, action, target) {
  try {
    await db.run(
      'INSERT INTO audit_log (user_id, email, action, target, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [user ? user.id : null, user ? user.email : null, action, target || null, clientIp(req), Date.now()]
    );
  } catch (err) {
    log.error('audit yozishda xato', { err: err.message });
  }
}

/**
 * So'nggi amallar (bosh panel uchun). Staff — barchaniki, editor — faqat o'ziniki.
 * IP manzil qaytarilmaydi; muvaffaqiyatsiz kirishlar faqat staff'ga ko'rinadi.
 */
async function recent(user, limit = 10) {
  const n = Math.max(1, Math.min(50, Number(limit) || 10));
  if (user.role === 'staff') {
    return db.all(`SELECT id, email, action, target, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ${n}`);
  }
  return db.all(
    `SELECT id, email, action, target, created_at FROM audit_log WHERE user_id = ? AND action <> 'login_failed' ORDER BY created_at DESC, id DESC LIMIT ${n}`,
    [user.id]
  );
}

module.exports = { record, recent };

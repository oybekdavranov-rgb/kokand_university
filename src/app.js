'use strict';
const http = require('node:http');
const path = require('node:path');
const { config } = require('./config');
const log = require('./logger');
const db = require('./db');
const auth = require('./auth');
const audit = require('./audit');
const csrf = require('./security/csrf');
const { createLimiter, clientIp, TRUST_HOPS } = require('./security/rateLimit');
const { hashPassword, newSalt, verifyPassword } = require('./security/passwords');
const { sanitizeString, sanitizeUrl, isEmail } = require('./security/sanitize');
const collections = require('./collections');
const contentI18n = require('./content-i18n');
const site = require('./site-profile');
const manifestMod = require('./manifest');
const uploads = require('./uploads');
const content = require('./content');
const i18n = require('./i18n');
const siteMod = require('./site');
const seo = require('./seo');
const { search } = require('./search');
const assistant = require('./assistant');
const { translate, info: translateInfo } = require('./translate');
const {
  sendJson, redirect, parseJsonBody, parseFormData, serveStaticFile,
  setSecurityHeaders, escapeHtml,
} = require('./http-helpers');

const loginLimiter = createLimiter(config.LOGIN_MAX_ATTEMPTS, config.LOGIN_WINDOW_MS, 'login');
const apiLimiter = createLimiter(config.API_RATE_MAX, config.API_RATE_WINDOW_MS, 'api');
const assistantLimiter = createLimiter(Number(process.env.ASSISTANT_RATE_MAX || 40), 60 * 1000, 'assistant');

const MUTATING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// Faol to'plamlar ro'yxatidan tuziladi — o'chirilgan jadvalga so'rov 404 qaytaradi.
const COLLECTION_ROUTE = new RegExp(`^/api/admin/(${collections.NAMES.join('|')})(?:/(\\d+))?$`);

const I18N_TABLES = collections.NAMES.filter((n) => contentI18n.fieldsFor(n).length);
const I18N_ROUTE = new RegExp(`^/api/admin/i18n/(${I18N_TABLES.join('|') || '-'})/(\\d+)$`);

/* ============================ API routing ============================ */
async function handleApi(req, res, pathname, query) {
  // Auth
  if (pathname === '/api/admin/login' && req.method === 'POST') return login(req, res);
  if (pathname === '/api/admin/logout' && req.method === 'POST') return logoutRoute(req, res);
  if (pathname === '/api/admin/session' && req.method === 'GET') return session(req, res);

  // Public
  if (pathname === '/api/public/site' && req.method === 'GET') return publicSite(req, res, query);
  if (pathname === '/api/public/search' && req.method === 'GET') return publicSearch(req, res, query);
  if (pathname === '/api/public/assistant' && req.method === 'POST') return publicAssistant(req, res);
  if (pathname === '/api/public/overrides' && req.method === 'GET') return publicOverrides(req, res);
  if (pathname === '/api/public/i18n' && req.method === 'GET') return publicI18n(req, res);
  if (pathname === '/api/public/apply' && req.method === 'POST' && site.has('applications')) {
    return publicApply(req, res);
  }

  // Collections CRUD — faqat shu sayt profilida faol bo'lganlari
  const cm = pathname.match(COLLECTION_ROUTE);
  if (cm) return collectionRoute(req, res, cm[1], cm[2] ? Number(cm[2]) : null);

  // To'plam yozuvining RU/EN tarjimalari (ko'rish / qo'lda tuzatish)
  const im = pathname.match(I18N_ROUTE);
  if (im && (req.method === 'GET' || req.method === 'PUT')) return itemI18nRoute(req, res, im[1], Number(im[2]));

  // Arizalarni CSV sifatida yuklab olish (zaxira nusxa)
  if (pathname === '/api/admin/applications.csv' && req.method === 'GET' && site.has('applications')) {
    return exportApplications(req, res);
  }

  // Settings
  if (pathname === '/api/admin/settings' && req.method === 'GET') return getSettings(req, res);
  if (pathname === '/api/admin/settings' && req.method === 'PUT') return putSettings(req, res);
  if (pathname === '/api/admin/retranslate' && req.method === 'POST') return retranslateRoute(req, res);

  // Users (staff)
  if (pathname === '/api/admin/users' && req.method === 'GET') return listUsers(req, res);
  if (pathname === '/api/admin/users' && req.method === 'POST') return createUserRoute(req, res);
  const um = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (um && (req.method === 'PUT' || req.method === 'DELETE')) return userRoute(req, res, Number(um[1]));

  // Elements
  if (pathname === '/api/admin/elements' && req.method === 'GET') return listElements(req, res);
  if (pathname.startsWith('/api/admin/elements/') && req.method === 'PUT') return putElement(req, res, pathname);
  if (pathname.startsWith('/api/admin/elements/') && req.method === 'DELETE') return deleteElement(req, res, pathname);

  // Files
  if (pathname === '/api/admin/files' && req.method === 'GET') return listFilesRoute(req, res);
  if (pathname === '/api/admin/files' && req.method === 'POST') return uploadRoute(req, res);
  if (pathname.startsWith('/api/admin/files/') && req.method === 'DELETE') return deleteFileRoute(req, res, pathname);

  // Credentials
  if (pathname === '/api/admin/change-credentials' && req.method === 'POST') return changeCredentials(req, res);

  // Tizim holati (staff): proxy/IP sozlamasi, baza, tarjima xizmati — deployni tekshirish uchun
  if (pathname === '/api/admin/diagnostics' && req.method === 'GET') return diagnostics(req, res);

  // So'nggi amallar (bosh panel)
  if (pathname === '/api/admin/activity' && req.method === 'GET') {
    const user = await auth.requireAuth(req, res);
    if (!user) return;
    return sendJson(res, 200, { ok: true, items: await audit.recent(user, query.get('limit')) });
  }

  sendJson(res, 404, { ok: false, error: 'API route topilmadi' });
}

/* ---------------- Auth ---------------- */
async function login(req, res) {
  const body = await parseJsonBody(req);
  const email = sanitizeString(body.email, 255).toLowerCase();
  const password = String(body.password || '');
  const rlKey = `${clientIp(req)}:${email}`;
  if (loginLimiter(rlKey).limited) {
    return sendJson(res, 429, { ok: false, error: 'Juda ko‘p urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring.' });
  }
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!verifyPassword(password, user)) {
    await audit.record(req, null, 'login_failed', email);
    return sendJson(res, 401, { ok: false, error: 'Email yoki parol noto‘g‘ri.' });
  }
  const session = await auth.createSession(user.id);
  auth.setSessionCookie(res, session.id);
  await audit.record(req, user, 'login', null);
  sendJson(res, 200, { ok: true, user: { email: user.email, role: user.role } });
}

async function logoutRoute(req, res) {
  const current = await auth.getCurrentUser(req);
  auth.logout(res, current ? current.session_id : null);
  sendJson(res, 200, { ok: true });
}

async function session(req, res) {
  const user = await auth.getCurrentUser(req);
  const token = csrf.issueToken(req, res);
  sendJson(res, 200, {
    ok: true,
    authenticated: Boolean(user),
    csrfToken: token,
    user: user ? { email: user.email, role: user.role } : null,
    // Admin panel shu ro'yxatga qarab keraksiz bo'limlarni yashiradi
    profile: site.profile.name,
    profileLabel: site.profile.label,
    collections: collections.NAMES,
  });
}

/* ---------------- Public ---------------- */
// Ochiq sayt uchun beriladigan to'plamlar: javobdagi kalit -> [jadval, tartib].
// PII bo'lgan `applications` bu ro'yxatda YO'Q — u faqat admin panel orqali ko'rinadi.
const PUBLIC_FEEDS = {
  news: ['news', 'sort ASC, id DESC'],
  achievements: ['achievements', 'sort ASC, id ASC'],
  distinctions: ['distinctions', 'sort ASC, id ASC'],
  interests: ['interests', 'sort ASC, id ASC'],
  programmes: ['programmes', 'sort ASC, id ASC'],
  stories: ['stories', 'sort ASC, id DESC'],
  gallery: ['gallery', 'sort ASC, id ASC'],
  residences: ['residences', 'sort ASC, id ASC'],
  castlePages: ['castle_pages', 'sort ASC, id ASC'],
};

async function publicSite(req, res, query) {
  // Profilda o'chirilgan jadval umuman so'ralmaydi, lekin kalit bo'sh massiv
  // sifatida qaytadi — frontend kodi hech qanday o'zgarishsiz ishlayveradi.
  const lang = i18n.normalizeLang(query && query.get ? query.get('lang') : '');
  const keys = Object.keys(PUBLIC_FEEDS);
  const rows = await Promise.all(keys.map((key) => {
    const [table, order] = PUBLIC_FEEDS[key];
    return site.has(table) ? db.all(`SELECT * FROM ${table} ORDER BY ${order}`) : Promise.resolve([]);
  }));
  const snap = await content.snapshot();
  const payload = { ok: true, profile: site.profile.name, lang };
  keys.forEach((key, i) => { payload[key] = content.localizeList(PUBLIC_FEEDS[key][0], rows[i], lang, snap.i18n); });
  payload.settings = content.publicSettings(snap.settings, lang);
  sendJson(res, 200, payload);
}

/* Sayt bo'yicha qidiruv (⌘K) */
async function publicSearch(req, res, query) {
  const lang = i18n.normalizeLang(query.get('lang'));
  const q = sanitizeString(query.get('q'), 120);
  const results = await search(q, lang, 14);
  res.setHeader('Cache-Control', 'public, max-age=30');
  sendJson(res, 200, { ok: true, q, results });
}

/* KU yordamchisi — rasmiy ma'lumotlardan javob */
async function publicAssistant(req, res) {
  if (assistantLimiter(clientIp(req)).limited) {
    return sendJson(res, 429, { ok: false, error: 'Juda ko‘p savol. Birozdan so‘ng urinib ko‘ring.' });
  }
  const body = await parseJsonBody(req);
  const q = sanitizeString(body.q, 300);
  if (!q) return sendJson(res, 400, { ok: false, error: 'Savol bo‘sh.' });
  const out = await assistant.answer(q, body.lang);
  sendJson(res, 200, { ok: true, ...out });
}

async function publicOverrides(req, res) {
  const rows = await db.all('SELECT element_id, payload_json FROM overrides');
  const payload = {};
  for (const row of rows) {
    try { payload[row.element_id] = JSON.parse(row.payload_json); } catch { payload[row.element_id] = {}; }
  }
  sendJson(res, 200, { ok: true, overrides: payload });
}

// Admin kiritgan kontentning avto-tarjima lug'ati: { "uz matn": { en, ru } }.
// public/i18n.js shu lug'atni o'z dvigateliga qo'shib, dinamik kontentni ham tarjima qiladi.
async function publicI18n(req, res) {
  const dict = await contentI18n.buildDictionary();
  sendJson(res, 200, { ok: true, dict });
}

/* ---------------- Ochiq ariza (yotoqxonaga qo'shilish) ---------------- */
/**
 * Ikki qatlamli cheklov:
 *  - attemptLimiter: soatda 20 urinish — qo'pol spamni to'xtatadi, lekin
 *    xato to'ldirgan foydalanuvchini bloklab qo'ymaydi.
 *  - savedLimiter: soatda 5 MUVAFFAQIYATLI ariza — takroriy arizalar oqimini
 *    cheklaydi. Faqat baza yozuvi muvaffaqiyatli bo'lganda oshadi.
 */
const attemptLimiter = createLimiter(20, 60 * 60 * 1000, 'apply-try');
const savedLimiter = createLimiter(5, 60 * 60 * 1000, 'apply-ok');

async function publicApply(req, res) {
  const ip = clientIp(req);
  if (attemptLimiter(ip).limited) {
    return sendJson(res, 429, { ok: false, error: 'Juda ko\u2018p urinish. Bir soatdan so\u2018ng qayta urinib ko\u2018ring.' });
  }
  const body = await parseJsonBody(req);

  // Bot tuzoqi (honeypot): ko\u2018rinmas maydon to\u2018ldirilgan bo\u2018lsa \u2014 bot
  if (sanitizeString(body.website, 100)) {
    return sendJson(res, 200, { ok: true }); // botga muvaffaqiyat ko\u2018rsatamiz, lekin saqlamaymiz
  }

  const name = sanitizeString(body.name, 200);
  const phone = sanitizeString(body.phone, 60);
  const email = sanitizeString(body.email, 200).toLowerCase();
  if (name.length < 3) return sendJson(res, 400, { ok: false, error: 'Ism-familiyani to\u2018liq kiriting.' });
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return sendJson(res, 400, { ok: false, error: 'Telefon raqamini to\u2018g\u2018ri kiriting.' });
  if (email && !isEmail(email)) return sendJson(res, 400, { ok: false, error: 'Email manzil noto\u2018g\u2018ri.' });

  if (savedLimiter(ip).limited) {
    return sendJson(res, 429, { ok: false, error: 'Siz allaqachon bir nechta ariza yubordingiz. Koordinator siz bilan bog\u2018lanadi.' });
  }

  const now = Date.now();
  const { lastId } = await db.run(
    `INSERT INTO applications
      (name, phone, email, gender, faculty, course, city, residence, duration, note, status, ip, sort, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, phone, email,
      sanitizeString(body.gender, 30), sanitizeString(body.faculty, 200),
      sanitizeString(body.course, 40), sanitizeString(body.city, 200),
      sanitizeString(body.residence, 200), sanitizeString(body.duration, 60),
      sanitizeString(body.note, 4000), 'yangi', ip, 0, now, now]
  );
  log.info('yangi ariza', { id: lastId, ip });
  sendJson(res, 201, { ok: true, id: lastId, message: 'Arizangiz qabul qilindi. Tez orada siz bilan bog\u2018lanamiz.' });
}

/* ---------------- Collections ---------------- */
/**
 * Shaxsiy ma'lumot (PII) saqlaydigan to'plamlar — faqat STAFF admin uchun.
 * Kontent muharriri (editor) talabalarning ism/telefon/email/IP ma'lumotlarini
 * ko'rmasligi kerak (eng kam imtiyoz tamoyili).
 */
const PII_COLLECTIONS = new Set(['applications']);

async function collectionRoute(req, res, name, id) {
  const gate = PII_COLLECTIONS.has(name) ? auth.requireStaff : auth.requireAuth;
  if (req.method === 'GET') {
    if (!(await gate(req, res))) return;
    const items = await collections.list(name);
    const cfg = collections.COLLECTIONS[name];
    const total = cfg && cfg.limit ? await collections.count(name) : items.length;
    return sendJson(res, 200, { ok: true, items, total, limited: total > items.length });
  }
  const user = await gate(req, res);
  if (!user) return;
  if (req.method === 'POST') {
    const item = await collections.create(name, await parseJsonBody(req));
    await audit.record(req, user, `${name}.create`, String(item.id));
    contentI18n.translateRowAsync(name, item); // avto-tarjima (fon, bloklanmaydi)
    content.bump(); content.clearImageCache();
    return sendJson(res, 201, { ok: true, item });
  }
  if (req.method === 'PUT' && id) {
    const item = await collections.update(name, id, await parseJsonBody(req));
    if (!item) return sendJson(res, 404, { ok: false, error: 'Element topilmadi' });
    await audit.record(req, user, `${name}.update`, String(id));
    contentI18n.translateRowAsync(name, item); // avto-tarjima (fon, bloklanmaydi)
    content.bump(); content.clearImageCache();
    return sendJson(res, 200, { ok: true, item });
  }
  if (req.method === 'DELETE' && id) {
    await collections.remove(name, id);
    await contentI18n.deleteRow(name, id).catch(() => {});
    await audit.record(req, user, `${name}.delete`, String(id));
    content.bump();
    return sendJson(res, 200, { ok: true });
  }
  sendJson(res, 405, { ok: false, error: 'Metod qo‘llab-quvvatlanmaydi' });
}

/* ---------------- To'plam yozuvi tarjimalari ---------------- */
/**
 * GET — har bir tarjima qilinadigan maydon uchun { field, uz, ru, en, stale }.
 *   stale: tarjima eski o'zbekcha matndan qilingan (matn o'zgargan, yangisi hali tayyor emas).
 * PUT { fields: { title: { ru, en }, ... } } — qo'lda tuzatilgan tarjimani saqlaydi.
 *   Bo'sh qoldirilgan til avtomatik tarjima qilinadi (fon rejimida).
 */
async function itemI18nRoute(req, res, table, id) {
  const user = await auth.requireAuth(req, res);
  if (!user) return;
  const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) return sendJson(res, 404, { ok: false, error: 'Yozuv topilmadi' });
  const fields = contentI18n.fieldsFor(table);
  if (req.method === 'PUT') {
    const body = await parseJsonBody(req);
    const input = body && body.fields && typeof body.fields === 'object' ? body.fields : {};
    const now = Date.now();
    let missing = false;
    for (const f of fields) {
      const uz = String(row[f] == null ? '' : row[f]).trim();
      const v = input[f];
      if (!uz || !v || typeof v !== 'object') continue;
      const ru = sanitizeString(v.ru, 40000) || null;
      const en = sanitizeString(v.en, 40000) || null;
      if (!ru || !en) missing = true;
      await db.run(
        `INSERT INTO content_i18n (ref_table, ref_id, field, uz, en, ru, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(ref_table, ref_id, field) DO UPDATE SET uz = excluded.uz, en = excluded.en, ru = excluded.ru, updated_at = excluded.updated_at`,
        [table, id, f, uz, en, ru, now]
      );
    }
    await audit.record(req, user, `${table}.i18n`, String(id));
    content.bump();
    if (missing) contentI18n.translateRowAsync(table, row); // bo'sh qolganlarini avto-tarjima
  }
  const rows = await db.all('SELECT field, uz, en, ru FROM content_i18n WHERE ref_table = ? AND ref_id = ?', [table, id]);
  const byField = new Map(rows.map((r) => [r.field, r]));
  const out = fields.map((f) => {
    const uz = String(row[f] == null ? '' : row[f]);
    const tr = byField.get(f);
    const fresh = tr && tr.uz === uz.trim();
    return { field: f, uz, ru: fresh ? tr.ru || '' : '', en: fresh ? tr.en || '' : '', stale: Boolean(tr && !fresh && uz.trim()) };
  }).filter((x) => x.uz.trim());
  sendJson(res, 200, { ok: true, table, id, fields: out });
}

/* ---------------- Arizalarni CSV eksport ---------------- */
/**
 * Excel/CSV formula injection himoyasi.
 * =, @, tab, CR bilan boshlanuvchi qiymat har doim neytrallanadi.
 * + yoki - bilan boshlanuvchi qiymat faqat telefon raqamiga O'XSHAMASA
 * neytrallanadi — shunda "+998 90 123 45 67" Excelda toza ko'rinadi,
 * lekin "+cmd|..." kabi hujum baribir bloklanadi.
 */
const PHONE_LIKE = /^[+-][\d\s()\-.]{4,}$/;
function csvCell(v) {
  const s = String(v == null ? '' : v);
  let danger = /^[=@\t\r]/.test(s);
  if (!danger && /^[+-]/.test(s)) danger = !PHONE_LIKE.test(s);
  const safe = danger ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
}

async function exportApplications(req, res) {
  const user = await auth.requireStaff(req, res);
  if (!user) return;
  // PII eksporti — audit jurnaliga yoziladi (kim, qachon, qancha yozuv)
  await db.checkpoint(); // WAL'ni asosiy faylga yozamiz — baza fayli ham to'liq bo'ladi
  const rows = await db.all('SELECT * FROM applications ORDER BY created_at DESC, id DESC');
  const cols = ['id', 'name', 'phone', 'email', 'gender', 'faculty', 'course', 'city', 'residence', 'duration', 'note', 'status', 'created_at'];
  const head = ['ID', 'Ism-familiya', 'Telefon', 'Email', 'Jinsi', 'Fakultet', 'Kurs', 'Shahar', 'Turar joy', 'Muddat', 'Izoh', 'Holati', 'Yuborilgan vaqt'];
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(cols.map((c) => csvCell(c === 'created_at' ? new Date(Number(r[c])).toISOString() : r[c])).join(','));
  }
  const body = '\uFEFF' + lines.join('\r\n'); // BOM — Excel o'zbek harflarini to'g'ri o'qishi uchun
  await audit.record(req, user, 'applications.export', `${rows.length} ta yozuv`);
  const stamp = new Date().toISOString().slice(0, 10);
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="yotoqxona-arizalar-${stamp}.csv"`,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/* ---------------- Tizim holati ---------------- */
async function diagnostics(req, res) {
  if (!(await auth.requireStaff(req, res))) return;
  const snap = await content.snapshot();
  const xff = String(req.headers['x-forwarded-for'] || '');
  sendJson(res, 200, {
    ok: true,
    node: process.version,
    env: config.IS_PROD ? 'production' : (process.env.NODE_ENV || 'development'),
    profile: site.profile.name,
    db: db.dialect,
    translate: translateInfo(),
    contentVersion: Number(snap.settings.content_version) || null,
    siteUrl: String(snap.settings.site_url || process.env.SITE_URL || ''),
    uploadsDir: config.UPLOADS_DIR,
    proxy: {
      trustHops: TRUST_HOPS,
      socketIp: (req.socket && req.socket.remoteAddress) || '',
      forwardedFor: xff ? xff.split(',').map((x) => x.trim()) : [],
      clientIp: clientIp(req),
    },
  });
}

/* ---------------- Settings ---------------- */
/**
 * Sozlama qiymatini turiga qarab tozalaydi.
 * `*_url` — xavfli sxemalar (javascript:, data:) bloklanadi; email — format tekshiriladi.
 * Bo'sh qiymat ruxsat etiladi (admin maydonni ataylab tozalashi mumkin).
 * @returns {string|null} null — qiymat yaroqsiz
 */
function cleanSettingValue(key, value) {
  const raw = sanitizeString(value, 5000);
  if (!raw) return '';
  if (/_url$/.test(key)) {
    const url = sanitizeUrl(raw);
    if (!url || !/^(https?:\/\/|\/)/i.test(url)) return null;
    return url;
  }
  if (/(^|_)email$/.test(key)) return isEmail(raw) ? raw : null;
  return raw;
}

async function getSettings(req, res) {
  if (!(await auth.requireAuth(req, res))) return;
  const rows = await db.all('SELECT key, value FROM settings');
  sendJson(res, 200, {
    ok: true,
    settings: Object.fromEntries(rows.map((r) => [r.key, r.value])),
    // Admin panelda bo'sh maydonlar uchun ko'rsatma (placeholder)
    defaults: content.SETTINGS_DEFAULTS,
    translations: content.SETTINGS_I18N,
  });
}

async function putSettings(req, res) {
  const user = await auth.requireStaff(req, res);
  if (!user) return;
  const body = await parseJsonBody(req);
  const entries = body && typeof body === 'object' ? Object.entries(body) : [];
  // Avval hammasini tekshiramiz — bitta maydon yaroqsiz bo'lsa hech narsa yozilmaydi
  const accepted = [];
  const rejected = [];
  for (const [key, value] of entries) {
    const cleanKey = sanitizeString(key, 100);
    if (!config.ALLOWED_SETTINGS_KEYS.has(cleanKey)) continue;
    const clean = cleanSettingValue(cleanKey, value);
    if (clean === null) rejected.push(cleanKey);
    else accepted.push([cleanKey, clean]);
  }
  if (rejected.length) {
    return sendJson(res, 400, { ok: false, error: `Noto‘g‘ri qiymat: ${rejected.join(', ')}`, fields: rejected });
  }
  for (const [cleanKey, clean] of accepted) {
    await db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [cleanKey, clean]
    );
  }
  await audit.record(req, user, 'settings.update', null);
  content.bump();
  const rows = await db.all('SELECT key, value FROM settings');
  sendJson(res, 200, { ok: true, settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
}

/* ---------------- Barcha kontentni qayta tarjima qilish (staff) ---------------- */
async function retranslateRoute(req, res) {
  const user = await auth.requireStaff(req, res);
  if (!user) return;
  // Fon rejimida — javobni kutmaymiz (tarjima sekin bo'lishi mumkin).
  const listFn = (table) => (site.has(table) ? collections.list(table) : Promise.resolve([]));
  contentI18n.retranslateAll(listFn)
    .then((n) => log.info('retranslate tugadi', { count: n }))
    .catch((e) => log.warn('retranslate xato', { err: e.message }));
  await audit.record(req, user, 'content.retranslate', null);
  sendJson(res, 202, { ok: true, message: 'Tarjima fon rejimida boshlandi. Bir necha daqiqadan so‘ng tayyor bo‘ladi.' });
}

/* ---------------- Users (staff) ---------------- */
async function listUsers(req, res) {
  if (!(await auth.requireStaff(req, res))) return;
  sendJson(res, 200, { ok: true, users: await db.all('SELECT id, email, role, created_at, updated_at FROM users ORDER BY id ASC') });
}

async function createUserRoute(req, res) {
  const staff = await auth.requireStaff(req, res);
  if (!staff) return;
  const body = await parseJsonBody(req);
  const email = sanitizeString(body.email, 255).toLowerCase();
  const password = String(body.password || '');
  const role = body.role === 'staff' ? 'staff' : 'editor';
  if (!isEmail(email)) return sendJson(res, 400, { ok: false, error: 'To‘g‘ri email kiriting.' });
  if (password.length < 8) return sendJson(res, 400, { ok: false, error: 'Parol kamida 8 belgidan iborat bo‘lsin.' });
  if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', [email])) {
    return sendJson(res, 400, { ok: false, error: 'Bu email allaqachon mavjud.' });
  }
  const now = Date.now();
  const salt = newSalt();
  await db.run('INSERT INTO users (email, password_hash, salt, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [email, hashPassword(password, salt), salt, role, now, now]);
  await audit.record(req, staff, 'user.create', email);
  sendJson(res, 201, { ok: true, user: await db.get('SELECT id, email, role, created_at, updated_at FROM users WHERE email = ?', [email]) });
}

async function userRoute(req, res, targetId) {
  const staff = await auth.requireStaff(req, res);
  if (!staff) return;
  const target = await db.get('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!target) return sendJson(res, 404, { ok: false, error: 'Admin topilmadi' });

  if (req.method === 'DELETE') {
    // Atomik: oxirgi staff adminni o'chirishni bitta shartli DELETE bloklaydi
    // (check-then-act poyga holatini yopadi).
    const del = await db.run(
      "DELETE FROM users WHERE id = ? AND (role <> 'staff' OR (SELECT COUNT(*) FROM users WHERE role = 'staff') > 1)",
      [targetId]
    );
    if (!del.changes) return sendJson(res, 400, { ok: false, error: 'Oxirgi staff adminni o‘chirib bo‘lmaydi.' });
    await auth.destroyOtherSessions(targetId, ''); // o'chirilgan admin sessiyalarini ham bekor qilamiz
    await audit.record(req, staff, 'user.delete', target.email);
    return sendJson(res, 200, { ok: true });
  }

  const body = await parseJsonBody(req);
  const newEmail = sanitizeString(body.email, 255).toLowerCase();
  const newPassword = String(body.password || '');
  let newRole = target.role;
  if (body.role === 'staff' || body.role === 'editor') newRole = body.role;
  if (target.role === 'staff' && newRole !== 'staff') {
    const { c } = await db.get("SELECT COUNT(*) AS c FROM users WHERE role = 'staff'");
    if (Number(c) <= 1) return sendJson(res, 400, { ok: false, error: 'Oxirgi staff adminning rolini o‘zgartirib bo‘lmaydi.' });
  }
  if (newEmail && newEmail !== target.email) {
    if (!isEmail(newEmail)) return sendJson(res, 400, { ok: false, error: 'To‘g‘ri email kiriting.' });
    if (await db.get('SELECT 1 AS x FROM users WHERE email = ? AND id <> ?', [newEmail, targetId])) {
      return sendJson(res, 400, { ok: false, error: 'Bu email band.' });
    }
  }
  const finalEmail = newEmail || target.email;
  let finalSalt = target.salt;
  let finalHash = target.password_hash;
  if (newPassword) {
    if (newPassword.length < 8) return sendJson(res, 400, { ok: false, error: 'Parol kamida 8 belgidan iborat bo‘lsin.' });
    finalSalt = newSalt();
    finalHash = hashPassword(newPassword, finalSalt);
  }
  await db.run('UPDATE users SET email = ?, password_hash = ?, salt = ?, role = ?, updated_at = ? WHERE id = ?',
    [finalEmail, finalHash, finalSalt, newRole, Date.now(), targetId]);
  if (newPassword) await auth.destroyOtherSessions(targetId, '');
  await audit.record(req, staff, 'user.update', finalEmail);
  sendJson(res, 200, { ok: true, user: await db.get('SELECT id, email, role, created_at, updated_at FROM users WHERE id = ?', [targetId]) });
}

/* ---------------- Elements ---------------- */
async function listElements(req, res) {
  if (!(await auth.requireAuth(req, res))) return;
  const { manifest } = manifestMod.getManifest();
  const overridesMap = await manifestMod.getOverridesMap();
  const elements = manifest.map((item) => manifestMod.mergeElement(item, overridesMap.get(item.id)));
  sendJson(res, 200, {
    ok: true,
    summary: {
      total: elements.length,
      text: elements.filter((e) => e.type === 'text').length,
      links: elements.filter((e) => e.type === 'link').length,
      images: elements.filter((e) => e.type === 'image').length,
      videos: elements.filter((e) => e.type === 'video').length,
      overridden: elements.filter((e) => e.hasOverride).length,
    },
    elements,
  });
}

async function putElement(req, res, pathname) {
  const user = await auth.requireAuth(req, res);
  if (!user) return;
  const { manifestMap } = manifestMod.getManifest();
  const elementId = decodeURIComponent(pathname.split('/').pop());
  const element = manifestMap.get(elementId);
  if (!element) return sendJson(res, 404, { ok: false, error: 'Element topilmadi' });
  if (element.type === 'video' && user.role !== 'staff') {
    return sendJson(res, 403, { ok: false, error: 'Orqafon (video) elementini faqat staff admin tahrirlashi mumkin.' });
  }
  const existing = await manifestMod.getOverride(elementId);
  const payload = manifestMod.normalizeOverridePayload(element, await parseJsonBody(req), existing);
  await manifestMod.saveOverride(elementId, payload);
  await audit.record(req, user, 'element.update', elementId);
  content.bump();
  translateOverrideAsync(elementId, element, payload);
  sendJson(res, 200, { ok: true, element: manifestMod.mergeElement(element, { ...payload, updatedAt: Date.now() }) });
}

async function deleteElement(req, res, pathname) {
  const user = await auth.requireAuth(req, res);
  if (!user) return;
  const { manifestMap } = manifestMod.getManifest();
  const elementId = decodeURIComponent(pathname.split('/').pop());
  const element = manifestMap.get(elementId);
  if (!element) return sendJson(res, 404, { ok: false, error: 'Element topilmadi' });
  await manifestMod.deleteOverride(elementId);
  await audit.record(req, user, 'element.reset', elementId);
  content.bump();
  sendJson(res, 200, { ok: true, element: manifestMod.mergeElement(element, null) });
}

/**
 * Admin o'zbekcha matnni (yoki rasm alt matnini) o'zgartirsa — RU/EN tarjimasi
 * fon rejimida tayyorlanadi (agar admin tarjimani qo'lda kiritmagan bo'lsa).
 * Asl matn bilan bir xil bo'lsa — tegilmaydi (lug'atdagi tayyor tarjima ishlaydi).
 */
function translateOverrideAsync(elementId, element, payload) {
  const field = element.type === 'image' ? 'alt' : 'text';
  if (!payload || typeof payload[field] !== 'string' || !payload[field].trim()) return;
  const original = String((element.original && element.original[field]) || '').replace(/\s+/g, ' ').trim();
  if (payload[field].replace(/\s+/g, ' ').trim() === original) return;
  const need = ['ru', 'en'].filter((l) => !payload[`${field}_${l}`]);
  if (!need.length) return;
  Promise.all(need.map((l) => translate(payload[field], l))).then(async (outs) => {
    const cur = await manifestMod.getOverride(elementId);
    if (!cur || cur[field] !== payload[field]) return; // o'chirilgan yoki orada yana o'zgargan
    delete cur.updatedAt;
    let changed = false;
    need.forEach((l, i) => {
      if (!cur[`${field}_${l}`] && outs[i] && outs[i] !== payload[field]) {
        cur[`${field}_${l}`] = outs[i]; cur[`auto_${l}`] = true; changed = true;
      }
    });
    if (!changed) return;
    await manifestMod.saveOverride(elementId, cur);
    content.bump();
  }).catch((err) => log.warn('override tarjima xatosi', { elementId, err: err.message }));
}

/* ---------------- Files ---------------- */
async function listFilesRoute(req, res) {
  if (!(await auth.requireAuth(req, res))) return;
  sendJson(res, 200, { ok: true, files: await uploads.listFiles() });
}

async function uploadRoute(req, res) {
  const user = await auth.requireAuth(req, res);
  if (!user) return;
  const form = await parseFormData(req);
  const uploaded = form.get('file');
  if (!uploaded || typeof uploaded === 'string') {
    return sendJson(res, 400, { ok: false, error: 'No file provided' });
  }
  const file = await uploads.saveUpload(uploaded);
  await audit.record(req, user, 'file.upload', file.filename);
  content.clearImageCache();
  sendJson(res, 201, { ok: true, file });
}

async function deleteFileRoute(req, res, pathname) {
  const user = await auth.requireAuth(req, res);
  if (!user) return;
  const filename = decodeURIComponent(pathname.split('/').pop());
  const ok = await uploads.deleteUpload(filename);
  if (!ok) return sendJson(res, 404, { ok: false, error: 'Fayl topilmadi' });
  await audit.record(req, user, 'file.delete', filename);
  content.clearImageCache(); content.bump();
  sendJson(res, 200, { ok: true });
}

/* ---------------- Credentials ---------------- */
async function changeCredentials(req, res) {
  const authUser = await auth.requireAuth(req, res);
  if (!authUser) return;
  const body = await parseJsonBody(req);
  const currentPassword = String(body.currentPassword || '');
  const newEmail = sanitizeString(body.newEmail, 255).toLowerCase();
  const newPassword = String(body.newPassword || '');
  const user = await db.get('SELECT * FROM users WHERE id = ?', [authUser.id]);
  if (!verifyPassword(currentPassword, user)) {
    return sendJson(res, 400, { ok: false, error: 'Joriy parol noto‘g‘ri.' });
  }
  if (!newEmail && !newPassword) {
    return sendJson(res, 400, { ok: false, error: 'Yangi email yoki parol kiriting.' });
  }
  if (newEmail && !isEmail(newEmail)) {
    return sendJson(res, 400, { ok: false, error: 'To‘g‘ri email kiriting.' });
  }
  if (newPassword && newPassword.length < 8) {
    return sendJson(res, 400, { ok: false, error: 'Parol kamida 8 belgidan iborat bo‘lsin.' });
  }
  const finalEmail = newEmail || user.email;
  let finalSalt = user.salt;
  let finalHash = user.password_hash;
  if (newPassword) { finalSalt = newSalt(); finalHash = hashPassword(newPassword, finalSalt); }
  await db.run('UPDATE users SET email = ?, password_hash = ?, salt = ?, updated_at = ? WHERE id = ?',
    [finalEmail, finalHash, finalSalt, Date.now(), authUser.id]);
  // Parol o'zgarsa — joriydan boshqa barcha sessiyalarni bekor qilamiz
  if (newPassword) await auth.destroyOtherSessions(authUser.id, authUser.session_id);
  await audit.record(req, authUser, 'credentials.change', finalEmail);
  sendJson(res, 200, { ok: true, user: { email: finalEmail } });
}

/* ============================ Server ============================ */
function createServer() {
  return http.createServer(async (req, res) => {
    const start = process.hrtime.bigint();
    setSecurityHeaders(res);
    // Yaroqsiz Host sarlavhasi yoki buzilgan %-kodlash so'rovni "osiltirib" qo'ymasin:
    // manzilni qat'iy bazaga nisbatan o'qiymiz, xatoda — darhol 400.
    let requestUrl;
    let pathname;
    try {
      requestUrl = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname.includes('\0')) throw new Error('null bayt');
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      log.info('req', { m: req.method, p: pathname, s: res.statusCode, ms: Math.round(ms), ip: clientIp(req) });
    });

    try {
      if (pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, status: 'healthy', uptime: process.uptime(), db: db.dialect });
      }

      if (pathname.startsWith('/api/')) {
        // Global rate-limit
        if (apiLimiter(clientIp(req)).limited) {
          return sendJson(res, 429, { ok: false, error: 'Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring.' });
        }
        // CSRF — barcha o'zgartiruvchi admin so'rovlari uchun (upload ham)
        if (MUTATING.has(req.method) && pathname.startsWith('/api/admin/') && !csrf.verify(req)) {
          return sendJson(res, 403, { ok: false, error: 'CSRF token yaroqsiz. Sahifani yangilang.' });
        }
        await handleApi(req, res, pathname, requestUrl.searchParams);
        return;
      }

      if (pathname === '/admin/login') {
        csrf.issueToken(req, res);
        if (await auth.getCurrentUser(req)) return redirect(res, '/admin');
        return serveStaticFile(res, path.join(config.ADMIN_DIR, 'login.html'), undefined, req);
      }
      if (pathname === '/admin' || pathname === '/admin/') {
        csrf.issueToken(req, res);
        if (!(await auth.getCurrentUser(req))) return redirect(res, '/admin/login');
        return serveStaticFile(res, path.join(config.ADMIN_DIR, 'index.html'), undefined, req);
      }
      if (pathname.startsWith('/admin-static/')) {
        return serveStaticFile(res, path.join(config.ADMIN_DIR, pathname.replace('/admin-static/', '')), undefined, req);
      }
      if (pathname === '/robots.txt') return seo.robots(req, res);
      if (pathname === '/sitemap.xml') return seo.sitemap(req, res);
      if (pathname === '/sw.js') return seo.serviceWorker(req, res);

      // Shaharcha profili — eski statik bosh sahifa
      if (site.profile.homepage !== 'index.html' && (pathname === '/' || pathname === '/index.html')) {
        csrf.issueToken(req, res);
        return serveStaticFile(res, path.join(config.PUBLIC_DIR, site.profile.homepage), undefined, req);
      }
      // Universitet sayti — server tomonida yig'iladigan sahifalar (UZ / RU / EN)
      if (site.profile.homepage === 'index.html' && await siteMod.handlePage(req, res, pathname, requestUrl.searchParams)) return;

      if (pathname.startsWith('/uploads/')) {
        return serveStaticFile(res, path.join(config.UPLOADS_DIR, pathname.replace('/uploads/', '')), [config.UPLOADS_DIR], req);
      }
      const wantsHtml = !path.extname(pathname) || /text\/html/.test(String(req.headers.accept || ''));
      return serveStaticFile(res, path.join(config.PUBLIC_DIR, pathname.replace(/^\//, '')), undefined, req,
        wantsHtml && site.profile.homepage === 'index.html' ? () => siteMod.renderNotFound(req, res) : undefined);
    } catch (error) {
      const status = error.statusCode || 500;
      if (status >= 500) log.error('handler xatosi', { err: error.message, p: pathname });
      if (String(pathname).startsWith('/api/')) {
        sendJson(res, status, { ok: false, error: status >= 500 && config.IS_PROD ? 'Server xatosi' : (error.message || 'Xato') });
      } else {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Xato</h1><pre>${escapeHtml(config.IS_PROD ? 'Server xatosi' : (error.message || ''))}</pre>`);
      }
    }
  });
}

module.exports = { createServer, handleApi };

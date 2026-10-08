'use strict';
/**
 * Test yordamchisi: vaqtinchalik baza bilan serverni ishga tushiradi va
 * cookie/CSRF'ni boshqaradigan oddiy HTTP mijoz beradi.
 *
 *   const h = require('./harness');
 *   h.env({ profile: 'university' });           // src/ modullaridan OLDIN
 *   const app = await h.start();                 // before() ichida
 *   const c = h.client(app.base); await c.login('staff@kokandu.uz', h.STAFF_PW);
 *
 * (node --test bu faylni ham "test" sifatida ishga tushiradi — unda test yo'q.)
 */
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const STAFF_PW = 'TestStaff123';
const EDITOR_PW = 'TestEditor123';

function env(opts = {}) {
  process.env.NODE_ENV = 'test'; // .env fayli testlarga ta'sir qilmaydi (config.js)
  delete process.env.DATABASE_URL; // testlar hech qachon haqiqiy bazaga ulanmaydi
  process.env.DEFAULT_STAFF_PASSWORD = STAFF_PW;
  process.env.DEFAULT_EDITOR_PASSWORD = EDITOR_PW;
  process.env.TRANSLATE_PROVIDER = opts.translate || 'mock';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
  if (opts.profile) process.env.SITE_PROFILE = opts.profile;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kutest-'));
  process.env.SQLITE_PATH = opts.sqlite || path.join(tmp, 'test.db');
  process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
  return tmp;
}

/** server.js dagi ketma-ketlik: migratsiya → adminlar → yangilash → seed → manifest */
async function start() {
  const db = require('../src/db');
  const { bootstrapUsers, seedContent } = require('../src/db/seed');
  const { upgradeContent } = require('../src/db/upgrade');
  const { loadManifest } = require('../src/manifest');
  const { createServer } = require('../src/app');
  await db.init();
  await bootstrapUsers();
  const upgrade = await upgradeContent();
  await seedContent({ merge: upgrade.ran && !upgrade.fresh });
  loadManifest();
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  return {
    db, server, base, upgrade,
    async close() {
      await new Promise((r) => server.close(r));
      try { await db.close(); } catch { /* noop */ }
    },
  };
}

function client(base) {
  const jar = {};
  const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  function store(res) {
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of sc) { const p = c.split(';')[0]; const i = p.indexOf('='); jar[p.slice(0, i)] = p.slice(i + 1); }
    return sc;
  }
  async function req(method, url, { body, csrf = true, headers, form } = {}) {
    const h = { Cookie: cookieHeader(), ...(headers || {}) };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (csrf && !['GET', 'HEAD'].includes(method)) h['x-csrf-token'] = jar.ku_csrf || '';
    const res = await fetch(base + url, {
      method, headers: h, redirect: 'manual',
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const setCookies = store(res);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = null; }
    return { status: res.status, data, text, headers: res.headers, setCookies };
  }
  return {
    jar, req,
    get: (u, o) => req('GET', u, o),
    post: (u, body, o) => req('POST', u, { ...(o || {}), body }),
    put: (u, body, o) => req('PUT', u, { ...(o || {}), body }),
    del: (u, o) => req('DELETE', u, o),
    async login(email, password) {
      await req('GET', '/api/admin/session');
      return req('POST', '/api/admin/login', { body: { email, password } });
    },
  };
}

/** Fon rejimidagi ishlar (tarjima) tugashini kutish */
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

module.exports = { env, start, client, tick, STAFF_PW, EDITOR_PW };

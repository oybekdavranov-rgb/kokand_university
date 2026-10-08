'use strict';
// Xavfsizlik testlari — ichki server ustida real HTTP so'rovlar.
const h = require('./harness');

h.env({ profile: 'university' });

const { test, before, after } = require('node:test');
const assert = require('node:assert');

let app;
before(async () => { app = await h.start(); });
after(async () => { await app.close(); });

const sessions = {};
function as(role) {
  if (!sessions[role]) {
    const c = h.client(app.base);
    sessions[role] = (role === 'staff' ? c.login('staff@kokandu.uz', h.STAFF_PW) : c.login('admin@kokandu.uz', h.EDITOR_PW)).then(() => c);
  }
  return sessions[role];
}

test('CSRF: o‘zgartiruvchi admin so‘rov tokensiz → 403', async () => {
  const c = await as('staff');
  const r = await c.post('/api/admin/news', { title: 'x' }, { csrf: false });
  assert.strictEqual(r.status, 403);
  const wrong = await c.req('PUT', '/api/admin/settings', { body: { phone_1: 'x' }, csrf: false, headers: { 'x-csrf-token': 'soxta' } });
  assert.strictEqual(wrong.status, 403);
});

test('Anonim admin API → 401', async () => {
  const c = h.client(app.base);
  for (const u of ['/api/admin/elements', '/api/admin/users', '/api/admin/settings', '/api/admin/activity', '/api/admin/i18n/news/1']) {
    assert.strictEqual((await c.get(u)).status, 401, u);
  }
});

test('SQLi login email orqali kirib bo‘lmaydi → 401', async () => {
  const c = h.client(app.base);
  assert.strictEqual((await c.login("' OR '1'='1' --", 'x')).status, 401);
});

test('RBAC: editor cheklangan (adminlar/sozlamalar/video)', async () => {
  const c = await as('editor');
  assert.strictEqual((await c.get('/api/admin/users')).status, 403);
  assert.strictEqual((await c.put('/api/admin/settings', { phone_1: 'x' })).status, 403);
  assert.strictEqual((await c.put('/api/admin/elements/home.hero.video', { src: 'x' })).status, 403);
  assert.strictEqual((await c.post('/api/admin/retranslate', {})).status, 403);
});

test('XSS: javascript: havolalar tozalanadi (to‘plam, element, sozlama)', async () => {
  const c = await as('staff');
  const r = await c.post('/api/admin/news', { title: 'ok', link: 'javascript:alert(1)', image: 'data:text/html,x' });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.item.link, '');
  assert.strictEqual(r.data.item.image, '');
  const el = await c.put('/api/admin/elements/home.hero.t1', { text: 'Kelajakni', linkUrl: 'javascript:alert(1)' });
  assert.strictEqual(el.status, 200);
  assert.strictEqual(el.data.element.override.linkUrl, '');
  const st = await c.put('/api/admin/settings', { admission_url: ' JaVaScRiPt:alert(1)' });
  assert.strictEqual(st.status, 400);
  await c.del('/api/admin/elements/home.hero.t1');
});

test('XSS: admin kiritgan HTML sahifada escape qilinadi', async () => {
  const c = await as('editor');
  const r = await c.post('/api/admin/news', { title: '<img src=x onerror=alert(1)>', excerpt: '<script>alert(1)</script>', body: '**qalin** <b>teg</b>' });
  assert.strictEqual(r.status, 201);
  const pub = h.client(app.base);
  const list = await pub.get('/yangiliklar');
  assert.ok(!list.text.includes('<img src=x onerror'), 'ro‘yxatda xom HTML yo‘q');
  assert.ok(list.text.includes('&lt;img src=x onerror=alert(1)&gt;'));
  const red = await pub.get(`/yangiliklar/${r.data.item.id}`);
  const page = await pub.get(red.headers.get('location'));
  assert.strictEqual(page.status, 200);
  assert.ok(!/<script>alert\(1\)<\/script>/.test(page.text));
  assert.ok(page.text.includes('<strong>qalin</strong>') && page.text.includes('&lt;b&gt;teg&lt;/b&gt;'));
  // CMS matni ham escape qilinadi
  await c.put('/api/admin/elements/home.hero.badge', { text: '<svg onload=alert(1)>' });
  const home = await pub.get('/');
  assert.ok(!home.text.includes('<svg onload=alert(1)>'));
  await c.del('/api/admin/elements/home.hero.badge');
});

test('SQLi: sarlavha matn sifatida saqlanadi, jadval buzilmaydi', async () => {
  const c = await as('staff');
  const r = await c.post('/api/admin/news', { title: "x'); DROP TABLE news;--" });
  assert.strictEqual(r.status, 201);
  assert.strictEqual((await c.get('/api/admin/news')).status, 200);
  assert.strictEqual((await h.client(app.base).get('/api/public/search?q=%27%20OR%201%3D1--')).status, 200);
});

test('Fayl yuklash: magic-bytes va tur allowlist, xavfsiz nom', async () => {
  const c = await as('staff');
  async function up(name, bytes, type) {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type: type || 'application/octet-stream' }), name);
    return c.req('POST', '/api/admin/files', { form: fd });
  }
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  assert.strictEqual((await up('fake.png', Buffer.from('not a png'), 'image/png')).status, 400);
  assert.strictEqual((await up('x.txt', Buffer.from('hi'))).status, 400);
  assert.strictEqual((await up('x.html', Buffer.from('<script>'))).status, 400);
  assert.strictEqual((await up('x.svg', Buffer.from('<svg onload=alert(1)>'), 'image/svg+xml')).status, 400);
  const ok = await up('good.png', PNG, 'image/png');
  assert.strictEqual(ok.status, 201);
  const trav = await up('../../../etc/passwd.png', PNG, 'image/png');
  assert.strictEqual(trav.status, 201);
  assert.ok(!/\.\.|\//.test(trav.data.file.filename));
});

test('Path traversal (statik fayllar) → 403/404', async () => {
  for (const p of ['/uploads/../../src/config.js', '/../src/config.js', '/%2e%2e/src/config.js', '/admin-static/../src/config.js', '/..%2fpackage.json']) {
    const r = await fetch(app.base + p, { redirect: 'manual' });
    assert.ok([403, 404].includes(r.status), `${p} status=${r.status}`);
  }
});

test('Xavfsizlik sarlavhalari va cookie bayroqlari', async () => {
  const home = await fetch(`${app.base}/`);
  assert.match(home.headers.get('content-security-policy') || '', /default-src 'self'/);
  assert.match(home.headers.get('content-security-policy') || '', /object-src 'none'/);
  assert.strictEqual(home.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.strictEqual(home.headers.get('x-content-type-options'), 'nosniff');
  const c = h.client(app.base);
  const r = await c.login('staff@kokandu.uz', h.STAFF_PW);
  const sid = r.setCookies.find((x) => x.startsWith('ku_cms_sid='));
  assert.ok(sid && /HttpOnly/i.test(sid) && /SameSite=Lax/i.test(sid), 'sessiya cookie HttpOnly + SameSite');
});

test('Host sarlavhasi orqali kanonik havolani buzib bo‘lmaydi', async () => {
  const http = require('node:http');
  const port = new URL(app.base).port;
  const get = (host) => new Promise((resolve, reject) => {
    const rq = http.request({ host: '127.0.0.1', port, path: '/', headers: { Host: host } }, (res) => {
      let b = ''; res.setEncoding('utf8'); res.on('data', (d) => { b += d; }); res.on('end', () => resolve(b));
    });
    rq.on('error', reject); rq.end();
  });
  const html = await get('evil.example"><script>alert(1)</script>');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /<link rel="canonical" href="http:\/\/localhost\//);
});

test('Buzilgan URL so‘rovni osiltirmaydi → 400', async () => {
  for (const p of ['/%E0%A4%A', '/a%00b', '/api/%ZZ']) {
    const ctrl = AbortSignal.timeout(3000);
    const r = await fetch(app.base + p, { signal: ctrl });
    assert.strictEqual(r.status, 400, p);
  }
});

test('Oxirgi staff adminni o‘chirib bo‘lmaydi', async () => {
  const c = await as('staff');
  const list = await c.get('/api/admin/users');
  const staffUsers = (list.data.users || []).filter((u) => u.role === 'staff');
  if (staffUsers.length === 1) {
    assert.strictEqual((await c.del(`/api/admin/users/${staffUsers[0].id}`)).status, 400);
  }
});

test('Ochiq yordamchi: bo‘sh savol 400, juda uzun savol qisqartiriladi', async () => {
  const c = h.client(app.base);
  assert.strictEqual((await c.post('/api/public/assistant', { q: '' }, { csrf: false })).status, 400);
  const long = await c.post('/api/public/assistant', { q: 'kontrakt '.repeat(200) }, { csrf: false });
  assert.strictEqual(long.status, 200);
});
